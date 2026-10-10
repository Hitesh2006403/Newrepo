const request = require('supertest');
const app = require('../app');
const ERROR_CODES = require('../src/constants/errorCodes');

describe('System Health & Base Router Integration', () => {
  describe('GET /api/v1/health', () => {
    it('should return 200 OK with the standard success envelope and status, uptime, timestamp', async () => {
      const res = await request(app).get('/api/v1/health');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('message', 'System operational');
      expect(res.body).toHaveProperty('data');

      // Verify data object contains status, uptime, timestamp and nothing else
      const dataKeys = Object.keys(res.body.data).sort();
      expect(dataKeys).toEqual(['status', 'timestamp', 'uptime'].sort());

      expect(res.body.data.status).toBe('UP');
      expect(typeof res.body.data.uptime).toBe('number');
      expect(typeof res.body.data.timestamp).toBe('string');
      expect(new Date(res.body.data.timestamp).toString()).not.toBe('Invalid Date');
    });
  });

  describe('Unknown Route Handler (404)', () => {
    it('should return 404 NOT_FOUND with the standard error envelope', async () => {
      const res = await request(app).get('/api/v1/nonexistent-route');

      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty('success', false);
      expect(res.body).toHaveProperty('error');
      expect(res.body.error.code).toBe(ERROR_CODES.NOT_FOUND);
      expect(res.body.error.message).toContain('Cannot GET /api/v1/nonexistent-route');
      expect(res.body.error.details).toBeNull();
    });
  });
});
