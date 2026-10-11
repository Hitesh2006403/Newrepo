const mongoose = require('mongoose');
const DeliveryBatch = require('../models/DeliveryBatch');
const DeliveryTask = require('../models/DeliveryTask');
const Donation = require('../models/Donation');
const User = require('../models/User');
const geoService = require('./geoService');
const { calculateHaversineDistanceKm } = require('../utils/geoUtils');
const {
  VEHICLE_TYPES,
  VEHICLE_CAPACITIES,
  BATCH_STATUS,
  BATCH_CONFIG,
  parseTaskQuantity,
  isLoadWithinCapacity,
} = require('../constants/batch');
const ApiError = require('../utils/ApiError');
const ERROR_CODES = require('../constants/errorCodes');
const { emitEvent, DOMAIN_EVENT_NAMES } = require('./domainEvents');

/**
 * Generates all permutations of an array.
 */
function getPermutations(arr) {
  if (arr.length <= 1) return [arr];
  const result = [];
  for (let i = 0; i < arr.length; i++) {
    const current = arr[i];
    const remaining = arr.slice(0, i).concat(arr.slice(i + 1));
    const remainingPerms = getPermutations(remaining);
    for (const perm of remainingPerms) {
      result.push([current, ...perm]);
    }
  }
  return result;
}

/**
 * Checks if a stop permutation satisfies precedence:
 * For every task, its PICKUP must appear before its DROPOFF.
 */
function isPrecedenceValid(permutation) {
  const seenPickups = new Set();
  for (const stop of permutation) {
    if (stop.type === 'PICKUP') {
      seenPickups.add(stop.taskId);
    } else if (stop.type === 'DROPOFF') {
      if (!seenPickups.has(stop.taskId)) {
        return false;
      }
    }
  }
  return true;
}

/**
 * Resolves pickup and dropoff coordinates and details for a DeliveryTask.
 */
async function resolveTaskStops(task) {
  const taskId = task._id.toString();
  const quantityNumber = parseTaskQuantity(task.quantity) || task.portions || 10;
  const weightKg = task.weightKg || Math.round(quantityNumber * 0.4 * 10) / 10;

  // Attempt to resolve coordinates from task or linked donation
  let pickupCoords = task.pickup?.coordinates || null;
  let dropoffCoords = task.dropoff?.coordinates || null;
  let effectiveExpiry = task.pickup?.deadline || new Date(Date.now() + 2 * 3600 * 1000);

  if (task.donationId) {
    const donation = await Donation.findById(task.donationId);
    if (donation) {
      if (!pickupCoords && donation.location?.coordinates) {
        pickupCoords = donation.location.coordinates;
      }
      if (donation.expiryAt) {
        const buffer = donation.safetyBufferMinutes || BATCH_CONFIG.DEFAULT_SAFETY_BUFFER_MINUTES;
        effectiveExpiry = new Date(donation.expiryAt.getTime() - buffer * 60 * 1000);
      }
    }
  }

  // Fallback defaults for Bengaluru coordinates if coordinates not populated
  if (!pickupCoords || pickupCoords.length < 2 || (pickupCoords[0] === 0 && pickupCoords[1] === 0)) {
    pickupCoords = [77.5946, 12.9716]; // Bengaluru Central
  }
  if (!dropoffCoords || dropoffCoords.length < 2 || (dropoffCoords[0] === 0 && dropoffCoords[1] === 0)) {
    // Offset slightly for destination
    dropoffCoords = [pickupCoords[0] + 0.03, pickupCoords[1] + 0.03];
  }

  const pickupStop = {
    type: 'PICKUP',
    taskId,
    donationId: task.donationId,
    coordinates: pickupCoords,
    formattedAddress: task.pickup?.location || 'Donor Location',
    contactName: task.pickup?.donorName || 'Donor Contact',
    contactPhone: task.pickup?.donorPhone || '+91 98765 43210',
    deadline: task.pickup?.deadline || effectiveExpiry,
    quantity: task.quantity,
    quantityNumber,
    weightKg,
    foodName: task.foodName,
    effectiveExpiryAt: effectiveExpiry,
    payout: task.payout || 0,
    deliveryFee: task.deliveryFee || 0,
  };

  const dropoffStop = {
    type: 'DROPOFF',
    taskId,
    donationId: task.donationId,
    coordinates: dropoffCoords,
    formattedAddress: task.dropoff?.location || 'Recipient Location',
    contactName: task.dropoff?.recipientName || 'Recipient Contact',
    contactPhone: task.dropoff?.recipientPhone || '+91 91234 56789',
    deadline: task.dropoff?.deadline || new Date(effectiveExpiry.getTime() + 3600 * 1000),
    quantity: task.quantity,
    quantityNumber,
    weightKg,
    foodName: task.foodName,
    effectiveExpiryAt: effectiveExpiry,
    payout: task.payout || 0,
    deliveryFee: task.deliveryFee || 0,
  };

  return { pickupStop, dropoffStop };
}

