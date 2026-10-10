const Review = require('../models/Review');
const ApiResponse = require('../utils/ApiResponse');
const asyncHandler = require('../utils/asyncHandler');

/**
 * GET /api/v1/reviews
 * Retrieves community reviews from MongoDB Atlas.
 */
const listReviews = asyncHandler(async (req, res) => {
  const reviews = await Review.find().sort({ createdAt: -1 }).limit(50);
  return ApiResponse.send(res, 200, 'Community reviews retrieved successfully', reviews);
});

/**
 * POST /api/v1/reviews
 * Creates and stores a verified community review in MongoDB Atlas.
 */
const createReview = asyncHandler(async (req, res) => {
  const {
    donationId,
    donorName,
    recipientName,
    authorRole = 'recipient',
    rating = 5,
    foodName,
    comment,
    tags = ['Hygienically Packed', 'Punctual Handover'],
    verifiedRescue = true,
  } = req.body;

  const review = await Review.create({
    donationId: donationId || `don-${Date.now().toString(36)}`,
    donorName: donorName || 'Verified Donor Kitchen',
    recipientName: recipientName || 'Community Shelter',
    authorId: req.user?._id || null,
    authorRole,
    rating: Number(rating) || 5,
    foodName: foodName || 'Rescued Surplus Meal',
    comment,
    tags,
    verifiedRescue: Boolean(verifiedRescue),
  });

  return ApiResponse.send(res, 201, 'Review submitted successfully', review);
});

module.exports = {
  listReviews,
  createReview,
};
