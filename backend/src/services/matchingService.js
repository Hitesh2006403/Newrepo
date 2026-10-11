/**
 * Smart Matching Engine & Auto-Allotment Service for Share A Plate.
 * Phase 3 Architecture:
 * - Hard Filters first (never scored)
 * - 0-100 Score Normalized across 7 named components
 * - Ring-based (<=5km vs 5-10km) and Tier-based Candidate Sorting
 * - Time-limited Auto-Allotment Waves with suggestedQuantity & TTL
 * - Split-and-Divide (Donor) & Split-and-Accept (Recipient)
 * - Remainder Auto-Adjustment and Reject-then-Reopen Lifecycle
 */

const mongoose = require('mongoose');
const Donation = require('../models/Donation');
const RecipientRequirement = require('../models/RecipientRequirement');
const User = require('../models/User');
const DeliveryTask = require('../models/DeliveryTask');
const {
  MATCH_WEIGHTS,
  QUANTITY_TIERS,
  ALLOT_MODES,
  OFFER_STATUS,
  MATCH_CONFIG,
} = require('../constants/matching');
const {
  DONATION_STATUS,
  ACCEPTANCE_STATUS,
  REQUIREMENT_STATUS,
} = require('../constants/status');
const { calculateHaversineDistanceKm } = require('../utils/geoUtils');
const { emitEvent, domainEvents, DOMAIN_EVENT_NAMES } = require('./domainEvents');
const notificationService = require('./notificationService');
const ApiError = require('../utils/ApiError');
const ERROR_CODES = require('../constants/errorCodes');

/**
 * Evaluates hard filters. Returns true if candidate passes all eligibility gates.
 * Never scores candidates that fail any hard filter.
 */
const isCandidateEligible = (donation, requirement, recipientUser, distanceKm, maxRadiusKm = 10) => {
  const now = new Date();

  // 1. Donation expired or inside safety buffer
  const safetyBufferMs = (donation.safetyBufferMinutes || 60) * 60000;
  const effectiveExpiryAt = new Date(new Date(donation.expiryAt).getTime() - safetyBufferMs);
  if (now >= effectiveExpiryAt) return false;

  // 2. Requirement expired or neededBy in the past
  if (requirement.neededBy && new Date(requirement.neededBy) < now) return false;

  // 3. Inactive, unverified, or hidden users
  if (!recipientUser || !recipientUser.isVerified || recipientUser.isDeactivated || recipientUser.mapVisible === false) {
    return false;
  }

  // 4. Donor cannot match with themselves
  const donorId = donation.donorId?._id?.toString() || donation.donorId?.toString();
  const recipientId = recipientUser._id?.toString();
  if (donorId && recipientId && donorId === recipientId) return false;

  // 5. Requirement status must be OPEN or PARTIALLY_FULFILLED
  if (![REQUIREMENT_STATUS.OPEN, REQUIREMENT_STATUS.PARTIALLY_FULFILLED].includes(requirement.status)) {
    return false;
  }

  // 6. Remaining need must be positive
  const totalReqQuantity = requirement.quantityNeeded || requirement.quantity || 0;
  const needed = totalReqQuantity - (requirement.quantityFulfilled || 0);
  if (needed <= 0) return false;

  // 7. Recipient who already declined/rejected this donation is excluded
  if (donation.rejectedByRecipients && Array.isArray(donation.rejectedByRecipients)) {
    const hasRejected = donation.rejectedByRecipients.some(
      (rId) => (rId?._id?.toString() || rId?.toString()) === recipientId
    );
    if (hasRejected) return false;
  }

  // 8. Outside radius
  if (distanceKm > maxRadiusKm) return false;

  // 9. Dietary compatibility
  const reqDiet = (requirement.dietaryPreference || requirement.dietaryType || '').toLowerCase().replace('-', '_');
  const donDiet = (donation.dietaryType || '').toLowerCase().replace('-', '_');
  if (reqDiet && donDiet && reqDiet !== 'any') {
    if (reqDiet === 'vegetarian' && donDiet === 'non_vegetarian') {
      return false;
    }
    if (reqDiet === 'vegan' && donDiet !== 'vegan') {
      return false;
    }
  }

  return true;
};

/**
 * Calculates a 0-100 match score with full per-component breakdown and tier assignment.
 * Computed strictly on the server.
 */
