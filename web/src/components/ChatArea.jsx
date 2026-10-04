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
  Code,
  ArrowDown,
  FileText
} from 'lucide-react';

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
    // Strip markdown formatting for cleaner speech
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
      title: "🚀 Build a Fullstack App",
      prompt: "Write a complete modern fullstack application architecture with Node.js Express backend and React Tailwind frontend."
    },
    {
      title: "🧠 Quantum Physics & Math",
      prompt: "Explain Quantum Entanglement and the Bell Inequality with mathematical equations and intuitive physical analogies."
    },
    {
      title: "💻 Python Async Optimization",
      prompt: "Show how to optimize Python async I/O web scrapers with concurrency pools, retry exponential backoff, and type hints."
    },
    {
      title: "✍️ Executive Tech Proposal",
      prompt: "Draft a high-impact executive proposal for migrating monolith infrastructure to cloud-native microservices."
    }
  ];

  const messages = currentChat?.messages || [];

  return (
    <div className="flex-1 flex flex-col relative overflow-hidden bg-[#212121]">
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 md:px-0 py-6"
      >
        <div className="max-w-3xl mx-auto w-full space-y-6">
          {/* Empty State Welcome */}
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4 animate-in fade-in duration-300">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-500/20 to-teal-500/10 border border-emerald-500/30 flex items-center justify-center mb-6 shadow-xl shadow-emerald-950/20">
                <Sparkles className="w-8 h-8 text-emerald-400" />
              </div>

              <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-white mb-2">
                What can I help with today?
              </h1>
              <p className="text-zinc-400 text-sm max-w-md mb-8">
                NamoGPT connects to free state-of-the-art models via LiteLLM including Gemini, Groq, DeepSeek R1, and NVIDIA.
              </p>

              {/* Suggestions Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-2xl">
                {promptSuggestions.map((item, idx) => (
                  <button
                    key={idx}
                    onClick={() => sendMessage(item.prompt)}
                    className="p-4 rounded-2xl bg-[#171717] hover:bg-[#2f2f2f] border border-[#303030] text-left transition-all hover:scale-[1.01] hover:border-zinc-500/50 shadow-sm group"
                  >
                    <div className="font-medium text-sm text-zinc-200 group-hover:text-emerald-400 transition-colors mb-1">
                      {item.title}
                    </div>
                    <div className="text-xs text-zinc-400 line-clamp-2 leading-relaxed">
                      {item.prompt}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* Messages Stream */
            messages.map((msg, index) => {
              const isUser = msg.role === 'user';
              const isEditing = editingIndex === index;

              // Check for <think> reasoning tags
              let reasoningContent = '';
              let finalContent = msg.content || '';
              if (!isUser && finalContent.includes('<think>')) {
                const match = finalContent.match(/<think>([\s\S]*?)<\/think>/);
                if (match) {
                  reasoningContent = match[1].trim();
                  finalContent = finalContent.replace(/<think>[\s\S]*?<\/think>/, '').trim();
                }
              }

              return (
                <div
                  key={msg.id || index}
                  className={`flex items-start gap-4 ${isUser ? 'justify-end' : 'justify-start'} group`}
                >
                  {/* Assistant Avatar */}
                  {!isUser && (
                    <div className="w-8 h-8 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
                      <Sparkles className="w-4 h-4 text-emerald-400" />
                    </div>
                  )}

                  {/* Message Bubble */}
                  <div className={`max-w-[88%] md:max-w-[85%] ${isUser ? 'order-1' : 'order-2'}`}>
                    {/* User Edit Mode */}
                    {isEditing ? (
                      <div className="bg-[#2f2f2f] rounded-2xl p-3 border border-emerald-500/40 space-y-2">
                        <textarea
                          value={editPrompt}
                          onChange={(e) => setEditPrompt(e.target.value)}
                          className="w-full bg-transparent text-sm text-white outline-none resize-none"
                          rows={3}
                        />
                        <div className="flex justify-end gap-2 text-xs">
                          <button
                            onClick={() => setEditingIndex(null)}
                            className="px-3 py-1 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-zinc-300"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => {
                              editAndResend(index, editPrompt);
                              setEditingIndex(null);
                            }}
                            className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium"
                          >
                            Save & Submit
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div
                        className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                          isUser
                            ? 'bg-[#2f2f2f] text-white rounded-tr-none'
                            : 'bg-transparent text-zinc-200 px-0'
                        }`}
                      >
                        {/* Attachment Preview (if any) */}
                        {msg.attachment && (
                          <div className="mb-2 p-2 rounded-xl bg-zinc-800/80 border border-zinc-700/60 flex items-center gap-2 max-w-xs">
                            {msg.attachment.dataUrl?.startsWith('data:image') ? (
                              <img
                                src={msg.attachment.dataUrl}
                                alt="attachment"
                                className="w-12 h-12 rounded object-cover"
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

                        {/* Collapsible Reasoning Block (DeepSeek R1) */}
                        {reasoningContent && (
                          <div className="mb-3 rounded-xl border border-purple-500/30 bg-purple-950/20 overflow-hidden">
                            <button
                              onClick={() =>
                                setOpenReasoning((prev) => ({ ...prev, [msg.id]: !prev[msg.id] }))
                              }
                              className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-purple-300 hover:bg-purple-900/30 transition-colors"
                            >
                              <div className="flex items-center gap-1.5">
                                <Brain className="w-3.5 h-3.5 text-purple-400" />
                                <span>Chain of Thought Reasoning</span>
                              </div>
                              {openReasoning[msg.id] ? (
                                <ChevronDown className="w-3.5 h-3.5" />
                              ) : (
                                <ChevronRight className="w-3.5 h-3.5" />
                              )}
                            </button>
                            {openReasoning[msg.id] && (
                              <div className="p-3 text-xs text-zinc-300 font-mono bg-black/20 border-t border-purple-500/20 whitespace-pre-wrap leading-relaxed">
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
                                  const codeBlockId = `code-${Math.random()}`;
                                  return (
                                    <div className="my-3 rounded-xl border border-zinc-800 bg-[#171717] overflow-hidden">
                                      <div className="flex items-center justify-between px-3 py-1.5 bg-[#212121] border-b border-zinc-800 text-[11px] font-mono text-zinc-400">
                                        <div className="flex items-center gap-1.5">
                                          <Code className="w-3.5 h-3.5 text-emerald-400" />
                                          <span>{lang}</span>
                                        </div>
                                        <button
                                          onClick={() => copyToClipboard(codeStr, codeBlockId)}
                                          className="flex items-center gap-1 text-zinc-400 hover:text-white transition-colors"
                                        >
                                          {copiedId === codeBlockId ? (
                                            <>
                                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                                              <span className="text-emerald-400">Copied!</span>
                                            </>
                                          ) : (
                                            <>
                                              <Copy className="w-3.5 h-3.5" />
                                              <span>Copy code</span>
                                            </>
                                          )}
                                        </button>
                                      </div>
                                      <pre className="p-3.5 overflow-x-auto text-xs font-mono text-emerald-300/90 leading-relaxed bg-[#141414]">
                                        <code>{children}</code>
                                      </pre>
                                    </div>
                                  );
                                }
                                return (
                                  <code className="bg-zinc-800 text-emerald-300 px-1.5 py-0.5 rounded text-[13px] font-mono" {...props}>
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
                        className={`flex items-center gap-1 mt-1 text-zinc-500 text-xs transition-opacity ${
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
                              className="p-1 hover:text-white transition-colors"
                              title="Edit message"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => copyToClipboard(msg.content, msg.id || index)}
                              className="p-1 hover:text-white transition-colors"
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
                              className="p-1 hover:text-white transition-colors"
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
                              className="p-1 hover:text-white transition-colors"
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
                              className="p-1 hover:text-white transition-colors"
                              title="Regenerate"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                            </button>
                            <button className="p-1 hover:text-white transition-colors" title="Good response">
                              <ThumbsUp className="w-3.5 h-3.5" />
                            </button>
                            <button className="p-1 hover:text-white transition-colors" title="Bad response">
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
            <div className="flex items-center gap-2 text-zinc-400 text-xs py-2">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span>NamoGPT is thinking & streaming...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Floating Scroll to Bottom Button */}
      {showScrollBottom && (
        <button
          onClick={scrollToBottom}
          className="absolute bottom-4 right-8 p-2 rounded-full bg-zinc-800 border border-zinc-700 text-zinc-300 hover:text-white shadow-xl hover:scale-105 transition-all z-10"
          title="Scroll to bottom"
        >
          <ArrowDown className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
