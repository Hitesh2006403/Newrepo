# Share A Plate - Teammate Integration Guide: Priority Engine

This guide establishes the architecture and strict conventions for integrating with the **User-Chosen Priority** system across all 4 merged submodules (Matching, Deliveries, Admin, Recipient Demand).

---

## 1. Single Source of Truth

All modules import priority constants from:
`backend/src/constants/priority.js`

```javascript
const {
  PRIORITY,               // { LOW: 'LOW', MEDIUM: 'MEDIUM', HIGH: 'HIGH' }
  PRIORITY_WEIGHTS,       // { LOW: 1, MEDIUM: 2, HIGH: 3 }
  PRIORITY_OPTIONS,       // ['LOW', 'MEDIUM', 'HIGH']
  calculatePriorityBoost, // Server-side score calculator
} = require('./constants/priority');
```

---

## 2. Core Architectural Invariants

Every teammate module must uphold these five rules:

### Rule 1: Priority != Urgency Level
- **Priority**: Explicitly chosen by the donor or recipient (`LOW`, `MEDIUM`, `HIGH`). Default is `MEDIUM`.
- **Urgency Level (`urgencyLevel`)**: Automatically calculated by the platform based on real-time countdown to effective expiration deadline (`CRITICAL` < 2 hrs, `URGENT` < 4 hrs, `NORMAL`).
- **Invariant**: Both fields must be displayed together. Priority never overrides or replaces the time countdown.

### Rule 2: Priority Never Changes Statuses or Operations
- Setting a donation or requirement to `HIGH` priority does **NOT**:
  - Bypass safety checks or safety buffer rules (e.g., 60-minute consumption buffer).
  - Modify quantity math, atomic reservation locks, or remaining quantity calculations.
  - Change status transitions (`AVAILABLE` -> `PARTIALLY_ACCEPTED` -> `ACCEPTED` / `EXPIRED`).
  - Bypass QR verification tokens or delivery proof requirements.

### Rule 3: Zero Trust for Client-Sent Weights or Scores
- Clients must **never** send `priorityWeight` or `matchScore`.
- Any request containing `priorityWeight` or `matchScore` is rejected with `400 BAD_REQUEST`.
- The server recalculates and stores `priorityWeight` automatically in Mongoose pre-validate hooks.

### Rule 4: Match Score Formula & Explainability
Priority contributes an explainable boost to the smart matching engine:
- If Donation is `HIGH` and Requirement is `HIGH`: **+6 points**
- If one is `HIGH` and the other is `MEDIUM`: **+4 points**
- If both are `MEDIUM`: **+2 points**
- Otherwise: **0 points**

The breakdown object explicitly reports `priorityBoost`:
```json
{
  "total": 92,
  "breakdown": {
    "foodType": 35,
    "dietary": 25,
    "distance": 18,
    "quantityFit": 10,
    "priorityBoost": 4
  }
}
```
**Safety Invariant**: An expired donation, a food safety violation, or a zero remaining quantity will ALWAYS yield 0 score / complete exclusion, regardless of priority.

### Rule 5: Notification Privacy & Rate Limits
When a `HIGH` priority donation is published:
- Triggered automatically via `notifyHighPriorityMatch(donation)`.
- Recipients with matching foodType and `HIGH` open requirements receive an in-app alert.
- Maximum 20 recipients per donation.
- **Privacy Rule**: The notification text MUST NOT include full street addresses or donor phone numbers.
