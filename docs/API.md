# Share A Plate – REST API Specification & Data Contracts

> **Project**: Share A Plate – Share More, Waste Less  
> **Status**: DRAFT CONTRACT FOR TEAM APPROVAL (REVISED)  
> **Author**: Member 2 (Backend Foundation & Authentication)  
> **Target Audience**: Full Team (Members 1, 2, 3, 4)  
> **Base Path**: `/api/v1`  
> **Date**: October 2026

---

## 1. Donation Status Lifecycle & Transition Table

### A. Status Vocabulary

#### Donation-Level Status (Derived Aggregate)
* `AVAILABLE`: Posted by donor; full quantity unreserved and open for matching.
* `PARTIALLY_ACCEPTED`: A recipient claimed part of the quantity; remainder is open for other recipients.
* `ACCEPTED`: 100% of the quantity claimed; awaiting pickup scheduling.
* `PICKUP_SCHEDULED`: Pickup window and delivery agent/recipient confirmed.
* `PICKED_UP`: Food collected from donor premises; in physical transit.
* `HANDOVER_VERIFIED`: Food arrived at recipient location; drop-off QR confirmed.
* `COMPLETED`: Handover verified + final safety check passed. **[FINAL]**
* `CANCELLED`: Withdrawn by donor before pickup. **[FINAL]**
* `REOPENED`: Returned to active discovery pool following a cancelled acceptance.
* `EXPIRED`: Food exceeded safe consumption deadline (`expiryAt - safetyBufferMinutes`). **[FINAL]**
* `REMATCHING`: System / Member 3 engine actively re-allocating after a drop/cancellation.

#### Acceptance-Level Status (`models/Acceptance.js` — Owned by Member 3)
Each partial or full acceptance slice has its own discrete lifecycle:
* `CLAIMED`: Portion claimed by recipient; logistics not yet scheduled.
* `PICKUP_SCHEDULED`: Logistics window set; driver or self-pickup assigned.
* `PICKED_UP`: Food picked up from donor premises.
* `HANDOVER_VERIFIED`: Food arrived at recipient drop-off point and QR verified.
* `COMPLETED`: Food delivered and final safety check passed. **[FINAL]**
* `CANCELLED`: Cancelled by recipient or admin before pickup. Restores quantity. **[FINAL]**
* `REJECTED_UNSAFE`: Failed safety check at pickup or drop. Routed to compost/disposal; NEVER delivered. **[FINAL]**

---

### B. Derived Donation Status Rule
The donation-level `status` is an aggregate derived from its `remainingQuantity` and the state of its `acceptances`:
1. If `remainingQuantity === totalQuantity` with 0 active acceptances:
   * If previously cancelled/rematched -> `REOPENED`.
   * Otherwise -> `AVAILABLE`.
2. If `0 < remainingQuantity < totalQuantity` -> `PARTIALLY_ACCEPTED`.
3. If `remainingQuantity === 0`:
   * If all active acceptances are `COMPLETED` -> `COMPLETED`.
   * If any active acceptance is in progress:
     * If any is `HANDOVER_VERIFIED` -> `HANDOVER_VERIFIED`.
     * Else if any is `PICKED_UP` -> `PICKED_UP`.
     * Else if any is `PICKUP_SCHEDULED` -> `PICKUP_SCHEDULED`.
     * Else -> `ACCEPTED`.
4. If all acceptances are `CANCELLED` and no active portions exist -> `REOPENED`.
5. If uncollected food crosses `effectiveExpiryAt` -> `EXPIRED`.

---

### C. Transition State Machine

| From Status | To Status | Allowed Trigger Role | Responsible Module | Preconditions / Rules | Is Final? |
| :--- | :--- | :--- | :--- | :--- | :---: |
| *(None)* | `AVAILABLE` | `donor` | Member 2 (Donation CRUD) | Initial post. `effectiveExpiryAt > now` and `pickupWindowEnd <= effectiveExpiryAt`. | No |
| `AVAILABLE` / `REOPENED` | `PARTIALLY_ACCEPTED` | `recipient` (verified) | Member 3 (Matching/Accept) | `0 < requestedQty < remainingQuantity`. Atomic update. | No |
| `AVAILABLE` / `REOPENED` | `ACCEPTED` | `recipient` (verified) | Member 3 (Matching/Accept) | `requestedQty === remainingQuantity`. Atomic update. | No |
| `PARTIALLY_ACCEPTED` | `PARTIALLY_ACCEPTED` | `recipient` (verified) | Member 3 (Matching/Accept) | Additional partial claim; `remainingQuantity > 0`. | No |
| `PARTIALLY_ACCEPTED` | `ACCEPTED` | `recipient` (verified) | Member 3 (Matching/Accept) | Final portion claimed; `remainingQuantity === 0`. | No |
| `AVAILABLE` / `PARTIALLY_ACCEPTED` | `CANCELLED` | `donor` (owner), `admin`| Member 2 (Donation CRUD) | Allowed only before pickup has occurred. | **YES** |
| `PARTIALLY_ACCEPTED` / `ACCEPTED` | `REOPENED` | `recipient` (owner), `admin`| Member 3 (Cancel Acceptance)| Recipient cancels claim before `PICKED_UP`. Restores quantity. | No |
| `ACCEPTED` | `PICKUP_SCHEDULED` | `delivery_agent` (verified), `recipient`, `admin` | Member 4 (Pickup Logistics) | Logistics window created; driver assigned. | No |
| `PICKUP_SCHEDULED` | `PICKED_UP` | `delivery_agent` (verified) | Member 4 (Pickup Logistics) | Donor location QR scanned; initial safety check passed. | No |
| `PICKED_UP` | `HANDOVER_VERIFIED` | `delivery_agent`, `recipient` | Member 4 (Pickup Logistics) | Drop-off QR scanned. Re-checks expiry; fails with 410 if expired. | No |
| `HANDOVER_VERIFIED` | `COMPLETED` | `recipient`, `admin` | Member 4 (Pickup Logistics) | Final safety check passed. Rating decoupled and optional. | **YES** |
| `PICKUP_SCHEDULED` / `PICKED_UP` | `REJECTED_UNSAFE` (Acceptance) | `delivery_agent`, `recipient` | Member 4 (Safety Checks) | Food spoiled/damaged; diverted to disposal/compost. Never delivered. | **YES** |
| `ACCEPTED` / `PICKUP_SCHEDULED` | `REMATCHING` | `admin` (or internal system)| Member 3 (Rematching Engine)| Drop/cancellation before pickup; system seeks alternate recipient. | No |
| `REMATCHING` | `AVAILABLE` / `REOPENED` | `admin` (or internal system)| Member 3 (Rematching Engine)| Released back to open pool if automated rematch finds no match. | No |
| `AVAILABLE`, `PARTIALLY_ACCEPTED`, `REOPENED`, `ACCEPTED`, `PICKUP_SCHEDULED` | `EXPIRED` | `system` (worker), `admin` | Member 2 Foundation | `now >= effectiveExpiryAt`. **Never applies once food is `PICKED_UP` or `COMPLETED`.** | **YES** |

---

## 2. Security, Privacy & Authorization Architecture

### A. Role & Account Verification Rules
1. **Public Self-Registration**: Restrictable to `donor`, `recipient`, and `delivery_agent`.
   * **Admin Role Restriction**: The `admin` role CANNOT be registered via `/api/v1/auth/register`. Admin accounts are created strictly via database seed scripts or by existing administrators. Any registration payload attempting `role: "admin"` is rejected with HTTP 400.
2. **Account Verification**:
   * Recipients and delivery agents default to `isVerified: false`.
   * Unverified recipients CANNOT accept donations or post urgent requirements.
   * Unverified delivery agents CANNOT be assigned to pickups or verify QR codes.
   * Only an `admin` can verify an account via `PATCH /api/v1/admin/users/:id/verify`.
