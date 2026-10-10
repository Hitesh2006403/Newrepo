const DeliveryTask = require('../models/DeliveryTask');
const ApiResponse = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');
const ERROR_CODES = require('../constants/errorCodes');
const asyncHandler = require('../utils/asyncHandler');

/**
 * GET /api/v1/delivery/tasks
 * Lists delivery tasks from MongoDB Atlas.
 */
const getDeliveryTasks = asyncHandler(async (req, res) => {
  const { agentId, includeOpen } = req.query;
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

  const tasks = await DeliveryTask.find(filter).sort({ createdAt: -1 });
  return ApiResponse.send(res, 200, 'Delivery tasks retrieved successfully', tasks);
});

/**
 * POST /api/v1/delivery/tasks/:id/claim
 * Driver accepts / claims an open delivery task from the radar.
 */
const claimDeliveryTask = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { agentId, agentName } = req.body;

  let task = await DeliveryTask.findById(id);
  if (!task) {
    task = await DeliveryTask.findOne({ $or: [{ _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }, { donationId: id }] });
  }

  if (!task) {
    throw new ApiError(404, ERROR_CODES.RESOURCE_NOT_FOUND, 'Delivery task not found');
  }

  task.deliveryAgentId = agentId || 'user-delivery-1';
  task.currentMilestone = 'ASSIGNED';
  task.deliveryProvider = 'IN_HOUSE';
  await task.save();

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

/**
 * POST /api/v1/delivery/tasks
 * Creates a new delivery task in MongoDB Atlas.
 */
const createDeliveryTask = asyncHandler(async (req, res) => {
  const task = await DeliveryTask.create(req.body);
  return ApiResponse.send(res, 201, 'Delivery task created successfully', task);
});

module.exports = {
  getDeliveryTasks,
  updateDeliveryTaskStatus,
  createDeliveryTask,
  claimDeliveryTask,
};
