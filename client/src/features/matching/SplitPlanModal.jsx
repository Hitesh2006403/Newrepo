import React, { useState, useEffect } from 'react';
import { GitFork, X, Check, Loader2, Users, AlertCircle, ArrowRight } from 'lucide-react';
import api from '../../services/api';

/**
 * SplitPlanModal
 * Modal allowing a donor to propose and confirm a multi-recipient split allocation.
 */
export default function SplitPlanModal({ isOpen, onClose, donation, onPlanConfirmed }) {
  const [maxParts, setMaxParts] = useState(3);
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [plan, setPlan] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen && donation) {
      loadPlan(maxParts);
    }
  }, [isOpen, donation, maxParts]);

  const loadPlan = async (partsCount) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getSplitPlan(donation._id || donation.id, partsCount);
      setPlan(res);
    } catch (err) {
      setError(err.message || 'Failed to calculate split plan');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!plan || !plan.parts || plan.parts.length === 0) return;
    setConfirming(true);
    setError(null);
    try {
      await api.confirmSplitPlan(donation._id || donation.id, plan.parts);
      if (onPlanConfirmed) onPlanConfirmed(plan);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to dispatch split offers');
    } finally {
      setConfirming(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-neutral-900 w-full max-w-lg rounded-2xl shadow-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-neutral-100 dark:border-neutral-800">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-600">
              <GitFork className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-neutral-900 dark:text-white">Split & Divide Surplus</h3>
              <p className="text-xs text-neutral-500">
                Allocate {donation?.remainingQuantity} {donation?.unit} across nearby shelters
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Max parts selector */}
          <div className="flex items-center justify-between bg-neutral-50 dark:bg-neutral-800/50 p-3 rounded-xl border border-neutral-200/60 dark:border-neutral-700/50">
            <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 flex items-center gap-1.5">
              <Users className="w-4 h-4 text-neutral-500" />
              Maximum Split Portions:
            </span>
            <div className="flex gap-1.5">
              {[2, 3, 4].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setMaxParts(n)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                    maxParts === n
                      ? 'bg-rose-600 text-white shadow-sm'
                      : 'bg-white dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700'
                  }`}
                >
                  {n} Shelters
                </button>
              ))}
            </div>
          </div>

          {/* Allocation preview */}
          {loading ? (
            <div className="py-8 flex flex-col items-center justify-center text-neutral-400 gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-rose-500" />
              <span className="text-xs">Computing nearest best-fit allocations...</span>
            </div>
          ) : plan?.parts?.length > 0 ? (
            <div className="space-y-2.5">
              <span className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                Proposed Distribution ({plan.parts.length} Recipients)
              </span>

              {plan.parts.map((p, idx) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/30 flex items-center justify-between gap-3"
                >
                  <div>
                    <h5 className="text-xs font-bold text-neutral-900 dark:text-white">{p.recipientName}</h5>
                    <p className="text-[11px] text-neutral-500">
                      {p.distanceKm} km away • {p.matchScore}% Match
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-extrabold text-rose-600 dark:text-rose-400">
                      {p.allocatedQuantity} {donation?.unit}
                    </span>
                    <p className="text-[10px] text-neutral-400">Reserved share</p>
                  </div>
                </div>
              ))}

              <div className="pt-2 flex justify-between text-xs text-neutral-500">
                <span>Total Allocated: <strong className="text-neutral-800 dark:text-white">{plan.totalAllocated} {donation?.unit}</strong></span>
                {plan.unallocated > 0 && (
                  <span className="text-amber-600 dark:text-amber-400">
                    Remaining Unallocated: {plan.unallocated} {donation?.unit}
                  </span>
                )}
              </div>
            </div>
          ) : (
            <div className="py-6 text-center text-neutral-500 text-xs">
              <AlertCircle className="w-6 h-6 mx-auto mb-2 text-neutral-400" />
              {plan?.message || 'No eligible candidates found within radar for splitting.'}
            </div>
          )}

          {error && <p className="text-xs text-rose-600 dark:text-rose-400">{error}</p>}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-neutral-100 dark:border-neutral-800 flex justify-end gap-2 bg-neutral-50/50 dark:bg-neutral-900">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={confirming || loading || !plan?.parts?.length}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 shadow-sm"
          >
            {confirming ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            Confirm & Dispatch Offers
          </button>
        </div>
      </div>
    </div>
  );
}