3. **Account Activation (`isActive`)**:
   * Every user has an `isActive: Boolean` flag (default `true`).
   * An admin can deactivate accounts via `PATCH /api/v1/admin/users/:id/deactivate`.
   * Deactivated accounts are blocked immediately on all requests.

### B. Authentication Middleware (`authMiddleware`)
* Evaluates the HTTP header `Authorization: Bearer <token>`.
* **Database Check on Every Request**: The middleware queries `User.findById(decoded.id).select('+isActive')` on every call. It verifies:
  1. The user exists in the database.
  2. `user.isActive === true` (fails with `403 DEACTIVATED_ACCOUNT` if false).
* **Never Trust Token Role Alone**: The user's role is always populated from the fresh database record, preventing privilege escalation if a role was changed or revoked in the database.
* **Logout Strategy**: For the MVP, logout is handled by the client discarding the stored JWT. The endpoint `POST /api/v1/auth/logout` provides a clean client hook.

### C. Mass-Assignment Protection
All endpoints enforce strict input whitelisting using Zod. Unknown or unauthorized fields are stripped or rejected.
* **Forbidden Fields Across All Client Requests**:
  `status`, `remainingQuantity`, `donorId`, `recipientId`, `matchScore`, `statusHistory`, `isVerified`, `isActive`, `role` (after registration), and completion fields (`completedAt`, `handoverVerifiedAt`).
* **Allowed Fields on Donation Creation (`POST /api/v1/donations`)**:
  `foodName`, `foodType`, `dietaryType`, `totalQuantity`, `unit`, `cookedAt`, `expiryAt`, `safetyBufferMinutes`, `pickupWindowStart`, `pickupWindowEnd`, `packagingType`, `instructions`, `location`, `address`, `photos`.
* **Allowed Fields on Donation Update (`PATCH /api/v1/donations/:id`)**:
  Allowed **ONLY** while `status === 'AVAILABLE'` and `acceptances.length === 0`:
  `foodName`, `packagingType`, `instructions`, `pickupWindowEnd`, `photos`.
  *(Changes to totalQuantity, cookedAt, or expiryAt after creation are forbidden; donors must cancel and recreate to protect matching guarantees).*

### D. Data Visibility & PII Redaction
To protect donor privacy and prevent food hijacking, exact location and contact details are masked:
* **Full PII View** (Exact street, contact phone, exact coordinates):
  Visible ONLY to:
  1. The posting donor (`donation.donorId === req.user.id`).
  2. An administrator (`req.user.role === 'admin'`).
  3. A recipient or delivery agent attached to an active acceptance on that donation.
* **Public / Discovery View** (All unattached recipients, drivers, and general feed):
  * Coordinates: Rounded to 2 decimal places (~1.1 km approximate radius cell).
  * Address: The street address is completely omitted (`street: null`). `formattedAddress` is never returned as raw text; it is strictly replaced with a safe `area` string derived from structured fields (`areaLabel`, or `${city}, ${state}`), guaranteeing zero leakage regardless of formatting, casing, or abbreviations in street names.
  * Contact: Donor phone number is completely redacted (`null`).
  * Relative Distance: Dynamically computed strictly from the ROUNDED coordinates (never exact), rounded to 1 decimal place (`distanceKm`).
* `GET /api/v1/donations/:id` and `GET /api/v1/donations/available` enforce these exact redaction rules based on `req.user`.

### E. Standard Error Codes
All failure responses follow the standard JSON error envelope (`success: false, error: { code, message, details }`). System error codes include:
* `VALIDATION_ERROR` (400): Schema validation failure or malformed payload.
* `CANNOT_DEACTIVATE_SELF` (400): Administrator attempted self-deactivation.
* `UNAUTHORIZED` (401): Missing, malformed, or expired token.
* `INVALID_CREDENTIALS` (401): Email or password mismatch.
* `FORBIDDEN` (403): User role lacks permission.
* `UNVERIFIED_ACCOUNT` (403): Recipient or driver pending admin verification.
* `DEACTIVATED_ACCOUNT` (403): Account deactivated by administrator.
* `NOT_FOUND` (404): Resource not found.
* `CONFLICT` (409): Duplicate email or resource conflict.
* `INVALID_STATUS_TRANSITION` (409): Illegal lifecycle transition or race conflict.
* `INSUFFICIENT_QUANTITY` (409): Claimed quantity exceeds available balance.
* `DONATION_EXPIRED` (410): Food exceeded safe consumption deadline (`effectiveExpiryAt`).
* `FOOD_UNSAFE` (422): Food safety check failed; diverted to disposal.
* `INTERNAL_SERVER_ERROR` (500): Server exception.

---

## 3. Authorization Matrix

| Endpoint | Method | Public | Donor | Recipient | Delivery Agent | Admin | Ownership & Rule Constraints |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| `/api/v1/health` | GET | ✅ | ✅ | ✅ | ✅ | ✅ | No auth required |
| `/api/v1/auth/register` | POST | ✅ | ❌ | ❌ | ❌ | ❌ | Allowed roles: donor, recipient, delivery_agent |
| `/api/v1/auth/login` | POST | ✅ | ❌ | ❌ | ❌ | ❌ | Unauthenticated |
| `/api/v1/auth/logout` | POST | ❌ | ✅ | ✅ | ✅ | ✅ | Any authenticated session |
| `/api/v1/auth/me` | GET | ❌ | ✅ | ✅ | ✅ | ✅ | Returns `req.user` |
| `/api/v1/donations/available` | GET | ❌ | ❌ | ✅ | ✅ | ✅ | Recipients & drivers. Declared BEFORE `/:id` |
| `/api/v1/donations/my` | GET | ❌ | ✅ | ❌ | ❌ | ✅ | Owner only (`donorId = req.user.id`). Declared BEFORE `/:id` |
| `/api/v1/donations` | POST | ❌ | ✅ | ❌ | ❌ | ✅ | Donors only. Strict mass-assignment check |
| `/api/v1/donations` | GET | ❌ | ✅ | ✅ | ✅ | ✅ | Filtered listing; PII redacted for non-owners |
| `/api/v1/donations/:id` | GET | ❌ | ✅ | ✅ | ✅ | ✅ | PII redacted unless donor, admin, or attached recipient/driver |
| `/api/v1/donations/:id` | PATCH | ❌ | ✅ | ❌ | ❌ | ✅ | Owner only; allowed ONLY when status = `AVAILABLE` and 0 acceptances |
| `/api/v1/donations/:id/photos` | POST | ❌ | ✅ | ❌ | ❌ | ❌ | Donor owner only; allowed ONLY when status = `AVAILABLE` and 0 acceptances |
| `/api/v1/donations/:id/cancel` | POST | ❌ | ✅ | ❌ | ❌ | ✅ | Owner only; before pickup |
| `/api/v1/donations/:id/status-history`| GET | ❌ | ✅ | ✅ | ✅ | ✅ | Parties attached to donation |
| `/api/v1/donations/:id/accept` | POST | ❌ | ❌ | ✅ | ❌ | ✅ | **Verified** recipients only *(Member 3 stub)* |
| `/api/v1/donations/:id/acceptances/:accId/cancel`| POST | ❌ | ❌ | ✅ | ❌ | ✅ | Recipient owner or admin, before `PICKED_UP` *(Member 3 stub)* |
| `/api/v1/donations/:id/rematch`| POST | ❌ | ❌ | ❌ | ❌ | ✅ | **Admin only** via HTTP *(Member 3 stub)* |
| `/api/v1/requirements` | POST | ❌ | ❌ | ✅ | ❌ | ✅ | **Verified** recipients only |
| `/api/v1/requirements` | GET | ❌ | ✅ | ✅ | ✅ | ✅ | Filter by location/food type |
| `/api/v1/requirements/:id` | GET | ❌ | ✅ | ✅ | ✅ | ✅ | Authenticated |
| `/api/v1/pickups/schedule` | POST | ❌ | ❌ | ✅ | ✅ | ✅ | Verified recipient or driver *(Member 4 stub)* |
| `/api/v1/pickups/:id` | GET | ❌ | ✅ | ✅ | ✅ | ✅ | Attached parties only *(Member 4 stub)* |
| `/api/v1/pickups/:id/verify-pickup-qr`| POST| ❌ | ❌ | ❌ | ✅ | ✅ | Assigned verified driver *(Member 4 stub)* |
| `/api/v1/pickups/:id/safety-check`| POST | ❌ | ❌ | ✅ | ✅ | ✅ | Driver / Recipient *(Member 4 stub)* |
| `/api/v1/pickups/:id/verify-handover-qr`| POST| ❌ | ❌ | ✅ | ✅ | ✅ | Recipient / Driver *(Member 4 stub)* |
| `/api/v1/ratings` | POST | ❌ | ✅ | ✅ | ❌ | ✅ | Decoupled; post-completion *(Member 4 stub)* |
| `/api/v1/notifications` | GET | ❌ | ✅ | ✅ | ✅ | ✅ | Authenticated; user's own in-app notification feed |
| `/api/v1/notifications/:id/read` | PATCH | ❌ | ✅ | ✅ | ✅ | ✅ | Notification owner only (IDOR protected) |
| `/api/v1/notifications/read-all` | PATCH | ❌ | ✅ | ✅ | ✅ | ✅ | Authenticated; marks all own notifications read |
| `/api/v1/notifications/ai-call/trigger` | POST | ❌ | ❌ | ❌ | ❌ | ✅ | Admin only; urgent outbound telephony alert |
| `/api/v1/notifications/ai-call/:id` | GET | ❌ | ✅ | ✅ | ❌ | ✅ | Admin or recipient target user |
| `/uploads/:filename` | GET | ✅ | ✅ | ✅ | ✅ | ✅ | Public static; UUID/safe filename whitelist, nosniff |
| `/api/v1/dashboard/impact` | GET | ✅ | ✅ | ✅ | ✅ | ✅ | Public aggregated statistics (rate-limited, 60s cache) |
| `/api/v1/dashboard/donor` | GET | ❌ | ✅ | ❌ | ❌ | ✅ | Donor only; personal donation metrics |
| `/api/v1/dashboard/recipient` | GET | ❌ | ❌ | ✅ | ❌ | ✅ | Verified recipients only; demand & claims metrics |
| `/api/v1/admin/users/:id/verify` | PATCH | ❌ | ❌ | ❌ | ❌ | ✅ | Admin only |
| `/api/v1/admin/users/:id/deactivate` | PATCH | ❌ | ❌ | ❌ | ❌ | ✅ | Admin only |
| `/api/v1/admin/donations` | GET | ❌ | ❌ | ❌ | ❌ | ✅ | Admin only |

