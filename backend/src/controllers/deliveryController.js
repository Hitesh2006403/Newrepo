const mongoose = require('mongoose');
const DeliveryTask = require('../models/DeliveryTask');
const User = require('../models/User');
const ApiResponse = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');
const ERROR_CODES = require('../constants/errorCodes');
const asyncHandler = require('../utils/asyncHandler');

const { parsePriorityFilter } = require('../utils/queryFilters');

/**
 * GET /api/v1/delivery/tasks
 * Lists delivery tasks from MongoDB Atlas.
 * Default ordering: effective expiry first (pickup.deadline), then priority HIGH first.
 */
const getDeliveryTasks = asyncHandler(async (req, res) => {
  const { agentId, includeOpen, priority, sort, volunteerOnly } = req.query;
  const filter = {};
  if (agentId && agentId !== 'undefined' && agentId !== 'all') {
    const agentFilters = [
      { deliveryAgentId: agentId },
      { deliveryAgentId: 'agent@delivery.com' },
      { deliveryAgentId: 'user-delivery-1' },
    ];
    if (includeOpen === 'true') {
      agentFilters.push({ currentMilestone: 'OPEN_FOR_PICKUP' });
    }
    filter.$or = agentFilters;
  }

  // Filter volunteer-only if requested via query or agent's user profile
  const isVolunteerOnly =
    req.user?.agentPreferences?.volunteerOnly === true || volunteerOnly === 'true';

  if (isVolunteerOnly) {
    const volunteerCondition = {
      $or: [
        { isVolunteer: true },
        { payerMode: 'NONE' },
        { deliveryFee: 0 },
        { deliveryFee: { $exists: false } },
      ],
    };
    if (filter.$or) {
      const existingOr = filter.$or;
      delete filter.$or;
      filter.$and = [{ $or: existingOr }, volunteerCondition];
    } else {
      filter.$or = volunteerCondition.$or;
    }
  }

  const priorityFilter = parsePriorityFilter(priority);
  if (priorityFilter) {
    filter.priority = priorityFilter;
  }

  let sortObject = { 'pickup.deadline': 1, priorityWeight: -1, createdAt: -1 };
  if (sort === 'priority_desc') {
    sortObject = { priorityWeight: -1, 'pickup.deadline': 1, createdAt: -1 };
  } else if (sort === 'priority_asc') {
    sortObject = { priorityWeight: 1, 'pickup.deadline': 1, createdAt: -1 };
  } else if (sort === 'newest') {
    sortObject = { createdAt: -1 };
  }

  const tasks = await DeliveryTask.find(filter).sort(sortObject);
  return ApiResponse.send(res, 200, 'Delivery tasks retrieved successfully', tasks);
});

/**
 * POST /api/v1/delivery/tasks/:id/claim
 * Driver accepts / claims an open delivery task from the radar.
 */
const claimDeliveryTask = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { agentId, agentName, expectedFeeVersion, feeVersion } = req.body;

  let task = await DeliveryTask.findById(id);
  if (!task) {
    task = await DeliveryTask.findOne({ $or: [{ _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }, { donationId: id }] });
  }

  if (!task) {
    throw new ApiError(404, ERROR_CODES.NOT_FOUND, 'Delivery task not found');
  }

  // Check agent user preferences for volunteer-only
  const effectiveAgentId = req.user?._id?.toString() || agentId || 'user-delivery-1';
  let agentUser = req.user;
  if (!agentUser && agentId && mongoose.Types.ObjectId.isValid(agentId)) {
    agentUser = await User.findById(agentId);
  }

  if (agentUser?.agentPreferences?.volunteerOnly === true) {
    if (task.payerMode && task.payerMode !== 'NONE' && task.deliveryFee > 0) {
      throw new ApiError(
        400,
        ERROR_CODES.AGENT_VOLUNTEER_ONLY,
        'This delivery includes a fee, but your profile is configured for volunteer-only deliveries'
      );
    }
  }

  // Concurrency check: feeVersion must match if provided
  const clientFeeVersion = feeVersion !== undefined ? feeVersion : expectedFeeVersion;
  if (clientFeeVersion !== undefined && clientFeeVersion !== null && task.feeVersion !== undefined) {
    if (Number(clientFeeVersion) !== Number(task.feeVersion)) {
      throw new ApiError(
        409,
        ERROR_CODES.FEE_CHANGED,
        'Delivery fee terms were updated while you were reviewing. Please refresh and review the new fee.'
      );
    }
  }

  task.deliveryAgentId = effectiveAgentId;
  task.currentMilestone = 'ASSIGNED';
  task.deliveryProvider = 'IN_HOUSE';
  task.feeLocked = true;
  await task.save();

  // If tied to an acceptance, lock fee status and record agent
  if (task.acceptanceId) {
    const donation = await Donation.findOne({ 'acceptances._id': task.acceptanceId });
    if (donation) {
      const acceptance = donation.acceptances.id(task.acceptanceId);
      if (acceptance) {
        if (!acceptance.deliveryAgentId && mongoose.Types.ObjectId.isValid(effectiveAgentId)) {
          acceptance.deliveryAgentId = effectiveAgentId;
        }
        if (acceptance.deliveryFee) {
          acceptance.deliveryFee.status = 'AGREED';
        }
        await donation.save();
      }
    }
  }

  return ApiResponse.send(res, 200, 'Delivery task successfully claimed and assigned to driver', task);
});

