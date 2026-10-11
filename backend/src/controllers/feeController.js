const Donation = require('../models/Donation');
const User = require('../models/User');
const DeliveryTask = require('../models/DeliveryTask');
const ApiResponse = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');
const ERROR_CODES = require('../constants/errorCodes');
const asyncHandler = require('../utils/asyncHandler');
const { PAYER_MODE, FEE_STATUS, getFeeConfig, calculateSuggestedFee } = require('../constants/fees');
const { ACCEPTANCE_STATUS } = require('../constants/status');
const geoService = require('../services/geoService');
const { domainEvents } = require('../services/domainEvents');
const { createInAppNotification } = require('../services/notificationService');

/**
 * GET /api/v1/fees/suggest?acceptanceId=
 * Calculates server-side recommended delivery fee based on route distance.
 * Protected: Attached donor, attached recipient, or admin only.
 */
const getSuggestedFee = asyncHandler(async (req, res) => {
  const { acceptanceId } = req.query;
  if (!acceptanceId) {
    throw new ApiError(400, ERROR_CODES.VALIDATION_ERROR, 'acceptanceId is required');
  }

  const donation = await Donation.findOne({ 'acceptances._id': acceptanceId })
    .populate('donorId', 'name organization location')
    .populate('acceptances.recipientId', 'name organization location');

  if (!donation) {
    throw new ApiError(404, ERROR_CODES.NOT_FOUND, 'Acceptance record not found');
  }

  const acceptance = donation.acceptances.id(acceptanceId);
  if (!acceptance) {
    throw new ApiError(404, ERROR_CODES.NOT_FOUND, 'Acceptance slice not found');
  }

  const viewerId = req.user._id.toString();
  const donorId = donation.donorId?._id?.toString() || donation.donorId?.toString();
  const recipientId = acceptance.recipientId?._id?.toString() || acceptance.recipientId?.toString();
  const isAdmin = req.user.role === 'admin';

  if (viewerId !== donorId && viewerId !== recipientId && !isAdmin) {
    throw new ApiError(403, ERROR_CODES.FORBIDDEN, 'Access denied: You are not an attached party to this acceptance');
  }

  // Calculate route distance from exact coordinates
  let distanceKm = 3.5;
  const donorCoords = donation.location?.coordinates;
  const recipientCoords = acceptance.recipientId?.location?.coordinates;

  if (donorCoords && recipientCoords) {
    try {
      const route = await geoService.route(donorCoords[1], donorCoords[0], recipientCoords[1], recipientCoords[0]);
      distanceKm = route.distanceKm || distanceKm;
    } catch {}
  }

  const { maxAmount, baseAmount, perKm } = getFeeConfig();
  const suggestedAmount = calculateSuggestedFee(distanceKm);

  return ApiResponse.send(res, 200, 'Suggested delivery fee calculated', {
    suggestedAmount,
    distanceKm,
    baseAmount,
    perKm,
    maxAmount,
    currency: 'INR',
    currentPayerMode: acceptance.deliveryFee?.payerMode || PAYER_MODE.NONE,
    currentAmount: acceptance.deliveryFee?.amount || 0,
    feeStatus: acceptance.deliveryFee?.status || FEE_STATUS.AGREED,
    feeVersion: acceptance.deliveryFee?.feeVersion || 1,
  });
});

/**
 * PUT /api/v1/acceptances/:id/delivery-fee
 * Sets or proposes delivery fee choice prior to agent assignment.
 * Protected: Attached donor, attached recipient, or admin.
 */
