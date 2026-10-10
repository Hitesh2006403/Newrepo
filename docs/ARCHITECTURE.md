# Share A Plate – System Architecture & Team Collaboration Guide

> **Project**: Share A Plate – Share More, Waste Less (Hackathon Food Donation Platform)  
> **Backend Stack**: Node.js, Express, MongoDB Atlas (Mongoose), React Frontend  
> **Team Workstream**: Member 2 (Backend Foundation & Authentication)  
> **Date**: October 2026  
> **Branch**: `member2/backend-auth`

---

## 1. Backend Folder Structure & Ownership Model

### Directory Choice: `backend/` vs `server/`
**Decision: `backend/`**  
**Justification**:
1. In a multi-member full-stack monorepo (with React frontend in `frontend/`), `backend/` is the standard convention that cleanly isolates the server application domain.
2. The label `server/` is frequently conflated with just the HTTP entrypoint (e.g., `server.js`), whereas `backend/` houses domain models, business services, security policies, background schedulers, and tests.
3. Provides clean scoping for Docker containers, CI/CD pipelines, and workspace configs.

---

### Folder Layout & Clear File Ownership

To ensure 4 teammates work concurrently **with zero Git merge conflicts**, each team member has dedicated files. **No member should ever edit another member’s controller, service, or dedicated schema files.** Central routing is registered via modular mounts in `backend/src/routes/index.js`.

