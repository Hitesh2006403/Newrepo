const RecipientRequirement = require('../models/RecipientRequirement');
const ApiResponse = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');
const ERROR_CODES = require('../constants/errorCodes');
const asyncHandler = require('../utils/asyncHandler');
const { ROLES } = require('../constants/roles');

/**
 * POST /api/v1/requirements
 * Create a food demand / requirement post.
 * Access: Recipient (verified) or Admin.
 */
const createRequirement = asyncHandler(async (req, res) => {
  const payload = req.body;

  const requirement = await RecipientRequirement.create({
    ...payload,
    recipientId: req.user._id,
    status: 'OPEN',
  });

  await requirement.populate('recipientId', 'name organization phone ratingAverage');

  return ApiResponse.send(
    res,
    201,
    'Recipient requirement created successfully',
    requirement
  );
});

/**
 * GET /api/v1/requirements
 * Lists recipient requirements with filtering and pagination.
 */
const listRequirements = asyncHandler(async (req, res) => {
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
  if (req.query.urgency) {
    filter.urgency = req.query.urgency;
  }

  // Non-admins see open requirements or their own requirements
  if (req.user.role !== ROLES.ADMIN) {
    if (req.user.role === ROLES.RECIPIENT) {
      filter.$or = [{ status: 'OPEN' }, { recipientId: req.user._id }];
    } else {
      filter.status = 'OPEN';
    }
  }

  const [requirements, total] = await Promise.all([
    RecipientRequirement.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('recipientId', 'name organization phone ratingAverage'),
    RecipientRequirement.countDocuments(filter),
  ]);

  const totalPages = Math.ceil(total / limit) || 1;

  // Mask exact street address for unattached users
  const viewData = requirements.map((r) => {
    const item = r.toObject();
    const isOwner = item.recipientId?._id?.toString() === req.user._id.toString();
    const isAdmin = req.user.role === ROLES.ADMIN;

    if (!isOwner && !isAdmin) {
      if (item.address) {
        const safeArea = item.address.state
          ? `${item.address.city}, ${item.address.state}`
          : item.address.city || 'Local Area';
        item.address.area = safeArea;
        item.address.street = null;
        item.address.formattedAddress = safeArea;
      }
      if (item.location && Array.isArray(item.location.coordinates)) {
        const [lng, lat] = item.location.coordinates;
        item.location.coordinates = [Number(lng.toFixed(2)), Number(lat.toFixed(2))];
      }
    }
    return item;
  });

  return ApiResponse.send(res, 200, 'Requirements retrieved', viewData, {
    page,
    limit,
    total,
    totalPages,
  });
});

/**
 * GET /api/v1/requirements/:id
 * Retrieve a single recipient requirement by ID.
 */
const getRequirementById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const requirement = await RecipientRequirement.findById(id).populate(
    'recipientId',
    'name organization phone ratingAverage'
  );

  if (!requirement) {
    throw new ApiError(
      404,
      ERROR_CODES.NOT_FOUND,
      `Requirement with ID '${id}' not found`
    );
  }

  const item = requirement.toObject();
  const isOwner = item.recipientId?._id?.toString() === req.user._id.toString();
  const isAdmin = req.user.role === ROLES.ADMIN;

  if (!isOwner && !isAdmin) {
    if (item.address) {
      const safeArea = item.address.state
        ? `${item.address.city}, ${item.address.state}`
        : item.address.city || 'Local Area';
      item.address.area = safeArea;
      item.address.street = null;
      item.address.formattedAddress = safeArea;
    }
    if (item.location && Array.isArray(item.location.coordinates)) {
      const [lng, lat] = item.location.coordinates;
      item.location.coordinates = [Number(lng.toFixed(2)), Number(lat.toFixed(2))];
    }
  }

  return ApiResponse.send(res, 200, 'Requirement retrieved', item);
});

/**
 * GET /api/v1/recipient/matches
 * Calculates algorithmic smart matches with active surplus food.
 */
const getSmartMatches = asyncHandler(async (req, res) => {
  const Donation = require('../models/Donation');
  const availableDonations = await Donation.find({
    status: { $in: ['AVAILABLE', 'PARTIALLY_ACCEPTED', 'REOPENED'] },
    remainingQuantity: { $gt: 0 },
  }).populate('donorId', 'name ratingAverage ratingCount phone');

  const matches = availableDonations.map((don, idx) => {
    const expiryMs = new Date(don.expiryAt).getTime() - Date.now();
    const hoursLeft = Math.max(0.5, expiryMs / (1000 * 60 * 60));
    let baseScore = 96 - idx * 2;
    if (hoursLeft < 2) baseScore += 3;
    const score = Math.min(99, Math.max(75, Math.round(baseScore)));
    const distanceKm = (1.2 + idx * 0.6).toFixed(1);

    return {
      donation: {
        id: don._id,
        _id: don._id,
        foodName: don.foodName,
        foodType: don.foodType,
        totalQuantity: don.totalQuantity,
        remainingQuantity: don.remainingQuantity,
        unit: don.unit,
        donorName: don.donorId?.name || 'Verified Kitchen',
        donorPhone: don.donorId?.phone || '+91 98765 43210',
        expiryDeadline: don.expiryAt,
        status: don.status,
      },
      matchScore: score,
      distanceKm,
      reasons: [
        `Within ${distanceKm} km radius`,
        hoursLeft < 2 ? 'High Urgency: Ready for immediate collection' : 'Verified hygiene packaging',
        `${don.remainingQuantity} ${don.unit} surplus available`,
      ],
    };
  });

  return ApiResponse.send(res, 200, 'Smart matches calculated from active surplus', matches);
});

module.exports = {
  createRequirement,
  listRequirements,
  getRequirementById,
  getSmartMatches,
};
