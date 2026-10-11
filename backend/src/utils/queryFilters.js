const ApiError = require('./ApiError');
const ERROR_CODES = require('../constants/errorCodes');
const { PRIORITY } = require('../constants/priority');

const ALLOWED_PRIORITY_VALUES = Object.values(PRIORITY); // ['LOW', 'MEDIUM', 'HIGH']

const ALLOWED_SORT_OPTIONS = Object.freeze([
  'priority_desc',
  'priority_asc',
  'expiry_asc',
  'newest',
  'distance',
]);

/**
 * Validates and parses the ?priority= query parameter.
 * Supports single value ('HIGH') or comma-separated list ('HIGH,MEDIUM').
 * Strict security guard: rejects NoSQL injection objects or unknown values.
 *
 * @param {string|any} priorityParam
 * @returns {string|Object|null} Mongoose filter expression or null
 */
const parsePriorityFilter = (priorityParam) => {
  if (priorityParam === undefined || priorityParam === null || priorityParam === '') {
    return null;
  }

  // Reject NoSQL injection objects / operators
  if (typeof priorityParam !== 'string') {
    throw new ApiError(
      400,
      ERROR_CODES.VALIDATION_ERROR,
      'Priority query parameter must be a string'
    );
  }

  if (priorityParam.includes('$') || priorityParam.includes('{') || priorityParam.includes('}')) {
    throw new ApiError(
      400,
      ERROR_CODES.VALIDATION_ERROR,
      'NoSQL injection operators are strictly forbidden'
    );
  }

  const rawValues = priorityParam.split(',').map((p) => p.trim().toUpperCase());
  if (rawValues.length === 0 || rawValues.some((v) => v === '')) {
    throw new ApiError(
      400,
      ERROR_CODES.VALIDATION_ERROR,
      'Invalid empty priority value'
    );
  }

  for (const val of rawValues) {
    if (!ALLOWED_PRIORITY_VALUES.includes(val)) {
      throw new ApiError(
        400,
        ERROR_CODES.VALIDATION_ERROR,
        `Invalid priority value '${val}'. Allowed values: ${ALLOWED_PRIORITY_VALUES.join(', ')}`
      );
    }
  }

  if (rawValues.length === 1) {
    return rawValues[0];
  }

  return { $in: rawValues };
};

/**
 * Validates and parses the ?sort= query parameter.
 *
 * @param {string|any} sortParam
 * @param {string} defaultSort
 * @param {Array<string>} [customAllowed]
 * @returns {string} Validated sort key
 */
const parseSortParam = (sortParam, defaultSort = 'default', customAllowed = ALLOWED_SORT_OPTIONS) => {
  if (sortParam === undefined || sortParam === null || sortParam === '') {
    return defaultSort;
  }

  if (typeof sortParam !== 'string') {
    throw new ApiError(
      400,
      ERROR_CODES.VALIDATION_ERROR,
      'Sort parameter must be a string'
    );
  }

  if (sortParam.includes('$') || sortParam.includes('{') || sortParam.includes('}')) {
    throw new ApiError(
      400,
      ERROR_CODES.VALIDATION_ERROR,
      'NoSQL injection operators are strictly forbidden'
    );
  }

  const trimmed = sortParam.trim().toLowerCase();
  if (!customAllowed.includes(trimmed)) {
    throw new ApiError(
      400,
      ERROR_CODES.VALIDATION_ERROR,
      `Invalid sort parameter '${sortParam}'. Allowed sorts: ${customAllowed.join(', ')}`
    );
  }

  return trimmed;
};

/**
 * Maps a validated sort key to a stable Mongoose sort object for donations.
 */
const getDonationSortObject = (sortKey, hasGeoNear = false) => {
  switch (sortKey) {
    case 'priority_desc':
      return { priorityWeight: -1, expiryAt: 1, _id: 1 };
    case 'priority_asc':
      return { priorityWeight: 1, expiryAt: 1, _id: 1 };
    case 'expiry_asc':
      return { expiryAt: 1, priorityWeight: -1, _id: 1 };
    case 'newest':
      return { createdAt: -1, _id: 1 };
    case 'distance':
      if (!hasGeoNear) {
        // Fallback when no geo-coordinates supplied: soonest expiry, then high priority
        return { expiryAt: 1, priorityWeight: -1, _id: 1 };
      }
      return null; // MongoDB handles $nearSphere ordering
    case 'default':
    default:
      if (hasGeoNear) return null;
      // Default: soonest effective expiry first, then HIGH priority
      return { expiryAt: 1, priorityWeight: -1, _id: 1 };
  }
};

/**
 * Maps a validated sort key to a stable Mongoose sort object for recipient requirements.
 * Default: HIGH priority first, then neededBy deadline.
 */
const getRequirementSortObject = (sortKey, hasGeoNear = false) => {
  switch (sortKey) {
    case 'priority_desc':
      return { priorityWeight: -1, neededBy: 1, _id: 1 };
    case 'priority_asc':
      return { priorityWeight: 1, neededBy: 1, _id: 1 };
    case 'expiry_asc':
      return { neededBy: 1, priorityWeight: -1, _id: 1 };
    case 'newest':
      return { createdAt: -1, _id: 1 };
    case 'distance':
      if (!hasGeoNear) {
        return { priorityWeight: -1, neededBy: 1, _id: 1 };
      }
      return null; // MongoDB handles $nearSphere ordering
    case 'default':
    default:
      if (hasGeoNear) return null;
      // Default requirements: HIGH priority first, then neededBy
      return { priorityWeight: -1, neededBy: 1, _id: 1 };
  }
};

module.exports = {
  ALLOWED_PRIORITY_VALUES,
  ALLOWED_SORT_OPTIONS,
  parsePriorityFilter,
  parseSortParam,
  getDonationSortObject,
  getRequirementSortObject,
};
