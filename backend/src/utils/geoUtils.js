/**
 * Geographic Utilities and Coordinate Conversions for Share A Plate.
 *
 * Enforces strict privacy standards:
 * - approxLocation rounds coordinates to 2 decimal places (~1.1 km cell).
 * - Exact coordinates are reserved strictly for authorized parties.
 * - Distance computations and sorting for non-privileged callers use approxLocation.
 */

/**
 * Rounds a floating point coordinate to given decimal places.
 * Default 2 decimals = ~1.1 km grid resolution.
 */
const roundCoordinate = (value, decimals = 2) => {
  if (typeof value !== 'number' || isNaN(value)) return null;
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
};

/**
 * Generates an approxLocation GeoJSON Point from an exact location Point.
 *
 * @param {Object} location - GeoJSON Point { type: 'Point', coordinates: [lng, lat] }
 * @returns {Object|null} approxLocation GeoJSON Point
 */
const computeApproxLocation = (location) => {
  if (!location || !Array.isArray(location.coordinates) || location.coordinates.length < 2) {
    return null;
  }
  const [lng, lat] = location.coordinates;
  const roundedLng = roundCoordinate(lng, 2);
  const roundedLat = roundCoordinate(lat, 2);
  if (roundedLng === null || roundedLat === null) return null;

  return {
    type: 'Point',
    coordinates: [roundedLng, roundedLat],
  };
};

/**
 * Calculates straight-line distance in kilometers between two points using the Haversine formula.
 *
 * @param {number[]} point1 - [lng1, lat1]
 * @param {number[]} point2 - [lng2, lat2]
 * @returns {number} Distance in kilometers rounded to 1 decimal place
 */
const calculateHaversineDistanceKm = (point1, point2) => {
  if (!Array.isArray(point1) || !Array.isArray(point2)) return 0;
  const [lng1, lat1] = point1;
  const [lng2, lat2] = point2;

  const toRad = (x) => (x * Math.PI) / 180;
  const R = 6371; // Earth's mean radius in km

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c;

  return Math.round(d * 10) / 10;
};

/**
 * Normalizes latitude and longitude inputs into GeoJSON Point [lng, lat].
 */
const toGeoJsonPoint = (lat, lng) => ({
  type: 'Point',
  coordinates: [Number(lng), Number(lat)],
});

/**
 * Extracts human-friendly { lat, lng } from a GeoJSON Point.
 */
const fromGeoJsonPoint = (point) => {
  if (!point || !Array.isArray(point.coordinates)) return null;
  return {
    lng: point.coordinates[0],
    lat: point.coordinates[1],
  };
};

module.exports = {
  roundCoordinate,
  computeApproxLocation,
  calculateHaversineDistanceKm,
  toGeoJsonPoint,
  fromGeoJsonPoint,
};
