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
      <div className="relative overflow-hidden rounded-2xl bg-[#13100E] border border-[#6F4E37]/50 backdrop-blur-2xl shadow-xl shadow-black/40 p-3.5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2 rounded-xl bg-[#6F4E37]/25 text-[#E6E0F0] border border-[#6F4E37] shrink-0">
              <Layers className="w-4 h-4 text-[#E6E0F0]" />
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-semibold text-[#FAF9F8]">
                  Context Window Warning: {usagePercentage}% Utilized
                </span>
                <span className="px-2 py-0.5 rounded-full bg-[#241E1A] border border-[#E5E4E2]/15 text-[#E5E4E2] font-mono text-[10px]">
                  ~{estimatedTokens.toLocaleString()} / {maxTokens.toLocaleString()} tokens
                </span>
              </div>
              <p className="text-[11px] text-[#BDB8B3] truncate mt-0.5">
                Approaching model capacity limit. Older message turns may be truncated by upstream inference.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleSummarize}
              disabled={isSummarizing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#6F4E37] hover:bg-[#8C6549] text-[#FAF9F8] text-xs font-semibold transition-all shadow-md active:scale-95 disabled:opacity-50 border border-[#6F4E37]"
            >
              <Sparkles className={`w-3.5 h-3.5 text-[#E6E0F0] ${isSummarizing ? 'animate-spin' : ''}`} />
              <span>{isSummarizing ? 'Compressing...' : 'Summarize Chat to Free Context'}</span>
            </button>

            <button
              onClick={() => setIsDismissed(true)}
              className="p-1 text-[#BDB8B3] hover:text-[#FAF9F8] rounded-lg hover:bg-[#241E1A] transition-colors"
              title="Dismiss warning"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-2.5 w-full bg-[#241E1A] rounded-full h-1 overflow-hidden border border-[#E5E4E2]/10">
          <div
            className={`h-full transition-all duration-500 ${
              usagePercentage >= 95
                ? 'bg-rose-500'
                : usagePercentage >= 85
                ? 'bg-[#AF8E73]'
                : 'bg-[#6F4E37]'
            }`}
            style={{ width: `${Math.min(100, usagePercentage)}%` }}
          />
        </div>
      </div>
    </aside>
  );
}