```text
Share-a-Plate/
├── .gitignore                          # [M2] Git ignore rules
├── .env.example                        # [M2] Template for environment variables (keys only)
├── README.md                           # Team overview
├── docs/
│   ├── ARCHITECTURE.md                 # [M2] System architecture & team contracts (This file)
│   └── API.md                          # [M2] Comprehensive REST API specification & schemas
│
├── frontend/                           # [Member 1] React + Tailwind CSS client application
│
└── backend/
    ├── package.json                    # [M2] Project manifests, dependencies, scripts
    ├── server.js                       # [M2] HTTP listener, DB connection init, graceful shutdown
    ├── app.js                          # [M2] Express app config, global middleware, route mounts
    │
    ├── src/
    │   ├── config/
    │   │   └── db.js                   # [M2] MongoDB Atlas Mongoose connection & events
    │   │
    │   ├── constants/                  # [SHARED READ-ONLY] All members import from here
    │   │   ├── roles.js                # [M2] User role definitions (DONOR, RECIPIENT, etc.)
    │   │   ├── status.js               # [M2] Donation & Acceptance status enums and allowed states
    │   │   ├── errorCodes.js           # [M2] Standardized system error codes
    │   │   └── metrics.js              # [M2] Food-to-meal conversion constants & ratios
    │   │
    │   ├── utils/                      # [SHARED READ-ONLY] Core utilities
    │   │   ├── ApiResponse.js          # [M2] Standardized success response builder
    │   │   ├── ApiError.js             # [M2] Standardized operational error class
    │   │   └── asyncHandler.js         # [M2] Wrapper to eliminate try-catch boilerplate
    │   │
    │   ├── middlewares/                # [M2 Core Security & Processing]
    │   │   ├── authMiddleware.js       # [M2] JWT verify & DB user check (checks isActive)
    │   │   ├── roleMiddleware.js       # [M2] RBAC enforcement (authorizeRoles)
    │   │   ├── verificationMiddleware.js# [M2] Requires isVerified === true for sensitive actions
    │   │   ├── validateMiddleware.js   # [M2] Request payload validation runner (Zod schema)
    │   │   ├── errorHandler.js         # [M2] Global unhandled error & formatting middleware
    │   │   └── notFoundHandler.js      # [M2] 404 Route handler
    │   │
    │   ├── validations/                # Request validation schemas (Zod)
    │   │   ├── authValidation.js       # [M2] Strict schemas for register/login (rejects admin)
    │   │   ├── donationValidation.js   # [M2] Strict schemas for donation create/update
    │   │   ├── requirementValidation.js# [M2] Strict schemas for recipient requirements
    │   │   ├── matchValidation.js      # [M3] Validation schemas for matching/acceptance
    │   │   ├── pickupValidation.js     # [M4] Validation schemas for pickup & safety checks
    │   │   └── ratingValidation.js     # [M4] Validation schemas for ratings
    │   │
    │   ├── models/                     # Mongoose Schemas & Models
    │   │   ├── User.js                 # [M2] User account, auth, role, isActive, isVerified
    │   │   ├── Donation.js             # [M2] Food donation post & status history (OWNED ONLY BY M2)
    │   │   ├── Acceptance.js           # [M3] Acceptance sub-schema & claim lifecycle (OWNED BY M3)
    │   │   ├── RecipientRequirement.js # [M2 Foundation / M3 Matching] NGO food needs
    │   │   ├── Pickup.js               # [M4] Pickup schedule, driver assignment, QR tokens
    │   │   └── Rating.js               # [M4] Trust rating & feedback
    │   │
    │   ├── controllers/                # Business logic handlers (STRICT ISOLATION)
    │   │   ├── authController.js       # [M2] Register, login, me, logout (token discard)
    │   │   ├── adminController.js      # [M2] User verify, deactivate, platform oversight
    │   │   ├── donationController.js   # [M2] Donor CRUD, status history, donor cancel
    │   │   ├── requirementController.js# [M2] Recipient requirements CRUD
    │   │   ├── dashboardController.js  # [M2] Impact aggregation & summary metrics
    │   │   ├── healthController.js     # [M2] GET /api/v1/health system check
    │   │   ├── matchController.js      # [M3] Smart match, full/partial accept, cancel accept
    │   │   ├── pickupController.js     # [M4] Pickup scheduling, QR verify, safety check
    │   │   ├── ratingController.js     # [M4] Post-handover ratings
    │   │   └── notificationController.js# [Stub - Team Decision] Alert notifications & AI call
    │   │
    │   ├── services/                   # Heavy domain logic / external APIs
    │   │   ├── authService.js          # [M2] Token generation, password hashing
    │   │   ├── matchingService.js      # [M3] Location & urgency ranking score engine
    │   │   ├── qrService.js            # [M4] Secure HMAC QR token generation & check
    │   │   ├── safetyCheckService.js   # [M4] Pre-pickup & drop-off food safety checklist
    │   │   └── aiCallService.js        # [Stub - Team Decision] Automated AI phone alerts
    │   │
    │   └── routes/                     # Router modules
    │       ├── index.js                # [M2] Master router mounting all sub-routes at /api/v1
    │       ├── authRoutes.js           # [M2] /api/v1/auth
    │       ├── adminRoutes.js          # [M2] /api/v1/admin
    │       ├── donationRoutes.js       # [M2] /api/v1/donations (ordered routes)
    │       ├── requirementRoutes.js    # [M2] /api/v1/requirements
    │       ├── dashboardRoutes.js      # [M2] /api/v1/dashboard
    │       ├── healthRoutes.js         # [M2] /api/v1/health
    │       ├── matchRoutes.js          # [M3] /api/v1/matches (and acceptance routes)
    │       ├── pickupRoutes.js         # [M4] /api/v1/pickups
    │       ├── ratingRoutes.js         # [M4] /api/v1/ratings
    │       └── notificationRoutes.js   # [Stub] /api/v1/notifications
    │
    └── tests/                          # Integration & Unit Tests (IN-MEMORY DB ONLY)
        ├── setup.js                    # [M2] mongodb-memory-server lifecycle hooks
        ├── auth.test.js                # [M2] Auth, RBAC, unverified & admin rejection tests
        ├── donation.test.js            # [M2] Donation lifecycle, mass assignment, owner tests
        ├── privacy.test.js             # [M2] PII address/phone redaction tests
        ├── concurrency.test.js         # [M2/M3] Partial acceptance atomic race condition tests
        ├── cancelAcceptance.test.js    # [M2/M3] Cancel acceptance restores quantity tests
        ├── expiry.test.js              # [M2] Expiry barrier & $expr filter tests
        ├── match.test.js               # [M3] Matching logic tests
        └── pickup.test.js              # [M4] QR verification & safety check tests
```

---

## 2. Shared Foundations & Common Contracts

### A. Roles (`src/constants/roles.js`)
```javascript
const ROLES = Object.freeze({
  DONOR: 'donor',
  RECIPIENT: 'recipient',
  DELIVERY_AGENT: 'delivery_agent',
  ADMIN: 'admin',
});

// Allowed roles for public self-registration (Admin forbidden)
const PUBLIC_REGISTRATION_ROLES = Object.freeze([
  ROLES.DONOR,
  ROLES.RECIPIENT,
  ROLES.DELIVERY_AGENT,
]);

module.exports = { ROLES, PUBLIC_REGISTRATION_ROLES };
```

