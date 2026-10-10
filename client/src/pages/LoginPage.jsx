import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import {
  HeartHandshake,
  UtensilsCrossed,
  Home,
  Bike,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  ArrowRight,
  Lock,
  Mail,
  Copy,
  Check,
  UserCheck,
  CheckCircle2,
} from 'lucide-react';

const MEMBER_ROLES = [
  {
    role: 'donor',
    title: 'Food Donor',
    orgName: 'Grand Hyatt Banquet & Bistro',
    name: 'Chef Marco Rossi',
    email: 'marco@grandhyatt.org',
    password: 'donor123',
    icon: UtensilsCrossed,
    color: 'from-amber-500 to-amber-600',
    borderColor: 'border-amber-300 hover:border-amber-500',
    badge: 'Hotels, Restaurants, Hostels',
  },
  {
    role: 'recipient',
    title: 'Recipient Organization',
    orgName: 'Grace Hope Children Shelter',
    name: 'Sister Teresa Maria',
    email: 'contact@gracehope.org',
    password: 'shelter123',
    icon: Home,
    color: 'from-emerald-600 to-teal-600',
    borderColor: 'border-emerald-300 hover:border-emerald-500',
    badge: 'NGOs, Orphanages, Relief Hubs',
  },
  {
    role: 'delivery',
    title: 'Delivery Partner',
    orgName: 'Rapid Thermal Rescue Fleet',
    name: 'Vikram Singh (Rider #42)',
    email: 'vikram@shareaplate.org',
    password: 'rider123',
    icon: Bike,
    color: 'from-blue-600 to-indigo-600',
    borderColor: 'border-blue-300 hover:border-blue-500',
    badge: 'Cargo Riders, Transit Drivers',
  },
  {
    role: 'admin',
    title: 'Platform Admin',
    orgName: 'Central Operations Command',
    name: 'Ananya Sharma (Ops Lead)',
    email: 'ops@shareaplate.org',
    password: 'admin123',
    icon: ShieldAlert,
    color: 'from-rose-600 to-red-600',
    borderColor: 'border-rose-300 hover:border-rose-500',
    badge: 'Telemetry & Verification Audit',
  },
];

