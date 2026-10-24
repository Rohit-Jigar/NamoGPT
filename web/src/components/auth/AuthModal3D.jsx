import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  Sparkles,
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
  RotateCcw
} from 'lucide-react';

export default function AuthModal3D() {
  const {
    isAuthModalOpen,
    setIsAuthModalOpen,
    login,
    register,
    sendEmailOtp,
    verifyEmailOtp,
    demoAdminLogin,
    isLoading,
    superAdminInfo,
    signInWithGitHub,
    signInWithGoogle,
    signInWithApple,
    isSupabaseAvailable
  } = useAuth();

  // Mode: 'otp' | 'login' | 'register'
  const [mode, setMode] = useState('otp');

  // OTP flow states
  const [otpEmail, setOtpEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpTimer, setOtpTimer] = useState(0);

  // Form states for password login / register
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [dob, setDob] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Status feedback
  const [errorMsg, setErrorMsg] = useState('');
  const [toastMsg, setToastMsg] = useState('');
  const [revealedCredentials, setRevealedCredentials] = useState(null);
  const [copiedField, setCopiedField] = useState(null);
  const [socialLoading, setSocialLoading] = useState(null); // 'google' | 'github' | 'apple'

  // 3D Card tilt
  const cardRef = useRef(null);
  const [tilt, setTilt] = useState({ rx: 0, ry: 0, shineX: 50, shineY: 50 });

  // Reset state on open
  useEffect(() => {
    if (isAuthModalOpen) {
      setErrorMsg('');
      setToastMsg('');
      setSocialLoading(null);
    }
  }, [isAuthModalOpen]);

  // Countdown timer for OTP resend
  useEffect(() => {
    let interval = null;
    if (otpTimer > 0) {
      interval = setInterval(() => {
        setOtpTimer((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [otpTimer]);

  if (!isAuthModalOpen) return null;

  // 3D Mouse Movement
  const handleMouseMove = (e) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const rx = ((y - rect.height / 2) / (rect.height / 2)) * -5;
    const ry = ((x - rect.width / 2) / (rect.width / 2)) * 5;
    const shineX = (x / rect.width) * 100;
    const shineY = (y / rect.height) * 100;
    setTilt({ rx, ry, shineX, shineY });
  };

  const handleMouseLeave = () => {
    setTilt({ rx: 0, ry: 0, shineX: 50, shineY: 50 });
  };

  const handleCopy = (text, fieldKey) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedField(fieldKey);
    setTimeout(() => setCopiedField(null), 2000);
  };

  // Real-time Email OTP: Send Code
  const handleSendOtp = async (e) => {
    e?.preventDefault();
    setErrorMsg('');
    setToastMsg('');

    if (!otpEmail.trim() || !otpEmail.includes('@')) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }

    try {
      const res = await sendEmailOtp(otpEmail.trim());
      setOtpSent(true);
      setOtpTimer(60);
      setToastMsg(res.message || `Verification code sent to ${otpEmail.trim()}`);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to dispatch verification code.');
    }
  };

  // Real-time Email OTP: Verify Code
  const handleVerifyOtp = async (e) => {
    e?.preventDefault();
    setErrorMsg('');
    setToastMsg('');

    if (!otpCode.trim() || otpCode.trim().length < 4) {
      setErrorMsg('Please enter the 6-digit code received in your email.');
      return;
    }

    try {
      await verifyEmailOtp(otpEmail.trim(), otpCode.trim());
      setToastMsg('Authentication successful! Welcome to NamoGPT.');
    } catch (err) {
      setErrorMsg(err.message || 'Invalid or expired code. Please try again.');
    }
  };

  // Traditional Password Login
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

  // Account Registration
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
      setToastMsg('Account created! Your credentials have been generated and dispatched.');
    } catch (err) {
      setErrorMsg(err.message || 'Registration failed. Please try again.');
    }
  };

  // Real-time OAuth (Google, GitHub, Apple)
  const handleOAuthLogin = async (provider) => {
    setErrorMsg('');
    setSocialLoading(provider);

    try {
      if (provider === 'google') {
        const res = await signInWithGoogle();
        if (!res.success) throw new Error(res.error || 'Google OAuth failed.');
        return;
      }
      if (provider === 'github') {
        const res = await signInWithGitHub();
        if (!res.success) throw new Error(res.error || 'GitHub OAuth failed.');
        return;
      }
      if (provider === 'apple') {
        const res = await signInWithApple();
        if (!res.success) throw new Error(res.error || 'Apple OAuth failed.');
        return;
      }
    } catch (err) {
      console.warn(`[AuthModal] ${provider} OAuth error:`, err.message);
      // If Supabase OAuth is not yet configured with client secrets in Supabase dashboard,
      // notify user clearly and provide quick-access fallback
      setErrorMsg(
        `${provider.toUpperCase()} Single Sign-On requires configuring OAuth credentials in the Supabase Dashboard. ` +
        `See AUTH_CREDENTIALS_SETUP.md for 1-click setup.`
      );
      setSocialLoading(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in">
      <div
        ref={cardRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{
          transform: `perspective(1000px) rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg)`,
          transition: 'transform 0.15s ease-out'
        }}
        className="relative w-full max-w-lg rounded-2xl bg-[#13100E] border border-[#E5E4E2]/15 shadow-[0_20px_50px_rgba(0,0,0,0.8)] overflow-hidden"
      >
        {/* Ambient Top Light Beam */}
        <div
          className="absolute inset-0 pointer-events-none opacity-25"
          style={{
            background: `radial-gradient(circle at ${tilt.shineX}% ${tilt.shineY}%, rgba(230, 224, 240, 0.18), transparent 60%)`
          }}
        />

        {/* Header */}
        <div className="relative px-7 pt-7 pb-4 border-b border-[#E5E4E2]/10 flex items-center justify-between">
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xl font-bold tracking-tight text-[#FAF9F8]">NAMO</span>
              <span className="text-xl font-bold tracking-tight text-[#E6E0F0]">GPT</span>
              <span className="text-[10px] uppercase font-mono tracking-wider px-2 py-0.5 rounded bg-[#6F4E37]/30 text-[#E5E4E2] border border-[#6F4E37]">
                Identity Mesh
              </span>
            </div>
            <p className="text-xs text-[#BDB8B3] mt-1 font-normal">
              High-performance inference platform & cognitive workspace
            </p>
          </div>
          <button
            onClick={() => setIsAuthModalOpen(false)}
            className="p-1.5 rounded-lg text-[#BDB8B3] hover:text-[#FAF9F8] hover:bg-[#241E1A] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-7 space-y-6">
          {/* Notification / Error / Toast */}
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-red-950/40 border border-red-500/30 text-red-200 text-xs flex items-start space-x-2.5">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <div className="leading-relaxed">{errorMsg}</div>
            </div>
          )}
          {toastMsg && (
            <div className="p-3.5 rounded-xl bg-[#6F4E37]/20 border border-[#6F4E37]/40 text-[#FAF9F8] text-xs flex items-start space-x-2.5">
              <CheckCircle2 className="w-4 h-4 text-[#E6E0F0] shrink-0 mt-0.5" />
              <div className="leading-relaxed">{toastMsg}</div>
            </div>
          )}

          {/* Social Single Sign-On (Real Real-Time SSO) */}
          <div className="space-y-3">
            <div className="text-[11px] font-mono uppercase tracking-wider text-[#BDB8B3]">
              Direct Single Sign-On
            </div>
            <div className="grid grid-cols-3 gap-2.5">
              {/* Google */}
              <button
                type="button"
                onClick={() => handleOAuthLogin('google')}
                disabled={Boolean(socialLoading)}
                className="flex items-center justify-center space-x-2 py-2.5 px-3 rounded-xl bg-[#1A1613] hover:bg-[#241E1A] border border-[#E5E4E2]/15 hover:border-[#E6E0F0]/40 text-[#FAF9F8] text-xs font-medium transition-all group shadow-sm disabled:opacity-50"
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#EA4335"
                    d="M12 5c1.56 0 2.97.55 4.09 1.6l3.07-3.07C17.3 1.76 14.84 1 12 1 7.42 1 3.51 3.6 1.62 7.37l3.69 2.87C6.18 7.3 8.84 5 12 5z"
                  />
                  <path
                    fill="#4285F4"
                    d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58l3.69 2.86c2.16-1.99 3.73-4.94 3.73-8.68z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.31 14.76A7.04 7.04 0 014.93 12c0-.97.16-1.9.44-2.76L1.62 6.37C.59 8.44 0 10.16 0 12c0 1.84.59 3.56 1.62 5.63l3.69-2.87z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c3.24 0 5.95-1.08 7.93-2.91l-3.69-2.86c-1.07.72-2.45 1.16-4.24 1.16-3.16 0-5.82-2.3-6.69-5.24L1.62 16.02C3.51 19.79 7.42 22.4 12 22.4z"
                  />
                </svg>
                <span>Google</span>
              </button>

              {/* GitHub */}
              <button
                type="button"
                onClick={() => handleOAuthLogin('github')}
                disabled={Boolean(socialLoading)}
                className="flex items-center justify-center space-x-2 py-2.5 px-3 rounded-xl bg-[#1A1613] hover:bg-[#241E1A] border border-[#E5E4E2]/15 hover:border-[#E6E0F0]/40 text-[#FAF9F8] text-xs font-medium transition-all group shadow-sm disabled:opacity-50"
              >
                <svg className="w-4 h-4 fill-current text-[#FAF9F8]" viewBox="0 0 24 24">
                  <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                </svg>
                <span>GitHub</span>
              </button>

              {/* Apple */}
              <button
                type="button"
                onClick={() => handleOAuthLogin('apple')}
                disabled={Boolean(socialLoading)}
                className="flex items-center justify-center space-x-2 py-2.5 px-3 rounded-xl bg-[#1A1613] hover:bg-[#241E1A] border border-[#E5E4E2]/15 hover:border-[#E6E0F0]/40 text-[#FAF9F8] text-xs font-medium transition-all group shadow-sm disabled:opacity-50"
              >
                <svg className="w-4 h-4 fill-current text-[#FAF9F8]" viewBox="0 0 24 24">
                  <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.42c.62-.75 1.04-1.8 0.92-2.85-.9.04-2 0.6-2.65 1.35-.58.66-1.09 1.73-.95 2.76 1.01.08 2.06-.52 2.68-1.26z" />
                </svg>
                <span>Apple</span>
              </button>
            </div>
          </div>

          {/* Divider */}
          <div className="relative flex items-center justify-center">
            <div className="border-t border-[#E5E4E2]/10 w-full" />
            <span className="bg-[#13100E] px-3 text-[11px] uppercase font-mono text-[#BDB8B3]/60 tracking-wider">
              Or Authenticate Via
            </span>
            <div className="border-t border-[#E5E4E2]/10 w-full" />
          </div>

          {/* Mode Switch Tabs */}
          <div className="grid grid-cols-3 p-1 rounded-xl bg-[#1A1613] border border-[#E5E4E2]/10 text-xs">
            <button
              type="button"
              onClick={() => {
                setMode('otp');
                setErrorMsg('');
              }}
              className={`py-2 rounded-lg font-medium transition-all ${
                mode === 'otp'
                  ? 'bg-[#6F4E37] text-[#FAF9F8] shadow-sm'
                  : 'text-[#BDB8B3] hover:text-[#FAF9F8]'
              }`}
            >
              Email OTP
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setErrorMsg('');
              }}
              className={`py-2 rounded-lg font-medium transition-all ${
                mode === 'login'
                  ? 'bg-[#6F4E37] text-[#FAF9F8] shadow-sm'
                  : 'text-[#BDB8B3] hover:text-[#FAF9F8]'
              }`}
            >
              Password
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setErrorMsg('');
              }}
              className={`py-2 rounded-lg font-medium transition-all ${
                mode === 'register'
                  ? 'bg-[#6F4E37] text-[#FAF9F8] shadow-sm'
                  : 'text-[#BDB8B3] hover:text-[#FAF9F8]'
              }`}
            >
              Register
            </button>
          </div>

          {/* TAB 1: Real-time Email OTP Login */}
          {mode === 'otp' && (
            <div className="space-y-4">
              {!otpSent ? (
                <form onSubmit={handleSendOtp} className="space-y-4">
                  <div>
                    <label className="block text-xs font-mono uppercase text-[#BDB8B3] mb-1.5 tracking-wider">
                      Work or Personal Email
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-[#BDB8B3] absolute left-3.5 top-3" />
                      <input
                        type="email"
                        required
                        value={otpEmail}
                        onChange={(e) => setOtpEmail(e.target.value)}
                        placeholder="you@company.com"
                        className="w-full bg-[#1A1613] border border-[#E5E4E2]/15 focus:border-[#E6E0F0] text-[#FAF9F8] placeholder-[#7A7570] text-sm rounded-xl pl-10 pr-4 py-2.5 outline-none transition-all"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-3 px-4 rounded-xl bg-[#6F4E37] hover:bg-[#8C6549] text-[#FAF9F8] font-semibold text-sm transition-all flex items-center justify-center space-x-2 shadow-md hover:shadow-lg disabled:opacity-50"
                  >
                    <span>{isLoading ? 'Dispatching...' : 'Send 6-Digit Login Code'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </form>
              ) : (
                <form onSubmit={handleVerifyOtp} className="space-y-4">
                  <div>
                    <div className="flex justify-between items-center mb-1.5">
                      <label className="text-xs font-mono uppercase text-[#BDB8B3] tracking-wider">
                        Verification Code for {otpEmail}
                      </label>
                      <button
                        type="button"
                        onClick={() => setOtpSent(false)}
                        className="text-[11px] text-[#E6E0F0] hover:underline"
                      >
                        Change Email
                      </button>
                    </div>
                    <input
                      type="text"
                      maxLength={6}
                      autoFocus
                      required
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/[^0-9]/g, ''))}
                      placeholder="• • • • • •"
                      className="w-full bg-[#1A1613] border border-[#6F4E37] focus:border-[#E6E0F0] text-[#FAF9F8] text-center text-2xl font-mono tracking-[0.5em] rounded-xl py-3 outline-none transition-all"
                    />
                  </div>

                  <div className="flex items-center justify-between text-xs text-[#BDB8B3]">
                    <span>Code expires in 10 minutes</span>
                    <button
                      type="button"
                      disabled={otpTimer > 0 || isLoading}
                      onClick={handleSendOtp}
                      className="text-[#E6E0F0] hover:underline disabled:text-[#7A7570]"
                    >
                      {otpTimer > 0 ? `Resend code in ${otpTimer}s` : 'Resend Code'}
                    </button>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading || otpCode.length < 4}
                    className="w-full py-3 px-4 rounded-xl bg-[#6F4E37] hover:bg-[#8C6549] text-[#FAF9F8] font-semibold text-sm transition-all flex items-center justify-center space-x-2 shadow-md disabled:opacity-50"
                  >
                    <span>{isLoading ? 'Verifying...' : 'Verify & Enter Workspace'}</span>
                    <CheckCircle2 className="w-4 h-4" />
                  </button>
                </form>
              )}
            </div>
          )}

          {/* TAB 2: Traditional Password Login */}
          {mode === 'login' && (
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-mono uppercase text-[#BDB8B3] mb-1.5 tracking-wider">
                  Email or Username
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-[#BDB8B3] absolute left-3.5 top-3" />
                  <input
                    type="text"
                    required
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="admin@namogpt.com"
                    className="w-full bg-[#1A1613] border border-[#E5E4E2]/15 focus:border-[#E6E0F0] text-[#FAF9F8] placeholder-[#7A7570] text-sm rounded-xl pl-10 pr-4 py-2.5 outline-none transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono uppercase text-[#BDB8B3] mb-1.5 tracking-wider">
                  Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-[#BDB8B3] absolute left-3.5 top-3" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full bg-[#1A1613] border border-[#E5E4E2]/15 focus:border-[#E6E0F0] text-[#FAF9F8] placeholder-[#7A7570] text-sm rounded-xl pl-10 pr-10 py-2.5 outline-none transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-3 text-[#BDB8B3] hover:text-[#FAF9F8]"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 px-4 rounded-xl bg-[#6F4E37] hover:bg-[#8C6549] text-[#FAF9F8] font-semibold text-sm transition-all flex items-center justify-center space-x-2 shadow-md disabled:opacity-50"
              >
                <span>{isLoading ? 'Authenticating...' : 'Sign In'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          )}

          {/* TAB 3: Register */}
          {mode === 'register' && !revealedCredentials && (
            <form onSubmit={handleRegisterSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-mono uppercase text-[#BDB8B3] mb-1.5 tracking-wider">
                  Full Name
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-[#BDB8B3] absolute left-3.5 top-3" />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Alex Mercer"
                    className="w-full bg-[#1A1613] border border-[#E5E4E2]/15 focus:border-[#E6E0F0] text-[#FAF9F8] placeholder-[#7A7570] text-sm rounded-xl pl-10 pr-4 py-2.5 outline-none transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono uppercase text-[#BDB8B3] mb-1.5 tracking-wider">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-[#BDB8B3] absolute left-3.5 top-3" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="alex@company.com"
                    className="w-full bg-[#1A1613] border border-[#E5E4E2]/15 focus:border-[#E6E0F0] text-[#FAF9F8] placeholder-[#7A7570] text-sm rounded-xl pl-10 pr-4 py-2.5 outline-none transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono uppercase text-[#BDB8B3] mb-1.5 tracking-wider">
                  Date of Birth
                </label>
                <div className="relative">
                  <Calendar className="w-4 h-4 text-[#BDB8B3] absolute left-3.5 top-3" />
                  <input
                    type="date"
                    required
                    value={dob}
                    onChange={(e) => setDob(e.target.value)}
                    className="w-full bg-[#1A1613] border border-[#E5E4E2]/15 focus:border-[#E6E0F0] text-[#FAF9F8] text-sm rounded-xl pl-10 pr-4 py-2.5 outline-none transition-all"
                  />
                </div>
              </div>

              <p className="text-[11px] text-[#BDB8B3] leading-relaxed">
                A hardened, unique password and username will be cryptographically generated and dispatched directly to your inbox.
              </p>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 px-4 rounded-xl bg-[#6F4E37] hover:bg-[#8C6549] text-[#FAF9F8] font-semibold text-sm transition-all flex items-center justify-center space-x-2 shadow-md disabled:opacity-50"
              >
                <span>{isLoading ? 'Creating Account...' : 'Generate Account & Access'}</span>
                <Sparkles className="w-4 h-4 text-[#E6E0F0]" />
              </button>
            </form>
          )}

          {/* Credentials Revealed View */}
          {revealedCredentials && (
            <div className="p-4 rounded-xl bg-[#1A1613] border border-[#6F4E37] space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#E6E0F0] flex items-center space-x-1.5">
                  <ShieldCheck className="w-4 h-4 text-[#E6E0F0]" />
                  <span>Provisioned Account Credentials</span>
                </span>
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between p-2 rounded bg-[#241E1A]">
                  <span className="text-[#BDB8B3]">Username:</span>
                  <span className="font-mono text-[#FAF9F8] font-semibold">@{revealedCredentials.username}</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded bg-[#241E1A]">
                  <span className="text-[#BDB8B3]">Password:</span>
                  <div className="flex items-center space-x-2">
                    <span className="font-mono text-[#FAF9F8] font-semibold">{revealedCredentials.password}</span>
                    <button
                      type="button"
                      onClick={() => handleCopy(revealedCredentials.password, 'pass')}
                      className="p-1 hover:text-[#E6E0F0]"
                    >
                      {copiedField === 'pass' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIdentifier(revealedCredentials.username);
                  setPassword(revealedCredentials.password);
                  setRevealedCredentials(null);
                  setMode('login');
                }}
                className="w-full py-2 rounded-lg bg-[#6F4E37] text-[#FAF9F8] text-xs font-semibold hover:bg-[#8C6549] transition-all"
              >
                Auto-Fill & Proceed to Sign In
              </button>
            </div>
          )}

          {/* 1-Click Super Admin Access Button */}
          <div className="pt-2 border-t border-[#E5E4E2]/10 flex items-center justify-between">
            <span className="text-[11px] text-[#BDB8B3]">Developer or Enterprise Auditor?</span>
            <button
              type="button"
              onClick={demoAdminLogin}
              className="text-[11px] font-mono text-[#E6E0F0] hover:text-[#FAF9F8] hover:underline flex items-center space-x-1"
            >
              <span>1-Click Super Admin Access</span>
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
