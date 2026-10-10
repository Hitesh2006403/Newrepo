const request = require('supertest');
const app = require('../app');
const User = require('../src/models/User');
const { ROLES } = require('../src/constants/roles');
const ERROR_CODES = require('../src/constants/errorCodes');
const authService = require('../src/services/authService');

describe('Administrator User Governance (/api/v1/admin)', () => {
  let adminUser;
  let adminToken;
  let recipientUser;
  let recipientToken;

  beforeEach(async () => {
    // Create an Admin user
    adminUser = await User.create({
      name: 'System Admin',
      email: 'admin@platform.org',
      password: 'AdminPassword123!',
      role: ROLES.ADMIN,
      phone: '+919999999999',
      isVerified: true,
      isActive: true,
      location: { type: 'Point', coordinates: [77.5946, 12.9716] },
      address: { city: 'Bengaluru', formattedAddress: 'MG Road, Bengaluru' },
    });
    adminToken = authService.generateToken(adminUser._id);

    // Create a regular Recipient user
    recipientUser = await User.create({
      name: 'Hope Shelter',
      email: 'hope@shelter.org',
      password: 'Password123!',
      role: ROLES.RECIPIENT,
      phone: '+919888888888',
      isVerified: false,
      isActive: true,
      location: { type: 'Point', coordinates: [77.5946, 12.9716] },
      address: { city: 'Bengaluru', formattedAddress: 'Indiranagar, Bengaluru' },
    });
    recipientToken = authService.generateToken(recipientUser._id);
  });

  describe('RBAC Authorization Guard', () => {
    it('should reject non-admin users (e.g. recipient) with 403 FORBIDDEN when accessing admin routes', async () => {
      const res = await request(app)
        .get('/api/v1/admin/users')
        .set('Authorization', `Bearer ${recipientToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe(ERROR_CODES.FORBIDDEN);
      expect(res.body.error.message).toContain('Access forbidden');
    });
  });

  describe('GET /api/v1/admin/users', () => {
    it('should return paginated user list with metadata for authorized admin', async () => {
      const res = await request(app)
        .get('/api/v1/admin/users?page=1&limit=10')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBe(2);
      expect(res.body.meta).toBeDefined();
      expect(res.body.meta.page).toBe(1);
      expect(res.body.meta.total).toBe(2);
    });

    it('should filter users by role and isVerified status', async () => {
      const res = await request(app)
        .get('/api/v1/admin/users?role=recipient&isVerified=false')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].email).toBe('hope@shelter.org');
    });
  });

  describe('PATCH /api/v1/admin/users/:id/verify', () => {
    it('should approve and verify an unverified recipient account', async () => {
      const res = await request(app)
        .patch(`/api/v1/admin/users/${recipientUser._id}/verify`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.isVerified).toBe(true);

      // Verify persistence in database
      const updatedInDb = await User.findById(recipientUser._id);
      expect(updatedInDb.isVerified).toBe(true);
    });

    it('should return 404 NOT_FOUND when verifying non-existent user ID', async () => {
      const fakeId = '507f1f77bcf86cd799439011';
      const res = await request(app)
        .patch(`/api/v1/admin/users/${fakeId}/verify`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe(ERROR_CODES.NOT_FOUND);
    });
  });

  describe('PATCH /api/v1/admin/users/:id/deactivate', () => {
    it('should deactivate another user account successfully', async () => {
      const res = await request(app)
        .patch(`/api/v1/admin/users/${recipientUser._id}/deactivate`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.isActive).toBe(false);

      const updatedInDb = await User.findById(recipientUser._id);
      expect(updatedInDb.isActive).toBe(false);
    });

    it('should block an admin from deactivating themselves with 400 CANNOT_DEACTIVATE_SELF', async () => {
      const res = await request(app)
        .patch(`/api/v1/admin/users/${adminUser._id}/deactivate`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('CANNOT_DEACTIVATE_SELF');
      expect(res.body.error.message).toContain('cannot deactivate their own account');

      // Verify admin remains active in DB
      const adminInDb = await User.findById(adminUser._id);
      expect(adminInDb.isActive).toBe(true);
    });
  });
});
