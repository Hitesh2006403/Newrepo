# Share A Plate – Teammate Integration Guide (Member 3 & Member 4)

> **Target Audience**: Member 3 (Matching & Partial Acceptance) & Member 4 (Logistics, QR, Safety Checks & Ratings)  
> **Maintained by**: Member 2 (Backend Foundation & Data Models)  
> **Base Path**: `/api/v1`

---

## 1. Ownership Boundaries & File Responsibilities

To avoid merge conflicts while 4 engineers commit in parallel, each member owns dedicated, isolated files:

### A. Allowed Files by Member

| Member | Domain | Dedicated Files to Create / Edit |
| :--- | :--- | :--- |
| **Member 2** | Foundation, Auth, Donations, Recipient Requirements, Dashboards | `src/models/Donation.js`, `src/models/RecipientRequirement.js`, `src/models/User.js`, `src/controllers/donationController.js`, `src/controllers/requirementController.js`, `src/controllers/dashboardController.js`, `src/controllers/adminUserController.js`, `src/routes/donationRoutes.js`, `src/routes/requirementRoutes.js`, `src/routes/dashboardRoutes.js`, `src/routes/adminRoutes.js`, `src/services/donationStateService.js`, `src/services/expirySweeper.js`, `src/utils/*`, `src/middlewares/*`, `src/constants/*`. |
| **Member 3** | Matching Engine, Atomic Partial Accept, Rematching | `src/models/Acceptance.js` *(stub provided by M2)*, `src/services/matchingService.js`, `src/controllers/matchController.js`, `src/routes/matchRoutes.js`, `src/validations/matchValidation.js`, `tests/match.test.js`, `tests/concurrency.test.js`. |
| **Member 4** | Logistics, QR Verification, Safety Checks, Ratings | `src/models/Pickup.js`, `src/models/Rating.js`, `src/services/qrService.js`, `src/services/safetyService.js`, `src/controllers/pickupController.js`, `src/controllers/ratingController.js`, `src/routes/pickupRoutes.js`, `src/routes/ratingRoutes.js`, `src/validations/pickupValidation.js`, `src/validations/ratingValidation.js`, `tests/pickup.test.js`, `tests/safety.test.js`. |

### B. Files You Must NOT Edit
- **Core Models**: `src/models/Donation.js`, `src/models/User.js`, `src/models/RecipientRequirement.js`
- **Shared Middleware & Utilities**: `src/middlewares/*`, `src/utils/*`, `src/constants/*`
- **Configuration & Server Root**: `src/config/db.js`, `server.js`, `app.js`

> [!IMPORTANT]
> **Need a schema or constant change?** Do not edit these files directly. Open an issue or message Member 2 to extend `AcceptanceSchema`, add fields to `Donation`, or add status enums to `status.js`.

---

## 2. Standard Imports & Usage

Always reuse existing core foundation primitives:

```javascript
// 1. Authentication, Roles & Verification Middlewares
const { protect } = require('../middlewares/authMiddleware');
const authorizeRoles = require('../middlewares/roleMiddleware');
const requireVerified = require('../middlewares/verificationMiddleware');
const validate = require('../middlewares/validateMiddleware');

// 2. Constants
const { ROLES } = require('../constants/roles');
const { DONATION_STATUS, ACCEPTANCE_STATUS, REQUIREMENT_STATUS } = require('../constants/status');
const ERROR_CODES = require('../constants/errorCodes');

// 3. Response & Error Utilities
const ApiResponse = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');

// 4. Privacy View & State Helpers
const { toDonationView } = require('../utils/donationView');
const {
  assertTransition,
  appendHistory,
  isExpired,
  computeCountdown,
  deriveDonationStatus,
} = require('../services/donationStateService');
```

### Route Mounting Pattern
Always protect routes explicitly:
```javascript
router.post(
  '/:id/accept',
  protect,
  authorizeRoles(ROLES.RECIPIENT, ROLES.ADMIN),
  requireVerified,
  validate(acceptDonationSchema),
  matchController.acceptDonation
);
```

