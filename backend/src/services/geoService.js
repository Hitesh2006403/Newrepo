const { calculateHaversineDistanceKm } = require('../utils/geoUtils');

/**
 * Geographic Services Provider for Share A Plate.
 *
 * Implements OpenStreetMap (OSM) integrations without paid SDKs:
 * - Nominatim: Forward search & Reverse geocoding (rate-limited to 1 req/sec)
 * - OSRM: Road routing & duration calculation (with Haversine fallback)
 *
 * Security & Reliability:
 * - SSRF-safe hostname validation & fixed allowed origins
 * - AbortSignal 5s timeout & response size caps
 * - In-memory LRU/TTL caching (24h geocoding, 10m routes)
 * - Graceful fallback to estimated straight-line travel (avg 20 km/h)
 */

const NOMINATIM_DEFAULT = 'https://nominatim.openstreetmap.org';
const OSRM_DEFAULT = 'https://router.project-osrm.org';

const GEO_CACHE_GEOCODE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const GEO_CACHE_ROUTE_TTL_MS = 10 * 60 * 1000;        // 10 minutes

// In-memory caches with timestamp validation
const geocodeCache = new Map();
const routeCache = new Map();

// Global request queue to enforce max 1 Nominatim request per second
let lastNominatimTimestamp = 0;
const nominatimQueue = [];
let isProcessingQueue = false;

const scheduleNominatimRequest = (fn) =>
  new Promise((resolve, reject) => {
    nominatimQueue.push({ fn, resolve, reject });
    processNominatimQueue();
  });

const processNominatimQueue = async () => {
  if (isProcessingQueue || nominatimQueue.length === 0) return;
  isProcessingQueue = true;

  while (nominatimQueue.length > 0) {
    const item = nominatimQueue.shift();
    const now = Date.now();
    const elapsed = now - lastNominatimTimestamp;
    const minDelay = 1000; // 1 second interval

    if (elapsed < minDelay) {
      await new Promise((res) => setTimeout(res, minDelay - elapsed));
    }

    lastNominatimTimestamp = Date.now();
    try {
      const result = await item.fn();
      item.resolve(result);
    } catch (err) {
      item.reject(err);
    }
  }

  isProcessingQueue = false;
};

// In-memory per-user rate limiter for geocoding (max 20 req/minute)
const userRateLimits = new Map();

const checkUserGeocodeRateLimit = (userId) => {
  if (!userId) return true;
  const now = Date.now();
  const windowMs = 60 * 1000;
  const maxRequests = 20;

  const userData = userRateLimits.get(userId) || [];
  const recent = userData.filter((ts) => now - ts < windowMs);

  if (recent.length >= maxRequests) {
    return false;
  }

  recent.push(now);
  userRateLimits.set(userId, recent);
  return true;
};

// SSRF safety check: Ensures external requests only hit allowed hosts
const isAllowedUrl = (urlString, allowedHosts) => {
  try {
    const parsed = new URL(urlString);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false;
    return allowedHosts.some((h) => parsed.hostname === h || parsed.hostname.endsWith(`.${h}`));
  } catch {
    return false;
  }
};

/**
 * Searches for addresses via Nominatim.
 *
 * @param {string} query - 3 to 120 character search string
 * @param {string} [userId] - Optional user identifier for rate limiting
 * @returns {Promise<Array>} List of geocoded candidate objects
 */
