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
  History,
  Layers,
  Cpu
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

  // Listen for upstream timeouts
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

  // Scroll to bottom
  const scrollToBottom = (smooth = true) => {
    messagesEndRef.current?.scrollIntoView({
      behavior: smooth ? 'smooth' : 'auto',
      block: 'end'
    });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages.length, isGenerating]);

  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    const isUp = scrollHeight - scrollTop - clientHeight > 180;
    setShowScrollBottom(isUp);
  };

  function copyToClipboard(text, id) {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    showCopySuccess('Turn copied to clipboard');
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
          particleCount: 24,
          spread: 40,
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

  // Bespoke Engineering Starter Bento Cards
  const bentoCards = [
    {
      title: 'Distributed Systems & APIs',
      category: 'Backend Architecture',
      icon: Cpu,
      badgeColor: 'text-[#E6E0F0] bg-[#6F4E37]/30 border-[#6F4E37]',
      borderColor: 'hover:border-[#E6E0F0]/40',
      description: 'Architect a low-latency microservice with FastAPI/Go, JWT auth, and async queues',
      prompt: 'Design a production-grade, fault-tolerant distributed API service in Go or FastAPI with connection pooling, JWT auth, and OpenTelemetry instrumentation.'
    },
    {
      title: 'Algorithmic Synthesis (R1)',
      category: 'Deep Reasoning',
      icon: Brain,
      badgeColor: 'text-[#E6E0F0] bg-[#241E1A] border-[#E5E4E2]/20',
      borderColor: 'hover:border-[#E6E0F0]/40',
      description: 'Analyze time/space complexity and design an optimal high-concurrency rate limiter',
      prompt: 'Analyze complex algorithmic trade-offs: Synthesize an optimal distributed sliding-window rate limiter with minimal Redis lock contention and memory footprint.'
    },
    {
      title: 'Live Intelligence Grounding',
      category: 'Web Grounding',
      icon: Globe,
      badgeColor: 'text-[#E5E4E2] bg-[#241E1A] border-[#E5E4E2]/20',
      borderColor: 'hover:border-[#E6E0F0]/40',
      description: 'Real-time synthesis of latest AI model benchmarks, releases, and tech developments',
      prompt: 'Search real-time tech developments: Provide a comprehensive, cited architectural breakdown of the latest foundation models, latency benchmarks, and pricing matrices.'
    },
    {
      title: 'System & Schema Diagnostics',
      category: 'Fullstack Engineering',
      icon: Eye,
      badgeColor: 'text-[#E5E4E2] bg-[#6F4E37]/20 border-[#6F4E37]',
      borderColor: 'hover:border-[#E6E0F0]/40',
      description: 'Evaluate database schema migrations, RLS security policies, and performance bottlenecks',
      prompt: 'Audit database performance: Outline idempotent PostgreSQL schema migrations with Row Level Security (RLS) policies, composite indexing, and query plan optimizations.'
    }
  ];

  return (
    <div className="flex-1 flex flex-col relative overflow-hidden bg-[#0D0B0A] text-[#FAF9F8] select-text">
      {/* Luxury Ambient Radial Glow */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_75%_45%_at_50%_-10%,rgba(111,78,55,0.18),rgba(255,255,255,0))] pointer-events-none" />
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[650px] h-[300px] bg-gradient-to-tr from-[#6F4E37]/10 via-[#E6E0F0]/5 to-transparent blur-[140px] rounded-full pointer-events-none" />

      {/* Main Messages & Canvas Viewport */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 md:px-6 py-6 relative z-10"
      >
        <div className="max-w-4xl mx-auto w-full space-y-7">
          {/* Hero Empty State Canvas */}
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center min-h-[66vh] text-center px-4 py-8 animate-in fade-in duration-300">
              {/* Engineering Pill Badge */}
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#1A1613] border border-[#E5E4E2]/15 text-xs text-[#E5E4E2] shadow-sm mb-6 backdrop-blur-md">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#E6E0F0] opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[#6F4E37]"></span>
                </span>
                <span className="font-semibold text-[#FAF9F8] tracking-wide">NamoGPT Autonomous Matrix</span>
                <span className="text-[#E5E4E2]/30">•</span>
                <span className="text-[#E6E0F0] font-mono text-[11px]">Multi-Model LiteLLM Cluster</span>
              </div>

              {/* Title */}
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight mb-4 max-w-2xl leading-tight">
                <span className="bg-gradient-to-r from-[#FAF9F8] via-[#E5E4E2] to-[#E6E0F0] bg-clip-text text-transparent">
                  High-Performance Cognitive Workspace
                </span>
              </h1>

              <p className="text-[#BDB8B3] text-sm sm:text-base max-w-xl mb-10 leading-relaxed font-normal">
                Enterprise-grade conversational intelligence with real-time web grounding, deterministic reasoning traces, and sandboxed code execution.
              </p>

              {/* 4 Bento Starter Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 w-full max-w-3xl text-left">
                {bentoCards.map((card, idx) => {
                  const Icon = card.icon;
                  return (
                    <button
                      key={idx}
                      onClick={() => sendMessage(card.prompt)}
                      className={`p-4 sm:p-5 rounded-2xl bg-[#13100E] hover:bg-[#1A1613] border border-[#E5E4E2]/10 ${card.borderColor} transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-[#6F4E37]/10 group relative flex flex-col justify-between backdrop-blur-md`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2.5">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold border ${card.badgeColor}`}
                          >
                            <Icon className="w-3.5 h-3.5" />
                            {card.category}
                          </span>
                          <ArrowUpRight className="w-4 h-4 text-[#BDB8B3] group-hover:text-[#E6E0F0] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
                        </div>
                        <div className="font-semibold text-base text-[#FAF9F8] group-hover:text-[#FAF9F8] transition-colors mb-1.5">
                          {card.title}
                        </div>
                      </div>
                      <div className="text-xs text-[#BDB8B3] line-clamp-2 leading-relaxed mt-1 font-normal">
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
                    {/* Assistant Avatar */}
                    {!isUser && (
                      <div className="w-8 h-8 rounded-xl bg-[#1A1613] border border-[#6F4E37]/50 flex items-center justify-center shrink-0 mt-1 shadow-md shadow-black/40">
                        <Sparkles className="w-4 h-4 text-[#E6E0F0]" />
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
                        <div className="bg-[#1A1613] rounded-2xl p-3 border border-[#6F4E37] space-y-2 shadow-xl backdrop-blur-md">
                          <textarea
                            value={editPrompt}
                            onChange={(e) => setEditPrompt(e.target.value)}
                            className="w-full bg-transparent text-sm text-[#FAF9F8] outline-none resize-none font-sans"
                            rows={3}
                          />
                          <div className="flex justify-end gap-2 text-xs">
                            <button
                              onClick={() => setEditingIndex(null)}
                              className="px-3 py-1.5 rounded-lg bg-[#241E1A] hover:bg-[#2D2520] text-[#BDB8B3] transition-colors"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => {
                                editAndResend(index, editPrompt);
                                setEditingIndex(null);
                              }}
                              className="px-3 py-1.5 rounded-lg bg-[#6F4E37] hover:bg-[#8C6549] text-[#FAF9F8] font-medium shadow-sm transition-colors"
                            >
                              Save & Submit
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          {/* Live Web Grounding Search Banner */}
                          {showSearchingBanner && (
                            <div className="mb-3.5 flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl bg-[#1A1613] border border-[#6F4E37]/40 text-[#E6E0F0] text-xs shadow-md backdrop-blur-md animate-pulse">
                              <div className="relative flex h-3 w-3 shrink-0">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#E6E0F0] opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-3 w-3 bg-[#6F4E37]"></span>
                              </div>
                              <span className="font-medium tracking-wide">
                                🔍 Grounding query on live web and synthesizing verified sources...
                              </span>
                            </div>
                          )}

                          {/* Web Search Citations */}
                          {msg.sources && msg.sources.length > 0 && (
                            <div className="mb-4 space-y-2.5">
                              <div className="flex items-center gap-2 text-xs font-semibold text-[#E6E0F0]">
                                <div className="p-1 rounded-lg bg-[#6F4E37]/20 border border-[#6F4E37]">
                                  <Globe className="w-3.5 h-3.5 text-[#E6E0F0]" />
                                </div>
                                <span>Verified Web Sources ({msg.sources.length})</span>
                                <span className="text-[10px] text-[#BDB8B3] font-mono ml-auto">
                                  Real-Time Grounding
                                </span>
                              </div>
                              <div className="flex items-stretch gap-2.5 overflow-x-auto py-1 no-scrollbar">
                                {msg.sources.map((src, srcIdx) => {
                                  const domain = extractDomain(src.url);
                                  const isSafeUrl = src.url && (src.url.startsWith('https://') || src.url.startsWith('http://'));
                                  const safeHref = isSafeUrl ? src.url : '#';
                                  return (
                                    <a
                                      key={srcIdx}
                                      href={safeHref}
                                      target={isSafeUrl ? '_blank' : undefined}
                                      rel="noopener noreferrer"
                                      onClick={(e) => {
                                        if (!isSafeUrl) e.preventDefault();
                                      }}
                                      className="group/card flex flex-col justify-between p-3 rounded-2xl bg-[#13100E] hover:bg-[#1A1613] border border-[#E5E4E2]/10 hover:border-[#E6E0F0]/40 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/40 text-left w-64 shrink-0"
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
                                              <span className="px-1.5 py-0.5 rounded-md bg-[#241E1A] border border-[#E5E4E2]/10 text-[10px] text-[#E6E0F0] font-mono truncate">
                                                {domain}
                                              </span>
                                            )}
                                          </div>
                                          <ExternalLink className="w-3.5 h-3.5 text-[#BDB8B3] group-hover/card:text-[#E6E0F0] transition-colors shrink-0" />
                                        </div>
                                        <p className="text-xs font-semibold text-[#FAF9F8] group-hover/card:text-white line-clamp-2 leading-snug">
                                          {src.title || 'Referenced Document'}
                                        </p>
                                        {src.snippet && (
                                          <p className="text-[11px] text-[#BDB8B3] line-clamp-2 leading-relaxed font-sans">
                                            {src.snippet}
                                          </p>
                                        )}
                                      </div>
                                      <div className="mt-2 pt-2 border-t border-[#E5E4E2]/10 flex items-center justify-between text-[10px] text-[#BDB8B3]">
                                        <span className="font-mono">Citation [{srcIdx + 1}]</span>
                                        <span className="text-[#E6E0F0] group-hover/card:underline font-medium flex items-center gap-0.5">
                                          Inspect Source <ArrowUpRight className="w-2.5 h-2.5" />
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
                                ? 'bg-[#241E1A] text-[#FAF9F8] rounded-2xl rounded-tr-sm px-5 py-3.5 border border-[#E5E4E2]/15 shadow-lg shadow-black/30 backdrop-blur-md ml-auto'
                                : 'bg-transparent text-[#FAF9F8] px-0'
                            }`}
                          >
                            {/* Attachment Pill Chip */}
                            {msg.attachment && (
                              <div className="mb-3 p-2.5 rounded-2xl bg-[#1A1613] border border-[#E5E4E2]/15 flex items-center gap-2.5 max-w-xs shadow-md">
                                {msg.attachment.dataUrl?.startsWith('data:image') ? (
                                  <img
                                    src={msg.attachment.dataUrl}
                                    alt="attachment"
                                    className="w-12 h-12 rounded-xl object-cover border border-[#E5E4E2]/15"
                                  />
                                ) : (
                                  <div className="w-10 h-10 rounded-xl bg-[#6F4E37]/20 border border-[#6F4E37] flex items-center justify-center shrink-0">
                                    <FileText className="w-5 h-5 text-[#E6E0F0]" />
                                  </div>
                                )}
                                <div className="text-xs truncate">
                                  <div className="font-medium text-[#FAF9F8] truncate max-w-[190px]">
                                    {msg.attachment.name}
                                  </div>
                                  <div className="text-[10px] text-[#BDB8B3] font-mono">
                                    Attached Context
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Collapsible Chain-of-Thought (R1) Accordion */}
                            {reasoningContent && (
                              <div className="mb-4 rounded-2xl border border-[#6F4E37]/40 bg-[#13100E] overflow-hidden shadow-md shadow-black/40 transition-all">
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
                                  className="w-full flex items-center justify-between px-4 py-3 text-xs font-medium text-[#E6E0F0] hover:bg-[#1A1613] transition-colors"
                                >
                                  <div className="flex items-center gap-2.5">
                                    <Brain
                                      className={`w-4 h-4 text-[#E6E0F0] ${
                                        isStillThinking ? 'animate-pulse' : ''
                                      }`}
                                    />
                                    <span className="font-semibold text-[#FAF9F8]">
                                      {isStillThinking
                                        ? 'Chain-of-Thought Reasoning in Progress'
                                        : 'Verified Reasoning Trace (DeepSeek R1)'}
                                    </span>
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#6F4E37]/30 border border-[#6F4E37] text-[10px] font-mono text-[#E5E4E2]">
                                      <Clock className="w-3 h-3" />
                                      {isStillThinking
                                        ? `${msgTimer.toFixed(1)}s live`
                                        : 'Deterministic Trace'}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1.5 text-[#E6E0F0]">
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
                                  <div className="p-4 text-xs text-[#E5E4E2] font-mono bg-[#0D0B0A] border-t border-[#6F4E37]/30 whitespace-pre-wrap leading-relaxed max-h-80 overflow-y-auto selection:bg-[#6F4E37]/40">
                                    {reasoningContent}
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Markdown Prose Output */}
                            <div className="prose-namo">
                              <ReactMarkdown
                                remarkPlugins={[remarkGfm, remarkMath]}
                                rehypePlugins={[[rehypeKatex, { strict: false, trust: false }]]}
                                components={{
                                  a({ node, href, children, ...props }) {
                                    const isSafeHref = href && /^(https?:\/\/|mailto:)/i.test(href);
                                    return (
                                      <a
                                        href={isSafeHref ? href : '#'}
                                        target={isSafeHref ? '_blank' : undefined}
                                        rel={isSafeHref ? 'noopener noreferrer' : undefined}
                                        className="text-amber-400 hover:text-amber-300 underline underline-offset-2 transition-colors"
                                        {...props}
                                      >
                                        {children}
                                      </a>
                                    );
                                  },
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
                                        <div className="my-4 rounded-xl border border-[#E5E4E2]/15 bg-[#13100E] overflow-hidden shadow-xl">
                                          {/* Code Block Header */}
                                          <div className="flex items-center justify-between px-4 py-2 bg-[#1A1613] border-b border-[#E5E4E2]/10 text-[11px] font-mono text-[#BDB8B3]">
                                            <div className="flex items-center gap-2">
                                              <Code2 className="w-4 h-4 text-[#E6E0F0]" />
                                              <span className="font-semibold text-[#FAF9F8] uppercase tracking-wide">
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
                                                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#6F4E37]/30 hover:bg-[#6F4E37]/50 text-[#FAF9F8] border border-[#6F4E37] transition-all font-semibold active:scale-95"
                                                  title="Execute in sandboxed environment"
                                                >
                                                  {isExecuting ? (
                                                    <Loader2 className="w-3.5 h-3.5 animate-spin text-[#E6E0F0]" />
                                                  ) : (
                                                    <Play className="w-3.5 h-3.5 fill-current text-[#E6E0F0]" />
                                                  )}
                                                  <span>
                                                    {isExecuting
                                                      ? 'Executing...'
                                                      : 'Run in Sandbox'}
                                                  </span>
                                                </button>
                                              )}
                                              {/* Copy Button */}
                                              <button
                                                onClick={() =>
                                                  copyToClipboard(codeStr, codeBlockId)
                                                }
                                                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#241E1A] hover:bg-[#2D2520] text-[#E5E4E2] hover:text-white transition-all font-medium border border-[#E5E4E2]/10"
                                              >
                                                {copiedId === codeBlockId ? (
                                                  <>
                                                    <Check className="w-3.5 h-3.5 text-[#E6E0F0]" />
                                                    <span className="text-[#E6E0F0]">
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

                                          {/* Code Body with Gutter */}
                                          <div className="flex font-mono text-xs overflow-x-auto bg-[#0D0B0A]">
                                            <div className="select-none py-3.5 px-3 text-right text-[#7A7570] bg-[#13100E] border-r border-[#E5E4E2]/10 font-mono text-xs leading-relaxed sticky left-0 z-10 shrink-0">
                                              {lines.map((_, i) => (
                                                <div key={i} className="leading-relaxed">
                                                  {i + 1}
                                                </div>
                                              ))}
                                            </div>
                                            <pre className="p-3.5 pl-4 overflow-x-auto font-mono text-xs text-[#FAF9F8] leading-relaxed flex-1">
                                              <code>{codeStr}</code>
                                            </pre>
                                          </div>

                                          {/* Expandable Sandbox Terminal Output */}
                                          {execOutput && (
                                            <div className="border-t border-[#E5E4E2]/10 bg-[#0D0B0A] p-3.5 text-xs font-mono select-text">
                                              <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#E5E4E2]/10 text-[11px]">
                                                <div className="flex items-center gap-2 text-[#BDB8B3]">
                                                  <Terminal className="w-3.5 h-3.5 text-[#E6E0F0]" />
                                                  <span className="font-semibold text-[#FAF9F8]">
                                                    Terminal Output
                                                  </span>
                                                  <span className="text-[#7A7570]">•</span>
                                                  <span
                                                    className={
                                                      execOutput.success
                                                        ? 'text-[#E6E0F0] font-semibold flex items-center gap-1'
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
                                                    <span className="text-[#7A7570] text-[10px]">
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
                                                  className="text-[#BDB8B3] hover:text-[#FAF9F8] text-[10px] px-2 py-0.5 rounded bg-[#241E1A] transition-colors"
                                                >
                                                  Clear
                                                </button>
                                              </div>
                                              {execOutput.stdout && (
                                                <pre className="text-[#FAF9F8] whitespace-pre-wrap font-mono leading-relaxed bg-[#13100E] p-2.5 rounded-lg border border-[#E5E4E2]/10">
                                                  {execOutput.stdout}
                                                </pre>
                                              )}
                                              {execOutput.stderr && (
                                                <pre className="text-rose-300 whitespace-pre-wrap font-mono leading-relaxed bg-rose-950/20 p-2.5 rounded-lg border border-rose-900/40 mt-1.5">
                                                  {execOutput.stderr}
                                                </pre>
                                              )}
                                              {execOutput.result !== null &&
                                                execOutput.result !== undefined && (
                                                  <div className="text-[#E6E0F0] font-mono mt-1.5 pt-1.5 border-t border-[#E5E4E2]/10 text-[11px]">
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
                                        className="bg-[#241E1A] text-[#E6E0F0] px-1.5 py-0.5 rounded text-[13px] font-mono border border-[#E5E4E2]/15"
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
                          className={`flex items-center gap-1.5 mt-2 text-[#BDB8B3] text-xs transition-opacity ${
                            isUser
                              ? 'justify-end opacity-60 sm:opacity-0 sm:group-hover:opacity-100 group-hover:opacity-100'
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
                                className="p-1.5 hover:text-[#FAF9F8] rounded-lg hover:bg-[#241E1A] transition-colors"
                                title="Edit turn"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => copyToClipboard(msg.content, msg.id || index)}
                                className="p-1.5 hover:text-[#FAF9F8] rounded-lg hover:bg-[#241E1A] transition-colors"
                                title="Copy prompt"
                              >
                                {copiedId === (msg.id || index) ? (
                                  <Check className="w-3.5 h-3.5 text-[#E6E0F0]" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => copyToClipboard(msg.content, msg.id || index)}
                                className="p-1.5 hover:text-[#FAF9F8] rounded-lg hover:bg-[#241E1A] transition-colors"
                                title="Copy response"
                              >
                                {copiedId === (msg.id || index) ? (
                                  <Check className="w-3.5 h-3.5 text-[#E6E0F0]" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                              <button
                                onClick={() => handleSpeak(msg.content, msg.id || index)}
                                className={`p-1.5 rounded-lg hover:bg-[#241E1A] transition-colors ${
                                  speakingId === (msg.id || index)
                                    ? 'text-rose-400'
                                    : 'hover:text-[#FAF9F8]'
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
                                className="p-1.5 hover:text-[#FAF9F8] rounded-lg hover:bg-[#241E1A] transition-colors"
                                title="Regenerate turn"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleVote(msg.id || index, 'up')}
                                className={`p-1.5 rounded-lg hover:bg-[#241E1A] transition-colors ${
                                  feedbackVotes[msg.id || index] === 'up'
                                    ? 'text-[#E6E0F0] bg-[#6F4E37]/30'
                                    : 'hover:text-[#FAF9F8]'
                                }`}
                                title="Helpful"
                              >
                                <ThumbsUp className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleVote(msg.id || index, 'down')}
                                className={`p-1.5 rounded-lg hover:bg-[#241E1A] transition-colors ${
                                  feedbackVotes[msg.id || index] === 'down'
                                    ? 'text-rose-400 bg-rose-500/10'
                                    : 'hover:text-[#FAF9F8]'
                                }`}
                                title="Unhelpful"
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
            <div className="flex items-center gap-2.5 text-[#BDB8B3] text-xs py-2 px-1 animate-in fade-in">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#E6E0F0] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#6F4E37]"></span>
              </span>
              <span className="font-medium text-[#E5E4E2]">
                {isSearchingWeb
                  ? '🔍 Grounding live web sources and synthesizing findings...'
                  : 'NamoGPT streaming response...'}
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
          className="absolute bottom-5 right-6 sm:right-8 flex items-center gap-1.5 px-3 py-2 rounded-full bg-[#1A1613] border border-[#E5E4E2]/20 text-[#FAF9F8] hover:border-[#E6E0F0]/50 shadow-2xl hover:scale-105 active:scale-95 transition-all z-20 backdrop-blur-xl group"
          title="Scroll to latest turn"
        >
          <ArrowDown className="w-3.5 h-3.5 group-hover:translate-y-0.5 transition-transform text-[#E6E0F0]" />
          <span className="text-xs font-medium">Latest</span>
        </button>
      )}
    </div>
  );
}
