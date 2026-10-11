const { z } = require('zod');

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

const objectIdSchema = z
  .string()
  .trim()
  .regex(objectIdRegex, 'Must be a valid 24-character hexadecimal ObjectId');

const recommendationsQuerySchema = z
  .object({
    donationId: objectIdSchema.optional(),
    requirementId: objectIdSchema.optional(),
    radiusKm: z.coerce.number().min(1).max(10).optional(),
    priority: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional(),
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(50).optional(),
  })
  .strict()
  .refine(
    (data) => Boolean(data.donationId || data.requirementId),
    'Either donationId or requirementId must be provided'
  );

const splitPlanQuerySchema = z
  .object({
    maxParts: z.coerce.number().int().min(2).max(4).optional(),
  })
  .strict();

const confirmSplitPlanSchema = z
  .object({
    parts: z
      .array(
        z
          .object({
            recipientId: objectIdSchema,
            requirementId: objectIdSchema.optional(),
            allocatedQuantity: z.number().positive(),
          })
          .strict()
      )
      .min(1)
      .max(4),
  })
  .strict();

const declineOfferSchema = z
  .object({
    reason: z.string().trim().max(300).optional(),
  })
  .strict();

const rejectAcceptanceSchema = z
  .object({
    reason: z
      .string()
      .trim()
      .min(3, 'Rejection reason must be at least 3 characters long')
      .max(500, 'Rejection reason cannot exceed 500 characters'),
  })
  .strict();

const updateAllotModeSchema = z
  .object({
    allotMode: z.enum(['MANUAL', 'AUTO']),
  })
  .strict();

module.exports = {
  recommendationsQuerySchema,
  splitPlanQuerySchema,
  confirmSplitPlanSchema,
  declineOfferSchema,
  rejectAcceptanceSchema,
  updateAllotModeSchema,
};
