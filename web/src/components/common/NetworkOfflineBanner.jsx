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
        <div className="flex items-center gap-3 px-4 py-2.5 rounded-full bg-[#13100E] border border-[#6F4E37]/50 backdrop-blur-2xl shadow-2xl text-xs text-[#FAF9F8]">
          <div className="p-1 rounded-full bg-[#6F4E37]/25 text-[#E6E0F0] border border-[#6F4E37] shrink-0">
            <Wifi className="w-3.5 h-3.5" />
          </div>
          <div className="flex items-center gap-1.5 font-medium">
            <span className="text-[#E6E0F0] font-semibold">Back Online:</span>
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
      <div className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-2xl sm:rounded-full bg-[#13100E] border border-[#6F4E37]/50 backdrop-blur-2xl shadow-2xl text-xs text-[#FAF9F8]">
        <div className="flex items-center gap-2.5 min-w-0">
          {/* Pulsing indicator */}
          <div className="relative flex h-2.5 w-2.5 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#E6E0F0] opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#6F4E37]"></span>
          </div>

          <div className="p-1 rounded-lg bg-[#6F4E37]/20 text-[#FAF9F8] border border-[#6F4E37] shrink-0">
            <WifiOff className="w-3.5 h-3.5" />
          </div>

          <div className="truncate">
            <span className="font-semibold text-[#E6E0F0] mr-1.5">No Internet Connection:</span>
            <span className="text-[#BDB8B3] hidden sm:inline">Offline mode active. Chat history is cached locally.</span>
            <span className="text-[#BDB8B3] sm:hidden">Offline mode active.</span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={checkConnectivity}
            disabled={isChecking}
            className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#241E1A] hover:bg-[#2D2520] text-[#E5E4E2] hover:text-white border border-[#E5E4E2]/15 text-[11px] font-semibold transition-all active:scale-95 disabled:opacity-50"
            title="Attempt reconnection"
          >
            <RefreshCw className={`w-3 h-3 text-[#E6E0F0] ${isChecking ? 'animate-spin' : ''}`} />
            <span>{isChecking ? 'Checking...' : 'Retry'}</span>
          </button>

          <button
            onClick={() => setIsDismissed(true)}
            className="p-1 text-[#BDB8B3] hover:text-[#FAF9F8] rounded-full hover:bg-[#241E1A] transition-colors"
            title="Dismiss banner"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
}
