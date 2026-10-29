import React from 'react';
import { useToast } from '../../context/ToastContext';
import {
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  Info,
  X,
  RotateCcw
} from 'lucide-react';

export default function ToastContainer() {
  const { toasts, removeToast } = useToast();

  if (!toasts || toasts.length === 0) return null;

  return (
    <div
      aria-live="assertive"
      className="fixed bottom-5 right-5 z-[100] flex flex-col gap-2.5 max-w-sm w-full pointer-events-none px-4 sm:px-0"
    >
      {toasts.map((toast) => {
        const isError = toast.type === 'error';
        const isWarning = toast.type === 'warning';
        const isSuccess = toast.type === 'success';

        let borderClass = 'border-[#E6E0F0]/30';
        let iconBg = 'bg-[#E6E0F0]/15 text-[#E6E0F0] border-[#E6E0F0]/25';
        let glowClass = 'shadow-[#E6E0F0]/5';
        let barClass = 'bg-[#E6E0F0]/50';
        let IconComponent = Info;

        if (isError) {
          borderClass = 'border-rose-500/40';
          iconBg = 'bg-rose-500/15 text-rose-400 border-rose-500/30';
          glowClass = 'shadow-rose-500/10';
          barClass = 'bg-rose-500/50';
          IconComponent = AlertOctagon;
        } else if (isWarning) {
          borderClass = 'border-[#AF8E73]/40';
          iconBg = 'bg-[#6F4E37]/20 text-[#FAF9F8] border-[#6F4E37]/40';
          glowClass = 'shadow-[#6F4E37]/10';
          barClass = 'bg-[#AF8E73]/50';
          IconComponent = AlertTriangle;
        } else if (isSuccess) {
          borderClass = 'border-[#6F4E37]/40';
          iconBg = 'bg-[#6F4E37]/25 text-[#E6E0F0] border-[#6F4E37]/50';
          glowClass = 'shadow-[#6F4E37]/10';
          barClass = 'bg-[#6F4E37]/60';
          IconComponent = CheckCircle2;
        }

        return (
          <div
            key={toast.id}
            role="status"
            className={`pointer-events-auto relative overflow-hidden rounded-2xl bg-[#13100E] backdrop-blur-2xl border ${borderClass} shadow-2xl ${glowClass} p-3.5 transition-all duration-300 animate-in fade-in slide-in-from-bottom-3`}
          >
            <div className="flex items-start gap-3">
              {/* Type Badge Icon */}
              <div className={`p-1.5 rounded-xl border shrink-0 ${iconBg}`}>
                <IconComponent className="w-4 h-4" />
              </div>

              {/* Toast Content */}
              <div className="flex-1 min-w-0 pr-1">
                {toast.title && (
                  <h4 className="text-xs font-semibold text-[#FAF9F8] mb-0.5 tracking-tight flex items-center gap-1.5">
                    {toast.title}
                  </h4>
                )}
                <p className="text-[12px] leading-relaxed text-[#BDB8B3] whitespace-pre-wrap break-words">
                  {toast.message}
                </p>

                {/* 1-Click Action Button (e.g. Retry for 504 Gateway Timeout) */}
                {toast.action && (
                  <div className="mt-2.5 pt-2 border-t border-[#E5E4E2]/10 flex items-center justify-start">
                    <button
                      onClick={() => {
                        try {
                          toast.action.onClick();
                        } catch (err) {
                          console.error('Toast action failed:', err);
                        }
                        removeToast(toast.id);
                      }}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#241E1A] hover:bg-[#2D2520] text-[#FAF9F8] text-[11px] font-medium transition-colors shadow-sm border border-[#E5E4E2]/15 active:scale-95"
                    >
                      <RotateCcw className="w-3 h-3 text-[#E6E0F0]" />
                      <span>{toast.action.label || 'Retry'}</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Close Button */}
              {toast.dismissible && (
                <button
                  onClick={() => removeToast(toast.id)}
                  className="p-1 text-[#7A7570] hover:text-[#FAF9F8] rounded-lg hover:bg-[#241E1A] transition-colors shrink-0 -mr-1 -mt-1"
                  aria-label="Dismiss notification"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Subtle duration timer line */}
            {toast.duration > 0 && (
              <div
                className={`absolute bottom-0 left-0 h-0.5 w-full ${barClass}`}
                style={{
                  animation: `shrinkWidth ${toast.duration}ms linear forwards`
                }}
              />
            )}
          </div>
        );
      })}

      <style>{`
        @keyframes shrinkWidth {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>
    </div>
  );
}
