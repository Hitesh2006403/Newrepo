import React from 'react';
import { Flame, ShieldAlert, Sparkles } from 'lucide-react';

const PRIORITY_STYLES = {
  LOW: {
    label: 'Low',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-300',
    dotClass: 'bg-emerald-500',
    icon: Sparkles,
  },
  MEDIUM: {
    label: 'Medium',
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-300',
    dotClass: 'bg-amber-500',
    icon: Flame,
  },
  HIGH: {
    label: 'High',
    badgeClass: 'bg-rose-50 text-rose-700 border-rose-300 font-semibold',
    dotClass: 'bg-rose-600 animate-pulse',
    icon: ShieldAlert,
  },
};

export const PriorityBadge = ({ priority = 'MEDIUM', compact = false, className = '' }) => {
  const normPriority = (priority || 'MEDIUM').toUpperCase();
  const config = PRIORITY_STYLES[normPriority] || PRIORITY_STYLES.MEDIUM;
  const Icon = config.icon;

  if (compact) {
    return (
      <span
        title={`Priority: ${config.label}`}
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs border ${config.badgeClass} ${className}`}
      >
        <Icon className="w-3 h-3" />
        <span className="font-semibold">{config.label}</span>
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs border shadow-xs ${config.badgeClass} ${className}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${config.dotClass}`} />
      <span className="font-medium text-slate-500 text-[11px]">Priority:</span>
      <span className="font-bold">{config.label}</span>
    </span>
  );
};

export default PriorityBadge;
