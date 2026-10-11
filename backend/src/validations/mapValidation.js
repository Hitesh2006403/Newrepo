const { z } = require('zod');

const nearbyMapQuerySchema = z
  .object({
    lat: z.coerce.number().min(-90).max(90),
    lng: z.coerce.number().min(-180).max(180),
    radiusKm: z.coerce
      .number()
      .min(0.5, 'Radius must be at least 0.5 km')
      .max(10, 'Radius cannot exceed 10 km. Allowed presets: 5, 7, 10 km')
      .default(5),
    kind: z.enum(['all', 'donors', 'recipients', 'donations', 'requirements']).default('all'),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(200).default(50),
  })
  .strict();

module.exports = {
  nearbyMapQuerySchema,
};