---

## 4. Endpoint Specifications

### A. System Health

#### 1. System Health Check
* **Method & Path**: `GET /api/v1/health`
* **Auth**: Public
* **Response (200 OK)**:
```json
{
  "success": true,
  "message": "System operational",
  "data": {
    "status": "UP",
    "uptime": 1420,
    "timestamp": "2026-10-10T12:00:00.000Z"
  }
}
```

---

### B. Authentication & User Profile (`Member 2`)

#### 1. Register User
* **Method & Path**: `POST /api/v1/auth/register`
* **Auth**: Public
* **Rules**: Only roles `donor`, `recipient`, `delivery_agent` accepted. `admin` rejected. `isVerified` defaults to `false` for recipients and drivers. `isActive` defaults to `true`.
* **Request Body**:
```json
{
  "name": "Sunshine Orphanage",
  "email": "contact@sunshine.org",
  "password": "Password123!",
  "role": "recipient",
  "phone": "+919876543210",
  "location": {
    "type": "Point",
    "coordinates": [77.5946, 12.9716]
  },
  "address": {
    "street": "12 Bannerghatta Road",
    "city": "Bengaluru",
    "state": "Karnataka",
    "postalCode": "560076",
    "formattedAddress": "12 Bannerghatta Road, Bengaluru, Karnataka 560076"
  },
  "organization": {
    "name": "Sunshine Trust",
    "regNo": "REG-BLR-2024-998",
    "capacity": 85
  }
}
```
* **Response (201 Created)**:
```json
{
  "success": true,
  "message": "User registered successfully",
  "data": {
    "user": {
      "id": "6707c5a0b12345678901234a",
      "name": "Sunshine Orphanage",
      "email": "contact@sunshine.org",
      "role": "recipient",
      "phone": "+919876543210",
      "isVerified": false,
      "isActive": true,
      "createdAt": "2026-10-10T10:00:00.000Z"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

#### 2. Login User
* **Method & Path**: `POST /api/v1/auth/login`
* **Auth**: Public
* **Request Body**:
```json
{
  "email": "contact@sunshine.org",
  "password": "Password123!"
}
```
* **Response (200 OK)**:
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": "6707c5a0b12345678901234a",
      "name": "Sunshine Orphanage",
      "email": "contact@sunshine.org",
      "role": "recipient",
      "isVerified": false,
      "isActive": true
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

#### 3. Current User (`me`)
* **Method & Path**: `GET /api/v1/auth/me`
* **Auth**: Bearer Token required
* **Response (200 OK)**: Returns authenticated user profile without password hash.

#### 4. Logout User
* **Method & Path**: `POST /api/v1/auth/logout`
* **Auth**: Bearer Token required
* **Response (200 OK)**:
```json
{
  "success": true,
  "message": "Logged out successfully (token discarded client-side)"
}
```

---

### C. Admin User Governance (`Member 2`)

#### 1. Verify User Account
* **Method & Path**: `PATCH /api/v1/admin/users/:id/verify`
* **Auth**: Bearer Token (`admin` only)
* **Response (200 OK)**: Sets `isVerified: true`.

#### 2. Deactivate User Account
* **Method & Path**: `PATCH /api/v1/admin/users/:id/deactivate`
* **Auth**: Bearer Token (`admin` only)
* **Response (200 OK)**: Sets `isActive: false`.

---

### D. Food Donation Management (`Member 2`)

> **CRITICAL ROUTE ORDERING**: Express matches routes sequentially. The specific routes `GET /api/v1/donations/available` and `GET /api/v1/donations/my` MUST be declared in code **BEFORE** `GET /api/v1/donations/:id` to prevent route collision.

#### 1. List Available Donations
* **Method & Path**: `GET /api/v1/donations/available`
* **Auth**: Bearer Token (`recipient`, `delivery_agent`, `admin`)
* **Description**: Queries donations where `status IN ['AVAILABLE', 'PARTIALLY_ACCEPTED', 'REOPENED']`, `remainingQuantity > 0`, and `now < effectiveExpiryAt`. Returns approximate area and calculated `distanceKm` (exact street address and phone redacted).

#### 2. List Donor's Own Donations
* **Method & Path**: `GET /api/v1/donations/my`
* **Auth**: Bearer Token (`donor`)
* **Description**: Returns all donations where `donorId === req.user.id`.

#### 3. Create Donation
* **Method & Path**: `POST /api/v1/donations`
* **Auth**: Bearer Token (`donor` or `admin`)
* **Validation Invariants**:
  1. `effectiveExpiryAt = expiryAt - (safetyBufferMinutes * 60000)` must be `> now`.
  2. `pickupWindowEnd` must be `<= effectiveExpiryAt`.
* **Request Body**:
```json
{
  "foodName": "Fresh Vegetable Biryani & Raita",
  "foodType": "cooked_meals",
  "totalQuantity": 50,
  "unit": "plates",
  "dietaryType": "vegetarian",
  "cookedAt": "2026-10-10T12:00:00.000Z",
  "expiryAt": "2026-10-10T20:00:00.000Z",
  "safetyBufferMinutes": 60,
  "pickupWindowStart": "2026-10-10T13:00:00.000Z",
  "pickupWindowEnd": "2026-10-10T18:00:00.000Z",
  "packagingType": "sealed_containers",
  "instructions": "Please bring insulated carriers. Gate 2 entry.",
  "photos": [
    "https://res.cloudinary.com/shareaplate/image/upload/v1/biryani1.jpg"
  ],
  "location": {
    "type": "Point",
    "coordinates": [77.5946, 12.9716]
  },
  "address": {
    "street": "Grand Royal Banquet Hall, 8th Block",
    "city": "Bengaluru",
    "state": "Karnataka",
    "postalCode": "560082",
    "formattedAddress": "Grand Royal Banquet Hall, Jayanagar 8th Block, Bengaluru"
  }
}
```
* **Response (201 Created)**:
```json
{
  "success": true,
  "message": "Donation created successfully",
  "data": {
    "donation": {
      "id": "6707c91fb12345678901234b",
      "donorId": "6707c5a0b12345678901234a",
      "foodName": "Fresh Vegetable Biryani & Raita",
      "foodType": "cooked_meals",
      "totalQuantity": 50,
      "remainingQuantity": 50,
      "unit": "plates",
      "status": "AVAILABLE",
      "cookedAt": "2026-10-10T12:00:00.000Z",
      "expiryAt": "2026-10-10T20:00:00.000Z",
      "safetyBufferMinutes": 60,
      "effectiveExpiryAt": "2026-10-10T19:00:00.000Z",
      "secondsToEffectiveExpiry": 23400,
      "urgencyLevel": "NORMAL",
      "photos": [
        "https://res.cloudinary.com/shareaplate/image/upload/v1/biryani1.jpg"
      ],
      "statusHistory": [
        {
          "status": "AVAILABLE",
          "changedBy": "6707c5a0b12345678901234a",
          "note": "Donation published by donor",
          "timestamp": "2026-10-10T12:30:00.000Z"
        }
      ],
      "createdAt": "2026-10-10T12:30:00.000Z"
    }
  }
}
```

#### 4. List Donations (With Filters & Pagination)
* **Method & Path**: `GET /api/v1/donations`
* **Query Params**: `?status=AVAILABLE&foodType=cooked_meals&page=1&limit=10&lat=12.97&lng=77.59&maxDistanceKm=10`
* **Data Visibility Rule**: Non-owners receive redacted street address and masked phone.

#### 5. Get Single Donation
* **Method & Path**: `GET /api/v1/donations/:id`
* **Data Visibility Rule**: Full PII (exact street address, donor phone number) is returned ONLY if `req.user` is the donor, an admin, or a recipient/driver with an active acceptance on this donation. All others receive redacted area info and computed distance.
* **Response (200 OK)** includes `secondsToEffectiveExpiry` and `urgencyLevel`.

#### 6. Update Donation (Restricted)
* **Method & Path**: `PATCH /api/v1/donations/:id`
* **Auth**: Bearer Token (`donor` owner or `admin`)
* **Rule**: Allowed **ONLY** if `status === 'AVAILABLE'` and `acceptances.length === 0`.
* **Allowed Update Fields**: `foodName`, `packagingType`, `instructions`, `pickupWindowEnd`, `photos`.
* Attempts to update `totalQuantity`, `expiryAt`, or update after an acceptance has occurred are rejected with HTTP 409 `CONFLICT` or `INVALID_STATUS_TRANSITION`.

#### 7. Cancel Donation
* **Method & Path**: `POST /api/v1/donations/:id/cancel`
* **Auth**: Bearer Token (`donor` owner or `admin`)
* **Rule**: Allowed only before food has been picked up. Transitions status to `CANCELLED`.

#### 8. Status History Audit Trail
* **Method & Path**: `GET /api/v1/donations/:id/status-history`
* **Auth**: Bearer Token required

#### 9. Upload Donation Photos
* **Method & Path**: `POST /api/v1/donations/:id/photos`
* **Auth**: Bearer Token (`donor` owner only)
* **Preconditions**:
  1. Donation must exist and `donorId === req.user.id`.
  2. Status must be `AVAILABLE`.
  3. No claims exist (`acceptances.length === 0`).
  4. Total photos on the donation cannot exceed 5.
* **Content-Type**: `multipart/form-data`
* **Form Field**: `photos` (up to 5 files, maximum 2 MB per file)
* **Allowed MIME Types**: `image/jpeg`, `image/png`, `image/webp` (strictly verified by real magic byte signatures).
* **Storage & Serving**:
  - Saved using random UUID filenames in `backend/uploads/` via `storageService.js` adapter.
  - Served via restricted route `GET /uploads/:filename` or `GET /api/v1/uploads/:filename` (hardened against path traversal, sends `X-Content-Type-Options: nosniff`).
* **Response (200 OK)**:
```json
{
  "success": true,
  "message": "Photos uploaded successfully",
  "data": {
    "photos": [
      "/uploads/c8a34fcb-7f32-4d2b-b6b8-29472e391cb4.jpg"
    ],
    "totalPhotos": 1
  }
}
```

---

### E. Recipient Requirements Management (`Member 2` foundation / `Member 3` matching input)

#### 1. Create Recipient Need / Requirement
* **Method & Path**: `POST /api/v1/requirements`
* **Auth**: Bearer Token (`recipient` with `isVerified === true`, or `admin`)
* **Request Body**:
```json
{
  "title": "Evening meal requirement for 40 children",
  "foodType": "cooked_meals",
  "quantityNeeded": 40,
  "unit": "plates",
  "dietaryPreference": "vegetarian",
  "neededBy": "2026-10-10T19:30:00.000Z",
  "urgency": "HIGH",
  "location": {
    "type": "Point",
    "coordinates": [77.5946, 12.9716]
  },
  "address": {
    "street": "12 Bannerghatta Road",
    "city": "Bengaluru",
    "state": "Karnataka",
    "postalCode": "560076",
    "formattedAddress": "12 Bannerghatta Road, Bengaluru"
  }
}
```

#### 2. List Requirements
* **Method & Path**: `GET /api/v1/requirements`
* **Query Params**: `?status=OPEN&foodType=cooked_meals&urgency=HIGH`

---

### F. Matching & Acceptance (`Stub Owned by Member 3`)

#### 1. Smart Match Recommendations *(Member 3)*
* **Method & Path**: `GET /api/v1/matches/recommendations`
* **Auth**: Bearer Token (`recipient` with `isVerified === true`)
* **Query Params**: `?requirementId=6707d99fb12345678901234d`

#### 2. Accept Donation (Full or Partial) *(Member 3)*
* **Method & Path**: `POST /api/v1/donations/:id/accept`
* **Auth**: Bearer Token (`recipient` with `isVerified === true`)
* **Rule**: Uses atomic `findOneAndUpdate` with concurrency check and dynamic `$expr` expiry check. Accepts donations in status `AVAILABLE`, `PARTIALLY_ACCEPTED`, or `REOPENED`.
* **Request Body**:
```json
{
  "requestedQuantity": 20,
  "requirementId": "6707d99fb12345678901234d",
  "pickupPreference": "delivery_agent_required",
  "notes": "We have insulated carriers."
}
```
* **Response (200 OK)**: Returns updated donation with new acceptance ID and updated `remainingQuantity`.

#### 3. Cancel Acceptance *(Member 3)*
* **Method & Path**: `POST /api/v1/donations/:id/acceptances/:acceptanceId/cancel`
* **Auth**: Bearer Token (`recipient` owner of acceptance, or `admin`)
* **Rule**: Allowed **ONLY** if acceptance status is `CLAIMED` or `PICKUP_SCHEDULED` (strictly before `PICKED_UP`).
* **Effect**:
  1. Atomically restores `remainingQuantity = remainingQuantity + acceptance.quantity`.
  2. Sets acceptance status to `CANCELLED`.
  3. Moves donation status to `REOPENED` (or `PARTIALLY_ACCEPTED` if other active claims remain).
  4. Appends audit log to `statusHistory`.
* **Response (200 OK)**:
```json
{
  "success": true,
  "message": "Acceptance cancelled and quantity restored to available pool",
  "data": {
    "donationId": "6707c91fb12345678901234b",
    "acceptanceId": "6707e11ab12345678901234e",
    "restoredQuantity": 20,
    "remainingQuantity": 50,
    "donationStatus": "REOPENED"
  }
}
```

#### 4. Trigger Rematching *(Member 3)*
* **Method & Path**: `POST /api/v1/donations/:id/rematch`
* **Auth**: Bearer Token (`admin` only via HTTP). Internal automated rematch is triggered directly by service code.

---

### G. Logistics, QR Verification, Safety Checks & Ratings (`Stub Owned by Member 4`)

#### 1. Schedule Pickup *(Member 4)*
* **Method & Path**: `POST /api/v1/pickups/schedule`
* **Auth**: Bearer Token (`recipient`, `delivery_agent` with `isVerified === true`, `admin`)

#### 2. Verify Pickup QR Code at Donor Location *(Member 4)*
* **Method & Path**: `POST /api/v1/pickups/:id/verify-pickup-qr`
* **Auth**: Bearer Token (assigned `delivery_agent`, `admin`)
* **Rule**: Driver scans donor QR; initial visual safety inspection performed. Updates acceptance and donation status to `PICKED_UP`.

#### 3. Food Safety Checklist (Pickup or Drop) *(Member 4)*
* **Method & Path**: `POST /api/v1/pickups/:id/safety-check`
* **Auth**: Bearer Token (`delivery_agent`, `recipient`)
* **Request Body**:
```json
{
  "checkStage": "dropoff",
  "packagingIntact": true,
  "temperatureCheck": "HOT",
  "visualSpoilageOrSmell": false,
  "passed": true,
  "disposalAction": null
}
```
* **Unsafe Food Path**: If `passed === false` or `visualSpoilageOrSmell === true`:
  * Sets acceptance status to `REJECTED_UNSAFE`.
  * Logs disposal/compost routing in pickup history.
  * Food is **never delivered**. Response returns HTTP 422 `FOOD_UNSAFE`.

#### 4. Verify Handover QR Code at Recipient Location *(Member 4)*
* **Method & Path**: `POST /api/v1/pickups/:id/verify-handover-qr`
* **Auth**: Bearer Token (`recipient`, `delivery_agent`)
* **Rule**: Re-checks effective expiry. If expired, fails with HTTP 410 `DONATION_EXPIRED` and triggers unsafe diversion. Otherwise updates status to `HANDOVER_VERIFIED`.

#### 5. Complete Delivery *(Member 4)*
* Handover verification + passed drop-off safety check automatically finalizes the acceptance and donation to `COMPLETED`.

#### 6. Submit Trust Rating *(Member 4)*
* **Method & Path**: `POST /api/v1/ratings`
* **Auth**: Bearer Token (`recipient` or `donor`)
* **Rule**: Completely decoupled from completion. Can be submitted anytime after `COMPLETED`.
* **Request Body**:
```json
{
  "donationId": "6707c91fb12345678901234b",
  "targetUserId": "6707c5a0b12345678901234a",
  "rating": 5,
  "comment": "Food was fresh, warm, and arrived safely!"
}
```

---

### H. In-App Notifications & Automated AI Voice Calls (`Member 2 Foundation`)

#### 1. In-App Notification Feed
* **Method & Path**: `GET /api/v1/notifications`
* **Auth**: Bearer Token required
* **Query Parameters**:
  - `page`: Integer (default 1)
  - `limit`: Integer (default 20, max 50)
  - `unread`: Boolean string (`true` filters strictly unread notifications)
* **Response (200 OK)**:
```json
{
  "success": true,
  "message": "Notifications retrieved successfully",
  "data": {
    "notifications": [
      {
        "id": "6707c91fb123456789012399",
        "userId": "6707c5a0b12345678901234a",
        "type": "EXPIRING_SOON",
        "title": "Donation Expiring Soon",
        "message": "Donation 'Fresh Biryani' has 25 minutes left before safety buffer expiry.",
        "donationId": "6707c91fb12345678901234b",
        "readAt": null,
        "createdAt": "2026-10-10T18:00:00.000Z"
      }
    ],
    "unreadCount": 1,
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 1,
      "totalPages": 1
    }
  }
}
```

#### 2. Mark Single Notification as Read
* **Method & Path**: `PATCH /api/v1/notifications/:id/read`
* **Auth**: Bearer Token (recipient owner only; IDOR protected)
* **Response (200 OK)**:
```json
{
  "success": true,
  "message": "Notification marked as read",
  "data": {
    "notification": {
      "id": "6707c91fb123456789012399",
      "readAt": "2026-10-10T18:05:00.000Z"
    }
  }
}
```

#### 3. Mark All Notifications as Read
* **Method & Path**: `PATCH /api/v1/notifications/read-all`
* **Auth**: Bearer Token (marks all notifications for the authenticated user)
* **Response (200 OK)**:
```json
{
  "success": true,
  "message": "All notifications marked as read",
  "data": {
    "markedReadCount": 3
  }
}
```

#### 4. Trigger Urgent Automated AI Voice Call (Stub)
* **Method & Path**: `POST /api/v1/notifications/ai-call/trigger`
* **Auth**: Bearer Token (`admin` only)
* **Description**: Simulates outbound AI telephony provider call for donations with urgent impending expiry (< 15 min). Phone numbers are masked in logs and stored records.
* **Request Body**:
```json
{
  "donationId": "6707c91fb12345678901234b",
  "recipientPhone": "+919876543210"
}
```
* **Response (201 Created)**:
```json
{
  "success": true,
  "message": "AI voice call dispatched successfully",
  "data": {
    "call": {
      "callId": "call_mock_4b1a8f9c2d1e0123",
      "recipientPhone": "+91******3210",
      "donationId": "6707c91fb12345678901234b",
      "status": "INITIATED",
      "createdAt": "2026-10-10T18:10:00.000Z"
    }
  }
}
```

#### 5. Get AI Voice Call Record
* **Method & Path**: `GET /api/v1/notifications/ai-call/:id`
* **Auth**: Bearer Token (`admin` or target recipient user)
* **Response (200 OK)**:
```json
{
  "success": true,
  "message": "Voice call record retrieved successfully",
  "data": {
    "call": {
      "callId": "call_mock_4b1a8f9c2d1e0123",
      "recipientPhone": "+91******3210",
      "donationId": "6707c91fb12345678901234b",
      "status": "COMPLETED",
      "transcript": "Hello, this is an automated dispatch from Share A Plate...",
      "createdAt": "2026-10-10T18:10:00.000Z"
    }
  }
}
```

---

### I. Impact Metrics & Dashboards (`Member 2`)

#### 1. Public Impact Aggregation
* **Method & Path**: `GET /api/v1/dashboard/impact`
* **Auth**: Public (No auth required)
* **Response (200 OK)**:
```json
{
  "success": true,
  "message": "Impact statistics",
  "data": {
    "mealsSaved": 3450,
    "percentCompletedBeforeExpiry": 94.2,
    "avgTimeToMatchMinutes": 18.5,
    "totalDonationsPosted": 210,
    "totalDonationsCompleted": 182,
    "activeDonationsCount": 14,
    "registeredDonorsCount": 48,
    "registeredRecipientsCount": 29
  }
}
#### 2. Donor Personal Dashboard
* **Method & Path**: `GET /api/v1/dashboard/donor`
* **Auth**: Bearer Token (`donor` or `admin`)
* **Response (200 OK)**:
```json
{
  "success": true,
  "message": "Donor dashboard retrieved successfully",
  "data": {
    "countsPerStatus": {
      "AVAILABLE": 1,
      "PARTIALLY_ACCEPTED": 0,
      "ACCEPTED": 0,
      "PICKUP_SCHEDULED": 0,
      "PICKED_UP": 0,
      "HANDOVER_VERIFIED": 0,
      "COMPLETED": 2,
      "CANCELLED": 0,
      "REOPENED": 0,
      "EXPIRED": 0,
      "REMATCHING": 0
    },
    "mealsContributed": 75.0,
    "completionRate": 66.7,
    "last5Donations": [
      {
        "id": "6707c91fb12345678901234b",
        "foodName": "Fresh Vegetable Pulao",
        "foodType": "cooked_meals",
        "totalQuantity": 30,
        "remainingQuantity": 0,
        "unit": "plates",
        "status": "COMPLETED",
        "createdAt": "2026-10-10T12:00:00.000Z"
      }
    ],
    "totalDonations": 3
  }
}
```

