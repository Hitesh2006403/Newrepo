/**
 * Vehicle and Batch Logistics Constants for Share A Plate.
 *
 * Vehicle Specifications:
 * - 2_WHEELER: Bikes / Scooters -> up to 20 plates / 15 kg
 * - 3_WHEELER: Auto-rickshaws / Cargo 3W -> up to 60 plates / 50 kg
 * - 4_WHEELER: Cars / Small Vans -> up to 150 plates / 120 kg
 * - TRUCK: Mini Trucks / Tata Ace -> up to 500 plates / 400 kg
 */

const VEHICLE_TYPES = Object.freeze({
  TWO_WHEELER: '2_WHEELER',
  THREE_WHEELER: '3_WHEELER',
  FOUR_WHEELER: '4_WHEELER',
  TRUCK: 'TRUCK',
});

const VEHICLE_CAPACITIES = Object.freeze({
  '2_WHEELER': {
    type: '2_WHEELER',
    label: 'Two-Wheeler (Bike / Scooter)',
    maxPlates: 20,
    maxKg: 15,
    speedFactor: 1.1,
    icon: 'Bike',
  },
  '3_WHEELER': {
    type: '3_WHEELER',
    label: 'Three-Wheeler (Auto / Cargo 3W)',
    maxPlates: 60,
    maxKg: 50,
    speedFactor: 1.0,
    icon: 'CarFront',
  },
  '4_WHEELER': {
    type: '4_WHEELER',
    label: 'Four-Wheeler (Car / Delivery Van)',
    maxPlates: 150,
    maxKg: 120,
    speedFactor: 0.9,
    icon: 'Car',
  },
  TRUCK: {
    type: 'TRUCK',
    label: 'Mini Truck (Tata Ace / Pickup)',
    maxPlates: 500,
    maxKg: 400,
    speedFactor: 0.8,
    icon: 'Truck',
  },
});

const BATCH_STATUS = Object.freeze({
  PROPOSED: 'PROPOSED',
  CLAIMED: 'CLAIMED',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
});

const BATCH_CONFIG = Object.freeze({
  MIN_BATCH_TASKS: 2,
  MAX_BATCH_TASKS: 3,
  MAX_CORRIDOR_KM: 10,
  STOP_HANDLING_BUFFER_MINUTES: 15,
  DEFAULT_SAFETY_BUFFER_MINUTES: 60,
  DEFAULT_VEHICLE: '2_WHEELER',
});

/**
 * Parses numeric plates/quantity from various input formats:
 * - Number: 25 -> 25
 * - String: '25 plates' -> 25, '30' -> 30, '15 kg' -> 15
 */
const parseTaskQuantity = (qtyStrOrNum) => {
  if (typeof qtyStrOrNum === 'number') return qtyStrOrNum;
  if (!qtyStrOrNum) return 0;
  const match = String(qtyStrOrNum).match(/(\d+(\.\d+)?)/);
  return match ? parseFloat(match[1]) : 0;
};

/**
 * Determines minimum vehicle required for a given plate count and weight.
 */
const getRecommendedVehicle = (plates = 0, weightKg = 0) => {
  for (const vType of ['2_WHEELER', '3_WHEELER', '4_WHEELER', 'TRUCK']) {
    const cap = VEHICLE_CAPACITIES[vType];
    if (plates <= cap.maxPlates && weightKg <= cap.maxKg) {
      return vType;
    }
  }
  return 'TRUCK';
};

/**
 * Validates whether a given load fits within a vehicle's capacity.
 */
const isLoadWithinCapacity = (vehicleType, plates = 0, weightKg = 0) => {
  const cap = VEHICLE_CAPACITIES[vehicleType] || VEHICLE_CAPACITIES['2_WHEELER'];
  return {
    fits: plates <= cap.maxPlates && weightKg <= cap.maxKg,
    maxPlates: cap.maxPlates,
    maxKg: cap.maxKg,
    platesExcess: Math.max(0, plates - cap.maxPlates),
    kgExcess: Math.max(0, weightKg - cap.maxKg),
  };
};

module.exports = {
  VEHICLE_TYPES,
  VEHICLE_CAPACITIES,
  BATCH_STATUS,
  BATCH_CONFIG,
  parseTaskQuantity,
  getRecommendedVehicle,
  isLoadWithinCapacity,
};
