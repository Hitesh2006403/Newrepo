const express = require('express');
const ApiResponse = require('../utils/ApiResponse');
const authRoutes = require('./authRoutes');
const adminRoutes = require('./adminRoutes');

const router = express.Router();

/**
 * @route   GET /api/v1/health
 * @desc    System health and liveness check
 * @access  Public
 */
router.get('/health', (req, res) => {
  return ApiResponse.send(res, 200, 'System operational', {
    status: 'UP',
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

// Authentication and session routes (/api/v1/auth)
router.use('/auth', authRoutes);

// Administrator management routes (/api/v1/admin)
router.use('/admin', adminRoutes);

// Test harness verification route (active only in test environment)
if (process.env.NODE_ENV === 'test') {
  const { protect } = require('../middlewares/authMiddleware');
  const requireVerified = require('../middlewares/verificationMiddleware');
  router.get('/test-verified-action', protect, requireVerified, (req, res) => {
    res.status(200).json({ success: true, message: 'Action allowed for verified account' });
  });
}

module.exports = router;
