/**
 * Feature Flags Configuration for Share A Plate.
 *
 * Controls progressive delivery of advanced capabilities:
 * - FEATURE_MAPS: Leaflet, OSM, Nominatim, and proximity radius radar
 * - FEATURE_FEES: Delivery fee negotiation & agreement protocols
 * - FEATURE_AUTO_ALLOT: Algorithmic best-fit auto-allotment waves
 * - FEATURE_SPLIT: Multi-candidate split-and-divide redistribution
 * - FEATURE_REJECT_REOPEN: Graceful reject-and-reopen flow
 * - FEATURE_BATCH: Delivery batching & co-routing
 * - FEATURE_UI_3D: Interactive 3D / spatial UI enhancements
 *
 * All flags default to true unless explicitly disabled in process.env.
 */

const parseBooleanFlag = (val, defaultValue = true) => {
  if (val === undefined || val === null || val === '') return defaultValue;
  if (typeof val === 'boolean') return val;
  const s = String(val).trim().toLowerCase();
  if (s === 'false' || s === '0' || s === 'off' || s === 'no') return false;
  return true;
};

const getFeatureFlags = () => Object.freeze({
  FEATURE_MAPS: parseBooleanFlag(process.env.FEATURE_MAPS, true),
  FEATURE_FEES: parseBooleanFlag(process.env.FEATURE_FEES, true),
  FEATURE_AUTO_ALLOT: parseBooleanFlag(process.env.FEATURE_AUTO_ALLOT, true),
  FEATURE_SPLIT: parseBooleanFlag(process.env.FEATURE_SPLIT, true),
  FEATURE_REJECT_REOPEN: parseBooleanFlag(process.env.FEATURE_REJECT_REOPEN, true),
  FEATURE_BATCH: parseBooleanFlag(process.env.FEATURE_BATCH, true),
  FEATURE_UI_3D: parseBooleanFlag(process.env.FEATURE_UI_3D, true),
});

/**
 * Middleware factory ensuring an endpoint is protected by a feature flag.
 * If the feature flag is disabled, returns 404 with a helpful message.
 */
const requireFeatureFlag = (flagName) => (req, res, next) => {
  const flags = getFeatureFlags();
  if (!flags[flagName]) {
    return res.status(404).json({
      success: false,
      error: {
        code: 'FEATURE_DISABLED',
        message: `This capability is currently disabled by system configuration (${flagName}).`,
      },
    });
  }
  next();
};

module.exports = {
  getFeatureFlags,
  requireFeatureFlag,
};
