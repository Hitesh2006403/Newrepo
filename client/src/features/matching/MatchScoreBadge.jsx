import React, { useState } from 'react';
import { Award, ChevronDown, ChevronUp, Clock, MapPin, Package, ShieldCheck, Heart, AlertCircle } from 'lucide-react';

/**
 * MatchScoreBadge
 * Renders an explainable match score badge with expandable per-component breakdown.
 */
export default function MatchScoreBadge({ matchScore = 0, breakdown = {}, tier = 1, reasons = [] }) {
  const [expanded, setExpanded] = useState(false);

  // Theme-aware score color
  const getScoreColor = (score) => {
    if (score >= 80) return 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800';
    if (score >= 60) return 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800';
    return 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800';
  };

  const getTierLabel = (t) => {
    switch (t) {
      case 1:
        return 'Tier 1 • Exact Fit';
      case 2:
        return 'Tier 2 • Approx Fit';
      case 3:
        return 'Tier 3 • Split Surplus';
      case 4:
        return 'Tier 4 • Partial Need';
      default:
        return `Tier ${t}`;
    }
  };

  return (
    <div className="relative inline-block text-left">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all hover:shadow-sm ${getScoreColor(
          matchScore
        )}`}
        title="Click to view explainable score breakdown"
      >
        <Award className="w-3.5 h-3.5" />
        <span>{matchScore}% Match</span>
        <span className="opacity-75 font-normal">({getTierLabel(tier)})</span>
        {expanded ? <ChevronUp className="w-3 h-3 ml-0.5" /> : <ChevronDown className="w-3 h-3 ml-0.5" />}
      </button>

      {expanded && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 p-4 bg-white dark:bg-neutral-900 rounded-xl shadow-xl border border-neutral-200 dark:border-neutral-800 z-50 animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center justify-between pb-3 border-b border-neutral-100 dark:border-neutral-800">
            <div>
              <h4 className="text-sm font-bold text-neutral-900 dark:text-white flex items-center gap-1.5">
                <Award className="w-4 h-4 text-emerald-600" />
                Explainable Match Breakdown
              </h4>
              <p className="text-xs text-neutral-500">{getTierLabel(tier)} • Server Calculated</p>
            </div>
            <span className={`text-base font-extrabold px-2 py-0.5 rounded-lg border ${getScoreColor(matchScore)}`}>
              {matchScore} / 100
            </span>
          </div>

          <div className="mt-3 space-y-2 text-xs">
            {/* Urgency */}
            {breakdown.urgency && (
              <div className="flex items-start justify-between gap-2 p-1.5 rounded-lg bg-neutral-50 dark:bg-neutral-800/40">
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                  <div>
                    <span className="font-medium text-neutral-800 dark:text-neutral-200">Urgency:</span>
                    <span className="text-neutral-500 ml-1">{breakdown.urgency.reason}</span>
                  </div>
                </div>
                <span className="font-semibold text-neutral-700 dark:text-neutral-300 whitespace-nowrap">
                  {breakdown.urgency.points}/{breakdown.urgency.max}
                </span>
              </div>
            )}

            {/* Requirement Priority */}
            {breakdown.requirementPriority && (
              <div className="flex items-start justify-between gap-2 p-1.5 rounded-lg bg-neutral-50 dark:bg-neutral-800/40">
                <div className="flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  <div>
                    <span className="font-medium text-neutral-800 dark:text-neutral-200">Demand Priority:</span>
                    <span className="text-neutral-500 ml-1">{breakdown.requirementPriority.reason}</span>
                  </div>
                </div>
                <span className="font-semibold text-neutral-700 dark:text-neutral-300 whitespace-nowrap">
                  {breakdown.requirementPriority.points}/{breakdown.requirementPriority.max}
                </span>
              </div>
            )}

            {/* Distance */}
            {breakdown.distance && (
              <div className="flex items-start justify-between gap-2 p-1.5 rounded-lg bg-neutral-50 dark:bg-neutral-800/40">
                <div className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                  <div>
                    <span className="font-medium text-neutral-800 dark:text-neutral-200">Proximity:</span>
                    <span className="text-neutral-500 ml-1">{breakdown.distance.reason}</span>
                  </div>
                </div>
                <span className="font-semibold text-neutral-700 dark:text-neutral-300 whitespace-nowrap">
                  {breakdown.distance.points}/{breakdown.distance.max}
                </span>
              </div>
            )}

            {/* Quantity Fit */}
            {breakdown.quantityFit && (
              <div className="flex items-start justify-between gap-2 p-1.5 rounded-lg bg-neutral-50 dark:bg-neutral-800/40">
                <div className="flex items-center gap-1.5">
                  <Package className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  <div>
                    <span className="font-medium text-neutral-800 dark:text-neutral-200">Quantity Fit:</span>
                    <span className="text-neutral-500 ml-1">{breakdown.quantityFit.reason}</span>
                  </div>
                </div>
                <span className="font-semibold text-neutral-700 dark:text-neutral-300 whitespace-nowrap">
                  {breakdown.quantityFit.points}/{breakdown.quantityFit.max}
                </span>
              </div>
            )}

            {/* Reliability */}
            {breakdown.reliability && (
              <div className="flex items-start justify-between gap-2 p-1.5 rounded-lg bg-neutral-50 dark:bg-neutral-800/40">
                <div className="flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-purple-500 shrink-0" />
                  <div>
                    <span className="font-medium text-neutral-800 dark:text-neutral-200">Reliability:</span>
                    <span className="text-neutral-500 ml-1">{breakdown.reliability.reason}</span>
                  </div>
                </div>
                <span className="font-semibold text-neutral-700 dark:text-neutral-300 whitespace-nowrap">
                  {breakdown.reliability.points}/{breakdown.reliability.max}
                </span>
              </div>
            )}
          </div>

          <div className="mt-3 pt-2 border-t border-neutral-100 dark:border-neutral-800 flex justify-end">
            <button
              type="button"
              onClick={() => setExpanded(false)}
              className="text-xs text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 underline"
            >
              Close breakdown
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
