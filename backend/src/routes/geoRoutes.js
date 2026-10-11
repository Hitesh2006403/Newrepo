const express = require('express');
const geoController = require('../controllers/geoController');
const { protect } = require('../middlewares/authMiddleware');
const validate = require('../middlewares/validateMiddleware');
const { requireFeatureFlag } = require('../constants/featureFlags');
const {
  geoSearchSchema,
  geoReverseSchema,
  geoRouteSchema,
} = require('../validations/geoValidation');

const router = express.Router();

// Feature flag guard & Authentication
router.use(requireFeatureFlag('FEATURE_MAPS'));
router.use(protect);

router.get('/search', validate({ query: geoSearchSchema }), geoController.searchGeo);
router.get('/reverse', validate({ query: geoReverseSchema }), geoController.reverseGeo);
router.get('/route', validate({ query: geoRouteSchema }), geoController.routeGeo);

module.exports = router;