const calculateMatchScore = (donation, requirement, distanceKm, recipientUser) => {
  const now = new Date();
  const safetyBufferMs = (donation.safetyBufferMinutes || 60) * 60000;
  const effectiveExpiryAt = new Date(new Date(donation.expiryAt).getTime() - safetyBufferMs);
  const msToExpiry = Math.max(0, effectiveExpiryAt.getTime() - now.getTime());
  const hoursLeft = Math.max(0.1, msToExpiry / 3600000);

  // 1. Urgency Component (max: MATCH_WEIGHTS.URGENCY = 20)
  let timePoints = 3;
  if (hoursLeft <= 2) timePoints = 12;
  else if (hoursLeft <= 6) timePoints = 9;
  else if (hoursLeft <= 12) timePoints = 6;

  const donPriority = donation.priority || 'MEDIUM';
  let donPriorityPoints = 5;
  if (donPriority === 'HIGH') donPriorityPoints = 8;
  else if (donPriority === 'LOW') donPriorityPoints = 2;

  const urgencyPoints = Math.min(MATCH_WEIGHTS.URGENCY, timePoints + donPriorityPoints);
  const urgencyReason = `${hoursLeft.toFixed(1)}h remaining before safety buffer (${donPriority} priority surplus)`;

  // 2. Requirement Priority Component (max: MATCH_WEIGHTS.REQUIREMENT_PRIORITY = 15)
  const reqPriority = requirement.priority || 'MEDIUM';
  let reqPriorityPoints = 10;
  if (reqPriority === 'HIGH') reqPriorityPoints = 15;
  else if (reqPriority === 'LOW') reqPriorityPoints = 5;

  const reqPriorityReason = `${reqPriority} priority recipient requirement`;

  // 3. Distance Component (max: MATCH_WEIGHTS.DISTANCE = 20)
  const distRatio = Math.max(0, 1 - distanceKm / 10);
  const distancePoints = Math.min(MATCH_WEIGHTS.DISTANCE, Math.round(MATCH_WEIGHTS.DISTANCE * distRatio));
  const distanceReason = `${distanceKm.toFixed(1)} km approximate road/proximity distance`;

  // 4. Quantity Fit Component (max: MATCH_WEIGHTS.QUANTITY_FIT = 20) & Tier assignment
  const totalReqQuantity = requirement.quantityNeeded || requirement.quantity || 0;
  const needed = Math.max(0, totalReqQuantity - (requirement.quantityFulfilled || 0));
  const remaining = donation.remainingQuantity;
  const tolerancePercent = MATCH_CONFIG.QUANTITY_TOLERANCE_PERCENT;
  const toleranceRatio = tolerancePercent / 100;

  let quantityFitPoints = 10;
  let tier = QUANTITY_TIERS.TIER_4_PARTIAL;
  let quantityReason = '';

  if (needed === remaining) {
    tier = QUANTITY_TIERS.TIER_1_EXACT;
    quantityFitPoints = 20;
    quantityReason = `Exact match: ${needed} ${donation.unit} needed equals available surplus`;
  } else if (Math.abs(needed - remaining) / remaining <= toleranceRatio) {
    tier = QUANTITY_TIERS.TIER_2_APPROX;
    quantityFitPoints = 17;
    quantityReason = `Approximate match: within ${tolerancePercent}% tolerance (${needed} needed vs ${remaining} ${donation.unit} available)`;
  } else if (needed < remaining) {
    tier = QUANTITY_TIERS.TIER_3_SPLIT;
    quantityFitPoints = 14;
    quantityReason = `Surplus covers entire need (${needed} of ${remaining} ${donation.unit}); remainder available to split`;
  } else {
    tier = QUANTITY_TIERS.TIER_4_PARTIAL;
    quantityFitPoints = 10;
    quantityReason = `Partial fulfillment: provides ${remaining} of ${needed} ${donation.unit} needed`;
  }

  // 5. Dietary & Food Type Match (max: MATCH_WEIGHTS.DIETARY_FOOD_TYPE = 10)
  let foodTypePoints = 5;
  if (requirement.foodType && donation.foodType && requirement.foodType !== donation.foodType) {
    foodTypePoints = 2;
  }
  let dietaryPoints = 5;
  const reqDiet = (requirement.dietaryPreference || requirement.dietaryType || '').toLowerCase();
  const donDiet = (donation.dietaryType || '').toLowerCase();
  if (reqDiet && donDiet && reqDiet !== 'any' && reqDiet !== donDiet) {
    dietaryPoints = 3;
  }
  const dietaryFoodTypePoints = Math.min(MATCH_WEIGHTS.DIETARY_FOOD_TYPE, foodTypePoints + dietaryPoints);
  const dietaryReason = `${donation.foodType || 'General'} / ${donation.dietaryType || 'Standard'} matched with requirement`;

  // 6. Pickup Availability Component (max: MATCH_WEIGHTS.PICKUP_AVAILABILITY = 10)
  let windowPoints = 7;
  if (requirement.neededBy && donation.pickupWindowStart) {
    if (new Date(requirement.neededBy) < new Date(donation.pickupWindowStart)) {
      windowPoints = 3;
    }
  }
  const pickupAvailabilityPoints = Math.min(MATCH_WEIGHTS.PICKUP_AVAILABILITY, windowPoints + 3);
  const pickupReason = 'Pickup window compatible with recipient schedule';

  // 7. Recipient Reliability Component (max: MATCH_WEIGHTS.RELIABILITY = 5)
  const ratingAvg = recipientUser?.ratingAverage || 5;
  const ratingPts = Math.min(4, Math.round((ratingAvg / 5) * 4));
  const priorDeclines = donation.rejectedByRecipients?.length || 0;
  const declineDeduction = Math.min(2, priorDeclines * 0.5);
  const reliabilityPoints = Math.max(1, Math.min(MATCH_WEIGHTS.RELIABILITY, ratingPts + 1 - declineDeduction));
  const reliabilityReason = `Reliability score (${ratingAvg.toFixed(1)} avg rating)`;

  // Total Score (0-100)
  const totalScore = Math.min(
    100,
    Math.max(
      0,
      urgencyPoints +
        reqPriorityPoints +
        distancePoints +
        quantityFitPoints +
        dietaryFoodTypePoints +
        pickupAvailabilityPoints +
        reliabilityPoints
    )
  );

  const breakdown = {
    urgency: { points: urgencyPoints, max: MATCH_WEIGHTS.URGENCY, reason: urgencyReason },
    requirementPriority: { points: reqPriorityPoints, max: MATCH_WEIGHTS.REQUIREMENT_PRIORITY, reason: reqPriorityReason },
    distance: { points: distancePoints, max: MATCH_WEIGHTS.DISTANCE, reason: distanceReason },
    quantityFit: { points: quantityFitPoints, max: MATCH_WEIGHTS.QUANTITY_FIT, reason: quantityReason },
    dietaryFoodType: { points: dietaryFoodTypePoints, max: MATCH_WEIGHTS.DIETARY_FOOD_TYPE, reason: dietaryReason },
    pickupAvailability: { points: pickupAvailabilityPoints, max: MATCH_WEIGHTS.PICKUP_AVAILABILITY, reason: pickupReason },
    reliability: { points: reliabilityPoints, max: MATCH_WEIGHTS.RELIABILITY, reason: reliabilityReason },
  };

  const reasons = [
    urgencyReason,
    reqPriorityReason,
    distanceReason,
    quantityReason,
    dietaryReason,
  ];

  return {
    matchScore: totalScore,
    tier,
    breakdown,
    reasons,
  };
};

