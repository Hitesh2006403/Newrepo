const express = require('express');
const mapController = require('../controllers/mapController');
const { protect } = require('../middlewares/authMiddleware');
const validate = require('../middlewares/validateMiddleware');
const { requireFeatureFlag } = require('../constants/featureFlags');
const { nearbyMapQuerySchema } = require('../validations/mapValidation');

const router = express.Router();

router.use(requireFeatureFlag('FEATURE_MAPS'));
router.use(protect);

router.get('/nearby', validate({ query: nearbyMapQuerySchema }), mapController.getNearbyMapItems);

module.exports = router;
