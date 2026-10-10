const Donation = require('../models/Donation');
const User = require('../models/User');
const ApiResponse = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');
const ERROR_CODES = require('../constants/errorCodes');
const asyncHandler = require('../utils/asyncHandler');
const { DONATION_STATUS, ACCEPTANCE_STATUS } = require('../constants/status');
const { ROLES } = require('../constants/roles');
const {
  assertTransition,
  appendHistory,
  isExpired,
} = require('../services/donationStateService');
const { toDonationView } = require('../utils/donationView');

/**
 * POST /api/v1/donations
 * Creates a new surplus food donation post.
 * Access: Donor only.
 */
const createDonation = asyncHandler(async (req, res) => {
  const payload = req.body;

  const donation = new Donation({
    ...payload,
    donorId: req.user._id,
    remainingQuantity: payload.totalQuantity,
    status: DONATION_STATUS.AVAILABLE,
    acceptances: [],
    statusHistory: [
      {
        status: DONATION_STATUS.AVAILABLE,
        changedBy: req.user._id,
        note: 'Donation published by donor',
        timestamp: new Date(),
      },
    ],
  });

  await donation.save();
  await donation.populate('donorId', 'name ratingAverage ratingCount phone');

  return ApiResponse.send(
    res,
    201,
    'Donation created successfully',
    toDonationView(donation, req.user)
  );
});

/**
 * GET /api/v1/donations/my
 * Lists all donations posted by the authenticated donor.
 * Access: Donor only.
 */
const getMyDonations = asyncHandler(async (req, res) => {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 50);
  const skip = (page - 1) * limit;

  const filter = { donorId: req.user._id };
  if (req.query.status) {
    filter.status = req.query.status;
  }

  const [donations, total] = await Promise.all([
    Donation.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('donorId', 'name ratingAverage ratingCount phone'),
    Donation.countDocuments(filter),
  ]);

  const totalPages = Math.ceil(total / limit) || 1;
  const viewData = donations.map((d) => toDonationView(d, req.user));

  return ApiResponse.send(res, 200, 'My donations retrieved', viewData, {
    page,
    limit,
    total,
    totalPages,
  });
});

/**
 * GET /api/v1/donations/available
 * Lists available donations matching recipient criteria.
 * Filters strictly by active availability, positive balance, and dynamic effective expiry.
 * Access: Recipient (verified), Delivery Agent (verified), Admin.
 */
const getAvailableDonations = asyncHandler(async (req, res) => {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 50);
  const skip = (page - 1) * limit;

  const now = new Date();

  // Core availability criteria with per-donation dynamic safety buffer
  const filter = {
    status: {
      $in: [
        DONATION_STATUS.AVAILABLE,
        DONATION_STATUS.PARTIALLY_ACCEPTED,
        DONATION_STATUS.REOPENED,
      ],
    },
    remainingQuantity: { $gt: 0 },
    $expr: {
      $gt: [
        {
          $subtract: [
            '$expiryAt',
            { $multiply: [{ $ifNull: ['$safetyBufferMinutes', 60] }, 60000] },
          ],
        },
        now,
      ],
    },
  };

  if (req.query.foodType) {
    filter.foodType = req.query.foodType;
  }
  if (req.query.dietaryType) {
    filter.dietaryType = req.query.dietaryType;
  }

  // Geospatial proximity filtering if coordinates are provided
  let userCoordinates = null;
  if (req.query.lat && req.query.lng) {
    const lat = parseFloat(req.query.lat);
    const lng = parseFloat(req.query.lng);
    const maxDistanceKm = parseFloat(req.query.maxDistanceKm) || 25;
    userCoordinates = [lng, lat];

    filter.location = {
      $nearSphere: {
        $geometry: {
          type: 'Point',
          coordinates: userCoordinates,
        },
        $maxDistance: maxDistanceKm * 1000, // Convert km to meters
      },
    };
  }

  const countFilter = { ...filter };
  if (countFilter.location && countFilter.location.$nearSphere) {
    const coords = countFilter.location.$nearSphere.$geometry.coordinates;
    const maxMeters = countFilter.location.$nearSphere.$maxDistance;
    const rad = maxMeters / (6378.1 * 1000);
    countFilter.location = {
      $geoWithin: {
        $centerSphere: [coords, rad],
      },
    };
  }

  const [donations, total] = await Promise.all([
    Donation.find(filter)
      .skip(skip)
      .limit(limit)
      .populate('donorId', 'name ratingAverage ratingCount phone'),
    Donation.countDocuments(countFilter),
  ]);

  const totalPages = Math.ceil(total / limit) || 1;

  // Map donations to role-scoped privacy views (distance calculated securely inside toDonationView)
  const viewData = donations.map((d) => toDonationView(d, req.user, userCoordinates));

  return ApiResponse.send(res, 200, 'Available donations retrieved', viewData, {
    page,
    limit,
    total,
    totalPages,
  });
});

