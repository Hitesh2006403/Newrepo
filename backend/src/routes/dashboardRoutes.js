const express = require('express');
const dashboardController = require('../controllers/dashboardController');
const { protect } = require('../middlewares/authMiddleware');
const authorizeRoles = require('../middlewares/roleMiddleware');
const requireVerified = require('../middlewares/verificationMiddleware');
const { ROLES } = require('../constants/roles');

const router = express.Router();

/**
 * GET /api/v1/dashboard/impact
 * Public platform-level impact statistics (no authentication required).
 */
router.get('/impact', dashboardController.getPublicImpact);

/**
 * GET /api/v1/dashboard/donor
 * Donor analytics dashboard (donor only).
 */
router.get(
  '/donor',
  protect,
  authorizeRoles(ROLES.DONOR, ROLES.ADMIN),
  dashboardController.getDonorDashboard
);

/**
 * GET /api/v1/dashboard/recipient
 * Recipient demand & claim dashboard (verified recipient only).
 */
router.get(
  '/recipient',
  protect,
  authorizeRoles(ROLES.RECIPIENT, ROLES.ADMIN),
  requireVerified,
  dashboardController.getRecipientDashboard
);

module.exports = router;
