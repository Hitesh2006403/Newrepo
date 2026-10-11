const express = require('express');
const feeController = require('../controllers/feeController');
const { protect } = require('../middlewares/authMiddleware');
const validate = require('../middlewares/validateMiddleware');
const {
  updateDeliveryFeeSchema,
  settleDeliveryFeeSchema,
  suggestFeeQuerySchema,
} = require('../validations/feeValidation');
const matchingController = require('../controllers/matchingController');
const { rejectAcceptanceSchema } = require('../validations/matchingValidation');
const { requireFeatureFlag } = require('../constants/featureFlags');

// 1. Fee Suggestion Router (/api/v1/fees)
const feesRouter = express.Router();
feesRouter.use(protect);
feesRouter.use(requireFeatureFlag('FEATURE_FEES'));

feesRouter.get('/suggest', validate({ query: suggestFeeQuerySchema }), feeController.getSuggestedFee);

// 2. Acceptance Router (/api/v1/acceptances)
const acceptancesRouter = express.Router();
acceptancesRouter.use(protect);

acceptancesRouter.put(
  '/:id/delivery-fee',
  requireFeatureFlag('FEATURE_FEES'),
  validate({ body: updateDeliveryFeeSchema }),
  feeController.updateDeliveryFee
);

acceptancesRouter.post(
  '/:id/delivery-fee/settle',
  requireFeatureFlag('FEATURE_FEES'),
  validate({ body: settleDeliveryFeeSchema }),
  feeController.settleDeliveryFee
);

acceptancesRouter.post(
  '/:id/reject',
  requireFeatureFlag('FEATURE_REJECT_REOPEN'),
  validate({ body: rejectAcceptanceSchema }),
  matchingController.rejectAcceptance
);

module.exports = {
  feesRouter,
  acceptancesRouter,
};
