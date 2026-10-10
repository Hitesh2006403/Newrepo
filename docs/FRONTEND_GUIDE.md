# Share A Plate — Frontend Integration & Developer Guide (Member 1)

Welcome, Member 1! This guide is your complete technical reference for connecting the React frontend (Vite/React, TailwindCSS) to the Share A Plate backend API.

---

## 1. Quick Start & Connection Configuration

| Setting | Value | Description |
| :--- | :--- | :--- |
| **API Base URL** | `http://localhost:5000/api/v1` | Root URL for all endpoints |
| **Auth Header** | `Authorization: Bearer <token>` | Required on all protected routes |
| **Frontend Origin** | `http://localhost:5173` | Configured in backend CORS whitelist |
| **Enums & Metadata** | `GET /api/v1/meta` | Call once on app startup for dropdowns & labels |

```javascript
// Example src/api/client.js (Axios)
import axios from 'axios';

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
```

---

## 2. API Response & Error Handling Contract

### A. Success Envelope
Every successful response returns `success: true`:
```json
{
  "success": true,
  "message": "Resource retrieved successfully",
  "data": { ... }
}
```

### B. Standard Error Envelope
Every error response returns HTTP 4xx or 5xx with `success: false`:
```json
{
  "success": false,
  "error": {
    "code": "INVALID_STATUS_TRANSITION",
    "message": "Donation can only be updated while in status AVAILABLE with zero claims.",
    "details": null
  }
}
```

### C. Error Codes & Suggested UI Toast Messages
Map backend error codes directly to user-friendly notifications in your toast/alert component:

| Error Code | HTTP Status | Meaning | Suggested User-Friendly Toast / Banner |
| :--- | :---: | :--- | :--- |
| `VALIDATION_ERROR` | 400 | Form validation failed | *"Please check the form fields and correct any highlighted errors."* |
| `CANNOT_DEACTIVATE_SELF` | 400 | Admin self-lockout | *"Action forbidden: You cannot deactivate your own administrative account."* |
| `UNAUTHORIZED` | 401 | Missing or expired token | *"Your session has expired. Please log in again to continue."* |
| `INVALID_CREDENTIALS` | 401 | Email or password mismatch | *"Invalid email address or password. Please try again."* |
| `FORBIDDEN` | 403 | Role lack permission | *"You do not have permission to view or perform this action."* |
| `UNVERIFIED_ACCOUNT` | 403 | Account pending admin check | *"Your account is pending verification by our admin team. You will receive an alert once approved."* |
| `DEACTIVATED_ACCOUNT` | 403 | Admin deactivated user | *"This account has been deactivated. Please contact support."* |
| `NOT_FOUND` | 404 | Resource does not exist | *"The requested item or donation could not be found."* |
| `CONFLICT` | 409 | Duplicate email / resource | *"An account with this email address already exists."* |
| `INVALID_STATUS_TRANSITION` | 409 | State conflict or race | *"This donation has changed status or already has active claims."* |
| `INSUFFICIENT_QUANTITY` | 409 | Claim exceeds balance | *"Only a portion of this food remains available."* |
| `DONATION_EXPIRED` | 410 | Past safe consumption | *"This donation has passed its safe consumption deadline."* |
| `FOOD_UNSAFE` | 422 | Safety check failure | *"This food was rejected during safety inspection and marked unsafe."* |
| `FILE_TOO_LARGE` | 413 | Image > 2 MB | *"Image is too large. Please select images under 2 MB."* |
| `INTERNAL_SERVER_ERROR` | 500 | Server error | *"An unexpected error occurred. Please try again later."* |

---

## 3. Dynamic Enumerations (`GET /api/v1/meta`)

**Never hardcode domain enums in frontend dropdowns!** Call `GET /api/v1/meta` when the app loads (or store in a React Query / Zustand store):

```json
{
  "roles": ["donor", "recipient", "delivery_agent", "admin"],
  "donationStatuses": [
    "AVAILABLE", "PARTIALLY_ACCEPTED", "ACCEPTED", "PICKUP_SCHEDULED",
    "PICKED_UP", "HANDOVER_VERIFIED", "COMPLETED", "CANCELLED", "REOPENED", "EXPIRED", "REMATCHING"
  ],
  "foodTypes": ["cooked_meals", "raw_groceries", "packaged_food", "bakery_items"],
  "units": ["plates", "kg", "packets", "servings"],
  "dietaryTypes": ["vegetarian", "non_vegetarian", "vegan", "any"],
  "urgencyLevels": ["NORMAL", "URGENT", "CRITICAL", "EXPIRED"],
  "defaultSafetyBufferMinutes": 60
}
```