/**
 * GET /api/v1/donations
 * Administrative or filtered listing of all platform donations.
 */
const listDonations = asyncHandler(async (req, res) => {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 50);
  const skip = (page - 1) * limit;

  const filter = {};
  if (req.query.status) {
    filter.status = req.query.status;
  }
  if (req.query.foodType) {
    filter.foodType = req.query.foodType;
  }
  if (req.query.donorId) {
    filter.donorId = req.query.donorId;
  }

  const [donations, total] = await Promise.all([
    Donation.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('donorId', 'name ratingAverage ratingCount phone'),
    Donation.countDocuments(filter),
  ]);

  const totalPages = Math.ceil(total / limit) || 1;
  const viewData = donations.map((d) => toDonationView(d, req.user));

  return ApiResponse.send(res, 200, 'Donations retrieved', viewData, {
    page,
    limit,
    total,
    totalPages,
  });
});

/**
 * GET /api/v1/donations/:id
 * Retrieve a single donation by ID.
 * Enforces lazy expiry check and role-scoped privacy views.
 */
const getDonationById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const now = new Date();

  const prePickupStatuses = [
    DONATION_STATUS.AVAILABLE,
    DONATION_STATUS.PARTIALLY_ACCEPTED,
    DONATION_STATUS.REOPENED,
    DONATION_STATUS.ACCEPTED,
    DONATION_STATUS.PICKUP_SCHEDULED,
  ];

  // Atomic lazy expiry transition: if pre-pickup and effectiveExpiryAt <= now, update atomically in one operation
  let donation = await Donation.findOneAndUpdate(
    {
      _id: id,
      status: { $in: prePickupStatuses },
      $expr: {
        $lte: [
          {
            $subtract: [
              '$expiryAt',
              { $multiply: [{ $ifNull: ['$safetyBufferMinutes', 60] }, 60000] },
            ],
          },
          now,
        ],
      },
    },
    {
      $set: {
        status: DONATION_STATUS.EXPIRED,
        'acceptances.$[activeAcc].status': ACCEPTANCE_STATUS.CANCELLED,
        'acceptances.$[activeAcc].notes': 'expired',
      },
      $push: {
        statusHistory: {
          status: DONATION_STATUS.EXPIRED,
          changedBy: null,
          note: 'Expired: Safe consumption window exceeded',
          timestamp: now,
        },
      },
    },
    {
      arrayFilters: [
        {
          'activeAcc.status': {
            $in: [ACCEPTANCE_STATUS.CLAIMED, ACCEPTANCE_STATUS.PICKUP_SCHEDULED],
          },
        },
      ],
      returnDocument: 'after',
    }
  ).populate('donorId', 'name ratingAverage ratingCount phone');

  // If not expired via atomic update, fetch the existing donation
  if (!donation) {
    donation = await Donation.findById(id).populate(
      'donorId',
      'name ratingAverage ratingCount phone'
    );
  }

  if (!donation) {
    throw new ApiError(404, ERROR_CODES.NOT_FOUND, `Donation with ID '${id}' not found`);
  }

  return ApiResponse.send(
    res,
    200,
    'Donation retrieved',
    toDonationView(donation, req.user)
  );
});

/**
 * PATCH /api/v1/donations/:id
 * Updates mutable fields of an unaccepted donation.
 * Allowed strictly when status === AVAILABLE and acceptances.length === 0.
 * Single atomic conditional update preventing race conditions.
 * Access: Owner Donor only.
 */
const updateDonation = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  // Build whitelist of mutable fields
  const updateFields = {};
  if (updates.foodName) updateFields.foodName = updates.foodName;
  if (updates.packagingType) updateFields.packagingType = updates.packagingType;
  if (updates.instructions !== undefined) updateFields.instructions = updates.instructions;
  if (updates.pickupWindowEnd) updateFields.pickupWindowEnd = updates.pickupWindowEnd;
  if (updates.photos) updateFields.photos = updates.photos;

  const atomicFilter = {
    _id: id,
    status: DONATION_STATUS.AVAILABLE,
    'acceptances.0': { $exists: false },
  };

  if (req.user.role !== ROLES.ADMIN) {
    atomicFilter.donorId = req.user._id;
  }

  const updatedDonation = await Donation.findOneAndUpdate(
    atomicFilter,
    { $set: updateFields },
    { returnDocument: 'after', runValidators: true }
  ).populate('donorId', 'name ratingAverage ratingCount phone');

  if (!updatedDonation) {
    // Condition failed or not found or not owner
    const existing = await Donation.findById(id);
    if (!existing) {
      throw new ApiError(404, ERROR_CODES.NOT_FOUND, `Donation with ID '${id}' not found`);
    }
    if (req.user.role !== ROLES.ADMIN && existing.donorId.toString() !== req.user._id.toString()) {
      throw new ApiError(403, ERROR_CODES.FORBIDDEN, 'You do not have permission to edit this donation');
    }
    // Condition on status or acceptances failed
    throw new ApiError(
      409,
      ERROR_CODES.INVALID_STATUS_TRANSITION,
      'Cannot edit donation once claimed or after leaving AVAILABLE status. Please cancel and recreate if changes are required.'
    );
  }

  return ApiResponse.send(
    res,
    200,
    'Donation updated successfully',
    toDonationView(updatedDonation, req.user)
  );
});

