const express = require('express');
const batchController = require('../controllers/batchController');
const { optionalAuth } = require('../middlewares/authMiddleware');
const { requireFeatureFlag } = require('../constants/featureFlags');

const router = express.Router();

// Enforce FEATURE_BATCH feature flag across all batch routes
router.use(requireFeatureFlag('FEATURE_BATCH'));

router.get('/available', optionalAuth, batchController.getAvailableBatches);
router.post('/preview', optionalAuth, batchController.previewRoute);
router.post('/', optionalAuth, batchController.createBatch);
router.get('/:id', optionalAuth, batchController.getBatchById);
router.post('/:id/claim', optionalAuth, batchController.claimBatch);
router.post('/:id/release', optionalAuth, batchController.releaseBatch);

module.exports = router;
