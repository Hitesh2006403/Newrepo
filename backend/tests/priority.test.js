const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../app');
const User = require('../src/models/User');
const Donation = require('../src/models/Donation');
const RecipientRequirement = require('../src/models/RecipientRequirement');
const DeliveryTask = require('../src/models/DeliveryTask');
const Notification = require('../src/models/Notification');
const { ROLES } = require('../src/constants/roles');
const { DONATION_STATUS, REQUIREMENT_STATUS } = require('../src/constants/status');
const { PRIORITY, PRIORITY_WEIGHTS } = require('../src/constants/priority');
const authService = require('../src/services/authService');
const { notifyHighPriorityMatch } = require('../src/services/notificationService');

describe('Comprehensive User-Chosen Priority Feature Suite', () => {
  let donorUser, donorToken;
  let otherDonorUser, otherDonorToken;
  let recipientUser, recipientToken;
  let otherRecipientUser, otherRecipientToken;
  let agentUser, agentToken;
  let adminUser, adminToken;

  beforeEach(async () => {
    // 1. Donor 1
    donorUser = await User.create({
      name: 'Chef Alice Kitchen',
      email: 'alice@kitchen.org',
      password: 'Password123!',
      role: ROLES.DONOR,
      phone: '+919999000001',
      isVerified: true,
      isActive: true,
      location: { type: 'Point', coordinates: [77.5946, 12.9716] },
      address: { street: '12 Brigade Road', city: 'Bengaluru', formattedAddress: 'Brigade Rd, Bengaluru' },
    });
    donorToken = authService.generateToken(donorUser._id);

    // 2. Donor 2 (for IDOR tests)
    otherDonorUser = await User.create({
      name: 'Chef Bob Bakery',
      email: 'bob@bakery.org',
      password: 'Password123!',
      role: ROLES.DONOR,
      phone: '+919999000002',
      isVerified: true,
      isActive: true,
      location: { type: 'Point', coordinates: [77.6, 12.9] },
      address: { street: 'Indiranagar', city: 'Bengaluru', formattedAddress: 'Indiranagar, Bengaluru' },
    });
    otherDonorToken = authService.generateToken(otherDonorUser._id);

    // 3. Recipient 1
    recipientUser = await User.create({
      name: 'Sunshine Shelter',
      email: 'shelter@sunshine.org',
      password: 'Password123!',
      role: ROLES.RECIPIENT,
      phone: '+919999000003',
      isVerified: true,
      isActive: true,
      location: { type: 'Point', coordinates: [77.595, 12.972] },
      address: { street: '44 Richmond Road', city: 'Bengaluru', formattedAddress: 'Richmond Rd, Bengaluru' },
    });
    recipientToken = authService.generateToken(recipientUser._id);

    // 4. Recipient 2
    otherRecipientUser = await User.create({
      name: 'Hope NGO',
      email: 'hope@ngo.org',
      password: 'Password123!',
      role: ROLES.RECIPIENT,
      phone: '+919999000004',
      isVerified: true,
      isActive: true,
      location: { type: 'Point', coordinates: [77.61, 12.95] },
      address: { street: 'Koramangala', city: 'Bengaluru', formattedAddress: 'Koramangala, Bengaluru' },
    });
    otherRecipientToken = authService.generateToken(otherRecipientUser._id);

    // 5. Delivery Agent
    agentUser = await User.create({
      name: 'Rider Ramesh',
      email: 'ramesh@express.com',
      password: 'Password123!',
      role: ROLES.DELIVERY_AGENT,
      phone: '+919999000005',
      isVerified: true,
      isActive: true,
      location: { type: 'Point', coordinates: [77.59, 12.97] },
      address: { street: 'MG Road', city: 'Bengaluru', formattedAddress: 'MG Road, Bengaluru' },
    });
    agentToken = authService.generateToken(agentUser._id);

    // 6. Admin
    adminUser = await User.create({
      name: 'Central Admin',
      email: 'admin@ops.org',
      password: 'Password123!',
      role: ROLES.ADMIN,
      phone: '+919999000006',
      isVerified: true,
      isActive: true,
      location: { type: 'Point', coordinates: [77.59, 12.97] },
      address: { street: 'Central HQ', city: 'Bengaluru', formattedAddress: 'Central HQ, Bengaluru' },
    });
    adminToken = authService.generateToken(adminUser._id);
  });

  const createDonationPayload = (overrides = {}) => ({
    foodName: '50 Veg Meals',
    foodType: 'cooked_meals',
    dietaryType: 'vegetarian',
    totalQuantity: 50,
    unit: 'plates',
    cookedAt: new Date(Date.now() - 3600000).toISOString(),
    expiryAt: new Date(Date.now() + 6 * 3600000).toISOString(),
    safetyBufferMinutes: 60,
    pickupWindowStart: new Date(Date.now() + 1800000).toISOString(),
    pickupWindowEnd: new Date(Date.now() + 4 * 3600000).toISOString(),
    packagingType: 'sealed_containers',
    instructions: 'Ring back gate',
    photos: ['https://example.com/meal.jpg'],
    location: {
      type: 'Point',
      coordinates: [77.5946, 12.9716],
    },
    address: {
      street: '12 Brigade Road',
      city: 'Bengaluru',
      state: 'Karnataka',
      postalCode: '560025',
      formattedAddress: '12 Brigade Road, Bengaluru, Karnataka 560025',
    },
    ...overrides,
  });

  const createRequirementPayload = (overrides = {}) => ({
    title: 'Meals needed for residents',
    foodType: 'cooked_meals',
    quantityNeeded: 40,
    unit: 'plates',
    dietaryPreference: 'vegetarian',
    neededBy: new Date(Date.now() + 5 * 3600000).toISOString(),
    location: {
      type: 'Point',
      coordinates: [77.595, 12.972],
    },
    address: {
      city: 'Bengaluru',
      formattedAddress: 'Richmond Rd, Bengaluru',
    },
    ...overrides,
  });

  describe('1. Default Priority & Schema Validation', () => {
    it('should default donation priority to MEDIUM with priorityWeight 2 when omitted', async () => {
      const res = await request(app)
        .post('/api/v1/donations')
        .set('Authorization', `Bearer ${donorToken}`)
        .send(createDonationPayload());

      expect(res.status).toBe(201);
      expect(res.body.data.priority).toBe(PRIORITY.MEDIUM);
      expect(res.body.data.priorityWeight).toBe(2);
    });

    it('should default requirement priority to MEDIUM with priorityWeight 2 when omitted', async () => {
      const res = await request(app)
        .post('/api/v1/requirements')
        .set('Authorization', `Bearer ${recipientToken}`)
        .send(createRequirementPayload());

      expect(res.status).toBe(201);
      expect(res.body.data.priority).toBe(PRIORITY.MEDIUM);
      expect(res.body.data.priorityWeight).toBe(2);
    });

    it('should allow explicitly setting LOW or HIGH priority on donation creation', async () => {
      const res = await request(app)
        .post('/api/v1/donations')
        .set('Authorization', `Bearer ${donorToken}`)
        .send(createDonationPayload({ priority: PRIORITY.HIGH }));

      expect(res.status).toBe(201);
      expect(res.body.data.priority).toBe(PRIORITY.HIGH);
      expect(res.body.data.priorityWeight).toBe(3);
    });

    it('should reject invalid priority values with 400', async () => {
      const res = await request(app)
        .post('/api/v1/donations')
        .set('Authorization', `Bearer ${donorToken}`)
        .send(createDonationPayload({ priority: 'CRITICAL_URGENT' }));

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should reject mass assignment of priorityWeight from client', async () => {
      const res = await request(app)
        .post('/api/v1/donations')
        .set('Authorization', `Bearer ${donorToken}`)
        .send(createDonationPayload({ priority: PRIORITY.LOW, priorityWeight: 99 }));

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('2. Legacy Urgency Alias Compatibility on Requirements', () => {
    it('should accept legacy urgency CRITICAL and map to priority HIGH', async () => {
      const res = await request(app)
        .post('/api/v1/requirements')
        .set('Authorization', `Bearer ${recipientToken}`)
        .send(createRequirementPayload({ urgency: 'CRITICAL' }));

      expect(res.status).toBe(201);
      expect(res.body.data.priority).toBe(PRIORITY.HIGH);
      expect(res.body.data.urgency).toBe(PRIORITY.HIGH);
      expect(res.body.data.priorityWeight).toBe(3);
    });

    it('should return BOTH priority and urgency in all requirement responses', async () => {
      const res = await request(app)
        .post('/api/v1/requirements')
        .set('Authorization', `Bearer ${recipientToken}`)
        .send(createRequirementPayload({ priority: PRIORITY.MEDIUM }));

      expect(res.status).toBe(201);
      expect(res.body.data.priority).toBe(PRIORITY.MEDIUM);
      expect(res.body.data.urgency).toBe(PRIORITY.MEDIUM);
    });

    it('should prioritize priority over legacy urgency when both are passed in conflict', async () => {
      const res = await request(app)
        .post('/api/v1/requirements')
        .set('Authorization', `Bearer ${recipientToken}`)
        .send(createRequirementPayload({ priority: PRIORITY.LOW, urgency: 'HIGH' }));

      expect(res.status).toBe(201);
      expect(res.body.data.priority).toBe(PRIORITY.LOW);
      expect(res.body.data.urgency).toBe(PRIORITY.LOW);
    });
  });

  describe('3. Conditional Editing & IDOR Protection', () => {
    it('should allow owner to PATCH donation priority while AVAILABLE with no claims', async () => {
      const createRes = await request(app)
        .post('/api/v1/donations')
        .set('Authorization', `Bearer ${donorToken}`)
        .send(createDonationPayload({ priority: PRIORITY.LOW }));

      const donationId = createRes.body.data.id || createRes.body.data._id;

      const patchRes = await request(app)
        .patch(`/api/v1/donations/${donationId}`)
        .set('Authorization', `Bearer ${donorToken}`)
        .send({ priority: PRIORITY.HIGH });

      expect(patchRes.status).toBe(200);
      expect(patchRes.body.data.priority).toBe(PRIORITY.HIGH);
      expect(patchRes.body.data.priorityWeight).toBe(3);
    });

    it('should reject non-owner attempting to PATCH donation priority with 403 (IDOR)', async () => {
      const createRes = await request(app)
        .post('/api/v1/donations')
        .set('Authorization', `Bearer ${donorToken}`)
        .send(createDonationPayload());

      const donationId = createRes.body.data.id || createRes.body.data._id;

      const patchRes = await request(app)
        .patch(`/api/v1/donations/${donationId}`)
        .set('Authorization', `Bearer ${otherDonorToken}`)
        .send({ priority: PRIORITY.HIGH });

      expect(patchRes.status).toBe(403);
    });

    it('should allow owner to PATCH requirement priority while OPEN', async () => {
      const createRes = await request(app)
        .post('/api/v1/requirements')
        .set('Authorization', `Bearer ${recipientToken}`)
        .send(createRequirementPayload({ priority: PRIORITY.LOW }));

      const reqId = createRes.body.data._id || createRes.body.data.id;

      const patchRes = await request(app)
        .patch(`/api/v1/requirements/${reqId}`)
        .set('Authorization', `Bearer ${recipientToken}`)
        .send({ priority: PRIORITY.HIGH });

      expect(patchRes.status).toBe(200);
      expect(patchRes.body.data.priority).toBe(PRIORITY.HIGH);
      expect(patchRes.body.data.priorityWeight).toBe(3);
    });

    it('should reject non-owner attempting to PATCH requirement priority with 403 (IDOR)', async () => {
      const createRes = await request(app)
        .post('/api/v1/requirements')
        .set('Authorization', `Bearer ${recipientToken}`)
        .send(createRequirementPayload());

      const reqId = createRes.body.data._id || createRes.body.data.id;

      const patchRes = await request(app)
        .patch(`/api/v1/requirements/${reqId}`)
        .set('Authorization', `Bearer ${otherRecipientToken}`)
        .send({ priority: PRIORITY.HIGH });

      expect(patchRes.status).toBe(403);
    });

    it('should disallow PATCH on requirement when status is not OPEN', async () => {
      const requirement = await RecipientRequirement.create({
        recipientId: recipientUser._id,
        title: 'Fulfilled meals',
        foodType: 'cooked_meals',
        quantityNeeded: 20,
        unit: 'plates',
        dietaryPreference: 'any',
        neededBy: new Date(Date.now() + 3600000),
        status: REQUIREMENT_STATUS.FULFILLED,
        priority: PRIORITY.LOW,
        location: { type: 'Point', coordinates: [77.595, 12.972] },
        address: { city: 'Bengaluru', formattedAddress: 'Richmond Rd, Bengaluru' },
      });

      const patchRes = await request(app)
        .patch(`/api/v1/requirements/${requirement._id}`)
        .set('Authorization', `Bearer ${recipientToken}`)
        .send({ priority: PRIORITY.HIGH });

      expect([400, 409]).toContain(patchRes.status);
    });
  });

  describe('4. List Filtering and Numeric Sorting', () => {
    beforeEach(async () => {
      // Seed 3 donations with distinct priorities
      await Donation.create({
        donorId: donorUser._id,
        foodName: 'Low Priority Soup',
        foodType: 'cooked_meals',
        dietaryType: 'vegetarian',
        totalQuantity: 20,
        remainingQuantity: 20,
        unit: 'plates',
        cookedAt: new Date(Date.now() - 3600000),
        expiryAt: new Date(Date.now() + 5 * 3600000),
        safetyBufferMinutes: 60,
        pickupWindowStart: new Date(Date.now() + 1800000),
        pickupWindowEnd: new Date(Date.now() + 3 * 3600000),
        packagingType: 'sealed_containers',
        instructions: 'None',
        location: donorUser.location,
        address: donorUser.address,
        status: DONATION_STATUS.AVAILABLE,
        priority: PRIORITY.LOW,
        priorityWeight: 1,
      });

      await Donation.create({
        donorId: donorUser._id,
        foodName: 'Medium Priority Rice',
        foodType: 'cooked_meals',
        dietaryType: 'vegetarian',
        totalQuantity: 30,
        remainingQuantity: 30,
        unit: 'plates',
        cookedAt: new Date(Date.now() - 3600000),
        expiryAt: new Date(Date.now() + 6 * 3600000),
        safetyBufferMinutes: 60,
        pickupWindowStart: new Date(Date.now() + 1800000),
        pickupWindowEnd: new Date(Date.now() + 4 * 3600000),
        packagingType: 'sealed_containers',
        instructions: 'None',
        location: donorUser.location,
        address: donorUser.address,
        status: DONATION_STATUS.AVAILABLE,
        priority: PRIORITY.MEDIUM,
        priorityWeight: 2,
      });

      await Donation.create({
        donorId: donorUser._id,
        foodName: 'High Priority Curry',
        foodType: 'cooked_meals',
        dietaryType: 'vegetarian',
        totalQuantity: 40,
        remainingQuantity: 40,
        unit: 'plates',
        cookedAt: new Date(Date.now() - 3600000),
        expiryAt: new Date(Date.now() + 4 * 3600000),
        safetyBufferMinutes: 60,
        pickupWindowStart: new Date(Date.now() + 1800000),
        pickupWindowEnd: new Date(Date.now() + 2 * 3600000),
        packagingType: 'sealed_containers',
        instructions: 'None',
        location: donorUser.location,
        address: donorUser.address,
        status: DONATION_STATUS.AVAILABLE,
        priority: PRIORITY.HIGH,
        priorityWeight: 3,
      });
    });

    it('should filter donations by single priority ?priority=HIGH', async () => {
      const res = await request(app)
        .get('/api/v1/donations?priority=HIGH')
        .set('Authorization', `Bearer ${donorToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].foodName).toBe('High Priority Curry');
    });

    it('should filter donations by multi-select priority ?priority=HIGH,LOW', async () => {
      const res = await request(app)
        .get('/api/v1/donations?priority=HIGH,LOW')
        .set('Authorization', `Bearer ${donorToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(2);
      const names = res.body.data.map((d) => d.foodName);
      expect(names).toContain('High Priority Curry');
      expect(names).toContain('Low Priority Soup');
      expect(names).not.toContain('Medium Priority Rice');
    });

    it('should sort donations by numeric priorityWeight (HIGH > MEDIUM > LOW) with ?sort=priority_desc', async () => {
      const res = await request(app)
        .get('/api/v1/donations?sort=priority_desc')
        .set('Authorization', `Bearer ${donorToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(3);
      expect(res.body.data[0].priority).toBe(PRIORITY.HIGH);
      expect(res.body.data[1].priority).toBe(PRIORITY.MEDIUM);
      expect(res.body.data[2].priority).toBe(PRIORITY.LOW);
    });

    it('should sort donations ascending by numeric priorityWeight with ?sort=priority_asc', async () => {
      const res = await request(app)
        .get('/api/v1/donations?sort=priority_asc')
        .set('Authorization', `Bearer ${donorToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data[0].priority).toBe(PRIORITY.LOW);
      expect(res.body.data[1].priority).toBe(PRIORITY.MEDIUM);
      expect(res.body.data[2].priority).toBe(PRIORITY.HIGH);
    });

    it('should reject invalid sort values with 400', async () => {
      const res = await request(app)
        .get('/api/v1/donations?sort=alphabetical_hack')
        .set('Authorization', `Bearer ${donorToken}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should reject NoSQL injection attempts in priority filter with 400', async () => {
      const res = await request(app)
        .get('/api/v1/donations?priority[$ne]=LOW')
        .set('Authorization', `Bearer ${donorToken}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('5. Explainable Smart Match Score with Priority Boost', () => {
    it('should calculate priorityBoost (+6 for HIGH donation + HIGH requirement) and include in breakdown', async () => {
      // 1. Create HIGH donation
      await Donation.create({
        donorId: donorUser._id,
        foodName: '50 Hot Meals',
        foodType: 'cooked_meals',
        dietaryType: 'vegetarian',
        totalQuantity: 50,
        remainingQuantity: 50,
        unit: 'plates',
        cookedAt: new Date(Date.now() - 3600000),
        expiryAt: new Date(Date.now() + 5 * 3600000),
        safetyBufferMinutes: 60,
        pickupWindowStart: new Date(Date.now() + 1800000),
        pickupWindowEnd: new Date(Date.now() + 3 * 3600000),
        packagingType: 'sealed_containers',
        instructions: 'None',
        location: donorUser.location,
        address: donorUser.address,
        status: DONATION_STATUS.AVAILABLE,
        priority: PRIORITY.HIGH,
        priorityWeight: 3,
      });

      // 2. Create HIGH requirement
      const requirement = await RecipientRequirement.create({
        recipientId: recipientUser._id,
        title: 'Urgent Evening Meals',
        foodType: 'cooked_meals',
        quantityNeeded: 50,
        unit: 'plates',
        dietaryPreference: 'vegetarian',
        neededBy: new Date(Date.now() + 4 * 3600000),
        location: recipientUser.location,
        address: recipientUser.address,
        status: REQUIREMENT_STATUS.OPEN,
        priority: PRIORITY.HIGH,
        priorityWeight: 3,
      });

      const res = await request(app)
        .get(`/api/v1/requirements/${requirement._id}/matches`)
        .set('Authorization', `Bearer ${recipientToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThan(0);
      const match = res.body.data[0];
      expect(match.scoreBreakdown.priorityBoost).toBe(6);
      expect(match.donation.priority).toBe(PRIORITY.HIGH);
    });

    it('should strictly exclude expired donations regardless of HIGH priority', async () => {
      // Create expired HIGH donation
      await Donation.create({
        donorId: donorUser._id,
        foodName: 'Expired Gourmet Buffet',
        foodType: 'cooked_meals',
        dietaryType: 'vegetarian',
        totalQuantity: 50,
        remainingQuantity: 50,
        unit: 'plates',
        cookedAt: new Date(Date.now() - 10 * 3600000),
        expiryAt: new Date(Date.now() - 3600000), // In the past
        safetyBufferMinutes: 60,
        pickupWindowStart: new Date(Date.now() - 8 * 3600000),
        pickupWindowEnd: new Date(Date.now() - 2 * 3600000),
        packagingType: 'sealed_containers',
        instructions: 'None',
        location: donorUser.location,
        address: donorUser.address,
        status: DONATION_STATUS.AVAILABLE,
        priority: PRIORITY.HIGH,
        priorityWeight: 3,
      });

      const requirement = await RecipientRequirement.create({
        recipientId: recipientUser._id,
        title: 'Shelter dinner',
        foodType: 'cooked_meals',
        quantityNeeded: 50,
        unit: 'plates',
        dietaryPreference: 'vegetarian',
        neededBy: new Date(Date.now() + 4 * 3600000),
        location: recipientUser.location,
        address: recipientUser.address,
        status: REQUIREMENT_STATUS.OPEN,
        priority: PRIORITY.HIGH,
      });

      const res = await request(app)
        .get(`/api/v1/requirements/${requirement._id}/matches`)
        .set('Authorization', `Bearer ${recipientToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(0);
    });
  });

  describe('6. High-Priority Notifications & Privacy', () => {
    it('should create deduplicated notifications for matching HIGH requirements without exact address or phone', async () => {
      // 1. Recipient with HIGH open requirement for cooked_meals
      await RecipientRequirement.create({
        recipientId: recipientUser._id,
        title: 'Shelter dinner urgent',
        foodType: 'cooked_meals',
        quantityNeeded: 30,
        unit: 'plates',
        dietaryPreference: 'vegetarian',
        neededBy: new Date(Date.now() + 4 * 3600000),
        status: REQUIREMENT_STATUS.OPEN,
        priority: PRIORITY.HIGH,
        location: { type: 'Point', coordinates: [77.595, 12.972] },
        address: { city: 'Bengaluru', formattedAddress: 'Richmond Rd, Bengaluru' },
      });

      // 2. High priority donation
      const donation = {
        _id: new mongoose.Types.ObjectId(),
        foodName: '40 Biryani Boxes',
        foodType: 'cooked_meals',
        remainingQuantity: 40,
        unit: 'plates',
        areaLabel: 'Indiranagar Hub, Bengaluru',
        priority: PRIORITY.HIGH,
      };

      const count = await notifyHighPriorityMatch(donation);
      expect(count).toBe(1);

      // Check notification document
      const notifications = await Notification.find({ userId: recipientUser._id });
      expect(notifications.length).toBe(1);
      const notification = notifications[0];
      expect(notification.title).toContain('High Priority');
      // Assert privacy: does not leak phone number or specific coordinates
      expect(notification.message).not.toContain('+91');
      expect(notification.message).not.toContain('coordinates');
    });
  });

  describe('7. Dashboard countsPerPriority', () => {
    it('should return countsPerPriority in donor dashboard', async () => {
      await Donation.create({
        donorId: donorUser._id,
        foodName: 'High Meal',
        foodType: 'cooked_meals',
        dietaryType: 'vegetarian',
        totalQuantity: 10,
        remainingQuantity: 10,
        unit: 'plates',
        cookedAt: new Date(Date.now() - 3600000),
        expiryAt: new Date(Date.now() + 5 * 3600000),
        safetyBufferMinutes: 60,
        pickupWindowStart: new Date(Date.now() + 1800000),
        pickupWindowEnd: new Date(Date.now() + 3 * 3600000),
        packagingType: 'sealed_containers',
        instructions: 'None',
        location: donorUser.location,
        address: donorUser.address,
        status: DONATION_STATUS.AVAILABLE,
        priority: PRIORITY.HIGH,
      });

      const res = await request(app)
        .get('/api/v1/dashboard/donor')
        .set('Authorization', `Bearer ${donorToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.countsPerPriority).toBeDefined();
      expect(res.body.data.countsPerPriority.HIGH).toBe(1);
      expect(res.body.data.countsPerPriority.MEDIUM).toBe(0);
      expect(res.body.data.countsPerPriority.LOW).toBe(0);
    });

    it('should return countsPerPriority in recipient dashboard', async () => {
      await RecipientRequirement.create({
        recipientId: recipientUser._id,
        title: 'High Requirement',
        foodType: 'cooked_meals',
        quantityNeeded: 10,
        unit: 'plates',
        dietaryPreference: 'any',
        neededBy: new Date(Date.now() + 3600000),
        status: REQUIREMENT_STATUS.OPEN,
        priority: PRIORITY.HIGH,
        location: { type: 'Point', coordinates: [77.595, 12.972] },
        address: { city: 'Bengaluru', formattedAddress: 'Richmond Rd, Bengaluru' },
      });

      const res = await request(app)
        .get('/api/v1/dashboard/recipient')
        .set('Authorization', `Bearer ${recipientToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.countsPerPriority).toBeDefined();
      expect(res.body.data.countsPerPriority.HIGH).toBe(1);
    });
  });

  describe('8. GET /api/v1/meta', () => {
    it('should expose allowed priorities and numeric weights', async () => {
      const res = await request(app).get('/api/v1/meta');
      expect(res.status).toBe(200);
      expect(res.body.data.priorities).toBeDefined();
      const priorityValues = res.body.data.priorities.map((p) => (typeof p === 'string' ? p : p.value));
      expect(priorityValues).toContain('LOW');
      expect(priorityValues).toContain('MEDIUM');
      expect(priorityValues).toContain('HIGH');
      expect(res.body.data.priorityWeights).toEqual({ LOW: 1, MEDIUM: 2, HIGH: 3 });
      expect(res.body.data.defaultPriority).toBe('MEDIUM');
    });
  });
});
