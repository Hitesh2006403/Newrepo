/**
 * Shared Priority Constants & Numeric Weights
 *
 * Reused across all modules for consistent sorting, filtering, and scoring.
 * Numeric weights:
 *   LOW = 1
 *   MEDIUM = 2
 *   HIGH = 3
 */

const PRIORITY = Object.freeze({
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
});

const PRIORITY_WEIGHTS = Object.freeze({
  [PRIORITY.LOW]: 1,
  [PRIORITY.MEDIUM]: 2,
  [PRIORITY.HIGH]: 3,
});

const PRIORITY_OPTIONS = Object.freeze([
  { value: PRIORITY.LOW, label: 'Low', weight: PRIORITY_WEIGHTS.LOW },
  { value: PRIORITY.MEDIUM, label: 'Medium', weight: PRIORITY_WEIGHTS.MEDIUM },
  { value: PRIORITY.HIGH, label: 'High', weight: PRIORITY_WEIGHTS.HIGH },
]);

const DEFAULT_PRIORITY = PRIORITY.MEDIUM;

/**
 * Validates whether a value is a recognized priority string.
 */
const isValidPriority = (val) => {
  return typeof val === 'string' && Object.values(PRIORITY).includes(val.toUpperCase());
};

/**
 * Maps legacy requirement urgency strings to priority (CRITICAL maps to HIGH).
 */
const mapUrgencyToPriority = (urgency) => {
  if (!urgency) return DEFAULT_PRIORITY;
  const upper = urgency.toUpperCase();
  if (upper === 'CRITICAL') return PRIORITY.HIGH;
  if (Object.values(PRIORITY).includes(upper)) return upper;
  return DEFAULT_PRIORITY;
};

/**
 * Configurable rule constants for explainable priority match boost.
 */
const PRIORITY_MATCH_RULES = Object.freeze({
  BOTH_HIGH_BOOST: 6,
  HIGH_WITH_MEDIUM_BOOST: 4,
  BOTH_MEDIUM_BOOST: 2,
  ANY_HIGH_BOOST: 2,
  DEFAULT_BOOST: 0,
});

/**
 * Calculates the explainable priority boost component for matching score.
 * Never overrides safety buffers or expiry, purely additive within bounded range.
 */
const calculatePriorityBoost = (donationPriority = 'MEDIUM', requirementPriority = 'MEDIUM') => {
  const dWeight = PRIORITY_WEIGHTS[donationPriority] || 2;
  const rWeight = PRIORITY_WEIGHTS[requirementPriority] || 2;

  if (dWeight === 3 && rWeight === 3) return PRIORITY_MATCH_RULES.BOTH_HIGH_BOOST;
  if ((dWeight === 3 && rWeight === 2) || (dWeight === 2 && rWeight === 3)) {
    return PRIORITY_MATCH_RULES.HIGH_WITH_MEDIUM_BOOST;
  }
  if (dWeight === 2 && rWeight === 2) {
    return PRIORITY_MATCH_RULES.BOTH_MEDIUM_BOOST;
  }
  if (dWeight === 3 || rWeight === 3) {
    return PRIORITY_MATCH_RULES.ANY_HIGH_BOOST;
  }
  return PRIORITY_MATCH_RULES.DEFAULT_BOOST;
};

module.exports = {
  PRIORITY,
  PRIORITY_WEIGHTS,
  PRIORITY_OPTIONS,
  DEFAULT_PRIORITY,
  PRIORITY_MATCH_RULES,
  isValidPriority,
  mapUrgencyToPriority,
  calculatePriorityBoost,
};

