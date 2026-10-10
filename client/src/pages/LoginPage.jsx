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
  ArrowLeft,
  Lock,
  Mail,
  Eye,
  EyeOff,
  CheckCircle2,
  Building2,
  FileBadge2,
  Truck,
  KeyRound,
  X,
  UserCheck,
  Check,
} from 'lucide-react';

// Official 4-color Google G SVG logo
const GoogleIcon = ({ className = 'w-5 h-5' }) => (
  <svg className={className} viewBox="0 0 24 24">
    <path
      fill="#4285F4"
      d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
    />
    <path
      fill="#34A853"
      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
    />
    <path
      fill="#FBBC05"
      d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.98 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
    />
    <path
      fill="#EA4335"
      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
    />
  </svg>
);

// Configuration for each workspace portal
const PORTALS = [
  {
    role: 'donor',
    title: 'Food Donor Portal',
    shortTitle: 'Food Donor',
    badge: 'RESTAURANTS • BANQUETS • HOSTELS',
    subtitle: 'Post surplus batches, live safety countdowns & dispatch tracking',
    icon: UtensilsCrossed,
    color: 'from-amber-500 to-orange-600',
    lightBg: 'bg-amber-50/80',
    borderColor: 'border-amber-200 hover:border-amber-500',
    activeRing: 'ring-amber-500',
    textColor: 'text-amber-700',
    customField: {
      name: 'fssaiNumber',
      label: 'FSSAI License / Kitchen Outlet ID',
      placeholder: 'e.g. FSSAI-21424010000492 or HYATT-BLR-01',
      helper: 'Mandatory Food Safety & Standards Authority registration for surplus food routing.',
      defaultValue: 'FSSAI-21424010000492',
      icon: FileBadge2,
    },
    demoUser: {
      name: 'Chef Marco Rossi',
      orgName: 'Grand Hyatt Banquet & Bistro',
      email: 'marco@grandhyatt.org',
      password: 'donor123',
    },
  },
  {
    role: 'recipient',
    title: 'Recipient Organization Portal',
    shortTitle: 'Recipient Shelter',
    badge: 'NGOS • SHELTERS • RELIEF HUBS',
    subtitle: 'Claim nearby surplus, post meal needs & confirm receipt via QR token',
    icon: Home,
    color: 'from-emerald-600 to-teal-600',
    lightBg: 'bg-emerald-50/80',
    borderColor: 'border-emerald-200 hover:border-emerald-500',
    activeRing: 'ring-emerald-500',
    textColor: 'text-emerald-700',
    customField: {
      name: 'ngoRegId',
      label: 'NGO Darpan ID / Trust Registration Code',
      placeholder: 'e.g. NGO-KA-2023-0182 or DARPAN-88910',
      helper: 'Official government Darpan or NGO registration number for verified beneficiary aid.',
      defaultValue: 'NGO-KA-2023-0182',
      icon: Building2,
    },
    demoUser: {
      name: 'Sister Teresa Maria',
      orgName: 'Grace Hope Children Shelter',
      email: 'contact@gracehope.org',
      password: 'shelter123',
    },
  },
  {
    role: 'delivery',
    title: 'Delivery Fleet Partner Portal',
    shortTitle: 'Delivery Fleet',
    badge: 'THERMAL FLEET • TRANSIT RIDERS',
    subtitle: 'Accept cold-chain pickups, live map navigation & handover validation',
    icon: Bike,
    color: 'from-blue-600 to-indigo-600',
    lightBg: 'bg-blue-50/80',
    borderColor: 'border-blue-200 hover:border-blue-500',
    activeRing: 'ring-blue-500',
    textColor: 'text-blue-700',
    customField: {
      name: 'vehicleNumber',
      label: 'Vehicle Plate No. / Thermal Carrier ID',
      placeholder: 'e.g. KA-01-EQ-9872 or THERMAL-RIDER-42',
      helper: 'Registered cargo vehicle number and insulated thermal temperature carrier code.',
      defaultValue: 'KA-01-EQ-9872',
      icon: Truck,
    },
    demoUser: {
      name: 'Vikram Singh (Rider #42)',
      orgName: 'Rapid Thermal Rescue Fleet',
      email: 'vikram@shareaplate.org',
      password: 'rider123',
    },
  },
  {
    role: 'admin',
    title: 'Platform Operations Admin',
    shortTitle: 'Platform Admin',
    badge: 'OPERATIONS COMMAND • TELEMETRY',
    subtitle: 'Monitor verified served vs received, partner audits & emergency re-routes',
    icon: ShieldAlert,
    color: 'from-rose-600 to-red-600',
    lightBg: 'bg-rose-50/80',
    borderColor: 'border-rose-200 hover:border-rose-500',
    activeRing: 'ring-rose-500',
    textColor: 'text-rose-700',
    customField: {
      name: 'adminClearanceKey',
      label: 'Admin Clearance Key / 2FA Passcode',
      placeholder: 'e.g. ADM-SEC-9941 or 6-digit TOTP',
      helper: 'Level-4 cryptographic security token for centralized verification telemetry.',
      defaultValue: 'ADM-SEC-9941',
      icon: KeyRound,
    },
    demoUser: {
      name: 'Ananya Sharma (Ops Lead)',
      orgName: 'Central Operations Command',
      email: 'ops@shareaplate.org',
      password: 'admin123',
    },
  },
];

