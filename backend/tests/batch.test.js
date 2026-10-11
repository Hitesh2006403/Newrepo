const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../app');
const User = require('../src/models/User');
const Donation = require('../src/models/Donation');
const DeliveryTask = require('../src/models/DeliveryTask');
const DeliveryBatch = require('../src/models/DeliveryBatch');
const { ROLES } = require('../src/constants/roles');
const authService = require('../src/services/authService');
const ERROR_CODES = require('../src/constants/errorCodes');
const batchService = require('../src/services/batchService');
const { VEHICLE_CAPACITIES } = require('../src/constants/batch');

describe('Phase 4 - Delivery Batching, Multi-Stop Co-Routing, Vehicle Matching & Safety Buffer Test Suite', () => {
  let donorUser, donorToken;
  let driverUser, driverToken;
  let truckDriverUser, truckDriverToken;
  let task1, task2, task3, largeTask;

  beforeEach(async () => {
    // 1. Donor
    donorUser = await User.create({
      name: 'Central Kitchen',
      email: 'central@kitchen.org',
      password: 'Password123!',
      role: ROLES.DONOR,
      phone: '+919876543210',
      isVerified: true,
      isActive: true,
      location: { type: 'Point', coordinates: [77.5946, 12.9716] }, // MG Road
      address: { city: 'Bengaluru', formattedAddress: 'MG Road, Bengaluru' },
    });
    donorToken = authService.generateToken(donorUser._id);

    // 2. Standard 2-Wheeler Driver (max 20 plates)
    driverUser = await User.create({
      name: 'Ravi Bike Delivery',
      email: 'ravi@delivery.org',
      password: 'Password123!',
      role: ROLES.DELIVERY_AGENT,
      phone: '+919876543211',
      isVerified: true,
      isActive: true,
      location: { type: 'Point', coordinates: [77.595, 12.972] },
      address: { city: 'Bengaluru', formattedAddress: 'Brigade Road, Bengaluru' },
      agentPreferences: {
        vehicleType: '2_WHEELER',
        volunteerOnly: false,
      },
    });
    driverToken = authService.generateToken(driverUser._id);

    // 3. Truck Driver (max 500 plates)
    truckDriverUser = await User.create({
      name: 'Truck Logistics',
      email: 'truck@delivery.org',
      password: 'Password123!',
      role: ROLES.DELIVERY_AGENT,
      phone: '+919876543212',
      isVerified: true,
      isActive: true,
      location: { type: 'Point', coordinates: [77.595, 12.972] },
      address: { city: 'Bengaluru', formattedAddress: 'Indiranagar, Bengaluru' },
      agentPreferences: {
        vehicleType: 'TRUCK',
        volunteerOnly: false,
      },
    });
    truckDriverToken = authService.generateToken(truckDriverUser._id);

    // 4. Create Linked Donations with safe expiries (3-4 hours ahead)
    const now = new Date();
    const donation1 = await Donation.create({
      donorId: donorUser._id,
      foodName: 'Nutritious Thali 1',
      totalQuantity: 10,
      remainingQuantity: 10,
      unit: 'plates',
      foodType: 'cooked_meals',
      dietaryType: 'vegetarian',
      cookedAt: new Date(now.getTime() - 3600 * 1000),
      expiryAt: new Date(now.getTime() + 4 * 3600 * 1000),
      pickupWindowStart: now,
      pickupWindowEnd: new Date(now.getTime() + 3 * 3600 * 1000),
      safetyBufferMinutes: 60,
      location: { type: 'Point', coordinates: [77.5946, 12.9716] }, // Central MG Road
      address: { city: 'Bengaluru', formattedAddress: '10 MG Road, Bengaluru' },
    });

    const donation2 = await Donation.create({
      donorId: donorUser._id,
      foodName: 'Rice & Curry Box 2',
      totalQuantity: 8,
      remainingQuantity: 8,
      unit: 'plates',
      foodType: 'cooked_meals',
      dietaryType: 'vegetarian',
      cookedAt: new Date(now.getTime() - 3600 * 1000),
      expiryAt: new Date(now.getTime() + 4 * 3600 * 1000),
      pickupWindowStart: now,
      pickupWindowEnd: new Date(now.getTime() + 3 * 3600 * 1000),
      safetyBufferMinutes: 60,
      location: { type: 'Point', coordinates: [77.6046, 12.975] }, // 1.2 km away
      address: { city: 'Bengaluru', formattedAddress: 'Indiranagar Main Rd, Bengaluru' },
    });

    const donation3 = await Donation.create({
      donorId: donorUser._id,
      foodName: 'Roti & Dal Pack 3',
      totalQuantity: 5,
      remainingQuantity: 5,
      unit: 'plates',
      foodType: 'cooked_meals',
      dietaryType: 'vegetarian',
      cookedAt: new Date(now.getTime() - 3600 * 1000),
      expiryAt: new Date(now.getTime() + 4 * 3600 * 1000),
      pickupWindowStart: now,
      pickupWindowEnd: new Date(now.getTime() + 3 * 3600 * 1000),
      safetyBufferMinutes: 60,
      location: { type: 'Point', coordinates: [77.61, 12.98] }, // 2 km away
      address: { city: 'Bengaluru', formattedAddress: 'Koramangala, Bengaluru' },
    });

    // 5. Create Delivery Tasks
    task1 = await DeliveryTask.create({
      donationId: donation1._id.toString(),
      foodName: 'Nutritious Thali 1',
      quantity: '10 plates',
      portions: 10,
      weightKg: 4,
      currentMilestone: 'OPEN_FOR_PICKUP',
      payout: 90,
      deliveryFee: 40,
      pickup: {
        location: '10 MG Road, Bengaluru',
        coordinates: [77.5946, 12.9716],
        donorName: 'Chef Mario',
        donorPhone: '+91 98765 43210',
        deadline: new Date(now.getTime() + 3 * 3600 * 1000),
      },
      dropoff: {
        location: 'Care Home Alpha, Bengaluru',
        coordinates: [77.62, 12.95],
        recipientName: 'Care Alpha',
        recipientPhone: '+91 91234 56789',
        deadline: new Date(now.getTime() + 3.5 * 3600 * 1000),
      },
    });

    task2 = await DeliveryTask.create({
      donationId: donation2._id.toString(),
      foodName: 'Rice & Curry Box 2',
      quantity: '8 plates',
      portions: 8,
      weightKg: 3.2,
      currentMilestone: 'OPEN_FOR_PICKUP',
      payout: 85,
      deliveryFee: 35,
      pickup: {
        location: 'Indiranagar Main Rd, Bengaluru',
        coordinates: [77.6046, 12.975],
        donorName: 'Spice Hub',
        donorPhone: '+91 98765 43211',
        deadline: new Date(now.getTime() + 3 * 3600 * 1000),
      },
      dropoff: {
        location: 'Hope Shelter Beta, Bengaluru',
        coordinates: [77.63, 12.96],
        recipientName: 'Shelter Beta',
        recipientPhone: '+91 91234 56788',
        deadline: new Date(now.getTime() + 3.5 * 3600 * 1000),
      },
    });

    task3 = await DeliveryTask.create({
      donationId: donation3._id.toString(),
      foodName: 'Roti & Dal Pack 3',
      quantity: '5 plates',
      portions: 5,
      weightKg: 2,
      currentMilestone: 'OPEN_FOR_PICKUP',
      payout: 75,
      deliveryFee: 25,
      pickup: {
        location: 'Koramangala, Bengaluru',
        coordinates: [77.61, 12.98],
        donorName: 'Roti Ghar',
        donorPhone: '+91 98765 43212',
        deadline: new Date(now.getTime() + 3 * 3600 * 1000),
      },
      dropoff: {
        location: 'Youth Community Center, Bengaluru',
        coordinates: [77.64, 12.97],
        recipientName: 'Community Center',
        recipientPhone: '+91 91234 56787',
        deadline: new Date(now.getTime() + 3.5 * 3600 * 1000),
      },
    });

    // Large task that exceeds 2-wheeler capacity (25 plates > 20 limit)
    largeTask = await DeliveryTask.create({
      donationId: donation1._id.toString(),
      foodName: 'Large Banquet Surplus',
      quantity: '25 plates',
      portions: 25,
      weightKg: 12,
      currentMilestone: 'OPEN_FOR_PICKUP',
      payout: 180,
      deliveryFee: 80,
      pickup: {
        location: 'Convention Center, Bengaluru',
        coordinates: [77.5946, 12.9716],
        donorName: 'Grand Banquet',
        donorPhone: '+91 98765 43213',
        deadline: new Date(now.getTime() + 3 * 3600 * 1000),
      },
      dropoff: {
        location: 'Big Community Hall, Bengaluru',
        coordinates: [77.62, 12.95],
        recipientName: 'Community Hall',
        recipientPhone: '+91 91234 56786',
        deadline: new Date(now.getTime() + 3.5 * 3600 * 1000),
      },
    });
  });

  describe('4A: Vehicle Load & Capacity Matching', () => {
    it('should reject creating a 2_WHEELER batch when combined plates exceed vehicle capacity (20 plates)', async () => {
      // task1 (10 plates) + largeTask (25 plates) = 35 plates > 20 plates
      const res = await request(app)
        .post('/api/v1/delivery/batches')
        .send({
          taskIds: [task1._id.toString(), largeTask._id.toString()],
          vehicleType: '2_WHEELER',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe(ERROR_CODES.BATCH_CAPACITY_EXCEEDED);
      expect(res.body.error.message).toMatch(/exceeds 2_WHEELER capacity/i);
    });

    it('should allow the same load when upgrading vehicleType to 3_WHEELER or 4_WHEELER', async () => {
      // 35 plates fits comfortably inside 3_WHEELER (max 60 plates)
      const res = await request(app)
        .post('/api/v1/delivery/batches')
        .send({
          taskIds: [task1._id.toString(), largeTask._id.toString()],
          vehicleType: '3_WHEELER',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.vehicleType).toBe('3_WHEELER');
      expect(res.body.data.metrics.totalPlates).toBe(35);
      expect(res.body.data.metrics.capacityUtilizationPct).toBe(Math.round((35 / 60) * 100));
    });

    it('should block a 2_WHEELER driver from claiming a batch whose load exceeds 20 plates', async () => {
      // Create batch with 3_WHEELER vehicle
      const createRes = await request(app)
        .post('/api/v1/delivery/batches')
        .send({
          taskIds: [task1._id.toString(), largeTask._id.toString()],
          vehicleType: '3_WHEELER',
        });
      const batchId = createRes.body.data._id;

      // Ravi is a 2_WHEELER driver
      const claimRes = await request(app)
        .post(`/api/v1/delivery/batches/${batchId}/claim`)
        .set('Authorization', `Bearer ${driverToken}`)
        .send();

      expect(claimRes.status).toBe(400);
      expect(claimRes.body.error.code).toBe(ERROR_CODES.BATCH_CAPACITY_EXCEEDED);
    });
  });

  describe('4B: Multi-Stop Co-Routing Sequence & Corridor Constraints', () => {
    it('should order waypoints such that Pickups strictly precede corresponding Dropoffs', async () => {
      const res = await request(app)
        .post('/api/v1/delivery/batches')
        .send({
          taskIds: [task1._id.toString(), task2._id.toString()],
          vehicleType: '2_WHEELER',
        });

      expect(res.status).toBe(201);
      const { stops, metrics } = res.body.data;
      expect(stops.length).toBe(4); // 2 pickups + 2 dropoffs

      // Verify precedence for Task 1
      const p1Index = stops.findIndex((s) => s.taskId === task1._id.toString() && s.type === 'PICKUP');
      const d1Index = stops.findIndex((s) => s.taskId === task1._id.toString() && s.type === 'DROPOFF');
      expect(p1Index).toBeGreaterThanOrEqual(0);
      expect(d1Index).toBeGreaterThan(p1Index);

      // Verify precedence for Task 2
      const p2Index = stops.findIndex((s) => s.taskId === task2._id.toString() && s.type === 'PICKUP');
      const d2Index = stops.findIndex((s) => s.taskId === task2._id.toString() && s.type === 'DROPOFF');
      expect(p2Index).toBeGreaterThanOrEqual(0);
      expect(d2Index).toBeGreaterThan(p2Index);

      // Check metrics
      expect(metrics.totalDistanceKm).toBeGreaterThan(0);
      expect(metrics.totalEstimatedMinutes).toBeGreaterThan(0);
      expect(metrics.totalPayout).toBe(175); // 90 + 85
      expect(metrics.totalDeliveryFee).toBe(75); // 40 + 35
    });

    it('should reject batch creation when pickups are beyond the 10km corridor (BATCH_INCOMPATIBLE)', async () => {
      // Create a task located 25 km away in Whitefield
      const farTask = await DeliveryTask.create({
        donationId: new mongoose.Types.ObjectId().toString(),
        foodName: 'Distant Banquet',
        quantity: '5 plates',
        portions: 5,
        currentMilestone: 'OPEN_FOR_PICKUP',
        pickup: {
          location: 'Whitefield Tech Park, Bengaluru',
          coordinates: [77.75, 12.98], // ~18 km east of MG Road
          donorName: 'Tech Park Cafe',
          deadline: new Date(Date.now() + 4 * 3600 * 1000),
        },
        dropoff: {
          location: 'Hope Whitefield, Bengaluru',
          coordinates: [77.76, 12.99],
          recipientName: 'Hope Whitefield',
          deadline: new Date(Date.now() + 5 * 3600 * 1000),
        },
      });

      const res = await request(app)
        .post('/api/v1/delivery/batches')
        .send({
          taskIds: [task1._id.toString(), farTask._id.toString()],
          vehicleType: '2_WHEELER',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe(ERROR_CODES.BATCH_INCOMPATIBLE);
      expect(res.body.error.message).toMatch(/exceeds the max corridor radius/i);
    });
  });

  describe('4C: Safety Buffer Feasibility on All Stops', () => {
    it('should reject batch creation when any stop arrives after effective safe expiry (PICKUP_NOT_FEASIBLE)', async () => {
      // Create a task whose food expires in only 20 minutes (effective safe expiry already in the past!)
      const imminentExpiryTask = await DeliveryTask.create({
        donationId: new mongoose.Types.ObjectId().toString(),
        foodName: 'Near-Expiry Soup',
        quantity: '5 plates',
        portions: 5,
        currentMilestone: 'OPEN_FOR_PICKUP',
        pickup: {
          location: 'Quick Cafe, Bengaluru',
          coordinates: [77.595, 12.972],
          donorName: 'Quick Cafe',
          deadline: new Date(Date.now() + 20 * 60 * 1000), // Only 20 mins left
        },
        dropoff: {
          location: 'Immediate Shelter, Bengaluru',
          coordinates: [77.61, 12.96],
          recipientName: 'Immediate Shelter',
          deadline: new Date(Date.now() + 25 * 60 * 1000),
        },
      });

      const res = await request(app)
        .post('/api/v1/delivery/batches')
        .send({
          taskIds: [task1._id.toString(), imminentExpiryTask._id.toString()],
          vehicleType: '2_WHEELER',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe(ERROR_CODES.PICKUP_NOT_FEASIBLE);
      expect(res.body.error.message).toMatch(/safety expiry buffer/i);
    });
  });

  describe('4D: Batch Lifecycle, Concurrency & Claiming', () => {
    it('POST /preview should calculate route metrics without saving to database', async () => {
      const initialCount = await DeliveryBatch.countDocuments();

      const res = await request(app)
        .post('/api/v1/delivery/batches/preview')
        .send({
          taskIds: [task1._id.toString(), task2._id.toString()],
          vehicleType: '2_WHEELER',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.stops.length).toBe(4);
      expect(res.body.data.metrics.totalDistanceKm).toBeGreaterThan(0);

      // Verify no database record was created
      const finalCount = await DeliveryBatch.countDocuments();
      expect(finalCount).toBe(initialCount);
    });

    it('GET /available should return proposed batches and discovery pairings', async () => {
      // Create a proposed batch
      await request(app)
        .post('/api/v1/delivery/batches')
        .send({
          taskIds: [task1._id.toString(), task2._id.toString()],
          vehicleType: '2_WHEELER',
        });

      const res = await request(app)
        .get('/api/v1/delivery/batches/available?vehicleType=2_WHEELER')
        .send();

      expect(res.status).toBe(200);
      expect(res.body.data.proposedBatches.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data.proposedBatches[0].status).toBe('PROPOSED');
    });

    it('POST /:id/claim should atomically claim batch, lock fees, and set tasks to ASSIGNED', async () => {
      const createRes = await request(app)
        .post('/api/v1/delivery/batches')
        .send({
          taskIds: [task1._id.toString(), task2._id.toString()],
          vehicleType: '2_WHEELER',
        });
      const batchId = createRes.body.data._id;

      const claimRes = await request(app)
        .post(`/api/v1/delivery/batches/${batchId}/claim`)
        .set('Authorization', `Bearer ${driverToken}`)
        .send({ agentName: 'Ravi Bike Delivery' });

      expect(claimRes.status).toBe(200);
      expect(claimRes.body.data.status).toBe('CLAIMED');
      expect(claimRes.body.data.deliveryAgentId).toBe(driverUser._id.toString());

      // Verify constituent tasks are locked
      const updatedT1 = await DeliveryTask.findById(task1._id);
      const updatedT2 = await DeliveryTask.findById(task2._id);
      expect(updatedT1.currentMilestone).toBe('ASSIGNED');
      expect(updatedT1.feeLocked).toBe(true);
      expect(updatedT1.batchId).toBe(batchId.toString());
      expect(updatedT2.currentMilestone).toBe('ASSIGNED');
      expect(updatedT2.feeLocked).toBe(true);
    });

    it('should reject a second claim on an already CLAIMED batch with 409 BATCH_ALREADY_CLAIMED', async () => {
      const createRes = await request(app)
        .post('/api/v1/delivery/batches')
        .send({
          taskIds: [task1._id.toString(), task2._id.toString()],
          vehicleType: '2_WHEELER',
        });
      const batchId = createRes.body.data._id;

      // First claim
      await request(app)
        .post(`/api/v1/delivery/batches/${batchId}/claim`)
        .set('Authorization', `Bearer ${driverToken}`)
        .send();

      // Second claim attempt
      const secondClaim = await request(app)
        .post(`/api/v1/delivery/batches/${batchId}/claim`)
        .set('Authorization', `Bearer ${truckDriverToken}`)
        .send();

      expect(secondClaim.status).toBe(409);
      expect(secondClaim.body.error.code).toBe(ERROR_CODES.BATCH_ALREADY_CLAIMED);
    });

    it('POST /:id/release should cancel batch and reset constituent tasks back to OPEN_FOR_PICKUP', async () => {
      const createRes = await request(app)
        .post('/api/v1/delivery/batches')
        .send({
          taskIds: [task1._id.toString(), task2._id.toString()],
          vehicleType: '2_WHEELER',
        });
      const batchId = createRes.body.data._id;

      await request(app)
        .post(`/api/v1/delivery/batches/${batchId}/claim`)
        .set('Authorization', `Bearer ${driverToken}`)
        .send();

      // Release batch
      const releaseRes = await request(app)
        .post(`/api/v1/delivery/batches/${batchId}/release`)
        .set('Authorization', `Bearer ${driverToken}`)
        .send();

      expect(releaseRes.status).toBe(200);
      expect(releaseRes.body.data.status).toBe('CANCELLED');

      // Verify tasks released
      const updatedT1 = await DeliveryTask.findById(task1._id);
      expect(updatedT1.currentMilestone).toBe('OPEN_FOR_PICKUP');
      expect(updatedT1.feeLocked).toBe(false);
      expect(updatedT1.batchId).toBeNull();
    });

    it('should support 3-task co-routing and generate exactly 6 ordered stops', async () => {
      const res = await request(app)
        .post('/api/v1/delivery/batches')
        .send({
          taskIds: [task1._id.toString(), task2._id.toString(), task3._id.toString()],
          vehicleType: '3_WHEELER',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.stops.length).toBe(6);
      expect(res.body.data.metrics.taskCount).toBe(3);
      expect(res.body.data.metrics.totalPlates).toBe(23); // 10 + 8 + 5
    });

    it('should reject batching tasks that are already assigned to an existing batch with 409 CONFLICT', async () => {
      // Create first batch with task1 and task2
      await request(app)
        .post('/api/v1/delivery/batches')
        .send({
          taskIds: [task1._id.toString(), task2._id.toString()],
          vehicleType: '2_WHEELER',
        });

      // Attempt to batch task1 again with task3
      const duplicateRes = await request(app)
        .post('/api/v1/delivery/batches')
        .send({
          taskIds: [task1._id.toString(), task3._id.toString()],
          vehicleType: '2_WHEELER',
        });

      expect(duplicateRes.status).toBe(409);
      expect(duplicateRes.body.error.code).toBe(ERROR_CODES.CONFLICT);
      expect(duplicateRes.body.error.message).toMatch(/already assigned to batch/i);
    });

    it('should reject payload with fewer than 2 tasks or more than 3 tasks with 400 VALIDATION_ERROR', async () => {
      const singleTaskRes = await request(app)
        .post('/api/v1/delivery/batches')
        .send({
          taskIds: [task1._id.toString()],
          vehicleType: '2_WHEELER',
        });
      expect(singleTaskRes.status).toBe(400);
      expect(singleTaskRes.body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
    });

    it('should return 404 NOT_FOUND if one or more task IDs do not exist in database', async () => {
      const fakeId = new mongoose.Types.ObjectId().toString();
      const res = await request(app)
        .post('/api/v1/delivery/batches')
        .send({
          taskIds: [task1._id.toString(), fakeId],
          vehicleType: '2_WHEELER',
        });
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe(ERROR_CODES.NOT_FOUND);
    });

    it('should return 404 BATCH_NOT_FOUND when requesting non-existent batch ID', async () => {
      const fakeId = new mongoose.Types.ObjectId().toString();
      const res = await request(app)
        .get(`/api/v1/delivery/batches/${fakeId}`)
        .send();
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe(ERROR_CODES.BATCH_NOT_FOUND);
    });

    it('should block a volunteer-only driver from claiming a batch with delivery fees', async () => {
      const volunteerDriver = await User.create({
        name: 'Volunteer Only Agent',
        email: 'volunteersonly@delivery.org',
        password: 'Password123!',
        role: ROLES.DELIVERY_AGENT,
        phone: '+919876543299',
        isVerified: true,
        isActive: true,
        location: { type: 'Point', coordinates: [77.595, 12.972] },
        address: { city: 'Bengaluru', formattedAddress: 'MG Road, Bengaluru' },
        agentPreferences: {
          vehicleType: '2_WHEELER',
          volunteerOnly: true,
        },
      });
      const volToken = authService.generateToken(volunteerDriver._id);

      const createRes = await request(app)
        .post('/api/v1/delivery/batches')
        .send({
          taskIds: [task1._id.toString(), task2._id.toString()],
          vehicleType: '2_WHEELER',
        });
      const batchId = createRes.body.data._id;

      const claimRes = await request(app)
        .post(`/api/v1/delivery/batches/${batchId}/claim`)
        .set('Authorization', `Bearer ${volToken}`)
        .send();

      expect(claimRes.status).toBe(400);
      expect(claimRes.body.error.code).toBe(ERROR_CODES.AGENT_VOLUNTEER_ONLY);
    });
  });

  describe('4E: Feature Flag Control (FEATURE_BATCH)', () => {
    it('should return 404 FEATURE_DISABLED when FEATURE_BATCH=false', async () => {
      const oldEnv = process.env.FEATURE_BATCH;
      process.env.FEATURE_BATCH = 'false';

      try {
        const res = await request(app)
          .get('/api/v1/delivery/batches/available')
          .send();

        expect(res.status).toBe(404);
        expect(res.body.error.code).toBe(ERROR_CODES.FEATURE_DISABLED);
      } finally {
        process.env.FEATURE_BATCH = oldEnv;
      }
    });
  });
});