/**
 * Resolves distance between two documents using approxLocation or exact coordinates.
 */
const resolveDistanceKm = (itemA, itemB) => {
  const coordsA = itemA?.approxLocation?.coordinates || itemA?.location?.coordinates;
  const coordsB = itemB?.approxLocation?.coordinates || itemB?.location?.coordinates;
  if (!coordsA || !coordsB) return 1.0;
  return calculateHaversineDistanceKm(coordsA, coordsB);
};

/**
 * Ring and Tier candidate sorting comparator:
 * 1. Distance ring first: Ring 1 (<= 5 km) before Ring 2 (> 5 km)
 * 2. Within ring, quantity-fit tier: Tier 1 exact < Tier 2 approx < Tier 3 split < Tier 4 partial
 * 3. Priority HIGH requirements considered first inside same tier
 * 4. Nearest distance first
 * 5. Highest total score
 */
const candidateComparator = (a, b) => {
  if (a.ring !== b.ring) return a.ring - b.ring;
  if (a.tier !== b.tier) return a.tier - b.tier;

  const pWeightA = a.requirement.priorityWeight || (a.requirement.priority === 'HIGH' ? 3 : a.requirement.priority === 'LOW' ? 1 : 2);
  const pWeightB = b.requirement.priorityWeight || (b.requirement.priority === 'HIGH' ? 3 : b.requirement.priority === 'LOW' ? 1 : 2);
  if (pWeightB !== pWeightA) return pWeightB - pWeightA;

  if (a.distanceKm !== b.distanceKm) return a.distanceKm - b.distanceKm;
  return b.matchScore - a.matchScore;
};

/**
 * GET /api/v1/matches/recommendations for a Donation (Donor or Admin viewer).
 */
