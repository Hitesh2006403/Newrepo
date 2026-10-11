const { z } = require('zod');
const { REQUIREMENT_STATUS } = require('../constants/status');
const { PRIORITY } = require('../constants/priority');

// GeoJSON Point schema
const locationSchema = z
  .object({
    type: z.literal('Point').default('Point'),
    coordinates: z.tuple([
      z.number().min(-180).max(180), // Longitude
      z.number().min(-90).max(90),   // Latitude
    ]),
  })
  .strict();

// Address schema
const addressSchema = z
  .object({
    street: z.string().trim().optional(),
    city: z.string().trim().min(1, 'City is required'),
    state: z.string().trim().optional(),
    postalCode: z.string().trim().optional(),
    formattedAddress: z.string().trim().min(1, 'Formatted address is required'),
  })
  .strict();

/**
 * Recipient Requirement Creation Schema.
 */
const createRequirementSchema = z
  .object({
    title: z.string().trim().min(3, 'Title must be at least 3 characters').max(100),
    foodType: z.enum(['cooked_meals', 'raw_groceries', 'packaged_food', 'bakery_items']),
    quantityNeeded: z.number().int().positive('Quantity must be greater than 0'),
    unit: z.enum(['plates', 'kg', 'packets', 'servings']),
    dietaryPreference: z.enum(['vegetarian', 'non_vegetarian', 'vegan', 'any']).default('any'),
    neededBy: z.coerce.date(),
    priority: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional(),
    urgency: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
    location: locationSchema,
    address: addressSchema,
  })
  .strict()
  .transform((data) => {
    let effPriority = data.priority;
    if (!effPriority) {
      if (data.urgency === 'CRITICAL') {
        effPriority = 'HIGH';
      } else if (data.urgency) {
        effPriority = data.urgency;
      } else {
        effPriority = 'MEDIUM';
      }
    }
    return {
      ...data,
      priority: effPriority,
      urgency: effPriority,
    };
  })
  .superRefine((data, ctx) => {
    const now = new Date();
    if (data.neededBy.getTime() <= now.getTime()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Deadline (neededBy) must be in the future',
        path: ['neededBy'],
      });
    }
  });

/**
 * Strict schema for PATCH /requirements/:id.
 * Only owner recipient or admin can update, only while OPEN.
 * Strict allowed fields: priority, urgency (alias), title, quantityNeeded, neededBy, dietaryPreference.
 */
const updateRequirementSchema = z
  .object({
    title: z.string().trim().min(3, 'Title must be at least 3 characters').max(100).optional(),
    quantityNeeded: z.number().int().positive('Quantity must be greater than 0').optional(),
    neededBy: z.coerce.date().optional(),
    dietaryPreference: z.enum(['vegetarian', 'non_vegetarian', 'vegan', 'any']).optional(),
    priority: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional(),
    urgency: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
  })
  .strict()
  .transform((data) => {
    let effPriority = data.priority;
    if (!effPriority && data.urgency) {
      effPriority = data.urgency === 'CRITICAL' ? 'HIGH' : data.urgency;
    }
    const result = { ...data };
    if (effPriority) {
      result.priority = effPriority;
      result.urgency = effPriority;
    }
    return result;
  })
  .superRefine((data, ctx) => {
    if (data.neededBy) {
      const now = new Date();
      if (data.neededBy.getTime() <= now.getTime()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Deadline (neededBy) must be in the future',
          path: ['neededBy'],
        });
      }
    }
  });

/**
 * Filter / Query Schema for requirements listing
 */
const filterRequirementSchema = z
  .object({
    status: z.enum(Object.values(REQUIREMENT_STATUS)).optional(),
    foodType: z.enum(['cooked_meals', 'raw_groceries', 'packaged_food', 'bakery_items']).optional(),
    urgency: z.string().optional(),
    priority: z.string().optional(),
    sort: z.string().optional(),
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(50).optional(),
  })
  .strict();

module.exports = {
  createRequirementSchema,
  updateRequirementSchema,
  filterRequirementSchema,
};

