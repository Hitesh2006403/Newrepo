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
  UserCheck,
} from 'lucide-react';
import { api } from '../../services/api';

export const Navbar = ({ onOpenCreateDonation, onOpenPostRequirement }) => {
  const { currentUser, role, switchRole } = useAuth();
  const { impactMetrics, refresh } = useDonations();

  const handleResetData = () => {
    if (window.confirm('Reset all demo data back to default state?')) {
      api.resetDemoData();
      window.location.reload();
    }
  };

  const ROLES = [
    { id: 'donor', label: 'Donor', icon: UtensilsCrossed, color: 'text-amber-500' },
    { id: 'recipient', label: 'Recipient', icon: Home, color: 'text-emerald-500' },
    { id: 'delivery', label: 'Delivery Agent', icon: Bike, color: 'text-blue-500' },
    { id: 'admin', label: 'Admin', icon: ShieldAlert, color: 'text-rose-500' },
  ];

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          {/* Brand Logo */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-rose-600 via-amber-500 to-amber-400 flex items-center justify-center text-white shadow-md shadow-rose-600/20">
              <HeartHandshake className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-lg tracking-tight text-slate-900">
                  Share<span className="text-rose-600">A</span>Plate
                </span>
                <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-1.5 py-0.5 rounded tracking-wide uppercase">
                  v1.0 MVP
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium hidden sm:block">
                Share More, Waste Less • Food Rescue Engine
              </p>
            </div>
          </div>

          {/* Persona / Role Quick Switcher (Hackathon Evaluator Showcase) */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200/70">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-2 hidden md:inline">
              Role:
            </span>
            {ROLES.map((r) => {
              const Icon = r.icon;
              const isActive = role === r.id;
              return (
                <button
                  key={r.id}
                  onClick={() => switchRole(r.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-white text-slate-900 shadow-sm border border-slate-200/80'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                  }`}
                  title={`Switch to ${r.label} perspective`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? r.color : 'text-slate-400'}`} />
                  <span className="hidden sm:inline">{r.label}</span>
                </button>
              );
            })}
          </div>

          {/* Right Action Area */}
          <div className="flex items-center gap-3">
            {/* Live Impact Counter */}
            <div className="hidden lg:flex items-center gap-1.5 bg-emerald-50 border border-emerald-200/70 text-emerald-800 px-3 py-1.5 rounded-full text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
              <span>{impactMetrics?.totalMealsRescued?.toLocaleString() || '4,892'} meals rescued</span>
            </div>

            {/* Quick action button depending on role */}
            {role === 'donor' && (
              <button
                onClick={onOpenCreateDonation}
                className="bg-gradient-to-r from-rose-600 to-amber-500 hover:from-rose-500 hover:to-amber-400 text-white font-semibold text-xs px-3.5 py-2 rounded-xl shadow-md shadow-rose-600/20 active:scale-95 transition flex items-center gap-1.5"
              >
                <UtensilsCrossed className="w-3.5 h-3.5" />
                <span>+ Post Food</span>
              </button>
            )}

            {role === 'recipient' && (
              <button
                onClick={onOpenPostRequirement}
                className="bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-semibold text-xs px-3.5 py-2 rounded-xl shadow-md shadow-emerald-600/20 active:scale-95 transition flex items-center gap-1.5"
              >
                <Home className="w-3.5 h-3.5" />
                <span>+ Post Need</span>
              </button>
            )}

            {/* Reset Demo button for quick re-testing */}
            <button
              onClick={handleResetData}
              title="Reset Demo Data"
              className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* User Identity subbar */}
        <div className="py-1.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-2 truncate">
            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
            <span className="font-semibold text-slate-700">{currentUser?.organizationName || currentUser?.name}</span>
            <span className="text-slate-400 hidden sm:inline">({currentUser?.address})</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="bg-slate-100 px-2 py-0.5 rounded text-[11px] font-mono text-slate-600">
              Verified Partner
            </span>
          </div>
        </div>
      </div>
    </header>
  );
};