const updateDeliveryFee = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { payerMode, amount, splitRatio, auditNote } = req.body;

  const donation = await Donation.findOne({ 'acceptances._id': id }).populate('donorId', 'name organization');
  if (!donation) {
    throw new ApiError(404, ERROR_CODES.NOT_FOUND, 'Acceptance not found');
  }

  const acceptance = donation.acceptances.id(id);
  if (!acceptance) {
    throw new ApiError(404, ERROR_CODES.NOT_FOUND, 'Acceptance not found');
  }

  const viewerId = req.user._id.toString();
  const donorId = donation.donorId?._id?.toString() || donation.donorId?.toString();
  const recipientId = acceptance.recipientId?._id?.toString() || acceptance.recipientId?.toString();
  const isAdmin = req.user.role === 'admin';

  if (viewerId !== donorId && viewerId !== recipientId && !isAdmin) {
    throw new ApiError(403, ERROR_CODES.FORBIDDEN, 'Access denied: You are not an attached party');
  }

  // Invariant 1: Locked once an agent accepts or is assigned
  if (acceptance.deliveryAgentId) {
    throw new ApiError(400, ERROR_CODES.FEE_LOCKED, 'Delivery fee is locked because an agent is already assigned');
  }

  // Invariant 2: Cannot alter fee if acceptance is completed, cancelled, or rejected
  if ([ACCEPTANCE_STATUS.COMPLETED, ACCEPTANCE_STATUS.CANCELLED, ACCEPTANCE_STATUS.REJECTED].includes(acceptance.status)) {
    throw new ApiError(400, ERROR_CODES.FEE_NOT_ALLOWED, `Cannot update delivery fee on ${acceptance.status} acceptance`);
  }

  const { maxAmount } = getFeeConfig();
  let requestedAmount = amount !== undefined ? Number(amount) : 0;

  if (requestedAmount > maxAmount) {
    throw new ApiError(400, ERROR_CODES.FEE_EXCEEDS_MAX, `Delivery fee exceeds platform maximum of ₹${maxAmount}`);
  }

  if (!acceptance.deliveryFee) {
    acceptance.deliveryFee = {
      payerMode: PAYER_MODE.NONE,
      amount: 0,
      feeVersion: 1,
      status: FEE_STATUS.AGREED,
      proposals: [],
    };
  }

  const currentFee = acceptance.deliveryFee;
  const callerRole = isAdmin ? 'admin' : viewerId === donorId ? 'donor' : 'recipient';

  // Rule: NONE forces amount 0 and status AGREED
  if (payerMode === PAYER_MODE.NONE) {
    requestedAmount = 0;
    currentFee.payerMode = PAYER_MODE.NONE;
    currentFee.amount = 0;
    currentFee.status = FEE_STATUS.AGREED;
    currentFee.feeVersion = (currentFee.feeVersion || 1) + 1;
    currentFee.proposedBy = req.user._id;
  } else if (isAdmin) {
    currentFee.payerMode = payerMode;
    currentFee.amount = requestedAmount;
    currentFee.status = FEE_STATUS.AGREED;
    currentFee.auditNote = auditNote || 'Admin override';
    currentFee.feeVersion = (currentFee.feeVersion || 1) + 1;
  } else {
    // Record proposal
    const otherRole = callerRole === 'donor' ? 'recipient' : 'donor';
    const lastOtherProposal = [...(currentFee.proposals || [])].reverse().find((p) => p.partyRole === otherRole);

    currentFee.proposals.push({
      partyRole: callerRole,
      partyId: req.user._id,
      payerMode,
      amount: requestedAmount,
      proposedAt: new Date(),
    });

    if (lastOtherProposal && lastOtherProposal.payerMode === payerMode) {
      // Both agreed on payerMode: lower amount wins
      currentFee.amount = Math.min(requestedAmount, lastOtherProposal.amount);
      currentFee.payerMode = payerMode;
      currentFee.status = FEE_STATUS.AGREED;
    } else {
      // Disagreement or first proposal: active amount is caller amount, status PROPOSED
      currentFee.payerMode = payerMode;
      currentFee.amount = requestedAmount;
      currentFee.status = lastOtherProposal ? FEE_STATUS.PROPOSED : FEE_STATUS.PROPOSED;
    }

    if (splitRatio && payerMode === PAYER_MODE.SPLIT) {
      currentFee.splitRatio = splitRatio;
    }

    currentFee.proposedBy = req.user._id;
    currentFee.feeVersion = (currentFee.feeVersion || 1) + 1;
  }

  // Synchronize with active DeliveryTask if exists
  await DeliveryTask.updateMany(
    { $or: [{ acceptanceId: id }, { donationId: donation._id.toString() }], currentMilestone: 'OPEN_FOR_PICKUP' },
    {
      $set: {
        payerMode: currentFee.payerMode,
        deliveryFee: currentFee.amount,
        feeVersion: currentFee.feeVersion,
        isVolunteer: currentFee.payerMode === PAYER_MODE.NONE || currentFee.amount === 0,
      },
    }
  );

  await donation.save();

  // Send safe notification to other party without PII
  const targetUserId = callerRole === 'donor' ? recipientId : donorId;
  if (targetUserId) {
    try {
      await createInAppNotification({
        userId: targetUserId,
        type: 'DELIVERY_UPDATE',
        title: 'Delivery Fee Proposal Updated',
        message: `Delivery fee arrangement was updated to ${currentFee.payerMode} (₹${currentFee.amount})`,
        data: { acceptanceId: id, donationId: donation._id },
      });
    } catch {}
  }

  domainEvents.emitSafe('deliveryFee.updated', { acceptanceId: id, deliveryFee: currentFee });

  return ApiResponse.send(res, 200, 'Delivery fee arrangement updated', currentFee);
});

