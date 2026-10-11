/**
 * Delivery Fee Constants & Computation for Share A Plate.
 *
 * Implements voluntary fee agreement between donor, recipient, and delivery agent.
 * Note: Payment is settled externally between parties. The platform never acts
 * as an intermediary, wallet, or payment gateway.
 */

const PAYER_MODE = Object.freeze({
  NONE: 'NONE',         // Volunteer / Free delivery (food-only)
  DONOR: 'DONOR',       // Donor covers the delivery fee
  RECIPIENT: 'RECIPIENT', // Recipient covers the delivery fee
  SPLIT: 'SPLIT',       // Cost split between donor and recipient
});

const FEE_STATUS = Object.freeze({
  PROPOSED: 'PROPOSED',
  AGREED: 'AGREED',
  DECLINED: 'DECLINED',
  VOIDED: 'VOIDED',
});

const getFeeConfig = () => {
  const maxAmount = Number(process.env.FEE_MAX_AMOUNT || 500);
  const baseAmount = Number(process.env.FEE_BASE_AMOUNT || 30);
  const perKm = Number(process.env.FEE_PER_KM || 10);
  return { maxAmount, baseAmount, perKm };
};

/**
 * Calculates suggested delivery fee strictly server-side based on route distance.
 *
 * @param {number} distanceKm
 * @returns {number} Suggested amount in INR rounded to integer
 */
const calculateSuggestedFee = (distanceKm) => {
  const { maxAmount, baseAmount, perKm } = getFeeConfig();
  if (isNaN(distanceKm) || distanceKm <= 0) return baseAmount;
  const raw = baseAmount + perKm * distanceKm;
  return Math.min(maxAmount, Math.max(0, Math.round(raw)));
};

module.exports = {
  PAYER_MODE,
  FEE_STATUS,
  getFeeConfig,
  calculateSuggestedFee,
};
