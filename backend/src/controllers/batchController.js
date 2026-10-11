const DeliveryBatch = require('../models/DeliveryBatch');
const DeliveryTask = require('../models/DeliveryTask');
const batchService = require('../services/batchService');
const ApiResponse = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');
const ERROR_CODES = require('../constants/errorCodes');
const asyncHandler = require('../utils/asyncHandler');
const {
  createBatchSchema,
  previewRouteSchema,
  claimBatchSchema,
} = require('../validations/batchValidation');

/**
 * GET /api/v1/delivery/batches/available
 * Discovers available proposed batches and co-routable pairings.
 */
const getAvailableBatches = asyncHandler(async (req, res) => {
  const { vehicleType, agentId } = req.query;
  const result = await batchService.getAvailableBatches({
    vehicleType: vehicleType || '2_WHEELER',
    agentId: agentId || req.user?._id?.toString(),
  });

  return ApiResponse.send(res, 200, 'Available delivery batches retrieved', result);
});

/**
 * POST /api/v1/delivery/batches
 * Creates a new proposed delivery batch with safety feasibility verification.
 */
const createBatch = asyncHandler(async (req, res) => {
  const validation = createBatchSchema.safeParse(req.body);
  if (!validation.success) {
    const errorMsg =
      validation.error.issues?.[0]?.message || validation.error.message || 'Invalid batch payload';
    throw new ApiError(400, ERROR_CODES.VALIDATION_ERROR, errorMsg);
  }

  const { taskIds, vehicleType } = validation.data;
  const batch = await batchService.createBatch({
    taskIds,
    vehicleType,
    agentId: req.user?._id?.toString() || null,
  });

  return ApiResponse.send(res, 201, 'Delivery batch created successfully', batch);
});

/**
 * POST /api/v1/delivery/batches/preview
 * Previews multi-stop sequence, road metrics, and safety checks without saving.
 */
const previewRoute = asyncHandler(async (req, res) => {
  const validation = previewRouteSchema.safeParse(req.body);
  if (!validation.success) {
    const errorMsg =
      validation.error.issues?.[0]?.message || validation.error.message || 'Invalid preview payload';
    throw new ApiError(400, ERROR_CODES.VALIDATION_ERROR, errorMsg);
  }

  const { taskIds, vehicleType } = validation.data;
  const tasks = await DeliveryTask.find({ _id: { $in: taskIds } });
  if (tasks.length !== taskIds.length) {
    throw new ApiError(404, ERROR_CODES.NOT_FOUND, 'One or more delivery tasks could not be found');
  }

  const routePlan = await batchService.computeOptimalBatchRoute(tasks, vehicleType);
  return ApiResponse.send(res, 200, 'Batch route preview calculated', routePlan);
});

/**
 * GET /api/v1/delivery/batches/:id
 * Retrieves batch details by ID or batchNumber.
 */
const getBatchById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  let batch = null;

  if (id.match(/^[0-9a-fA-F]{24}$/)) {
    batch = await DeliveryBatch.findById(id);
  }
  if (!batch) {
    batch = await DeliveryBatch.findOne({ batchNumber: id });
  }

  if (!batch) {
    throw new ApiError(404, ERROR_CODES.BATCH_NOT_FOUND, 'Delivery batch not found');
  }

  // Populate constituent tasks
  const tasks = await DeliveryTask.find({ _id: { $in: batch.taskIds } });

  return ApiResponse.send(res, 200, 'Delivery batch retrieved successfully', {
    ...batch.toObject(),
    tasks,
  });
});

/**
 * POST /api/v1/delivery/batches/:id/claim
 * Driver claims the batch, locking all constituent tasks.
 */
const claimBatch = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const validation = claimBatchSchema.safeParse(req.body || {});
  if (!validation.success) {
    const errorMsg =
      validation.error.issues?.[0]?.message || validation.error.message || 'Invalid claim request';
    throw new ApiError(400, ERROR_CODES.VALIDATION_ERROR, errorMsg);
  }

  let batch = null;
  if (id.match(/^[0-9a-fA-F]{24}$/)) {
    batch = await DeliveryBatch.findById(id);
  }
  if (!batch) {
    batch = await DeliveryBatch.findOne({ batchNumber: id });
  }

  if (!batch) {
    throw new ApiError(404, ERROR_CODES.BATCH_NOT_FOUND, 'Delivery batch not found');
  }

  const agentUser = req.user || {
    _id: req.body.agentId || 'user-delivery-1',
    name: req.body.agentName || 'Delivery Driver',
  };

  const claimed = await batchService.claimBatch(batch._id, agentUser);
  return ApiResponse.send(res, 200, 'Delivery batch claimed successfully', claimed);
});

/**
 * POST /api/v1/delivery/batches/:id/release
 * Releases a claimed batch back to open pool.
 */
const releaseBatch = asyncHandler(async (req, res) => {
  const { id } = req.params;
  let batch = null;
  if (id.match(/^[0-9a-fA-F]{24}$/)) {
    batch = await DeliveryBatch.findById(id);
  }
  if (!batch) {
    batch = await DeliveryBatch.findOne({ batchNumber: id });
  }

  if (!batch) {
    throw new ApiError(404, ERROR_CODES.BATCH_NOT_FOUND, 'Delivery batch not found');
  }

  const released = await batchService.releaseBatch(batch._id);
  return ApiResponse.send(res, 200, 'Delivery batch released successfully', released);
});

module.exports = {
  getAvailableBatches,
  createBatch,
  previewRoute,
  getBatchById,
  claimBatch,
  releaseBatch,
};
