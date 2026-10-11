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
    priority: {
      type: String,
      enum: ['LOW', 'MEDIUM', 'HIGH'],
      default: 'MEDIUM',
      index: true,
    },
    priorityWeight: {
      type: Number,
      enum: [1, 2, 3],
      default: 2,
      index: true,
    },
    pickup: {
      location: { type: String, required: true },
      coordinates: { type: [Number], default: null }, // [longitude, latitude]
      donorName: { type: String, required: true },
      donorPhone: { type: String, default: '+91 98765 43210' },
      deadline: { type: Date, default: () => new Date(Date.now() + 2 * 60 * 60 * 1000) },
    },
    dropoff: {
      location: { type: String, required: true },
      coordinates: { type: [Number], default: null }, // [longitude, latitude]
      recipientName: { type: String, required: true },
      recipientPhone: { type: String, default: '+91 91234 56789' },
      deadline: { type: Date, default: () => new Date(Date.now() + 3 * 60 * 60 * 1000) },
    },
    batchId: {
      type: String,
      default: null,
      index: true,
    },
    weightKg: {
      type: Number,
      default: 0,
    },
    portions: {
      type: Number,
      default: 0,
    },
    currentMilestone: {
      type: String,
      enum: [
        'OPEN_FOR_PICKUP',
        'AVAILABLE',
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
    deliveryProvider: {
      type: String,
      enum: ['IN_HOUSE', 'PORTER'],
      default: 'IN_HOUSE',
    },
    payout: {
      type: Number,
      default: 95,
    },
    acceptanceId: {
      type: String,
      default: null,
      index: true,
    },
    payerMode: {
      type: String,
      enum: ['NONE', 'DONOR', 'RECIPIENT', 'SPLIT'],
      default: 'NONE',
      index: true,
    },
    deliveryFee: {
      type: Number,
      default: 0,
      min: 0,
    },
    feeVersion: {
      type: Number,
      default: 1,
    },
    feeLocked: {
      type: Boolean,
      default: false,
    },
    settled: {
      type: Boolean,
      default: false,
    },
    isVolunteer: {
      type: Boolean,
      default: true,
    },
    porterDetails: {
      orderId: { type: String, default: null },
      crn: { type: String, default: null },
      driverName: { type: String, default: null },
      driverPhone: { type: String, default: null },
      vehicleNumber: { type: String, default: null },
      vehicleType: { type: String, default: null },
      fare: { type: Number, default: null },
      trackingUrl: { type: String, default: null },
      status: { type: String, default: null },
      bookedAt: { type: Date, default: null },
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

DeliveryTaskSchema.pre('validate', function () {
  const { PRIORITY_WEIGHTS } = require('../constants/priority');
  if (this.priority) {
    this.priorityWeight = PRIORITY_WEIGHTS[this.priority] || 2;
  }
});

DeliveryTaskSchema.index({ currentMilestone: 1, createdAt: -1 });
DeliveryTaskSchema.index({ currentMilestone: 1, 'pickup.deadline': 1, priorityWeight: -1 });

const DeliveryTask = mongoose.model('DeliveryTask', DeliveryTaskSchema);

module.exports = DeliveryTask;

