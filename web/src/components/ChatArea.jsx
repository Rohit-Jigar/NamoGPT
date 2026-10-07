import React, { useState, useEffect, useRef } from 'react';
import { useChat } from '../context/ChatContext';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
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
  Code2,
  ArrowDown,
  FileText,
  Globe,
  ExternalLink,
  Play,
  Terminal,
  Loader2,
  ArrowUpRight,
  Cpu,
  Layers,
  Code
} from 'lucide-react';
import { executeCodeAPI } from '../services/api';

export default function ChatArea() {
  const {
    currentChat,
    isGenerating,
    sendMessage,
    regenerateMessage,
    editAndResend,
    selectedModel
  } = useChat();

  const [copiedId, setCopiedId] = useState(null);
  const [speakingId, setSpeakingId] = useState(null);
  const [editingIndex, setEditingIndex] = useState(null);
  const [editPrompt, setEditPrompt] = useState('');
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const [openReasoning, setOpenReasoning] = useState({});
  const [executionOutputs, setExecutionOutputs] = useState({});
  const [executingId, setExecutingId] = useState(null);

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

  const messagesEndRef = useRef(null);
  const scrollContainerRef = useRef(null);

  // Auto-scroll on new message chunks
  useEffect(() => {
    if (!showScrollBottom) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [currentChat?.messages, isGenerating]);

  // Monitor scroll position
  function handleScroll() {
    if (!scrollContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    const isUp = scrollHeight - scrollTop - clientHeight > 150;
    setShowScrollBottom(isUp);
  }

  function scrollToBottom() {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    setShowScrollBottom(false);
  }

  function copyToClipboard(text, id) {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
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

  const promptSuggestions = [
    {
      category: "Fullstack Engineering",
      icon: Code2,
      badgeColor: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
      title: "Build Production Next.js & Node.js API",
      prompt: "Design a fullstack architecture with Node.js Express backend and React Tailwind frontend with secure JWT auth, rate limiting, and database connection pooling."
    },
    {
      category: "Quantum Physics & Math",
      icon: Cpu,
      badgeColor: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20",
      title: "Explain Bell's Theorem & Non-Locality",
      prompt: "Explain Quantum Entanglement and the Bell Inequality with mathematical equations, historical context, and intuitive physical analogies."
    },
    {
      category: "Performance Optimization",
      icon: Layers,
      badgeColor: "text-amber-400 bg-amber-500/10 border-amber-500/20",
      title: "High-Throughput Async Python Scraping",
      prompt: "Demonstrate high-throughput async I/O web scrapers with concurrency pools, retry exponential backoff, and memory-efficient streaming."
    },
    {
      category: "Strategic Architecture",
      icon: Sparkles,
      badgeColor: "text-purple-400 bg-purple-500/10 border-purple-500/20",
      title: "Zero-Downtime Cloud Migration Proposal",
      prompt: "Draft a high-impact executive proposal for zero-downtime migration of a legacy monolith infrastructure to cloud-native microservices."
    }
  ];

  const messages = currentChat?.messages || [];

  return (
    <div className="flex-1 flex flex-col relative overflow-hidden bg-[#09090b] text-zinc-100">
      {/* Background subtle radial gradient */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(16,185,129,0.06),rgba(255,255,255,0))] pointer-events-none" />

      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 md:px-0 py-6 relative z-10"
      >
        <div className="max-w-3xl mx-auto w-full space-y-6">
          {/* Empty State Welcome (shadcn/ui style) */}
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center min-h-[64vh] text-center px-4 animate-in fade-in duration-300">
              {/* Top pill badge */}
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-zinc-900/90 border border-zinc-800 text-xs text-zinc-300 shadow-sm mb-6">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="font-medium">NamoGPT Platform</span>
                <span className="text-zinc-500">•</span>
                <span className="text-zinc-400 font-mono text-[11px]">Free SOTA LiteLLM Stack</span>
              </div>

              <h1 className="text-3xl md:text-5xl font-bold tracking-tight text-white mb-3">
                What can I build or solve today?
              </h1>
              <p className="text-zinc-400 text-sm md:text-base max-w-lg mb-8 leading-relaxed">
                Autonomous AI with multi-model failover, Deep Research, tool calling, and live code execution.
              </p>

              {/* Suggestions Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 w-full max-w-2xl text-left">
                {promptSuggestions.map((item, idx) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={idx}
                      onClick={() => sendMessage(item.prompt)}
                      className="p-4 rounded-2xl bg-zinc-900/70 hover:bg-zinc-800/80 border border-zinc-800/80 hover:border-zinc-700/80 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/30 group relative flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-semibold border ${item.badgeColor}`}>
                            <Icon className="w-3 h-3" />
                            {item.category}
                          </span>
                          <ArrowUpRight className="w-3.5 h-3.5 text-zinc-500 group-hover:text-emerald-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
                        </div>
                        <div className="font-semibold text-sm text-zinc-200 group-hover:text-white transition-colors mb-1.5">
                          {item.title}
                        </div>
                      </div>
                      <div className="text-xs text-zinc-400 line-clamp-2 leading-relaxed mt-1">
                        {item.prompt}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            /* Messages Stream */
            messages.map((msg, index) => {
              const isUser = msg.role === 'user';
              const isEditing = editingIndex === index;

              // Check for <think> reasoning tags
              let reasoningContent = '';
              let isStillThinking = false;
              let finalContent = msg.content || '';
              if (!isUser && finalContent.includes('<think>')) {
                if (finalContent.includes('</think>')) {
                  const match = finalContent.match(/<think>([\s\S]*?)<\/think>/);
                  if (match) {
                    reasoningContent = match[1].trim();
                    finalContent = finalContent.replace(/<think>[\s\S]*?<\/think>/, '').trim();
                  }
                } else {
                  // Currently streaming the thought process
                  const partialMatch = finalContent.match(/<think>([\s\S]*)$/);
                  if (partialMatch) {
                    reasoningContent = partialMatch[1].trim();
                    finalContent = '';
                    isStillThinking = true;
                  }
                }
              }

              return (
                <div
                  key={msg.id || index}
                  className={`flex items-start gap-3.5 ${isUser ? 'justify-end' : 'justify-start'} group`}
                >
                  {/* Assistant Avatar */}
                  {!isUser && (
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-500/20 to-teal-500/10 border border-emerald-500/30 flex items-center justify-center shrink-0 mt-0.5 shadow-sm shadow-emerald-950/20">
                      <Sparkles className="w-4 h-4 text-emerald-400" />
                    </div>
                  )}

                  {/* Message Bubble */}
                  <div className={`max-w-[88%] md:max-w-[85%] ${isUser ? 'order-1' : 'order-2'}`}>
                    {/* User Edit Mode */}
                    {isEditing ? (
                      <div className="bg-zinc-900 rounded-2xl p-3 border border-emerald-500/50 space-y-2 shadow-lg">
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
                            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium shadow-sm transition-colors"
                          >
                            Save & Submit
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div
                        className={`text-sm leading-relaxed ${
                          isUser
                            ? 'bg-zinc-800/90 text-zinc-100 rounded-2xl rounded-tr-sm px-4 py-3 border border-zinc-700/60 shadow-sm'
                            : 'bg-transparent text-zinc-200 px-0'
                        }`}
                      >
                        {/* Attachment Preview (if any) */}
                        {msg.attachment && (
                          <div className="mb-2 p-2 rounded-xl bg-zinc-900/90 border border-zinc-700/60 flex items-center gap-2 max-w-xs shadow-sm">
                            {msg.attachment.dataUrl?.startsWith('data:image') ? (
                              <img
                                src={msg.attachment.dataUrl}
                                alt="attachment"
                                className="w-12 h-12 rounded-lg object-cover"
                              />
                            ) : (
                              <FileText className="w-6 h-6 text-emerald-400" />
                            )}
                            <div className="text-xs truncate">
                              <div className="font-medium text-white truncate">{msg.attachment.name}</div>
                              <div className="text-[10px] text-zinc-400">Attached file</div>
                            </div>
                          </div>
                        )}

                        {/* Real-Time Web Search Sources */}
                        {msg.sources && msg.sources.length > 0 && (
                          <div className="mb-3 space-y-1.5 p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs">
                            <div className="flex items-center gap-1.5 font-semibold text-blue-300 text-[11px]">
                              <Globe className="w-3.5 h-3.5 text-blue-400" />
                              <span>Live Search Sources ({msg.sources.length})</span>
                            </div>
                            <div className="flex items-center gap-2 overflow-x-auto py-1 scrollbar-none">
                              {msg.sources.map((src, idx) => (
                                <a
                                  key={idx}
                                  href={src.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white transition-all shrink-0 max-w-[210px] group/src"
                                >
                                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
                                  <span className="truncate text-[11px]">{src.title}</span>
                                  <ExternalLink className="w-2.5 h-2.5 text-zinc-500 group-hover/src:text-blue-300 shrink-0 ml-auto" />
                                </a>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Collapsible Reasoning Block (DeepSeek R1 / Thinking Mode) */}
                        {reasoningContent && (
                          <div className="mb-3 rounded-xl border border-purple-500/30 bg-purple-950/20 overflow-hidden shadow-sm shadow-purple-950/20">
                            <button
                              onClick={() =>
                                setOpenReasoning((prev) => ({
                                  ...prev,
                                  [msg.id]: prev[msg.id] === undefined ? false : !prev[msg.id]
                                }))
                              }
                              className="w-full flex items-center justify-between px-3.5 py-2.5 text-xs font-medium text-purple-300 hover:bg-purple-900/30 transition-colors"
                            >
                              <div className="flex items-center gap-2">
                                <Brain
                                  className={`w-3.5 h-3.5 text-purple-400 ${
                                    isStillThinking ? 'animate-pulse' : ''
                                  }`}
                                />
                                <span>
                                  {isStillThinking
                                    ? 'Reasoning through response...'
                                    : 'Reasoning Process (Completed)'}
                                </span>
                              </div>
                              {openReasoning[msg.id] ?? isStillThinking ? (
                                <ChevronDown className="w-3.5 h-3.5 text-purple-400" />
                              ) : (
                                <ChevronRight className="w-3.5 h-3.5 text-purple-400" />
                              )}
                            </button>
                            {(openReasoning[msg.id] ?? isStillThinking) && (
                              <div className="p-3.5 text-xs text-zinc-300 font-mono bg-black/40 border-t border-purple-500/20 whitespace-pre-wrap leading-relaxed max-h-72 overflow-y-auto">
                                {reasoningContent}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Message Markdown Body */}
                        <div className="prose-namo">
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm, remarkMath]}
                            rehypePlugins={[rehypeKatex]}
                            components={{
                              code({ node, inline, className, children, ...props }) {
                                const match = /language-(\w+)/.exec(className || '');
                                const codeStr = String(children).replace(/\n$/, '');

                                if (!inline && match) {
                                  const lang = match[1];
                                  const codeBlockId = `code-${lang}-${codeStr.slice(0, 16).replace(/\W/g, '')}`;
                                  const isRunnable = ['javascript', 'js', 'python', 'py'].includes(lang.toLowerCase());
                                  const execOutput = executionOutputs[codeBlockId];
                                  const isExecuting = executingId === codeBlockId;

                                  return (
                                    <div className="my-3.5 rounded-xl border border-zinc-800 bg-[#0d0d10] overflow-hidden shadow-md">
                                      {/* Code Header */}
                                      <div className="flex items-center justify-between px-3.5 py-2 bg-[#141418] border-b border-zinc-800 text-[11px] font-mono text-zinc-400">
                                        <div className="flex items-center gap-1.5">
                                          <Code className="w-3.5 h-3.5 text-emerald-400" />
                                          <span className="font-medium text-zinc-300">{lang}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                          {isRunnable && (
                                            <button
                                              onClick={() => handleRunCode(lang, codeStr, codeBlockId)}
                                              disabled={isExecuting}
                                              className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 hover:text-emerald-300 border border-emerald-500/20 transition-all font-semibold"
                                              title="Execute in sandboxed environment"
                                            >
                                              {isExecuting ? (
                                                <Loader2 className="w-3 h-3 animate-spin" />
                                              ) : (
                                                <Play className="w-3 h-3 fill-current" />
                                              )}
                                              <span>{isExecuting ? 'Running...' : 'Run'}</span>
                                            </button>
                                          )}
                                          <button
                                            onClick={() => copyToClipboard(codeStr, codeBlockId)}
                                            className="flex items-center gap-1 px-2 py-1 rounded text-zinc-400 hover:text-white transition-colors"
                                          >
                                            {copiedId === codeBlockId ? (
                                              <>
                                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                                                <span className="text-emerald-400">Copied!</span>
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
                                      <pre className="p-4 overflow-x-auto text-xs font-mono text-emerald-300/90 leading-relaxed bg-[#0c0c0e]">
                                        <code>{children}</code>
                                      </pre>
                                      {/* Terminal Output Console */}
                                      {execOutput && (
                                        <div className="border-t border-zinc-800 bg-[#050508] p-3 text-xs font-mono select-text">
                                          <div className="flex items-center justify-between pb-1.5 mb-2 border-b border-zinc-800/80 text-[11px]">
                                            <div className="flex items-center gap-1.5 text-zinc-400">
                                              <Terminal className="w-3.5 h-3.5 text-amber-400" />
                                              <span className="font-semibold text-zinc-200">Terminal</span>
                                              <span className="text-zinc-600">•</span>
                                              <span className={execOutput.success ? 'text-emerald-400 font-medium' : 'text-rose-400 font-medium'}>
                                                {execOutput.success ? 'Success' : 'Execution Error'}
                                              </span>
                                              {execOutput.executionTimeMs !== undefined && (
                                                <span className="text-zinc-500 text-[10px]">({execOutput.executionTimeMs}ms)</span>
                                              )}
                                            </div>
                                            <button
                                              onClick={() => setExecutionOutputs((prev) => ({ ...prev, [codeBlockId]: null }))}
                                              className="text-zinc-500 hover:text-zinc-300 text-[10px]"
                                            >
                                              Clear
                                            </button>
                                          </div>
                                          {execOutput.stdout && (
                                            <pre className="text-zinc-200 whitespace-pre-wrap font-mono leading-relaxed">{execOutput.stdout}</pre>
                                          )}
                                          {execOutput.stderr && (
                                            <pre className="text-rose-400 whitespace-pre-wrap font-mono leading-relaxed">{execOutput.stderr}</pre>
                                          )}
                                          {execOutput.result !== null && execOutput.result !== undefined && (
                                            <div className="text-emerald-400 font-mono mt-1 pt-1 border-t border-zinc-800/60">
                                              Return: {String(execOutput.result)}
                                            </div>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  );
                                }
                                return (
                                  <code className="bg-zinc-800/80 text-emerald-300 px-1.5 py-0.5 rounded text-[13px] font-mono border border-zinc-700/50" {...props}>
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
                    )}

                    {/* Action Toolbar on Hover */}
                    {!isEditing && (
                      <div
                        className={`flex items-center gap-1 mt-1.5 text-zinc-500 text-xs transition-opacity ${
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
                              className="p-1 hover:text-white rounded hover:bg-zinc-800/60 transition-colors"
                              title="Edit message"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => copyToClipboard(msg.content, msg.id || index)}
                              className="p-1 hover:text-white rounded hover:bg-zinc-800/60 transition-colors"
                              title="Copy"
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
                              className="p-1 hover:text-white rounded hover:bg-zinc-800/60 transition-colors"
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
                              className="p-1 hover:text-white rounded hover:bg-zinc-800/60 transition-colors"
                              title={speakingId === (msg.id || index) ? 'Stop audio' : 'Read aloud'}
                            >
                              {speakingId === (msg.id || index) ? (
                                <VolumeX className="w-3.5 h-3.5 text-rose-400" />
                              ) : (
                                <Volume2 className="w-3.5 h-3.5" />
                              )}
                            </button>
                            <button
                              onClick={() => regenerateMessage(index)}
                              className="p-1 hover:text-white rounded hover:bg-zinc-800/60 transition-colors"
                              title="Regenerate"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                            </button>
                            <button className="p-1 hover:text-white rounded hover:bg-zinc-800/60 transition-colors" title="Helpful response">
                              <ThumbsUp className="w-3.5 h-3.5" />
                            </button>
                            <button className="p-1 hover:text-white rounded hover:bg-zinc-800/60 transition-colors" title="Unhelpful response">
                              <ThumbsDown className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}

          {/* Typing Pulse Indicator during Generation */}
          {isGenerating && (
            <div className="flex items-center gap-2.5 text-zinc-400 text-xs py-2 animate-in fade-in">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
              <span className="font-medium text-zinc-300">NamoGPT is thinking & streaming response...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Floating Scroll to Bottom Button */}
      {showScrollBottom && (
        <button
          onClick={scrollToBottom}
          className="absolute bottom-5 right-8 p-2.5 rounded-full bg-zinc-900/90 border border-zinc-700/80 text-zinc-300 hover:text-white shadow-xl hover:scale-105 transition-all z-20 backdrop-blur-md"
          title="Scroll to bottom"
        >
          <ArrowDown className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
