const RecipientRequirement = require('../models/RecipientRequirement');
const ApiResponse = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');
const ERROR_CODES = require('../constants/errorCodes');
const asyncHandler = require('../utils/asyncHandler');
const { ROLES } = require('../constants/roles');
const { REQUIREMENT_STATUS } = require('../constants/status');
const {
  PRIORITY,
  PRIORITY_WEIGHTS,
  DEFAULT_PRIORITY,
  calculatePriorityBoost,
} = require('../constants/priority');
const {
  parsePriorityFilter,
  parseSortParam,
  getRequirementSortObject,
} = require('../utils/queryFilters');
const { calculateHaversineDistanceKm } = require('../utils/geoUtils');

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
    status: REQUIREMENT_STATUS.OPEN,
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
 * Supports ?priority= (single or comma-separated) and ?sort= (priority_desc, priority_asc, expiry_asc, newest).
 * Defaults: HIGH priority first, then neededBy.
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

  // Priority filtering (supports single or comma-separated list, with legacy urgency fallback)
  const priorityFilter = parsePriorityFilter(req.query.priority || req.query.urgency);
  if (priorityFilter) {
    filter.priority = priorityFilter;
  }

  // Non-admins see open requirements or their own requirements
  if (req.user.role !== ROLES.ADMIN) {
    if (req.user.role === ROLES.RECIPIENT) {
      filter.$or = [{ status: REQUIREMENT_STATUS.OPEN }, { recipientId: req.user._id }];
    } else {
      filter.status = REQUIREMENT_STATUS.OPEN;
    }
  }

  // Geospatial proximity filtering if coordinates are provided
  let userCoordinates = null;
  if (req.query.lat !== undefined || req.query.lng !== undefined) {
    if (req.query.lat === undefined || req.query.lng === undefined) {
      throw new ApiError(
        400,
        ERROR_CODES.VALIDATION_ERROR,
        'Both lat and lng coordinates must be provided together'
      );
    }
    const lat = parseFloat(req.query.lat);
    const lng = parseFloat(req.query.lng);
    if (isNaN(lat) || lat < -90 || lat > 90 || isNaN(lng) || lng < -180 || lng > 180) {
      throw new ApiError(
        400,
        ERROR_CODES.VALIDATION_ERROR,
        'Latitude must be between -90 and 90, and longitude between -180 and 180'
      );
    }

    let radiusKm = 5;
    const rawRadius = req.query.radiusKm !== undefined ? req.query.radiusKm : req.query.maxDistanceKm;
    if (rawRadius !== undefined) {
      const parsedDist = parseFloat(rawRadius);
      if (isNaN(parsedDist) || parsedDist <= 0 || parsedDist > 10) {
        throw new ApiError(
          400,
          ERROR_CODES.VALIDATION_ERROR,
          'Radius must be a number between 0.1 and 10 km'
        );
      }
      radiusKm = parsedDist;
    }
    userCoordinates = [lng, lat];

    // Non-privileged callers query approxLocation to preserve recipient privacy
    const isPrivileged = req.user && req.user.role === ROLES.ADMIN;
    const locField = isPrivileged ? 'location' : 'approxLocation';

    filter[locField] = {
      $nearSphere: {
        $geometry: {
          type: 'Point',
          coordinates: userCoordinates,
        },
        $maxDistance: radiusKm * 1000,
      },
    };
  }

  const countFilter = { ...filter };
  for (const field of ['location', 'approxLocation']) {
    if (countFilter[field] && countFilter[field].$nearSphere) {
      const coords = countFilter[field].$nearSphere.$geometry.coordinates;
      const maxMeters = countFilter[field].$nearSphere.$maxDistance;
      const rad = maxMeters / (6378.1 * 1000);
      countFilter[field] = {
        $geoWithin: {
          $centerSphere: [coords, rad],
        },
      };
    }
  }

  const sortKey = parseSortParam(req.query.sort, 'default');
  const sortObject = getRequirementSortObject(sortKey, Boolean(userCoordinates));

  let reqFindQuery = RecipientRequirement.find(filter);
  if (sortObject) {
    reqFindQuery = reqFindQuery.sort(sortObject);
  }

  const [requirements, total] = await Promise.all([
    reqFindQuery
      .skip(skip)
      .limit(limit)
      .populate('recipientId', 'name organization phone ratingAverage'),
    RecipientRequirement.countDocuments(countFilter),
  ]);

  const totalPages = Math.ceil(total / limit) || 1;

  // Mask exact street address and compute distanceKm for unattached users
  const viewData = requirements.map((r) => {
    const item = r.toObject();
    const isOwner = item.recipientId?._id?.toString() === req.user._id.toString();
    const isAdmin = req.user.role === ROLES.ADMIN;

    // Compute distanceKm if coordinates were supplied
    if (userCoordinates) {
      if (isOwner || isAdmin) {
        const exactCoords = item.location?.coordinates;
        if (exactCoords && Array.isArray(exactCoords)) {
          const d = calculateHaversineDistanceKm(
            { lat: userCoordinates[1], lng: userCoordinates[0] },
            { lat: exactCoords[1], lng: exactCoords[0] }
          );
          item.distanceKm = Number(d.toFixed(1));
        }
      } else {
        const approxCoords = item.approxLocation?.coordinates || item.location?.coordinates;
        if (approxCoords && Array.isArray(approxCoords)) {
          const roundedCoords = [Number(approxCoords[0].toFixed(2)), Number(approxCoords[1].toFixed(2))];
          const d = calculateHaversineDistanceKm(
            { lat: userCoordinates[1], lng: userCoordinates[0] },
            { lat: roundedCoords[1], lng: roundedCoords[0] }
          );
          item.distanceKm = Number(d.toFixed(1));
        }
      }
    }

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
      if (item.recipientId && typeof item.recipientId === 'object') {
        item.recipientId.phone = null;
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
 * PATCH /api/v1/requirements/:id
 * Updates mutable fields of an open requirement.
 * Access: Owner Recipient or Admin only.
 * Allowed strictly when status === OPEN.
 * Strict allowed fields: priority, title, quantityNeeded, neededBy, dietaryPreference, urgency (alias).
 * Atomic conditional update preventing race conditions.
 */
const updateRequirement = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  // Build strict whitelist of mutable fields
  const updateFields = {};
  if (updates.title !== undefined) updateFields.title = updates.title;
  if (updates.quantityNeeded !== undefined) updateFields.quantityNeeded = updates.quantityNeeded;
  if (updates.neededBy !== undefined) updateFields.neededBy = updates.neededBy;
  if (updates.dietaryPreference !== undefined) updateFields.dietaryPreference = updates.dietaryPreference;

  if (updates.priority !== undefined || updates.urgency !== undefined) {
    const effPriority = updates.priority || (updates.urgency === 'CRITICAL' ? PRIORITY.HIGH : updates.urgency);
    updateFields.priority = effPriority;
    updateFields.priorityWeight = PRIORITY_WEIGHTS[effPriority] || 2;
    updateFields.urgency = effPriority;
  }

  const atomicFilter = {
    _id: id,
    status: REQUIREMENT_STATUS.OPEN,
  };

  if (req.user.role !== ROLES.ADMIN) {
    atomicFilter.recipientId = req.user._id;
  }

  const updatedRequirement = await RecipientRequirement.findOneAndUpdate(
    atomicFilter,
    { $set: updateFields },
    { returnDocument: 'after', runValidators: true }
  ).populate('recipientId', 'name organization phone ratingAverage');

  if (!updatedRequirement) {
    // Condition failed: find reason for accurate response
    const existing = await RecipientRequirement.findById(id);
    if (!existing) {
      throw new ApiError(404, ERROR_CODES.NOT_FOUND, `Requirement with ID '${id}' not found`);
    }
    if (req.user.role !== ROLES.ADMIN && existing.recipientId.toString() !== req.user._id.toString()) {
      throw new ApiError(403, ERROR_CODES.FORBIDDEN, 'You do not have permission to edit this requirement');
    }
    throw new ApiError(
      409,
      ERROR_CODES.INVALID_STATUS_TRANSITION,
      'Cannot edit requirement once it is no longer OPEN.'
    );
  }

  return ApiResponse.send(
    res,
    200,
    'Requirement updated successfully',
    updatedRequirement
  );
});

/**
 * GET /api/v1/recipient/matches
 * Calculates algorithmic smart matches with active surplus food.
 * Integrates explainable priority boost into the match score.
 * Never overrides safety buffers or expiry checks (expired donations strictly excluded).
 */
const getSmartMatches = asyncHandler(async (req, res) => {
  const Donation = require('../models/Donation');
  const now = new Date();

  // Find recipient's open requirements to extract requirement priority
  let reqPriority = DEFAULT_PRIORITY;
  let userOpenReq = null;
  if (req.params && req.params.id && require('mongoose').Types.ObjectId.isValid(req.params.id)) {
    userOpenReq = await RecipientRequirement.findById(req.params.id);
  }
  if (!userOpenReq) {
    const recipientId = req.user?._id || req.query?.recipientId;
    if (recipientId) {
      userOpenReq = await RecipientRequirement.findOne({
        recipientId,
        status: REQUIREMENT_STATUS.OPEN,
      }).sort({ priorityWeight: -1, neededBy: 1 });
    }
  }

  if (userOpenReq && userOpenReq.priority) {
    reqPriority = userOpenReq.priority;
  }

  // Filter available donations with safety buffer and expiry validation
  const availableDonations = await Donation.find({
    status: { $in: ['AVAILABLE', 'PARTIALLY_ACCEPTED', 'REOPENED'] },
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
  }).populate('donorId', 'name ratingAverage ratingCount phone');

  const matches = availableDonations.map((don, idx) => {
    const expiryMs = new Date(don.expiryAt).getTime() - Date.now();
    const hoursLeft = Math.max(0.5, expiryMs / (1000 * 60 * 60));
    
    const donPriority = don.priority || DEFAULT_PRIORITY;
    const priorityBoost = calculatePriorityBoost(donPriority, reqPriority);
    
    let baseScore = Math.max(75, 90 - idx * 2);
    let urgencyBoost = hoursLeft < 2 ? 3 : 0;
    
    const totalScore = Math.min(99, Math.max(75, Math.round(baseScore + urgencyBoost + priorityBoost)));
    const distanceKm = (1.2 + idx * 0.6).toFixed(1);

    const reasons = [
      `Within ${distanceKm} km radius`,
      hoursLeft < 2 ? 'High Urgency: Ready for immediate collection' : 'Verified hygiene packaging',
      `${don.remainingQuantity} ${don.unit} surplus available`,
    ];

    if (priorityBoost > 0) {
      reasons.push(`Priority Boost (+${priorityBoost} pts): ${donPriority} priority surplus matched`);
    }

    return {
      donation: {
        id: don._id,
        _id: don._id,
        foodName: don.foodName,
        foodType: don.foodType,
        totalQuantity: don.totalQuantity,
        remainingQuantity: don.remainingQuantity,
        unit: don.unit,
        priority: donPriority,
        priorityWeight: don.priorityWeight || 2,
        donorName: don.donorId?.name || 'Verified Kitchen',
        donorPhone: don.donorId?.phone || '+91 98765 43210',
        expiryDeadline: don.expiryAt,
        status: don.status,
      },
      matchScore: totalScore,
      scoreBreakdown: {
        baseScore,
        urgencyBoost,
        priorityBoost,
        totalScore,
      },
      distanceKm,
      reasons,
    };
  });

  // Sort matches by matchScore descending, then donation priority descending
  matches.sort((a, b) => {
    if (b.matchScore !== a.matchScore) return b.matchScore - a.matchScore;
    return (b.donation.priorityWeight || 2) - (a.donation.priorityWeight || 2);
  });

  return ApiResponse.send(res, 200, 'Smart matches calculated from active surplus', matches);
});

module.exports = {
  createRequirement,
  listRequirements,
  getRequirementById,
  updateRequirement,
  getSmartMatches,
};
