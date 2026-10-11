import React from 'react';
import { PriorityBadge } from '../common/PriorityBadge';
import { ExpiryTimer } from '../common/ExpiryTimer';
import MatchScoreBadge from '../../features/matching/MatchScoreBadge';
import {
  Sparkles,
  MapPin,
  CheckCircle,
  Clock,
  ArrowRight,
  ShieldCheck,
  Split,
} from 'lucide-react';

export const MatchCard = ({ match, onClaim }) => {
  const { donation, matchScore, distanceKm, reasons } = match;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs hover:shadow-md transition-all duration-200 overflow-hidden flex flex-col justify-between">
      <div>
        {/* Card Header */}
        <div className="relative h-40 w-full bg-slate-100 overflow-hidden">
          <img
            src={donation.imageUrl || 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=600&q=80'}
            alt={donation.foodName}
            className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-transparent to-black/30" />

          {/* Explainable Match Score Badge */}
          <div className="absolute top-3 left-3 z-10">
            <MatchScoreBadge
              matchScore={matchScore}
              breakdown={match.scoreBreakdown || match.breakdown || {}}
              tier={match.tier || 1}
              reasons={reasons}
            />
          </div>

          {/* Distance Badge */}
          <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-xs text-white text-xs font-semibold px-2 py-0.5 rounded-lg flex items-center gap-1">
            <MapPin className="w-3 h-3 text-rose-400" />
            <span>{distanceKm} km away</span>
          </div>

          {/* Dietary & Category bottom pills */}
          <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-white text-xs">
            <span className="font-semibold uppercase text-[11px] tracking-wider bg-white/20 backdrop-blur-xs px-2 py-0.5 rounded">
              {donation.dietaryCategory || 'Standard'} • {donation.foodType?.replace('_', ' ')}
            </span>
            <span className="font-bold text-amber-300 text-sm">
              {donation.remainingQuantity} {donation.unit} left
            </span>
          </div>
        </div>

        {/* Card Body */}
        <div className="p-5 space-y-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h4 className="font-bold text-base text-slate-800 line-clamp-1 leading-snug">
                {donation.foodName}
              </h4>
              <p className="text-xs text-slate-500 mt-0.5">By {donation.donorName}</p>
            </div>
            <PriorityBadge priority={donation.priority || 'MEDIUM'} compact />
          </div>


          {/* Match Score Reason Breakdown */}
          <div className="bg-emerald-50/70 border border-emerald-100 rounded-xl p-3 space-y-1.5">
            <div className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider flex items-center gap-1">
              <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
              Algorithm Match Factors:
            </div>
            <div className="flex flex-wrap gap-1.5">
              {reasons?.map((reason, idx) => (
                <span
                  key={idx}
                  className="bg-white/80 border border-emerald-200 text-emerald-900 text-[11px] font-medium px-2 py-0.5 rounded-md"
                >
                  ✓ {reason}
                </span>
              ))}
            </div>
          </div>

          {/* Expiry Timer */}
          <ExpiryTimer
            expiryDeadline={donation.expiryDeadline}
            safetyBufferMinutes={donation.safetyBufferMinutes}
          />
        </div>
      </div>

      {/* Action Footer */}
      <div className="p-5 pt-0">
        <button
          onClick={() => onClaim(donation)}
          className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-rose-600 to-amber-500 hover:from-rose-500 hover:to-amber-400 text-white font-bold text-xs shadow-md shadow-rose-600/25 active:scale-95 transition"
        >
          <Split className="w-4 h-4" />
          <span>Claim Food (Full or Partial)</span>
          <ArrowRight className="w-3.5 h-3.5 ml-1" />
        </button>
      </div>
    </div>
  );
};
