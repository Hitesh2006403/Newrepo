const { z } = require('zod');
const { VEHICLE_TYPES } = require('../constants/batch');

const createBatchSchema = z.object({
  taskIds: z
    .array(z.string().min(1, 'Task ID cannot be empty'))
    .min(2, 'A batch must include at least 2 tasks')
    .max(3, 'A batch can include at most 3 tasks'),
  vehicleType: z
    .enum(Object.values(VEHICLE_TYPES), {
      errorMap: () => ({
        message: "Vehicle type must be one of: '2_WHEELER', '3_WHEELER', '4_WHEELER', 'TRUCK'",
      }),
    })
    .default('2_WHEELER'),
});

const previewRouteSchema = z.object({
  taskIds: z
    .array(z.string().min(1, 'Task ID cannot be empty'))
    .min(2, 'At least 2 tasks required for co-routing preview')
    .max(3, 'At most 3 tasks permitted for co-routing preview'),
  vehicleType: z
    .enum(Object.values(VEHICLE_TYPES))
    .default('2_WHEELER'),
});

const claimBatchSchema = z.object({
  agentId: z.string().optional(),
  agentName: z.string().optional(),
});

module.exports = {
  createBatchSchema,
  previewRouteSchema,
  claimBatchSchema,
};
