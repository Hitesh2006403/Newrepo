/**
 * ==============================================================================
 * OWNED BY MEMBER 3 - stub created by Member 2 so Donation.js can import it
 * ==============================================================================
 * Subdocument schema representing a discrete claim/acceptance slice of a donation.
 */

const mongoose = require('mongoose');
const { ACCEPTANCE_STATUS } = require('../constants/status');

const AcceptanceSchema = new mongoose.Schema(
  {
    recipientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Recipient ID is required'],
    },
    requirementId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'RecipientRequirement',
      default: null,
    },
    quantity: {
      type: Number,
      required: [true, 'Claimed quantity is required'],
      min: [1, 'Claimed quantity must be at least 1'],
    },
    status: {
      type: String,
      enum: {
        values: Object.values(ACCEPTANCE_STATUS),
        message: 'Invalid acceptance status',
      },
      default: ACCEPTANCE_STATUS.CLAIMED,
      required: true,
    },
    pickupPreference: {
      type: String,
      enum: ['self_pickup', 'delivery_agent_required'],
      default: 'self_pickup',
    },
    deliveryAgentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    claimedAt: {
      type: Date,
      default: Date.now,
    },
    handoverVerifiedAt: {
      type: Date,
      default: null,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    notes: {
      type: String,
      default: null,
    },
    prioritySnapshot: {
      type: String,
      enum: ['LOW', 'MEDIUM', 'HIGH'],
      default: 'MEDIUM',
    },
    deliveryFee: {
      payerMode: {
        type: String,
        enum: ['NONE', 'DONOR', 'RECIPIENT', 'SPLIT'],
        default: 'NONE',
      },
      amount: {
        type: Number,
        default: 0,
        min: 0,
      },
      splitRatio: {
        donor: { type: Number, default: 50 },
        recipient: { type: Number, default: 50 },
      },
      currency: {
        type: String,
        default: 'INR',
      },
      suggestedAmount: {
        type: Number,
        default: 0,
      },
      proposedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null,
      },
      status: {
        type: String,
        enum: ['PROPOSED', 'AGREED', 'DECLINED', 'VOIDED'],
        default: 'AGREED',
      },
      feeVersion: {
        type: Number,
        default: 1,
      },
      proposals: [
        {
          partyRole: { type: String, enum: ['donor', 'recipient', 'admin'] },
          partyId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
          payerMode: { type: String, enum: ['NONE', 'DONOR', 'RECIPIENT', 'SPLIT'] },
          amount: { type: Number, default: 0 },
          proposedAt: { type: Date, default: Date.now },
        },
      ],
      settled: {
        agentMarked: { type: Boolean, default: false },
        agentSettledAt: { type: Date, default: null },
        payerMarked: { type: Boolean, default: false },
        payerSettledAt: { type: Date, default: null },
        note: { type: String, default: null },
      },
      auditNote: {
        type: String,
        default: null,
      },
    },
  },
  {
    _id: true,
    timestamps: true,
  }
);

// Enforce rule: NONE forces amount 0 and status AGREED
AcceptanceSchema.pre('validate', function () {
  if (this.deliveryFee) {
    if (this.deliveryFee.payerMode === 'NONE') {
      this.deliveryFee.amount = 0;
      if (this.deliveryFee.status !== 'VOIDED') {
        this.deliveryFee.status = 'AGREED';
      }
    }
  }
});

module.exports = AcceptanceSchema;
