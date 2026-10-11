const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');
const ERROR_CODES = require('../constants/errorCodes');
const matchingService = require('../services/matchingService');
const Donation = require('../models/Donation');
const { ALLOT_MODES } = require('../constants/matching');

/**
 * GET /api/v1/matches/recommendations?donationId= or ?requirementId=
 * Returns algorithmic recommendations with per-component breakdown and tier ranking.
 */
const getRecommendations = asyncHandler(async (req, res) => {
  const { donationId, requirementId } = req.query;

  if (donationId) {
    const data = await matchingService.getRecommendationsForDonation(donationId, req.query);
    return ApiResponse.send(res, 200, 'Donation candidate recommendations retrieved', data);
  }

  if (requirementId) {
    const data = await matchingService.getRecommendationsForRequirement(requirementId, req.query);
    return ApiResponse.send(res, 200, 'Requirement donation recommendations retrieved', data);
  }

  throw new ApiError(400, ERROR_CODES.VALIDATION_ERROR, 'Either donationId or requirementId must be provided');
});

/**
 * GET /api/v1/donations/:id/split-plan?maxParts=
 * Proposes multi-recipient allocation for donor surplus.
 */
const getSplitPlan = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { maxParts } = req.query;

  const plan = await matchingService.calculateSplitPlan(id, maxParts);
  return ApiResponse.send(res, 200, 'Split plan proposed successfully', plan);
});

/**
 * POST /api/v1/donations/:id/split-plan/confirm
 * Creates targeted time-limited offers for each split plan portion.
 */
const confirmSplitPlan = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { parts } = req.body;

  const result = await matchingService.confirmSplitPlan(id, parts, req.user);
  return ApiResponse.send(res, 200, 'Split plan confirmed and offers dispatched', result);
});

/**
 * PATCH /api/v1/donations/:id/allot-mode
 * Switches donation allotment mode between MANUAL and AUTO.
 */
const updateAllotMode = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { allotMode } = req.body;

  const donation = await Donation.findById(id);
  if (!donation) {
    throw new ApiError(404, ERROR_CODES.NOT_FOUND, 'Donation not found');
  }

  if (donation.donorId.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    throw new ApiError(403, ERROR_CODES.FORBIDDEN, 'Only donation owner or admin can update allotment mode');
  }

  donation.allotMode = allotMode;
  await donation.save();

  let initialOffer = null;
  if (allotMode === ALLOT_MODES.AUTO && donation.remainingQuantity > 0) {
    initialOffer = await matchingService.processAutoAllotmentWave(donation._id);
  }

  return ApiResponse.send(res, 200, `Allotment mode updated to ${allotMode}`, {
    donationId: donation._id,
    allotMode: donation.allotMode,
    activeOffer: initialOffer,
  });
});

/**
 * POST /api/v1/matches/offers/:offerId/decline
 * Recipient declines time-limited offer; auto-advances to next wave.
 */
const declineOffer = asyncHandler(async (req, res) => {
  const { offerId } = req.params;
  const { reason } = req.body;

  const result = await matchingService.declineOffer(offerId, req.user, reason);
  return ApiResponse.send(res, 200, 'Offer declined successfully', result);
});

/**
 * POST /api/v1/acceptances/:id/reject
 * Donor, recipient, or admin rejects an acceptance before pickup.
 */
const rejectAcceptance = asyncHandler(async (req, res) => {
  const acceptanceId = req.params.id;
  const { reason } = req.body;

  // Find donation containing this acceptance
  const donation = await Donation.findOne({ 'acceptances._id': acceptanceId });
  if (!donation) {
    throw new ApiError(404, ERROR_CODES.NOT_FOUND, 'Acceptance not found');
  }

  const result = await matchingService.rejectAcceptanceAndReopen(
    donation._id,
    acceptanceId,
    req.user,
    reason
  );

  return ApiResponse.send(res, 200, 'Acceptance rejected and surplus reopened', result);
});

/**
 * GET /api/v1/requirements/:id/complete-with
 * Suggests surplus food to fulfill the remaining gap of a partially fulfilled requirement.
 */
const getCompletionSuggestions = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const data = await matchingService.suggestCompletionsForRequirement(id);
  return ApiResponse.send(res, 200, 'Completion suggestions retrieved', data);
});

module.exports = {
  getRecommendations,
  getSplitPlan,
  confirmSplitPlan,
  updateAllotMode,
  declineOffer,
  rejectAcceptance,
  getCompletionSuggestions,
};
