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
  const { agentId } = req.query;
  const filter = {};
  if (agentId && agentId !== 'undefined' && agentId !== 'all') {
    filter.$or = [
      { deliveryAgentId: agentId },
      { deliveryAgentId: 'agent@delivery.com' },
      { deliveryAgentId: 'user-delivery-1' },
    ];
  }

  const tasks = await DeliveryTask.find(filter).sort({ createdAt: -1 });
  return ApiResponse.send(res, 200, 'Delivery tasks retrieved successfully', tasks);
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
    // Also try finding by custom task id string or donationId
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
};