#### 3. Recipient Personal Dashboard
* **Method & Path**: `GET /api/v1/dashboard/recipient`
* **Auth**: Bearer Token (`recipient` with `isVerified === true`, or `admin`)
* **Response (200 OK)**:
```json
{
  "success": true,
  "message": "Recipient dashboard retrieved successfully",
  "data": {
    "countsPerStatus": {
      "OPEN": 2,
      "PARTIALLY_FULFILLED": 0,
      "FULFILLED": 1,
      "EXPIRED": 0,
      "CANCELLED": 0
    },
    "totalAcceptedQuantity": 40,
    "completedMeals": 40.0,
    "last5Acceptances": [
      {
        "_id": "6707d11ab12345678901234c",
        "donationId": "6707c91fb12345678901234b",
        "foodName": "Fresh Vegetable Pulao",
        "foodType": "cooked_meals",
        "unit": "plates",
        "quantity": 20,
        "status": "COMPLETED",
        "pickupPreference": "self_pickup",
        "claimedAt": "2026-10-10T12:15:00.000Z",
        "handoverVerifiedAt": "2026-10-10T13:45:00.000Z",
        "completedAt": "2026-10-10T13:50:00.000Z",
        "donorName": "Grand Royal Banquet",
        "address": {
          "city": "Bengaluru",
          "formattedAddress": "15 Residency Road, Bengaluru"
        }
      }
    ]
  }
}
```