### Controller Input Access (`req.validated`)
In Express 5, `req.query` and `req.params` are read-only. `validateMiddleware` populates `req.validated`:
```javascript
const { requestedQuantity, pickupPreference } = req.validated.body;
const { id } = req.validated.params;
```

---

## 3. Core Architecture Rules & Security Invariants

1. **Atomic Conditional Updates**: Every state change MUST be executed via a single conditional atomic `findOneAndUpdate` or `updateMany`. Never perform read-then-write logic (`findById` followed by `.save()`) for state transitions.
2. **Current State in Query Filter**: Always include the expected current status in the update filter. If another worker or request changed the status concurrently, the atomic query returns `null`; catch this and throw `409 INVALID_STATUS_TRANSITION`.
3. **Audit History in Same Update**: Every status change must `$push` an entry into `statusHistory` in the exact same database operation.
4. **Dynamic Expiry Check Inside Filter**: Always filter out expired donations using `$expr` before matching, claiming, or delivering:
   `{ $expr: { $gt: [{ $subtract: ['$expiryAt', { $multiply: [{ $ifNull: ['$safetyBufferMinutes', 60] }, 60000] }] }, new Date()] } }`
5. **Never Trust Client Claims**: Never accept status, match scores, or remaining quantities from the client request. Always calculate balances server-side.
6. **Completion Guard**: A donation or acceptance reaches `COMPLETED` strictly after drop-off QR verification AND a passed safety inspection (`visualSpoilageOrSmell !== true` and `passed === true`).
7. **Never Deliver Expired Food**: If food crosses `effectiveExpiryAt` during transit or handover verification, it must fail with `410 DONATION_EXPIRED` and route to disposal.
8. **Required Acceptance Timestamps**: Member 3 MUST set `claimedAt` when creating an acceptance; Member 4 MUST set `handoverVerifiedAt` and `completedAt` on an acceptance (the platform impact metrics depend directly on them).

---

## 4. Code Skeletons

### Pattern A: Member 3 – Atomic Partial Acceptance
```javascript
// POST /api/v1/donations/:id/accept
const acceptDonation = asyncHandler(async (req, res) => {
  const { id } = req.validated.params;
  const { requestedQuantity, pickupPreference, requirementId } = req.validated.body;
  const now = new Date();

  // 1. Single atomic conditional findOneAndUpdate
  const updatedDonation = await Donation.findOneAndUpdate(
    {
      _id: id,
      // Status must be available or partially claimed
      status: { $in: [DONATION_STATUS.AVAILABLE, DONATION_STATUS.PARTIALLY_ACCEPTED, DONATION_STATUS.REOPENED] },
      // Quantity must be sufficient
      remainingQuantity: { $gte: requestedQuantity },
      // Must not be expired (per-donation dynamic safety buffer)
      $expr: {
        $gt: [
          { $subtract: ['$expiryAt', { $multiply: [{ $ifNull: ['$safetyBufferMinutes', 60] }, 60000] }] },
          now,
        ],
      },
    },
    [
      {
        $set: {
          remainingQuantity: { $subtract: ['$remainingQuantity', requestedQuantity] },
          status: {
            $cond: {
              if: { $eq: [{ $subtract: ['$remainingQuantity', requestedQuantity] }, 0] },
              then: DONATION_STATUS.ACCEPTED,
              else: DONATION_STATUS.PARTIALLY_ACCEPTED,
            },
          },
          acceptances: {
            $concatArrays: [
              '$acceptances',
              [
                {
                  _id: new mongoose.Types.ObjectId(),
                  recipientId: req.user._id,
                  requirementId: requirementId ? new mongoose.Types.ObjectId(requirementId) : null,
                  quantity: requestedQuantity,
                  status: ACCEPTANCE_STATUS.CLAIMED,
                  pickupPreference,
                  claimedAt: now,
                },
              ],
            ],
          },
          statusHistory: {
            $concatArrays: [
              '$statusHistory',
              [
                {
                  status: {
                    $cond: {
                      if: { $eq: [{ $subtract: ['$remainingQuantity', requestedQuantity] }, 0] },
                      then: DONATION_STATUS.ACCEPTED,
                      else: DONATION_STATUS.PARTIALLY_ACCEPTED,
                    },
                  },
                  changedBy: req.user._id,
                  note: `Claimed ${requestedQuantity} units`,
                  timestamp: now,
                },
              ],
            ],
          },
        },
      },
    ],
    { returnDocument: 'after' }
  );

  if (!updatedDonation) {
    throw new ApiError(
      409,
      ERROR_CODES.INSUFFICIENT_QUANTITY,
      'Donation has expired or has insufficient remaining quantity'
    );
  }

  return ApiResponse.send(res, 200, 'Donation accepted', toDonationView(updatedDonation, req.user));
});
```

