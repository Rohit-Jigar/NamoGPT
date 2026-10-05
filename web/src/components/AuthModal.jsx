import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Sparkles,
  Crown,
  Lock,
  Mail,
  User,
  X,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

export default function AuthModal() {
  const {
    isAuthModalOpen,
    setIsAuthModalOpen,
    login,
    register,
    demoAdminLogin,
    isLoading,
    superAdminInfo
  } = useAuth();

  const [mode, setMode] = useState('login'); // 'login' or 'register'
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  if (!isAuthModalOpen) return null;

  async function handleSubmit(e) {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    try {
      if (mode === 'login') {
        await login({ email, password });
      } else {
        await register({ name, email, password });
      }
    } catch (err) {
      setErrorMsg(err.message || 'Authentication failed. Please try again.');
    }
  }

  async function handleDemoAdmin() {
    setErrorMsg('');
    try {
      await demoAdminLogin();
    } catch (err) {
      setErrorMsg(err.message || 'Super Admin demo login failed.');
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md select-none animate-in fade-in duration-200">
      <div className="bg-[#171717] border border-[#303030] rounded-3xl w-full max-w-md shadow-2xl overflow-hidden relative">
        {/* Close Button */}
        <button
          onClick={() => setIsAuthModalOpen(false)}
          className="absolute top-4 right-4 p-2 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors z-10"
          title="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="p-6 pb-4 border-b border-[#303030]/60 text-center relative bg-gradient-to-b from-[#212121] to-[#171717]">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto mb-3 shadow-lg shadow-emerald-500/5">
            <Sparkles className="w-6 h-6 text-emerald-400" />
          </div>
          <h2 className="text-xl font-bold tracking-tight text-white">
            {mode === 'login' ? 'Welcome back to NamoGPT' : 'Create your NamoGPT account'}
          </h2>
          <p className="text-xs text-zinc-400 mt-1">
            Access multi-model AI, chat history synchronization, and admin telemetry.
          </p>
        </div>

        {/* Quick Super Admin 1-Click Banner */}
        <div className="px-6 pt-4">
          <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Crown className="w-4 h-4 text-amber-400 shrink-0" />
                <span className="text-xs font-semibold text-amber-300">
                  Super Admin Credentials (Demo)
                </span>
              </div>
              <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-semibold">
                Pre-configured
              </span>
            </div>
            <p className="text-[11px] text-zinc-300 leading-relaxed">
              Use default super admin credentials to inspect all configured <code className="text-amber-300 font-mono text-[10px]">.env</code> keys and models.
            </p>
            <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400 bg-black/40 px-3 py-1.5 rounded-lg border border-zinc-800">
              <span className="truncate">{superAdminInfo.email}</span>
              <span className="text-zinc-500 font-sans">•</span>
              <span className="truncate font-sans font-medium text-zinc-300">{superAdminInfo.password}</span>
            </div>
            <button
              type="button"
              onClick={handleDemoAdmin}
              disabled={isLoading}
              className="w-full flex items-center justify-center space-x-2 py-2 px-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-semibold text-xs transition-all shadow-md active:scale-95"
            >
              <Crown className="w-3.5 h-3.5 fill-current" />
              <span>{isLoading ? 'Signing in...' : '1-Click Login as Super Admin'}</span>
            </button>
          </div>
        </div>

        {/* Auth Mode Toggle Tabs */}
        <div className="flex items-center px-6 pt-4">
          <div className="w-full grid grid-cols-2 p-1 bg-[#212121] rounded-xl border border-zinc-800">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setErrorMsg('');
              }}
              className={`py-1.5 text-xs font-semibold rounded-lg transition-all ${
                mode === 'login'
                  ? 'bg-zinc-800 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setErrorMsg('');
              }}
              className={`py-1.5 text-xs font-semibold rounded-lg transition-all ${
                mode === 'register'
                  ? 'bg-zinc-800 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Create Account
            </button>
          </div>
        </div>

        {/* Error message */}
        {errorMsg && (
          <div className="mx-6 mt-3 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 pt-3 space-y-3.5">
          {mode === 'register' && (
            <div className="space-y-1">
              <label className="text-xs font-medium text-zinc-300">Full Name</label>
              <div className="relative">
                <User className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  placeholder="e.g. Alex Turing"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-[#212121] text-xs text-white placeholder-zinc-500 pl-9 pr-3 py-2.5 rounded-xl border border-[#303030] focus:border-emerald-500 outline-none transition-colors"
                />
              </div>
            </div>
          )}

          <div className="space-y-1">
            <label className="text-xs font-medium text-zinc-300">Email Address</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-[#212121] text-xs text-white placeholder-zinc-500 pl-9 pr-3 py-2.5 rounded-xl border border-[#303030] focus:border-emerald-500 outline-none transition-colors"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-zinc-300">Password</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                required
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-[#212121] text-xs text-white placeholder-zinc-500 pl-9 pr-3 py-2.5 rounded-xl border border-[#303030] focus:border-emerald-500 outline-none transition-colors"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full flex items-center justify-center space-x-2 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition-all shadow-lg shadow-emerald-950/40 mt-2 active:scale-95"
          >
            <span>{isLoading ? 'Processing...' : mode === 'login' ? 'Sign In' : 'Create Account'}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>

          {/* Guest fallback option */}
          <div className="text-center pt-2">
            <button
              type="button"
              onClick={() => setIsAuthModalOpen(false)}
              className="text-xs text-zinc-400 hover:text-white transition-colors underline underline-offset-4"
            >
              Continue as Guest (No account needed)
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
