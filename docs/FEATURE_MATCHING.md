# Smart Matching, Auto-Allotment & Split Engine (Phase 3)

## Overview & Plain-Language Explanation
Share A Plate's Smart Matching Engine connects food donors with verified non-profits, shelters, and community kitchens who need that food most urgently.

Rather than a simple first-come-first-served listing, the system uses an explainable, server-calculated match score and an automated multi-tier allotment algorithm. It ensures surplus food goes to the nearest community, in the exact portion sizes required, without food spoiling on the counter.

---

## 1. Hard Eligibility Filters (Never Scored)
Before calculating any scores, candidates are screened through strict safety, legal, and operational gates. If any hard filter fails, the candidate is immediately excluded:
1. **Safety Buffer & Expiry:** Any donation that has reached its effective expiry (donation expiry minus the 60-minute safety buffer) is never offered or matched.
2. **Account Status:** The recipient must be an active, verified organization (`isVerified: true`, `isDeactivated: false`, `mapVisible: true`).
3. **No Self-Matches:** A donor cannot match with their own posted donation.
4. **Demand Status:** The requirement must be open for fulfillment (`status: 'OPEN'` or `'PARTIALLY_FULFILLED'`) with unmet need > 0.
5. **Prior Rejections:** Any recipient who previously declined an offer or rejected a claim for this specific donation is excluded.
6. **Maximum Proximity:** Both parties must be within the maximum platform radius (default 5 km, auto-widened once to 10 km if no candidates are found in Ring 1).
7. **Dietary Rules:** Strict dietary restrictions are never violated (e.g. a vegetarian requirement is never matched with non-vegetarian surplus).

---

## 2. Explainable 0–100 Match Score Breakdown
Every eligible candidate receives an explainable score between 0 and 100 calculated strictly on the backend. No score is trusted from client input.

The score consists of 7 normalized components:

| Component | Max Points | What It Evaluates |
| :--- | :---: | :--- |
| **Urgency** | 20 | Combines hours remaining before the safety buffer with the donation's priority level. |
| **Requirement Priority** | 15 | Priority level set by the recipient organization (`HIGH`: 15, `MEDIUM`: 10, `LOW`: 5). |
| **Distance Proximity** | 20 | Closer matches receive more points (calculated from approximate locations to preserve privacy). |
| **Quantity Fit** | 20 | How well the available quantity meets the recipient's requested need. |
| **Dietary & Food Type** | 10 | Compatibility between food type (e.g. cooked meals, raw groceries) and dietary preference. |
| **Pickup Window** | 10 | Overlap between the donor's pickup window and the recipient's required delivery timeline. |
| **Recipient Reliability** | 5 | Platform rating average with a small capped deduction for repeated unfulfilled claims. |
| **Total** | **100** | **Normalized aggregate score.** |

Every recommendation returned by `GET /api/v1/matches/recommendations` includes a full `breakdown` detailing the exact points, maximum points, and plain-language reason for each component.

---

## 3. Allotment Order: Distance Rings & Quantity Tiers
When determining which recipient gets first access to a donation, candidates are sorted according to a deterministic multi-stage order:

### Stage 1: Distance Rings
- **Ring 1 (≤ 5 km):** All eligible candidates within 5 km are considered first.
- **Ring 2 (5 km – 10 km):** Candidates beyond 5 km are only evaluated after all Ring 1 candidates have been processed or declined.

### Stage 2: Quantity-Fit Tiers (Within a Ring)
1. **Tier 1 (Exact Fit):** Needed quantity equals available surplus (100% matched, leaves zero surplus).
2. **Tier 2 (Approximate Fit):** Needed quantity is within 20% tolerance of available surplus.
3. **Tier 3 (Split Fit):** Recipient needs less than the available surplus (leaving a portion for others).
4. **Tier 4 (Partial Fit):** Recipient needs more than the available surplus (takes all, needs more elsewhere).

### Stage 3: Priority, Proximity, and Score
- Inside the same tier, `HIGH` priority requirements are considered before `MEDIUM` or `LOW`.
- Nearest distance first.
- Highest total match score break ties.

---

## 4. Auto-Allotment Waves (`allotMode: AUTO`)
Donors can choose between `MANUAL` (browse recommendations and select recipients) and `AUTO` allotment:
- In `AUTO` mode, the server creates a time-limited **Offer** with a `suggestedQuantity` for the #1 ranked candidate.
- An offer gives the recipient an exclusive window (`OFFER_TTL_MINUTES`, default 10 minutes) to review and accept the food.
- If the recipient **declines** or the timer **expires**, the server automatically increments the wave counter and sends the offer to candidate #2.
- The actual reservation always executes via the platform's atomic accept transaction, guaranteeing that surplus can never be over-allocated.

---

## 5. Split-and-Divide & Split-and-Accept
When a donor has a large quantity (e.g. 100 plates) that cannot be consumed by a single small shelter:
- **Donor Split Plan (`GET /api/v1/donations/:id/split-plan`):** Proposes an optimal split across 2 to 4 nearby shelters (each receiving at least `MIN_PORTION_QUANTITY = 5` portions).
- **Donor Confirm Split (`POST /api/v1/donations/:id/split-plan/confirm`):** Dispatches targeted offers simultaneously to each shelter in the split plan.
- **Recipient Multi-Donor Accept:** A shelter needing 50 plates can accept 20 plates from Donor A and 30 plates from Donor B. The requirement updates its `quantityFulfilled` tracker from `OPEN` to `PARTIALLY_FULFILLED` to `FULFILLED`.
- **Completion Helper (`GET /api/v1/requirements/:id/complete-with`):** For a partially fulfilled requirement, the API suggests compatible surplus donations that match the exact remaining gap.

---

## 6. Reject-then-Reopen Lifecycle
If an agreement falls through before pickup:
- **Decline Offer (`POST /api/v1/matches/offers/:offerId/decline`):** Marks the offer `DECLINED`, records the decline reason, excludes that recipient from this donation, and advances the wave in AUTO mode.
- **Reject Claim (`POST /api/v1/acceptances/:id/reject`):** If an accepted claim is cancelled before collection:
  - Acceptance status updates to `REJECTED`.
  - The donation's `remainingQuantity` is restored immediately.
  - Linked delivery fees are marked `VOIDED` and assigned delivery agents are released.
  - The recipient requirement's `quantityFulfilled` is reduced back.
  - If the donation was in AUTO mode, the remainder is immediately offered to the next candidate wave.