---

### J. Administrator Management Endpoints (`Member 2`)

#### 1. List All Platform Donations (Audit Feed)
* **Method & Path**: `GET /api/v1/admin/donations`
* **Auth**: Bearer Token (`admin` only)
* **Query Params**: `?page=1&limit=10&status=AVAILABLE&donorId=6707c5...&foodType=cooked_meals&dateFrom=...&dateTo=...`
* **Response (200 OK)**:
```json
{
  "success": true,
  "message": "Admin donations retrieved successfully",
  "data": [
    {
      "id": "6707c91fb12345678901234b",
      "foodName": "Fresh Vegetable Biryani",
      "status": "AVAILABLE",
      "totalQuantity": 50,
      "remainingQuantity": 50,
      "statusHistoryLength": 1,
      "acceptanceCount": 0,
      "secondsToEffectiveExpiry": 18000,
      "urgencyLevel": "NORMAL",
      "donorId": {
        "name": "Grand Royal Banquet",
        "email": "donor@royal.org",
        "phone": "+919876543211"
      }
    }
  ],
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 1,
    "totalPages": 1
  }
}
```

---

## 5. Draft Mongoose Schema Fields

### A. User Schema (`models/User.js` — Owned by Member 2)

| Field Name | Type | Required | Validation / Constraints | Description |
| :--- | :--- | :---: | :--- | :--- |
| `name` | `String` | Yes | `trim`, min 2, max 100 chars | Full name or organization representative |
| `email` | `String` | Yes | `unique`, `lowercase`, valid email format | Login email |
| `password` | `String` | Yes | min 8 chars (`select: false`, stored as bcryptjs hash) | Encrypted password |
| `role` | `String` | Yes | `enum: ['donor', 'recipient', 'delivery_agent', 'admin']` | RBAC role |
| `phone` | `String` | Yes | min 10, max 15 digits | Contact phone |
| `isVerified` | `Boolean`| No | Default `false` | Admin verification flag |
| `isActive` | `Boolean`| No | Default `true` | Account activation flag |
| `location` | `Object` | Yes | GeoJSON Point: `type: 'Point'`, `coordinates: [lng, lat]` | **2dsphere index** |
| `address.street` | `String` | No | `trim` | Street address |
| `address.city` | `String` | Yes | `trim` | City |
| `address.state` | `String` | No | `trim` | State |
| `address.postalCode`| `String`| No | `trim` | Zip / Postal code |
| `address.formattedAddress`| `String`| Yes | `trim` | Human readable address |
| `organization.name` | `String` | No | For NGOs/Restaurants | Registered organization name |
| `organization.regNo`| `String` | No | For verification | Government registration ID |
| `organization.capacity`| `Number`| No | For shelters | Number of people served daily |
| `ratingAverage` | `Number` | No | Default `0.0`, min 0, max 5 | Trust rating |
| `ratingCount` | `Number` | No | Default `0` | Number of reviews |
| `createdAt` | `Date` | Auto | `timestamps: true` | |