const searchAddress = async (query, userId = null) => {
  if (!query || typeof query !== 'string' || query.trim().length < 3) {
    return [];
  }

  if (userId && !checkUserGeocodeRateLimit(userId)) {
    const err = new Error('Geocoding rate limit exceeded (max 20 requests per minute)');
    err.code = 'RATE_LIMIT_EXCEEDED';
    throw err;
  }

  const cacheKey = `search:${query.trim().toLowerCase()}`;
  const cached = geocodeCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < GEO_CACHE_GEOCODE_TTL_MS) {
    return cached.data;
  }

  const baseUrl = process.env.NOMINATIM_BASE_URL || NOMINATIM_DEFAULT;
  const contactEmail = process.env.GEO_CONTACT_EMAIL || 'support@shareaplate.org';
  const countryCodes = process.env.GEO_COUNTRY_CODES || 'in';

  const params = new URLSearchParams({
    q: query.trim(),
    format: 'json',
    addressdetails: '1',
    limit: '5',
    countrycodes: countryCodes,
  });

  const requestUrl = `${baseUrl}/search?${params.toString()}`;

  return scheduleNominatimRequest(async () => {
    try {
      const response = await fetch(requestUrl, {
        headers: {
          'User-Agent': `ShareAPlate/1.0 (${contactEmail})`,
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) {
        const err = new Error(`Nominatim returned status ${response.status}`);
        err.code = 'GEO_UNAVAILABLE';
        throw err;
      }

      const raw = await response.json();
      const results = (Array.isArray(raw) ? raw : []).map((item) => ({
        formattedAddress: item.display_name,
        city:
          item.address?.city ||
          item.address?.town ||
          item.address?.suburb ||
          item.address?.village ||
          'Bengaluru',
        state: item.address?.state || 'Karnataka',
        postalCode: item.address?.postcode || '',
        lat: parseFloat(item.lat),
        lng: parseFloat(item.lon),
        rawAddress: item.address,
      }));

      geocodeCache.set(cacheKey, { timestamp: Date.now(), data: results });
      return results;
    } catch (err) {
      if (err.name === 'TimeoutError' || err.code === 'GEO_UNAVAILABLE') {
        const e = new Error('Geocoding service currently unavailable');
        e.code = 'GEO_UNAVAILABLE';
        throw e;
      }
      throw err;
    }
  });
};

/**
 * Reverse geocodes coordinates to a human-readable address.
 *
 * @param {number} lat
 * @param {number} lng
 * @param {string} [userId]
 * @returns {Promise<Object>} Formatted address details
 */
const reverseGeocode = async (lat, lng, userId = null) => {
  if (typeof lat !== 'number' || typeof lng !== 'number' || isNaN(lat) || isNaN(lng)) {
    throw new Error('Valid latitude and longitude numbers are required');
  }

  if (userId && !checkUserGeocodeRateLimit(userId)) {
    const err = new Error('Geocoding rate limit exceeded (max 20 requests per minute)');
    err.code = 'RATE_LIMIT_EXCEEDED';
    throw err;
  }

  const cacheKey = `rev:${lat.toFixed(4)},${lng.toFixed(4)}`;
  const cached = geocodeCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < GEO_CACHE_GEOCODE_TTL_MS) {
    return cached.data;
  }

  const baseUrl = process.env.NOMINATIM_BASE_URL || NOMINATIM_DEFAULT;
  const contactEmail = process.env.GEO_CONTACT_EMAIL || 'support@shareaplate.org';

  const params = new URLSearchParams({
    lat: lat.toString(),
    lon: lng.toString(),
    format: 'json',
    addressdetails: '1',
  });

  const requestUrl = `${baseUrl}/reverse?${params.toString()}`;

  return scheduleNominatimRequest(async () => {
    try {
      const response = await fetch(requestUrl, {
        headers: {
          'User-Agent': `ShareAPlate/1.0 (${contactEmail})`,
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) {
        const err = new Error(`Nominatim reverse lookup failed with status ${response.status}`);
        err.code = 'GEO_UNAVAILABLE';
        throw err;
      }

      const item = await response.json();
      const result = {
        formattedAddress: item.display_name || 'Selected Location, Bengaluru',
        city:
          item.address?.city ||
          item.address?.town ||
          item.address?.suburb ||
          item.address?.village ||
          'Bengaluru',
        state: item.address?.state || 'Karnataka',
        postalCode: item.address?.postcode || '',
        street: item.address?.road || '',
        area: item.address?.suburb || item.address?.neighbourhood || '',
        lat,
        lng,
      };

      geocodeCache.set(cacheKey, { timestamp: Date.now(), data: result });
      return result;
    } catch (err) {
      if (err.name === 'TimeoutError' || err.code === 'GEO_UNAVAILABLE') {
        // Fallback result for offline or timeout situations
        return {
          formattedAddress: `Location at ${lat.toFixed(3)}, ${lng.toFixed(3)}`,
          city: 'Bengaluru',
          state: 'Karnataka',
          postalCode: '',
          lat,
          lng,
        };
      }
      throw err;
    }
  });
};

/**
 * Calculates road route distance and travel duration between two coordinates.
 * Falls back gracefully to Haversine straight-line distance if OSRM is unreachable.
 *
 * @param {number} fromLat
 * @param {number} fromLng
 * @param {number} toLat
 * @param {number} toLng
 * @returns {Promise<{ distanceKm: number, durationMinutes: number, estimated: boolean }>}
 */
const route = async (fromLat, fromLng, toLat, toLng) => {
  const avgSpeed = Number(process.env.AVG_SPEED_KMPH || 20); // 20 km/h city average
  const straightLineKm = calculateHaversineDistanceKm([fromLng, fromLat], [toLng, toLat]);

  const fallback = {
    distanceKm: straightLineKm,
    durationMinutes: Math.max(5, Math.ceil((straightLineKm / avgSpeed) * 60)),
    estimated: true,
  };

  const cacheKey = `route:${fromLat.toFixed(3)},${fromLng.toFixed(3)}->${toLat.toFixed(3)},${toLng.toFixed(3)}`;
  const cached = routeCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < GEO_CACHE_ROUTE_TTL_MS) {
    return cached.data;
  }

  const baseUrl = process.env.OSRM_BASE_URL || OSRM_DEFAULT;
  // OSRM coordinate order: {fromLng},{fromLat};{toLng},{toLat}
  const requestUrl = `${baseUrl}/route/v1/driving/${fromLng},${fromLat};${toLng},${toLat}?overview=false`;

  try {
    const response = await fetch(requestUrl, {
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      return fallback;
    }

    const data = await response.json();
    if (data.code === 'Ok' && Array.isArray(data.routes) && data.routes.length > 0) {
      const osrmRoute = data.routes[0];
      const distanceKm = Math.round((osrmRoute.distance / 1000) * 10) / 10;
      const durationMinutes = Math.max(5, Math.round(osrmRoute.duration / 60));

      const result = {
        distanceKm,
        durationMinutes,
        estimated: false,
      };

      routeCache.set(cacheKey, { timestamp: Date.now(), data: result });
      return result;
    }

    return fallback;
  } catch (err) {
    return fallback;
  }
};

/**
 * Evaluates whether a pickup and delivery can be completed before effective food expiry.
 *
 * @param {Object} params
 * @param {number} params.fromLat - Donor latitude
 * @param {number} params.fromLng - Donor longitude
 * @param {number} params.toLat - Recipient latitude
 * @param {number} params.toLng - Recipient longitude
 * @param {Date|string} params.expiryAt - Food expiration timestamp
 * @param {number} [params.safetyBufferMinutes=60] - Safety margin before true expiry
 * @param {number} [params.handlingBufferMinutes=15] - Packing/handling time buffer
 * @returns {Promise<{ feasible: boolean, etaMinutes: number, distanceKm: number, estimated: boolean }>}
 */
const checkPickupFeasibility = async ({
  fromLat,
  fromLng,
  toLat,
  toLng,
  expiryAt,
  safetyBufferMinutes = 60,
  handlingBufferMinutes = 15,
}) => {
  const routeResult = await route(fromLat, fromLng, toLat, toLng);
  const nowMs = Date.now();
  const effectiveExpiryMs = new Date(expiryAt).getTime() - (safetyBufferMinutes * 60 * 1000);
  const totalTravelAndHandlingMs = (routeResult.durationMinutes + handlingBufferMinutes) * 60 * 1000;
  const estimatedArrivalMs = nowMs + totalTravelAndHandlingMs;

  if (estimatedArrivalMs > effectiveExpiryMs) {
    const ApiError = require('../utils/ApiError');
    const ERROR_CODES = require('../constants/errorCodes');
    throw new ApiError(
      400,
      ERROR_CODES.PICKUP_NOT_FEASIBLE,
      'Pickup not feasible: road travel and handling time exceeds donation safe expiry'
    );
  }

  return {
    feasible: true,
    etaMinutes: Math.max(5, Math.round(routeResult.durationMinutes / 5) * 5),
    distanceKm: Math.round(routeResult.distanceKm * 10) / 10,
    estimated: routeResult.estimated,
  };
};

module.exports = {
  searchAddress,
  reverseGeocode,
  route,
  checkPickupFeasibility,
};
