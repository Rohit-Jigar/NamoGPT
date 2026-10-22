import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useChat } from '../context/ChatContext';
import { useToast } from '../context/ToastContext';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import confetti from 'canvas-confetti';
import {
  Sparkles,
  Copy,
  Check,
  RotateCcw,
  Volume2,
  VolumeX,
  ThumbsUp,
  ThumbsDown,
  Edit2,
  ChevronDown,
  ChevronRight,
  Brain,
  Zap,
  Globe,
  Eye,
  ExternalLink,
  Play,
  Terminal,
  Loader2,
  ArrowUpRight,
  ArrowDown,
  FileText,
  Clock,
  CheckCircle2,
  AlertCircle,
  Code2,
  GitFork,
  History
} from 'lucide-react';
import { executeCodeAPI } from '../services/api';

function extractDomain(url) {
  try {
    if (!url) return '';
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

export default function ChatArea() {
  const {
    currentChat,
    isGenerating,
    isSearchingWeb,
    sendMessage,
    regenerateMessage,
    editAndResend,
    forkChat,
    rewindChat
  } = useChat();

  const { showCopySuccess, showTimeoutError } = useToast();

  const [copiedId, setCopiedId] = useState(null);
  const [speakingId, setSpeakingId] = useState(null);
  const [editingIndex, setEditingIndex] = useState(null);
  const [editPrompt, setEditPrompt] = useState('');
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const [openReasoning, setOpenReasoning] = useState({});
  const [executionOutputs, setExecutionOutputs] = useState({});
  const [executingId, setExecutingId] = useState(null);
  const [feedbackVotes, setFeedbackVotes] = useState({});
  const [thinkingElapsed, setThinkingElapsed] = useState({});

  const messagesEndRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const thinkingStartTimeRef = useRef({});

  const messages = currentChat?.messages || [];

  // Listen for upstream 504 timeouts to display 1-click retry toast
  useEffect(() => {
    function handleTimeoutEvent() {
      const msgs = currentChat?.messages || [];
      if (msgs.length > 0) {
        const lastAssistantIndex = msgs.length - 1;
        showTimeoutError({
          onRetry: () => regenerateMessage(lastAssistantIndex)
        });
      } else {
        showTimeoutError();
      }
    }
    window.addEventListener('namogpt:timeout', handleTimeoutEvent);
    return () => window.removeEventListener('namogpt:timeout', handleTimeoutEvent);
  }, [currentChat, regenerateMessage, showTimeoutError]);

  // Track live thinking timer while generating
  useEffect(() => {
    let interval;
    if (isGenerating) {
      interval = setInterval(() => {
        const now = Date.now();
        setThinkingElapsed((prev) => {
          const next = { ...prev };
          Object.keys(thinkingStartTimeRef.current).forEach((id) => {
            if (thinkingStartTimeRef.current[id]) {
              next[id] = Math.max(
                0.1,
                (now - thinkingStartTimeRef.current[id]) / 1000
              );
            }
          });
          return next;
        });
      }, 150);
    }
    return () => clearInterval(interval);
  }, [isGenerating]);

  // Auto-scroll on new message chunks
  useEffect(() => {
    if (!showScrollBottom) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isGenerating, showScrollBottom]);

  // Monitor scroll position for floating scroll button
  function handleScroll() {
    if (!scrollContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    const isUp = scrollHeight - scrollTop - clientHeight > 160;
    setShowScrollBottom(isUp);
  }

  function scrollToBottom() {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    setShowScrollBottom(false);
  }

  function copyToClipboard(text, id) {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    showCopySuccess('Copied to clipboard!');
    setTimeout(() => setCopiedId(null), 2000);
  }

  function handleSpeak(text, id) {
    if (!('speechSynthesis' in window)) {
      alert('Text-to-speech is not supported in this browser.');
      return;
    }

    if (speakingId === id) {
      window.speechSynthesis.cancel();
      setSpeakingId(null);
      return;
    }

    window.speechSynthesis.cancel();
    const cleanText = text.replace(/[*#`_~\[\]]/g, '');
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    utterance.onend = () => setSpeakingId(null);
    utterance.onerror = () => setSpeakingId(null);

    setSpeakingId(id);
    window.speechSynthesis.speak(utterance);
  }

  function handleVote(msgId, voteType) {
    setFeedbackVotes((prev) => ({
      ...prev,
      [msgId]: prev[msgId] === voteType ? null : voteType
    }));
    if (voteType === 'up') {
      try {
        confetti({
          particleCount: 28,
          spread: 45,
          origin: { y: 0.85 }
        });
      } catch {}
    }
  }

  async function handleRunCode(lang, code, blockId) {
    setExecutingId(blockId);
    try {
      const res = await executeCodeAPI({ language: lang, code });
      setExecutionOutputs((prev) => ({ ...prev, [blockId]: res }));
    } catch (err) {
      setExecutionOutputs((prev) => ({
        ...prev,
        [blockId]: { success: false, stdout: '', stderr: err.message, executionTimeMs: 0 }
      }));
    } finally {
      setExecutingId(null);
    }
  }

  // Google Stitch Bento Starter Cards
  const bentoCards = [
    {
      title: 'High-Speed Coding',
      category: 'Fullstack & Backend',
      icon: Zap,
      badgeColor: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
      gradientBorder: 'group-hover:border-amber-500/40',
      description: 'Build a REST API with FastAPI or React component',
      prompt: 'Build a production-ready REST API with FastAPI featuring JWT authentication, Pydantic schemas, and clean async handlers.'
    },
    {
      title: 'Deep Reasoning (R1)',
      category: 'Math & Algorithms',
      icon: Brain,
      badgeColor: 'text-violet-400 bg-violet-500/10 border-violet-500/20',
      gradientBorder: 'group-hover:border-violet-500/40',
      description: 'Analyze complex algorithmic or mathematical problem',
      prompt: 'Analyze complex algorithmic or mathematical problem: Design an optimal distributed rate limiter with sliding window logs and low memory footprint.'
    },
    {
      title: 'Live Web Grounding',
      category: 'Real-Time Web Intelligence',
      icon: Globe,
      badgeColor: 'text-sky-400 bg-sky-500/10 border-sky-500/20',
      gradientBorder: 'group-hover:border-sky-500/40',
      description: 'Search real-time breaking tech and industry developments',
      prompt: 'Search real-time breaking tech and industry developments: Provide a factual briefing on the latest AI foundation model breakthroughs and benchmarks.'
    },
    {
      title: 'Multimodal Vision',
      category: 'Visual & System Architecture',
      icon: Eye,
      badgeColor: 'text-teal-400 bg-teal-500/10 border-teal-500/20',
      gradientBorder: 'group-hover:border-teal-500/40',
      description: 'Analyze an architecture diagram or screenshot',
      prompt: 'Analyze an architecture diagram: Outline best practices for microservices telemetry, OpenTelemetry collectors, and distributed observability.'
    }
  ];

  return (
    <div className="flex-1 flex flex-col relative overflow-hidden bg-[#09090b] text-zinc-100 select-text">
      {/* Google Stitch Ambient Background Glow */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,rgba(56,189,248,0.07),rgba(255,255,255,0))] pointer-events-none" />
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-gradient-to-tr from-sky-500/5 via-violet-500/5 to-teal-500/5 blur-[120px] rounded-full pointer-events-none" />

      {/* Main Messages & Canvas Viewport */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 md:px-6 py-6 relative z-10"
      >
        <div className="max-w-4xl mx-auto w-full space-y-7">
          {/* Hero Empty State Canvas */}
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center min-h-[68vh] text-center px-4 py-8 animate-in fade-in duration-300">
              {/* Stitch Pill Badge */}
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-zinc-900/90 border border-zinc-800/90 text-xs text-zinc-300 shadow-sm mb-6 backdrop-blur-md">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-sky-500"></span>
                </span>
                <span className="font-medium text-zinc-200">Google Stitch AI Canvas</span>
                <span className="text-zinc-600">•</span>
                <span className="text-sky-400 font-mono text-[11px]">Free SOTA LiteLLM Stack</span>
              </div>

              {/* Glowing Gradient Title */}
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight mb-4 max-w-2xl leading-tight">
                <span className="bg-gradient-to-r from-sky-400 via-teal-300 to-indigo-400 bg-clip-text text-transparent drop-shadow-[0_0_28px_rgba(56,189,248,0.22)]">
                  What would you like to build or explore today?
                </span>
              </h1>

              <p className="text-zinc-400 text-sm sm:text-base max-w-xl mb-10 leading-relaxed font-normal">
                Autonomous conversational intelligence with live web grounding, step-by-step reasoning, and sandboxed code execution on an interactive canvas.
              </p>

              {/* 4 Bento Starter Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 w-full max-w-3xl text-left">
                {bentoCards.map((card, idx) => {
                  const Icon = card.icon;
                  return (
                    <button
                      key={idx}
                      onClick={() => sendMessage(card.prompt)}
                      className={`p-4 sm:p-5 rounded-2xl bg-zinc-900/60 hover:bg-zinc-800/70 border border-zinc-800/80 ${card.gradientBorder} transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-sky-500/5 group relative flex flex-col justify-between backdrop-blur-md`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2.5">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold border ${card.badgeColor}`}
                          >
                            <Icon className="w-3.5 h-3.5" />
                            {card.category}
                          </span>
                          <ArrowUpRight className="w-4 h-4 text-zinc-500 group-hover:text-sky-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
                        </div>
                        <div className="font-semibold text-base text-zinc-100 group-hover:text-white transition-colors mb-1.5">
                          {card.title}
                        </div>
                      </div>
                      <div className="text-xs text-zinc-400 line-clamp-2 leading-relaxed mt-1 font-normal">
                        {card.description}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            /* Conversational Messages Stream */
            messages.map((msg, index) => {
              const isUser = msg.role === 'user';
              const isEditing = editingIndex === index;
              const isLastAssistantMessage = !isUser && index === messages.length - 1;
              const showSearchingBanner =
                !isUser &&
                isLastAssistantMessage &&
                isGenerating &&
                (isSearchingWeb || (!msg.content && msg.sources && msg.sources.length > 0));

              // Parse <think> reasoning tags
              let reasoningContent = '';
              let isStillThinking = false;
              let finalContent = msg.content || '';

              if (!isUser && finalContent.includes('<think>')) {
                if (finalContent.includes('</think>')) {
                  const match = finalContent.match(/<think>([\s\S]*?)<\/think>/);
                  if (match) {
                    reasoningContent = match[1].trim();
                    finalContent = finalContent.replace(/<think>[\s\S]*?<\/think>/, '').trim();
                    if (thinkingStartTimeRef.current[msg.id]) {
                      delete thinkingStartTimeRef.current[msg.id];
                    }
                  }
                } else {
                  // Currently streaming the thought process
                  const partialMatch = finalContent.match(/<think>([\s\S]*)$/);
                  if (partialMatch) {
                    reasoningContent = partialMatch[1].trim();
                    finalContent = '';
                    isStillThinking = true;
                    if (!thinkingStartTimeRef.current[msg.id]) {
                      thinkingStartTimeRef.current[msg.id] = Date.now();
                    }
                  }
                }
              }

              const msgTimer = thinkingElapsed[msg.id] || 0;

              return (
                <div
                  key={msg.id || index}
                  className={`flex flex-col gap-2 ${
                    isUser ? 'items-end' : 'items-start'
                  } group`}
                >
                  <div
                    className={`flex items-start gap-3 w-full ${
                      isUser ? 'justify-end' : 'justify-start'
                    }`}
                  >
                    {/* Assistant Avatar with Stitch Glowing Gradient */}
                    {!isUser && (
                      <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-sky-500/20 via-indigo-500/10 to-teal-500/20 border border-sky-500/30 flex items-center justify-center shrink-0 mt-1 shadow-sm shadow-sky-950/20">
                        <Sparkles className="w-4 h-4 text-sky-400" />
                      </div>
                    )}

                    {/* Message Bubble Container */}
                    <div
                      className={`max-w-[92%] sm:max-w-[85%] ${
                        isUser ? 'order-1' : 'order-2 w-full max-w-full'
                      }`}
                    >
                      {/* User Edit Mode */}
                      {isEditing ? (
                        <div className="bg-zinc-900 rounded-2xl p-3 border border-sky-500/50 space-y-2 shadow-xl backdrop-blur-md">
                          <textarea
                            value={editPrompt}
                            onChange={(e) => setEditPrompt(e.target.value)}
                            className="w-full bg-transparent text-sm text-white outline-none resize-none font-sans"
                            rows={3}
                          />
                          <div className="flex justify-end gap-2 text-xs">
                            <button
                              onClick={() => setEditingIndex(null)}
                              className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => {
                                editAndResend(index, editPrompt);
                                setEditingIndex(null);
                              }}
                              className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-medium shadow-sm transition-colors"
                            >
                              Save & Submit
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          {/* Live Web Grounding Search Banner */}
                          {showSearchingBanner && (
                            <div className="mb-3.5 flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl bg-sky-950/40 border border-sky-500/30 text-sky-300 text-xs shadow-md backdrop-blur-md animate-pulse">
                              <div className="relative flex h-3 w-3 shrink-0">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-3 w-3 bg-sky-500"></span>
                              </div>
                              <span className="font-medium tracking-wide">
                                🔍 Grounding query on live web and synthesizing verified sources...
                              </span>
                            </div>
                          )}

                          {/* Web Search Citations - Google Stitch Citation Cards */}
                          {msg.sources && msg.sources.length > 0 && (
                            <div className="mb-4 space-y-2.5">
                              <div className="flex items-center gap-2 text-xs font-semibold text-sky-400">
                                <div className="p-1 rounded-lg bg-sky-500/10 border border-sky-500/20">
                                  <Globe className="w-3.5 h-3.5 text-sky-400" />
                                </div>
                                <span>Web Grounding Sources ({msg.sources.length})</span>
                                <span className="text-[10px] text-zinc-500 font-mono ml-auto">
                                  Verified Real-Time Grounding
                                </span>
                              </div>
                              <div className="flex items-stretch gap-2.5 overflow-x-auto py-1 no-scrollbar">
                                {msg.sources.map((src, srcIdx) => {
                                  const domain = extractDomain(src.url);
                                  return (
                                    <a
                                      key={srcIdx}
                                      href={src.url || '#'}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="group/card flex flex-col justify-between p-3 rounded-2xl bg-zinc-900/80 hover:bg-zinc-800/90 border border-zinc-800/90 hover:border-sky-500/40 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-sky-500/5 text-left w-64 shrink-0"
                                    >
                                      <div className="space-y-1.5">
                                        <div className="flex items-center justify-between gap-2">
                                          <div className="flex items-center gap-1.5 min-w-0">
                                            <img
                                              src={`https://www.google.com/s2/favicons?domain=${domain}&sz=32`}
                                              alt=""
                                              onError={(e) => {
                                                e.currentTarget.style.display = 'none';
                                              }}
                                              className="w-3.5 h-3.5 rounded-sm shrink-0"
                                            />
                                            {domain && (
                                              <span className="px-1.5 py-0.5 rounded-md bg-sky-500/10 border border-sky-500/20 text-[10px] text-sky-300 font-mono truncate">
                                                {domain}
                                              </span>
                                            )}
                                          </div>
                                          <ExternalLink className="w-3.5 h-3.5 text-zinc-500 group-hover/card:text-sky-400 transition-colors shrink-0" />
                                        </div>
                                        <p className="text-xs font-semibold text-zinc-200 group-hover/card:text-white line-clamp-2 leading-snug">
                                          {src.title || 'Referenced Document'}
                                        </p>
                                        {src.snippet && (
                                          <p className="text-[11px] text-zinc-400 line-clamp-2 leading-relaxed font-sans">
                                            {src.snippet}
                                          </p>
                                        )}
                                      </div>
                                      <div className="mt-2 pt-2 border-t border-zinc-800/60 flex items-center justify-between text-[10px] text-zinc-500">
                                        <span className="font-mono">Citation [{srcIdx + 1}]</span>
                                        <span className="text-sky-400/80 group-hover/card:text-sky-300 font-medium flex items-center gap-0.5">
                                          Source <ArrowUpRight className="w-2.5 h-2.5" />
                                        </span>
                                      </div>
                                    </a>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* Message Content Container */}
                          <div
                            className={`text-sm leading-relaxed ${
                              isUser
                                ? 'bg-zinc-800/90 text-zinc-100 rounded-3xl rounded-tr-md px-5 py-3.5 border border-zinc-700/60 shadow-lg shadow-black/20 backdrop-blur-md ml-auto'
                                : 'bg-transparent text-zinc-200 px-0'
                            }`}
                          >
                            {/* Attachment Pill Chip */}
                            {msg.attachment && (
                              <div className="mb-3 p-2.5 rounded-2xl bg-zinc-900/95 border border-zinc-700/60 flex items-center gap-2.5 max-w-xs shadow-md">
                                {msg.attachment.dataUrl?.startsWith('data:image') ? (
                                  <img
                                    src={msg.attachment.dataUrl}
                                    alt="attachment"
                                    className="w-12 h-12 rounded-xl object-cover border border-zinc-700/50"
                                  />
                                ) : (
                                  <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center shrink-0">
                                    <FileText className="w-5 h-5 text-sky-400" />
                                  </div>
                                )}
                                <div className="text-xs truncate">
                                  <div className="font-medium text-white truncate max-w-[190px]">
                                    {msg.attachment.name}
                                  </div>
                                  <div className="text-[10px] text-zinc-400 font-mono">
                                    Attached Context
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Collapsible Chain-of-Thought (R1) Accordion with Glowing Violet Border */}
                            {reasoningContent && (
                              <div className="mb-4 rounded-2xl border border-violet-500/35 bg-gradient-to-r from-violet-950/20 via-zinc-950/40 to-violet-950/15 overflow-hidden shadow-md shadow-violet-950/20 transition-all">
                                <button
                                  onClick={() =>
                                    setOpenReasoning((prev) => ({
                                      ...prev,
                                      [msg.id]:
                                        prev[msg.id] === undefined
                                          ? false
                                          : !prev[msg.id]
                                    }))
                                  }
                                  className="w-full flex items-center justify-between px-4 py-3 text-xs font-medium text-violet-300 hover:bg-violet-900/20 transition-colors"
                                >
                                  <div className="flex items-center gap-2.5">
                                    <Brain
                                      className={`w-4 h-4 text-violet-400 ${
                                        isStillThinking ? 'animate-pulse' : ''
                                      }`}
                                    />
                                    <span className="font-semibold text-violet-200">
                                      {isStillThinking
                                        ? 'Chain-of-Thought Reasoning in Progress'
                                        : 'Chain-of-Thought Reasoning (DeepSeek R1)'}
                                    </span>
                                    {/* Live Duration Timer */}
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-violet-500/20 border border-violet-500/30 text-[10px] font-mono text-violet-300">
                                      <Clock className="w-3 h-3" />
                                      {isStillThinking
                                        ? `${msgTimer.toFixed(1)}s live`
                                        : 'Verified Reasoning'}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1.5 text-violet-400">
                                    <span className="text-[11px] font-mono">
                                      {openReasoning[msg.id] ?? isStillThinking
                                        ? 'Collapse'
                                        : 'Expand'}
                                    </span>
                                    {openReasoning[msg.id] ?? isStillThinking ? (
                                      <ChevronDown className="w-4 h-4" />
                                    ) : (
                                      <ChevronRight className="w-4 h-4" />
                                    )}
                                  </div>
                                </button>
                                {(openReasoning[msg.id] ?? isStillThinking) && (
                                  <div className="p-4 text-xs text-zinc-300 font-mono bg-black/50 border-t border-violet-500/20 whitespace-pre-wrap leading-relaxed max-h-80 overflow-y-auto selection:bg-violet-500/30">
                                    {reasoningContent}
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Markdown Prose Output */}
                            <div className="prose-namo">
                              <ReactMarkdown
                                remarkPlugins={[remarkGfm, remarkMath]}
                                rehypePlugins={[rehypeKatex]}
                                components={{
                                  code({ node, inline, className, children, ...props }) {
                                    const match = /language-(\w+)/.exec(className || '');
                                    const codeStr = String(children).replace(/\n$/, '');

                                    if (!inline && (match || codeStr.includes('\n'))) {
                                      const lang = match ? match[1] : 'text';
                                      const codeBlockId = `code-${lang}-${codeStr
                                        .slice(0, 16)
                                        .replace(/\W/g, '')}`;
                                      const isRunnable = [
                                        'javascript',
                                        'js',
                                        'python',
                                        'py'
                                      ].includes(lang.toLowerCase());
                                      const execOutput = executionOutputs[codeBlockId];
                                      const isExecuting = executingId === codeBlockId;
                                      const lines = codeStr.split('\n');

                                      return (
                                        <div className="my-4 rounded-2xl border border-zinc-800 bg-[#0d0d10] overflow-hidden shadow-xl">
                                          {/* Code Block Header */}
                                          <div className="flex items-center justify-between px-4 py-2.5 bg-[#141418] border-b border-zinc-800 text-[11px] font-mono text-zinc-400">
                                            <div className="flex items-center gap-2">
                                              <Code2 className="w-4 h-4 text-sky-400" />
                                              <span className="font-semibold text-zinc-200 uppercase tracking-wide">
                                                {lang}
                                              </span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                              {/* Run in Sandbox Button */}
                                              {isRunnable && (
                                                <button
                                                  onClick={() =>
                                                    handleRunCode(lang, codeStr, codeBlockId)
                                                  }
                                                  disabled={isExecuting}
                                                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 hover:text-sky-300 border border-sky-500/20 transition-all font-semibold active:scale-95"
                                                  title="Execute in sandboxed environment"
                                                >
                                                  {isExecuting ? (
                                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                  ) : (
                                                    <Play className="w-3.5 h-3.5 fill-current" />
                                                  )}
                                                  <span>
                                                    {isExecuting
                                                      ? 'Executing...'
                                                      : 'Run in Sandbox'}
                                                  </span>
                                                </button>
                                              )}
                                              {/* 1-Click Copy Button */}
                                              <button
                                                onClick={() =>
                                                  copyToClipboard(codeStr, codeBlockId)
                                                }
                                                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-zinc-800/80 hover:bg-zinc-700/80 text-zinc-300 hover:text-white transition-all font-medium border border-zinc-700/50"
                                              >
                                                {copiedId === codeBlockId ? (
                                                  <>
                                                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                                                    <span className="text-emerald-400">
                                                      Copied!
                                                    </span>
                                                  </>
                                                ) : (
                                                  <>
                                                    <Copy className="w-3.5 h-3.5" />
                                                    <span>Copy</span>
                                                  </>
                                                )}
                                              </button>
                                            </div>
                                          </div>

                                          {/* Code Body with Gutter Line Numbers */}
                                          <div className="flex font-mono text-xs overflow-x-auto bg-[#0a0a0d]">
                                            <div className="select-none py-3.5 px-3 text-right text-zinc-600 bg-zinc-950/60 border-r border-zinc-800/60 font-mono text-xs leading-relaxed sticky left-0 z-10 shrink-0">
                                              {lines.map((_, i) => (
                                                <div key={i} className="leading-relaxed">
                                                  {i + 1}
                                                </div>
                                              ))}
                                            </div>
                                            <pre className="p-3.5 pl-4 overflow-x-auto font-mono text-xs text-sky-200/90 leading-relaxed flex-1">
                                              <code>{codeStr}</code>
                                            </pre>
                                          </div>

                                          {/* Expandable Sandbox Terminal Output */}
                                          {execOutput && (
                                            <div className="border-t border-zinc-800 bg-[#050508] p-3.5 text-xs font-mono select-text">
                                              <div className="flex items-center justify-between pb-2 mb-2 border-b border-zinc-800/80 text-[11px]">
                                                <div className="flex items-center gap-2 text-zinc-400">
                                                  <Terminal className="w-3.5 h-3.5 text-amber-400" />
                                                  <span className="font-semibold text-zinc-200">
                                                    Sandbox Terminal
                                                  </span>
                                                  <span className="text-zinc-600">•</span>
                                                  <span
                                                    className={
                                                      execOutput.success
                                                        ? 'text-emerald-400 font-semibold flex items-center gap-1'
                                                        : 'text-rose-400 font-semibold flex items-center gap-1'
                                                    }
                                                  >
                                                    {execOutput.success ? (
                                                      <CheckCircle2 className="w-3 h-3" />
                                                    ) : (
                                                      <AlertCircle className="w-3 h-3" />
                                                    )}
                                                    {execOutput.success
                                                      ? 'Execution Success'
                                                      : 'Execution Failed'}
                                                  </span>
                                                  {execOutput.executionTimeMs !== undefined && (
                                                    <span className="text-zinc-500 text-[10px]">
                                                      ({execOutput.executionTimeMs}ms)
                                                    </span>
                                                  )}
                                                </div>
                                                <button
                                                  onClick={() =>
                                                    setExecutionOutputs((prev) => ({
                                                      ...prev,
                                                      [codeBlockId]: null
                                                    }))
                                                  }
                                                  className="text-zinc-500 hover:text-zinc-300 text-[10px] px-2 py-0.5 rounded bg-zinc-800/60 hover:bg-zinc-800 transition-colors"
                                                >
                                                  Clear
                                                </button>
                                              </div>
                                              {execOutput.stdout && (
                                                <pre className="text-zinc-200 whitespace-pre-wrap font-mono leading-relaxed bg-zinc-950/40 p-2.5 rounded-lg border border-zinc-800/60">
                                                  {execOutput.stdout}
                                                </pre>
                                              )}
                                              {execOutput.stderr && (
                                                <pre className="text-rose-400 whitespace-pre-wrap font-mono leading-relaxed bg-rose-950/20 p-2.5 rounded-lg border border-rose-900/40 mt-1.5">
                                                  {execOutput.stderr}
                                                </pre>
                                              )}
                                              {execOutput.result !== null &&
                                                execOutput.result !== undefined && (
                                                  <div className="text-emerald-400 font-mono mt-1.5 pt-1.5 border-t border-zinc-800/60 text-[11px]">
                                                    Return Value: {String(execOutput.result)}
                                                  </div>
                                                )}
                                            </div>
                                          )}
                                        </div>
                                      );
                                    }
                                    return (
                                      <code
                                        className="bg-zinc-800/80 text-sky-300 px-1.5 py-0.5 rounded text-[13px] font-mono border border-zinc-700/50"
                                        {...props}
                                      >
                                        {children}
                                      </code>
                                    );
                                  }
                                }}
                              >
                                {finalContent}
                              </ReactMarkdown>
                            </div>
                          </div>
                        </>
                      )}

                      {/* Message Action Bar (Copy, Speak, Regenerate, Thumbs, Edit) */}
                      {!isEditing && (
                        <div
                          className={`flex items-center gap-1.5 mt-2 text-zinc-500 text-xs transition-opacity ${
                            isUser
                              ? 'justify-end opacity-0 group-hover:opacity-100'
                              : 'justify-start opacity-70 group-hover:opacity-100'
                          }`}
                        >
                          {isUser ? (
                            <>
                              <button
                                onClick={() => {
                                  setEditingIndex(index);
                                  setEditPrompt(msg.content);
                                }}
                                className="p-1.5 hover:text-white rounded-lg hover:bg-zinc-800/60 transition-colors"
                                title="Edit message turn"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => copyToClipboard(msg.content, msg.id || index)}
                                className="p-1.5 hover:text-white rounded-lg hover:bg-zinc-800/60 transition-colors"
                                title="Copy message"
                              >
                                {copiedId === (msg.id || index) ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => copyToClipboard(msg.content, msg.id || index)}
                                className="p-1.5 hover:text-white rounded-lg hover:bg-zinc-800/60 transition-colors"
                                title="Copy response"
                              >
                                {copiedId === (msg.id || index) ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                              <button
                                onClick={() => handleSpeak(msg.content, msg.id || index)}
                                className={`p-1.5 rounded-lg hover:bg-zinc-800/60 transition-colors ${
                                  speakingId === (msg.id || index)
                                    ? 'text-rose-400'
                                    : 'hover:text-white'
                                }`}
                                title={
                                  speakingId === (msg.id || index) ? 'Stop reading' : 'Read aloud'
                                }
                              >
                                {speakingId === (msg.id || index) ? (
                                  <VolumeX className="w-3.5 h-3.5" />
                                ) : (
                                  <Volume2 className="w-3.5 h-3.5" />
                                )}
                              </button>
                              <button
                                onClick={() => regenerateMessage(index)}
                                className="p-1.5 hover:text-white rounded-lg hover:bg-zinc-800/60 transition-colors"
                                title="Regenerate turn"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleVote(msg.id || index, 'up')}
                                className={`p-1.5 rounded-lg hover:bg-zinc-800/60 transition-colors ${
                                  feedbackVotes[msg.id || index] === 'up'
                                    ? 'text-emerald-400 bg-emerald-500/10'
                                    : 'hover:text-white'
                                }`}
                                title="Helpful response"
                              >
                                <ThumbsUp className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleVote(msg.id || index, 'down')}
                                className={`p-1.5 rounded-lg hover:bg-zinc-800/60 transition-colors ${
                                  feedbackVotes[msg.id || index] === 'down'
                                    ? 'text-rose-400 bg-rose-500/10'
                                    : 'hover:text-white'
                                }`}
                                title="Unhelpful response"
                              >
                                <ThumbsDown className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}

          {/* Assistant Generation Streaming Indicator */}
          {isGenerating && (
            <div className="flex items-center gap-2.5 text-zinc-400 text-xs py-2 px-1 animate-in fade-in">
              <span className="relative flex h-2.5 w-2.5">
                <span
                  className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                    isSearchingWeb ? 'bg-sky-400' : 'bg-emerald-400'
                  }`}
                ></span>
                <span
                  className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                    isSearchingWeb ? 'bg-sky-500' : 'bg-emerald-500'
                  }`}
                ></span>
              </span>
              <span
                className={`font-medium ${
                  isSearchingWeb ? 'text-sky-300' : 'text-zinc-300'
                }`}
              >
                {isSearchingWeb
                  ? '🔍 Grounding live web sources and synthesizing findings...'
                  : 'NamoGPT Canvas streaming response...'}
              </span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Floating Scroll to Bottom Indicator Button */}
      {showScrollBottom && (
        <button
          onClick={scrollToBottom}
          className="absolute bottom-5 right-6 sm:right-8 flex items-center gap-1.5 px-3 py-2 rounded-full bg-zinc-900/90 border border-zinc-700/80 text-zinc-300 hover:text-white shadow-2xl hover:scale-105 active:scale-95 transition-all z-20 backdrop-blur-xl group"
          title="Scroll to latest turn"
        >
          <ArrowDown className="w-3.5 h-3.5 group-hover:translate-y-0.5 transition-transform" />
          <span className="text-xs font-medium">Latest</span>
        </button>
      )}
    </div>
  );
}