---

### B. Donation Schema (`models/Donation.js` — Owned by Member 2)

| Field Name | Type | Required | Validation / Constraints | Description |
| :--- | :--- | :---: | :--- | :--- |
| `donorId` | `ObjectId` | Yes | `ref: 'User'` | Reference to posting donor |
| `foodName` | `String` | Yes | min 3, max 120 chars | Name of food item |
| `foodType` | `String` | Yes | `enum: ['cooked_meals', 'raw_groceries', 'packaged_food', 'bakery_items']` | Category |
| `dietaryType` | `String` | Yes | `enum: ['vegetarian', 'non_vegetarian', 'vegan']` | Dietary classification |
| `totalQuantity` | `Number` | Yes | min 1, integer | Initial quantity posted |
| `remainingQuantity` | `Number` | Yes | min 0, `<= totalQuantity` | Current unallocated quantity |
| `unit` | `String` | Yes | `enum: ['plates', 'kg', 'packets', 'servings']` | Measurement unit |
| `cookedAt` | `Date` | Yes | Must be `<= now` | Food preparation timestamp |
| `expiryAt` | `Date` | Yes | Must be `> cookedAt` | Expiry deadline |
| `safetyBufferMinutes`| `Number`| No | Default `60`, min 15, max 240 | Expiry buffer |
| `pickupWindowStart` | `Date` | Yes | Must be `>= now` | Earliest pickup time |
| `pickupWindowEnd` | `Date` | Yes | `> pickupWindowStart` and `<= effectiveExpiryAt` | Latest donor pickup |
| `packagingType` | `String` | No | `enum: ['sealed_containers', 'loose_packets', 'bulk_vessel']` | Packaging |
| `instructions` | `String` | No | max 500 chars | Handling / gate instructions |
| `photos` | `[String]` | No | Array of valid image URLs | Food photo URLs |
| `location` | `Object` | Yes | GeoJSON Point: `type: 'Point'`, `coordinates: [lng, lat]` | **2dsphere index** |
| `address.street` | `String` | Yes | `trim` | Sensitive (redacted in public view) |
| `address.city` | `String` | Yes | `trim` | City |
| `address.state` | `String` | No | `trim` | State |
| `address.postalCode`| `String`| No | `trim` | Postal code |
| `address.formattedAddress`| `String`| Yes | `trim` | Formatted address |
| `status` | `String` | Yes | `enum` of `DONATION_STATUS`, default `'AVAILABLE'` | Aggregate donation status |
| `acceptances` | `[AcceptanceSchema]`| No | Embedded subdocuments from `models/Acceptance.js` | Owned by Member 3 |
| `statusHistory` | `[StatusHistorySchema]`| Yes | Array of transitions | State change audit trail |
| `createdAt` | `Date` | Auto | `timestamps: true` | |

