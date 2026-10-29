import React, { useState, useEffect } from 'react';
import { useChat } from '../../context/ChatContext';
import {
  AlertTriangle,
  Clock,
  Zap,
  Key,
  RotateCcw,
  X,
  ShieldAlert
} from 'lucide-react';

export default function RateLimitNotice() {
  const {
    rateLimitInfo,
    dismissRateLimit,
    setSelectedModel,
    setIsSettingsOpen,
    regenerateMessage,
    currentChat
  } = useChat();

  const [countdown, setCountdown] = useState(35);

  useEffect(() => {
    if (!rateLimitInfo || !rateLimitInfo.active) return;

    const initialDuration = rateLimitInfo.resetSeconds || 35;
    setCountdown(initialDuration);

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [rateLimitInfo]);

  if (!rateLimitInfo || !rateLimitInfo.active) {
    return null;
  }

  const failoverModelName = rateLimitInfo.failoverModel || 'Groq Llama 3.3';

  function handleAutoFailover() {
    setSelectedModel('groq');
    dismissRateLimit();
    // If the last message was an error, retry with Groq immediately
    if (currentChat && currentChat.messages && currentChat.messages.length > 0) {
      const lastIndex = currentChat.messages.length - 1;
      if (currentChat.messages[lastIndex]?.role === 'assistant') {
        regenerateMessage(lastIndex);
      }
    }
  }

  function handleOpenSettings() {
    setIsSettingsOpen(true);
  }

  return (
    <aside
      aria-label="API rate limit warning"
      className="max-w-3xl mx-auto w-full px-3 mb-2 animate-in fade-in slide-in-from-bottom-2 duration-300 select-none z-30"
    >
      <div className="relative overflow-hidden rounded-2xl bg-[#13100E] border border-[#6F4E37]/50 backdrop-blur-2xl shadow-2xl p-4">
        {/* Top Header Row */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#6F4E37]/25 text-[#E6E0F0] border border-[#6F4E37] shrink-0">
              <ShieldAlert className="w-4 h-4 text-[#E6E0F0]" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="text-xs font-semibold text-[#FAF9F8] tracking-tight">
                  Provider Rate Limit Reached (HTTP 429)
                </h4>
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#241E1A] border border-[#E5E4E2]/20 text-[#E5E4E2] font-mono text-[11px] font-semibold">
                  <Clock className="w-3 h-3 animate-spin text-[#E6E0F0]" style={{ animationDuration: '4s' }} />
                  <span>
                    {countdown > 0
                      ? `Rate limit active: resets in ${countdown}s`
                      : 'Rate limit reset window cleared'}
                  </span>
                </div>
              </div>
              <p className="text-[12px] text-[#BDB8B3] mt-1 leading-relaxed">
                The current upstream AI cluster has exceeded its tokens-per-minute quota. Continuous failover protection is engaged.
              </p>
            </div>
          </div>

          <button
            onClick={dismissRateLimit}
            className="p-1 text-[#BDB8B3] hover:text-[#FAF9F8] rounded-lg hover:bg-[#241E1A] transition-colors shrink-0"
            title="Dismiss notice"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Failover Badge & Action Buttons Row */}
        <div className="mt-3.5 pt-3 border-t border-[#E5E4E2]/10 flex flex-wrap items-center justify-between gap-2.5">
          {/* Enterprise Dynamic Failover Badge */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#241E1A] border border-[#E5E4E2]/15 text-[#E6E0F0] text-xs font-medium shadow-sm">
            <Zap className="w-3.5 h-3.5 text-[#E6E0F0]" />
            <span>Switched to {failoverModelName} for zero downtime</span>
          </div>

          {/* Action CTAs */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleAutoFailover}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#6F4E37] hover:bg-[#8C6549] text-[#FAF9F8] text-xs font-semibold transition-all shadow-md active:scale-95 border border-[#6F4E37]"
            >
              <RotateCcw className="w-3 h-3 text-[#FAF9F8]" />
              <span>Retry with {failoverModelName}</span>
            </button>

            <button
              onClick={handleOpenSettings}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#241E1A] hover:bg-[#2D2520] text-[#E5E4E2] hover:text-white border border-[#E5E4E2]/15 text-xs font-medium transition-colors active:scale-95"
            >
              <Key className="w-3 h-3 text-[#E6E0F0]" />
              <span>Enter Secondary Key in Settings</span>
            </button>
          </div>
        </div>

        {/* Ambient progress line */}
        <div className="absolute bottom-0 left-0 h-0.5 bg-[#6F4E37]/30 w-full overflow-hidden">
          <div
            className="h-full bg-[#AF8E73] transition-all duration-1000 ease-linear"
            style={{ width: `${Math.max(0, Math.min(100, (countdown / 35) * 100))}%` }}
          />
        </div>
      </div>
    </aside>
  );
}