/**
 * PATCH /api/v1/delivery/tasks/:id/status
 * Updates delivery task milestone status in MongoDB Atlas.
 */
const updateDeliveryTaskStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status, safetyChecklistCompleted, verifiedAt } = req.body;

  let task = await DeliveryTask.findById(id);
  if (!task) {
    task = await DeliveryTask.findOne({ $or: [{ _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }, { donationId: id }] });
  }

  if (!task) {
    throw new ApiError(404, ERROR_CODES.RESOURCE_NOT_FOUND, 'Delivery task not found');
  }

  if (status) task.currentMilestone = status;
  if (safetyChecklistCompleted !== undefined) task.safetyChecklistCompleted = safetyChecklistCompleted;
  if (verifiedAt) task.verifiedAt = new Date(verifiedAt);

  await task.save();

  return ApiResponse.send(res, 200, `Task milestone updated to ${task.currentMilestone}`, task);
});

const geoService = require('../services/geoService');
const Donation = require('../models/Donation');

/**
 * POST /api/v1/delivery/feasibility
 * Evaluates whether road travel and handling can complete delivery prior to food expiry.
 */
const checkFeasibility = asyncHandler(async (req, res) => {
  const { fromLat, fromLng, toLat, toLng, expiryAt, safetyBufferMinutes, handlingBufferMinutes, donationId } = req.body;
  
  let dLat = fromLat;
  let dLng = fromLng;
  let exp = expiryAt;
  let sBuffer = safetyBufferMinutes;

  if (donationId) {
    const donation = await Donation.findById(donationId);
    if (donation) {
      if (donation.location?.coordinates) {
        dLng = donation.location.coordinates[0];
        dLat = donation.location.coordinates[1];
      }
      exp = exp || donation.expiryAt;
      sBuffer = sBuffer !== undefined ? sBuffer : donation.safetyBufferMinutes;
    }
  }

  if (dLat === undefined || dLng === undefined || toLat === undefined || toLng === undefined || !exp) {
    throw new ApiError(
      400,
      ERROR_CODES.VALIDATION_ERROR,
      'Donor coordinates (fromLat, fromLng), recipient coordinates (toLat, toLng), and expiryAt are required'
    );
  }

  const result = await geoService.checkPickupFeasibility({
    fromLat: parseFloat(dLat),
    fromLng: parseFloat(dLng),
    toLat: parseFloat(toLat),
    toLng: parseFloat(toLng),
    expiryAt: new Date(exp),
    safetyBufferMinutes: sBuffer !== undefined ? parseFloat(sBuffer) : 60,
    handlingBufferMinutes: handlingBufferMinutes ? parseFloat(handlingBufferMinutes) : 15,
  });

  return ApiResponse.send(res, 200, 'Pickup feasibility confirmed', result);
});

/**
 * POST /api/v1/delivery/tasks
 * Creates a new delivery task in MongoDB Atlas with feasibility verification.
 */
const createDeliveryTask = asyncHandler(async (req, res) => {
  // If donor and recipient coordinates are supplied or donation is linked, enforce feasibility
  const { fromLat, fromLng, toLat, toLng, expiryAt, donationId } = req.body;
  if ((fromLat !== undefined && toLat !== undefined && expiryAt) || donationId) {
    let dLat = fromLat;
    let dLng = fromLng;
    let exp = expiryAt;

    if (donationId) {
      const donation = await Donation.findById(donationId);
      if (donation) {
        if (donation.location?.coordinates) {
          dLng = donation.location.coordinates[0];
          dLat = donation.location.coordinates[1];
        }
        exp = exp || donation.expiryAt;
      }
    }

    if (dLat !== undefined && dLng !== undefined && toLat !== undefined && toLng !== undefined && exp) {
      const feasibility = await geoService.checkPickupFeasibility({
        fromLat: parseFloat(dLat),
        fromLng: parseFloat(dLng),
        toLat: parseFloat(toLat),
        toLng: parseFloat(toLng),
        expiryAt: new Date(exp),
      });

      if (!req.body.distanceTotalKm) req.body.distanceTotalKm = feasibility.distanceKm;
      if (!req.body.estimatedMinutes) req.body.estimatedMinutes = feasibility.etaMinutes;
    }
  }

  const task = await DeliveryTask.create(req.body);
  return ApiResponse.send(res, 201, 'Delivery task created successfully', task);
});

module.exports = {
  getDeliveryTasks,
  updateDeliveryTaskStatus,
  createDeliveryTask,
  claimDeliveryTask,
  checkFeasibility,
};