export const LoginPage = ({ onLoginSuccess, onContinueAsGuest }) => {
  const { login, loginWithGoogle, register } = useAuth();
  const { addToast } = useNotification();

  // State: selectedRole is null initially (displays Portal Directory),
  // once clicked, ONLY that role's login appears!
  const [selectedRole, setSelectedRole] = useState(null);

  // Form mode: 'login' | 'register'
  const [formMode, setFormMode] = useState('login');

  // Form inputs
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [roleCustomField, setRoleCustomField] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});

  // Registration inputs
  const [regName, setRegName] = useState('');
  const [regOrg, setRegOrg] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regCustomField, setRegCustomField] = useState('');

  // Google OAuth Simulation Modal state
  const [isGoogleModalOpen, setIsGoogleModalOpen] = useState(false);
  const [googleTargetRole, setGoogleTargetRole] = useState(null);

  // Current active portal configuration
  const activePortal = PORTALS.find((p) => p.role === selectedRole);

  // Switch to a role login
  const handleSelectPortal = (portalRole) => {
    setSelectedRole(portalRole);
    setFormMode('login');
    setErrors({});
    const portal = PORTALS.find((p) => p.role === portalRole);
    if (portal) {
      // Pre-clear or prepare form
      setEmail('');
      setPassword('');
      setRoleCustomField('');
    }
  };

  // 1-Click Demo Fill for selected role
  const handleAutofillDemo = () => {
    if (!activePortal) return;
    setEmail(activePortal.demoUser.email);
    setPassword(activePortal.demoUser.password);
    setRoleCustomField(activePortal.customField.defaultValue);
    setErrors({});
    addToast(`Auto-filled credentials for ${activePortal.demoUser.name}`, 'info');
  };

  // Role Login submit handler
  const handleRoleLogin = async (e) => {
    e.preventDefault();
    const newErrors = {};

    if (!email.trim()) newErrors.email = 'Email address is required.';
    if (!password) newErrors.password = 'Password is required.';
    if (!roleCustomField.trim()) {
      newErrors.customField = `${activePortal.customField.label} is required for verification.`;
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      addToast('Please fill in all required verification fields.', 'warning');
      return;
    }

    try {
      setSubmitting(true);
      await login(email.trim(), password, {
        [activePortal.customField.name]: roleCustomField.trim(),
        role: activePortal.role,
      });

      addToast(
        `Welcome! Signed in to ${activePortal.title} successfully.`,
        'success'
      );
      if (onLoginSuccess) onLoginSuccess();
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Register submit handler
  const handleRoleRegister = async (e) => {
    e.preventDefault();
    const newErrors = {};
    if (!regName.trim()) newErrors.regName = 'Full name is required.';
    if (!regOrg.trim()) newErrors.regOrg = 'Organization name is required.';
    if (!regEmail.trim()) newErrors.regEmail = 'Email address is required.';
    if (!regPassword || regPassword.length < 6)
      newErrors.regPassword = 'Password must be at least 6 characters.';
    if (!regCustomField.trim()) {
      newErrors.regCustomField = `${activePortal.customField.label} is required.`;
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      addToast('Please complete all required registration fields.', 'warning');
      return;
    }

    try {
      setSubmitting(true);
      await register({
        name: regName.trim(),
        organizationName: regOrg.trim(),
        email: regEmail.trim(),
        password: regPassword,
        role: activePortal.role,
        phone: regPhone.trim() || '+91 99000 11223',
        [activePortal.customField.name]: regCustomField.trim(),
        address: 'Bengaluru Operations Hub',
      });

      addToast(
        `Registration complete! Welcome to ${activePortal.title}.`,
        'success'
      );
      if (onLoginSuccess) onLoginSuccess();
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Google OAuth trigger
  const handleOpenGoogleAuth = (roleForGoogle = null) => {
    setGoogleTargetRole(roleForGoogle || selectedRole || 'donor');
    setIsGoogleModalOpen(true);
  };

  // Confirm Google login
  const handleExecuteGoogleLogin = async (userAccount) => {
    try {
      setSubmitting(true);
      const target = googleTargetRole || selectedRole || 'donor';
      const portal = PORTALS.find((p) => p.role === target);

      await loginWithGoogle(target, userAccount);
      setIsGoogleModalOpen(false);

      addToast(
        `Google Authentication verified! Signed in as ${userAccount.name} (${portal?.shortTitle || 'Member'}).`,
        'success'
      );
      if (onLoginSuccess) onLoginSuccess();
    } catch (err) {
      addToast(err.message || 'Google authentication failed', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-zinc-900 to-stone-950 text-white flex flex-col justify-center py-10 px-4 sm:px-6 lg:px-8 relative overflow-hidden font-sans">
      {/* Background ambient lighting */}
      <div className="absolute top-0 -left-40 w-96 h-96 bg-rose-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 -right-40 w-96 h-96 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Main Container */}
      <div className="max-w-6xl w-full mx-auto relative z-10">
        {/* Top Brand Bar */}
        <div className="flex items-center justify-between mb-8 pb-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-rose-600 to-amber-500 flex items-center justify-center text-white shadow-lg shadow-rose-600/30">
              <HeartHandshake className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xl font-black tracking-tight text-white">
                Share<span className="text-rose-500">A</span>Plate
              </span>
              <p className="text-[11px] text-zinc-400 font-medium">
                Enterprise Food Rescue & Cryptographic Handover Coordination
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {onContinueAsGuest && (
              <button
                type="button"
                onClick={onContinueAsGuest}
                className="text-xs font-semibold text-zinc-400 hover:text-white transition flex items-center gap-1 px-3 py-1.5 rounded-lg hover:bg-white/5"
              >
                <span>Explore as Guest</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* =========================================================================
            VIEW 1: DASHBOARD PORTAL SELECTOR (When no role has been chosen yet)
            Clean, beautiful, uncluttered selection grid
           ========================================================================= */}
        {!selectedRole && (
          <div className="space-y-8 animate-fadeIn">
            {/* Header Text */}
            <div className="text-center max-w-2xl mx-auto space-y-2">
              <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-xs font-bold text-amber-300">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Multi-Stakeholder Architecture</span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
                Select Your Dashboard Portal
              </h2>
              <p className="text-sm text-zinc-400">
                Choose the workspace portal you need to sign in to. Each portal provides a dedicated, role-secured environment.
              </p>
            </div>

            {/* 4 Clean Portal Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 max-w-5xl mx-auto">
              {PORTALS.map((portal) => {
                const Icon = portal.icon;
                return (
                  <div
                    key={portal.role}
                    onClick={() => handleSelectPortal(portal.role)}
                    className="group bg-white/5 hover:bg-white/10 backdrop-blur-xl border border-white/10 hover:border-white/25 rounded-3xl p-6 cursor-pointer transition-all duration-300 hover:shadow-2xl hover:shadow-rose-950/40 hover:-translate-y-1 relative overflow-hidden flex flex-col justify-between"
                  >
                    {/* Top ambient glow accent on hover */}
                    <div
                      className={`absolute -top-16 -right-16 w-36 h-36 bg-gradient-to-br ${portal.color} opacity-20 rounded-full blur-2xl group-hover:opacity-40 transition-opacity`}
                    />

                    <div>
                      {/* Top Bar with Icon & Badge */}
                      <div className="flex items-center justify-between mb-4">
                        <div
                          className={`w-12 h-12 rounded-2xl bg-gradient-to-tr ${portal.color} text-white flex items-center justify-center shadow-md group-hover:scale-105 transition-transform`}
                        >
                          <Icon className="w-6 h-6" />
                        </div>
                        <span className="text-[10px] font-extrabold uppercase tracking-widest px-2.5 py-1 rounded-full bg-white/10 text-zinc-300 border border-white/10">
                          {portal.badge}
                        </span>
                      </div>

                      {/* Title & Description */}
                      <h3 className="text-xl font-black text-white group-hover:text-amber-300 transition-colors">
                        {portal.title}
                      </h3>
                      <p className="text-xs text-zinc-400 mt-1.5 leading-relaxed">
                        {portal.subtitle}
                      </p>

                      {/* Required Credential Preview */}
                      <div className="mt-4 pt-4 border-t border-white/10 flex items-center gap-2 text-[11px] text-zinc-300">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        <span className="font-semibold text-zinc-400">Required:</span>
                        <span className="font-mono text-zinc-200">
                          {portal.customField.label.split('/')[0].trim()}
                        </span>
                      </div>
                    </div>

                    {/* Bottom CTA Button */}
                    <div className="mt-6 flex items-center justify-between">
                      <span className="text-xs font-bold text-zinc-400 group-hover:text-white transition">
                        Click to access login
                      </span>
                      <div
                        className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r ${portal.color} text-white text-xs font-bold shadow-md group-hover:shadow-lg transition group-hover:translate-x-1`}
                      >
                        <span>Open Login</span>
                        <ArrowRight className="w-4 h-4" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Quick Google Sign In Bar at Bottom of Portal Selection */}
            <div className="max-w-md mx-auto text-center pt-2">
              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-white/10" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-slate-950 px-3 text-zinc-400 font-bold tracking-wider">
                    Or Instant Single Sign-On
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleOpenGoogleAuth('donor')}
                className="w-full bg-white hover:bg-zinc-100 text-zinc-800 font-bold py-3 px-4 rounded-2xl shadow-lg transition flex items-center justify-center gap-3 active:scale-[0.99] border border-zinc-200"
              >
                <GoogleIcon className="w-5 h-5" />
                <span className="text-sm">Continue with Google (Fast SSO)</span>
              </button>
              <p className="text-[11px] text-zinc-400 mt-2">
                Simulated Google Identity Services with instant multi-role OAuth tokens.
              </p>
            </div>
          </div>
        )}

        {/* =========================================================================
            VIEW 2: DEDICATED ROLE LOGIN (ONLY that selected login appears!)
            Clean, focused, enterprise-grade login interface
           ========================================================================= */}
        {selectedRole && activePortal && (
          <div className="max-w-xl mx-auto animate-fadeIn">
            {/* Top Navigation & Back Button */}
            <div className="flex items-center justify-between mb-5">
              <button
                type="button"
                onClick={() => {
                  setSelectedRole(null);
                  setErrors({});
                }}
                className="inline-flex items-center gap-2 text-xs font-bold text-zinc-300 hover:text-white bg-white/10 hover:bg-white/15 px-3.5 py-2 rounded-xl backdrop-blur-md border border-white/15 transition group"
              >
                <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
                <span>← Choose Another Dashboard Portal</span>
              </button>

              <div
                className={`inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gradient-to-r ${activePortal.color} text-white text-xs font-bold shadow-md`}
              >
                <activePortal.icon className="w-3.5 h-3.5" />
                <span>{activePortal.shortTitle}</span>
              </div>
            </div>

            {/* Dedicated White/Zinc Glassmorphism Card */}
            <div className="bg-white text-slate-900 rounded-3xl p-6 sm:p-9 shadow-2xl border border-white/30 space-y-6">
              {/* Card Header */}
              <div className="flex items-start justify-between border-b border-slate-100 pb-5">
                <div className="space-y-1">
                  <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                    {formMode === 'login'
                      ? `Sign In to ${activePortal.title}`
                      : `Register as New ${activePortal.shortTitle}`}
                  </h2>
                  <p className="text-xs text-slate-500 font-medium">
                    {formMode === 'login'
                      ? activePortal.subtitle
                      : 'Join the verified food rescue network in minutes.'}
                  </p>
                </div>
                <div
                  className={`w-12 h-12 rounded-2xl bg-gradient-to-tr ${activePortal.color} text-white flex items-center justify-center shadow-md shrink-0`}
                >
                  <activePortal.icon className="w-6 h-6" />
                </div>
              </div>

              {/* Form Mode Toggle: Login vs Register */}
              <div className="flex p-1 bg-slate-100 rounded-xl">
                <button
                  type="button"
                  onClick={() => {
                    setFormMode('login');
                    setErrors({});
                  }}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition ${
                    formMode === 'login'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFormMode('register');
                    setErrors({});
                  }}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition ${
                    formMode === 'register'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  New Partner Registration
                </button>
              </div>

              {/* GOOGLE SSO BUTTON (Prominent & Official Styling) */}
              {formMode === 'login' && (
                <div className="space-y-4">
                  <button
                    type="button"
                    onClick={() => handleOpenGoogleAuth(activePortal.role)}
                    className="w-full py-3 px-4 rounded-xl border border-slate-300 hover:border-slate-400 bg-white hover:bg-slate-50/80 text-slate-700 font-bold text-xs sm:text-sm shadow-xs transition flex items-center justify-center gap-3 active:scale-[0.99] group"
                  >
                    <GoogleIcon className="w-5 h-5 shrink-0" />
                    <span>Continue with Google as {activePortal.shortTitle}</span>
                  </button>

                  {/* Clean Divider */}
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-slate-200" />
                    </div>
                    <div className="relative flex justify-center text-[11px] uppercase">
                      <span className="bg-white px-3 text-slate-400 font-bold tracking-wider">
                        Or enter organizational credentials
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* -------------------------------------------------------------
                  MODE 1: LOGIN FORM WITH ROLE-SPECIFIC REQUIRED FIELDS
                 ------------------------------------------------------------- */}
              {formMode === 'login' && (
                <form onSubmit={handleRoleLogin} className="space-y-4">
                  {/* ROLE SPECIFIC REQUIRED FIELD */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide">
                        {activePortal.customField.label}{' '}
                        <span className="text-rose-600 font-black">*</span>
                      </label>
                      <span className="text-[10px] font-semibold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                        Required
                      </span>
                    </div>
                    <div className="relative">
                      <activePortal.customField.icon className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={roleCustomField}
                        onChange={(e) => {
                          setRoleCustomField(e.target.value);
                          if (errors.customField) {
                            setErrors({ ...errors, customField: null });
                          }
                        }}
                        placeholder={activePortal.customField.placeholder}
                        className={`w-full pl-10 pr-3.5 py-2.5 rounded-xl border text-xs sm:text-sm focus:ring-2 focus:ring-rose-500 focus:outline-none font-mono ${
                          errors.customField
                            ? 'border-rose-400 bg-rose-50/40 text-rose-900'
                            : 'border-slate-300 text-slate-800'
                        }`}
                      />
                    </div>
                    {errors.customField ? (
                      <p className="text-[11px] text-rose-600 mt-1 font-semibold">
                        {errors.customField}
                      </p>
                    ) : (
                      <p className="text-[11px] text-slate-400 mt-1">
                        {activePortal.customField.helper}
                      </p>
                    )}
                  </div>

                  {/* EMAIL ADDRESS */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">
                      Work Email Address <span className="text-rose-600 font-black">*</span>
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => {
                          setEmail(e.target.value);
                          if (errors.email) setErrors({ ...errors, email: null });
                        }}
                        placeholder={`e.g. ${activePortal.demoUser.email}`}
                        className={`w-full pl-10 pr-3.5 py-2.5 rounded-xl border text-xs sm:text-sm focus:ring-2 focus:ring-rose-500 focus:outline-none ${
                          errors.email
                            ? 'border-rose-400 bg-rose-50/40 text-rose-900'
                            : 'border-slate-300 text-slate-800 font-medium'
                        }`}
                      />
                    </div>
                    {errors.email && (
                      <p className="text-[11px] text-rose-600 mt-1 font-semibold">
                        {errors.email}
                      </p>
                    )}
                  </div>

                  {/* PASSWORD */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide">
                        Security Password <span className="text-rose-600 font-black">*</span>
                      </label>
                      <button
                        type="button"
                        onClick={() =>
                          addToast(
                            `Demo Mode: You can sign in using password "${activePortal.demoUser.password}" or click Demo Autofill below.`,
                            'info'
                          )
                        }
                        className="text-[11px] text-rose-600 font-semibold hover:underline"
                      >
                        Forgot password?
                      </button>
                    </div>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => {
                          setPassword(e.target.value);
                          if (errors.password) setErrors({ ...errors, password: null });
                        }}
                        placeholder="Enter account security key..."
                        className={`w-full pl-10 pr-10 py-2.5 rounded-xl border text-xs sm:text-sm focus:ring-2 focus:ring-rose-500 focus:outline-none ${
                          errors.password
                            ? 'border-rose-400 bg-rose-50/40 text-rose-900'
                            : 'border-slate-300 text-slate-800'
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                        title={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                    {errors.password && (
                      <p className="text-[11px] text-rose-600 mt-1 font-semibold">
                        {errors.password}
                      </p>
                    )}
                  </div>

                  {/* Remember Me Checkbox */}
                  <div className="flex items-center justify-between pt-1 text-xs">
                    <label className="flex items-center gap-2 cursor-pointer select-none text-slate-600">
                      <input
                        type="checkbox"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                        className="w-4 h-4 text-rose-600 rounded-sm border-slate-300 focus:ring-rose-500"
                      />
                      <span className="font-medium">Remember this workstation for 30 days</span>
                    </label>

                    <div className="flex items-center gap-1 text-[11px] text-emerald-600 font-semibold">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>256-Bit SSL Encrypted</span>
                    </div>
                  </div>

                  {/* SUBMIT BUTTON */}
                  <button
                    type="submit"
                    disabled={submitting}
                    className={`w-full py-3.5 rounded-xl bg-gradient-to-r ${activePortal.color} text-white font-extrabold text-sm shadow-md hover:shadow-lg transition-all duration-200 flex items-center justify-center gap-2 active:scale-[0.99]`}
                  >
                    <span>
                      {submitting
                        ? `Authenticating ${activePortal.shortTitle}...`
                        : `Sign In to ${activePortal.shortTitle} Dashboard`}
                    </span>
                    <ArrowRight className="w-4 h-4" />
                  </button>

                  {/* CLEAN AUTOFILL DEMO PILL (Keeps screen clean while making hackathon test effortless) */}
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={handleAutofillDemo}
                      className="w-full py-2 px-3 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 text-xs font-semibold flex items-center justify-center gap-2 transition"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                      <span>
                        Testing? <strong className="text-slate-800">Autofill verified {activePortal.demoUser.name} credentials</strong>
                      </span>
                    </button>
                  </div>
                </form>
              )}

              {/* -------------------------------------------------------------
                  MODE 2: REGISTRATION FORM FOR SELECTED ROLE
                 ------------------------------------------------------------- */}
              {formMode === 'register' && (
                <form onSubmit={handleRoleRegister} className="space-y-3.5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                        Coordinator Full Name *
                      </label>
                      <input
                        type="text"
                        value={regName}
                        onChange={(e) => setRegName(e.target.value)}
                        placeholder="e.g. Ramesh Patel"
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs text-slate-800 focus:ring-2 focus:ring-rose-500 focus:outline-none"
                      />
                      {errors.regName && (
                        <p className="text-[10px] text-rose-600 mt-0.5">{errors.regName}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                        Organization / Branch Name *
                      </label>
                      <input
                        type="text"
                        value={regOrg}
                        onChange={(e) => setRegOrg(e.target.value)}
                        placeholder="e.g. Royal Kitchens & Caterers"
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs text-slate-800 focus:ring-2 focus:ring-rose-500 focus:outline-none"
                      />
                      {errors.regOrg && (
                        <p className="text-[10px] text-rose-600 mt-0.5">{errors.regOrg}</p>
                      )}
                    </div>
                  </div>

                  {/* Role Specific Registration Field */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                      {activePortal.customField.label} *
                    </label>
                    <input
                      type="text"
                      value={regCustomField}
                      onChange={(e) => setRegCustomField(e.target.value)}
                      placeholder={activePortal.customField.placeholder}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono text-slate-800 focus:ring-2 focus:ring-rose-500 focus:outline-none"
                    />
                    {errors.regCustomField ? (
                      <p className="text-[10px] text-rose-600 mt-0.5">{errors.regCustomField}</p>
                    ) : (
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        {activePortal.customField.helper}
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                        Work Email Address *
                      </label>
                      <input
                        type="email"
                        value={regEmail}
                        onChange={(e) => setRegEmail(e.target.value)}
                        placeholder="contact@company.org"
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs text-slate-800 focus:ring-2 focus:ring-rose-500 focus:outline-none"
                      />
                      {errors.regEmail && (
                        <p className="text-[10px] text-rose-600 mt-0.5">{errors.regEmail}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                        Password *
                      </label>
                      <input
                        type="password"
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                        placeholder="Min 6 characters"
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs text-slate-800 focus:ring-2 focus:ring-rose-500 focus:outline-none"
                      />
                      {errors.regPassword && (
                        <p className="text-[10px] text-rose-600 mt-0.5">{errors.regPassword}</p>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                      Phone Number (for SMS & AI Voice Escalations)
                    </label>
                    <input
                      type="tel"
                      value={regPhone}
                      onChange={(e) => setRegPhone(e.target.value)}
                      placeholder="+91 98765 43210"
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs text-slate-800 focus:ring-2 focus:ring-rose-500 focus:outline-none"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className={`w-full py-3 rounded-xl bg-gradient-to-r ${activePortal.color} text-white font-bold text-xs sm:text-sm shadow-md transition flex items-center justify-center gap-1.5 mt-2`}
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>
                      {submitting
                        ? 'Registering partner...'
                        : `Register as Verified ${activePortal.shortTitle}`}
                    </span>
                  </button>
                </form>
              )}
            </div>
          </div>
        )}
      </div>

      {/* =========================================================================
          GOOGLE AUTHENTICATION SIMULATION MODAL
          Hyper-realistic, polished Google Identity Services account chooser
         ========================================================================= */}
      {isGoogleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white text-slate-900 rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-5 animate-scaleUp">
            {/* Google Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <GoogleIcon className="w-6 h-6" />
                <span className="text-base font-bold text-slate-800">
                  Sign in with Google
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsGoogleModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Prompt */}
            <div className="space-y-1">
              <h3 className="text-base font-bold text-slate-900">
                Choose an account
              </h3>
              <p className="text-xs text-slate-500">
                to continue to <strong className="text-rose-600">Share A Plate</strong> ({PORTALS.find((p) => p.role === googleTargetRole)?.shortTitle || 'Food Rescue Hub'})
              </p>
            </div>

            {/* Account List */}
            <div className="space-y-2">
              <button
                type="button"
                onClick={() =>
                  handleExecuteGoogleLogin({
                    name: 'Hitesh Sharma',
                    email: 'hiteshav2006@gmail.com',
                    avatar:
                      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
                  })
                }
                className="w-full flex items-center gap-3 p-3 rounded-2xl border border-slate-200 hover:border-rose-400 hover:bg-rose-50/30 transition text-left group"
              >
                <img
                  src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80"
                  alt="Hitesh Sharma"
                  className="w-10 h-10 rounded-full object-cover ring-2 ring-rose-200"
                />
                <div className="flex-1 truncate">
                  <div className="text-sm font-bold text-slate-900 group-hover:text-rose-600 flex items-center gap-1.5">
                    <span>Hitesh Sharma</span>
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded font-semibold">
                      Verified
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 truncate">
                    hiteshav2006@gmail.com
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-rose-600 group-hover:translate-x-0.5 transition" />
              </button>

              <button
                type="button"
                onClick={() =>
                  handleExecuteGoogleLogin({
                    name: 'Chef Marco Rossi (Google Org)',
                    email: 'marco.rossi@hyatt-culinary.com',
                    avatar:
                      'https://images.unsplash.com/photo-1583394838336-acd977736f90?auto=format&fit=crop&w=200&q=80',
                  })
                }
                className="w-full flex items-center gap-3 p-3 rounded-2xl border border-slate-200 hover:border-rose-400 hover:bg-rose-50/30 transition text-left group"
              >
                <img
                  src="https://images.unsplash.com/photo-1583394838336-acd977736f90?auto=format&fit=crop&w=200&q=80"
                  alt="Corporate Account"
                  className="w-10 h-10 rounded-full object-cover ring-2 ring-slate-200"
                />
                <div className="flex-1 truncate">
                  <div className="text-sm font-bold text-slate-900 group-hover:text-rose-600">
                    Grand Hyatt Executive Culinary
                  </div>
                  <div className="text-xs text-slate-500 truncate">
                    marco.rossi@hyatt-culinary.com
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-rose-600 group-hover:translate-x-0.5 transition" />
              </button>
            </div>

            {/* Privacy notice */}
            <div className="text-[11px] text-slate-400 pt-2 border-t border-slate-100 leading-relaxed">
              To continue, Google will share your name, email address, language preference, and profile picture with Share A Plate. See our{' '}
              <span className="text-slate-600 underline">Privacy Policy</span> and{' '}
              <span className="text-slate-600 underline">Terms of Service</span>.
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
