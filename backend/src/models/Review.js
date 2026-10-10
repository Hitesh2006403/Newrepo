const mongoose = require('mongoose');

const ReviewSchema = new mongoose.Schema(
  {
    donationId: {
      type: String,
      trim: true,
      index: true,
    },
    donorName: {
      type: String,
      required: [true, 'Donor name is required'],
      trim: true,
    },
    recipientName: {
      type: String,
      required: [true, 'Recipient name is required'],
      trim: true,
    },
    authorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    authorRole: {
      type: String,
      enum: ['donor', 'recipient', 'delivery_agent', 'delivery', 'admin'],
      default: 'recipient',
    },
    rating: {
      type: Number,
      required: [true, 'Star rating is required'],
      min: [1, 'Minimum rating is 1'],
      max: [5, 'Maximum rating is 5'],
      default: 5,
    },
    foodName: {
      type: String,
      required: [true, 'Food item name is required'],
      trim: true,
    },
    comment: {
      type: String,
      required: [true, 'Review comment / feedback is required'],
      trim: true,
      maxlength: [1000, 'Comment cannot exceed 1000 characters'],
    },
    tags: {
      type: [String],
      default: ['Hygienically Packed', 'Punctual Handover'],
    },
    verifiedRescue: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

ReviewSchema.index({ createdAt: -1 });

const Review = mongoose.model('Review', ReviewSchema);

module.exports = Review;
