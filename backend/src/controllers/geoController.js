const geoService = require('../services/geoService');
const ApiResponse = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const ERROR_CODES = require('../constants/errorCodes');

/**
 * GET /api/v1/geo/search?q=
 * Searches for addresses via Nominatim.
 */
const searchGeo = asyncHandler(async (req, res) => {
  const { q } = req.query;
  try {
    const results = await geoService.searchAddress(q, req.user?._id?.toString());
    return ApiResponse.send(res, 200, 'Geocoding results retrieved', results);
  } catch (err) {
    if (err.code === 'RATE_LIMIT_EXCEEDED') {
      throw new ApiError(429, ERROR_CODES.TOO_MANY_REQUESTS, err.message);
    }
    if (err.code === 'GEO_UNAVAILABLE') {
      throw new ApiError(503, 'GEO_UNAVAILABLE', 'Geocoding service is temporarily unreachable');
    }
    throw err;
  }
});

/**
 * GET /api/v1/geo/reverse?lat=&lng=
 * Reverse geocodes coordinates to a street address.
 */
const reverseGeo = asyncHandler(async (req, res) => {
  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);

  try {
    const address = await geoService.reverseGeocode(lat, lng, req.user?._id?.toString());
    return ApiResponse.send(res, 200, 'Reverse geocode successful', address);
  } catch (err) {
    if (err.code === 'RATE_LIMIT_EXCEEDED') {
      throw new ApiError(429, ERROR_CODES.TOO_MANY_REQUESTS, err.message);
    }
    if (err.code === 'GEO_UNAVAILABLE') {
      throw new ApiError(503, 'GEO_UNAVAILABLE', 'Reverse geocoding service is temporarily unreachable');
    }
    throw err;
  }
});

/**
 * GET /api/v1/geo/route?fromLat=&fromLng=&toLat=&toLng=
 * Computes road route distance and travel duration.
 */
const routeGeo = asyncHandler(async (req, res) => {
  const fromLat = Number(req.query.fromLat);
  const fromLng = Number(req.query.fromLng);
  const toLat = Number(req.query.toLat);
  const toLng = Number(req.query.toLng);

  const routeResult = await geoService.route(fromLat, fromLng, toLat, toLng);
  return ApiResponse.send(res, 200, 'Route calculated successfully', routeResult);
});

module.exports = {
  searchGeo,
  reverseGeo,
  routeGeo,
};
