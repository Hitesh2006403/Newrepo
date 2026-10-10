# Share A Plate — Production Deployment Guide & Checklist

This document outlines the production readiness checklist, environment variable requirements, database index verifications, pre-flight checks, and deployment procedures for the "Share A Plate" platform.

---

## 1. Environment Variables Checklist

Before deploying to production (Render, Railway, Heroku, AWS, or DigitalOcean), configure all environment variables via your platform's secure environment variable management panel.

> **CRITICAL**: Never commit production environment variables or secrets into Git repository files. All variables below are identified by **name only**.

| Variable Name | Required | Purpose / Recommendations |
| :--- | :---: | :--- |
| `NODE_ENV` | Yes | Must be set to `production`. Activates strict startup security checks and combined logging. |
| `PORT` | Yes | Application port (e.g. `5000` or assigned automatically by PaaS like Render/Railway). |
| `TRUST_PROXY` | Yes | Set to `1` (or `true`) when running behind reverse proxies (Nginx, Cloudflare, Render, Railway) to ensure accurate client IP resolution for rate limiting and audit logs. |
| `BODY_LIMIT` | No | Request body size threshold (defaults to `10kb` to thwart Denial-of-Service / resource starvation). |
| `RATE_LIMIT_WINDOW_MS` | No | Global rate limiting window in milliseconds (defaults to `900000` = 15 minutes). |
| `RATE_LIMIT_MAX` | No | Maximum requests per IP within the rate limiting window (defaults to `100`). |
| `MONGODB_URI` | Yes | High-availability MongoDB Atlas connection string with authenticated credentials. |
| `CLIENT_URL` | Yes | Strict production URL of the React frontend application (e.g., `https://shareaplate.org`). Configures CORS whitelist. |
| `JWT_SECRET` | Yes | Cryptographically secure random secret (at least 64 hex/base64 characters). Must not contain `"change-me"`. |
| `JWT_EXPIRES_IN` | No | Token expiration duration (recommended: `7d` or `1d`). |
| `BCRYPT_SALT_ROUNDS` | No | Salt rounds for password hashing (recommended: `10` or `12`). |
| `SAFETY_BUFFER_MINUTES_DEFAULT` | No | Food consumption expiry buffer in minutes (defaults to `60`). |
| `URGENCY_THRESHOLD_MINUTES` | No | Lead-time threshold for expiring-soon alerts (defaults to `30`). |
| `UPLOAD_MAX_SIZE_BYTES` | No | Maximum photo file upload limit in bytes (defaults to `2097152` = 2 MB). |
| `QR_SIGNING_SECRET` | Yes | Secret key used to sign and verify member pickup QR tokens. Must not contain `"change-me"`. |
| `MAPS_API_KEY` | No | Google Maps / Mapbox API key for geocoding services. |

---

## 2. Production Startup Guard (`server.js`)

When `NODE_ENV === 'production'`, the server executes a pre-flight startup guard before establishing database connectivity:
1. Verifies that `MONGODB_URI`, `JWT_SECRET`, `CLIENT_URL`, and `QR_SIGNING_SECRET` are provided and non-empty.
2. Checks that none of these secrets contain default placeholder values like `"change-me"`.
3. If any violation is found, the server immediately logs the missing variable names and terminates process execution with exit code 1 (`process.exit(1)`).

---

## 3. Database Indexes Verification

Before taking live traffic, connect to your MongoDB Atlas cluster via MongoDB Compass or mongosh and verify that the following compound and specialized indexes are built:

### A. Users Collection (`users`)
- `{ email: 1 }` (Unique index) — Prevents duplicate registrations.
- `{ role: 1, isVerified: 1 }` — Optimizes recipient/delivery agent administrative queries.

### B. Donations Collection (`donations`)
- `{ "location.coordinates": "2dsphere" }` (Geospatial index) — Accelerates proximity lookups and nearby available food queries.
- `{ status: 1, donorId: 1 }` — Optimizes donor dashboard queries.
- `{ status: 1, expiresAt: 1 }` — Enables high-speed automated sweeper sweeps for expiring donations.

### C. Recipient Requirements Collection (`recipientrequirements`)
- `{ "location.coordinates": "2dsphere" }` (Geospatial index) — Enables geospatial requirement matching.
- `{ recipientId: 1, status: 1 }` — Optimizes recipient requirement management.

### D. Notifications Collection (`notifications`)
- `{ userId: 1, readAt: 1, createdAt: -1 }` — High-speed retrieval of unread notifications for active users.
- `{ createdAt: 1 }` (TTL index with `expireAfterSeconds: 2592000` / 30 days) — Automatically purges stale notifications to prevent storage bloat.

### E. Voice Calls Collection (`voicecalls`)
- `{ donationId: 1 }` — Rapid lookup of automated outbound urgent telephony calls.
- `{ callId: 1 }` (Unique index) — Telephony provider identifier tracking.

---

## 4. Database Seed Script (Initial Setup)

For staging environments or initial production bootstrap:
1. Ensure `SEED_ADMIN_EMAIL` and a strong `SEED_ADMIN_PASSWORD` are configured.
2. Run the seed script:
   ```bash
   node backend/scripts/seed.js
   ```
3. The seed script is strictly idempotent: if an admin user exists with `SEED_ADMIN_EMAIL`, it will skip duplicate creation.
4. **Security Notice**: Immediately log in as the administrator and rotate credentials if temporary passwords were used.

---

## 5. Reverse Proxy & Network Configuration

If running behind reverse proxies (Nginx, AWS ALB, Cloudflare, Render):
- Set `TRUST_PROXY=1`.
- Ensure headers `X-Forwarded-For` and `X-Forwarded-Proto` are propagated by the load balancer.
- Ensure static uploads `/uploads/:filename` are served with `X-Content-Type-Options: nosniff` (enforced at the Express layer in `backend/app.js`).
- Configure file upload timeouts to at least 30 seconds to support 5 concurrent 2 MB multipart image uploads.

---

## 6. Pre-Flight Verification Checklist

Run these automated verification steps prior to promoting a build to production:

```bash
# 1. Run all unit and integration test suites
npm test

# 2. Run the end-to-end API smoke test runner against the running service
npm run smoke

# 3. Verify zero production security vulnerabilities in third-party dependencies
npm audit --omit=dev

# 4. Confirm clean git status and no secret leaks in repository files
git status
```
