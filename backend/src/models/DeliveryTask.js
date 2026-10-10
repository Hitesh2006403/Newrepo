const mongoose = require('mongoose');

const DeliveryTaskSchema = new mongoose.Schema(
  {
    donationId: {
      type: String,
      required: true,
      index: true,
    },
    deliveryAgentId: {
      type: String,
      default: 'agent@delivery.com',
      index: true,
    },
    foodName: {
      type: String,
      required: true,
      trim: true,
    },
    quantity: {
      type: String,
      required: true,
    },
    foodType: {
      type: String,
      default: 'cooked_meals',
    },
    storageCondition: {
      type: String,
      default: 'heated',
    },
    urgencyLevel: {
      type: String,
      enum: ['NORMAL', 'HIGH', 'URGENT', 'CRITICAL'],
      default: 'HIGH',
    },
    pickup: {
      location: { type: String, required: true },
      donorName: { type: String, required: true },
      donorPhone: { type: String, default: '+91 98765 43210' },
      deadline: { type: Date, default: () => new Date(Date.now() + 2 * 60 * 60 * 1000) },
    },
    dropoff: {
      location: { type: String, required: true },
      recipientName: { type: String, required: true },
      recipientPhone: { type: String, default: '+91 91234 56789' },
      deadline: { type: Date, default: () => new Date(Date.now() + 3 * 60 * 60 * 1000) },
    },
    currentMilestone: {
      type: String,
      enum: [
        'ASSIGNED',
        'REACHED_DONOR',
        'EN_ROUTE_PICKUP',
        'PICKED_UP',
        'EN_ROUTE',
        'EN_ROUTE_DELIVERY',
        'REACHED_RECIPIENT',
        'DELIVERED',
        'CANCELLED',
      ],
      default: 'ASSIGNED',
    },
    distanceTotalKm: {
      type: Number,
      default: 3.5,
    },
    estimatedMinutes: {
      type: Number,
      default: 20,
    },
    qrRequiredToken: {
      type: String,
      default: null,
    },
    vehicleSuggestion: {
      type: String,
      default: 'Thermal insulated cargo container required',
    },
    safetyChecklistCompleted: {
      type: Boolean,
      default: false,
    },
    verifiedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

DeliveryTaskSchema.index({ currentMilestone: 1, createdAt: -1 });

const DeliveryTask = mongoose.model('DeliveryTask', DeliveryTaskSchema);

module.exports = DeliveryTask;
