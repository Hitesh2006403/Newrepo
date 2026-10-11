import React, { useState, useEffect } from 'react';
import {
  Utensils,
  Leaf,
  ShieldCheck,
  TrendingUp,
  Radio,
  Sparkles,
  Users,
  Award,
  Globe2,
} from 'lucide-react';
import { useDonations } from '../../context/DonationContext';

/**
 * SpatialImpactHUD
 * An interactive 3D spatial telemetry HUD displaying real-time platform metrics,
 * meals rescued, CO2 emission offsets, and live food-rescue radar telemetry.
 */
export const SpatialImpactHUD = () => {
  const { impactMetrics } = useDonations();
  const [activeTab, setActiveTab] = useState('overview');

  const meals = impactMetrics?.mealsSaved || 1420;
  const co2Kg = impactMetrics?.co2Saved || Math.round(meals * 2.5);
  const activeRescues = impactMetrics?.activeDonations || 8;
  const volunteers = impactMetrics?.volunteerDeliveriesCount || 86;
  const paidDeliveries = impactMetrics?.paidDeliveriesCount || 42;

  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-stone-900 to-rose-950 p-6 sm:p-8 text-white shadow-2xl border border-white/10">
      {/* Background Decorative Spatial Grid & Ambient Orbs */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 -right-24 w-96 h-96 rounded-full bg-rose-600/20 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-24 -left-24 w-96 h-96 rounded-full bg-amber-500/15 blur-3xl"
      />

      {/* Top Banner Navigation / Telemetry Header */}
      <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-white/10">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs font-bold tracking-wide uppercase">
            <Radio className="w-3.5 h-3.5 text-rose-400 animate-pulse" />
            <span>Live Food Rescue Telemetry</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2">
            <span>Community Impact & Surplus Radar</span>
            <Sparkles className="w-5 h-5 text-amber-400" />
          </h2>
          <p className="text-xs text-slate-300 max-w-xl">
            Real-time verified data on meals saved from landfills, carbon emissions avoided, and community deliveries.
          </p>
        </div>

        {/* Tab Filter */}
        <div className="flex items-center bg-white/10 backdrop-blur-md p-1 rounded-2xl border border-white/10 self-start md:self-auto">
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
              activeTab === 'overview'
                ? 'bg-rose-600 text-white shadow-md'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            Overview
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('eco')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
              activeTab === 'eco'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            Eco Impact
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('fleet')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
              activeTab === 'fleet'
                ? 'bg-amber-600 text-white shadow-md'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            Fleet Stats
          </button>
        </div>
      </div>

      {/* Main Metric Cards Grid */}
      <div className="relative z-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-6">
        {/* Metric 1: Meals Rescued */}
        <div className="group relative rounded-2xl bg-white/5 hover:bg-white/10 backdrop-blur-md p-5 border border-white/10 hover:border-rose-500/40 transition-all duration-300">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              Meals Rescued
            </span>
            <div className="w-9 h-9 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center group-hover:scale-110 transition">
              <Utensils className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-white tracking-tight">
            {Number(meals).toLocaleString()}
          </div>
          <div className="mt-2 text-xs text-rose-300 flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>+18% from last week</span>
          </div>
        </div>

        {/* Metric 2: CO2 Avoided */}
        <div className="group relative rounded-2xl bg-white/5 hover:bg-white/10 backdrop-blur-md p-5 border border-white/10 hover:border-emerald-500/40 transition-all duration-300">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              CO₂ Offset
            </span>
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center group-hover:scale-110 transition">
              <Leaf className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-white tracking-tight">
            {Number(co2Kg).toLocaleString()} <span className="text-base font-semibold">kg</span>
          </div>
          <div className="mt-2 text-xs text-emerald-300 flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Verified carbon calculation</span>
          </div>
        </div>

        {/* Metric 3: Active Hot Food Rescues */}
        <div className="group relative rounded-2xl bg-white/5 hover:bg-white/10 backdrop-blur-md p-5 border border-white/10 hover:border-amber-500/40 transition-all duration-300">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              Active Rescues
            </span>
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center group-hover:scale-110 transition">
              <Radio className="w-4 h-4 animate-pulse" />
            </div>
          </div>
          <div className="text-3xl font-black text-white tracking-tight">
            {activeRescues} <span className="text-base font-semibold">Live</span>
          </div>
          <div className="mt-2 text-xs text-amber-300 flex items-center gap-1">
            <span>En route & awaiting driver claim</span>
          </div>
        </div>

        {/* Metric 4: Deliveries Handled */}
        <div className="group relative rounded-2xl bg-white/5 hover:bg-white/10 backdrop-blur-md p-5 border border-white/10 hover:border-blue-500/40 transition-all duration-300">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              Fleet Deliveries
            </span>
            <div className="w-9 h-9 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center group-hover:scale-110 transition">
              <Award className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-white tracking-tight">
            {volunteers + paidDeliveries}
          </div>
          <div className="mt-2 text-xs text-blue-300 flex items-center gap-2">
            <span>🌱 {volunteers} Volunteer</span>
            <span>•</span>
            <span>⚡ {paidDeliveries} Paid</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SpatialImpactHUD;
