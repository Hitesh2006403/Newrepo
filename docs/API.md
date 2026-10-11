# Share A Plate - API Documentation: Priority & List Filtering

This document describes the unified REST API contracts, endpoints, query parameters, validation rules, and authorization matrix for user-chosen Priority (`LOW`, `MEDIUM`, `HIGH`) alongside existing urgency indicators.

---

## 1. Shared Constants & Meta Endpoint

### `GET /api/v1/meta`
Retrieves system metadata, allowed priority values, numeric weights, and platform capabilities.

**Response `200 OK`**:
```json
{
  "success": true,
  "data": {
    "priorities": ["LOW", "MEDIUM", "HIGH"],
    "priorityWeights": {
      "LOW": 1,
      "MEDIUM": 2,
      "HIGH": 3
    },
    "defaultPriority": "MEDIUM"
  }
}
```

---

## 2. Priority Fields & Semantics

| Field | Type | Allowed Values | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `priority` | String (Enum) | `LOW`, `MEDIUM`, `HIGH` | `MEDIUM` | User-chosen priority for donations and requirements. |
| `priorityWeight` | Number | `1`, `2`, `3` | `2` | Internal numeric weight (LOW=1, MEDIUM=2, HIGH=3) used for sorting and server-side matching score computations. Set strictly by server. |
| `urgency` *(Legacy alias)* | String (Enum) | `LOW`, `MEDIUM`, `HIGH`, `CRITICAL` | `MEDIUM` | Deprecated alias on requirements. `CRITICAL` maps to `HIGH`. Both `priority` and `urgency` are returned in responses for 100% backward compatibility. |

---

## 3. Query Parameters for List Endpoints

Applicable to:
- `GET /api/v1/donations` (Available public donations)
- `GET /api/v1/donations/my` (Donor's personal donations)
- `GET /api/v1/admin/donations` (Admin global monitor log)
- `GET /api/v1/requirements` (Recipient open requirements)
- `GET /api/v1/delivery/tasks/available` (Agent available pickups)

### `?priority=`
- Single value: `?priority=HIGH`
- Multi-value comma-separated whitelist: `?priority=HIGH,MEDIUM`
- Validation: Strict whitelist (`LOW`, `MEDIUM`, `HIGH`). Invalid values or NoSQL injection payloads (e.g. `{"$gt": ""}`) return `400 BAD_REQUEST`.

### `?sort=`
Supported sort options (uses numeric `priorityWeight`, not alphabetical):
- `priority_desc`: Highest priority first (`HIGH` > `MEDIUM` > `LOW`), then newest.
- `priority_asc`: Lowest priority first (`LOW` > `MEDIUM` > `HIGH`), then newest.
- `expiry_asc`: Soonest expiring items first, then `HIGH` priority.
- `newest`: Most recently created first.
- `distance`: Nearest first (requires `latitude` and `longitude`).

**Default Sorting**:
- Available Donations: Soonest effective expiry first, then `HIGH` priority (`expiry_asc`).
- Recipient Requirements: Highest priority first (`priority_desc`), then `neededBy`.
- Delivery Tasks: Soonest effective pickup deadline, then `HIGH` priority.

---

## 4. Endpoints & Operations

### `PATCH /api/v1/requirements/:id`
Updates an existing recipient requirement.

- **Authorization**: Must be authenticated. User must be the owner recipient of the requirement or an `ADMIN`. Non-owners receive `403 FORBIDDEN`.
- **Condition**: Only allowed while requirement `status === 'OPEN'`. If claimed or closed, returns `400 BAD_REQUEST`.
- **Strict Allowed Fields**:
  - `priority` (`LOW`, `MEDIUM`, `HIGH`)
  - `urgency` (`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`) - mapped automatically
  - `title` (String, 3-200 chars)
  - `quantityNeeded` (Positive number)
  - `neededBy` (Valid ISO Date string)
  - `dietaryPreference` (`vegetarian`, `non_vegetarian`, `vegan`, `any`)
- **Mass Assignment Protection**: Attempts to mutate `_id`, `recipientId`, `status`, `priorityWeight`, or `matchScore` are rejected with `400 BAD_REQUEST`.

### `PATCH /api/v1/donations/:id`
Updates an existing donation.

- **Authorization**: Owner donor or `ADMIN`.
- **Condition**: Only while donation `status === 'AVAILABLE'` and has zero claims.
- **Allowed Fields**: `priority`, `foodName`, `notes`, `pickupWindowStart`, `pickupWindowEnd`, `instructions`.

---

## 5. Authorization Matrix

| Endpoint | Method | Public | Donor | Recipient | Delivery Agent | Admin | Condition / Rule |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| `/api/v1/meta` | GET | Yes | Yes | Yes | Yes | Yes | Public system constants |
| `/api/v1/donations` | GET | Yes | Yes | Yes | Yes | Yes | Filterable by `?priority=` & `?sort=` |
| `/api/v1/donations` | POST | No | Yes | No | No | Yes | Creates donation with priority |
| `/api/v1/donations/:id` | PATCH | No | Owner | No | No | Yes | Only while `AVAILABLE` with 0 claims |
| `/api/v1/requirements` | GET | Yes | Yes | Yes | Yes | Yes | Filterable by `?priority=` & `?sort=` |
| `/api/v1/requirements` | POST | No | No | Yes | No | Yes | Creates requirement with priority |
| `/api/v1/requirements/:id` | PATCH | No | No | Owner | No | Yes | Only while `OPEN` |
| `/api/v1/delivery/tasks/available` | GET | No | No | No | Yes | Yes | Sorted by expiry, then priority |
| `/api/v1/admin/donations` | GET | No | No | No | No | Yes | Includes `countsPerPriority` |

---

## 6. Error Envelope & Status Codes

All errors adhere to the unified standard format:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid priority filter: MUSTBEHIGH. Allowed values: LOW, MEDIUM, HIGH"
  }
}
```

- `400 BAD_REQUEST`: Invalid input format, unsupported priority/sort value, or NoSQL injection characters (`$`, `{`, `}`).
- `401 UNAUTHORIZED`: Missing or invalid JWT Bearer token.
- `403 FORBIDDEN`: User does not own the target record (IDOR defense).
- `404 NOT_FOUND`: Record not found or no longer in modifiable state.