const getRecommendationsForDonation = async (donationId, options = {}) => {
  const donation = await Donation.findById(donationId).populate('donorId', 'name ratingAverage ratingCount phone');
  if (!donation) {
    throw new ApiError(404, ERROR_CODES.NOT_FOUND, 'Donation not found');
  }

  const requestedRadius = Math.min(Math.max(Number(options.radiusKm) || MATCH_CONFIG.DEFAULT_RADIUS_KM, 1), MATCH_CONFIG.MAX_RADIUS_KM);
  let effectiveRadius = requestedRadius;
  let expandedRadius = false;

  const now = new Date();
  const reqQuery = {
    status: { $in: [REQUIREMENT_STATUS.OPEN, REQUIREMENT_STATUS.PARTIALLY_FULFILLED] },
    neededBy: { $gt: now },
  };
  if (options.priority) {
    reqQuery.priority = options.priority;
  }

  const allReqs = await RecipientRequirement.find(reqQuery).populate('recipientId', 'name isVerified isDeactivated mapVisible ratingAverage ratingCount address');

  // Evaluate candidate eligibility and compute scores
  const evaluateCandidates = (maxRad) => {
    const list = [];
    for (const reqDoc of allReqs) {
      const recipientUser = reqDoc.recipientId;
      const distKm = resolveDistanceKm(donation, reqDoc);
      if (!isCandidateEligible(donation, reqDoc, recipientUser, distKm, maxRad)) {
        continue;
      }
      const scoreObj = calculateMatchScore(donation, reqDoc, distKm, recipientUser);
      const ring = distKm <= 5 ? 1 : 2;

      list.push({
        requirement: reqDoc,
        recipientUser,
        distanceKm: distKm,
        ring,
        tier: scoreObj.tier,
        matchScore: scoreObj.matchScore,
        breakdown: scoreObj.breakdown,
        reasons: scoreObj.reasons,
      });
    }
    return list;
  };

  let candidates = evaluateCandidates(effectiveRadius);

  // If none inside 5 km, auto-widen once to 10 km
  if (candidates.length === 0 && effectiveRadius <= 5) {
    effectiveRadius = 10;
    expandedRadius = true;
    candidates = evaluateCandidates(effectiveRadius);
  }

  candidates.sort(candidateComparator);

  const page = Math.max(1, Number(options.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(options.limit) || 10));
  const total = candidates.length;
  const paginated = candidates.slice((page - 1) * limit, page * limit);

  return {
    donation: {
      _id: donation._id,
      foodName: donation.foodName,
      remainingQuantity: donation.remainingQuantity,
      unit: donation.unit,
      priority: donation.priority,
      allotMode: donation.allotMode,
      allotWave: donation.allotWave,
    },
    expandedRadius,
    radiusKm: effectiveRadius,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit) || 1,
    recommendations: paginated.map((c) => {
      const totNeeded = c.requirement.quantityNeeded || c.requirement.quantity || 0;
      return {
        requirementId: c.requirement._id,
        recipientName: c.recipientUser?.name || 'Verified Organization',
        recipientId: c.recipientUser?._id,
        quantityNeeded: Math.max(0, totNeeded - (c.requirement.quantityFulfilled || 0)),
        totalNeeded: totNeeded,
        unit: c.requirement.unit,
        priority: c.requirement.priority,
        distanceKm: c.distanceKm,
        ring: c.ring,
        tier: c.tier,
        matchScore: c.matchScore,
        breakdown: c.breakdown,
        reasons: c.reasons,
      };
    }),
  };
};

/**
 * GET /api/v1/matches/recommendations for a Requirement (Recipient or Admin viewer).
 */
const getRecommendationsForRequirement = async (requirementId, options = {}) => {
  const requirement = await RecipientRequirement.findById(requirementId).populate('recipientId', 'name isVerified isDeactivated mapVisible ratingAverage ratingCount');
  if (!requirement) {
    throw new ApiError(404, ERROR_CODES.NOT_FOUND, 'Requirement not found');
  }

  const requestedRadius = Math.min(Math.max(Number(options.radiusKm) || MATCH_CONFIG.DEFAULT_RADIUS_KM, 1), MATCH_CONFIG.MAX_RADIUS_KM);
  let effectiveRadius = requestedRadius;
  let expandedRadius = false;

  const now = new Date();
  const donQuery = {
    status: { $in: [DONATION_STATUS.AVAILABLE, DONATION_STATUS.PARTIALLY_ACCEPTED, DONATION_STATUS.REOPENED] },
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
  if (options.priority) {
    donQuery.priority = options.priority;
  }

  const allDonations = await Donation.find(donQuery).populate('donorId', 'name ratingAverage ratingCount phone location approxLocation');

  const evaluateCandidates = (maxRad) => {
    const list = [];
    for (const donDoc of allDonations) {
      const distKm = resolveDistanceKm(donDoc, requirement);
      if (!isCandidateEligible(donDoc, requirement, requirement.recipientId, distKm, maxRad)) {
        continue;
      }
      const scoreObj = calculateMatchScore(donDoc, requirement, distKm, requirement.recipientId);
      list.push({
        donation: donDoc,
        distanceKm: distKm,
        tier: scoreObj.tier,
        matchScore: scoreObj.matchScore,
        breakdown: scoreObj.breakdown,
        reasons: scoreObj.reasons,
      });
    }
    return list;
  };

  let candidates = evaluateCandidates(effectiveRadius);

  if (candidates.length === 0 && effectiveRadius <= 5) {
    effectiveRadius = 10;
    expandedRadius = true;
    candidates = evaluateCandidates(effectiveRadius);
  }

  // Recipient recommendations sort by matchScore descending, then donation priority descending
  candidates.sort((a, b) => {
    if (b.matchScore !== a.matchScore) return b.matchScore - a.matchScore;
    const pWeightA = a.donation.priorityWeight || 2;
    const pWeightB = b.donation.priorityWeight || 2;
    if (pWeightB !== pWeightA) return pWeightB - pWeightA;
    return a.distanceKm - b.distanceKm;
  });

  const page = Math.max(1, Number(options.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(options.limit) || 10));
  const total = candidates.length;
  const paginated = candidates.slice((page - 1) * limit, page * limit);

  return {
    requirement: {
      _id: requirement._id,
      quantityNeeded: Math.max(0, (requirement.quantityNeeded || requirement.quantity || 0) - (requirement.quantityFulfilled || 0)),
      unit: requirement.unit,
      priority: requirement.priority,
      status: requirement.status,
    },
    expandedRadius,
    radiusKm: effectiveRadius,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit) || 1,
    recommendations: paginated.map((c) => ({
      donationId: c.donation._id,
      foodName: c.donation.foodName,
      foodType: c.donation.foodType,
      dietaryType: c.donation.dietaryType,
      remainingQuantity: c.donation.remainingQuantity,
      unit: c.donation.unit,
      priority: c.donation.priority,
      donorName: c.donation.donorId?.name || 'Verified Kitchen',
      distanceKm: c.distanceKm,
      tier: c.tier,
      matchScore: c.matchScore,
      breakdown: c.breakdown,
      reasons: c.reasons,
    })),
  };
};