---

## 4. Pagination Standard

All paginated endpoints (`GET /donations/available`, `GET /donations/my`, `GET /requirements`, `GET /notifications`, `GET /admin/users`) return this metadata:

```json
{
  "success": true,
  "data": [ ... ],
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 38,
    "totalPages": 4,
    "hasNext": true,
    "hasPrev": false
  }
}
```

**Query Parameters Supported**:
* `page=1` (1-indexed)
* `limit=10` (default 10, max 100)

---

## 5. Countdown Timers & Urgency Badges

Donations include dynamic countdown fields computed against `effectiveExpiryAt` (`expiryAt` minus `safetyBufferMinutes`):
* `secondsToEffectiveExpiry`: Integer seconds remaining until safe consumption closes.
* `urgencyLevel`: `"NORMAL"`, `"URGENT"`, `"CRITICAL"`, or `"EXPIRED"`.

### Recommended React Timer Implementation:
```jsx
import React, { useState, useEffect } from 'react';

export function DonationCountdown({ initialSeconds, urgencyLevel }) {
  const [secondsLeft, setSecondsLeft] = useState(initialSeconds);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const interval = setInterval(() => {
      setSecondsLeft((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [secondsLeft]);

  const formatTime = (secs) => {
    if (secs <= 0) return 'EXPIRED';
    const hrs = Math.floor(secs / 3600);
    const mins = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (hrs > 0) return `${hrs}h ${mins}m`;
    return `${mins}m ${s}s`;
  };

  const badgeColor = {
    CRITICAL: 'bg-red-100 text-red-800 border-red-300 animate-pulse',
    URGENT: 'bg-amber-100 text-amber-800 border-amber-300',
    NORMAL: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    EXPIRED: 'bg-gray-200 text-gray-700 border-gray-400',
  }[urgencyLevel] || 'bg-gray-100 text-gray-700';

  return (
    <span className={`px-2.5 py-1 text-xs font-semibold rounded-full border ${badgeColor}`}>
      ⏳ {formatTime(secondsLeft)}
    </span>
  );
}
```

---

## 6. Photo Uploads & Deletion Contract

### A. Photo Schema
Donation photos are returned as an array of objects:
```json
"photos": [
  {
    "id": "e91b5c2a-14d2-43bb-a5a4-123456789abc",
    "url": "/uploads/e91b5c2a-14d2-43bb-a5a4-123456789abc.jpg"
  }
]
```
* **Rendering**: `<img src={`http://localhost:5000${photo.url}`} alt="Food item" />`
* **Privacy Assurance**: The backend automatically decodes and re-encodes images server-side using Sharp, permanently stripping all GPS coordinates, camera metadata, and auto-orienting vertical smartphone photos.

### B. Uploading Photos (Max 5 files, Max 2 MB each)

