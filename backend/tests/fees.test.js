const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../app');
const User = require('../src/models/User');
const Donation = require('../src/models/Donation');
const DeliveryTask = require('../src/models/DeliveryTask');
const { ROLES } = require('../src/constants/roles');
const { DONATION_STATUS, ACCEPTANCE_STATUS } = require('../src/constants/status');
const { PAYER_MODE, FEE_STATUS } = require('../src/constants/fees');
const authService = require('../src/services/authService');
const ERROR_CODES = require('../src/constants/errorCodes');

describe('Phase 2 - Delivery Fee Choice Agreement & Agent Food-Only Option Test Suite', () => {
  let donorUser, donorToken;
  let recipientUser, recipientToken;
  let otherRecipientUser, otherRecipientToken;
  let volunteerAgentUser, volunteerAgentToken;
  let paidAgentUser, paidAgentToken;
  let adminUser, adminToken;
  let testDonation, testAcceptanceId;

  beforeEach(async () => {
    // 1. Donor
    donorUser = await User.create({
      name: 'Chef Mario Restaurant',
      email: 'mario@restaurant.org',
      password: 'Password123!',
      role: ROLES.DONOR,
      phone: '+919999111111',
      isVerified: true,
      isActive: true,
      location: { type: 'Point', coordinates: [77.5946, 12.9716] },
      address: { city: 'Bengaluru', formattedAddress: 'MG Road, Bengaluru' },
    });
    donorToken = authService.generateToken(donorUser._id);

    // 2. Recipient 1 (Attached party)
    recipientUser = await User.create({
      name: 'Hope Mission Shelter',
      email: 'hope@shelter.org',
      password: 'Password123!',
      role: ROLES.RECIPIENT,
      phone: '+919999222222',
      isVerified: true,
      isActive: true,
      location: { type: 'Point', coordinates: [77.6412, 12.9784] },
      address: { city: 'Bengaluru', formattedAddress: 'Indiranagar, Bengaluru' },
    });
    recipientToken = authService.generateToken(recipientUser._id);

    // 3. Recipient 2 (Unrelated party for IDOR checks)
    otherRecipientUser = await User.create({
      name: 'Third Party Care',
      email: 'third@care.org',
      password: 'Password123!',
      role: ROLES.RECIPIENT,
      phone: '+919999333333',
      isVerified: true,
      isActive: true,
      location: { type: 'Point', coordinates: [77.5854, 12.9302] },
      address: { city: 'Bengaluru', formattedAddress: 'Jayanagar, Bengaluru' },
    });
    otherRecipientToken = authService.generateToken(otherRecipientUser._id);

    // 4. Delivery Agent 1 (Volunteer only, accepts no fees)
    volunteerAgentUser = await User.create({
      name: 'Seva Volunteer Driver',
      email: 'volunteer@seva.org',
      password: 'Password123!',
      role: ROLES.DELIVERY_AGENT,
      phone: '+919999444444',
      isVerified: true,
      isActive: true,
      location: { type: 'Point', coordinates: [77.6000, 12.9500] },
      address: { city: 'Bengaluru', formattedAddress: 'Shanthi Nagar, Bengaluru' },
      agentPreferences: { volunteerOnly: true, acceptsPaid: false },
    });
    volunteerAgentToken = authService.generateToken(volunteerAgentUser._id);

    // 5. Delivery Agent 2 (Accepts paid & volunteer stipends)
    paidAgentUser = await User.create({
      name: 'Professional Courier Agent',
      email: 'pro@courier.org',
      password: 'Password123!',
      role: ROLES.DELIVERY_AGENT,
      phone: '+919999555555',
      isVerified: true,
      isActive: true,
      location: { type: 'Point', coordinates: [77.6100, 12.9600] },
      address: { city: 'Bengaluru', formattedAddress: 'Koramangala, Bengaluru' },
      agentPreferences: { volunteerOnly: false, acceptsPaid: true },
    });
    paidAgentToken = authService.generateToken(paidAgentUser._id);

    // 6. Admin
    adminUser = await User.create({
      name: 'Platform Overseer',
      email: 'admin@shareaplate.org',
      password: 'Password123!',
      role: ROLES.ADMIN,
      phone: '+919999666666',
      isVerified: true,
      isActive: true,
      location: { type: 'Point', coordinates: [77.5946, 12.9716] },
      address: { city: 'Bengaluru', formattedAddress: 'MG Road, Bengaluru' },
    });
    adminToken = authService.generateToken(adminUser._id);

    // Create a Donation with an active Acceptance
    const now = new Date();
    testDonation = await Donation.create({
      donorId: donorUser._id,
      foodName: 'Nutritious Dal & Rice',
      foodType: 'cooked_meals',
      dietaryType: 'vegetarian',
      totalQuantity: 60,
      remainingQuantity: 20,
      unit: 'plates',
      cookedAt: new Date(now.getTime() - 2 * 3600000),
      expiryAt: new Date(now.getTime() + 4 * 3600000),
      pickupWindowStart: now,
      pickupWindowEnd: new Date(now.getTime() + 3 * 3600000),
      location: { type: 'Point', coordinates: [77.5946, 12.9716] },
      address: { city: 'Bengaluru', formattedAddress: 'MG Road, Bengaluru' },
      status: DONATION_STATUS.PARTIALLY_ACCEPTED,
      acceptances: [
        {
          recipientId: recipientUser._id,
          quantity: 40,
          status: ACCEPTANCE_STATUS.CLAIMED,
          claimedAt: now,
          deliveryFee: {
            payerMode: PAYER_MODE.NONE,
            amount: 0,
            status: FEE_STATUS.AGREED,
            feeVersion: 1,
            proposals: [],
          },
        },
      ],
    });

    testAcceptanceId = testDonation.acceptances[0]._id.toString();
  });

  describe('2A: GET /api/v1/fees/suggest (Server-calculated route recommendation)', () => {
    it('should reject unauthenticated request with 401', async () => {
      const res = await request(app)
        .get(`/api/v1/fees/suggest?acceptanceId=${testAcceptanceId}`);
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe(ERROR_CODES.UNAUTHORIZED);
    });

    it('should reject non-party user with 403 FORBIDDEN (IDOR protection)', async () => {
      const res = await request(app)
        .get(`/api/v1/fees/suggest?acceptanceId=${testAcceptanceId}`)
        .set('Authorization', `Bearer ${otherRecipientToken}`);
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe(ERROR_CODES.FORBIDDEN);
    });

    it('should calculate suggested fee for attached donor and include max cap (500)', async () => {
      const res = await request(app)
        .get(`/api/v1/fees/suggest?acceptanceId=${testAcceptanceId}`)
        .set('Authorization', `Bearer ${donorToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.suggestedAmount).toBeGreaterThanOrEqual(40);
      expect(res.body.data.maxAmount).toBe(500);
      expect(res.body.data.currency).toBe('INR');
      expect(res.body.data.currentPayerMode).toBe(PAYER_MODE.NONE);
    });

    it('should allow attached recipient and admin to fetch fee suggestion', async () => {
      const resRecipient = await request(app)
        .get(`/api/v1/fees/suggest?acceptanceId=${testAcceptanceId}`)
        .set('Authorization', `Bearer ${recipientToken}`);
      expect(resRecipient.status).toBe(200);

      const resAdmin = await request(app)
        .get(`/api/v1/fees/suggest?acceptanceId=${testAcceptanceId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(resAdmin.status).toBe(200);
    });
  });

  describe('2B: PUT /api/v1/acceptances/:id/delivery-fee (Fee Negotiation & Cap Enforcements)', () => {
    it('should reject fee proposals exceeding platform max cap of ₹500 with FEE_EXCEEDS_MAX', async () => {
      const res = await request(app)
        .put(`/api/v1/acceptances/${testAcceptanceId}/delivery-fee`)
        .set('Authorization', `Bearer ${donorToken}`)
        .send({
          payerMode: PAYER_MODE.DONOR,
          amount: 650, // Exceeds 500
        });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe(ERROR_CODES.FEE_EXCEEDS_MAX);
    });

    it('should force amount = 0 and status = AGREED when payerMode is NONE', async () => {
      const res = await request(app)
        .put(`/api/v1/acceptances/${testAcceptanceId}/delivery-fee`)
        .set('Authorization', `Bearer ${recipientToken}`)
        .send({
          payerMode: PAYER_MODE.NONE,
          amount: 120, // should be forced to 0
        });
      expect(res.status).toBe(200);
      expect(res.body.data.payerMode).toBe(PAYER_MODE.NONE);
      expect(res.body.data.amount).toBe(0);
      expect(res.body.data.status).toBe(FEE_STATUS.AGREED);
    });

    it('should handle party proposals and resolve lower amount when modes match', async () => {
      // Step 1: Donor proposes ₹120 on SPLIT
      const res1 = await request(app)
        .put(`/api/v1/acceptances/${testAcceptanceId}/delivery-fee`)
        .set('Authorization', `Bearer ${donorToken}`)
        .send({
          payerMode: PAYER_MODE.SPLIT,
          amount: 120,
        });
      expect(res1.status).toBe(200);
      expect(res1.body.data.payerMode).toBe(PAYER_MODE.SPLIT);
      expect(res1.body.data.amount).toBe(120);
      expect(res1.body.data.status).toBe(FEE_STATUS.PROPOSED);

      // Step 2: Recipient also agrees to SPLIT, but proposes ₹90 -> lower amount wins (₹90) and status becomes AGREED
      const res2 = await request(app)
        .put(`/api/v1/acceptances/${testAcceptanceId}/delivery-fee`)
        .set('Authorization', `Bearer ${recipientToken}`)
        .send({
          payerMode: PAYER_MODE.SPLIT,
          amount: 90,
        });
      expect(res2.status).toBe(200);
      expect(res2.body.data.payerMode).toBe(PAYER_MODE.SPLIT);
      expect(res2.body.data.amount).toBe(90);
      expect(res2.body.data.status).toBe(FEE_STATUS.AGREED);
      expect(res2.body.data.feeVersion).toBeGreaterThan(1);
    });

    it('should lock fee once a delivery agent is assigned (FEE_LOCKED)', async () => {
      // Assign an agent to this acceptance
      const donation = await Donation.findById(testDonation._id);
      donation.acceptances.id(testAcceptanceId).deliveryAgentId = paidAgentUser._id;
      await donation.save();

      const res = await request(app)
        .put(`/api/v1/acceptances/${testAcceptanceId}/delivery-fee`)
        .set('Authorization', `Bearer ${donorToken}`)
        .send({
          payerMode: PAYER_MODE.DONOR,
          amount: 80,
        });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe(ERROR_CODES.FEE_LOCKED);
    });

    it('should allow admin to override fee with auditNote', async () => {
      const res = await request(app)
        .put(`/api/v1/acceptances/${testAcceptanceId}/delivery-fee`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          payerMode: PAYER_MODE.DONOR,
          amount: 75,
          auditNote: 'Admin fee mediation assistance',
        });
      expect(res.status).toBe(200);
      expect(res.body.data.amount).toBe(75);
      expect(res.body.data.status).toBe(FEE_STATUS.AGREED);
      expect(res.body.data.auditNote).toBe('Admin fee mediation assistance');
    });
  });

  describe('2C: Driver Claim Concurrency & Volunteer-Only Agent Enforcement', () => {
    let openPaidTask, openVolunteerTask;

    beforeEach(async () => {
      // 1. Create Open Paid Task (₹95 fee, feeVersion 2)
      openPaidTask = await DeliveryTask.create({
        donationId: testDonation._id.toString(),
        acceptanceId: testAcceptanceId,
        foodName: 'Nutritious Dal & Rice',
        quantity: '40 plates',
        pickup: {
          location: 'MG Road, Bengaluru',
          donorName: 'Chef Mario',
        },
        dropoff: {
          location: 'Indiranagar, Bengaluru',
          recipientName: 'Hope Shelter',
        },
        currentMilestone: 'OPEN_FOR_PICKUP',
        payerMode: PAYER_MODE.DONOR,
        deliveryFee: 95,
        feeVersion: 2,
        isVolunteer: false,
      });

      // 2. Create Open Volunteer Task (₹0 fee, NONE)
      openVolunteerTask = await DeliveryTask.create({
        donationId: testDonation._id.toString(),
        foodName: 'Fresh Bread & Buns',
        quantity: '25 packets',
        pickup: {
          location: 'MG Road, Bengaluru',
          donorName: 'Chef Mario',
        },
        dropoff: {
          location: 'Indiranagar, Bengaluru',
          recipientName: 'Hope Shelter',
        },
        currentMilestone: 'OPEN_FOR_PICKUP',
        payerMode: PAYER_MODE.NONE,
        deliveryFee: 0,
        feeVersion: 1,
        isVolunteer: true,
      });
    });

    it('should reject agent claim with 409 FEE_CHANGED if feeVersion is mismatched', async () => {
      const res = await request(app)
        .post(`/api/v1/delivery/tasks/${openPaidTask._id}/claim`)
        .set('Authorization', `Bearer ${paidAgentToken}`)
        .send({
          agentId: paidAgentUser._id.toString(),
          feeVersion: 1, // Stale version! (DB has feeVersion: 2)
        });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe(ERROR_CODES.FEE_CHANGED);
    });

    it('should reject claim by volunteer-only driver on paid task with AGENT_VOLUNTEER_ONLY', async () => {
      const res = await request(app)
        .post(`/api/v1/delivery/tasks/${openPaidTask._id}/claim`)
        .set('Authorization', `Bearer ${volunteerAgentToken}`)
        .send({
          agentId: volunteerAgentUser._id.toString(),
          feeVersion: 2,
        });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe(ERROR_CODES.AGENT_VOLUNTEER_ONLY);
    });

    it('should allow volunteer-only driver to claim free/volunteer delivery task', async () => {
      const res = await request(app)
        .post(`/api/v1/delivery/tasks/${openVolunteerTask._id}/claim`)
        .set('Authorization', `Bearer ${volunteerAgentToken}`)
        .send({
          agentId: volunteerAgentUser._id.toString(),
          feeVersion: 1,
        });
      expect(res.status).toBe(200);
      expect(res.body.data.currentMilestone).toBe('ASSIGNED');
      expect(res.body.data.feeLocked).toBe(true);
    });

    it('should filter tasks for volunteerOnly agents in GET /api/v1/delivery/tasks', async () => {
      const res = await request(app)
        .get('/api/v1/delivery/tasks?volunteerOnly=true')
        .set('Authorization', `Bearer ${volunteerAgentToken}`);
      expect(res.status).toBe(200);
      const returnedTasks = res.body.data;
      expect(returnedTasks.length).toBeGreaterThanOrEqual(1);
      // All returned tasks must be volunteer / 0 fee
      for (const t of returnedTasks) {
        expect(t.deliveryFee === 0 || t.payerMode === 'NONE' || t.isVolunteer === true).toBe(true);
      }
    });
  });

  describe('2D: Self-Reported Settlement (POST /api/v1/acceptances/:id/delivery-fee/settle)', () => {
    it('should reject settlement before handover verification with 400 VALIDATION_ERROR', async () => {
      const res = await request(app)
        .post(`/api/v1/acceptances/${testAcceptanceId}/delivery-fee/settle`)
        .set('Authorization', `Bearer ${donorToken}`)
        .send({ note: 'Handed ₹50 cash' });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
    });

    it('should allow settlement once handover is verified and record timestamp & note', async () => {
      // Mark handover verified
      const donation = await Donation.findById(testDonation._id);
      const acc = donation.acceptances.id(testAcceptanceId);
      acc.handoverVerifiedAt = new Date();
      acc.deliveryAgentId = paidAgentUser._id;
      acc.deliveryFee = {
        payerMode: PAYER_MODE.DONOR,
        amount: 80,
        status: FEE_STATUS.AGREED,
        feeVersion: 2,
      };
      await donation.save();

      const res = await request(app)
        .post(`/api/v1/acceptances/${testAcceptanceId}/delivery-fee/settle`)
        .set('Authorization', `Bearer ${paidAgentUser._id ? paidAgentToken : donorToken}`)
        .send({ note: 'Direct UPI payment received outside platform' });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.agentMarked).toBe(true);
      expect(res.body.data.note).toBe('Direct UPI payment received outside platform');
    });

    it('should reject non-party settlement with 403 FORBIDDEN', async () => {
      const donation = await Donation.findById(testDonation._id);
      donation.acceptances.id(testAcceptanceId).handoverVerifiedAt = new Date();
      await donation.save();

      const res = await request(app)
        .post(`/api/v1/acceptances/${testAcceptanceId}/delivery-fee/settle`)
        .set('Authorization', `Bearer ${otherRecipientToken}`)
        .send({ note: 'Unauthorized party note' });
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe(ERROR_CODES.FORBIDDEN);
    });
  });

  describe('2E: Public Impact Metrics Additive Delivery Counters', () => {
    it('should include volunteerDeliveriesCount and paidDeliveriesCount in /api/v1/dashboard/impact', async () => {
      const res = await request(app).get('/api/v1/dashboard/impact');
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('volunteerDeliveriesCount');
      expect(res.body.data).toHaveProperty('paidDeliveriesCount');
      expect(typeof res.body.data.volunteerDeliveriesCount).toBe('number');
      expect(typeof res.body.data.paidDeliveriesCount).toBe('number');
      // Verify existing metrics are preserved
      expect(res.body.data).toHaveProperty('mealsSaved');
      expect(res.body.data).toHaveProperty('totalDonationsPosted');
    });
  });

  describe('2F: Feature Flag Control (FEATURE_FEES)', () => {
    afterEach(() => {
      delete process.env.FEATURE_FEES;
    });

    it('should return 404 FEATURE_DISABLED when FEATURE_FEES=false', async () => {
      process.env.FEATURE_FEES = 'false';
      const res = await request(app)
        .get(`/api/v1/fees/suggest?acceptanceId=${testAcceptanceId}`)
        .set('Authorization', `Bearer ${donorToken}`);
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('FEATURE_DISABLED');
    });
  });
});