/**
 * Calculates a multi-recipient split plan for a donor's surplus.
 * Proposes allocation across top candidates (capped at SPLIT_MAX_PARTS = 4, MIN_PORTION_QUANTITY = 5).
 */
const calculateSplitPlan = async (donationId, maxParts = 4) => {
  const donation = await Donation.findById(donationId).populate('donorId', 'name ratingAverage ratingCount');
  if (!donation) {
    throw new ApiError(404, ERROR_CODES.NOT_FOUND, 'Donation not found');
  }

  const remaining = donation.remainingQuantity;
  const minPortion = MATCH_CONFIG.MIN_PORTION_QUANTITY;

  if (remaining < minPortion) {
    throw new ApiError(400, ERROR_CODES.SPLIT_NOT_ALLOWED, `Surplus quantity (${remaining}) is below minimum split portion (${minPortion})`);
  }

  const cappedParts = Math.min(Math.max(2, Number(maxParts) || 4), MATCH_CONFIG.SPLIT_MAX_PARTS);
  const recs = await getRecommendationsForDonation(donationId, { radiusKm: 10, limit: 20 });
  const candidates = recs.recommendations;

  if (candidates.length === 0) {
    return {
      donationId: donation._id,
      totalSurplus: remaining,
      parts: [],
      totalAllocated: 0,
      unallocated: remaining,
      message: 'No eligible candidate recipients found within radar',
    };
  }

  let surplusPool = remaining;
  const parts = [];

  // Pass 1: Greedy allocation up to cappedParts
  for (const cand of candidates) {
    if (parts.length >= cappedParts || surplusPool < minPortion) break;
    const need = cand.quantityNeeded;
    const alloc = Math.min(surplusPool, Math.max(minPortion, Math.min(need, surplusPool)));

    if (alloc >= minPortion) {
      parts.push({
        recipientId: cand.recipientId,
        recipientName: cand.recipientName,
        requirementId: cand.requirementId,
        allocatedQuantity: alloc,
        distanceKm: cand.distanceKm,
        matchScore: cand.matchScore,
        tier: cand.tier,
      });
      surplusPool -= alloc;
    }
  }

  // Pass 2: Leftover redistribution across selected candidates if surplusPool > 0
  if (surplusPool > 0 && parts.length > 0) {
    for (const part of parts) {
      if (surplusPool <= 0) break;
      const originalCand = candidates.find((c) => c.requirementId.toString() === part.requirementId.toString());
      if (originalCand) {
        const stillNeeded = originalCand.quantityNeeded - part.allocatedQuantity;
        if (stillNeeded > 0) {
          const extra = Math.min(surplusPool, stillNeeded);
          part.allocatedQuantity += extra;
          surplusPool -= extra;
        }
      }
    }
  }

  const totalAllocated = remaining - surplusPool;

  return {
    donationId: donation._id,
    totalSurplus: remaining,
    parts,
    totalAllocated,
    unallocated: surplusPool,
  };
};

/**
 * Confirms a split plan and creates time-limited offers (idempotent).
 */
