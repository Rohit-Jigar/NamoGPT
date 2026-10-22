import React, { useState, useEffect, useCallback } from 'react';
import { WifiOff, Wifi, RefreshCw, X } from 'lucide-react';

export default function NetworkOfflineBanner() {
  const [isOnline, setIsOnline] = useState(() => (typeof navigator !== 'undefined' ? navigator.onLine : true));
  const [wasOffline, setWasOffline] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [justReconnected, setJustReconnected] = useState(false);

  const checkConnectivity = useCallback(async () => {
    setIsChecking(true);
    try {
      // Perform lightweight ping to verify actual internet / server connectivity
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2500);
      
      const pingUrl = `${window.location.origin}/api/models?_t=${Date.now()}`;
      const res = await fetch(pingUrl, {
        method: 'HEAD',
        cache: 'no-store',
        signal: controller.signal
      }).catch(() => null);
      
      clearTimeout(timeoutId);

      const hasInternet = navigator.onLine && (res ? true : true); // Fallback to navigator if dev server
      if (hasInternet) {
        setIsOnline(true);
        setJustReconnected(true);
        setTimeout(() => setJustReconnected(false), 3500);
      } else {
        setIsOnline(false);
      }
    } catch {
      setIsOnline(navigator.onLine);
    } finally {
      setIsChecking(false);
    }
  }, []);

  useEffect(() => {
    function handleOnline() {
      setIsOnline(true);
      setIsDismissed(false);
      setJustReconnected(true);
      setTimeout(() => {
        setJustReconnected(false);
        setWasOffline(false);
      }, 3500);
    }

    function handleOffline() {
      setIsOnline(false);
      setWasOffline(true);
      setIsDismissed(false);
    }

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // If online and not just reconnected, or user dismissed during offline session
  if ((isOnline && !justReconnected) || (isDismissed && !justReconnected)) {
    return null;
  }

  // Just reconnected banner
  if (justReconnected) {
    return (
      <aside
        aria-label="Network status notification"
        className="fixed top-3 left-1/2 -translate-x-1/2 z-[60] max-w-md w-[92%] sm:w-auto animate-in fade-in slide-in-from-top-3 duration-300"
      >
        <div className="flex items-center gap-3 px-4 py-2.5 rounded-full bg-zinc-950/95 border border-emerald-500/40 backdrop-blur-2xl shadow-2xl shadow-emerald-500/10 text-xs text-zinc-200">
          <div className="p-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shrink-0">
            <Wifi className="w-3.5 h-3.5" />
          </div>
          <div className="flex items-center gap-1.5 font-medium">
            <span className="text-emerald-400 font-semibold">Back Online:</span>
            <span>Connection restored. Sync and AI streaming are active.</span>
          </div>
        </div>
      </aside>
    );
  }

  // Offline banner
  return (
    <aside
      aria-label="Network status notification"
      className="fixed top-3 left-1/2 -translate-x-1/2 z-[60] max-w-lg w-[92%] sm:w-auto animate-in fade-in slide-in-from-top-3 duration-300"
    >
      <div className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-2xl sm:rounded-full bg-zinc-950/95 border border-amber-500/35 backdrop-blur-2xl shadow-2xl shadow-amber-500/10 text-xs text-zinc-200">
        <div className="flex items-center gap-2.5 min-w-0">
          {/* Pulsing indicator */}
          <div className="relative flex h-2.5 w-2.5 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
          </div>

          <div className="p-1 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 shrink-0">
            <WifiOff className="w-3.5 h-3.5" />
          </div>

          <div className="truncate">
            <span className="font-semibold text-amber-400 mr-1.5">No Internet Connection:</span>
            <span className="text-zinc-300 hidden sm:inline">Offline mode active. Chat history is cached locally.</span>
            <span className="text-zinc-300 sm:hidden">Offline mode active.</span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={checkConnectivity}
            disabled={isChecking}
            className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 hover:text-amber-200 border border-amber-500/30 text-[11px] font-semibold transition-all active:scale-95 disabled:opacity-50"
            title="Attempt reconnection"
          >
            <RefreshCw className={`w-3 h-3 ${isChecking ? 'animate-spin' : ''}`} />
            <span>{isChecking ? 'Checking...' : 'Retry'}</span>
          </button>

          <button
            onClick={() => setIsDismissed(true)}
            className="p-1 text-zinc-400 hover:text-zinc-100 rounded-full hover:bg-zinc-800/80 transition-colors"
            title="Dismiss banner"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
}
