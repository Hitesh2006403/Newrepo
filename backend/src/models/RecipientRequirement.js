const mongoose = require('mongoose');
const { REQUIREMENT_STATUS } = require('../constants/status');
const {
  PRIORITY,
  PRIORITY_WEIGHTS,
  DEFAULT_PRIORITY,
  mapUrgencyToPriority,
} = require('../constants/priority');

const RecipientRequirementSchema = new mongoose.Schema(
  {
    recipientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Recipient ID is required'],
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Requirement title is required'],
      trim: true,
      minlength: [3, 'Title must be at least 3 characters'],
      maxlength: [100, 'Title cannot exceed 100 characters'],
    },
    foodType: {
      type: String,
      required: [true, 'Food type is required'],
      enum: {
        values: ['cooked_meals', 'raw_groceries', 'packaged_food', 'bakery_items'],
        message: 'Invalid food type category',
      },
    },
    quantityNeeded: {
      type: Number,
      required: [true, 'Quantity needed is required'],
      min: [1, 'Quantity needed must be at least 1'],
    },
    unit: {
      type: String,
      required: [true, 'Unit of measurement is required'],
      enum: {
        values: ['plates', 'kg', 'packets', 'servings'],
        message: 'Invalid unit of measurement',
      },
    },
    dietaryPreference: {
      type: String,
      enum: ['vegetarian', 'non_vegetarian', 'vegan', 'any'],
      default: 'any',
    },
    neededBy: {
      type: Date,
      required: [true, 'Needed by deadline is required'],
    },
    priority: {
      type: String,
      enum: {
        values: Object.values(PRIORITY),
        message: 'Invalid priority level',
      },
      default: DEFAULT_PRIORITY,
      index: true,
    },
    priorityWeight: {
      type: Number,
      enum: [1, 2, 3],
      default: 2,
      index: true,
    },
    urgency: {
      type: String,
      enum: {
        values: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
        message: 'Invalid urgency level',
      },
      default: 'MEDIUM',
    },
    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
        required: true,
      },
      coordinates: {
        type: [Number],
        required: [true, 'Coordinates [longitude, latitude] are required'],
      },
    },
    address: {
      street: { type: String, trim: true },
      city: { type: String, required: [true, 'City is required'], trim: true },
      state: { type: String, trim: true },
      postalCode: { type: String, trim: true },
      formattedAddress: {
        type: String,
        required: [true, 'Formatted address is required'],
        trim: true,
      },
    },
    quantityFulfilled: {
      type: Number,
      default: 0,
      min: 0,
    },
    receivedDonationIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Donation',
      },
    ],
    status: {
      type: String,
      enum: {
        values: Object.values(REQUIREMENT_STATUS),
        message: 'Invalid requirement status',
      },
      default: REQUIREMENT_STATUS.OPEN,
      required: true,
    },
    approxLocation: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
      },
      coordinates: {
        type: [Number], // [roundedLongitude, roundedLatitude]
        default: [0, 0],
      },
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

const { computeApproxLocation } = require('../utils/geoUtils');

// Synchronize priority, priorityWeight, legacy urgency alias, and approxLocation
RecipientRequirementSchema.pre('validate', function () {
  if (this.priority) {
    this.priorityWeight = PRIORITY_WEIGHTS[this.priority] || 2;
    this.urgency = this.priority;
  } else if (this.urgency) {
    this.priority = mapUrgencyToPriority(this.urgency);
    this.priorityWeight = PRIORITY_WEIGHTS[this.priority] || 2;
    this.urgency = this.priority;
  } else {
    this.priority = DEFAULT_PRIORITY;
    this.priorityWeight = 2;
    this.urgency = DEFAULT_PRIORITY;
  }

  if (this.location && this.location.coordinates) {
    const approx = computeApproxLocation(this.location);
    if (approx) {
      this.approxLocation = approx;
    }
  }
});

RecipientRequirementSchema.index({ location: '2dsphere' });
RecipientRequirementSchema.index({ approxLocation: '2dsphere' });
RecipientRequirementSchema.index({ status: 1, neededBy: 1 });
RecipientRequirementSchema.index({ priorityWeight: -1, neededBy: 1 });
RecipientRequirementSchema.index({ status: 1, priorityWeight: -1, neededBy: 1 });

const RecipientRequirement = mongoose.model(
  'RecipientRequirement',
  RecipientRequirementSchema
);

module.exports = RecipientRequirement;