const confirmSplitPlan = async (donationId, parts, donorUser) => {
  const donation = await Donation.findById(donationId);
  if (!donation) {
    throw new ApiError(404, ERROR_CODES.NOT_FOUND, 'Donation not found');
  }

  if (donation.donorId.toString() !== donorUser._id.toString() && donorUser.role !== 'admin') {
    throw new ApiError(403, ERROR_CODES.FORBIDDEN, 'Only donation owner or admin can confirm split plan');
  }

  if (!Array.isArray(parts) || parts.length === 0) {
    throw new ApiError(400, ERROR_CODES.VALIDATION_ERROR, 'Parts list must not be empty');
  }

  const now = new Date();
  const safetyBufferMs = (donation.safetyBufferMinutes || 60) * 60000;
  const effectiveExpiryAt = new Date(new Date(donation.expiryAt).getTime() - safetyBufferMs);
  const ttlMs = Math.min(MATCH_CONFIG.OFFER_TTL_MINUTES * 60000, Math.max(60000, effectiveExpiryAt.getTime() - now.getTime() - 60000));
  const expiresAt = new Date(now.getTime() + ttlMs);

  const createdOffers = [];

  for (const part of parts) {
    const existingOffer = donation.offers.find(
      (o) =>
        o.recipientId.toString() === part.recipientId.toString() &&
        o.requirementId?.toString() === part.requirementId?.toString() &&
        o.status === OFFER_STATUS.PENDING
    );

    if (existingOffer) {
      existingOffer.suggestedQuantity = part.allocatedQuantity;
      existingOffer.expiresAt = expiresAt;
      createdOffers.push(existingOffer);
    } else {
      const newOffer = {
        recipientId: part.recipientId,
        requirementId: part.requirementId,
        suggestedQuantity: part.allocatedQuantity,
        wave: donation.allotWave || 1,
        status: OFFER_STATUS.PENDING,
        expiresAt,
        createdAt: now,
      };
      donation.offers.push(newOffer);
      createdOffers.push(newOffer);
    }

    // Notify recipient
    notificationService.sendNotification({
      userId: part.recipientId,
      type: 'SPLIT_OFFER',
      title: 'Targeted Food Share Offer',
      message: `A surplus portion of ${part.allocatedQuantity} ${donation.unit} of ${donation.foodName} has been offered to your requirement.`,
      metadata: { donationId: donation._id, requirementId: part.requirementId },
    }).catch(() => {});
  }

  await donation.save();

  return {
    donationId: donation._id,
    offersCreated: createdOffers.length,
    offers: createdOffers,
  };
};

/**
 * Sends a time-limited offer to the top candidate for a donation in AUTO mode.
 */
const processAutoAllotmentWave = async (donationId) => {
  const donation = await Donation.findById(donationId);
  if (!donation) return null;

  if (donation.allotMode !== ALLOT_MODES.AUTO) return null;
  if (![DONATION_STATUS.AVAILABLE, DONATION_STATUS.PARTIALLY_ACCEPTED, DONATION_STATUS.REOPENED].includes(donation.status)) {
    return null;
  }
  if (donation.remainingQuantity <= 0) return null;

  const now = new Date();

  // Check if there is an active PENDING offer that hasn't expired
  const activeOffer = donation.offers.find(
    (o) => o.status === OFFER_STATUS.PENDING && new Date(o.expiresAt) > now
  );
  if (activeOffer) {
    return activeOffer; // Currently awaiting recipient action
  }

  // Mark expired offers as EXPIRED
  let offersChanged = false;
  for (const o of donation.offers) {
    if (o.status === OFFER_STATUS.PENDING && new Date(o.expiresAt) <= now) {
      o.status = OFFER_STATUS.EXPIRED;
      offersChanged = true;
      emitEvent(DOMAIN_EVENT_NAMES.OFFER_EXPIRED, { donationId: donation._id, offerId: o._id });
    }
  }

  const recs = await getRecommendationsForDonation(donationId, { radiusKm: 10, limit: 10 });
  const candidates = recs.recommendations;

  // Filter out candidates that already have an offer or are holding an active claim
  const eligibleCandidates = candidates.filter((c) => {
    const hasOffer = donation.offers.some(
      (o) => o.recipientId.toString() === c.recipientId.toString() && [OFFER_STATUS.PENDING, OFFER_STATUS.ACCEPTED].includes(o.status)
    );
    const hasAcceptance = donation.acceptances.some(
      (a) => a.recipientId.toString() === c.recipientId.toString() && a.status === ACCEPTANCE_STATUS.CLAIMED
    );
    return !hasOffer && !hasAcceptance;
  });

  if (eligibleCandidates.length === 0) {
    if (offersChanged) await donation.save();
    return null;
  }

  const topCandidate = eligibleCandidates[0];
  const suggestedQty = Math.min(donation.remainingQuantity, topCandidate.quantityNeeded);

  donation.allotWave = (donation.allotWave || 1) + (offersChanged ? 1 : 0);

  const safetyBufferMs = (donation.safetyBufferMinutes || 60) * 60000;
  const effectiveExpiryAt = new Date(new Date(donation.expiryAt).getTime() - safetyBufferMs);
  const ttlMs = Math.min(MATCH_CONFIG.OFFER_TTL_MINUTES * 60000, Math.max(60000, effectiveExpiryAt.getTime() - now.getTime() - 60000));
  const expiresAt = new Date(now.getTime() + ttlMs);

  const newOffer = {
    recipientId: topCandidate.recipientId,
    requirementId: topCandidate.requirementId,
    suggestedQuantity: suggestedQty,
    wave: donation.allotWave,
    status: OFFER_STATUS.PENDING,
    expiresAt,
    createdAt: now,
  };

  donation.offers.push(newOffer);
  await donation.save();

  const createdOffer = donation.offers[donation.offers.length - 1];

  // Send auto-allotment notification
  notificationService.sendNotification({
    userId: topCandidate.recipientId,
    type: 'AUTO_ALLOT_OFFER',
    title: 'Surplus Best-Fit Offer Reserved for You',
    message: `You have received a best-fit offer for ${suggestedQty} ${donation.unit} of ${donation.foodName}. Confirm within ${MATCH_CONFIG.OFFER_TTL_MINUTES} minutes.`,
    metadata: { donationId: donation._id, offerId: createdOffer._id },
  }).catch(() => {});

  return createdOffer;
};

