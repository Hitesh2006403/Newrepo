import React, { useState, useEffect } from 'react';
import { Sparkles, Clock, Check, X, Loader2, AlertCircle } from 'lucide-react';
import api from '../../services/api';

/**
 * OfferBanner
 * Prominently alerts a recipient to an active time-limited surplus offer.
 */
export default function OfferBanner({ offer, donation, onAccepted, onDeclined }) {
  const [timeLeft, setTimeLeft] = useState('');
  const [isExpired, setIsExpired] = useState(false);
  const [showDeclineModal, setShowDeclineModal] = useState(false);
  const [declineReason, setDeclineReason] = useState('Capacity reached / Not needed');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!offer?.expiresAt) return;

    const updateTimer = () => {
      const diff = new Date(offer.expiresAt).getTime() - Date.now();
      if (diff <= 0) {
        setTimeLeft('Expired');
        setIsExpired(true);
      } else {
        const mins = Math.floor(diff / 60000);
        const secs = Math.floor((diff % 60000) / 1000);
        setTimeLeft(`${mins}m ${secs < 10 ? '0' : ''}${secs}s`);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [offer?.expiresAt]);

  const handleDecline = async () => {
    setProcessing(true);
    setError(null);
    try {
      await api.declineOffer(offer._id || offer.id, declineReason);
      setShowDeclineModal(false);
      if (onDeclined) onDeclined(offer);
    } catch (err) {
      setError(err.message || 'Failed to decline offer');
    } finally {
      setProcessing(false);
    }
  };

  if (!offer || offer.status !== 'PENDING' || isExpired) return null;

  return (
    <>
      <div className="relative p-4 rounded-2xl bg-gradient-to-r from-rose-500/10 via-amber-500/10 to-rose-500/10 border border-rose-300 dark:border-rose-900/60 shadow-sm mb-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-rose-600 text-white shadow-sm shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                  Exclusive Match Offer
                </span>
                <span className="text-xs font-semibold text-neutral-500 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-amber-500" />
                  Reserved for {timeLeft}
                </span>
              </div>
              <h4 className="text-sm font-bold text-neutral-900 dark:text-white mt-1">
                {offer.suggestedQuantity} {donation?.unit || 'portions'} of {donation?.foodName || 'Surplus Food'}
              </h4>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={() => setShowDeclineModal(true)}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 border border-neutral-300 dark:border-neutral-700"
            >
              Decline
            </button>
            <button
              type="button"
              onClick={() => onAccepted && onAccepted(offer)}
              className="px-4 py-1.5 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 shadow-sm flex items-center gap-1.5"
            >
              <Check className="w-3.5 h-3.5" />
              Claim Reserved Surplus
            </button>
          </div>
        </div>
      </div>

      {/* Decline Reason Modal */}
      {showDeclineModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-neutral-900 w-full max-w-md rounded-2xl shadow-2xl border border-neutral-200 dark:border-neutral-800 p-5">
            <h3 className="text-sm font-bold text-neutral-900 dark:text-white mb-2">
              Decline Surplus Food Offer?
            </h3>
            <p className="text-xs text-neutral-500 mb-4">
              Declining this offer releases the food immediately to the next nearest community shelter.
            </p>

            <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
              Reason for declining:
            </label>
            <select
              value={declineReason}
              onChange={(e) => setDeclineReason(e.target.value)}
              className="w-full text-xs p-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 mb-4 text-neutral-800 dark:text-neutral-200"
            >
              <option value="Capacity reached / Not needed">Capacity reached / Not needed</option>
              <option value="Incompatible dietary requirements">Incompatible dietary requirements</option>
              <option value="Unable to arrange pickup/delivery">Unable to arrange pickup/delivery</option>
              <option value="Storage constraints">Storage constraints</option>
              <option value="Other">Other</option>
            </select>

            {error && <p className="text-xs text-rose-600 dark:text-rose-400 mb-3">{error}</p>}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowDeclineModal(false)}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDecline}
                disabled={processing}
                className="px-4 py-1.5 rounded-xl text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 flex items-center gap-1.5"
              >
                {processing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
                Confirm Decline
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
