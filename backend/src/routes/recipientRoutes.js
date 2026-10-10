const express = require('express');
const requirementController = require('../controllers/requirementController');
const { protect } = require('../middlewares/authMiddleware');
const authorizeRoles = require('../middlewares/roleMiddleware');
const { ROLES } = require('../constants/roles');

const router = express.Router();

// Public / Recipient discovery routes
router.get('/matches', requirementController.getSmartMatches);

// Requirements
router.get('/requirements', (req, res, next) => {
  // If authenticated, delegate to requirementController.listRequirements
  if (req.headers.authorization) {
    return protect(req, res, () => requirementController.listRequirements(req, res, next));
  }
  // Public view of open requirements
  const RecipientRequirement = require('../models/RecipientRequirement');
  const ApiResponse = require('../utils/ApiResponse');
  RecipientRequirement.find({ status: 'OPEN' })
    .sort({ createdAt: -1 })
    .limit(20)
    .populate('recipientId', 'name organization')
    .then((reqs) => ApiResponse.send(res, 200, 'Open requirements retrieved', reqs))
    .catch(next);
});

router.post(
  '/requirements',
  protect,
  authorizeRoles(ROLES.RECIPIENT, ROLES.ADMIN),
  requirementController.createRequirement
);

module.exports = router;