export const LoginPage = ({ onLoginSuccess, onContinueAsGuest }) => {
  const { login, register } = useAuth();
  const { addToast } = useNotification();

  const [activeTab, setActiveTab] = useState('quick_members'); // 'quick_members' | 'manual_login' | 'register'
  const [email, setEmail] = useState('marco@grandhyatt.org');
  const [password, setPassword] = useState('donor123');
  const [copiedRole, setCopiedRole] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Registration fields
  const [regName, setRegName] = useState('');
  const [regOrg, setRegOrg] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regRole, setRegRole] = useState('donor');
  const [regPhone, setRegPhone] = useState('');

  // 1-Click Fast Login handler
  const handleQuickLogin = async (member) => {
    try {
      setSubmitting(true);
      await login(member.email, member.password);
      addToast(`Logged in successfully as ${member.name} (${member.title})`, 'success');
      if (onLoginSuccess) onLoginSuccess();
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleManualLogin = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      await login(email, password);
      addToast('Welcome back to Share A Plate!', 'success');
      if (onLoginSuccess) onLoginSuccess();
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      await register({
        name: regName,
        organizationName: regOrg || regName,
        email: regEmail,
        password: regPassword,
        role: regRole,
        phone: regPhone || '+91 99000 11223',
        address: 'Bengaluru Core Area',
      });
      addToast(`Welcome ${regName}! New partner account activated.`, 'success');
      if (onLoginSuccess) onLoginSuccess();
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const copyCredentials = (member, e) => {
    e.stopPropagation();
    navigator.clipboard?.writeText(`Email: ${member.email} | Password: ${member.password}`);
    setCopiedRole(member.role);
    setTimeout(() => setCopiedRole(null), 2000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-stone-900 to-rose-950 text-white flex flex-col justify-center py-10 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute top-0 -left-40 w-96 h-96 bg-rose-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 -right-40 w-96 h-96 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-6xl w-full mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-center z-10">
        {/* Left Side: Brand Vision & Verification Highlights */}
        <div className="lg:col-span-5 space-y-6 text-center lg:text-left">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-xs font-semibold text-amber-300">
            <HeartHandshake className="w-4 h-4 text-rose-400" />
            <span>Food Rescue Coordination Platform</span>
          </div>

          <div className="space-y-2">
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight leading-tight">
              Share<span className="text-rose-500">A</span>Plate
            </h1>
            <p className="text-lg text-rose-200/90 font-medium">
              Share More, Waste Less • Verified Food Routing
            </p>
          </div>

          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-lg mx-auto lg:mx-0">
            Connecting surplus food donors with shelters and NGOs through algorithmic matching, live expiry countdowns, and cryptographically verified QR handovers.
          </p>

          {/* Verification Pillars */}
          <div className="space-y-2.5 pt-2 max-w-md mx-auto lg:mx-0 text-left">
            <div className="flex items-center gap-3 bg-white/5 border border-white/10 p-3 rounded-2xl">
              <span className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-4 h-4" />
              </span>
              <div>
                <div className="text-xs font-bold text-slate-200">100% Verified Served & Received</div>
                <div className="text-[11px] text-slate-400">Single-use QR handover tokens ensure zero unverified deliveries</div>
              </div>
            </div>

            <div className="flex items-center gap-3 bg-white/5 border border-white/10 p-3 rounded-2xl">
              <span className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                <Sparkles className="w-4 h-4" />
              </span>
              <div>
                <div className="text-xs font-bold text-slate-200">Proximity Smart Matching</div>
                <div className="text-[11px] text-slate-400">Routes hot meals before quality degrades with safety buffers</div>
              </div>
            </div>
          </div>

          {onContinueAsGuest && (
            <div className="pt-2">
              <button
                type="button"
                onClick={onContinueAsGuest}
                className="text-xs text-slate-400 hover:text-white underline font-semibold transition"
              >
                Skip login and explore as Guest →
              </button>
            </div>
          )}
        </div>

        {/* Right Side: 4 Member Credentials & Authentication Box */}
        <div className="lg:col-span-7 bg-white text-slate-900 rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-100/30 space-y-6">
          {/* Tabs Selector */}
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveTab('quick_members')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition ${
                  activeTab === 'quick_members'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                ⚡ 4 Member Credentials
              </button>
              <button
                onClick={() => setActiveTab('manual_login')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${
                  activeTab === 'manual_login'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Email Login
              </button>
              <button
                onClick={() => setActiveTab('register')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${
                  activeTab === 'register'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                New Partner Register
              </button>
            </div>
          </div>

          {/* TAB 1: 4 DIFFERENT MEMBER CREDENTIALS CARDS */}
          {activeTab === 'quick_members' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span className="font-bold text-slate-800">Select any member to log in with 1 click:</span>
                <span className="text-[11px] text-rose-600 font-semibold">Demo credentials pre-filled</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {MEMBER_ROLES.map((member) => {
                  const Icon = member.icon;
                  return (
                    <div
                      key={member.role}
                      onClick={() => handleQuickLogin(member)}
                      className={`p-4 rounded-2xl border-2 bg-slate-50/70 hover:bg-white hover:shadow-md cursor-pointer transition-all duration-200 flex flex-col justify-between group ${member.borderColor}`}
                    >
                      <div>
                        {/* Top Badge & Icon */}
                        <div className="flex items-center justify-between mb-2">
                          <span className={`w-9 h-9 rounded-xl bg-gradient-to-tr ${member.color} text-white flex items-center justify-center shadow-xs`}>
                            <Icon className="w-5 h-5" />
                          </span>
                          <span className="text-[10px] font-extrabold uppercase tracking-wider bg-slate-200/80 text-slate-700 px-2 py-0.5 rounded-full">
                            {member.role}
                          </span>
                        </div>

                        {/* Member Details */}
                        <h4 className="text-sm font-black text-slate-900 group-hover:text-rose-600 transition">
                          {member.title}
                        </h4>
                        <div className="text-xs font-semibold text-slate-700 truncate">{member.name}</div>
                        <div className="text-[11px] text-slate-400 truncate">{member.orgName}</div>
                      </div>

                      {/* Credentials Display & Fast Login Button */}
                      <div className="mt-3 pt-3 border-t border-slate-200/70 space-y-2">
                        <div className="bg-white p-2 rounded-xl border border-slate-200 text-[11px] font-mono text-slate-600 space-y-0.5">
                          <div className="truncate"><span className="text-slate-400 font-sans">Email:</span> {member.email}</div>
                          <div><span className="text-slate-400 font-sans">Pass:</span> {member.password}</div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleQuickLogin(member);
                            }}
                            disabled={submitting}
                            className={`flex-1 py-1.5 px-3 rounded-xl bg-gradient-to-r ${member.color} text-white font-bold text-xs shadow-2xs group-hover:shadow-md transition flex items-center justify-center gap-1`}
                          >
                            <span>1-Click Login</span>
                            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition" />
                          </button>

                          <button
                            type="button"
                            onClick={(e) => copyCredentials(member, e)}
                            className="p-1.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-500 transition"
                            title="Copy credentials"
                          >
                            {copiedRole === member.role ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 2: MANUAL LOGIN FORM */}
          {activeTab === 'manual_login' && (
            <form onSubmit={handleManualLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. marco@grandhyatt.org"
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-rose-500 focus:outline-none font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter account password..."
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-rose-500 focus:outline-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-rose-600 to-amber-500 hover:from-rose-500 hover:to-amber-400 text-white font-bold text-sm shadow-md shadow-rose-600/30 transition flex items-center justify-center gap-2 active:scale-95"
              >
                <span>{submitting ? 'Authenticating...' : 'Sign In as Member'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          )}

          {/* TAB 3: REGISTER NEW PARTNER */}
          {activeTab === 'register' && (
            <form onSubmit={handleRegister} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Select Partner Role *
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'donor', label: '🍳 Food Donor' },
                    { id: 'recipient', label: '🏠 Recipient Shelter' },
                    { id: 'delivery', label: '🛵 Rapid Fleet Rider' },
                  ].map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setRegRole(r.id)}
                      className={`py-2 px-2 rounded-xl text-xs font-bold border transition ${
                        regRole === r.id
                          ? 'bg-rose-50 border-rose-500 text-rose-700 ring-1 ring-rose-400'
                          : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Full Name / Coordinator *
                  </label>
                  <input
                    type="text"
                    required
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    placeholder="e.g. Ramesh Kumar"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Organization / Kitchen Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={regOrg}
                    onChange={(e) => setRegOrg(e.target.value)}
                    placeholder="e.g. Royal Banquet & Catering"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    required
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    placeholder="contact@org.com"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Password *
                  </label>
                  <input
                    type="password"
                    required
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder="Min 6 characters"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-md transition flex items-center justify-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{submitting ? 'Registering...' : 'Register & Join Rescue Network'}</span>
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
