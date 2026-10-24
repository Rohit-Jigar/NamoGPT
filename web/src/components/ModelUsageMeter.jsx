import React, { useState, useEffect } from 'react';
import { useChat } from '../context/ChatContext';
import { useAuth } from '../context/AuthContext';
import { resetUsageAPI } from '../services/api';
import confetti from 'canvas-confetti';
import {
  Zap,
  Gauge,
  Activity,
  TrendingUp,
  Sparkles,
  Clock,
  RotateCcw,
  RefreshCw,
  X,
  Check,
  AlertCircle,
  ArrowUpRight,
  ArrowDownLeft,
  Cpu,
  Layers,
  ShieldCheck,
  DollarSign,
  CheckCircle2,
  Trash2,
  ExternalLink,
  Flame,
  Info
} from 'lucide-react';

/**
 * Helper to format token numbers (e.g. 1,420 -> "1.4k", 120,500 -> "120.5k")
 */
function formatNumber(num) {
  if (!num || isNaN(num)) return '0';
  if (num >= 1000000) return (num / 1000000).toFixed(2) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'k';
  return num.toLocaleString();
}

/**
 * Speed Gauge Arc SVG Visualizer
 */
function SpeedometerGauge({ currentSpeed, isGenerating, lastModel }) {
  const maxSpeed = 400; // max scale tokens/sec
  const clampedSpeed = Math.min(Math.max(Number(currentSpeed) || 0, 0), maxSpeed);
  const percentage = clampedSpeed / maxSpeed;

  // Arc calculation: 220 degree arc from 160 deg to 380 deg
  const radius = 64;
  const strokeWidth = 10;
  const circumference = 2 * Math.PI * radius;
  const arcLength = circumference * (220 / 360);
  const strokeDashoffset = arcLength - (arcLength * percentage);

  // Speed level labeling
  let speedLabel = 'Standby';
  let speedColor = 'text-zinc-400';
  let strokeGradient = 'url(#speedGradEmerald)';

  if (clampedSpeed > 250) {
    speedLabel = 'Groq Ultra LPU (Blazing)';
    speedColor = 'text-amber-400';
    strokeGradient = 'url(#speedGradAmber)';
  } else if (clampedSpeed > 100) {
    speedLabel = 'High Velocity Inference';
    speedColor = 'text-emerald-400';
    strokeGradient = 'url(#speedGradEmerald)';
  } else if (clampedSpeed > 0) {
    speedLabel = 'Standard Streaming';
    speedColor = 'text-cyan-400';
    strokeGradient = 'url(#speedGradCyan)';
  }

  return (
    <div className="relative flex flex-col items-center justify-center p-4 rounded-2xl bg-gradient-to-b from-zinc-900/90 to-zinc-950/90 border border-zinc-800/80 shadow-inner">
      <div className="relative w-40 h-32 flex items-center justify-center">
        <svg className="w-full h-full transform -rotate-[110deg] overflow-visible" viewBox="0 0 160 160">
          <defs>
            <linearGradient id="speedGradEmerald" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#10b981" />
              <stop offset="100%" stopColor="#06b6d4" />
            </linearGradient>
            <linearGradient id="speedGradAmber" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#f59e0b" />
              <stop offset="100%" stopColor="#ef4444" />
            </linearGradient>
            <linearGradient id="speedGradCyan" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#06b6d4" />
              <stop offset="100%" stopColor="#3b82f6" />
            </linearGradient>
          </defs>

          {/* Background Arc Track */}
          <circle
            cx="80"
            cy="80"
            r={radius}
            fill="none"
            stroke="#27272a"
            strokeWidth={strokeWidth}
            strokeDasharray={arcLength}
            strokeDashoffset="0"
            strokeLinecap="round"
          />

          {/* Active Animated Value Arc */}
          <circle
            cx="80"
            cy="80"
            r={radius}
            fill="none"
            stroke={strokeGradient}
            strokeWidth={strokeWidth}
            strokeDasharray={arcLength}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className="transition-all duration-500 ease-out"
          />
        </svg>

        {/* Center Display Value */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pt-2 select-none">
          <div className="flex items-baseline space-x-1">
            <span className="text-3xl font-extrabold tracking-tight text-white font-mono">
              {clampedSpeed > 0 ? Math.round(clampedSpeed) : 0}
            </span>
            <span className="text-[11px] font-semibold text-zinc-400 font-mono">t/s</span>
          </div>

          <div className="flex items-center space-x-1 mt-0.5">
            {isGenerating ? (
              <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-400 uppercase tracking-wider animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                Live Stream
              </span>
            ) : (
              <span className="text-[10px] font-medium text-zinc-400">
                {clampedSpeed > 0 ? 'Last Speed' : 'Idle'}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Speedometer Footer Info */}
      <div className="mt-1 flex items-center space-x-1.5 px-3 py-1 rounded-full bg-zinc-800/60 border border-zinc-700/50 text-xs">
        <Zap className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
        <span className={`font-semibold text-[11px] ${speedColor}`}>
          {speedLabel}
        </span>
      </div>
    </div>
  );
}

/**
 * Production-Grade Model Usage & Telemetry Meter Console
 */
export default function ModelUsageMeter({ isOpen, onClose }) {
  const {
    usageStats,
    fetchUsageStats,
    generationStats,
    isGenerating,
    sessionTokens,
    setUsageStats
  } = useChat();

  const { token } = useAuth();

  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'models' | 'quotas'
  const [tokenView, setTokenView] = useState('lifetime'); // 'lifetime' | 'session'
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [copiedSavings, setCopiedSavings] = useState(false);

  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Active or last speed
  const liveSpeed = isGenerating
    ? Number(generationStats?.tps || 0)
    : Number(generationStats?.tps || usageStats?.lastSpeed || 0);

  // Calculate Tokens display based on toggle
  const displayPrompt = tokenView === 'session'
    ? (sessionTokens?.promptTokens || 0)
    : (usageStats?.promptTokens || 0);

  const displayCompletion = tokenView === 'session'
    ? (sessionTokens?.completionTokens || 0)
    : (usageStats?.completionTokens || 0);

  const displayTotal = tokenView === 'session'
    ? (sessionTokens?.totalTokens || 0)
    : (usageStats?.totalTokens || 0);

  const displayRequests = tokenView === 'session'
    ? (sessionTokens?.totalTokens > 0 ? 1 : 0)
    : (usageStats?.totalRequests || 0);

  // Commercial Cost Savings Calculation:
  // OpenAI GPT-4o: $2.50 / 1M prompt, $10.00 / 1M completion
  // Claude 3.5 Sonnet: $3.00 / 1M prompt, $15.00 / 1M completion
  // Average Saved: ~$2.75 / 1M prompt + ~$12.50 / 1M completion
  const calculatedSavings = (
    ((usageStats?.promptTokens || 0) * 0.00000275) +
    ((usageStats?.completionTokens || 0) * 0.0000125)
  );
  const savingsFormatted = calculatedSavings >= 0.01
    ? calculatedSavings.toFixed(2)
    : calculatedSavings.toFixed(4);

  // Refresh handler
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await fetchUsageStats();
    } finally {
      setTimeout(() => setIsRefreshing(false), 400);
    }
  };

  // Reset counters handler
  const handleReset = async () => {
    setIsResetting(true);
    try {
      const resetData = await resetUsageAPI(token);
      if (resetData) {
        setUsageStats(resetData);
      }
      setResetConfirmOpen(false);
    } catch (err) {
      console.warn('Failed to reset usage:', err);
    } finally {
      setIsResetting(false);
    }
  };

  // Trigger confetti celebration on savings
  const handleCelebrate = () => {
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.6 }
    });
    setCopiedSavings(true);
    setTimeout(() => setCopiedSavings(false), 2000);
  };

  // Model breakdown data
  const modelsData = usageStats?.models || {};
  const modelEntries = Object.entries(modelsData).map(([id, stats]) => {
    const total = stats.totalTokens || (stats.promptTokens + stats.completionTokens) || 0;
    return {
      id,
      name: stats.name || id,
      totalTokens: total,
      promptTokens: stats.promptTokens || 0,
      completionTokens: stats.completionTokens || 0,
      requests: stats.requests || 0,
      lastTps: stats.lastTps || 0
    };
  }).sort((a, b) => b.totalTokens - a.totalTokens);

  const grandTotalTokens = modelEntries.reduce((acc, m) => acc + m.totalTokens, 0) || 1;

  // Quotas with progress percentages and color-coding rules:
  // Emerald (<60%), Amber (60-85%), Rose (>85%)
  const quotaItems = [
    {
      id: 'gemini',
      name: 'Google Gemini 2.5 Flash',
      provider: 'Google AI Studio',
      limit: 15,
      unit: 'RPM',
      window: '60s rolling',
      used: usageStats?.quotas?.gemini?.used || (modelEntries.find(m => m.id === 'gemini')?.requests || 0) % 15,
      badge: 'Free Tier',
      description: '15 Requests / min rate limit on Google Cloud'
    },
    {
      id: 'groq',
      name: 'Groq Cloud LPU (Llama 3.3)',
      provider: 'Groq LPUs',
      limit: 14400,
      unit: 'RPD',
      window: '24h daily',
      used: usageStats?.quotas?.groq?.used || (modelEntries.find(m => m.id === 'groq')?.requests || 0),
      badge: 'Blazing Fast',
      description: '14,400 Requests / day & 30 RPM maximum'
    },
    {
      id: 'openrouter',
      name: 'OpenRouter Free Tier',
      provider: 'OpenRouter AI',
      limit: 200,
      unit: 'RPD',
      window: '24h daily',
      used: usageStats?.quotas?.openrouter?.used || (modelEntries.find(m => m.id === 'openrouter')?.requests || 0),
      badge: 'Open Weights',
      description: '200 Requests / day free community quota'
    }
  ];

  const getQuotaColorProps = (percentage) => {
    if (percentage > 85) {
      return {
        bar: 'bg-rose-500',
        text: 'text-rose-400',
        badge: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
        glow: 'shadow-rose-500/20'
      };
    }
    if (percentage >= 60) {
      return {
        bar: 'bg-amber-500',
        text: 'text-amber-400',
        badge: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
        glow: 'shadow-amber-500/20'
      };
    }
    return {
      bar: 'bg-emerald-500',
      text: 'text-emerald-400',
      badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
      glow: 'shadow-emerald-500/20'
    };
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-[#13100E] border border-zinc-800/90 rounded-3xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden text-zinc-100">
        
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-zinc-800/80 flex items-center justify-between bg-zinc-900/50">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#6F4E37] to-[#8C6549] text-black flex items-center justify-center shadow-md shadow-emerald-500/20">
              <Gauge className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-tight">Model Usage & Telemetry Meter</h2>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  Enterprise Mesh
                </span>
              </div>
              <p className="text-xs text-zinc-400">
                Real-time token telemetry, generation speedometer, and quota tracking
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-1.5">
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800/80 transition-all border border-transparent hover:border-zinc-700/60"
              title="Refresh Telemetry Stats"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-emerald-400' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800/80 transition-all border border-transparent hover:border-zinc-700/60"
              title="Close Dialog"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="px-5 pt-3 pb-0 border-b border-zinc-800/60 flex items-center justify-between bg-zinc-900/20">
          <div className="flex space-x-2">
            {[
              { id: 'overview', label: 'Overview & Speed', icon: Activity },
              { id: 'models', label: 'Model Breakdown', icon: Layers },
              { id: 'quotas', label: 'Free Quotas & Limits', icon: ShieldCheck }
            ].map((tab) => {
              const Icon = tab.icon;
              const isSelected = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center space-x-1.5 px-3 py-2 text-xs font-semibold rounded-t-xl transition-all border-b-2 ${
                    isSelected
                      ? 'border-[#6F4E37] text-[#E6E0F0] bg-zinc-800/50'
                      : 'border-transparent text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/20'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Token View Toggle: Lifetime vs Session */}
          <div className="flex items-center space-x-1 bg-zinc-900/90 p-1 rounded-xl border border-zinc-800 text-[11px] font-medium">
            <button
              onClick={() => setTokenView('lifetime')}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                tokenView === 'lifetime'
                  ? 'bg-emerald-500 text-black font-bold shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Lifetime
            </button>
            <button
              onClick={() => setTokenView('session')}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                tokenView === 'session'
                  ? 'bg-emerald-500 text-black font-bold shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Session
            </button>
          </div>
        </div>

        {/* Scrollable Modal Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 custom-scrollbar">

          {/* TAB 1: OVERVIEW & SPEED */}
          {activeTab === 'overview' && (
            <>
              {/* Top Hero: Speedometer & Commercial Cost Savings */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* 1. Live Speedometer */}
                <div className="flex flex-col justify-between">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-semibold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5 text-amber-400" />
                      Live Generation Speed
                    </span>
                    <span className="text-[11px] text-zinc-400 font-mono">
                      {liveSpeed > 0 ? `${liveSpeed} t/s` : 'Standby'}
                    </span>
                  </div>
                  <SpeedometerGauge
                    currentSpeed={liveSpeed}
                    isGenerating={isGenerating}
                    lastModel={usageStats?.lastModel}
                  />
                </div>

                {/* 2. Commercial Cost Savings Calculator */}
                <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-950/40 via-zinc-900/80 to-teal-950/40 border border-emerald-500/30 flex flex-col justify-between relative overflow-hidden group">
                  <div className="absolute -top-12 -right-12 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl group-hover:bg-emerald-500/20 transition-all pointer-events-none" />

                  <div>
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold uppercase tracking-wider">
                        <Sparkles className="w-3 h-3 text-emerald-400" />
                        Commercial Cost Savings
                      </span>
                      <span className="text-[11px] font-mono text-zinc-400">100% Free AI</span>
                    </div>

                    <div className="mt-3">
                      <div className="text-3xl sm:text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 font-mono">
                        ~${savingsFormatted}
                      </div>
                      <p className="text-xs text-zinc-300 mt-1 leading-relaxed">
                        You saved <strong className="text-emerald-400">~${savingsFormatted}</strong> vs commercial API rates on <strong>OpenAI GPT-4o</strong> ($2.50/$10) and <strong>Claude 3.5 Sonnet</strong> ($3/$15)!
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-emerald-500/20 flex items-center justify-between text-xs">
                    <span className="text-zinc-400 text-[11px]">
                      NamoGPT Cost: <strong className="text-emerald-400">$0.00 (Zero)</strong>
                    </span>
                    <button
                      onClick={handleCelebrate}
                      className="px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 font-semibold text-[11px] border border-emerald-500/30 transition-all active:scale-95 flex items-center gap-1"
                    >
                      <Sparkles className="w-3 h-3" />
                      <span>{copiedSavings ? 'Celebrated! 🎉' : 'Celebrate'}</span>
                    </button>
                  </div>
                </div>

              </div>

              {/* Token Metrics 4-Card Grid */}
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <h3 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-cyan-400" />
                    {tokenView === 'lifetime' ? 'Lifetime All-Time Token Telemetry' : 'Current Session Token Telemetry'}
                  </h3>
                  <span className="text-[11px] text-zinc-400 font-mono">
                    {displayTotal.toLocaleString()} total
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {/* Prompt Tokens */}
                  <div className="p-3.5 rounded-2xl bg-zinc-900/60 border border-zinc-800 hover:border-zinc-700 transition-all">
                    <div className="flex items-center justify-between text-zinc-400 mb-1.5">
                      <span className="text-xs font-medium">Prompt Input</span>
                      <ArrowDownLeft className="w-3.5 h-3.5 text-blue-400" />
                    </div>
                    <div className="text-xl sm:text-2xl font-bold font-mono text-zinc-100">
                      {formatNumber(displayPrompt)}
                    </div>
                    <div className="text-[10px] text-zinc-400 mt-1 truncate">
                      Context & system prompts
                    </div>
                  </div>

                  {/* Completion Tokens */}
                  <div className="p-3.5 rounded-2xl bg-zinc-900/60 border border-zinc-800 hover:border-zinc-700 transition-all">
                    <div className="flex items-center justify-between text-zinc-400 mb-1.5">
                      <span className="text-xs font-medium">Generated Output</span>
                      <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400" />
                    </div>
                    <div className="text-xl sm:text-2xl font-bold font-mono text-emerald-400">
                      {formatNumber(displayCompletion)}
                    </div>
                    <div className="text-[10px] text-zinc-400 mt-1 truncate">
                      Model completions
                    </div>
                  </div>

                  {/* Total Tokens */}
                  <div className="p-3.5 rounded-2xl bg-zinc-900/60 border border-zinc-800 hover:border-zinc-700 transition-all">
                    <div className="flex items-center justify-between text-zinc-400 mb-1.5">
                      <span className="text-xs font-medium">Total Tokens</span>
                      <Cpu className="w-3.5 h-3.5 text-purple-400" />
                    </div>
                    <div className="text-xl sm:text-2xl font-bold font-mono text-zinc-100">
                      {formatNumber(displayTotal)}
                    </div>
                    <div className="text-[10px] text-zinc-400 mt-1 truncate">
                      Total processed
                    </div>
                  </div>

                  {/* Total Requests */}
                  <div className="p-3.5 rounded-2xl bg-zinc-900/60 border border-zinc-800 hover:border-zinc-700 transition-all">
                    <div className="flex items-center justify-between text-zinc-400 mb-1.5">
                      <span className="text-xs font-medium">Chat Turns</span>
                      <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                    </div>
                    <div className="text-xl sm:text-2xl font-bold font-mono text-zinc-100">
                      {displayRequests}
                    </div>
                    <div className="text-[10px] text-zinc-400 mt-1 truncate">
                      Successful inferences
                    </div>
                  </div>
                </div>
              </div>

              {/* Free Quotas Preview in Overview */}
              <div className="p-4 rounded-2xl bg-zinc-900/50 border border-zinc-800">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-bold text-zinc-200 uppercase tracking-wider">
                      Free Rate Limit Quotas
                    </span>
                  </div>
                  <button
                    onClick={() => setActiveTab('quotas')}
                    className="text-xs text-emerald-400 hover:underline font-medium"
                  >
                    View Details &rarr;
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {quotaItems.map((q) => {
                    const percentage = Math.min(100, Math.round((q.used / q.limit) * 100));
                    const color = getQuotaColorProps(percentage);
                    return (
                      <div key={q.id} className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-800/80">
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="font-semibold text-zinc-200 truncate">{q.name.split('(')[0]}</span>
                          <span className={`font-mono text-[11px] font-bold ${color.text}`}>{percentage}%</span>
                        </div>
                        <div className="w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden my-1.5">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${color.bar}`}
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-zinc-400 font-mono">
                          <span>{q.used} / {q.limit} {q.unit}</span>
                          <span>{q.window}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {/* TAB 2: MODEL BREAKDOWN */}
          {activeTab === 'models' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-emerald-400" />
                  Model Consumption Distribution
                </h3>
                
                {/* Horizontal Segmented Bar */}
                <div className="w-full h-3 rounded-full overflow-hidden flex bg-zinc-800 p-0.5 border border-zinc-700/60 shadow-inner">
                  {modelEntries.map((m, idx) => {
                    const pct = Math.max(1, Math.round((m.totalTokens / grandTotalTokens) * 100));
                    const colors = [
                      'bg-emerald-500',
                      'bg-amber-500',
                      'bg-cyan-500',
                      'bg-purple-500',
                      'bg-rose-500',
                      'bg-indigo-500'
                    ];
                    return (
                      <div
                        key={m.id}
                        title={`${m.name}: ${m.totalTokens} tokens (${pct}%)`}
                        className={`h-full first:rounded-l-full last:rounded-r-full transition-all ${colors[idx % colors.length]}`}
                        style={{ width: `${pct}%` }}
                      />
                    );
                  })}
                </div>
              </div>

              {/* Models List */}
              <div className="space-y-2.5">
                {modelEntries.length === 0 ? (
                  <div className="text-center py-8 text-zinc-400 text-xs">
                    No inference telemetry recorded yet. Send a prompt to start tracking!
                  </div>
                ) : (
                  modelEntries.map((m, idx) => {
                    const pct = Math.round((m.totalTokens / grandTotalTokens) * 100);
                    return (
                      <div
                        key={m.id}
                        className="p-3.5 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 hover:border-zinc-700/80 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2">
                            <span className="text-xs font-bold text-white truncate">{m.name}</span>
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 border border-zinc-700">
                              {pct}% of usage
                            </span>
                            {m.lastTps > 0 && (
                              <span className="text-[10px] font-mono text-amber-400 flex items-center gap-0.5">
                                <Zap className="w-3 h-3" /> {m.lastTps} t/s
                              </span>
                            )}
                          </div>
                          
                          {/* Mini Progress Bar */}
                          <div className="w-full bg-zinc-800/90 h-1.5 rounded-full overflow-hidden mt-2">
                            <div
                              className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>

                        {/* Stats Breakdown Pills */}
                        <div className="flex items-center space-x-3 text-xs font-mono shrink-0">
                          <div className="flex flex-col items-end">
                            <span className="text-zinc-400 text-[10px]">Prompt / Comp</span>
                            <span className="text-zinc-200">
                              {formatNumber(m.promptTokens)} / {formatNumber(m.completionTokens)}
                            </span>
                          </div>
                          <div className="flex flex-col items-end pl-3 border-l border-zinc-800">
                            <span className="text-zinc-400 text-[10px]">Total Tokens</span>
                            <span className="font-bold text-emerald-400">{formatNumber(m.totalTokens)}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* TAB 3: FREE QUOTAS & LIMITS */}
          {activeTab === 'quotas' && (
            <div className="space-y-4">
              <div className="p-3 rounded-xl bg-blue-950/30 border border-blue-500/20 text-xs text-blue-300 flex items-start gap-2.5">
                <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                <p leading-relaxed>
                  NamoGPT routes requests across Google Gemini, Groq Cloud, OpenRouter, and local smart proxies.
                  Progress bars monitor real-time consumption against provider limits with zero surprise paywalls.
                </p>
              </div>

              <div className="space-y-3">
                {quotaItems.map((q) => {
                  const percentage = Math.min(100, Math.round((q.used / q.limit) * 100));
                  const color = getQuotaColorProps(percentage);
                  return (
                    <div
                      key={q.id}
                      className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800 hover:border-zinc-700 transition-all space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center space-x-2">
                            <h4 className="text-sm font-bold text-white">{q.name}</h4>
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${q.badge ? 'bg-zinc-800 text-zinc-300 border-zinc-700' : ''}`}>
                              {q.provider}
                            </span>
                          </div>
                          <p className="text-xs text-zinc-400 mt-0.5">{q.description}</p>
                        </div>

                        <div className="text-right">
                          <span className={`text-sm font-mono font-extrabold ${color.text}`}>
                            {percentage}%
                          </span>
                          <span className="block text-[10px] text-zinc-400 font-mono">
                            {q.limit - q.used} remaining
                          </span>
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div className="w-full bg-zinc-800 h-2.5 rounded-full overflow-hidden p-0.5 border border-zinc-700/50">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${color.bar}`}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>

                      {/* Quota Details Footer */}
                      <div className="flex items-center justify-between text-xs text-zinc-400 pt-1 border-t border-zinc-800/60">
                        <span className="flex items-center gap-1 font-mono text-[11px]">
                          <Clock className="w-3 h-3 text-zinc-500" />
                          Window: {q.window}
                        </span>
                        <span className="font-mono text-[11px]">
                          Current Usage: <strong className="text-zinc-200">{q.used}</strong> / {q.limit} {q.unit}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer with Quick Actions */}
        <div className="px-5 py-3.5 border-t border-zinc-800/80 bg-zinc-900/60 flex items-center justify-between">
          <div>
            {resetConfirmOpen ? (
              <div className="flex items-center space-x-2">
                <span className="text-xs text-rose-400 font-medium">Reset all counters?</span>
                <button
                  onClick={handleReset}
                  disabled={isResetting}
                  className="px-2.5 py-1 rounded-lg bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs shadow-sm transition-all"
                >
                  {isResetting ? 'Resetting...' : 'Yes, Reset'}
                </button>
                <button
                  onClick={() => setResetConfirmOpen(false)}
                  className="px-2 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setResetConfirmOpen(true)}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 text-xs font-medium transition-all border border-transparent hover:border-rose-500/20"
                title="Reset Token & Telemetry Counters"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Reset Counters</span>
              </button>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white font-semibold text-xs transition-all shadow-sm"
            >
              Close
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

/**
 * Compact Header Widget Component: ModelUsageMeterPill
 * Displays live generation speed and session tokens badge in the header bar
 */
export function ModelUsageMeterPill() {
  const {
    isGenerating,
    generationStats,
    sessionTokens,
    usageStats,
    setIsUsageMeterOpen
  } = useChat();

  const liveSpeed = isGenerating
    ? Number(generationStats?.tps || 0)
    : Number(generationStats?.tps || usageStats?.lastSpeed || 0);

  const currentTokens = (sessionTokens?.totalTokens || 0) > 0
    ? sessionTokens.totalTokens
    : (usageStats?.totalTokens || 0);

  return (
    <button
      onClick={() => setIsUsageMeterOpen(true)}
      className="flex items-center space-x-2 px-2.5 py-1 rounded-xl bg-zinc-900/90 hover:bg-zinc-800/90 border border-zinc-800 hover:border-emerald-500/40 text-xs font-mono transition-all shadow-sm group select-none"
      title="Open Model Usage & Telemetry Meter"
    >
      {/* Live Indicator Dot */}
      <span className="relative flex h-2 w-2">
        {isGenerating ? (
          <>
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </>
        ) : (
          <span className="inline-flex rounded-full h-2 w-2 bg-zinc-600 group-hover:bg-emerald-400 transition-colors" />
        )}
      </span>

      {/* Speed / Token Display */}
      {isGenerating ? (
        <span className="text-emerald-400 font-bold flex items-center gap-1 animate-pulse">
          <Zap className="w-3 h-3 fill-current text-emerald-400" />
          <span>{liveSpeed > 0 ? liveSpeed : '~'} t/s</span>
        </span>
      ) : (
        <span className="text-zinc-300 group-hover:text-white font-medium flex items-center gap-1.5">
          <Gauge className="w-3.5 h-3.5 text-zinc-400 group-hover:text-emerald-400 transition-colors" />
          <span className="hidden xs:inline">
            {formatNumber(currentTokens)} tok
          </span>
          {liveSpeed > 0 && (
            <span className="text-zinc-400 text-[10px] hidden sm:inline">
              • {liveSpeed} t/s
            </span>
          )}
        </span>
      )}
    </button>
  );
}
