const { z } = require('zod');
const { PAYER_MODE } = require('../constants/fees');

const updateDeliveryFeeSchema = z.object({
  payerMode: z.enum(['NONE', 'DONOR', 'RECIPIENT', 'SPLIT'], {
    errorMap: () => ({ message: "Payer mode must be one of: 'NONE', 'DONOR', 'RECIPIENT', 'SPLIT'" }),
  }),
  amount: z.number().min(0, 'Fee amount cannot be negative').optional(),
  splitRatio: z
    .object({
      donor: z.number().min(0).max(100).default(50),
      recipient: z.number().min(0).max(100).default(50),
    })
    .optional(),
  auditNote: z.string().max(300).optional(),
});

const settleDeliveryFeeSchema = z.object({
  note: z.string().max(250).optional(),
});

const suggestFeeQuerySchema = z.object({
  acceptanceId: z.string().min(1, 'acceptanceId is required'),
});

module.exports = {
  updateDeliveryFeeSchema,
  settleDeliveryFeeSchema,
  suggestFeeQuerySchema,
};
