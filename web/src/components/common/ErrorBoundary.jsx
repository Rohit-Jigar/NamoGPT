import React, { Component } from 'react';
import { ShieldAlert, RotateCcw, Trash2, ChevronDown, ChevronRight, Copy, Check, Sparkles } from 'lucide-react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
      copied: false
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[NamoGPT ErrorBoundary] Caught unhandled render exception:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReload = () => {
    window.location.reload();
  };

  handleClearCache = () => {
    if (window.confirm('Clear local cache and restart? Your chat history will be reset to resolve corrupted state.')) {
      try {
        // Clear all NamoGPT stored keys
        const keysToRemove = [
          'namogpt_chats_v1',
          'namogpt_settings_v1',
          'namogpt_active_persona_v1',
          'namogpt_memory_v1'
        ];
        keysToRemove.forEach((k) => localStorage.removeItem(k));
        sessionStorage.clear();
      } catch (e) {
        console.warn('Failed clearing cache:', e);
      }
      window.location.reload();
    }
  };

  handleResetActiveChat = () => {
    try {
      // Keep other chats, but clear active chat if it has a broken markdown / token entity
      const raw = localStorage.getItem('namogpt_chats_v1');
      if (raw) {
        const chats = JSON.parse(raw);
        if (Array.isArray(chats) && chats.length > 0) {
          // Keep chats but remove any corrupted last message in the first chat
          const updated = chats.map((c, i) => {
            if (i === 0 && c.messages && c.messages.length > 0) {
              return { ...c, messages: c.messages.slice(0, -1) };
            }
            return c;
          });
          localStorage.setItem('namogpt_chats_v1', JSON.stringify(updated));
        }
      }
    } catch {}
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.reload();
  };

  handleCopyDetails = () => {
    const errorDetails = `NamoGPT Error Diagnostic:\nError: ${this.state.error?.toString()}\n\nComponent Stack:\n${this.state.errorInfo?.componentStack || 'No component stack available'}`;
    navigator.clipboard.writeText(errorDetails);
    this.setState({ copied: true });
    setTimeout(() => this.setState({ copied: false }), 2000);
  };

  render() {
    if (this.state.hasError) {
      const { error, errorInfo, showDetails, copied } = this.state;

      return (
        <div className="min-h-screen w-screen bg-[#09090b] text-zinc-100 flex items-center justify-center p-4 relative overflow-hidden select-none">
          {/* Subtle Ambient Radial Glow */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] bg-rose-500/10 rounded-full blur-[120px] pointer-events-none" />
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[350px] h-[350px] bg-amber-500/5 rounded-full blur-[90px] pointer-events-none" />

          {/* Cognitive Obsidian Card */}
          <div className="relative z-10 max-w-xl w-full rounded-3xl bg-zinc-950/85 border border-zinc-800/80 backdrop-blur-2xl shadow-2xl p-6 sm:p-8 space-y-6">
            {/* Header Icon & Brand */}
            <div className="flex items-center gap-3.5">
              <div className="p-3 rounded-2xl bg-rose-500/15 text-rose-400 border border-rose-500/30 shadow-lg shadow-rose-500/10 shrink-0">
                <ShieldAlert className="w-7 h-7" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold tracking-wider uppercase text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/20">
                    Resilience Guard
                  </span>
                  <span className="text-xs text-zinc-300 font-medium">NamoGPT Core</span>
                </div>
                <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight mt-1">
                  Application Exception Recovered
                </h1>
              </div>
            </div>

            {/* Explanation */}
            <p className="text-sm text-zinc-300 leading-relaxed">
              An unexpected user interface exception was caught by NamoGPT's system error boundary. Your session has been safely paused to prevent further data loss.
            </p>

            {/* Primary Action Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <button
                onClick={this.handleReload}
                className="flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-sm transition-all shadow-lg shadow-emerald-500/20 active:scale-95 hover:scale-[1.02]"
              >
                <RotateCcw className="w-4 h-4 text-black" />
                <span>Reload Session</span>
              </button>

              <button
                onClick={this.handleClearCache}
                className="flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-zinc-900 hover:bg-zinc-800 text-rose-300 hover:text-rose-200 border border-rose-500/30 hover:border-rose-500/50 font-semibold text-sm transition-all active:scale-95"
              >
                <Trash2 className="w-4 h-4 text-rose-400" />
                <span>Clear Local Cache</span>
              </button>
            </div>

            {/* Safe Reset Single Chat */}
            <div className="text-center pt-1">
              <button
                onClick={this.handleResetActiveChat}
                className="text-xs text-zinc-400 hover:text-zinc-200 underline transition-colors"
              >
                Reset active conversation turn only (keep other chats)
              </button>
            </div>

            {/* Technical Diagnostics Collapsible */}
            <div className="pt-2 border-t border-zinc-800/80">
              <button
                onClick={() => this.setState({ showDetails: !showDetails })}
                className="flex items-center justify-between w-full text-xs text-zinc-300 hover:text-zinc-200 py-1 transition-colors"
              >
                <span className="font-medium flex items-center gap-1.5">
                  {showDetails ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                  Technical Diagnostic Details
                </span>
                <span className="text-[11px] font-mono text-zinc-400">{error ? error.name : 'Exception'}</span>
              </button>

              {showDetails && (
                <div className="mt-3 space-y-2 animate-in fade-in duration-200">
                  <div className="relative rounded-2xl bg-zinc-900/90 border border-zinc-800 p-3.5 font-mono text-xs text-rose-300 max-h-52 overflow-y-auto leading-relaxed">
                    <p className="font-semibold text-rose-400">{error?.toString()}</p>
                    {errorInfo?.componentStack && (
                      <pre className="mt-2 text-[11px] text-zinc-400 whitespace-pre-wrap font-mono">
                        {errorInfo.componentStack}
                      </pre>
                    )}
                  </div>
                  <div className="flex justify-end">
                    <button
                      onClick={this.handleCopyDetails}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium transition-colors"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copied ? 'Copied to Clipboard' : 'Copy Error Details'}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
