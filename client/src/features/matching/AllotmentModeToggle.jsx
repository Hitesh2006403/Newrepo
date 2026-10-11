import React, { useState } from 'react';
import { Cpu, UserCheck, Sparkles, Loader2, Info } from 'lucide-react';
import api from '../../services/api';

/**
 * AllotmentModeToggle
 * Lets a donor switch a donation between MANUAL review and AUTO best-fit wave allotment.
 */
export default function AllotmentModeToggle({ donation, onModeChange }) {
  const [currentMode, setCurrentMode] = useState(donation?.allotMode || 'MANUAL');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleToggle = async (newMode) => {
    if (newMode === currentMode || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.updateAllotMode(donation._id || donation.id, newMode);
      setCurrentMode(newMode);
      if (onModeChange) onModeChange(newMode, res);
    } catch (err) {
      setError(err.message || 'Failed to update allotment mode');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-neutral-50 dark:bg-neutral-900/60 p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-bold uppercase tracking-wider text-neutral-500 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
          Allotment Strategy
        </span>
        {loading && <Loader2 className="w-3.5 h-3.5 animate-spin text-neutral-400" />}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => handleToggle('MANUAL')}
          disabled={loading}
          className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold border transition-all ${
            currentMode === 'MANUAL'
              ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white border-neutral-300 dark:border-neutral-700 shadow-sm'
              : 'text-neutral-500 hover:text-neutral-700 border-transparent'
          }`}
        >
          <UserCheck className="w-3.5 h-3.5" />
          Manual Review
        </button>

        <button
          type="button"
          onClick={() => handleToggle('AUTO')}
          disabled={loading}
          className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold border transition-all ${
            currentMode === 'AUTO'
              ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-800 shadow-sm'
              : 'text-neutral-500 hover:text-neutral-700 border-transparent'
          }`}
        >
          <Cpu className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
          Auto Best-Fit
        </button>
      </div>

      <p className="mt-2 text-[11px] text-neutral-500 flex items-start gap-1">
        <Info className="w-3 h-3 text-neutral-400 shrink-0 mt-0.5" />
        {currentMode === 'AUTO'
          ? 'Auto mode sends a 10-minute exclusive offer to the nearest best-fit shelter. If expired or declined, it automatically rolls to the next.'
          : 'Manual mode lets you review matched recipient organizations and approve claims individually.'}
      </p>

      {error && <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">{error}</p>}
    </div>
  );
}