#### Using Native Fetch:
```javascript
export async function uploadPhotos(donationId, fileList, token) {
  const formData = new FormData();
  Array.from(fileList).forEach((file) => {
    formData.append('photos', file);
  });

  const res = await fetch(`http://localhost:5000/api/v1/donations/${donationId}/photos`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      // Note: Do NOT set Content-Type manually when using FormData in fetch!
    },
    body: formData,
  });

  return await res.json();
}
```

#### Using Axios:
```javascript
export async function uploadPhotosAxios(donationId, fileList) {
  const formData = new FormData();
  Array.from(fileList).forEach((file) => {
    formData.append('photos', file);
  });

  const { data } = await apiClient.post(`/donations/${donationId}/photos`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return data;
}
```

### C. Deleting a Photo
```javascript
export async function deletePhoto(donationId, photoId) {
  const { data } = await apiClient.delete(`/donations/${donationId}/photos/${photoId}`);
  return data; // Returns updated donation with photo removed
}
```

---

## 7. Role-Based Route Guards & Unverified Recipient Banner

### A. Role Matrix & Allowed Views
```javascript
export const ROUTE_PERMISSIONS = {
  '/donor/create': ['donor', 'admin'],
  '/donor/my-donations': ['donor', 'admin'],
  '/donor/dashboard': ['donor', 'admin'],
  '/recipient/available': ['recipient', 'delivery_agent', 'admin'],
  '/recipient/requirements': ['recipient', 'admin'],
  '/recipient/dashboard': ['recipient', 'admin'],
  '/admin/users': ['admin'],
  '/admin/donations': ['admin'],
};
```

### B. Unverified Recipient Notice
When a recipient registers, their account has `isVerified: false` until an admin verifies them.
* Unverified recipients can view public dashboards and browse requirements.
* Unverified recipients receive HTTP 403 `UNVERIFIED_ACCOUNT` if they call `GET /donations/available` or `POST /requirements`.
* **Frontend Best Practice**: If `user.role === 'recipient' && !user.isVerified`, show a persistent top banner:
  > *"⏳ Your recipient organization is pending verification by an administrator. You will be able to claim food and create demand requirements as soon as your account is approved."*

---

## 8. Authentication Token Storage Advice (The XSS Tradeoff)

| Approach | Security Tradeoff | Recommendation for Member 1 |
| :--- | :--- | :--- |
| **`localStorage`** | **Vulnerable to XSS**: Any script injected via an unescaped comment or malicious package can read `localStorage.getItem('token')`. | **Acceptable for local development/hackathon**. Easy to persist across page refreshes. |
| **In-Memory + Silent Refresh** | **Immune to XSS token theft**: Stored only in React state/Zustand. Token is lost on page reload unless refreshed via secure httpOnly cookie. | **Best practice for production**. Store token in memory state; use Axios interceptor to refresh when 401 occurs. |

**Practical Security Measures for Member 1**:
1. Never render unescaped user input using `dangerouslySetInnerHTML`.
2. Sanitize any rich text or user notes before rendering.
3. Automatically clear `localStorage` and redirect to `/login` if any API request returns `401 UNAUTHORIZED`.

---

## 9. Screens Dependent on Unfinished Endpoints (Member 3 & Member 4)

Members 3 and 4 own Matching, Partial Acceptance Rematching, QR Handover, and Safety Checks. Until they implement their routes, use this mock contract:

| Screen / Feature | Owner | Status | Backend Contract to Mock Until Finished |
| :--- | :---: | :---: | :--- |
| **Claim / Accept Donation** (Partial or Full) | Member 3 | Pending | `POST /api/v1/donations/:id/accept`<br>Payload: `{ "requirementId": string, "quantity": number, "pickupPreference": "RECIPIENT_PICKUP" \| "AGENT_DELIVERY" }`<br>Mock response: `{ "success": true, "data": { "acceptanceId": "acc_mock_123", "status": "CLAIMED" } }` |
| **Automated Rematching Trigger** | Member 3 | Pending | `POST /api/v1/donations/:id/rematch`<br>Mock response: `{ "success": true, "data": { "status": "REMATCHING" } }` |
| **Schedule Pickup Logistics** | Member 4 | Pending | `POST /api/v1/acceptances/:acceptanceId/schedule-pickup`<br>Payload: `{ "pickupTime": string, "deliveryAgentId": string }`<br>Mock response: `{ "success": true, "data": { "status": "PICKUP_SCHEDULED" } }` |
| **Generate / Scan QR Handover** | Member 4 | Pending | `GET /api/v1/acceptances/:acceptanceId/qr-token`<br>Mock response: `{ "success": true, "data": { "qrToken": "signed_qr_jwt_mock", "expiresIn": 1800 } }` |
| **Food Safety Inspection** | Member 4 | Pending | `POST /api/v1/acceptances/:acceptanceId/safety-check`<br>Payload: `{ "temperatureCelsius": 68, "packagingIntact": true, "passed": true }`<br>Mock response: `{ "success": true, "data": { "status": "COMPLETED" } }` |
| **Donor / Agent Star Ratings** | Member 4 | Pending | `POST /api/v1/ratings`<br>Payload: `{ "targetUserId": string, "score": 5, "comment": "Great packaging!" }`<br>Mock response: `{ "success": true, "data": { "ratingId": "rate_123" } }` |

---

## 10. Summary Checklist for Frontend Development

- [ ] Use `http://localhost:5000/api/v1` as your base URL.
- [ ] Add `Authorization: Bearer <token>` to all protected requests.
- [ ] Fetch enums from `GET /api/v1/meta` for all dropdown options.
- [ ] Display `secondsToEffectiveExpiry` and `urgencyLevel` badges on food cards.
- [ ] Send `photos` as `multipart/form-data` using `FormData` (max 5 photos, max 2 MB each).
- [ ] Check `isVerified` on recipient users and display approval notice banner.
- [ ] Handle error codes using the standard error code mapping table.
