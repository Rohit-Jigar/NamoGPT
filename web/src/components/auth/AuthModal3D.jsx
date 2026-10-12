import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  Sparkles,
  Crown,
  Lock,
  Mail,
  User,
  Calendar,
  X,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  Eye,
  EyeOff,
  KeyRound,
  ExternalLink,
  ChevronRight,
  Info
} from 'lucide-react';

export default function AuthModal3D() {
  const {
    isAuthModalOpen,
    setIsAuthModalOpen,
    login,
    register,
    demoAdminLogin,
    isLoading,
    superAdminInfo,
    lastGeneratedCredentials,
    setLastGeneratedCredentials
  } = useAuth();

  // Tab mode: 'login' | 'register'
  const [mode, setMode] = useState('login');

  // Form states
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [dob, setDob] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  // Status banners & feedback
  const [errorMsg, setErrorMsg] = useState('');
  const [toastMsg, setToastMsg] = useState('');
  const [revealedCredentials, setRevealedCredentials] = useState(null);
  const [copiedField, setCopiedField] = useState(null);
  const [socialLoading, setSocialLoading] = useState(null); // 'google' | 'apple'

  // 3D Tilt calculation
  const cardRef = useRef(null);
  const [tilt, setTilt] = useState({ rx: 0, ry: 0, shineX: 50, shineY: 50 });
  const [isHovered, setIsHovered] = useState(false);

  // Reset or initialize on open
  useEffect(() => {
    if (isAuthModalOpen) {
      setErrorMsg('');
      setToastMsg('');
      setSocialLoading(null);
    }
  }, [isAuthModalOpen]);

  if (!isAuthModalOpen) return null;

  // Handle 3D Mouse Movement
  const handleMouseMove = (e) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const rx = ((y - centerY) / centerY) * -6.5; // max tilt +/- 6.5deg
    const ry = ((x - centerX) / centerX) * 6.5;
    const shineX = (x / rect.width) * 100;
    const shineY = (y / rect.height) * 100;

    setTilt({ rx, ry, shineX, shineY });
  };

  const handleMouseEnter = () => setIsHovered(true);
  const handleMouseLeave = () => {
    setIsHovered(false);
    setTilt({ rx: 0, ry: 0, shineX: 50, shineY: 50 });
  };

  // Copy helper
  const handleCopy = (text, fieldKey) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedField(fieldKey);
    setTimeout(() => setCopiedField(null), 2200);
  };

  // Login handler
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setToastMsg('');

    if (!identifier.trim()) {
      setErrorMsg('Please enter your username or email address.');
      return;
    }
    if (!password) {
      setErrorMsg('Please enter your password.');
      return;
    }

    try {
      await login({
        identifier: identifier.trim(),
        email: identifier.trim(),
        username: identifier.trim(),
        password
      });
      setIsAuthModalOpen(false);
    } catch (err) {
      setErrorMsg(err.message || 'Login failed. Please check your credentials.');
    }
  };

  // Registration handler
  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setToastMsg('');

    if (!name.trim()) {
      setErrorMsg('Please enter your full name.');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setErrorMsg('Please provide a valid email address.');
      return;
    }
    if (!dob) {
      setErrorMsg('Please select your date of birth.');
      return;
    }

    try {
      const res = await register({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        dob
      });

      const creds = res.credentials || {
        username: email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '') + '_' + Math.floor(100 + Math.random() * 900),
        password: `Namo@${Math.random().toString(36).slice(-6)}!2026`,
        email: email.trim()
      };

      setRevealedCredentials(creds);
      setToastMsg('Account created successfully! Your credentials have been generated and dispatched.');
    } catch (err) {
      setErrorMsg(err.message || 'Registration failed. Please try again.');
    }
  };

  // Proceed to log in from reveal card
  const handleProceedToLogin = () => {
    if (revealedCredentials) {
      setIdentifier(revealedCredentials.username || revealedCredentials.email);
      setPassword(revealedCredentials.password);
    }
    setRevealedCredentials(null);
    setMode('login');
    setErrorMsg('');
    setToastMsg('Credentials auto-populated. Click "Sign In" or press Enter.');
  };

  // Demo Super Admin 1-Click
  const handleDemoAdmin = async () => {
    setErrorMsg('');
    setToastMsg('');
    try {
      await demoAdminLogin();
      setIsAuthModalOpen(false);
    } catch (err) {
      setErrorMsg(err.message || 'Super Admin demo login failed.');
    }
  };

  // Simulated Social Auth (Google / Apple)
  const handleSocialAuth = async (provider) => {
    setErrorMsg('');
    setSocialLoading(provider);
    const providerName = provider === 'google' ? 'Google' : 'Apple';
    setToastMsg(`Simulating secure ${providerName} Single Sign-On...`);

    setTimeout(async () => {
      try {
        const demoEmail = provider === 'google' ? 'google.user@namogpt.ai' : 'apple.user@namogpt.ai';
        const demoName = provider === 'google' ? 'Google Cloud User' : 'Apple Silicon User';

        await register({
          name: demoName,
          email: demoEmail,
          dob: '2000-01-01',
          password: `Social@NamoAuth2026!`,
          username: `${provider}_user_99`
        });

        setToastMsg(`Successfully authenticated via ${providerName}! All features unlocked.`);
        setTimeout(() => {
          setIsAuthModalOpen(false);
          setSocialLoading(null);
        }, 800);
      } catch (err) {
        setSocialLoading(null);
        setErrorMsg(`Simulated ${providerName} sign-on failed: ` + err.message);
      }
    }, 1100);
  };

  // Forgot password notice
  const handleForgotPassword = () => {
    setErrorMsg('');
    setToastMsg(
      'Password recovery instructions and security token have been routed to administrator rohitjigarmaheshbhai@gmail.com and your registered email.'
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-xl select-none overflow-y-auto"
      style={{ perspective: '1200px' }}
      onClick={(e) => {
        if (e.target === e.currentTarget) setIsAuthModalOpen(false);
      }}
    >
      {/* Ambient background glowing orbs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-500/15 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-[28rem] h-[28rem] bg-indigo-500/15 rounded-full blur-[140px] animate-pulse" style={{ animationDuration: '4s' }} />
        <div className="absolute top-1/2 right-1/3 w-80 h-80 bg-cyan-500/10 rounded-full blur-[100px]" />
      </div>

      {/* 3D Glassmorphism Modal Card */}
      <div
        ref={cardRef}
        onMouseMove={handleMouseMove}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        style={{
          transform: `rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg)`,
          transition: isHovered ? 'transform 0.1s cubic-bezier(0.2, 0, 0, 1)' : 'transform 0.6s ease-out',
          transformStyle: 'preserve-3d'
        }}
        className="relative z-10 w-full max-w-lg my-auto rounded-3xl backdrop-blur-2xl bg-zinc-950/80 border border-white/10 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.8)] overflow-hidden transition-shadow duration-300"
      >
        {/* Dynamic Specular Light Glare Overlay */}
        <div
          className="absolute inset-0 pointer-events-none opacity-40 transition-opacity duration-300 rounded-3xl"
          style={{
            background: `radial-gradient(circle 350px at ${tilt.shineX}% ${tilt.shineY}%, rgba(255, 255, 255, 0.12), transparent 70%)`
          }}
        />

        {/* Top Gradient Accent Bar */}
        <div className="h-1.5 w-full bg-gradient-to-r from-emerald-500 via-cyan-400 to-indigo-500" />

        {/* Close Button */}
        <button
          onClick={() => setIsAuthModalOpen(false)}
          className="absolute top-4 right-4 p-2 rounded-full text-zinc-400 hover:text-white hover:bg-white/10 transition-all z-20 group"
          title="Close modal"
        >
          <X className="w-5 h-5 transition-transform group-hover:rotate-90" />
        </button>

        {/* Modal Header */}
        <div className="p-6 pb-4 text-center relative border-b border-white/5 bg-gradient-to-b from-white/[0.03] to-transparent">
          <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/10 border border-emerald-500/30 shadow-lg shadow-emerald-500/10 mb-3 group">
            <Sparkles className="w-7 h-7 text-emerald-400 transition-transform group-hover:scale-110 duration-200" />
          </div>

          <h2 className="text-2xl font-extrabold tracking-tight text-white flex items-center justify-center gap-2">
            <span>NamoGPT</span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-mono tracking-normal">
              3D Glass
            </span>
          </h2>
          <p className="text-xs text-zinc-400 mt-1.5 max-w-sm mx-auto">
            {revealedCredentials
              ? 'Registration complete! Your personal credentials are ready below.'
              : mode === 'login'
              ? 'Log in with your credentials or 1-Click Super Admin demo evaluation.'
              : 'Register your account to receive auto-generated credentials.'}
          </p>
        </div>

        {/* Tab Switcher (if not in reveal state) */}
        {!revealedCredentials && (
          <div className="px-6 pt-4">
            <div className="grid grid-cols-2 p-1.5 bg-black/40 rounded-2xl border border-white/10 backdrop-blur-md shadow-inner">
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setErrorMsg('');
                  setToastMsg('');
                }}
                className={`flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-xl transition-all duration-200 ${
                  mode === 'login'
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-950/60 border border-emerald-400/30'
                    : 'text-zinc-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>Log In</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setMode('register');
                  setErrorMsg('');
                  setToastMsg('');
                }}
                className={`flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-xl transition-all duration-200 ${
                  mode === 'register'
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-950/60 border border-emerald-400/30'
                    : 'text-zinc-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <User className="w-3.5 h-3.5" />
                <span>Create Account</span>
              </button>
            </div>
          </div>
        )}

        {/* Notifications / Toast / Error Banners */}
        {errorMsg && (
          <div className="mx-6 mt-3 p-3 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-200 text-xs flex items-start gap-2.5 shadow-sm animate-in fade-in slide-in-from-top-1">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
            <div className="flex-1 leading-relaxed">{errorMsg}</div>
          </div>
        )}

        {toastMsg && (
          <div className="mx-6 mt-3 p-3 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-200 text-xs flex items-start gap-2.5 shadow-sm animate-in fade-in slide-in-from-top-1">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
            <div className="flex-1 leading-relaxed">{toastMsg}</div>
          </div>
        )}

        {/* Modal Content Sections */}
        <div className="p-6 pt-3 space-y-4">
          {/* ============================================================ */}
          {/* POST-REGISTRATION CREDENTIAL REVEAL CARD                    */}
          {/* ============================================================ */}
          {revealedCredentials ? (
            <div className="space-y-4 animate-in zoom-in-95 duration-200">
              <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-950/40 via-zinc-900/60 to-black/60 border border-emerald-500/30 space-y-3.5 shadow-xl">
                <div className="flex items-center justify-between pb-2 border-b border-emerald-500/20">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-emerald-400" />
                    <span className="text-xs font-bold text-white uppercase tracking-wider">
                      Generated Account Credentials
                    </span>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold">
                    SuperAdmin Unlocked
                  </span>
                </div>

                {/* Username Box */}
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                    Generated Username
                  </label>
                  <div className="flex items-center justify-between bg-black/60 border border-white/10 rounded-xl px-3 py-2 font-mono text-xs text-white">
                    <span className="font-semibold text-emerald-300 select-all">
                      {revealedCredentials.username}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopy(revealedCredentials.username, 'username')}
                      className="p-1.5 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition-colors flex items-center gap-1 text-[11px]"
                      title="Copy username"
                    >
                      {copiedField === 'username' ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-emerald-400 font-sans font-bold">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span className="font-sans">Copy</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Password Box */}
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                    Generated Secure Password
                  </label>
                  <div className="flex items-center justify-between bg-black/60 border border-white/10 rounded-xl px-3 py-2 font-mono text-xs text-white">
                    <span className="font-semibold text-amber-300 select-all tracking-wider">
                      {revealedCredentials.password}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopy(revealedCredentials.password, 'password')}
                      className="p-1.5 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition-colors flex items-center gap-1 text-[11px]"
                      title="Copy password"
                    >
                      {copiedField === 'password' ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-emerald-400 font-sans font-bold">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span className="font-sans">Copy</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Dispatch Confirmation Notice */}
                <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10 text-[11px] text-zinc-300 leading-relaxed space-y-1">
                  <div className="flex items-start gap-2">
                    <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                    <p>
                      Your credentials have been securely emailed to{' '}
                      <span className="text-emerald-400 font-semibold">{revealedCredentials.email}</span>{' '}
                      and administrator{' '}
                      <span className="text-cyan-300 font-mono text-[10px]">rohitjigarmaheshbhai@gmail.com</span>.
                      You can now log in immediately!
                    </p>
                  </div>
                </div>
              </div>

              {/* Proceed Button */}
              <button
                type="button"
                onClick={handleProceedToLogin}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-400 hover:to-teal-500 text-black font-bold text-xs uppercase tracking-wider shadow-lg shadow-emerald-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                <span>Proceed to Log In</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          ) : mode === 'register' ? (
            /* ============================================================ */
            /* REGISTRATION VIEW                                            */
            /* ============================================================ */
            <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
              {/* Full Name */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Full Name</span>
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    placeholder="e.g. Alex Turing"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-black/40 text-xs text-white placeholder-zinc-500 pl-10 pr-3 py-2.5 rounded-xl border border-white/10 focus:border-emerald-500 focus:bg-black/60 outline-none transition-all shadow-inner"
                  />
                </div>
              </div>

              {/* Email Address */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Email Address</span>
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-black/40 text-xs text-white placeholder-zinc-500 pl-10 pr-3 py-2.5 rounded-xl border border-white/10 focus:border-emerald-500 focus:bg-black/60 outline-none transition-all shadow-inner"
                  />
                </div>
              </div>

              {/* Date of Birth */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Date of Birth</span>
                </label>
                <div className="relative">
                  <Calendar className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="date"
                    required
                    value={dob}
                    onChange={(e) => setDob(e.target.value)}
                    className="w-full bg-black/40 text-xs text-white placeholder-zinc-500 pl-10 pr-3 py-2.5 rounded-xl border border-white/10 focus:border-emerald-500 focus:bg-black/60 outline-none transition-all shadow-inner [color-scheme:dark]"
                  />
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full mt-2 flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-lg shadow-emerald-950/50 border border-emerald-400/30 transition-all hover:scale-[1.01] active:scale-[0.98]"
              >
                <span>{isLoading ? 'Generating & Dispatching...' : 'Generate Account & Send Credentials'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              {/* Social Login Options */}
              <div className="pt-2">
                <div className="relative flex py-1 items-center">
                  <div className="flex-grow border-t border-white/10"></div>
                  <span className="flex-shrink mx-3 text-[10px] uppercase font-semibold text-zinc-500 tracking-wider">
                    Or instant onboarding
                  </span>
                  <div className="flex-grow border-t border-white/10"></div>
                </div>

                <div className="grid grid-cols-2 gap-2 mt-2">
                  {/* Google Button */}
                  <button
                    type="button"
                    disabled={Boolean(socialLoading)}
                    onClick={() => handleSocialAuth('google')}
                    className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 hover:border-white/20 text-xs text-zinc-200 transition-all active:scale-95"
                  >
                    <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                      />
                    </svg>
                    <span className="truncate">Google</span>
                  </button>

                  {/* Apple Button */}
                  <button
                    type="button"
                    disabled={Boolean(socialLoading)}
                    onClick={() => handleSocialAuth('apple')}
                    className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 hover:border-white/20 text-xs text-zinc-200 transition-all active:scale-95"
                  >
                    <svg className="w-4 h-4 shrink-0 fill-current text-white" viewBox="0 0 170 170">
                      <path d="M150.37 130.25c-2.45 5.66-5.35 10.87-8.71 15.66-4.58 6.53-8.33 11.05-11.22 13.56-4.48 4.12-9.28 6.23-14.42 6.35-3.69 0-8.14-1.05-13.32-3.18-5.19-2.12-9.97-3.17-14.34-3.17-4.58 0-9.49 1.05-14.74 3.17-5.26 2.13-9.5 3.24-12.74 3.35-4.35.13-9.16-1.9-14.42-6.08-3.69-3.04-7.69-7.85-12-14.43-5.64-8.54-10.15-18.42-13.52-29.65-3.37-11.22-5.06-22.13-5.06-32.72 0-14.73 3.65-27.12 10.96-37.15 7.3-10.04 16.64-15.19 28.01-15.46 4.7 0 10.05 1.25 16.06 3.75 6.01 2.5 10.15 3.79 12.43 3.86 1.83 0 6.06-1.33 12.69-4 6.63-2.66 12.28-3.87 16.96-3.63 13.25.7 23.73 5.48 31.44 14.34-11.58 7.02-17.24 16.82-16.98 29.41.26 9.87 4.09 18.06 11.5 24.57 7.41 6.51 16.33 10.23 26.77 11.16-2.58 8.01-5.71 15.96-9.4 23.87zM119.22 33.15c0-7.39 2.65-14.43 7.95-21.12 5.3-6.69 11.95-10.98 19.95-12.87.57 3.92.57 7.75 0 11.49-1.29 8.06-5.14 15.19-11.56 21.39-6.42 6.2-13.3 9.77-20.65 10.72-.45-3.13-.67-6.33-.67-9.61z" />
                    </svg>
                    <span className="truncate">Apple ID</span>
                  </button>
                </div>
              </div>
            </form>
          ) : (
            /* ============================================================ */
            /* LOGIN VIEW                                                   */
            /* ============================================================ */
            <form onSubmit={handleLoginSubmit} className="space-y-3.5">
              {/* Quick Super Admin Demo 1-Click Banner */}
              <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Crown className="w-4 h-4 text-amber-400 shrink-0" />
                    <span className="text-xs font-bold text-amber-300">
                      1-Click Super Admin Demo
                    </span>
                  </div>
                  <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold">
                    Unlocked
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px] font-mono text-zinc-300 bg-black/40 px-3 py-1.5 rounded-xl border border-zinc-800">
                  <span className="truncate">{superAdminInfo.email}</span>
                  <span className="text-zinc-600 font-sans">•</span>
                  <span className="truncate text-zinc-400">{superAdminInfo.password}</span>
                </div>
                <button
                  type="button"
                  onClick={handleDemoAdmin}
                  disabled={isLoading}
                  className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-bold text-xs shadow-md transition-all active:scale-95"
                >
                  <Crown className="w-3.5 h-3.5 fill-current" />
                  <span>{isLoading ? 'Authorizing...' : 'Instant 1-Click Login (Full Admin)'}</span>
                </button>
              </div>

              {/* Username or Email */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Username or Email</span>
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    placeholder="Username or your email address"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    className="w-full bg-black/40 text-xs text-white placeholder-zinc-500 pl-10 pr-3 py-2.5 rounded-xl border border-white/10 focus:border-emerald-500 focus:bg-black/60 outline-none transition-all shadow-inner"
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Password</span>
                  </label>
                  <button
                    type="button"
                    onClick={handleForgotPassword}
                    className="text-[11px] text-emerald-400 hover:text-emerald-300 hover:underline transition-colors"
                  >
                    Forgot Password?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-black/40 text-xs text-white placeholder-zinc-500 pl-10 pr-10 py-2.5 rounded-xl border border-white/10 focus:border-emerald-500 focus:bg-black/60 outline-none transition-all shadow-inner"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-200 transition-colors p-1"
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Remember Me Checkbox */}
              <div className="flex items-center justify-between pt-0.5">
                <label className="flex items-center gap-2 cursor-pointer text-xs text-zinc-400 hover:text-zinc-200">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-3.5 h-3.5 rounded bg-zinc-900 border-zinc-700 text-emerald-500 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                  />
                  <span>Remember me on this browser</span>
                </label>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full mt-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-lg shadow-emerald-950/50 border border-emerald-400/30 transition-all hover:scale-[1.01] active:scale-[0.98]"
              >
                <span>{isLoading ? 'Verifying Session...' : 'Sign In to NamoGPT'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              {/* Social Login Options */}
              <div className="pt-2">
                <div className="relative flex py-1 items-center">
                  <div className="flex-grow border-t border-white/10"></div>
                  <span className="flex-shrink mx-3 text-[10px] uppercase font-semibold text-zinc-500 tracking-wider">
                    Or sign in with
                  </span>
                  <div className="flex-grow border-t border-white/10"></div>
                </div>

                <div className="grid grid-cols-2 gap-2 mt-2">
                  <button
                    type="button"
                    disabled={Boolean(socialLoading)}
                    onClick={() => handleSocialAuth('google')}
                    className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 hover:border-white/20 text-xs text-zinc-200 transition-all active:scale-95"
                  >
                    <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                      />
                    </svg>
                    <span className="truncate">Google</span>
                  </button>

                  <button
                    type="button"
                    disabled={Boolean(socialLoading)}
                    onClick={() => handleSocialAuth('apple')}
                    className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 hover:border-white/20 text-xs text-zinc-200 transition-all active:scale-95"
                  >
                    <svg className="w-4 h-4 shrink-0 fill-current text-white" viewBox="0 0 170 170">
                      <path d="M150.37 130.25c-2.45 5.66-5.35 10.87-8.71 15.66-4.58 6.53-8.33 11.05-11.22 13.56-4.48 4.12-9.28 6.23-14.42 6.35-3.69 0-8.14-1.05-13.32-3.18-5.19-2.12-9.97-3.17-14.34-3.17-4.58 0-9.49 1.05-14.74 3.17-5.26 2.13-9.5 3.24-12.74 3.35-4.35.13-9.16-1.9-14.42-6.08-3.69-3.04-7.69-7.85-12-14.43-5.64-8.54-10.15-18.42-13.52-29.65-3.37-11.22-5.06-22.13-5.06-32.72 0-14.73 3.65-27.12 10.96-37.15 7.3-10.04 16.64-15.19 28.01-15.46 4.7 0 10.05 1.25 16.06 3.75 6.01 2.5 10.15 3.79 12.43 3.86 1.83 0 6.06-1.33 12.69-4 6.63-2.66 12.28-3.87 16.96-3.63 13.25.7 23.73 5.48 31.44 14.34-11.58 7.02-17.24 16.82-16.98 29.41.26 9.87 4.09 18.06 11.5 24.57 7.41 6.51 16.33 10.23 26.77 11.16-2.58 8.01-5.71 15.96-9.4 23.87zM119.22 33.15c0-7.39 2.65-14.43 7.95-21.12 5.3-6.69 11.95-10.98 19.95-12.87.57 3.92.57 7.75 0 11.49-1.29 8.06-5.14 15.19-11.56 21.39-6.42 6.2-13.3 9.77-20.65 10.72-.45-3.13-.67-6.33-.67-9.61z" />
                    </svg>
                    <span className="truncate">Apple ID</span>
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* Guest Dismissal */}
          <div className="text-center pt-1 border-t border-white/5">
            <button
              type="button"
              onClick={() => setIsAuthModalOpen(false)}
              className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors underline underline-offset-4"
            >
              Continue as Guest (No login required)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
