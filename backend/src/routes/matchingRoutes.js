const express = require('express');
const matchingController = require('../controllers/matchingController');
const { protect } = require('../middlewares/authMiddleware');
const validate = require('../middlewares/validateMiddleware');
const {
  recommendationsQuerySchema,
  declineOfferSchema,
} = require('../validations/matchingValidation');
const { requireFeatureFlag } = require('../constants/featureFlags');

const router = express.Router();

// All matching endpoints require authentication
router.use(protect);

// GET /api/v1/matches/recommendations?donationId=... or ?requirementId=...
router.get(
  '/recommendations',
  validate({ query: recommendationsQuerySchema }),
  matchingController.getRecommendations
);

// POST /api/v1/matches/offers/:offerId/decline
router.post(
  '/offers/:offerId/decline',
  requireFeatureFlag('FEATURE_REJECT_REOPEN'),
  validate({ body: declineOfferSchema }),
  matchingController.declineOffer
);

module.exports = router;