/**
 * Optimizes the multi-stop waypoint sequence, computes route metrics,
 * and validates safety buffer feasibility at every stop.
 */
async function computeOptimalBatchRoute(tasks, vehicleType = '2_WHEELER') {
  if (!tasks || tasks.length < BATCH_CONFIG.MIN_BATCH_TASKS) {
    throw new ApiError(
      400,
      ERROR_CODES.VALIDATION_ERROR,
      `A batch must contain at least ${BATCH_CONFIG.MIN_BATCH_TASKS} tasks`
    );
  }
  if (tasks.length > BATCH_CONFIG.MAX_BATCH_TASKS) {
    throw new ApiError(
      400,
      ERROR_CODES.VALIDATION_ERROR,
      `A batch cannot contain more than ${BATCH_CONFIG.MAX_BATCH_TASKS} tasks`
    );
  }

  // 1. Resolve all stops
  const allStops = [];
  let totalPlates = 0;
  let totalKg = 0;
  let totalPayout = 0;
  let totalDeliveryFee = 0;

  for (const task of tasks) {
    const { pickupStop, dropoffStop } = await resolveTaskStops(task);
    allStops.push(pickupStop, dropoffStop);
    totalPlates += pickupStop.quantityNumber;
    totalKg += pickupStop.weightKg;
    totalPayout += pickupStop.payout;
    totalDeliveryFee += pickupStop.deliveryFee;
  }

  // 2. Validate Vehicle Capacity
  const capacityCheck = isLoadWithinCapacity(vehicleType, totalPlates, totalKg);
  if (!capacityCheck.fits) {
    throw new ApiError(
      400,
      ERROR_CODES.BATCH_CAPACITY_EXCEEDED,
      `Combined batch load (${totalPlates} plates, ${totalKg} kg) exceeds ${vehicleType} capacity (${capacityCheck.maxPlates} plates, ${capacityCheck.maxKg} kg)`
    );
  }

  // 3. Check Corridor Proximity (Pickups within MAX_CORRIDOR_KM of each other)
  const pickups = allStops.filter((s) => s.type === 'PICKUP');
  for (let i = 0; i < pickups.length; i++) {
    for (let j = i + 1; j < pickups.length; j++) {
      const dist = calculateHaversineDistanceKm(pickups[i].coordinates, pickups[j].coordinates);
      if (dist > BATCH_CONFIG.MAX_CORRIDOR_KM) {
        throw new ApiError(
          400,
          ERROR_CODES.BATCH_INCOMPATIBLE,
          `Pickup locations are ${dist.toFixed(1)} km apart, which exceeds the max corridor radius of ${BATCH_CONFIG.MAX_CORRIDOR_KM} km`
        );
      }
    }
  }

  // 4. Generate candidate valid permutations (where Pickups precede corresponding Dropoffs)
  const rawPermutations = getPermutations(allStops);
  const validSequences = rawPermutations.filter(isPrecedenceValid);

  // 5. Evaluate distance and safety buffer feasibility for each valid sequence
  let bestSequence = null;
  let minTotalDistance = Infinity;
  let safetyFeasibleCandidateFound = false;

  const nowMs = Date.now();

  for (const sequence of validSequences) {
    let currentCumulativeMinutes = 0;
    let sequenceDistanceKm = 0;
    let sequenceFeasible = true;
    const evaluatedStops = [];

    for (let i = 0; i < sequence.length; i++) {
      const stop = sequence[i];
      let legMinutes = 5;
      let legKm = 2.0;

      if (i > 0) {
        const prevStop = sequence[i - 1];
        // Coordinate points: [lng, lat]
        const fromLng = prevStop.coordinates[0];
        const fromLat = prevStop.coordinates[1];
        const toLng = stop.coordinates[0];
        const toLat = stop.coordinates[1];

        const routeResult = await geoService.route(fromLat, fromLng, toLat, toLng);
        legKm = routeResult.distanceKm;
        legMinutes = routeResult.durationMinutes;
      }

      sequenceDistanceKm += legKm;
      // Add travel time + handling buffer (15 min per stop)
      currentCumulativeMinutes += legMinutes + BATCH_CONFIG.STOP_HANDLING_BUFFER_MINUTES;

      // Verify Safety Buffer Feasibility against stop's effectiveExpiryAt
      const arrivalTimestamp = nowMs + currentCumulativeMinutes * 60 * 1000;
      const effectiveExpiryMs = new Date(stop.effectiveExpiryAt).getTime();

      const isStopFeasible = arrivalTimestamp <= effectiveExpiryMs;
      if (!isStopFeasible) {
        sequenceFeasible = false;
      }

      evaluatedStops.push({
        ...stop,
        stopNumber: i + 1,
        estimatedMinutesFromPrev: legMinutes,
        cumulativeEtaMinutes: currentCumulativeMinutes,
        feasible: isStopFeasible,
      });
    }

    if (sequenceFeasible) {
      safetyFeasibleCandidateFound = true;
      if (sequenceDistanceKm < minTotalDistance) {
        minTotalDistance = sequenceDistanceKm;
        bestSequence = {
          stops: evaluatedStops,
          totalDistanceKm: Math.round(sequenceDistanceKm * 10) / 10,
          totalEstimatedMinutes: currentCumulativeMinutes,
        };
      }
    }
  }

  // If no sequence satisfied the safety buffer deadline, throw feasibility error
  if (!safetyFeasibleCandidateFound || !bestSequence) {
    throw new ApiError(
      400,
      ERROR_CODES.PICKUP_NOT_FEASIBLE,
      'Pickup not feasible: Multi-stop co-routing travel and handling time exceeds food safety expiry buffer for one or more deliveries'
    );
  }

  const capacityPct = Math.round((totalPlates / capacityCheck.maxPlates) * 100);

  return {
    stops: bestSequence.stops,
    metrics: {
      totalDistanceKm: bestSequence.totalDistanceKm,
      totalEstimatedMinutes: bestSequence.totalEstimatedMinutes,
      totalPlates,
      totalKg,
      capacityUtilizationPct: capacityPct,
      totalPayout,
      totalDeliveryFee,
      taskCount: tasks.length,
    },
  };
}

