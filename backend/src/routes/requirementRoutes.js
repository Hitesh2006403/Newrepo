const express = require('express');
const requirementController = require('../controllers/requirementController');
const { protect } = require('../middlewares/authMiddleware');
const authorizeRoles = require('../middlewares/roleMiddleware');
const requireVerified = require('../middlewares/verificationMiddleware');
const validate = require('../middlewares/validateMiddleware');
const {
  createRequirementSchema,
  updateRequirementSchema,
} = require('../validations/requirementValidation');
const { ROLES } = require('../constants/roles');
const matchingController = require('../controllers/matchingController');
const { requireFeatureFlag } = require('../constants/featureFlags');

const router = express.Router();

router.use(protect);

router.post(
  '/',
  authorizeRoles(ROLES.RECIPIENT, ROLES.ADMIN),
  requireVerified,
  validate({ body: createRequirementSchema }),
  requirementController.createRequirement
);

router.get('/', requirementController.listRequirements);
router.get('/:id/matches', requirementController.getSmartMatches);
router.get(
  '/:id/complete-with',
  requireFeatureFlag('FEATURE_SPLIT'),
  matchingController.getCompletionSuggestions
);
router.get('/:id', requirementController.getRequirementById);

router.patch(
  '/:id',
  authorizeRoles(ROLES.RECIPIENT, ROLES.ADMIN),
  validate({ body: updateRequirementSchema }),
  requirementController.updateRequirement
);

module.exports = router;

