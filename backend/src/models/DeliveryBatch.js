const mongoose = require('mongoose');
const { VEHICLE_TYPES, BATCH_STATUS } = require('../constants/batch');

const BatchStopSchema = new mongoose.Schema(
  {
    stopNumber: {
      type: Number,
      required: true,
    },
    type: {
      type: String,
      enum: ['PICKUP', 'DROPOFF'],
      required: true,
    },
    taskId: {
      type: String,
      required: true,
      index: true,
    },
    donationId: {
      type: String,
      default: null,
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      default: [0, 0],
    },
    formattedAddress: {
      type: String,
      required: true,
    },
    contactName: {
      type: String,
      default: 'Contact Person',
    },
    contactPhone: {
      type: String,
      default: '+91 98765 43210',
    },
    deadline: {
      type: Date,
      required: true,
    },
    quantity: {
      type: String,
      default: '0',
    },
    foodName: {
      type: String,
      default: 'Food Package',
    },
    estimatedMinutesFromPrev: {
      type: Number,
      default: 0,
    },
    cumulativeEtaMinutes: {
      type: Number,
      default: 0,
    },
    effectiveExpiryAt: {
      type: Date,
      default: null,
    },
    feasible: {
      type: Boolean,
      default: true,
    },
    status: {
      type: String,
      enum: ['PENDING', 'ARRIVED', 'COMPLETED'],
      default: 'PENDING',
    },
  },
  { _id: true }
);

const DeliveryBatchSchema = new mongoose.Schema(
  {
    batchNumber: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    deliveryAgentId: {
      type: String,
      default: null,
      index: true,
    },
    deliveryAgentName: {
      type: String,
      default: null,
    },
    vehicleType: {
      type: String,
      enum: Object.values(VEHICLE_TYPES),
      default: '2_WHEELER',
      index: true,
    },
    status: {
      type: String,
      enum: Object.values(BATCH_STATUS),
      default: 'PROPOSED',
      index: true,
    },
    taskIds: [
      {
        type: String,
        required: true,
      },
    ],
    stops: [BatchStopSchema],
    metrics: {
      totalDistanceKm: { type: Number, default: 0 },
      totalEstimatedMinutes: { type: Number, default: 0 },
      totalPlates: { type: Number, default: 0 },
      totalKg: { type: Number, default: 0 },
      capacityUtilizationPct: { type: Number, default: 0 },
      totalPayout: { type: Number, default: 0 },
      totalDeliveryFee: { type: Number, default: 0 },
      taskCount: { type: Number, default: 0 },
    },
    claimedAt: {
      type: Date,
      default: null,
    },
    completedAt: {
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

DeliveryBatchSchema.index({ status: 1, createdAt: -1 });
DeliveryBatchSchema.index({ deliveryAgentId: 1, status: 1 });

const DeliveryBatch = mongoose.model('DeliveryBatch', DeliveryBatchSchema);

module.exports = DeliveryBatch;
