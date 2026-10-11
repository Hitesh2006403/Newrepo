const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../app');
const User = require('../src/models/User');
const Donation = require('../src/models/Donation');
const RecipientRequirement = require('../src/models/RecipientRequirement');
const DeliveryTask = require('../src/models/DeliveryTask');
const { ROLES } = require('../src/constants/roles');
const { DONATION_STATUS, ACCEPTANCE_STATUS, REQUIREMENT_STATUS } = require('../src/constants/status');
const { MATCH_WEIGHTS, QUANTITY_TIERS, ALLOT_MODES, OFFER_STATUS, MATCH_CONFIG } = require('../src/constants/matching');
const authService = require('../src/services/authService');
const matchingService = require('../src/services/matchingService');
const ERROR_CODES = require('../src/constants/errorCodes');

describe('Phase 3 - Smart Match, Auto-Allot Nearest Best-Fit, Split, and Reject-then-Reopen', () => {
  let donorUser, donorToken;
  let recipientNear, recipientNearToken;
  let recipientFar, recipientFarToken;
  let testDonation;
  let testReqNear, testReqFar;

  beforeEach(async () => {
    // 1. Donor (MG Road, Bengaluru: 77.5946, 12.9716)
    donorUser = await User.create({
      name: 'Central Bengaluru Kitchen',
      email: 'central@donor.org',
      password: 'Password123!',
      role: ROLES.DONOR,
      phone: '+919876543210',
      isVerified: true,
      isActive: true,
      mapVisible: true,
      location: { type: 'Point', coordinates: [77.5946, 12.9716] },
      address: { city: 'Bengaluru', formattedAddress: 'MG Road, Bengaluru' },
    });
    donorToken = authService.generateToken(donorUser._id);

    // 2. Near Recipient (Indiranagar: 3.9 km away, inside Ring 1)
    recipientNear = await User.create({
      name: 'Indiranagar Care Home',
      email: 'indiranagar@recipient.org',
      password: 'Password123!',
      role: ROLES.RECIPIENT,
      phone: '+919876543211',
      isVerified: true,
      isActive: true,
      mapVisible: true,
      ratingAverage: 4.8,
      location: { type: 'Point', coordinates: [77.6300, 12.9750] },
      address: { city: 'Bengaluru', formattedAddress: '100ft Road, Indiranagar' },
    });
    recipientNearToken = authService.generateToken(recipientNear._id);

    // 3. Far Recipient (Whitefield: 7.6 km away, inside Ring 2)
    recipientFar = await User.create({
      name: 'Whitefield Community Shelter',
      email: 'whitefield@recipient.org',
      password: 'Password123!',
      role: ROLES.RECIPIENT,
      phone: '+919876543212',
      isVerified: true,
      isActive: true,
      mapVisible: true,
      ratingAverage: 4.5,
      location: { type: 'Point', coordinates: [77.6650, 12.9750] },
      address: { city: 'Bengaluru', formattedAddress: 'Whitefield, Bengaluru' },
    });
    recipientFarToken = authService.generateToken(recipientFar._id);

    const now = new Date();
    // Donation: 30 meals, expires in 8 hours (well outside 60-min safety buffer)
    testDonation = await Donation.create({
      donorId: donorUser._id,
      foodName: 'Vegetable Biryani Pots',
      foodType: 'cooked_meals',
      dietaryType: 'vegetarian',
      totalQuantity: 30,
      remainingQuantity: 30,
      unit: 'plates',
      priority: 'HIGH',
      cookedAt: new Date(now.getTime() - 3600000),
      expiryAt: new Date(now.getTime() + 8 * 3600000),
      safetyBufferMinutes: 60,
      pickupWindowStart: new Date(now.getTime() + 1800000),
      pickupWindowEnd: new Date(now.getTime() + 4 * 3600000),
      location: { type: 'Point', coordinates: [77.5946, 12.9716] },
      address: { city: 'Bengaluru', formattedAddress: 'MG Road, Bengaluru' },
      status: DONATION_STATUS.AVAILABLE,
      allotMode: 'MANUAL',
    });

    // Requirement 1: Near recipient needs 30 plates (Tier 1 Exact match inside Ring 1)
    testReqNear = await RecipientRequirement.create({
      recipientId: recipientNear._id,
      title: 'Lunch for 30 residents',
      foodType: 'cooked_meals',
      dietaryPreference: 'vegetarian',
      dietaryType: 'vegetarian',
      quantityNeeded: 30,
      quantity: 30,
      quantityFulfilled: 0,
      unit: 'plates',
      priority: 'HIGH',
      neededBy: new Date(now.getTime() + 5 * 3600000),
      location: { type: 'Point', coordinates: [77.6300, 12.9750] },
      address: { city: 'Bengaluru', formattedAddress: 'Indiranagar, Bengaluru' },
      status: REQUIREMENT_STATUS.OPEN,
    });

    // Requirement 2: Far recipient needs 30 plates (Tier 1 Exact match inside Ring 2)
    testReqFar = await RecipientRequirement.create({
      recipientId: recipientFar._id,
      title: 'Lunch for 30 kids',
      foodType: 'cooked_meals',
      dietaryPreference: 'vegetarian',
      dietaryType: 'vegetarian',
      quantityNeeded: 30,
      quantity: 30,
      quantityFulfilled: 0,
      unit: 'plates',
      priority: 'HIGH',
      neededBy: new Date(now.getTime() + 5 * 3600000),
      location: { type: 'Point', coordinates: [77.6650, 12.9750] },
      address: { city: 'Bengaluru', formattedAddress: 'Whitefield, Bengaluru' },
      status: REQUIREMENT_STATUS.OPEN,
    });
  });

  describe('3A: Smart Match Score & Explainable Breakdown', () => {
    it('should compute an explainable 0-100 score with full 7-component breakdown', async () => {
      const res = await request(app)
        .get(`/api/v1/matches/recommendations?donationId=${testDonation._id}&radiusKm=10`)
        .set('Authorization', `Bearer ${donorToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.recommendations).toHaveLength(2);

      const topRec = res.body.data.recommendations[0];
      expect(topRec.matchScore).toBeGreaterThanOrEqual(70);
      expect(topRec.matchScore).toBeLessThanOrEqual(100);

      // Verify all 7 named breakdown components exist with points, max, and reason
      const bd = topRec.breakdown;
      expect(bd.urgency).toHaveProperty('points');
      expect(bd.urgency.max).toBe(MATCH_WEIGHTS.URGENCY);
      expect(bd.requirementPriority.max).toBe(MATCH_WEIGHTS.REQUIREMENT_PRIORITY);
      expect(bd.distance.max).toBe(MATCH_WEIGHTS.DISTANCE);
      expect(bd.quantityFit.max).toBe(MATCH_WEIGHTS.QUANTITY_FIT);
      expect(bd.dietaryFoodType.max).toBe(MATCH_WEIGHTS.DIETARY_FOOD_TYPE);
      expect(bd.pickupAvailability.max).toBe(MATCH_WEIGHTS.PICKUP_AVAILABILITY);
      expect(bd.reliability.max).toBe(MATCH_WEIGHTS.RELIABILITY);
    });

    it('should enforce hard filter: never score donations inside safety buffer or expired', async () => {
      // Move expiry inside safety buffer (30 mins from now, while safety buffer is 60 mins)
      testDonation.expiryAt = new Date(Date.now() + 30 * 60000);
      await testDonation.save();

      const res = await request(app)
        .get(`/api/v1/matches/recommendations?donationId=${testDonation._id}`)
        .set('Authorization', `Bearer ${donorToken}`)
        .expect(200);

      // Ineligible donation yields 0 candidates
      expect(res.body.data.recommendations).toHaveLength(0);
    });

    it('should enforce hard filter: never match inactive, unverified, or hidden users', async () => {
      recipientNear.mapVisible = false;
      await recipientNear.save();

      const res = await request(app)
        .get(`/api/v1/matches/recommendations?donationId=${testDonation._id}`)
        .set('Authorization', `Bearer ${donorToken}`)
        .expect(200);

      const recipientIds = res.body.data.recommendations.map((r) => r.recipientId.toString());
      expect(recipientIds).not.toContain(recipientNear._id.toString());
    });

    it('should enforce hard filter: never match incompatible dietary restrictions', async () => {
      // Change donation to non-vegetarian while requirement is strictly vegetarian
      testDonation.dietaryType = 'non_vegetarian';
      await testDonation.save();

      const res = await request(app)
        .get(`/api/v1/matches/recommendations?donationId=${testDonation._id}`)
        .set('Authorization', `Bearer ${donorToken}`)
        .expect(200);

      expect(res.body.data.recommendations).toHaveLength(0);
    });
  });

  describe('3B: Ring & Tier Candidate Sorting and Auto-Allotment Waves', () => {
    it('should sort Ring 1 (<=5km) strictly before Ring 2 (>5km)', async () => {
      const res = await request(app)
        .get(`/api/v1/matches/recommendations?donationId=${testDonation._id}&radiusKm=10`)
        .set('Authorization', `Bearer ${donorToken}`)
        .expect(200);

      const recs = res.body.data.recommendations;
      expect(recs[0].ring).toBe(1);
      expect(recs[0].recipientId.toString()).toBe(recipientNear._id.toString());
      expect(recs[1].ring).toBe(2);
      expect(recs[1].recipientId.toString()).toBe(recipientFar._id.toString());
    });

    it('should prioritize Tier 1 (exact fit) over Tier 3 (split) within the same ring', async () => {
      // Create a third recipient inside Ring 1 who needs only 10 plates (Tier 3 Split)
      const recipientSplit = await User.create({
        name: 'Halasuru Small Center',
        email: 'halasuru@recipient.org',
        password: 'Password123!',
        role: ROLES.RECIPIENT,
        phone: '+919876543299',
        isVerified: true,
        isActive: true,
        mapVisible: true,
        location: { type: 'Point', coordinates: [77.6250, 12.9750] }, // ~3.5 km away
        address: { city: 'Bengaluru', formattedAddress: 'Halasuru, Bengaluru' },
      });
      await RecipientRequirement.create({
        recipientId: recipientSplit._id,
        title: 'Snack for 10 kids',
        foodType: 'cooked_meals',
        dietaryPreference: 'vegetarian',
        dietaryType: 'vegetarian',
        quantityNeeded: 10,
        quantity: 10,
        unit: 'plates',
        priority: 'HIGH',
        neededBy: new Date(Date.now() + 5 * 3600000),
        location: { type: 'Point', coordinates: [77.6250, 12.9750] },
        address: { city: 'Bengaluru', formattedAddress: 'Halasuru, Bengaluru' },
        status: REQUIREMENT_STATUS.OPEN,
      });

      const res = await request(app)
        .get(`/api/v1/matches/recommendations?donationId=${testDonation._id}`)
        .set('Authorization', `Bearer ${donorToken}`)
        .expect(200);

      const ring1Recs = res.body.data.recommendations.filter((r) => r.ring === 1);
      expect(ring1Recs[0].tier).toBe(QUANTITY_TIERS.TIER_1_EXACT);
      expect(ring1Recs[1].tier).toBe(QUANTITY_TIERS.TIER_3_SPLIT);
    });

    it('should switch allotMode to AUTO and create wave offer for top candidate', async () => {
      const res = await request(app)
        .patch(`/api/v1/donations/${testDonation._id}/allot-mode`)
        .set('Authorization', `Bearer ${donorToken}`)
        .send({ allotMode: 'AUTO' })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.allotMode).toBe('AUTO');
      expect(res.body.data.activeOffer).toBeDefined();
      expect(res.body.data.activeOffer.recipientId.toString()).toBe(recipientNear._id.toString());
      expect(res.body.data.activeOffer.status).toBe('PENDING');

      const updated = await Donation.findById(testDonation._id);
      expect(updated.offers).toHaveLength(1);
      expect(updated.offers[0].suggestedQuantity).toBe(30);
    });

    it('should advance wave when recipient declines an offer and exclude recipient from rematch', async () => {
      // Put donation in AUTO mode
      testDonation.allotMode = 'AUTO';
      await testDonation.save();

      // Trigger wave 1 offer
      const offer1 = await matchingService.processAutoAllotmentWave(testDonation._id);
      expect(offer1.recipientId.toString()).toBe(recipientNear._id.toString());

      // Recipient 1 declines offer
      const res = await request(app)
        .post(`/api/v1/matches/offers/${offer1._id}/decline`)
        .set('Authorization', `Bearer ${recipientNearToken}`)
        .send({ reason: 'Kitchen freezer full' })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.declinedOffer.status).toBe('DECLINED');

      // Next candidate (recipientFar) automatically receives offer in wave 2
      const updated = await Donation.findById(testDonation._id);
      expect(updated.rejectedByRecipients).toContainEqual(recipientNear._id);
      expect(updated.allotWave).toBe(2);

      const activeOffer = updated.offers.find((o) => o.status === 'PENDING');
      expect(activeOffer).toBeDefined();
      expect(activeOffer.recipientId.toString()).toBe(recipientFar._id.toString());
    });
  });

  describe('3C: Split Plan & Multi-Recipient Fulfillment', () => {
    it('should propose greedy split plan across candidates adhering to MIN_PORTION_QUANTITY', async () => {
      // Create a 2nd requirement near
      const rec2 = await User.create({
        name: 'Community Center 2',
        email: 'cc2@recipient.org',
        password: 'Password123!',
        role: ROLES.RECIPIENT,
        phone: '+919876543298',
        isVerified: true,
        isActive: true,
        mapVisible: true,
        location: { type: 'Point', coordinates: [77.6100, 12.9700] },
        address: { city: 'Bengaluru', formattedAddress: 'Domlur, Bengaluru' },
      });
      await RecipientRequirement.create({
        recipientId: rec2._id,
        title: 'Shelter needs 15 plates',
        foodType: 'cooked_meals',
        dietaryPreference: 'vegetarian',
        dietaryType: 'vegetarian',
        quantityNeeded: 15,
        quantity: 15,
        unit: 'plates',
        neededBy: new Date(Date.now() + 5 * 3600000),
        location: { type: 'Point', coordinates: [77.6100, 12.9700] },
        address: { city: 'Bengaluru', formattedAddress: 'Domlur, Bengaluru' },
        status: REQUIREMENT_STATUS.OPEN,
      });

      const res = await request(app)
        .get(`/api/v1/donations/${testDonation._id}/split-plan?maxParts=2`)
        .set('Authorization', `Bearer ${donorToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.parts.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data.totalAllocated).toBeGreaterThan(0);
      for (const p of res.body.data.parts) {
        expect(p.allocatedQuantity).toBeGreaterThanOrEqual(MATCH_CONFIG.MIN_PORTION_QUANTITY);
      }
    });

    it('should confirm split plan and dispatch targeted offers idempotently', async () => {
      const parts = [
        {
          recipientId: recipientNear._id.toString(),
          requirementId: testReqNear._id.toString(),
          allocatedQuantity: 20,
        },
        {
          recipientId: recipientFar._id.toString(),
          requirementId: testReqFar._id.toString(),
          allocatedQuantity: 10,
        },
      ];

      const res = await request(app)
        .post(`/api/v1/donations/${testDonation._id}/split-plan/confirm`)
        .set('Authorization', `Bearer ${donorToken}`)
        .send({ parts })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.offersCreated).toBe(2);

      const updated = await Donation.findById(testDonation._id);
      expect(updated.offers).toHaveLength(2);
    });

    it('should track requirement fulfillment progression: OPEN -> PARTIALLY_FULFILLED -> FULFILLED', async () => {
      // Recipient claims 15 plates out of 30 needed
      await request(app)
        .post(`/api/v1/donations/${testDonation._id}/accept`)
        .set('Authorization', `Bearer ${recipientNearToken}`)
        .send({
          quantityAccepted: 15,
          requirementId: testReqNear._id.toString(),
        })
        .expect(200);

      let reqDoc = await RecipientRequirement.findById(testReqNear._id);
      expect(reqDoc.quantityFulfilled).toBe(15);
      expect(reqDoc.status).toBe(REQUIREMENT_STATUS.PARTIALLY_FULFILLED);

      // Suggest completions for the remaining 15 plate gap
      const compRes = await request(app)
        .get(`/api/v1/requirements/${testReqNear._id}/complete-with`)
        .set('Authorization', `Bearer ${recipientNearToken}`)
        .expect(200);

      expect(compRes.body.data.remainingGap).toBe(15);

      // Claim remaining 15 plates from donation
      await request(app)
        .post(`/api/v1/donations/${testDonation._id}/accept`)
        .set('Authorization', `Bearer ${recipientNearToken}`)
        .send({
          quantityAccepted: 15,
          requirementId: testReqNear._id.toString(),
        })
        .expect(200);

      reqDoc = await RecipientRequirement.findById(testReqNear._id);
      expect(reqDoc.quantityFulfilled).toBe(30);
      expect(reqDoc.status).toBe(REQUIREMENT_STATUS.FULFILLED);
    });
  });

  describe('3D: Reject-then-Reopen Lifecycle', () => {
    it('should reject acceptance before pickup, restore donation quantity, and reopen status', async () => {
      // 1. Recipient claims all 30 plates
      const claimRes = await request(app)
        .post(`/api/v1/donations/${testDonation._id}/accept`)
        .set('Authorization', `Bearer ${recipientNearToken}`)
        .send({
          quantityAccepted: 30,
          requirementId: testReqNear._id.toString(),
        })
        .expect(200);

      let don = await Donation.findById(testDonation._id);
      expect(don.remainingQuantity).toBe(0);
      expect(don.status).toBe(DONATION_STATUS.ACCEPTED);

      const acceptanceId = don.acceptances[0]._id.toString();

      // 2. Reject acceptance via POST /api/v1/acceptances/:id/reject
      const rejRes = await request(app)
        .post(`/api/v1/acceptances/${acceptanceId}/reject`)
        .set('Authorization', `Bearer ${recipientNearToken}`)
        .send({ reason: 'Kitchen vehicle broke down before collection' })
        .expect(200);

      expect(rejRes.body.success).toBe(true);
      expect(rejRes.body.data.status).toBe('REJECTED');
      expect(rejRes.body.data.restoredQuantity).toBe(30);

      // Verify donation restored
      don = await Donation.findById(testDonation._id);
      expect(don.remainingQuantity).toBe(30);
      expect(don.status).toBe(DONATION_STATUS.REOPENED);

      // Verify requirement quantityFulfilled rolled back
      const reqDoc = await RecipientRequirement.findById(testReqNear._id);
      expect(reqDoc.quantityFulfilled).toBe(0);
      expect(reqDoc.status).toBe(REQUIREMENT_STATUS.OPEN);
    });

    it('should block rejection after food has already been PICKED_UP', async () => {
      testDonation.acceptances = [
        {
          recipientId: recipientNear._id,
          quantity: 30,
          status: ACCEPTANCE_STATUS.PICKED_UP,
          claimedAt: new Date(),
        },
      ];
      await testDonation.save();

      const accId = testDonation.acceptances[0]._id.toString();

      const res = await request(app)
        .post(`/api/v1/acceptances/${accId}/reject`)
        .set('Authorization', `Bearer ${recipientNearToken}`)
        .send({ reason: 'Late rejection' })
        .expect(400);

      expect(res.body.error.code).toBe(ERROR_CODES.REJECTION_NOT_ALLOWED);
    });
  });

  describe('Feature Flags Protection', () => {
    const originalEnv = { ...process.env };

    afterEach(() => {
      process.env = { ...originalEnv };
    });

    it('should return 404 FEATURE_DISABLED when FEATURE_SPLIT is false', async () => {
      process.env.FEATURE_SPLIT = 'false';

      const res = await request(app)
        .get(`/api/v1/donations/${testDonation._id}/split-plan`)
        .set('Authorization', `Bearer ${donorToken}`)
        .expect(404);

      expect(res.body.error.code).toBe('FEATURE_DISABLED');
    });

    it('should return 404 FEATURE_DISABLED when FEATURE_AUTO_ALLOT is false', async () => {
      process.env.FEATURE_AUTO_ALLOT = 'false';

      const res = await request(app)
        .patch(`/api/v1/donations/${testDonation._id}/allot-mode`)
        .set('Authorization', `Bearer ${donorToken}`)
        .send({ allotMode: 'AUTO' })
        .expect(404);

      expect(res.body.error.code).toBe('FEATURE_DISABLED');
    });

    it('should return 404 FEATURE_DISABLED when FEATURE_REJECT_REOPEN is false', async () => {
      process.env.FEATURE_REJECT_REOPEN = 'false';

      testDonation.acceptances = [
        {
          recipientId: recipientNear._id,
          quantity: 10,
          status: ACCEPTANCE_STATUS.CLAIMED,
          claimedAt: new Date(),
        },
      ];
      await testDonation.save();
      const accId = testDonation.acceptances[0]._id.toString();

      const res = await request(app)
        .post(`/api/v1/acceptances/${accId}/reject`)
        .set('Authorization', `Bearer ${recipientNearToken}`)
        .send({ reason: 'Test reason' })
        .expect(404);

      expect(res.body.error.code).toBe('FEATURE_DISABLED');
    });
  });
});
