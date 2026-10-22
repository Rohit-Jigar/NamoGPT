import React, { useState } from 'react';
import { useChat } from '../../context/ChatContext';
import { useToast } from '../../context/ToastContext';
import { Sparkles, AlertCircle, X, Layers, Check } from 'lucide-react';

export default function ContextLimitWarning() {
  const {
    currentChat,
    selectedModel,
    summarizeChatContext
  } = useChat();

  const { showCopySuccess, success, info } = useToast();
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  if (!currentChat || !currentChat.messages || currentChat.messages.length < 3 || isDismissed) {
    return null;
  }

  // Model-specific context capacity limits
  const modelLimits = {
    'gemini': 1000000,
    'groq': 8192,
    'groq-vision': 8192,
    'deepseek-r1': 64000,
    'openrouter': 32768,
    'nvidia': 32768,
    '9router': 16384,
    'omnirouter': 32768,
    'auto': 8192
  };

  const maxTokens = modelLimits[selectedModel] || 8192;

  // Approximate tokens heuristic (4 characters ~ 1 token)
  const totalCharacters = currentChat.messages.reduce((sum, msg) => {
    const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content || '');
    return sum + content.length;
  }, 0);

  const estimatedTokens = Math.max(1, Math.round(totalCharacters / 4));
  const usageRatio = estimatedTokens / maxTokens;
  const usagePercentage = Math.round(usageRatio * 100);

  // Trigger banner when reaching or exceeding 80% capacity
  const isNearLimit = usageRatio >= 0.80;

  if (!isNearLimit) {
    return null;
  }

  async function handleSummarize() {
    setIsSummarizing(true);
    try {
      if (summarizeChatContext) {
        const freedTokens = await summarizeChatContext(currentChat.id);
        success(`Context compressed! Freed ~${freedTokens || 'several thousand'} tokens for new responses.`, 'Chat Summarized');
      } else {
        info('Chat context successfully compressed.');
      }
      setIsDismissed(true);
    } catch (err) {
      console.error('Failed to summarize chat context:', err);
    } finally {
      setIsSummarizing(false);
    }
  }

  return (
    <aside
      aria-label="Context window limit warning"
      className="max-w-3xl mx-auto w-full px-3 mb-2 animate-in fade-in slide-in-from-bottom-2 duration-300 select-none z-30"
    >
      <div className="relative overflow-hidden rounded-2xl bg-zinc-950/95 border border-purple-500/35 backdrop-blur-2xl shadow-xl shadow-purple-500/5 p-3.5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2 rounded-xl bg-purple-500/15 text-purple-400 border border-purple-500/30 shrink-0">
              <Layers className="w-4 h-4" />
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-semibold text-zinc-100">
                  Context Window Warning: {usagePercentage}% Utilized
                </span>
                <span className="px-2 py-0.5 rounded-full bg-purple-500/15 border border-purple-500/30 text-purple-300 font-mono text-[10px]">
                  ~{estimatedTokens.toLocaleString()} / {maxTokens.toLocaleString()} tokens
                </span>
              </div>
              <p className="text-[11px] text-zinc-300 truncate mt-0.5">
                Approaching model capacity limit. Older message turns may be truncated by upstream inference.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleSummarize}
              disabled={isSummarizing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-semibold transition-all shadow-md shadow-purple-500/20 active:scale-95 disabled:opacity-50"
            >
              <Sparkles className={`w-3.5 h-3.5 ${isSummarizing ? 'animate-spin' : ''}`} />
              <span>{isSummarizing ? 'Compressing...' : 'Summarize Chat to Free Context'}</span>
            </button>

            <button
              onClick={() => setIsDismissed(true)}
              className="p-1 text-zinc-400 hover:text-zinc-100 rounded-lg hover:bg-zinc-800/80 transition-colors"
              title="Dismiss warning"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-2.5 w-full bg-zinc-800/60 rounded-full h-1 overflow-hidden">
          <div
            className={`h-full transition-all duration-500 ${
              usagePercentage >= 95
                ? 'bg-rose-500'
                : usagePercentage >= 85
                ? 'bg-amber-500'
                : 'bg-purple-500'
            }`}
            style={{ width: `${Math.min(100, usagePercentage)}%` }}
          />
        </div>
      </div>
    </aside>
  );
}