---

### C. Acceptance Sub-Schema (`models/Acceptance.js` — Owned by Member 3)

| Field Name | Type | Required | Validation / Constraints | Description |
| :--- | :--- | :---: | :--- | :--- |
| `_id` | `ObjectId` | Auto | Subdocument ID | Unique claim identifier |
| `recipientId` | `ObjectId` | Yes | `ref: 'User'` | Claiming recipient |
| `requirementId` | `ObjectId` | No | `ref: 'RecipientRequirement'` | Linked requirement if matched |
| `quantity` | `Number` | Yes | min 1 | Quantity claimed |
| `status` | `String` | Yes | `enum` of `ACCEPTANCE_STATUS`, default `'CLAIMED'` | Discrete claim status |
| `pickupPreference` | `String` | No | `enum: ['self_pickup', 'delivery_agent_required']` | Logistics preference |
| `claimedAt` | `Date` | Auto | Default `Date.now` | Claim timestamp |

---

### D. RecipientRequirement Schema (`models/RecipientRequirement.js` — Owned by Member 2)

| Field Name | Type | Required | Validation / Constraints | Description |
| :--- | :--- | :---: | :--- | :--- |
| `recipientId` | `ObjectId` | Yes | `ref: 'User'` | Claiming recipient user ID |
| `title` | `String` | Yes | min 3, max 120 chars | Title of the requirement |
| `foodType` | `String` | Yes | `enum: ['cooked_meals', 'raw_groceries', 'packaged_food', 'bakery_items']` | Food category needed |
| `quantityNeeded` | `Number` | Yes | min 1, integer | Number of units needed |
| `quantityFulfilled` | `Number` | No | Default `0`, `<= quantityNeeded` | Number of units fulfilled so far |
| `unit` | `String` | Yes | `enum: ['plates', 'kg', 'packets', 'servings']` | Measurement unit |
| `dietaryPreference` | `String` | Yes | `enum: ['vegetarian', 'non_vegetarian', 'vegan']` | Dietary restriction |
| `neededBy` | `Date` | Yes | Must be in the future (`> now`) | Time requirement must be met by |
| `urgency` | `String` | Yes | `enum: ['LOW', 'NORMAL', 'HIGH', 'CRITICAL']` | Urgency priority level |
| `status` | `String` | Yes | `enum: ['OPEN', 'PARTIALLY_FULFILLED', 'FULFILLED', 'EXPIRED', 'CANCELLED']`, default `'OPEN'` | Requirement lifecycle status |
| `location` | `Object` | Yes | GeoJSON Point: `type: 'Point'`, `coordinates: [lng, lat]` | **2dsphere index** |
| `address.street` | `String` | No | `trim` | Sensitive / street address |
| `address.city` | `String` | Yes | `trim` | City |
| `address.state` | `String` | No | `trim` | State |
| `address.postalCode` | `String` | No | `trim` | Postal code |
| `address.formattedAddress` | `String` | Yes | `trim` | Formatted address |
| `createdAt` | `Date` | Auto | `timestamps: true` | |

---

## 6. Concurrency & Expiry Enforcement Architecture

### A. Atomic Partial Acceptance (Concurrency Defense)
To eliminate race conditions when multiple recipients claim portions simultaneously, acceptance operations execute in a single atomic `findOneAndUpdate` with a query filter condition that dynamically checks both available quantity and effective expiry:

```javascript
const now = new Date();

const updatedDonation = await Donation.findOneAndUpdate(
  {
    _id: donationId,
    status: { $in: [DONATION_STATUS.AVAILABLE, DONATION_STATUS.PARTIALLY_ACCEPTED, DONATION_STATUS.REOPENED] },
    remainingQuantity: { $gte: requestedQuantity },
    $expr: {
      $gt: [
        { $subtract: ['$expiryAt', { $multiply: ['$safetyBufferMinutes', 60000] }] },
        now
      ]
    }
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
                recipientId: new mongoose.Types.ObjectId(recipientId),
                quantity: requestedQuantity,
                status: 'CLAIMED',
                claimedAt: '$$NOW',
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
                changedBy: new mongoose.Types.ObjectId(recipientId),
                note: `Accepted ${requestedQuantity} units`,
                timestamp: '$$NOW',
              },
            ],
          ],
        },
      },
    },
  ],
  { new: true }
);

if (!updatedDonation) {
  throw new ApiError(
    409,
    'INSUFFICIENT_QUANTITY',
    'Donation has expired or has insufficient remaining quantity.'
  );
}
```

---

### B. Atomic Acceptance Cancellation & Quantity Restoration
When a recipient cancels their claim before pickup (`POST /api/v1/donations/:id/acceptances/:accId/cancel`):
```javascript
const updatedDonation = await Donation.findOneAndUpdate(
  {
    _id: donationId,
    'acceptances._id': acceptanceId,
    'acceptances.status': { $in: ['CLAIMED', 'PICKUP_SCHEDULED'] }, // Strictly before pickup
  },
  [
    {
      $set: {
        remainingQuantity: { $add: ['$remainingQuantity', cancelledQuantity] },
        status: DONATION_STATUS.REOPENED,
        acceptances: {
          $map: {
            input: '$acceptances',
            as: 'acc',
            in: {
              $cond: {
                if: { $eq: ['$$acc._id', new mongoose.Types.ObjectId(acceptanceId)] },
                then: { $mergeObjects: ['$$acc', { status: 'CANCELLED' }] },
                else: '$$acc',
              },
            },
          },
        },
        statusHistory: {
          $concatArrays: [
            '$statusHistory',
            [
              {
                status: DONATION_STATUS.REOPENED,
                changedBy: new mongoose.Types.ObjectId(req.user.id),
                note: `Cancelled claim of ${cancelledQuantity} units; restored to pool`,
                timestamp: '$$NOW',
              },
            ],
          ],
        },
      },
    },
  ],
  { new: true }
);
```

---

### C. Server-Side Expiry Enforcement (Per-Donation Dynamic Rule)
1. **Dynamic `$expr` Query Filter**:
   Queries discovering available food filter out expired items using their individual `safetyBufferMinutes`:
   ```javascript
   const discoveryFilter = {
     status: { $in: [DONATION_STATUS.AVAILABLE, DONATION_STATUS.PARTIALLY_ACCEPTED, DONATION_STATUS.REOPENED] },
     $expr: {
       $gt: [
         { $subtract: ['$expiryAt', { $multiply: ['$safetyBufferMinutes', 60000] }] },
         new Date()
       ]
     }
   };
   ```
2. **Pre-Transition Expiry Guard**:
   At handover verification and completion, re-check effective expiry:
   ```javascript
   const effectiveExpiry = new Date(donation.expiryAt.getTime() - donation.safetyBufferMinutes * 60000);
   if (new Date() >= effectiveExpiry) {
     throw new ApiError(410, 'DONATION_EXPIRED', 'Effective food safe life exceeded before delivery could be completed.');
   }
   ```
