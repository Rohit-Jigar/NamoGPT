import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useChat } from '../context/ChatContext';
import { useToast } from '../context/ToastContext';
import {
  ArrowUp,
  Square,
  Paperclip,
  Mic,
  MicOff,
  X,
  FileText,
  Globe,
  Brain,
  Compass,
  Bot,
  Sparkles,
  AlertCircle
} from 'lucide-react';

export default function ChatInput() {
  const {
    sendMessage,
    isGenerating,
    stopGeneration,
    isWebSearchEnabled,
    setIsWebSearchEnabled,
    isThinkingModeEnabled,
    setIsThinkingModeEnabled,
    setIsDeepResearchOpen,
    setIsPersonaOpen,
    currentPersona
  } = useChat();

  const { showFileUploadError, showMicError } = useToast();

  const [prompt, setPrompt] = useState('');
  const [attachment, setAttachment] = useState(null);
  const [isListening, setIsListening] = useState(false);
  const [fileError, setFileError] = useState(null);

  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const recognitionRef = useRef(null);

  // Auto-resize textarea smoothly with max height clamp
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(
        textareaRef.current.scrollHeight,
        220
      )}px`;
    }
  }, [prompt]);

  // Web Speech Recognition for voice dictation with edge-case error handling
  useEffect(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onresult = (event) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        setPrompt((prev) => (prev ? `${prev} ${transcript}` : transcript));
      };

      recognition.onerror = (event) => {
        setIsListening(false);
        if (event.error && event.error !== 'aborted') {
          showMicError(event.error);
        }
      };
      recognition.onend = () => setIsListening(false);

      recognitionRef.current = recognition;
    }
  }, [showMicError]);

  function toggleSpeech() {
    if (!recognitionRef.current) {
      showMicError('not-supported');
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (err) {
        console.warn('Speech start error:', err);
        showMicError('not-allowed');
        setIsListening(false);
      }
    }
  }

  // File select with size validation (>20MB) and format whitelist verification
  const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB strict limit

  function handleFileSelect(e) {
    setFileError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    // Check size (>20MB rejection)
    if (file.size > MAX_FILE_SIZE) {
      const sizeMb = file.size / (1024 * 1024);
      const errMsg = `File exceeds 20MB limit (${sizeMb.toFixed(1)}MB).`;
      setFileError(errMsg);
      showFileUploadError(file.name, 'size', sizeMb);
      e.target.value = '';
      return;
    }

    // Supported file validation
    const allowedExtensions = /\.(png|jpe?g|webp|gif|svg|bmp|pdf|txt|md|csv|json|js|jsx|ts|tsx|html|css|py|java|c|cpp|h|hpp|rs|go|sh|yml|yaml|xml|sql|docx|rtf)$/i;
    const isImage = file.type.startsWith('image/');
    const isSupportedDoc =
      file.type.startsWith('text/') ||
      file.type === 'application/pdf' ||
      file.type === 'application/json' ||
      file.type.includes('spreadsheet') ||
      file.type.includes('document') ||
      file.type.includes('csv') ||
      allowedExtensions.test(file.name);

    if (!isImage && !isSupportedDoc) {
      const errMsg = `Unsupported file format: ${file.name}`;
      setFileError(errMsg);
      showFileUploadError(file.name, 'type');
      e.target.value = '';
      return;
    }

    if (isImage) {
      const reader = new FileReader();
      reader.onload = (uploadEvent) => {
        setAttachment({
          name: file.name,
          type: file.type,
          size: file.size,
          dataUrl: uploadEvent.target?.result
        });
      };
      reader.readAsDataURL(file);
    } else {
      const reader = new FileReader();
      reader.onload = (uploadEvent) => {
        const text = uploadEvent.target?.result || '';
        setAttachment({
          name: file.name,
          type: file.type || 'text/plain',
          size: file.size,
          textContent: text,
          isDocument: true
        });
      };
      reader.readAsText(file);
    }
    e.target.value = '';
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  function handleSubmit() {
    if (isGenerating) {
      stopGeneration();
      return;
    }
    if (!prompt.trim() && !attachment) return;

    sendMessage(prompt, attachment);
    setPrompt('');
    setAttachment(null);
    setFileError(null);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }

  // Token estimate: ~4 chars per token rule of thumb
  const estimatedTokens = useMemo(() => {
    return Math.ceil((prompt.length || 0) / 4);
  }, [prompt]);

  return (
    <div className="p-3 sm:p-4 bg-gradient-to-t from-[#09090b] via-[#09090b]/95 to-transparent shrink-0 select-none z-20">
      <div className="max-w-4xl mx-auto w-full space-y-2">
        {/* File Size Error Alert */}
        {fileError && (
          <div className="flex items-center justify-between p-2.5 px-3 rounded-2xl bg-rose-950/60 border border-rose-500/40 text-xs text-rose-300 animate-in fade-in">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400" />
              <span>{fileError}</span>
            </div>
            <button
              onClick={() => setFileError(null)}
              className="p-1 hover:text-white rounded"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Attachment Preview Chips */}
        {attachment && (
          <div className="flex items-center gap-2.5 p-2 rounded-2xl bg-zinc-900/95 border border-zinc-800 w-fit max-w-sm animate-in fade-in duration-150 shadow-xl backdrop-blur-md">
            {attachment.dataUrl?.startsWith('data:image') ? (
              <img
                src={attachment.dataUrl}
                alt="preview"
                className="w-10 h-10 rounded-xl object-cover border border-zinc-700/60 shadow-sm"
              />
            ) : (
              <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center shrink-0">
                <FileText className="w-5 h-5 text-sky-400" />
              </div>
            )}
            <div className="text-xs truncate">
              <div className="font-semibold text-zinc-100 truncate max-w-[190px]">
                {attachment.name}
              </div>
              <div className="text-[10px] text-zinc-400 font-mono">
                {attachment.isDocument
                  ? `${Math.round((attachment.textContent?.length || 0) / 100) / 10}k chars • Document RAG`
                  : attachment.size
                  ? `${Math.round(attachment.size / 1024)} KB`
                  : 'Image Attached'}
              </div>
            </div>
            <button
              onClick={() => setAttachment(null)}
              className="p-1.5 hover:text-rose-400 text-zinc-400 rounded-full hover:bg-zinc-800 ml-1.5 transition-colors"
              title="Remove attachment"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Google Stitch Floating Capsule Bar with Glowing Border on Focus */}
        <div className="relative flex flex-col rounded-3xl border border-zinc-800/90 bg-[#121215]/95 focus-within:border-sky-500/60 focus-within:ring-2 focus-within:ring-sky-500/50 focus-within:shadow-[0_0_26px_rgba(56,189,248,0.18)] shadow-2xl transition-all duration-200 backdrop-blur-2xl">
          <textarea
            ref={textareaRef}
            rows={1}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              isListening
                ? '🎙️ Listening... Speak naturally into your microphone'
                : 'Ask NamoGPT anything, build a component, or explore ideas...'
            }
            className="w-full bg-transparent text-sm text-zinc-100 placeholder-zinc-500 px-4 pt-3.5 pb-2 outline-none resize-none max-h-52 leading-relaxed font-sans"
          />

          {/* Action Row & Feature Toggles */}
          <div className="flex items-center justify-between px-3 pb-2.5 pt-1 gap-2">
            {/* Left Quick Feature Toggle Pills */}
            <div className="flex items-center space-x-1 overflow-x-auto no-scrollbar flex-1 min-w-0 py-0.5">
              {/* File Upload Trigger */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,.txt,.md,.json,.csv,.pdf,.py,.js"
                className="hidden"
                onChange={handleFileSelect}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-2 rounded-xl text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/80 transition-colors"
                title="Attach image for Multimodal Vision or PDF/CSV/TXT for RAG context (Max 15MB)"
              >
                <Paperclip className="w-4 h-4" />
              </button>

              {/* Voice Dictation Toggle with Active Pulse Animation */}
              <button
                type="button"
                onClick={toggleSpeech}
                className={`p-2 rounded-xl transition-all ${
                  isListening
                    ? 'text-rose-300 bg-rose-500/25 border border-rose-500/50 ring-2 ring-rose-500/30 animate-pulse shadow-md shadow-rose-950/40'
                    : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/80 border border-transparent'
                }`}
                title={
                  isListening
                    ? 'Listening... Click to stop voice dictation'
                    : 'Voice input (Web Speech Recognition)'
                }
              >
                {isListening ? (
                  <MicOff className="w-4 h-4 text-rose-300" />
                ) : (
                  <Mic className="w-4 h-4" />
                )}
              </button>

              {/* 🌐 Web Search Toggle Pill */}
              <button
                type="button"
                onClick={() => setIsWebSearchEnabled(!isWebSearchEnabled)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-medium transition-all ${
                  isWebSearchEnabled
                    ? 'bg-sky-500/20 text-sky-300 border border-sky-400/50 shadow-md shadow-sky-500/25 ring-1 ring-sky-500/30'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/70 border border-transparent'
                }`}
                title={
                  isWebSearchEnabled
                    ? 'Live Web Search: Active (Click to disable) • Grounding with verified real-time sources'
                    : 'Live Web Search: Off (Click to enable) • Automatically searches live web'
                }
              >
                <Globe
                  className={`w-3.5 h-3.5 transition-all ${
                    isWebSearchEnabled
                      ? 'text-sky-300 drop-shadow-[0_0_6px_rgba(56,189,248,0.7)]'
                      : ''
                  }`}
                />
                <span className="text-[11px] font-medium">Search</span>
              </button>

              {/* 🧠 Thinking Mode Toggle Pill (DeepSeek R1) */}
              <button
                type="button"
                onClick={() => setIsThinkingModeEnabled(!isThinkingModeEnabled)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-medium transition-all ${
                  isThinkingModeEnabled
                    ? 'bg-violet-500/20 text-violet-300 border border-violet-400/50 shadow-md shadow-violet-500/25 ring-1 ring-violet-500/30'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/70 border border-transparent'
                }`}
                title={
                  isThinkingModeEnabled
                    ? 'Chain-of-Thought Reasoning Active (DeepSeek R1)'
                    : 'Enable Thinking Mode (Step-by-step reasoning)'
                }
              >
                <Brain
                  className={`w-3.5 h-3.5 transition-all ${
                    isThinkingModeEnabled
                      ? 'text-violet-300 drop-shadow-[0_0_6px_rgba(167,139,250,0.7)]'
                      : ''
                  }`}
                />
                <span className="text-[11px] font-medium">Think (R1)</span>
              </button>

              {/* 🧭 Autonomous Deep Research Trigger */}
              <button
                type="button"
                onClick={() => setIsDeepResearchOpen(true)}
                className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-medium text-zinc-400 hover:text-indigo-300 hover:bg-indigo-500/10 transition-all border border-transparent hover:border-indigo-500/30"
                title="Autonomous Deep Research Mode (Multi-source query synthesis)"
              >
                <Compass className="w-3.5 h-3.5 text-indigo-400" />
                <span className="text-[11px]">Research</span>
              </button>

              {/* AI Persona Quick Button */}
              <button
                type="button"
                onClick={() => setIsPersonaOpen(true)}
                className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-medium text-zinc-400 hover:text-teal-300 hover:bg-teal-500/10 transition-all border border-transparent hover:border-teal-500/30"
                title={`AI Persona: ${
                  currentPersona?.name || 'Standard'
                } (Specialized prompt intelligence)`}
              >
                <Bot className="w-3.5 h-3.5 text-teal-400" />
                <span className="text-[11px] truncate max-w-[85px]">
                  {currentPersona?.name || 'Persona'}
                </span>
              </button>
            </div>

            {/* Right: Character / Token Estimate & Send Button */}
            <div className="flex items-center gap-2 shrink-0">
              {/* Token & Character Estimate Indicator */}
              {prompt.length > 0 && (
                <div className="hidden xs:flex items-center gap-1 text-[10px] text-zinc-500 font-mono select-none pr-1">
                  <span>~{estimatedTokens} tok</span>
                  <span>•</span>
                  <span>{prompt.length}c</span>
                </div>
              )}

              {/* Send or Stop Button with Smooth Animated States */}
              <button
                onClick={handleSubmit}
                disabled={!isGenerating && !prompt.trim() && !attachment}
                className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-all duration-200 ${
                  isGenerating
                    ? 'bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 border border-rose-500/40 shadow-md shadow-rose-950/40 active:scale-95'
                    : prompt.trim() || attachment
                    ? 'bg-gradient-to-tr from-sky-500 to-emerald-500 hover:from-sky-400 hover:to-emerald-400 text-white shadow-lg shadow-sky-500/30 hover:scale-105 active:scale-95'
                    : 'bg-zinc-800 text-zinc-600 border border-zinc-700/40 cursor-not-allowed'
                }`}
                title={
                  isGenerating
                    ? 'Stop generating response'
                    : 'Send prompt (Enter) • Auto-routed with smart failover'
                }
              >
                {isGenerating ? (
                  <Square className="w-3.5 h-3.5 fill-current" />
                ) : (
                  <ArrowUp className="w-4 h-4 stroke-[2.5]" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Google Stitch Canvas Footer Disclaimer */}
        <p className="text-center text-[10px] text-zinc-500 select-none tracking-tight">
          NamoGPT Google Stitch AI Canvas • LiteLLM Smart Router & Live Grounding Engine
        </p>
      </div>
    </div>
  );
}
