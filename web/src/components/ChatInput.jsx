import React, { useState, useRef, useEffect } from 'react';
import { useChat } from '../context/ChatContext';
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
  Sparkles
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

  const [prompt, setPrompt] = useState('');
  const [attachment, setAttachment] = useState(null);
  const [isListening, setIsListening] = useState(false);

  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const recognitionRef = useRef(null);

  // Auto-resize textarea smoothly
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 220)}px`;
    }
  }, [prompt]);

  // Web Speech Recognition
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
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

      recognition.onerror = () => setIsListening(false);
      recognition.onend = () => setIsListening(false);

      recognitionRef.current = recognition;
    }
  }, []);

  function toggleSpeech() {
    if (!recognitionRef.current) {
      alert('Speech recognition is not supported in this browser. Please use Chrome or Safari.');
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

  function handleFileSelect(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    const isImage = file.type.startsWith('image/');

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
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }

  return (
    <div className="p-3 sm:p-4 bg-gradient-to-t from-[#09090b] via-[#09090b] to-transparent shrink-0 select-none z-20">
      <div className="max-w-3xl mx-auto w-full space-y-2">
        {/* Attachment Pill Preview */}
        {attachment && (
          <div className="flex items-center gap-2.5 p-2 rounded-2xl bg-zinc-900/95 border border-zinc-800 w-fit max-w-sm animate-in fade-in duration-150 shadow-lg backdrop-blur-md">
            {attachment.dataUrl?.startsWith('data:image') ? (
              <img
                src={attachment.dataUrl}
                alt="preview"
                className="w-10 h-10 rounded-xl object-cover border border-zinc-700/60 shadow-sm"
              />
            ) : (
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                <FileText className="w-5 h-5 text-emerald-400" />
              </div>
            )}
            <div className="text-xs truncate">
              <div className="font-semibold text-zinc-100 truncate max-w-[180px]">{attachment.name}</div>
              <div className="text-[10px] text-zinc-400 font-mono">
                {attachment.isDocument
                  ? `${Math.round((attachment.textContent?.length || 0) / 100) / 10}k chars • Document Context`
                  : attachment.size
                  ? `${Math.round(attachment.size / 1024)} KB`
                  : 'Image Attached'}
              </div>
            </div>
            <button
              onClick={() => setAttachment(null)}
              className="p-1 hover:text-rose-400 text-zinc-400 rounded-full hover:bg-zinc-800 ml-2 transition-colors"
              title="Remove attachment"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Floating shadcn Prompt Form Container */}
        <div className="relative flex flex-col rounded-3xl border border-zinc-800/90 bg-[#121215]/95 focus-within:border-zinc-700 focus-within:ring-2 focus-within:ring-emerald-500/20 shadow-2xl transition-all backdrop-blur-xl">
          <textarea
            ref={textareaRef}
            rows={1}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isListening ? 'Listening... Speak into your microphone' : 'Ask NamoGPT anything or type your prompt...'}
            className="w-full bg-transparent text-sm text-zinc-100 placeholder-zinc-500 px-4 pt-3.5 pb-2 outline-none resize-none max-h-52 leading-relaxed font-sans"
          />

          {/* Action Row */}
          <div className="flex items-center justify-between px-3 pb-2.5 pt-1 gap-2">
            {/* Left Tools (horizontal scrollable on mobile) */}
            <div className="flex items-center space-x-1 overflow-x-auto no-scrollbar flex-1 min-w-0 py-0.5">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,.txt,.md,.json,.csv,.pdf"
                className="hidden"
                onChange={handleFileSelect}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-2 rounded-xl text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/80 transition-colors"
                title="Attach image, document, or code"
              >
                <Paperclip className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={toggleSpeech}
                className={`p-2 rounded-xl transition-all ${
                  isListening
                    ? 'text-rose-400 bg-rose-500/20 animate-pulse'
                    : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/80'
                }`}
                title={isListening ? 'Stop recording' : 'Voice input'}
              >
                {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>

              {/* Web Search Toggle Pill */}
              <button
                type="button"
                onClick={() => setIsWebSearchEnabled(!isWebSearchEnabled)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-medium transition-all ${
                  isWebSearchEnabled
                    ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30 shadow-sm shadow-blue-500/10'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/70 border border-transparent'
                }`}
                title={isWebSearchEnabled ? 'Live internet web search enabled' : 'Enable live internet search'}
              >
                <Globe className={`w-3.5 h-3.5 ${isWebSearchEnabled ? 'text-blue-400' : ''}`} />
                <span className="text-[11px]">Search</span>
              </button>

              {/* Thinking Mode Toggle Pill */}
              <button
                type="button"
                onClick={() => setIsThinkingModeEnabled(!isThinkingModeEnabled)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-medium transition-all ${
                  isThinkingModeEnabled
                    ? 'bg-purple-500/15 text-purple-400 border border-purple-500/30 shadow-sm shadow-purple-500/10'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/70 border border-transparent'
                }`}
                title={isThinkingModeEnabled ? 'Step-by-step thinking & chain of thought active' : 'Enable thinking mode'}
              >
                <Brain className={`w-3.5 h-3.5 ${isThinkingModeEnabled ? 'text-purple-400' : ''}`} />
                <span className="text-[11px]">Think</span>
              </button>

              {/* Autonomous Deep Research Button */}
              <button
                type="button"
                onClick={() => setIsDeepResearchOpen(true)}
                className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-medium text-zinc-400 hover:text-indigo-300 hover:bg-indigo-500/10 transition-all border border-transparent hover:border-indigo-500/30"
                title="Open Deep Research Mode"
              >
                <Compass className="w-3.5 h-3.5 text-indigo-400" />
                <span className="text-[11px]">Research</span>
              </button>

              {/* AI Persona Quick Button */}
              <button
                type="button"
                onClick={() => setIsPersonaOpen(true)}
                className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-medium text-zinc-400 hover:text-emerald-300 hover:bg-emerald-500/10 transition-all border border-transparent hover:border-emerald-500/30"
                title={`Active Persona: ${currentPersona?.name || 'Standard'}`}
              >
                <Bot className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-[11px] truncate max-w-[85px]">{currentPersona?.name || 'Persona'}</span>
              </button>
            </div>

            {/* Right: Send or Stop Button (shadcn-style high-contrast button) */}
            <button
              onClick={handleSubmit}
              disabled={!isGenerating && !prompt.trim() && !attachment}
              className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-all ${
                isGenerating
                  ? 'bg-zinc-100 text-zinc-950 hover:bg-white shadow-md'
                  : prompt.trim() || attachment
                  ? 'bg-zinc-100 text-zinc-950 hover:bg-white shadow-md hover:scale-105 active:scale-95'
                  : 'bg-zinc-800 text-zinc-600 cursor-not-allowed'
              }`}
              title={isGenerating ? 'Stop generating' : 'Send message (Enter)'}
            >
              {isGenerating ? (
                <Square className="w-3.5 h-3.5 fill-current" />
              ) : (
                <ArrowUp className="w-4 h-4 stroke-[2.5]" />
              )}
            </button>
          </div>
        </div>

        {/* Clean Footer Disclaimer */}
        <p className="text-center text-[10px] text-zinc-500 select-none tracking-tight">
          NamoGPT AI Assistant • Powered by LiteLLM Multi-Model Orchestration & MCP Extensions
        </p>
      </div>
    </div>
  );
}
