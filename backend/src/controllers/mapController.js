const User = require('../models/User');
const Donation = require('../models/Donation');
const RecipientRequirement = require('../models/RecipientRequirement');
const DeliveryTask = require('../models/DeliveryTask');
const { ROLES } = require('../constants/roles');
const { DONATION_STATUS, REQUIREMENT_STATUS } = require('../constants/status');
const { toDonationView } = require('../utils/donationView');
const { calculateHaversineDistanceKm } = require('../utils/geoUtils');
const ApiResponse = require('../utils/ApiResponse');
const asyncHandler = require('../utils/asyncHandler');

/**
 * GET /api/v1/map/nearby
 * Returns all verified, active, mapVisible donors and recipients inside radius.
 * Supports role-based filtering, radius auto-expansion, and privacy-safe approxLocation.
 */
const getNearbyMapItems = asyncHandler(async (req, res) => {
  const viewer = req.user;
  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);
  let radiusKm = Number(req.query.radiusKm) || 5;
  const kind = req.query.kind || 'all';
  const page = parseInt(req.query.page, 10) || 1;
  const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);

  const EARTH_RADIUS_KM = 6378.1;
  let expandedRadius = false;

  // Helper to construct $geoWithin query on approxLocation
  const makeGeoFilter = (rKm) => ({
    $geoWithin: {
      $centerSphere: [[lng, lat], rKm / EARTH_RADIUS_KM],
    },
  });

  // Query function for candidates
  const executeQueries = async (targetRadius) => {
    const geoFilter = makeGeoFilter(targetRadius);
    const results = [];

    // 1. DONORS
    if (kind === 'all' || kind === 'donors') {
      const donors = await User.find({
        role: ROLES.DONOR,
        isVerified: true,
        isActive: true,
        mapVisible: { $ne: false },
        approxLocation: geoFilter,
      }).select('_id name organization address approxLocation ratingAverage');

      // Attach available donation counts
      for (const d of donors) {
        const availableCount = await Donation.countDocuments({
          donorId: d._id,
          status: { $in: [DONATION_STATUS.AVAILABLE, DONATION_STATUS.PARTIALLY_ACCEPTED, DONATION_STATUS.REOPENED] },
          remainingQuantity: { $gt: 0 },
        });

        const isOrg = Boolean(d.organization && d.organization.name);
        const displayName = isOrg ? d.organization.name : d.name.split(' ')[0];
        const distance = calculateHaversineDistanceKm([lng, lat], d.approxLocation.coordinates);

        results.push({
          id: d._id.toString(),
          type: 'donor',
          kind: 'donor',
          role: 'donor',
          name: displayName,
          areaLabel: d.address?.city || 'Bengaluru Area',
          approxLocation: d.approxLocation,
          distanceKm: distance,
          availableDonationCount: availableCount,
          ratingAverage: d.ratingAverage || 0,
        });
      }
    }

    // 2. RECIPIENTS
    if (kind === 'all' || kind === 'recipients') {
      const recipients = await User.find({
        role: ROLES.RECIPIENT,
        isVerified: true,
        isActive: true,
        mapVisible: { $ne: false },
        approxLocation: geoFilter,
      }).select('_id name organization address approxLocation ratingAverage');

      for (const r of recipients) {
        const openReqs = await RecipientRequirement.find({
          recipientId: r._id,
          status: REQUIREMENT_STATUS.OPEN,
        }).select('priority priorityWeight');

        const highestPriority = openReqs.some((rq) => rq.priority === 'HIGH')
          ? 'HIGH'
          : openReqs.some((rq) => rq.priority === 'MEDIUM')
          ? 'MEDIUM'
          : openReqs.length > 0
          ? 'LOW'
          : null;

        const distance = calculateHaversineDistanceKm([lng, lat], r.approxLocation.coordinates);
        const displayName = r.organization?.name || r.name;

        results.push({
          id: r._id.toString(),
          type: 'recipient',
          kind: 'recipient',
          role: 'recipient',
          name: displayName,
          areaLabel: r.address?.city || 'Bengaluru Area',
          approxLocation: r.approxLocation,
          distanceKm: distance,
          openRequirementCount: openReqs.length,
          highestPriority,
          ratingAverage: r.ratingAverage || 0,
        });
      }
    }

    // 3. AVAILABLE DONATIONS
    if (kind === 'all' || kind === 'donations') {
      const donations = await Donation.find({
        status: { $in: [DONATION_STATUS.AVAILABLE, DONATION_STATUS.PARTIALLY_ACCEPTED, DONATION_STATUS.REOPENED] },
        remainingQuantity: { $gt: 0 },
        approxLocation: geoFilter,
      }).populate('donorId', 'name organization phone ratingAverage');

      for (const don of donations) {
        const view = toDonationView(don, viewer, [lng, lat]);
        results.push({
          id: don._id.toString(),
          type: 'donation',
          kind: 'donation',
          foodName: don.foodName,
          foodType: don.foodType,
          quantity: don.remainingQuantity,
          unit: don.unit,
          priority: don.priority || 'MEDIUM',
          urgencyLevel: view.urgencyLevel,
          areaLabel: view.areaLabel,
          approxLocation: don.approxLocation,
          distanceKm: view.distanceKm,
          donorName: view.donorName,
        });
      }
    }

    // 4. OPEN REQUIREMENTS
    if (kind === 'all' || kind === 'requirements') {
      const requirements = await RecipientRequirement.find({
        status: REQUIREMENT_STATUS.OPEN,
        approxLocation: geoFilter,
      }).populate('recipientId', 'name organization');

      for (const reqItem of requirements) {
        const distance = calculateHaversineDistanceKm([lng, lat], reqItem.approxLocation.coordinates);
        results.push({
          id: reqItem._id.toString(),
          type: 'requirement',
          title: reqItem.title,
          foodType: reqItem.foodType,
          quantityNeeded: reqItem.quantityNeeded,
          unit: reqItem.unit,
          priority: reqItem.priority || 'MEDIUM',
          areaLabel: reqItem.address?.city || 'Bengaluru Area',
          approxLocation: reqItem.approxLocation,
          distanceKm: distance,
          recipientName: reqItem.recipientId?.organization?.name || reqItem.recipientId?.name,
        });
      }
    }

    // 5. DELIVERY AGENT TASKS (Visible to Agents and Admins)
    if (viewer && (viewer.role === ROLES.DELIVERY_AGENT || viewer.role === ROLES.ADMIN)) {
      const tasks = await DeliveryTask.find({
        currentMilestone: { $in: ['OPEN_FOR_PICKUP', 'ASSIGNED', 'ARRIVED_PICKUP'] },
      }).limit(20);

      for (const task of tasks) {
        results.push({
          id: task._id.toString(),
          type: 'task',
          foodName: task.foodName,
          currentMilestone: task.currentMilestone,
          priority: task.priority || 'MEDIUM',
          deliveryProvider: task.deliveryProvider,
          distanceKm: 2.5,
        });
      }
    }

    return results;
  };

  let candidates = await executeQueries(radiusKm);

  // Auto-widen: If 0 candidates found at 5 km, expand once to 10 km
  if (candidates.length === 0 && radiusKm <= 5) {
    radiusKm = 10;
    candidates = await executeQueries(10);
    expandedRadius = true;
  }

  // Sort by nearest distance first
  candidates.sort((a, b) => (a.distanceKm || 0) - (b.distanceKm || 0));

  const total = candidates.length;
  const skip = (page - 1) * limit;
  const paginatedResults = candidates.slice(skip, skip + limit);

  return ApiResponse.send(res, 200, 'Nearby map items retrieved successfully', paginatedResults, {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit) || 1,
    radiusKm,
    expandedRadius,
    center: { lat, lng },
  });
});

module.exports = {
  getNearbyMapItems,
};
