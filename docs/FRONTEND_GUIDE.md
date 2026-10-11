# Share A Plate - Frontend Implementation Guide: Priority UI

This guide outlines the React UI components, states, badge designs, and interaction patterns for user-chosen Priority.

---

## 1. Visual Design & Badges

### `PriorityBadge.jsx`
Displays the user-chosen priority level. Color semantics:
- **`HIGH`**: Vibrant Rose/Red (`bg-red-50 text-red-700 border-red-200`)
- **`MEDIUM`**: Warm Amber (`bg-amber-50 text-amber-700 border-amber-200`)
- **`LOW`**: Cool Emerald/Green (`bg-emerald-50 text-emerald-700 border-emerald-200`)

### Visual Distinction
- The priority badge is prefixed with the label **`Priority:`**.
- The expiration countdown (`ExpiryTimer.jsx`) is prefixed with the label **`Time left:`**.
- Both badges are always visually separated so users never confuse the automatic timer with the user-selected priority.

---

## 2. Dynamic Metadata Integration

Allowed priority options are fetched at runtime from `GET /api/v1/meta`:
```javascript
const meta = await api.getMeta();
// meta.priorities -> ["LOW", "MEDIUM", "HIGH"]
```
Never hardcode priority lists directly inside input elements. If a legacy record is missing a priority value, the UI safely defaults to displaying **`MEDIUM`**.

---

## 3. Form Selectors

### Donor Create / Edit Modal (`CreateDonationModal.jsx`)
- Radio cards or selector pills for `Low`, `Medium`, `High`.
- Descriptive helper hints:
  - *Low*: Flexible pickup timing.
  - *Medium*: Standard rescue workflow.
  - *High*: Urgent redistribution needed immediately.
- Edit mode is enabled only when donation `status === 'AVAILABLE'` and has no accepted claims.

### Recipient Post / Edit Modal (`PostRequirementModal.jsx`)
- Selector for `Low`, `Medium`, `High`.
- Sends `priority` to `POST /api/v1/requirements` or `PATCH /api/v1/requirements/:id`.
- Stops sending deprecated `urgency` parameter directly from new frontend code.

---

## 4. List Filtering & Sorting

- **Filter Chips**: Multi-select pills (`All`, `High`, `Medium`, `Low`). When clicked, parameters are mapped to `?priority=HIGH,MEDIUM`.
- **Sort Dropdown**:
  - `Priority (High to Low)` -> `sort=priority_desc`
  - `Time left (Expiring soonest)` -> `sort=expiry_asc`
  - `Newest First` -> `sort=newest`
  - `Nearest First` -> `sort=distance`
- **Pagination Invariant**: Any change in priority filter chips or sort dropdown immediately resets current page to `1`.