### B. Donation & Acceptance Statuses (`src/constants/status.js`)
```javascript
// Donation-level lifecycle status (derived/aggregate)
const DONATION_STATUS = Object.freeze({
  AVAILABLE: 'AVAILABLE',                   // Open for matching/acceptance
  PARTIALLY_ACCEPTED: 'PARTIALLY_ACCEPTED', // Part claimed, remainder open
  ACCEPTED: 'ACCEPTED',                     // 100% quantity claimed
  PICKUP_SCHEDULED: 'PICKUP_SCHEDULED',     // Logistics window created
  PICKED_UP: 'PICKED_UP',                   // Food collected, in transit
  HANDOVER_VERIFIED: 'HANDOVER_VERIFIED',   // QR verified at drop-off
  COMPLETED: 'COMPLETED',                   // Delivered + safety verified [FINAL]
  CANCELLED: 'CANCELLED',                   // Revoked by donor before pickup [FINAL]
  REOPENED: 'REOPENED',                     // Reopened after cancellation/rematch
  EXPIRED: 'EXPIRED',                       // Passed effective expiry [FINAL]
  REMATCHING: 'REMATCHING',                 // Automated rematching active
});

// Acceptance-level sub-record lifecycle status (Member 3 & 4)
const ACCEPTANCE_STATUS = Object.freeze({
  CLAIMED: 'CLAIMED',                       // Claim placed by recipient
  PICKUP_SCHEDULED: 'PICKUP_SCHEDULED',     // Logistics window set
  PICKED_UP: 'PICKED_UP',                   // Collected from donor
  HANDOVER_VERIFIED: 'HANDOVER_VERIFIED',   // QR verified at recipient site
  COMPLETED: 'COMPLETED',                   // Final safety check passed [FINAL]
  CANCELLED: 'CANCELLED',                   // Cancelled before pickup [FINAL]
  REJECTED_UNSAFE: 'REJECTED_UNSAFE',       // Failed safety check; compost/disposal [FINAL]
});

const FINAL_DONATION_STATUSES = Object.freeze([
  DONATION_STATUS.COMPLETED,
  DONATION_STATUS.CANCELLED,
  DONATION_STATUS.EXPIRED,
]);

const FINAL_ACCEPTANCE_STATUSES = Object.freeze([
  ACCEPTANCE_STATUS.COMPLETED,
  ACCEPTANCE_STATUS.CANCELLED,
  ACCEPTANCE_STATUS.REJECTED_UNSAFE,
]);

module.exports = {
  DONATION_STATUS,
  ACCEPTANCE_STATUS,
  FINAL_DONATION_STATUSES,
  FINAL_ACCEPTANCE_STATUSES,
};
```

### C. Meal Conversion Constants (`src/constants/metrics.js`)
Configurable food-to-meal conversion multipliers:
```javascript
const MEAL_CONVERSION_RATIOS = Object.freeze({
  plates: 1.0,     // 1 plate = 1 meal
  servings: 1.0,   // 1 serving = 1 meal
  packets: 1.0,    // 1 packet = 1 meal
  kg: 2.5,         // 1 kg = 2.5 meals (standard 400g nutrition baseline)
});

module.exports = { MEAL_CONVERSION_RATIOS };
```

### D. Standard Response Envelope (`src/utils/ApiResponse.js`)
All successful HTTP responses return this uniform JSON structure:

```json
{
  "success": true,
  "message": "Operation completed successfully",
  "data": { ... },
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 45,
    "totalPages": 5
  }
}
```

Implementation helper:
```javascript
class ApiResponse {
  constructor(statusCode, message, data = null, meta = null) {
    this.success = statusCode < 400;
    this.message = message;
    if (data !== null) this.data = data;
    if (meta !== null) this.meta = meta;
  }

  static send(res, statusCode, message, data = null, meta = null) {
    return res.status(statusCode).json(new ApiResponse(statusCode, message, data, meta));
  }
}

module.exports = ApiResponse;
```

### E. Standard Error Envelope & Error Catalog (`src/utils/ApiError.js`)
All operational errors return this uniform JSON structure:

```json
{
  "success": false,
  "error": {
    "code": "INSUFFICIENT_QUANTITY",
    "message": "Requested quantity exceeds remaining available quantity (Available: 15, Requested: 25)",
    "details": [
      {
        "field": "quantity",
        "issue": "Cannot accept more than 15 units"
      }
    ]
  }
}
```

