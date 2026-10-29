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

  // Web Speech Recognition for voice dictation
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
      }
    }
  }

  // Handle multi-format attachments
  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileError(null);

    // Max 15MB file upload limit
    if (file.size > 15 * 1024 * 1024) {
      const errMsg = `File size (${(file.size / (1024 * 1024)).toFixed(1)}MB) exceeds 15MB limit.`;
      setFileError(errMsg);
      showFileUploadError('file-too-large', file.name);
      return;
    }

    const isImage = file.type.startsWith('image/');
    const isDoc =
      file.type.includes('pdf') ||
      file.type.includes('text') ||
      file.type.includes('json') ||
      file.type.includes('csv') ||
      file.name.endsWith('.py') ||
      file.name.endsWith('.js') ||
      file.name.endsWith('.md');

    if (!isImage && !isDoc) {
      const errMsg = `File type not supported. Please upload an image, PDF, CSV, TXT, or code file.`;
      setFileError(errMsg);
      showFileUploadError('invalid-type', file.name);
      return;
    }

    const reader = new FileReader();

    if (isImage) {
      reader.onload = () => {
        setAttachment({
          type: 'image',
          name: file.name,
          size: file.size,
          dataUrl: reader.result
        });
      };
      reader.readAsDataURL(file);
    } else {
      reader.onload = () => {
        setAttachment({
          type: 'document',
          name: file.name,
          size: file.size,
          textContent: reader.result,
          isDocument: true
        });
      };
      reader.readAsText(file);
    }
    e.target.value = '';
  };

  const handleSubmit = (e) => {
    e?.preventDefault();
    if (isGenerating) {
      stopGeneration();
      return;
    }

    const trimmed = prompt.trim();
    if (!trimmed && !attachment) return;

    sendMessage(trimmed, attachment);
    setPrompt('');
    setAttachment(null);
    setFileError(null);

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // Estimate token consumption (~4 characters per token heuristic)
  const estimatedTokens = useMemo(() => {
    return Math.max(1, Math.round(prompt.length / 4));
  }, [prompt]);

  return (
    <div className="p-3 sm:p-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] bg-gradient-to-t from-[#0D0B0A] via-[#0D0B0A]/95 to-transparent shrink-0 select-none z-20">
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
          <div className="flex items-center gap-2.5 p-2 rounded-2xl bg-[#1A1613] border border-[#E5E4E2]/15 w-fit max-w-sm animate-in fade-in duration-150 shadow-xl backdrop-blur-md">
            {attachment.dataUrl?.startsWith('data:image') ? (
              <img
                src={attachment.dataUrl}
                alt="preview"
                className="w-10 h-10 rounded-xl object-cover border border-[#E5E4E2]/15 shadow-sm"
              />
            ) : (
              <div className="w-10 h-10 rounded-xl bg-[#6F4E37]/20 border border-[#6F4E37] flex items-center justify-center shrink-0">
                <FileText className="w-5 h-5 text-[#E6E0F0]" />
              </div>
            )}
            <div className="text-xs truncate">
              <div className="font-semibold text-[#FAF9F8] truncate max-w-[190px]">
                {attachment.name}
              </div>
              <div className="text-[10px] text-[#BDB8B3] font-mono">
                {attachment.isDocument
                  ? `${Math.round((attachment.textContent?.length || 0) / 100) / 10}k chars • Document RAG`
                  : attachment.size
                  ? `${Math.round(attachment.size / 1024)} KB`
                  : 'Image Attached'}
              </div>
            </div>
            <button
              onClick={() => setAttachment(null)}
              className="p-1.5 hover:text-rose-400 text-[#BDB8B3] rounded-full hover:bg-[#241E1A] ml-1.5 transition-colors"
              title="Remove attachment"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Tactile Capsule Input Bar */}
        <div className="relative flex flex-col rounded-2xl border border-[#E5E4E2]/15 bg-[#13100E] focus-within:border-[#6F4E37] focus-within:ring-1 focus-within:ring-[#E6E0F0]/30 focus-within:shadow-[0_0_24px_rgba(111,78,55,0.22)] shadow-2xl transition-all duration-200 backdrop-blur-2xl">
          <textarea
            ref={textareaRef}
            rows={1}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              isListening
                ? '🎙️ Listening... Speak naturally into your microphone'
                : 'Send instruction, synthesize code, or explore an architectural query...'
            }
            className="w-full bg-transparent text-sm text-[#FAF9F8] placeholder-[#7A7570] px-4 pt-3.5 pb-2 outline-none resize-none max-h-52 leading-relaxed font-sans"
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
                className="min-w-[36px] min-h-[36px] flex items-center justify-center p-2 rounded-xl text-[#BDB8B3] hover:text-[#FAF9F8] hover:bg-[#241E1A] transition-colors"
                title="Attach image for Multimodal Vision or PDF/CSV/TXT for RAG context (Max 15MB)"
              >
                <Paperclip className="w-4 h-4" />
              </button>

              {/* Voice Dictation Toggle */}
              <button
                type="button"
                onClick={toggleSpeech}
                className={`min-w-[36px] min-h-[36px] flex items-center justify-center p-2 rounded-xl transition-all ${
                  isListening
                    ? 'text-rose-300 bg-rose-500/25 border border-rose-500/50 ring-2 ring-rose-500/30 animate-pulse shadow-md shadow-rose-950/40'
                    : 'text-[#BDB8B3] hover:text-[#FAF9F8] hover:bg-[#241E1A] border border-transparent'
                }`}
                title={
                  isListening
                    ? 'Listening... Click to stop voice dictation'
                    : 'Voice input'
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
                className={`min-h-[36px] flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                  isWebSearchEnabled
                    ? 'bg-[#6F4E37]/40 text-[#FAF9F8] border border-[#6F4E37] shadow-sm'
                    : 'text-[#BDB8B3] hover:text-[#FAF9F8] hover:bg-[#241E1A] border border-transparent'
                }`}
                title="Toggle live web grounding"
              >
                <Globe
                  className={`w-3.5 h-3.5 transition-all ${
                    isWebSearchEnabled ? 'text-[#E6E0F0]' : ''
                  }`}
                />
                <span className="text-[11px] font-medium">Search</span>
              </button>

              {/* 🧠 Thinking Mode Toggle Pill (DeepSeek R1) */}
              <button
                type="button"
                onClick={() => setIsThinkingModeEnabled(!isThinkingModeEnabled)}
                className={`min-h-[36px] flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                  isThinkingModeEnabled
                    ? 'bg-[#241E1A] text-[#E6E0F0] border border-[#E6E0F0]/50 shadow-sm'
                    : 'text-[#BDB8B3] hover:text-[#FAF9F8] hover:bg-[#241E1A] border border-transparent'
                }`}
                title="Toggle Chain-of-Thought reasoning (DeepSeek R1)"
              >
                <Brain
                  className={`w-3.5 h-3.5 transition-all ${
                    isThinkingModeEnabled ? 'text-[#E6E0F0]' : ''
                  }`}
                />
                <span className="text-[11px] font-medium">Think (R1)</span>
              </button>

              {/* 🧭 Autonomous Deep Research Trigger */}
              <button
                type="button"
                onClick={() => setIsDeepResearchOpen(true)}
                className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-medium text-[#BDB8B3] hover:text-[#FAF9F8] hover:bg-[#241E1A] transition-all border border-transparent"
                title="Autonomous Deep Research Mode"
              >
                <Compass className="w-3.5 h-3.5 text-[#E5E4E2]" />
                <span className="text-[11px]">Research</span>
              </button>

              {/* AI Persona Quick Button */}
              <button
                type="button"
                onClick={() => setIsPersonaOpen(true)}
                className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-medium text-[#BDB8B3] hover:text-[#FAF9F8] hover:bg-[#241E1A] transition-all border border-transparent"
                title={`AI Persona: ${currentPersona?.name || 'Standard'}`}
              >
                <Bot className="w-3.5 h-3.5 text-[#E6E0F0]" />
                <span className="text-[11px] truncate max-w-[85px]">
                  {currentPersona?.name || 'Persona'}
                </span>
              </button>
            </div>

            {/* Right: Character / Token Estimate & Send Button */}
            <div className="flex items-center gap-2 shrink-0">
              {prompt.length > 0 && (
                <div className="hidden xs:flex items-center gap-1 text-[10px] text-[#7A7570] font-mono select-none pr-1">
                  <span>~{estimatedTokens} tok</span>
                  <span>•</span>
                  <span>{prompt.length}c</span>
                </div>
              )}

              {/* Send or Stop Button */}
              <button
                onClick={handleSubmit}
                disabled={!isGenerating && !prompt.trim() && !attachment}
                className={`w-9 h-9 sm:w-8.5 sm:h-8.5 min-w-[36px] min-h-[36px] rounded-xl flex items-center justify-center shrink-0 transition-all duration-200 ${
                  isGenerating
                    ? 'bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 border border-rose-500/40 shadow-md active:scale-95'
                    : prompt.trim() || attachment
                    ? 'bg-[#6F4E37] hover:bg-[#8C6549] text-[#FAF9F8] shadow-md hover:scale-105 active:scale-95'
                    : 'bg-[#1A1613] text-[#7A7570] border border-[#E5E4E2]/10 cursor-not-allowed'
                }`}
                title={isGenerating ? 'Stop generating' : 'Send turn (Enter)'}
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

        {/* Footer Disclaimer */}
        <p className="text-center text-[10px] text-[#7A7570] select-none tracking-tight">
          NamoGPT High-Performance Cognitive Mesh • LiteLLM Smart Router & Live Grounding Engine
        </p>
      </div>
    </div>
  );
}