/**
 * POST /api/v1/donations/:id/cancel
 * Cancels a donation before pickup occurs.
 * Single atomic conditional update setting status CANCELLED, cancelling active acceptances,
 * and pushing audit history in one operation.
 * Access: Owner Donor or Admin.
 */
const cancelDonation = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { reason = 'Cancelled by donor' } = req.body;
  const now = new Date();

  const cancelFilter = {
    _id: id,
    status: {
      $in: [
        DONATION_STATUS.AVAILABLE,
        DONATION_STATUS.PARTIALLY_ACCEPTED,
        DONATION_STATUS.REOPENED,
      ],
    },
  };

  if (req.user.role !== ROLES.ADMIN) {
    cancelFilter.donorId = req.user._id;
  }

  const updatedDonation = await Donation.findOneAndUpdate(
    cancelFilter,
    {
      $set: {
        status: DONATION_STATUS.CANCELLED,
        'acceptances.$[activeAcc].status': ACCEPTANCE_STATUS.CANCELLED,
        'acceptances.$[activeAcc].notes': 'Donation cancelled by donor',
      },
      $push: {
        statusHistory: {
          status: DONATION_STATUS.CANCELLED,
          changedBy: req.user._id,
          note: `Donation cancelled: ${reason}`,
          timestamp: now,
        },
      },
    },
    {
      arrayFilters: [
        {
          'activeAcc.status': {
            $in: [ACCEPTANCE_STATUS.CLAIMED, ACCEPTANCE_STATUS.PICKUP_SCHEDULED],
          },
        },
      ],
      returnDocument: 'after',
    }
  ).populate('donorId', 'name ratingAverage ratingCount phone');

  if (!updatedDonation) {
    const existing = await Donation.findById(id);
    if (!existing) {
      throw new ApiError(404, ERROR_CODES.NOT_FOUND, `Donation with ID '${id}' not found`);
    }
    if (req.user.role !== ROLES.ADMIN && existing.donorId.toString() !== req.user._id.toString()) {
      throw new ApiError(403, ERROR_CODES.FORBIDDEN, 'You do not have permission to cancel this donation');
    }
    throw new ApiError(
      409,
      ERROR_CODES.INVALID_STATUS_TRANSITION,
      `Cannot cancel donation in status '${existing.status}'. Only AVAILABLE or PARTIALLY_ACCEPTED donations can be cancelled.`
    );
  }

  return ApiResponse.send(
    res,
    200,
    'Donation cancelled successfully',
    toDonationView(updatedDonation, req.user)
  );
});

/**
 * GET /api/v1/donations/:id/status-history
 * Retrieves full audit history of status transitions.
 * Access: Owner Donor, Admin, or an attached Recipient/Agent.
 */
const getStatusHistory = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const donation = await Donation.findById(id).populate(
    'statusHistory.changedBy',
    'name role'
  );

  if (!donation) {
    throw new ApiError(404, ERROR_CODES.NOT_FOUND, `Donation with ID '${id}' not found`);
  }

  const isOwner = donation.donorId.toString() === req.user._id.toString();
  const isAdmin = req.user.role === ROLES.ADMIN;
  const isAttached =
    donation.acceptances &&
    donation.acceptances.some(
      (a) =>
        a.recipientId.toString() === req.user._id.toString() ||
        (a.deliveryAgentId && a.deliveryAgentId.toString() === req.user._id.toString())
    );

  if (!isOwner && !isAdmin && !isAttached) {
    throw new ApiError(
      403,
      ERROR_CODES.FORBIDDEN,
      'You are not authorized to view the audit history for this donation'
    );
  }

  return ApiResponse.send(
    res,
    200,
    'Status history retrieved',
    donation.statusHistory
  );
});

module.exports = {
  createDonation,
  getMyDonations,
  getAvailableDonations,
  listDonations,
  getDonationById,
  updateDonation,
  cancelDonation,
  getStatusHistory,
};