Core Error Codes (`src/constants/errorCodes.js`):
* `UNAUTHORIZED` (401): Missing, malformed, or expired token.
* `FORBIDDEN` (403): Lacks permission for this resource or action.
* `UNVERIFIED_ACCOUNT` (403): Account requires admin verification.
* `DEACTIVATED_ACCOUNT` (403): Account has been disabled by admin.
* `NOT_FOUND` (404): Entity does not exist.
* `VALIDATION_ERROR` (400): Schema or parameter validation failed.
* `INVALID_ID` (400): Malformed MongoDB ObjectId.
* `CONFLICT` (409): Duplicate email or resource conflict.
* `INVALID_STATUS_TRANSITION` (409): Illegal state machine transition.
* `INSUFFICIENT_QUANTITY` (409): Claimed quantity exceeds available balance.
* `DONATION_EXPIRED` (410): Food passed effective expiry deadline.
* `FOOD_UNSAFE` (422): Food safety check failed; routed to disposal.
* `QR_VERIFICATION_FAILED` (400): Invalid or expired QR token.
* `INTERNAL_SERVER_ERROR` (500): Unhandled internal server exception.

### F. Global Error Middleware & Mongoose Error Mapping (`src/middlewares/errorHandler.js`)
The error handler maps known ODM and authentication errors to clean client responses:
1. **Mongoose `ValidationError`**: Formats into `400 VALIDATION_ERROR` with structured field messages.
2. **Mongoose `CastError`**: Formats invalid ObjectId lookups into `400 INVALID_ID`.
3. **MongoDB Duplicate Key (Code 11000)**: Formats into `409 CONFLICT` (e.g., email already exists).
4. **`JsonWebTokenError` / `TokenExpiredError`**: Formats into `401 UNAUTHORIZED`.
5. **Operational `ApiError`**: Emits the specified `statusCode` and `errorCode`.
6. **Unhandled Errors**: Emits `500 INTERNAL_SERVER_ERROR` (hiding stack traces in production).

---

## 3. Recommended Libraries & Technical Justifications

| Library | Role | Justification |
| :--- | :--- | :--- |
| **`express`** | Web Framework | Lightweight, modular REST framework. |
| **`mongoose`** | MongoDB ODM | Strict schema enforcement, hooks, and native GeoJSON `2dsphere` spatial indexing. |
| **`dotenv`** | Config Management | Loads environment variables safely from `.env` in local development. |
| **`bcryptjs`** | Password Hashing | **Essential Windows Decision**: `bcryptjs` is 100% pure JavaScript. Avoids Windows build errors requiring Visual Studio C++ build tools or Python that crash standard `bcrypt`. |
| **`jsonwebtoken`** | Auth Tokens | Stateless HMAC-SHA256 Bearer tokens with configurable expiration. |
| **`zod`** | Validation | Declarative, strict request schema validation. Strips unexpected fields to eliminate mass assignment risks. |
| **`helmet`** | HTTP Security | Sets essential security headers (`X-Content-Type-Options`, `Strict-Transport-Security`, etc.). |
| **`cors`** | Cross-Origin | Whitelists frontend URL (`http://localhost:5173` or production origin). |
| **`morgan`** | Request Logging | Standard HTTP request logger for endpoint debugging. |
| **`express-rate-limit`** | Rate Limiting | Mitigates brute-force attacks on `/api/v1/auth/login`. |
| **`mongodb-memory-server`** | In-Memory Testing | Spawns an isolated in-memory MongoDB daemon per test run. **Never touches or corrupts the shared Atlas database.** |
| **`jest` + `supertest`** | Test Runner | Fast HTTP pipeline integration testing directly against Express `app`. |

---

## 4. Environment Variables Specification

The project requires a `.env.example` file checked into Git. **No secret values or real credentials must ever be committed.**

List of required environment variable **NAMES**:

```bash
# Server Configuration
NODE_ENV
PORT

# Database
MONGODB_URI
MONGODB_URI_TEST

# Client / CORS
CLIENT_URL

# Authentication & Security
JWT_SECRET
JWT_EXPIRES_IN
BCRYPT_SALT_ROUNDS

# Domain Rules & Safety Buffers
SAFETY_BUFFER_MINUTES_DEFAULT

# Feature Integrations (Future / Stubs)
QR_SIGNING_SECRET
CLOUDINARY_URL
AI_CALL_API_KEY
```
