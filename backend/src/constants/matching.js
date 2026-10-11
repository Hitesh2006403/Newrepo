/**
 * Smart Matching & Auto-Allotment Constants.
 * Centralized configurable parameters for Phase 3 matching engine.
 * All weights and limits are env-configurable with robust defaults.
 */

const parseNumber = (val, defaultVal) => {
  const n = Number(val);
  return isNaN(n) ? defaultVal : n;
};

// Component Weights for 0-100 Normalization
const MATCH_WEIGHTS = Object.freeze({
  URGENCY: parseNumber(process.env.MATCH_WEIGHT_URGENCY, 20),
  REQUIREMENT_PRIORITY: parseNumber(process.env.MATCH_WEIGHT_REQ_PRIORITY, 15),
  DISTANCE: parseNumber(process.env.MATCH_WEIGHT_DISTANCE, 20),
  QUANTITY_FIT: parseNumber(process.env.MATCH_WEIGHT_QUANTITY_FIT, 20),
  DIETARY_FOOD_TYPE: parseNumber(process.env.MATCH_WEIGHT_DIETARY, 10),
  PICKUP_AVAILABILITY: parseNumber(process.env.MATCH_WEIGHT_AVAILABILITY, 10),
  RELIABILITY: parseNumber(process.env.MATCH_WEIGHT_RELIABILITY, 5),
});

// Quantity fit tiers for candidate priority
const QUANTITY_TIERS = Object.freeze({
  TIER_1_EXACT: 1,       // Need equals remaining quantity
  TIER_2_APPROX: 2,      // Need within tolerance percentage (e.g. 20%)
  TIER_3_SPLIT: 3,       // Recipient needs less than remaining (leaves surplus for others)
  TIER_4_PARTIAL: 4,     // Recipient needs more than remaining (takes all, needs more)
});

// Allotment Modes
const ALLOT_MODES = Object.freeze({
  MANUAL: 'MANUAL',
  AUTO: 'AUTO',
});

// Offer statuses
const OFFER_STATUS = Object.freeze({
  PENDING: 'PENDING',
  ACCEPTED: 'ACCEPTED',
  DECLINED: 'DECLINED',
  EXPIRED: 'EXPIRED',
});

// Configuration limits & tolerances
const MATCH_CONFIG = Object.freeze({
  MIN_SCORE: parseNumber(process.env.MATCH_MIN_SCORE, 40),
  QUANTITY_TOLERANCE_PERCENT: parseNumber(process.env.QUANTITY_TOLERANCE_PERCENT, 20),
  DEFAULT_RADIUS_KM: parseNumber(process.env.MAP_DEFAULT_RADIUS_KM, 5),
  MAX_RADIUS_KM: parseNumber(process.env.MAP_MAX_RADIUS_KM, 10),
  OFFER_WAVE_SIZE: parseNumber(process.env.OFFER_WAVE_SIZE, 1),
  OFFER_TTL_MINUTES: parseNumber(process.env.OFFER_TTL_MINUTES, 10),
  SPLIT_MAX_PARTS: parseNumber(process.env.SPLIT_MAX_PARTS, 4),
  MIN_PORTION_QUANTITY: parseNumber(process.env.MIN_PORTION_QUANTITY, 5),
});

module.exports = {
  MATCH_WEIGHTS,
  QUANTITY_TIERS,
  ALLOT_MODES,
  OFFER_STATUS,
  MATCH_CONFIG,
};