### Pattern B: Member 4 – Handover Verification & Completion
```javascript
// POST /api/v1/pickups/:id/verify-handover-qr
const verifyHandoverQr = asyncHandler(async (req, res) => {
  const { id } = req.validated.params;
  const now = new Date();

  // 1. Verify pickup & donation validity with expiry guard
  const updatedDonation = await Donation.findOneAndUpdate(
    {
      _id: donationId,
      'acceptances._id': acceptanceId,
      'acceptances.status': ACCEPTANCE_STATUS.PICKED_UP,
      // Food safety invariant: effective expiry must not have elapsed
      $expr: {
        $gt: [
          { $subtract: ['$expiryAt', { $multiply: [{ $ifNull: ['$safetyBufferMinutes', 60] }, 60000] }] },
          now,
        ],
      },
    },
    {
      $set: {
        'acceptances.$[elem].status': ACCEPTANCE_STATUS.HANDOVER_VERIFIED,
        'acceptances.$[elem].handoverVerifiedAt': now,
      },
      $push: {
        statusHistory: {
          status: DONATION_STATUS.HANDOVER_VERIFIED,
          changedBy: req.user._id,
          note: 'Handover QR verified at recipient site',
          timestamp: now,
        },
      },
    },
    {
      arrayFilters: [{ 'elem._id': new mongoose.Types.ObjectId(acceptanceId) }],
      returnDocument: 'after',
    }
  );

  if (!updatedDonation) {
    throw new ApiError(
      410,
      ERROR_CODES.DONATION_EXPIRED,
      'Effective expiry passed before delivery or invalid acceptance state'
    );
  }

  return ApiResponse.send(res, 200, 'Handover verified', toDonationView(updatedDonation, req.user));
});
```

---

## 5. Test Template (`mongodb-memory-server`)

All tests must be offline and run against in-memory MongoDB without touching remote databases:

```javascript
// tests/sample.test.js
const request = require('supertest');
const app = require('../app');
const User = require('../src/models/User');
const Donation = require('../src/models/Donation');
const { ROLES } = require('../src/constants/roles');
const authService = require('../src/services/authService');

describe('Sample Test Suite', () => {
  let user, token;

  beforeEach(async () => {
    user = await User.create({
      name: 'Test User',
      email: 'test@domain.org',
      password: 'Password123!',
      role: ROLES.RECIPIENT,
      isVerified: true,
      isActive: true,
      location: { type: 'Point', coordinates: [77.59, 12.97] },
      address: { city: 'Bengaluru', formattedAddress: 'Bengaluru' },
    });
    token = authService.generateToken(user._id);
  });

  it('should execute authorized request', async () => {
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
```

### Running Tests
Inside `backend/`:
```bash
npm test
```

---

## 6. Standard Error Codes Table

Reuse existing error codes from `src/constants/errorCodes.js`:

| Error Code | HTTP Status | When to Use |
| :--- | :---: | :--- |
| `VALIDATION_ERROR` | 400 | Request body or query parameters failed Zod schema. |
| `CANNOT_DEACTIVATE_SELF` | 400 | Admin attempted self-deactivation. |
| `UNAUTHORIZED` | 401 | Missing, malformed, or expired JWT token. |
| `INVALID_CREDENTIALS` | 401 | Invalid email or password at login. |
| `FORBIDDEN` | 403 | User role is not permitted to perform action. |
| `UNVERIFIED_ACCOUNT` | 403 | Recipient or delivery agent is pending admin approval. |
| `DEACTIVATED_ACCOUNT` | 403 | Account `isActive: false`. |
| `NOT_FOUND` | 404 | Resource does not exist. |
| `CONFLICT` | 409 | Duplicate resource (e.g. email registered). |
| `INVALID_STATUS_TRANSITION` | 409 | Transition violates state machine or preconditions. |
| `INSUFFICIENT_QUANTITY` | 409 | Claim exceeds unallocated `remainingQuantity`. |
| `DONATION_EXPIRED` | 410 | Food crossed `effectiveExpiryAt`. |
| `FOOD_UNSAFE` | 422 | Food safety checklist failed; diverted to disposal. |
| `INTERNAL_ERROR` | 500 | Unhandled server exception. |

### How to Add a New Error Code
If you need a new error code (e.g., `INVALID_QR_CODE`):
1. Request Member 2 to add the key and value to `backend/src/constants/errorCodes.js`.
2. Use `throw new ApiError(400, ERROR_CODES.INVALID_QR_CODE, 'QR signature verification failed');`.

---

## 7. Extras & Teammate Utilities (Photos, Notifications & Privacy)

### A. Strict Address Privacy in Custom Views
When returning donation data to clients in Member 3 matching endpoints or Member 4 delivery listings:
* **Always pass through `toDonationView(donation, viewerUser)`** from `src/utils/donationView.js`.
* If `viewerUser` is not the donor, an admin, or an attached recipient/driver, `toDonationView` automatically:
  1. Sets `address.street = null`.
  2. Sets `address.formattedAddress` to a safe derived `area` string (`donation.areaLabel` or `${city}, ${state}`).
  3. Rounds coordinates to 2 decimal places.
  4. Redacts donor phone number.

### B. Donation Photo Uploads (`storageService.js`)
* Donors can attach up to 5 photos to a donation via `POST /api/v1/donations/:id/photos` (handled by Member 2).
* Photos are stored locally in `backend/uploads/` (or via Cloudinary if the adapter is replaced).
* Photo URLs stored on `donation.photos` are served through `/uploads/:filename` or `/api/v1/uploads/:filename`.

### C. Triggering In-App Notifications
Teammates can trigger notifications to donors, recipients, or delivery agents during matching and logistics workflows:
```javascript
const { createNotification } = require('../services/notificationService');

// Example: Member 3 notifying donor when food is claimed
await createNotification(
  donation.donorId,
  'CLAIMED',
  'Donation Claimed',
  `Your donation "${donation.foodName}" was claimed by ${recipientName}.`,
  donation._id
);

// Example: Member 4 notifying recipient when pickup is scheduled
await createNotification(
  recipientId,
  'PICKUP_SCHEDULED',
  'Pickup Scheduled',
  `Pickup has been scheduled for donation "${donation.foodName}".`,
  donation._id
);
```

### D. Automated Urgent AI Voice Call Stub
For ultra-urgent donations (< 15 min to expiry), Member 3's engine or Member 4's emergency rerouting can invoke:
```javascript
const { voiceCallService } = require('../services/voiceCallService');

// Outbound emergency alert stub
const callRecord = await voiceCallService.triggerUrgentCall({
  donationId: donation._id,
  recipientPhone: recipient.phone,
});
// Masked phone number logged and returned safely
```
