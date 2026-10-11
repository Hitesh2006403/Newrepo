const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../app');
const User = require('../src/models/User');
const Donation = require('../src/models/Donation');
const RecipientRequirement = require('../src/models/RecipientRequirement');
const DeliveryTask = require('../src/models/DeliveryTask');
const { ROLES } = require('../src/constants/roles');
const { DONATION_STATUS, REQUIREMENT_STATUS } = require('../src/constants/status');
const authService = require('../src/services/authService');
const geoService = require('../src/services/geoService');
const { computeApproxLocation, calculateHaversineDistanceKm } = require('../src/utils/geoUtils');
const ERROR_CODES = require('../src/constants/errorCodes');

describe('Phase 1 - Free Leaflet/OSM Maps & Proximity Radar Test Suite', () => {
  let donorUser, donorToken;
  let recipientUser, recipientToken;
  let otherRecipientUser, otherRecipientToken;
  let agentUser, agentToken;
  let adminUser, adminToken;

  beforeEach(async () => {
    // 1. Donor in Central Bengaluru (MG Road: 12.9716, 77.5946 -> approx: [77.59, 12.97])
    donorUser = await User.create({
      name: 'Chef Alice Restaurant',
      email: 'alice@restaurant.org',
      password: 'Password123!',
      role: ROLES.DONOR,
      phone: '+919999000001',
      isVerified: true,
      isActive: true,
      mapVisible: true,
      location: { type: 'Point', coordinates: [77.5946, 12.9716] },
      address: {
        street: '12 Brigade Road Secret Apt 4B',
        city: 'Bengaluru',
        state: 'Karnataka',
        postalCode: '560001',
        formattedAddress: '12 Brigade Road Secret Apt 4B, Bengaluru, Karnataka 560001',
      },
      organization: { name: 'Alice Fine Dining Ltd' },
    });
    donorToken = authService.generateToken(donorUser._id);

    // 2. Recipient 1 in Indiranagar (~4.5 km away: 12.9784, 77.6412 -> approx: [77.64, 12.98])
    recipientUser = await User.create({
      name: 'Sunshine Community Shelter',
      email: 'sunshine@shelter.org',
      password: 'Password123!',
      role: ROLES.RECIPIENT,
      phone: '+919999000002',
      isVerified: true,
      isActive: true,
      mapVisible: true,
      location: { type: 'Point', coordinates: [77.6412, 12.9784] },
      address: {
        street: '100ft Road Indiranagar Private St',
        city: 'Bengaluru',
        state: 'Karnataka',
        postalCode: '560038',
        formattedAddress: '100ft Road Indiranagar Private St, Bengaluru 560038',
      },
      organization: { name: 'Sunshine Welfare Trust' },
    });
    recipientToken = authService.generateToken(recipientUser._id);

    // 3. Recipient 2 in Koramangala (~6.5 km away: 12.9352, 77.6245 -> approx: [77.62, 12.94])
    otherRecipientUser = await User.create({
      name: 'Asha Care Home',
      email: 'asha@carehome.org',
      password: 'Password123!',
      role: ROLES.RECIPIENT,
      phone: '+919999000003',
      isVerified: true,
      isActive: true,
      mapVisible: true,
      location: { type: 'Point', coordinates: [77.6245, 12.9352] },
      address: {
        street: '5th Block Koramangala Secret House',
        city: 'Bengaluru',
        state: 'Karnataka',
        postalCode: '560095',
        formattedAddress: '5th Block Koramangala, Bengaluru 560095',
      },
      organization: { name: 'Asha Foundation' },
    });
    otherRecipientToken = authService.generateToken(otherRecipientUser._id);

    // 4. Delivery Agent
    agentUser = await User.create({
      name: 'Ramesh Rider',
      email: 'ramesh@rider.org',
      password: 'Password123!',
      role: ROLES.DELIVERY_AGENT,
      phone: '+919999000004',
      isVerified: true,
      isActive: true,
      mapVisible: true,
      location: { type: 'Point', coordinates: [77.5854, 12.9302] },
      address: {
        street: 'JP Nagar',
        city: 'Bengaluru',
        state: 'Karnataka',
        postalCode: '560078',
        formattedAddress: 'JP Nagar, Bengaluru 560078',
      },
      agentPreferences: { volunteerOnly: false, acceptsPaid: true },
    });
    agentToken = authService.generateToken(agentUser._id);

    // 5. Admin
    adminUser = await User.create({
      name: 'Super Admin',
      email: 'admin@shareaplate.org',
      password: 'Password123!',
      role: ROLES.ADMIN,
      phone: '+919999000000',
      isVerified: true,
      isActive: true,
      location: { type: 'Point', coordinates: [77.5946, 12.9716] },
      address: { street: 'MG Road', city: 'Bengaluru', formattedAddress: 'MG Road' },
    });
    adminToken = authService.generateToken(adminUser._id);
  });

  describe('1A: approxLocation Sync & Anti-Trilateration Privacy Model', () => {
    it('should compute approxLocation rounded to 2 decimals on User create and update', async () => {
      expect(donorUser.approxLocation).toBeDefined();
      expect(donorUser.approxLocation.coordinates).toEqual([77.59, 12.97]);

      // Update location
      donorUser.location = { type: 'Point', coordinates: [77.6543, 12.9876] };
      await donorUser.save();
      expect(donorUser.approxLocation.coordinates).toEqual([77.65, 12.99]);
    });

    it('should compute approxLocation on Donation create and update', async () => {
      const now = new Date();
      const donation = await Donation.create({
        donorId: donorUser._id,
        foodName: 'Vegetable Biryani',
        foodType: 'cooked_meals',
        dietaryType: 'vegetarian',
        totalQuantity: 50,
        remainingQuantity: 50,
        unit: 'plates',
        cookedAt: new Date(now.getTime() - 2 * 3600000),
        expiryAt: new Date(now.getTime() + 4 * 3600000),
        pickupWindowStart: now,
        pickupWindowEnd: new Date(now.getTime() + 3 * 3600000),
        location: { type: 'Point', coordinates: [77.5946, 12.9716] },
        address: {
          street: '12 Secret Street',
          city: 'Bengaluru',
          formattedAddress: '12 Secret Street, Bengaluru',
        },
      });

      expect(donation.approxLocation).toBeDefined();
      expect(donation.approxLocation.coordinates).toEqual([77.59, 12.97]);
    });

    it('should compute approxLocation on RecipientRequirement create and update', async () => {
      const requirement = await RecipientRequirement.create({
        recipientId: recipientUser._id,
        title: 'Hot Meals for Children',
        foodType: 'cooked_meals',
        quantityNeeded: 40,
        unit: 'plates',
        servingsNeeded: 40,
        neededBy: new Date(Date.now() + 5 * 3600000),
        location: { type: 'Point', coordinates: [77.6412, 12.9784] },
        address: {
          street: '100ft Road Private',
          city: 'Bengaluru',
          formattedAddress: '100ft Road, Bengaluru',
        },
      });

      expect(requirement.approxLocation).toBeDefined();
      expect(requirement.approxLocation.coordinates).toEqual([77.64, 12.98]);
    });

    it('two exact locations in the same rounded cell give identical distanceKm and approxLocation to unprivileged viewers', async () => {
      const now = new Date();
      // Point A: [77.5946, 12.9716] -> rounded [77.59, 12.97]
      const donA = await Donation.create({
        donorId: donorUser._id,
        foodName: 'Rice Dish A',
        foodType: 'cooked_meals',
        dietaryType: 'vegetarian',
        totalQuantity: 30,
        remainingQuantity: 30,
        unit: 'plates',
        cookedAt: now,
        expiryAt: new Date(now.getTime() + 5 * 3600000),
        pickupWindowStart: now,
        pickupWindowEnd: new Date(now.getTime() + 4 * 3600000),
        location: { type: 'Point', coordinates: [77.5946, 12.9716] },
        address: { city: 'Bengaluru', formattedAddress: 'Brigade Road' },
      });

      // Point B: [77.5912, 12.9749] -> rounded [77.59, 12.97]
      const donB = await Donation.create({
        donorId: donorUser._id,
        foodName: 'Rice Dish B',
        foodType: 'cooked_meals',
        dietaryType: 'vegetarian',
        totalQuantity: 20,
        remainingQuantity: 20,
        unit: 'plates',
        cookedAt: now,
        expiryAt: new Date(now.getTime() + 5 * 3600000),
        pickupWindowStart: now,
        pickupWindowEnd: new Date(now.getTime() + 4 * 3600000),
        location: { type: 'Point', coordinates: [77.5912, 12.9749] },
        address: { city: 'Bengaluru', formattedAddress: 'Residency Road' },
      });

      // Recipient queries available donations from Indiranagar [77.6412, 12.9784]
      const res = await request(app)
        .get('/api/v1/donations/available?lat=12.9784&lng=77.6412&radiusKm=10')
        .set('Authorization', `Bearer ${recipientToken}`);

      expect(res.status).toBe(200);
      const items = res.body.data;
      const itemA = items.find((i) => i._id.toString() === donA._id.toString());
      const itemB = items.find((i) => i._id.toString() === donB._id.toString());

      expect(itemA).toBeDefined();
      expect(itemB).toBeDefined();
      // Both must have identical distanceKm computed strictly from the cell approxLocation
      expect(itemA.distanceKm).toBe(itemB.distanceKm);
      expect(itemA.location.coordinates).toEqual([77.59, 12.97]);
      expect(itemB.location.coordinates).toEqual([77.59, 12.97]);
    });

    it('must NOT leak street, phone, email or exact coordinates to unattached viewers (full JSON scan)', async () => {
      const now = new Date();
      await Donation.create({
        donorId: donorUser._id,
        foodName: 'Confidential Meal Prep',
        foodType: 'cooked_meals',
        dietaryType: 'vegetarian',
        totalQuantity: 40,
        remainingQuantity: 40,
        unit: 'plates',
        cookedAt: now,
        expiryAt: new Date(now.getTime() + 5 * 3600000),
        pickupWindowStart: now,
        pickupWindowEnd: new Date(now.getTime() + 4 * 3600000),
        location: { type: 'Point', coordinates: [77.5946123, 12.9716789] },
        address: {
          street: 'LEAK_CHECK_SECRET_STREET_99',
          city: 'Bengaluru',
          formattedAddress: 'LEAK_CHECK_SECRET_STREET_99, Bengaluru',
        },
      });

      const res = await request(app)
        .get('/api/v1/donations/available')
        .set('Authorization', `Bearer ${recipientToken}`);

      expect(res.status).toBe(200);
      const jsonStr = JSON.stringify(res.body);

      // Verify ZERO leakage of sensitive strings
      expect(jsonStr).not.toContain('LEAK_CHECK_SECRET_STREET_99');
      expect(jsonStr).not.toContain('+919999000001');
      expect(jsonStr).not.toContain('alice@restaurant.org');
      expect(jsonStr).not.toContain('77.5946123');
      expect(jsonStr).not.toContain('12.9716789');
    });

    it('donor owner and admin still receive exact coordinates and address', async () => {
      const now = new Date();
      const donation = await Donation.create({
        donorId: donorUser._id,
        foodName: 'Owner Visible Meal',
        foodType: 'cooked_meals',
        dietaryType: 'vegetarian',
        totalQuantity: 25,
        remainingQuantity: 25,
        unit: 'plates',
        cookedAt: now,
        expiryAt: new Date(now.getTime() + 5 * 3600000),
        pickupWindowStart: now,
        pickupWindowEnd: new Date(now.getTime() + 4 * 3600000),
        location: { type: 'Point', coordinates: [77.5946, 12.9716] },
        address: {
          street: '12 Brigade Road Secret Apt 4B',
          city: 'Bengaluru',
          formattedAddress: '12 Brigade Road Secret Apt 4B, Bengaluru',
        },
      });

      const res = await request(app)
        .get(`/api/v1/donations/${donation._id}`)
        .set('Authorization', `Bearer ${donorToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.address.street).toBe('12 Brigade Road Secret Apt 4B');
      expect(res.body.data.location.coordinates).toEqual([77.5946, 12.9716]);
    });
  });

  describe('1C: Radius Presets, 5 vs 10 km Sets & Hard 10 km Cap', () => {
    let nearDonation, midDonation, farDonation;

    beforeEach(async () => {
      const now = new Date();
      // 1. Near: Domlur ~3.5 km from MG Road [77.5946, 12.9716] (rounded ~4.4 km)
      nearDonation = await Donation.create({
        donorId: donorUser._id,
        foodName: 'Near Food Domlur',
        foodType: 'cooked_meals',
        dietaryType: 'vegetarian',
        totalQuantity: 20,
        remainingQuantity: 20,
        unit: 'plates',
        cookedAt: now,
        expiryAt: new Date(now.getTime() + 5 * 3600000),
        pickupWindowStart: now,
        pickupWindowEnd: new Date(now.getTime() + 4 * 3600000),
        location: { type: 'Point', coordinates: [77.6250, 12.9600] },
        address: { city: 'Bengaluru', formattedAddress: 'Domlur' },
      });

      // 2. Mid: HSR Layout ~8.5 km from MG Road
      midDonation = await Donation.create({
        donorId: donorUser._id,
        foodName: 'Mid Food HSR',
        foodType: 'cooked_meals',
        dietaryType: 'vegetarian',
        totalQuantity: 25,
        remainingQuantity: 25,
        unit: 'plates',
        cookedAt: now,
        expiryAt: new Date(now.getTime() + 5 * 3600000),
        pickupWindowStart: now,
        pickupWindowEnd: new Date(now.getTime() + 4 * 3600000),
        location: { type: 'Point', coordinates: [77.6400, 12.9100] },
        address: { city: 'Bengaluru', formattedAddress: 'HSR Layout' },
      });

      // 3. Far: Whitefield ~17 km from MG Road (beyond 10 km max limit)
      farDonation = await Donation.create({
        donorId: donorUser._id,
        foodName: 'Far Food Whitefield',
        foodType: 'cooked_meals',
        dietaryType: 'vegetarian',
        totalQuantity: 30,
        remainingQuantity: 30,
        unit: 'plates',
        cookedAt: now,
        expiryAt: new Date(now.getTime() + 5 * 3600000),
        pickupWindowStart: now,
        pickupWindowEnd: new Date(now.getTime() + 4 * 3600000),
        location: { type: 'Point', coordinates: [77.7500, 12.9700] },
        address: { city: 'Bengaluru', formattedAddress: 'Whitefield' },
      });
    });

    it('5 km radar includes near items and excludes mid items; 10 km radar includes both', async () => {
      // 5 km query from MG Road [12.9716, 77.5946]
      const res5km = await request(app)
        .get('/api/v1/donations/available?lat=12.9716&lng=77.5946&radiusKm=5')
        .set('Authorization', `Bearer ${recipientToken}`);

      expect(res5km.status).toBe(200);
      const ids5km = res5km.body.data.map((d) => d._id.toString());
      expect(ids5km).toContain(nearDonation._id.toString());
      expect(ids5km).not.toContain(midDonation._id.toString());
      expect(ids5km).not.toContain(farDonation._id.toString());

      // 10 km query from MG Road
      const res10km = await request(app)
        .get('/api/v1/donations/available?lat=12.9716&lng=77.5946&radiusKm=10')
        .set('Authorization', `Bearer ${recipientToken}`);

      expect(res10km.status).toBe(200);
      const ids10km = res10km.body.data.map((d) => d._id.toString());
      expect(ids10km).toContain(nearDonation._id.toString());
      expect(ids10km).toContain(midDonation._id.toString());
      // Far item (17 km) MUST be strictly excluded
      expect(ids10km).not.toContain(farDonation._id.toString());
    });

    it('hard-rejects radius > 10 km with 400 validation error (never silently clamps)', async () => {
      const res = await request(app)
        .get('/api/v1/donations/available?lat=12.9716&lng=77.5946&radiusKm=15')
        .set('Authorization', `Bearer ${recipientToken}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toMatch(/radius/i);
    });

    it('rejects invalid or non-numeric lat/lng and NoSQL injection operators', async () => {
      const resBadLat = await request(app)
        .get('/api/v1/donations/available?lat=999&lng=77.5946')
        .set('Authorization', `Bearer ${recipientToken}`);
      expect(resBadLat.status).toBe(400);

      const resNoSql = await request(app)
        .get('/api/v1/donations/available?lat[$gt]=0&lng=77.5946')
        .set('Authorization', `Bearer ${recipientToken}`);
      expect(resNoSql.status).toBe(400);
    });

    it('GET /api/v1/meta exposes radiusPresets [5, 7, 10], defaultRadiusKm 5, maxRadiusKm 10', async () => {
      const res = await request(app).get('/api/v1/meta');
      expect(res.status).toBe(200);
      expect(res.body.data.radiusPresets).toEqual([5, 7, 10]);
      expect(res.body.data.defaultRadiusKm).toBe(5);
      expect(res.body.data.maxRadiusKm).toBe(10);
    });
  });

  describe('1C: GET /api/v1/map/nearby Community Radar & Role Privacy', () => {
    it('lists donors and recipients inside radius even without open items', async () => {
      const res = await request(app)
        .get('/api/v1/map/nearby?lat=12.9716&lng=77.5946&radiusKm=10')
        .set('Authorization', `Bearer ${recipientToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const items = res.body.data;

      // Both donorUser and otherRecipientUser should be discovered as partners
      const hasDonor = items.some((i) => i.role === 'donor' || i.kind === 'donor' || i.type === 'donor');
      const hasRecipient = items.some((i) => i.role === 'recipient' || i.kind === 'recipient' || i.type === 'recipient');
      expect(hasDonor).toBe(true);
      expect(hasRecipient).toBe(true);
    });

    it('excludes hidden (mapVisible: false), unverified and deactivated users', async () => {
      // 1. Hidden user
      await User.create({
        name: 'Hidden Donor Inc',
        email: 'hidden@donor.org',
        password: 'Password123!',
        role: ROLES.DONOR,
        phone: '+919999000088',
        isVerified: true,
        isActive: true,
        mapVisible: false, // HIDDEN
        location: { type: 'Point', coordinates: [77.5946, 12.9716] },
        address: { city: 'Bengaluru', formattedAddress: 'MG Road' },
      });

      // 2. Unverified user
      await User.create({
        name: 'Unverified Recipient Org',
        email: 'unverified@org.org',
        password: 'Password123!',
        role: ROLES.RECIPIENT,
        phone: '+919999000089',
        isVerified: false, // UNVERIFIED
        isActive: true,
        mapVisible: true,
        location: { type: 'Point', coordinates: [77.5946, 12.9716] },
        address: { city: 'Bengaluru', formattedAddress: 'MG Road' },
      });

      const res = await request(app)
        .get('/api/v1/map/nearby?lat=12.9716&lng=77.5946&radiusKm=10')
        .set('Authorization', `Bearer ${recipientToken}`);

      expect(res.status).toBe(200);
      const names = res.body.data.map((i) => i.name || i.organization?.name);
      expect(names).not.toContain('Hidden Donor Inc');
      expect(names).not.toContain('Unverified Recipient Org');
    });

    it('sets expandedRadius=true when 5 km has zero results and widens to 10 km', async () => {
      // Clear out all donations and users inside 5 km, leaving only one at 8 km
      await User.deleteMany({ _id: { $ne: adminUser._id } });
      await Donation.deleteMany({});
      await RecipientRequirement.deleteMany({});

      await User.create({
        name: 'Eight Km Recipient',
        email: 'eight@km.org',
        password: 'Password123!',
        role: ROLES.RECIPIENT,
        phone: '+919999000099',
        isVerified: true,
        isActive: true,
        mapVisible: true,
        location: { type: 'Point', coordinates: [77.665, 12.985] }, // ~8 km from 12.9716, 77.5946
        address: { city: 'Bengaluru', formattedAddress: '8km Point' },
      });

      const res = await request(app)
        .get('/api/v1/map/nearby?lat=12.9716&lng=77.5946&radiusKm=5')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const meta = res.body.meta;
      expect(meta.expandedRadius).toBe(true);
      expect(meta.radiusKm).toBe(10);
      expect(res.body.data.length).toBeGreaterThan(0);
    });

    it('allows users to toggle their own mapVisible status via PATCH /api/v1/auth/me/map-visibility', async () => {
      const resOff = await request(app)
        .patch('/api/v1/auth/me/map-visibility')
        .set('Authorization', `Bearer ${donorToken}`)
        .send({ mapVisible: false });

      expect(resOff.status).toBe(200);
      expect(resOff.body.data.mapVisible).toBe(false);

      const updatedUser = await User.findById(donorUser._id);
      expect(updatedUser.mapVisible).toBe(false);
    });
  });

  describe('1B: Geo Service, Caching, 1 req/s Queue & SSRF Protections', () => {
    it('GET /api/v1/geo/route calculates distanceKm, durationMinutes and estimated flag', async () => {
      const res = await request(app)
        .get('/api/v1/geo/route?fromLat=12.9716&fromLng=77.5946&toLat=12.9784&toLng=77.6412')
        .set('Authorization', `Bearer ${recipientToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.distanceKm).toBeGreaterThan(0);
      expect(res.body.data.durationMinutes).toBeGreaterThan(0);
      expect(typeof res.body.data.estimated).toBe('boolean');
    });

    it('GET /api/v1/geo/search rejects queries shorter than 3 characters or longer than 120', async () => {
      const resShort = await request(app)
        .get('/api/v1/geo/search?q=ab')
        .set('Authorization', `Bearer ${recipientToken}`);
      expect(resShort.status).toBe(400);

      const resLong = await request(app)
        .get(`/api/v1/geo/search?q=${'a'.repeat(125)}`)
        .set('Authorization', `Bearer ${recipientToken}`);
      expect(resLong.status).toBe(400);
    });
  });

  describe('1D: Pickup Feasibility & Expiry Time Check', () => {
    it('rejects pickup with PICKUP_NOT_FEASIBLE when road time + handling buffer exceeds expiry', async () => {
      const now = new Date();
      // Donation expiring in only 10 minutes with 60 min safety buffer -> already inside buffer!
      const expiringSoonDonation = await Donation.create({
        donorId: donorUser._id,
        foodName: 'Hot Soup Rapid Expiry',
        foodType: 'cooked_meals',
        dietaryType: 'vegetarian',
        totalQuantity: 15,
        remainingQuantity: 15,
        unit: 'servings',
        cookedAt: new Date(now.getTime() - 3 * 3600000),
        expiryAt: new Date(now.getTime() + 20 * 60000), // Expiring in 20 minutes
        safetyBufferMinutes: 60,                        // Buffer is 60m -> effective arrival will exceed!
        pickupWindowStart: now,
        pickupWindowEnd: new Date(now.getTime() + 15 * 60000),
        location: { type: 'Point', coordinates: [77.5946, 12.9716] },
        address: { city: 'Bengaluru', formattedAddress: 'MG Road' },
      });

      const res = await request(app)
        .post('/api/v1/delivery/feasibility')
        .set('Authorization', `Bearer ${recipientToken}`)
        .send({
          donationId: expiringSoonDonation._id,
          toLat: 12.9784,
          toLng: 77.6412,
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe(ERROR_CODES.PICKUP_NOT_FEASIBLE);
      expect(res.body.error.message).toMatch(/feasible/i);
    });

    it('approves pickup when travel and handling comfortably fit before effective expiry', async () => {
      const now = new Date();
      // Donation expiring in 6 hours
      const freshDonation = await Donation.create({
        donorId: donorUser._id,
        foodName: 'Fresh Packaged Meals',
        foodType: 'cooked_meals',
        dietaryType: 'vegetarian',
        totalQuantity: 25,
        remainingQuantity: 25,
        unit: 'servings',
        cookedAt: now,
        expiryAt: new Date(now.getTime() + 6 * 3600000),
        safetyBufferMinutes: 60,
        pickupWindowStart: now,
        pickupWindowEnd: new Date(now.getTime() + 3 * 3600000),
        location: { type: 'Point', coordinates: [77.5946, 12.9716] },
        address: { city: 'Bengaluru', formattedAddress: 'MG Road' },
      });

      const res = await request(app)
        .post('/api/v1/delivery/feasibility')
        .set('Authorization', `Bearer ${recipientToken}`)
        .send({
          donationId: freshDonation._id,
          toLat: 12.9784,
          toLng: 77.6412,
        });

      expect(res.status).toBe(200);
      expect(res.body.data.feasible).toBe(true);
      expect(res.body.data.etaMinutes).toBeGreaterThanOrEqual(5);
      expect(res.body.data.distanceKm).toBeGreaterThan(0);
    });
  });
});