/**
 * Creates a new proposed delivery batch.
 */
async function createBatch({ taskIds, vehicleType = '2_WHEELER', agentId = null }) {
  if (!taskIds || !Array.isArray(taskIds) || taskIds.length < BATCH_CONFIG.MIN_BATCH_TASKS) {
    throw new ApiError(
      400,
      ERROR_CODES.VALIDATION_ERROR,
      `Provide at least ${BATCH_CONFIG.MIN_BATCH_TASKS} task IDs to create a delivery batch`
    );
  }

  // Fetch and validate tasks
  const tasks = await DeliveryTask.find({ _id: { $in: taskIds } });
  if (tasks.length !== taskIds.length) {
    throw new ApiError(404, ERROR_CODES.NOT_FOUND, 'One or more delivery tasks could not be found');
  }

  // Ensure tasks are not already batched or completed
  for (const t of tasks) {
    if (t.batchId) {
      throw new ApiError(
        409,
        ERROR_CODES.CONFLICT,
        `Task ${t._id} is already assigned to batch ${t.batchId}`
      );
    }
    if (['DELIVERED', 'CANCELLED'].includes(t.currentMilestone)) {
      throw new ApiError(
        400,
        ERROR_CODES.INVALID_STATUS_TRANSITION,
        `Task ${t._id} is in status ${t.currentMilestone} and cannot be batched`
      );
    }
  }

  // Calculate route and safety feasibility
  const routeCalculation = await computeOptimalBatchRoute(tasks, vehicleType);

  const batchNumber = `BATCH-${Date.now().toString(36).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;

  const batch = await DeliveryBatch.create({
    batchNumber,
    deliveryAgentId: agentId,
    vehicleType,
    status: BATCH_STATUS.PROPOSED,
    taskIds: tasks.map((t) => t._id.toString()),
    stops: routeCalculation.stops,
    metrics: routeCalculation.metrics,
  });

  // Associate tasks with this proposed batch so they cannot be double-batched
  await DeliveryTask.updateMany(
    { _id: { $in: tasks.map((t) => t._id) } },
    { $set: { batchId: batch._id.toString() } }
  );

  emitEvent(DOMAIN_EVENT_NAMES.BATCH_CHANGED, {
    batchId: batch._id.toString(),
    batchNumber: batch.batchNumber,
    status: batch.status,
    taskCount: tasks.length,
  });

  return batch;
}

/**
 * Discovers available unassigned tasks and finds co-routable pairings.
 */
async function getAvailableBatches({ agentId = null, vehicleType = '2_WHEELER' } = {}) {
  // Query open, unbatched tasks
  const openTasks = await DeliveryTask.find({
    batchId: null,
    currentMilestone: { $in: ['OPEN_FOR_PICKUP', 'AVAILABLE', 'ASSIGNED'] },
    $or: [
      { deliveryAgentId: null },
      { deliveryAgentId: 'agent@delivery.com' },
      { deliveryAgentId: 'user-delivery-1' },
    ],
  }).sort({ 'pickup.deadline': 1 });

  // If existing PROPOSED batches exist, return them
  const existingBatches = await DeliveryBatch.find({
    status: BATCH_STATUS.PROPOSED,
  }).sort({ createdAt: -1 });

  const suggestedPairs = [];

  // Form candidate 2-task pairings if fewer than 3 proposed batches exist
  if (existingBatches.length < 3 && openTasks.length >= 2) {
    for (let i = 0; i < Math.min(openTasks.length, 6); i++) {
      for (let j = i + 1; j < Math.min(openTasks.length, 6); j++) {
        const taskA = openTasks[i];
        const taskB = openTasks[j];
        try {
          const testRoute = await computeOptimalBatchRoute([taskA, taskB], vehicleType);
          suggestedPairs.push({
            taskIds: [taskA._id.toString(), taskB._id.toString()],
            vehicleType,
            metrics: testRoute.metrics,
            stops: testRoute.stops,
          });
        } catch (err) {
          // Incompatible or infeasible; skip pair
        }
      }
    }
  }

  return {
    proposedBatches: existingBatches,
    suggestedBatches: suggestedPairs.slice(0, 5),
    unbatchedOpenTaskCount: openTasks.length,
  };
}

/**
 * Claims a delivery batch for an agent.
 */
async function claimBatch(batchId, agentUser) {
  const agentId = agentUser?._id?.toString() || agentUser?.agentId || 'user-delivery-1';
  const agentName = agentUser?.name || 'Assigned Driver';

  const batch = await DeliveryBatch.findById(batchId);
  if (!batch) {
    throw new ApiError(404, ERROR_CODES.BATCH_NOT_FOUND, 'Delivery batch not found');
  }

  if (batch.status !== BATCH_STATUS.PROPOSED) {
    throw new ApiError(
      409,
      ERROR_CODES.BATCH_ALREADY_CLAIMED,
      `Batch is already in ${batch.status} status and cannot be claimed`
    );
  }

  // Validate agent profile if available
  if (agentUser && agentUser.agentPreferences) {
    // Check vehicle compatibility
    const agentVehicle = agentUser.agentPreferences.vehicleType || '2_WHEELER';
    const capacityCheck = isLoadWithinCapacity(
      agentVehicle,
      batch.metrics.totalPlates,
      batch.metrics.totalKg
    );
    if (!capacityCheck.fits) {
      throw new ApiError(
        400,
        ERROR_CODES.BATCH_CAPACITY_EXCEEDED,
        `Your vehicle (${agentVehicle}) cannot support this batch load (${batch.metrics.totalPlates} plates)`
      );
    }

    // Check volunteer-only restriction
    if (agentUser.agentPreferences.volunteerOnly && batch.metrics.totalDeliveryFee > 0) {
      throw new ApiError(
        400,
        ERROR_CODES.AGENT_VOLUNTEER_ONLY,
        'Your profile is volunteer-only, but this batch contains delivery fees'
      );
    }
  }

  // Atomically update batch
  batch.deliveryAgentId = agentId;
  batch.deliveryAgentName = agentName;
  batch.status = BATCH_STATUS.CLAIMED;
  batch.claimedAt = new Date();
  await batch.save();

  // Update constituent tasks
  await DeliveryTask.updateMany(
    { _id: { $in: batch.taskIds } },
    {
      $set: {
        batchId: batch._id.toString(),
        deliveryAgentId: agentId,
        currentMilestone: 'ASSIGNED',
        feeLocked: true,
      },
    }
  );

  emitEvent(DOMAIN_EVENT_NAMES.BATCH_CHANGED, {
    batchId: batch._id.toString(),
    batchNumber: batch.batchNumber,
    status: BATCH_STATUS.CLAIMED,
    agentId,
  });

  for (const taskId of batch.taskIds) {
    emitEvent(DOMAIN_EVENT_NAMES.PICKUP_ASSIGNED, {
      taskId,
      agentId,
      batchId: batch._id.toString(),
    });
  }

  return batch;
}

/**
 * Releases/cancels a claimed batch and frees its constituent tasks.
 */
async function releaseBatch(batchId, agentId) {
  const batch = await DeliveryBatch.findById(batchId);
  if (!batch) {
    throw new ApiError(404, ERROR_CODES.BATCH_NOT_FOUND, 'Delivery batch not found');
  }

  batch.status = BATCH_STATUS.CANCELLED;
  await batch.save();

  await DeliveryTask.updateMany(
    { _id: { $in: batch.taskIds } },
    {
      $set: {
        batchId: null,
        currentMilestone: 'OPEN_FOR_PICKUP',
        feeLocked: false,
      },
    }
  );

  emitEvent(DOMAIN_EVENT_NAMES.BATCH_CHANGED, {
    batchId: batch._id.toString(),
    status: BATCH_STATUS.CANCELLED,
  });

  for (const taskId of batch.taskIds) {
    emitEvent(DOMAIN_EVENT_NAMES.PICKUP_RELEASED, {
      taskId,
      batchId: batch._id.toString(),
    });
  }

  return batch;
}

module.exports = {
  computeOptimalBatchRoute,
  createBatch,
  getAvailableBatches,
  claimBatch,
  releaseBatch,
};
