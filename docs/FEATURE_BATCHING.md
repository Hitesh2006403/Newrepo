# Phase 4: Delivery Batching, Multi-Stop Co-Routing, Load/Vehicle Matching & Safety Buffer Feasibility

## 1. Plain Language Overview (For Non-Technical Readers)

In real-world food rescue, volunteer drivers and delivery partners often waste time and fuel making separate back-and-forth trips for donations that are just a few streets away from one another.

**Delivery Batching** solves this by grouping 2 to 3 compatible food pickups and dropoffs into a single, combined delivery run. 

Instead of driving:
> Kitchen A $\to$ Shelter A, then returning to Kitchen B $\to$ Shelter B

A driver can make an efficient chained trip:
> Kitchen A $\to$ Kitchen B $\to$ Shelter A $\to$ Shelter B

### Core Guarantees:
1. **Vehicle Load Limits:** We never assign more food than the driver's vehicle can safely carry.
2. **Food Expiry Safety Buffer:** Cooked food is sensitive to time. Every stop is evaluated along the actual road route. If cumulative traffic and handling time would cause any food to arrive after its safe consumption margin, the batch is rejected immediately.
3. **Precedence Protection:** A driver cannot deliver food before picking it up. All pickups always precede their corresponding dropoffs in the route plan.
4. **No Double-Claiming:** When a driver claims a batch, all included tasks are atomically locked, preventing race conditions.

---

## 2. Vehicle Classes & Capacity Limits

The platform supports four standardized vehicle classes:

| Vehicle Class | Typical Transport | Max Plates | Max Weight (kg) | Ideal Use Case |
| :--- | :--- | :--- | :--- | :--- |
| **`2_WHEELER`** | Scooter / Motorcycle | **20 plates** | **15 kg** | Fast single/pair urban neighborhood deliveries |
| **`3_WHEELER`** | Auto-rickshaw / Cargo 3W | **60 plates** | **50 kg** | Medium restaurant batches & narrow street access |
| **`4_WHEELER`** | Car / Small Van (e.g. Maruti Eeco) | **150 plates** | **120 kg** | Catered events, community hall surplus |
| **`TRUCK`** | Mini-truck (e.g. Tata Ace, Bolero) | **500 plates** | **400 kg** | Large wedding surplus, convention center distributions |

If a batch's combined portions exceed the chosen vehicle's capacity, the system blocks creation with `400 BATCH_CAPACITY_EXCEEDED` and advises the minimum vehicle size required.

---

## 3. Multi-Stop Co-Routing Algorithm

Given $N$ tasks (where $2 \le N \le 3$), each task $i$ has two waypoints:
- $P_i$: Pickup location (donor premises)
- $D_i$: Dropoff location (recipient shelter / community kitchen)

### Step 1: Corridor Proximity Filter
All pickup points must be within a **10 km radius** of one another. Tasks situated across opposite ends of the city are incompatible for batching.

### Step 2: Valid Precedence Permutations
For 2 tasks ($A$ and $B$), the route must satisfy $P_A < D_A$ and $P_B < D_B$. The 6 valid orderings are evaluated:
1. $P_A \to D_A \to P_B \to D_B$ (Sequential A then B)
2. $P_A \to P_B \to D_A \to D_B$ (Interleaved: both picked up first)
3. $P_A \to P_B \to D_B \to D_A$ (Interleaved reverse drop)
4. $P_B \to D_B \to P_A \to D_A$ (Sequential B then A)
5. $P_B \to P_A \to D_B \to D_A$ (Interleaved B first)
6. $P_B \to P_A \to D_A \to D_B$ (Interleaved B first, drop A first)

For 3 tasks ($A, B, C$), the 90 mathematically valid precedence orderings are generated and evaluated.

### Step 3: Road Distance & Safety Buffer Timeline Calculation
For each valid permutation:
1. We compute road distance and driving duration between each consecutive stop using OSRM (with straight-line Haversine fallback).
2. We add a **15-minute handling & loading buffer** for each stop.
3. We track cumulative clock time $T_{\text{arr}}(k)$ for each stop $k$.
4. **Safety Feasibility Check:**
   $$T_{\text{arr}}(k) \le \text{EffectiveExpiry}(k) = \text{ExpiryAt}(k) - \text{SafetyBufferMinutes}(k)$$
5. Any sequence that breaches the safety buffer at ANY stop is disqualified.
6. Among all feasible sequences, the platform selects the permutation with the **minimum total road distance**.

If zero permutations satisfy safety buffer feasibility, batching is blocked with `400 PICKUP_NOT_FEASIBLE`.

---

## 4. API Endpoints Reference

Base Path: `/api/v1/delivery/batches` (also aliased under `/api/v1/batches`)

### 1. `GET /api/v1/delivery/batches/available`
Finds proposed batches and compatible 2-task co-routing pairings.
- **Query params:** `vehicleType` (default `'2_WHEELER'`), `agentId`
- **Response:**
  ```json
  {
    "success": true,
    "data": {
      "proposedBatches": [...],
      "suggestedBatches": [...],
      "unbatchedOpenTaskCount": 4
    }
  }
  ```

### 2. `POST /api/v1/delivery/batches`
Creates a new verified delivery batch.
- **Request body:**
  ```json
  {
    "taskIds": ["653a...", "653b..."],
    "vehicleType": "2_WHEELER"
  }
  ```
- **Response:** 201 Created with ordered `stops`, `metrics` (total distance, ETA, capacity utilization %, total payout, delivery fees).

### 3. `POST /api/v1/delivery/batches/preview`
Simulates and returns optimal stops and route metrics without saving to the database. Useful for driver route preview modals.

### 4. `GET /api/v1/delivery/batches/:id`
Retrieves batch details by MongoDB ID or human-readable `batchNumber` (e.g. `BATCH-M2A3B-4912`).

### 5. `POST /api/v1/delivery/batches/:id/claim`
Atomically assigns the batch and all constituent tasks to the claiming driver:
- Locks task fees (`feeLocked: true`).
- Updates task milestones to `ASSIGNED`.
- Sets batch status to `CLAIMED`.
- Emits `batch.changed` and `pickup.assigned` events.

### 6. `POST /api/v1/delivery/batches/:id/release`
Releases a claimed batch back to the open pool, freeing tasks and resetting status.

---

## 5. Feature Flag Control

Delivery batching is guarded by the `FEATURE_BATCH` feature flag in `featureFlags.js`.
- If `process.env.FEATURE_BATCH === 'false'`, all batch routes return `404 FEATURE_DISABLED` with a clear explanation.