/**
 * POST /api/v1/acceptances/:id/delivery-fee/settle
 * Self-reported delivery fee settlement note (completed outside the platform).
 * Can only be marked after physical handover verification.
 */
const settleDeliveryFee = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { note } = req.body;

  const donation = await Donation.findOne({ 'acceptances._id': id });
  if (!donation) {
    throw new ApiError(404, ERROR_CODES.NOT_FOUND, 'Acceptance not found');
  }

  const acceptance = donation.acceptances.id(id);
  if (!acceptance) {
    throw new ApiError(404, ERROR_CODES.NOT_FOUND, 'Acceptance not found');
  }

  const viewerId = req.user._id.toString();
  const donorId = donation.donorId?.toString();
  const recipientId = acceptance.recipientId?.toString();
  const agentId = acceptance.deliveryAgentId?.toString();
  const isAdmin = req.user.role === 'admin';

  const isParty = viewerId === donorId || viewerId === recipientId || viewerId === agentId || isAdmin;
  if (!isParty) {
    throw new ApiError(403, ERROR_CODES.FORBIDDEN, 'Access denied: You are not an authorized party');
  }

  // Must only settle AFTER physical handover verified or completed
  if (!acceptance.handoverVerifiedAt && acceptance.status !== ACCEPTANCE_STATUS.COMPLETED && acceptance.status !== 'DELIVERED') {
    throw new ApiError(400, ERROR_CODES.VALIDATION_ERROR, 'Settlement can only be recorded after physical handover is verified');
  }

  if (!acceptance.deliveryFee) {
    acceptance.deliveryFee = { payerMode: PAYER_MODE.NONE, amount: 0, status: FEE_STATUS.AGREED, feeVersion: 1 };
  }
  if (!acceptance.deliveryFee.settled) {
    acceptance.deliveryFee.settled = { agentMarked: false, payerMarked: false };
  }

  if (viewerId === agentId) {
    acceptance.deliveryFee.settled.agentMarked = true;
    acceptance.deliveryFee.settled.agentSettledAt = new Date();
  }
  if (viewerId === donorId || viewerId === recipientId) {
    acceptance.deliveryFee.settled.payerMarked = true;
    acceptance.deliveryFee.settled.payerSettledAt = new Date();
  }
  if (isAdmin) {
    acceptance.deliveryFee.settled.agentMarked = true;
    acceptance.deliveryFee.settled.payerMarked = true;
  }
  if (note) {
    acceptance.deliveryFee.settled.note = note;
  }

  // Mark DeliveryTask as settled
  await DeliveryTask.updateMany(
    { $or: [{ acceptanceId: id }, { donationId: donation._id.toString() }] },
    { $set: { settled: true } }
  );

  await donation.save();

  return ApiResponse.send(res, 200, 'Delivery fee settlement self-reported successfully', acceptance.deliveryFee.settled);
});

module.exports = {
  getSuggestedFee,
  updateDeliveryFee,
  settleDeliveryFee,
};