/**
 * Declines an offer, records recipient in rejectedByRecipients, and auto-advances wave if AUTO.
 */
const declineOffer = async (offerId, recipientUser, reason = 'Not needed at this time') => {
  const donation = await Donation.findOne({ 'offers._id': offerId });
  if (!donation) {
    throw new ApiError(404, ERROR_CODES.OFFER_NOT_FOUND, 'Offer not found');
  }

  const offer = donation.offers.id(offerId);
  if (!offer) {
    throw new ApiError(404, ERROR_CODES.OFFER_NOT_FOUND, 'Offer not found');
  }

  if (offer.recipientId.toString() !== recipientUser._id.toString() && recipientUser.role !== 'admin') {
    throw new ApiError(403, ERROR_CODES.FORBIDDEN, 'You can only decline offers addressed to your account');
  }

  if (offer.status !== OFFER_STATUS.PENDING) {
    throw new ApiError(400, ERROR_CODES.OFFER_ALREADY_RESOLVED, `Offer is already ${offer.status}`);
  }

  offer.status = OFFER_STATUS.DECLINED;
  offer.declineReason = reason;

  if (!donation.rejectedByRecipients) donation.rejectedByRecipients = [];
  if (!donation.rejectedByRecipients.some((id) => id.toString() === recipientUser._id.toString())) {
    donation.rejectedByRecipients.push(recipientUser._id);
  }

  await donation.save();

  // If in AUTO mode, advance to next wave
  let nextOffer = null;
  if (donation.allotMode === ALLOT_MODES.AUTO) {
    donation.allotWave = (donation.allotWave || 1) + 1;
    await donation.save();
    nextOffer = await processAutoAllotmentWave(donation._id);
  }

  return {
    success: true,
    message: 'Offer declined successfully',
    declinedOffer: offer,
    nextOffer,
  };
};

/**
 * Rejects an acceptance before pickup, restores quantity, and triggers rematch/reopen.
 */
