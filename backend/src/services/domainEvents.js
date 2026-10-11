const EventEmitter = require('events');

/**
 * Domain Events Emitter for Share A Plate.
 *
 * In-process decoupled event bus enabling cross-segment communication
 * without direct circular controller imports.
 *
 * Named Events:
 * - acceptance.created
 * - acceptance.cancelled
 * - acceptance.rejected
 * - offer.expired
 * - donation.created
 * - donation.remainder.changed
 * - pickup.assigned
 * - pickup.released
 * - batch.changed
 */
class DomainEventEmitter extends EventEmitter {
  constructor() {
    super();
    // Increase listener limit to prevent memory leak warnings
    this.setMaxListeners(50);
  }

  /**
   * Safe event emission: Wraps listeners in try/catch to ensure
   * event handler failures never crash the HTTP request or process.
   * Never prints secrets or geographic coordinates.
   *
   * @param {string} eventName
   * @param {Object} payload
   */
  emitSafe(eventName, payload = {}) {
    const listeners = this.listeners(eventName);
    if (!listeners || listeners.length === 0) {
      return;
    }

    // Scrub any sensitive data before logging event telemetry
    const sanitizedPayload = { ...payload };
    delete sanitizedPayload.token;
    delete sanitizedPayload.password;
    delete sanitizedPayload.phone;
    delete sanitizedPayload.coordinates;
    delete sanitizedPayload.location;

    for (const listener of listeners) {
      try {
        const result = listener(payload);
        if (result && typeof result.catch === 'function') {
          result.catch((err) => {
            console.error(`[DomainEvent Error] Handler for '${eventName}' failed:`, err.message);
          });
        }
      } catch (err) {
        console.error(`[DomainEvent Error] Sync handler for '${eventName}' failed:`, err.message);
      }
    }
  }
}

const domainEvents = new DomainEventEmitter();

const DOMAIN_EVENT_NAMES = Object.freeze({
  ACCEPTANCE_CREATED: 'acceptance.created',
  ACCEPTANCE_CANCELLED: 'acceptance.cancelled',
  ACCEPTANCE_REJECTED: 'acceptance.rejected',
  OFFER_EXPIRED: 'offer.expired',
  DONATION_CREATED: 'donation.created',
  DONATION_REMAINDER_CHANGED: 'donation.remainder.changed',
  PICKUP_ASSIGNED: 'pickup.assigned',
  PICKUP_RELEASED: 'pickup.released',
  BATCH_CHANGED: 'batch.changed',
});

module.exports = {
  domainEvents,
  DOMAIN_EVENT_NAMES,
  emitEvent: (eventName, payload) => domainEvents.emitSafe(eventName, payload),
};
