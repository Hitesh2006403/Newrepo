const { z } = require('zod');

const geoSearchSchema = z
  .object({
    q: z.string().trim().min(3, 'Search query must be at least 3 characters').max(120, 'Query cannot exceed 120 characters'),
  })
  .strict();

const geoReverseSchema = z
  .object({
    lat: z.coerce.number().min(-90, 'Latitude must be >= -90').max(90, 'Latitude must be <= 90'),
    lng: z.coerce.number().min(-180, 'Longitude must be >= -180').max(180, 'Longitude must be <= 180'),
  })
  .strict();

const geoRouteSchema = z
  .object({
    fromLat: z.coerce.number().min(-90).max(90),
    fromLng: z.coerce.number().min(-180).max(180),
    toLat: z.coerce.number().min(-90).max(90),
    toLng: z.coerce.number().min(-180).max(180),
  })
  .strict();

module.exports = {
  geoSearchSchema,
  geoReverseSchema,
  geoRouteSchema,
};