3. **Background Expiry Sweeper**:
   Runs every 5 minutes targeting strictly pre-pickup statuses:
   ```javascript
   await Donation.updateMany(
     {
       status: { $in: [DONATION_STATUS.AVAILABLE, DONATION_STATUS.PARTIALLY_ACCEPTED, DONATION_STATUS.REOPENED, DONATION_STATUS.ACCEPTED, DONATION_STATUS.PICKUP_SCHEDULED] },
       $expr: {
         $lte: [
           { $subtract: ['$expiryAt', { $multiply: ['$safetyBufferMinutes', 60000] }] },
           new Date()
         ]
       }
     },
     {
       $set: { status: DONATION_STATUS.EXPIRED },
       $push: { statusHistory: { status: DONATION_STATUS.EXPIRED, note: 'System expiry sweep', timestamp: new Date() } }
     }
   );
   ```

---

## 7. Decisions Needing Team Agreement

| # | Topic | Options | Recommended Default | Rationale |
| :-: | :--- | :--- | :--- | :--- |
| **1** | **Merging Statuses: `REOPENED`, `REMATCHING`, and `AVAILABLE`** | A) Merge all into `AVAILABLE`<br>B) Keep distinct enums, query together | **B) Keep distinct enums; query together** | Query filters treat them identically (`$in: ['AVAILABLE', 'REOPENED', 'PARTIALLY_ACCEPTED']`). Keeping them distinct in the schema preserves valuable audit insights on churn and rematch efficiency for the demo presentation. |
| **2** | **Photo Upload Strategy** | A) Direct Cloudinary upload from React client with URL stored in DB<br>B) Multer local disk upload on backend<br>C) Base64 strings | **A) Cloudinary with client upload (or mock URLs for local MVP)** | Avoids disk I/O on backend instances and provides reliable CDN image delivery without bloating MongoDB documents with Base64. |
| **3** | **Ownership of Notifications & AI Voice Call** | A) Member 3 owns AI call trigger; Member 2 provides notification DB model<br>B) Member 4 owns it | **A) Member 3 owns AI call trigger** | Member 3 owns matching urgency algorithms. When matching score indicates high urgency and expiry is impending (< 90m), Member 3's engine triggers the alert call. |
| **4** | **Location Representation** | A) GeoJSON `Point [lng, lat]` + `address` object<br>B) Flat `lat, lng` | **A) GeoJSON Point + Address** | Required for MongoDB native geospatial indexing (`2dsphere`) to power Member 3's radius queries. |
| **5** | **Acceptance Schema Architecture** | A) `models/Acceptance.js` owned by M3, embedded into Donation<br>B) Single monolithic file | **A) Dedicated `Acceptance.js` file** | Strictly isolates Member 3's code from Member 2's `Donation.js` file to eliminate Git merge conflicts. |
| **6** | **Test Database Strategy** | A) `mongodb-memory-server`<br>B) Shared Atlas test cluster | **A) `mongodb-memory-server`** | Fast, 100% offline, isolated test runs that will never corrupt or wipe shared hackathon database collections. |

---

## 8. Prioritized MVP Implementation Plan

```text
  Phase 1: Foundation (M2) ──► Phase 2: Core Domain (M2) ──► Phase 3: Matching (M3) ──► Phase 4: Delivery (M4) ──► Phase 5: Polish
  • App, DB & Error Handler   • Donation CRUD & Filters     • Smart Match Score       • Pickup Scheduling          • Seed Data
  • User Auth, RBAC & Verify  • Recipient Requirements      • Atomic Partial Accept   • QR Scan Verification       • E2E Flow Check
  • Mass Assignment Guard     • PII Address Redaction       • Cancel Claim & Restore  • Safety Check & Disposal    • Impact Dashboard
```

1. **Step 1 (Member 2 - Foundation)**: Initialize `backend/package.json`, `config/db.js`, `app.js`, `server.js`, `ApiResponse`, `ApiError`, `errorHandler`, `asyncHandler`, `GET /api/v1/health`.
2. **Step 2 (Member 2 - Auth, Admin & Security)**: Implement `User` model (`isActive`, `isVerified`), `authController.js`, `adminController.js`, password hashing with `bcryptjs`, JWT issue/verify, and `authMiddleware` (with DB lookup and `isActive` check).
3. **Step 3 (Member 2 - Donation Foundation)**: Implement `Donation.js`, `RecipientRequirement.js`, strict Zod validators, donation creation with expiry invariant check, single donation query with PII redaction, and `donations/available` + `donations/my` route registration order.
4. **Step 4 (Member 3 - Matching & Acceptance)**: Implement `Acceptance.js` sub-schema, `matchRoutes.js`, atomic partial acceptance with `$expr` expiry check, and cancel acceptance endpoint restoring quantity.
5. **Step 5 (Member 4 - Logistics & Verification)**: Implement `Pickup.js`, `pickupRoutes.js`, QR scan verification, food safety checklist (with unsafe food disposal route), and decoupled post-completion ratings.
6. **Step 6 (Full Team - Demo & Seed)**: Seed verified accounts and food posts; verify end-to-end flow from post to delivery and public impact statistics.

---

## 9. API Testing Plan (`tests/` using `mongodb-memory-server`)

All tests execute against an isolated in-memory MongoDB instance (`mongodb-memory-server`), ensuring 0 dependencies on external networks or shared Atlas clusters.

### Key Test Suites & Specific Validation Scenarios:

1. **Authentication & Security Suite (`tests/auth.test.js`)**:
   * **Admin Registration Rejection**: Registering with `role: "admin"` returns HTTP 400 `VALIDATION_ERROR` or `403 FORBIDDEN`.
   * **Mass-Assignment Guard**: Submitting `isVerified: true`, `isActive: false`, `role: "admin"`, or `status: "COMPLETED"` in request body is stripped/rejected.
   * **Deactivated Account Block**: Deactivated user (`isActive: false`) receives `403 DEACTIVATED_ACCOUNT` upon making authenticated requests.
   * **Unverified User Guard**: Unverified recipient attempting to accept a donation returns `403 UNVERIFIED_ACCOUNT`.

2. **Donation CRUD & Data Privacy Suite (`tests/donation.test.js` & `tests/privacy.test.js`)**:
   * **Creation Validation**: Creating a donation where `pickupWindowEnd > effectiveExpiryAt` or `effectiveExpiryAt <= now` fails with HTTP 400.
   * **PII Redaction**: Querying `/api/v1/donations/:id` as an unattached user masks exact street address and omits donor phone number. Querying as the owner returns full details.
   * **Update Invariant**: Attempting to update a donation with status other than `AVAILABLE` fails with HTTP 409 `INVALID_STATUS_TRANSITION`.

3. **Concurrency & Partial Acceptance Suite (`tests/concurrency.test.js`)**:
   * **Atomic Over-Acceptance Prevention**: Run 10 parallel requests (`Promise.all`) requesting 10 units each on a donation of 50 units. Exactly 5 requests succeed; exactly 5 fail with `409 INSUFFICIENT_QUANTITY`. Final remaining balance must be exactly 0.
   * **Restoration on Cancel**: Recipient calls `POST /donations/:id/acceptances/:accId/cancel`. Verified that `remainingQuantity` increases by claimed amount and donation status becomes `REOPENED`.

4. **Expiry Enforcement Suite (`tests/expiry.test.js`)**:
   * **Dynamic `$expr` Exclusion**: A donation whose `now >= expiryAt - safetyBufferMinutes` is excluded from `/api/v1/donations/available`.
   * **Acceptance Barrier**: Attempting to accept a donation that has passed effective expiry returns HTTP 410 `DONATION_EXPIRED`.
   * **Delivery Barrier**: Attempting handover verification on an expired donation fails with HTTP 410 `DONATION_EXPIRED`.

5. **Food Safety Suite (`tests/safety.test.js`)**:
   * Submitting a safety check with `visualSpoilageOrSmell: true` sets acceptance to `REJECTED_UNSAFE` and routes food to disposal.
