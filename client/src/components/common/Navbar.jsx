import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { useDonations } from '../../context/DonationContext';
import {
  HeartHandshake,
  UtensilsCrossed,
  Home,
  Bike,
  ShieldAlert,
  RotateCcw,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  ChevronRight,
} from 'lucide-react';
import { api } from '../../services/api';

export const Navbar = ({ onOpenCreateDonation, onOpenPostRequirement, onOpenAuth }) => {
  const { currentUser, role, switchRole } = useAuth();
  const { impactMetrics } = useDonations();

  const handleResetData = () => {
    if (window.confirm('Reset all demo data back to default state?')) {
      api.resetDemoData();
      window.location.reload();
    }
  };

  const ROLES = [
    {
      id: 'donor',
      label: 'Donor',
      subtitle: 'Restaurants & Catering',
      icon: UtensilsCrossed,
      activeColor: 'bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-lg shadow-amber-500/25 ring-2 ring-amber-400/80',
      iconColor: 'text-amber-500',
    },
    {
      id: 'recipient',
      label: 'Recipient',
      subtitle: 'NGOs & Shelters',
      icon: Home,
      activeColor: 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-600/25 ring-2 ring-emerald-400/80',
      iconColor: 'text-emerald-500',
    },
    {
      id: 'delivery',
      label: 'Delivery Agent',
      subtitle: 'Transit & Fleet',
      icon: Bike,
      activeColor: 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-600/25 ring-2 ring-blue-400/80',
      iconColor: 'text-blue-500',
    },
    {
      id: 'admin',
      label: 'Admin',
      subtitle: 'Ops & Telemetry',
      icon: ShieldAlert,
      activeColor: 'bg-gradient-to-r from-rose-600 to-red-600 text-white shadow-lg shadow-rose-600/25 ring-2 ring-rose-400/80',
      iconColor: 'text-rose-500',
    },
  ];

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/90 shadow-sm">
      <div className="max-w-[1680px] w-full mx-auto px-4 sm:px-6 lg:px-10">
        {/* Main Navbar Top Row */}
        <div className="flex items-center justify-between py-3.5 gap-4 lg:gap-8 flex-wrap xl:flex-nowrap">
          {/* Brand Logo & Mission Statement */}
          <div className="flex items-center gap-3.5 shrink-0">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-rose-600 via-amber-500 to-amber-400 flex items-center justify-center text-white shadow-md shadow-rose-600/25">
              <HeartHandshake className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-xl sm:text-2xl tracking-tight text-slate-900">
                  Share<span className="text-rose-600">A</span>Plate
                </span>
                <span className="bg-amber-100 text-amber-900 text-[11px] font-extrabold px-2 py-0.5 rounded-full tracking-wider uppercase border border-amber-300/80">
                  v1.0 MVP
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium hidden sm:block">
                Share More, Waste Less • Food Rescue Coordination
              </p>
            </div>
          </div>

          {/* PROMINENT, WIDE & BIGGER ROLE SWITCHER SECTION */}
          <div className="order-last xl:order-none w-full xl:w-auto flex-1 flex justify-center py-1 xl:py-0">
            <div className="bg-slate-100/90 p-1.5 rounded-2xl border-2 border-slate-200/90 shadow-inner flex items-center gap-1.5 sm:gap-2 overflow-x-auto max-w-full justify-start sm:justify-center">
              <div className="hidden md:flex items-center gap-1.5 px-3 py-2 bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-wider shrink-0 shadow-xs">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>SELECT ROLE:</span>
              </div>

              {ROLES.map((r) => {
                const Icon = r.icon;
                const isActive = role === r.id;
                return (
                  <button
                    key={r.id}
                    onClick={() => switchRole(r.id)}
                    className={`flex items-center gap-2 px-3.5 sm:px-5 py-2 sm:py-2.5 rounded-xl font-bold transition-all duration-200 shrink-0 text-xs sm:text-sm ${
                      isActive
                        ? r.activeColor
                        : 'bg-white text-slate-700 hover:text-slate-900 hover:bg-slate-50 border border-slate-200/70 shadow-2xs hover:shadow-xs'
                    }`}
                    title={`Switch perspective to ${r.label} (${r.subtitle})`}
                  >
                    <Icon
                      className={`w-4 h-4 sm:w-5 h-5 ${
                        isActive ? 'text-white' : r.iconColor
                      }`}
                    />
                    <div className="text-left">
                      <div className="leading-tight">{r.label}</div>
                      <div
                        className={`text-[10px] font-medium hidden sm:block ${
                          isActive ? 'text-white/80' : 'text-slate-400'
                        }`}
                      >
                        {r.subtitle}
                      </div>
                    </div>
                    {isActive && (
                      <span className="w-2 h-2 rounded-full bg-white ml-0.5 animate-pulse hidden sm:inline-block" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Action Tools & Live Counters */}
          <div className="flex items-center gap-3 shrink-0 ml-auto xl:ml-0">
            {/* Live Impact Counter */}
            <div className="hidden lg:flex items-center gap-2 bg-emerald-50 border border-emerald-300 text-emerald-900 px-3.5 py-2 rounded-xl text-xs font-bold shadow-2xs">
              <Sparkles className="w-4 h-4 text-emerald-600 animate-pulse" />
              <span>{impactMetrics?.totalMealsRescued?.toLocaleString() || '4,892'} Meals Rescued</span>
            </div>

            {/* Quick action button depending on role */}
            {role === 'donor' && (
              <button
                onClick={onOpenCreateDonation}
                className="bg-gradient-to-r from-rose-600 to-amber-500 hover:from-rose-500 hover:to-amber-400 text-white font-bold text-xs sm:text-sm px-4 py-2.5 rounded-xl shadow-md shadow-rose-600/30 active:scale-95 transition flex items-center gap-2"
              >
                <UtensilsCrossed className="w-4 h-4" />
                <span>+ Post Food Surplus</span>
              </button>
            )}

            {role === 'recipient' && (
              <button
                onClick={onOpenPostRequirement}
                className="bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-bold text-xs sm:text-sm px-4 py-2.5 rounded-xl shadow-md shadow-emerald-600/30 active:scale-95 transition flex items-center gap-2"
              >
                <Home className="w-4 h-4" />
                <span>+ Post Requirement</span>
              </button>
            )}

            {/* Reset Demo button for quick re-testing */}
            <button
              onClick={handleResetData}
              title="Reset Demo Data"
              className="p-2.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition border border-slate-200"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* User Identity subbar */}
        <div className="py-2.5 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600 flex-wrap gap-2">
          <div className="flex items-center gap-2.5">
            <span className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-[11px] bg-slate-100 px-2.5 py-1 rounded-lg text-slate-700 border border-slate-200">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              Current Session:
            </span>
            <span className="font-extrabold text-slate-900 text-sm">
              {currentUser?.organizationName || currentUser?.name}
            </span>
            <span className="text-slate-400 hidden sm:inline">•</span>
            <span className="text-slate-500 hidden sm:inline font-medium">
              {currentUser?.address}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden md:inline text-[11px] text-slate-400 italic">
              {role === 'donor' && 'Posting surplus batches & monitoring expiry countdowns'}
              {role === 'recipient' && 'Requesting food & smart match routing algorithms'}
              {role === 'delivery' && 'Live GPS transit routing & 4-point QR handovers'}
              {role === 'admin' && 'Central impact metrics & real-time donation audit log'}
            </span>
            <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-2.5 py-0.5 rounded-full text-[11px] font-bold flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              Verified Partner
            </span>
          </div>
        </div>
      </div>
    </header>
  );
};