const rejectAcceptanceAndReopen = async (donationId, acceptanceId, user, reason) => {
  const donation = await Donation.findById(donationId);
  if (!donation) {
    throw new ApiError(404, ERROR_CODES.NOT_FOUND, 'Donation not found');
  }

  const acceptance = donation.acceptances.id(acceptanceId);
  if (!acceptance) {
    throw new ApiError(404, ERROR_CODES.NOT_FOUND, 'Acceptance record not found');
  }

  const donorId = donation.donorId.toString();
  const recipientId = acceptance.recipientId.toString();
  const callerId = user._id.toString();

  if (callerId !== donorId && callerId !== recipientId && user.role !== 'admin') {
    throw new ApiError(403, ERROR_CODES.FORBIDDEN, 'Only attached donor, recipient, or admin can reject an acceptance');
  }

  if ([ACCEPTANCE_STATUS.PICKED_UP, ACCEPTANCE_STATUS.HANDOVER_VERIFIED, ACCEPTANCE_STATUS.COMPLETED].includes(acceptance.status)) {
    throw new ApiError(400, ERROR_CODES.REJECTION_NOT_ALLOWED, `Cannot reject an acceptance after food is ${acceptance.status}`);
  }

  if (acceptance.status === ACCEPTANCE_STATUS.REJECTED) {
    throw new ApiError(409, ERROR_CODES.CONFLICT, 'Acceptance is already rejected');
  }

  const restoredQty = acceptance.quantity;
  acceptance.status = ACCEPTANCE_STATUS.REJECTED;
  acceptance.notes = `Rejected: ${reason}`;

  // Void delivery fee and release agent if fee was present
  if (acceptance.deliveryFee) {
    acceptance.deliveryFee.status = 'VOIDED';
  }

  const agentId = acceptance.deliveryAgentId;
  acceptance.deliveryAgentId = null;

  // Release DeliveryTask if exists
  await DeliveryTask.findOneAndUpdate(
    { acceptanceId, status: { $ne: 'DELIVERED' } },
    { status: 'CANCELLED', notes: `Task cancelled due to acceptance rejection: ${reason}` }
  );

  // Restore quantity to donation
  donation.remainingQuantity += restoredQty;
  const newDonStatus = donation.remainingQuantity === donation.totalQuantity ? DONATION_STATUS.REOPENED : DONATION_STATUS.PARTIALLY_ACCEPTED;
  donation.status = newDonStatus;

  donation.statusHistory.push({
    status: newDonStatus,
    changedBy: user._id,
    note: `Acceptance ${acceptanceId} rejected (${reason}); restored ${restoredQty} ${donation.unit}`,
    timestamp: new Date(),
  });

  // Track recipient in rejectedByRecipients to prevent immediate rematches
  if (!donation.rejectedByRecipients) donation.rejectedByRecipients = [];
  if (!donation.rejectedByRecipients.some((id) => id.toString() === recipientId)) {
    donation.rejectedByRecipients.push(recipientId);
  }

  await donation.save();

  // Rollback linked requirement if exists
  if (acceptance.requirementId) {
    const reqDoc = await RecipientRequirement.findById(acceptance.requirementId);
    if (reqDoc) {
      reqDoc.quantityFulfilled = Math.max(0, (reqDoc.quantityFulfilled || 0) - restoredQty);
      if (reqDoc.receivedDonationIds) {
        reqDoc.receivedDonationIds = reqDoc.receivedDonationIds.filter(
          (dId) => dId.toString() !== donation._id.toString()
        );
      }
      reqDoc.status = reqDoc.quantityFulfilled > 0 ? REQUIREMENT_STATUS.PARTIALLY_FULFILLED : REQUIREMENT_STATUS.OPEN;
      await reqDoc.save();
    }
  }

  // Emit domain event
  emitEvent(DOMAIN_EVENT_NAMES.ACCEPTANCE_REJECTED, {
    donationId: donation._id,
    acceptanceId,
    recipientId,
    restoredQuantity: restoredQty,
    releasedAgentId: agentId,
  });

  // If in AUTO mode, advance and allot remainder
  if (donation.allotMode === ALLOT_MODES.AUTO) {
    processAutoAllotmentWave(donation._id).catch(() => {});
  }

  return {
    donationId: donation._id,
    acceptanceId,
    status: acceptance.status,
    restoredQuantity: restoredQty,
    newDonationStatus: donation.status,
  };
};

/**
 * Suggests donations to fill the remaining gap of a partially fulfilled requirement.
 */
const suggestCompletionsForRequirement = async (requirementId) => {
  const requirement = await RecipientRequirement.findById(requirementId);
  if (!requirement) {
    throw new ApiError(404, ERROR_CODES.NOT_FOUND, 'Requirement not found');
  }

  const totalReqQuantity = requirement.quantityNeeded || requirement.quantity || 0;
  const remainingGap = Math.max(0, totalReqQuantity - (requirement.quantityFulfilled || 0));
  const recs = await getRecommendationsForRequirement(requirementId, { radiusKm: 10, limit: 10 });

  return {
    requirementId: requirement._id,
    totalQuantity: totalReqQuantity,
    quantityFulfilled: requirement.quantityFulfilled || 0,
    remainingGap,
    unit: requirement.unit,
    suggestedDonations: recs.recommendations,
  };
};

// Domain event listeners for auto-adjustments
domainEvents.on(DOMAIN_EVENT_NAMES.DONATION_REMAINDER_CHANGED, (payload) => {
  if (payload?.donationId) {
    Donation.findById(payload.donationId).then((donation) => {
      if (donation && donation.allotMode === ALLOT_MODES.AUTO && donation.remainingQuantity > 0) {
        processAutoAllotmentWave(donation._id).catch(() => {});
      }
    }).catch(() => {});
  }
});

domainEvents.on(DOMAIN_EVENT_NAMES.ACCEPTANCE_CANCELLED, (payload) => {
  if (payload?.donationId) {
    Donation.findById(payload.donationId).then((donation) => {
      if (donation && donation.allotMode === ALLOT_MODES.AUTO && donation.remainingQuantity > 0) {
        processAutoAllotmentWave(donation._id).catch(() => {});
      }
    }).catch(() => {});
  }
});

module.exports = {
  isCandidateEligible,
  calculateMatchScore,
  getRecommendationsForDonation,
  getRecommendationsForRequirement,
  calculateSplitPlan,
  confirmSplitPlan,
  processAutoAllotmentWave,
  declineOffer,
  rejectAcceptanceAndReopen,
  suggestCompletionsForRequirement,
};
