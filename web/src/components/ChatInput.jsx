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
  Image as ImageIcon,
  Globe,
  Brain,
  Compass,
  Bot
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

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [prompt]);

  // Web Speech Recognition setup
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
      // Read text-based document (txt, md, json, csv, py, js, etc.)
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
    e.target.value = ''; // Reset input
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
    <div className="p-4 bg-[#212121] shrink-0 border-t border-[#303030]/50 select-none">
      <div className="max-w-3xl mx-auto w-full space-y-2">
        {/* Attachment Pill Preview */}
        {attachment && (
          <div className="flex items-center gap-2 p-2 rounded-xl bg-zinc-800/95 border border-zinc-700/80 w-fit max-w-sm animate-in fade-in duration-150 shadow-md">
            {attachment.dataUrl?.startsWith('data:image') ? (
              <img
                src={attachment.dataUrl}
                alt="preview"
                className="w-10 h-10 rounded-lg object-cover border border-zinc-700/50"
              />
            ) : (
              <div className="w-10 h-10 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0">
                <FileText className="w-5 h-5 text-emerald-400" />
              </div>
            )}
            <div className="text-xs truncate">
              <div className="font-semibold text-white truncate max-w-[180px]">{attachment.name}</div>
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
              className="p-1 hover:text-rose-400 text-zinc-400 rounded-full hover:bg-zinc-700/60 ml-2 transition-colors"
              title="Remove attachment"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Input Card Container */}
        <div className="relative flex flex-col bg-[#2f2f2f] rounded-3xl border border-[#303030] focus-within:border-zinc-500 shadow-xl transition-all">
          <textarea
            ref={textareaRef}
            rows={1}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isListening ? 'Listening... Speak into your microphone' : 'Message NamoGPT...'}
            className="w-full bg-transparent text-sm text-white placeholder-zinc-400 px-4 pt-3.5 pb-2 outline-none resize-none max-h-48 leading-relaxed font-sans"
          />

          {/* Action Row */}
          <div className="flex items-center justify-between px-3 pb-2.5 pt-1 gap-2">
            {/* Left Tools: Attachment, Voice, Search, Think, etc. */}
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
                className="p-2 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-700/60 transition-colors"
                title="Attach image or document"
              >
                <Paperclip className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={toggleSpeech}
                className={`p-2 rounded-full transition-colors ${
                  isListening
                    ? 'text-rose-400 bg-rose-500/20 animate-pulse'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-700/60'
                }`}
                title={isListening ? 'Stop recording' : 'Voice input'}
              >
                {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>

              {/* Web Search Toggle */}
              <button
                type="button"
                onClick={() => setIsWebSearchEnabled(!isWebSearchEnabled)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                  isWebSearchEnabled
                    ? 'bg-blue-500/20 text-blue-400 border border-blue-500/40 shadow-sm shadow-blue-500/10'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-700/50'
                }`}
                title={isWebSearchEnabled ? 'Web search enabled (live internet results)' : 'Enable web search'}
              >
                <Globe className={`w-3.5 h-3.5 ${isWebSearchEnabled ? 'text-blue-400' : ''}`} />
                <span className="text-[11px]">Search</span>
              </button>

              {/* Thinking Mode Toggle */}
              <button
                type="button"
                onClick={() => setIsThinkingModeEnabled(!isThinkingModeEnabled)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                  isThinkingModeEnabled
                    ? 'bg-purple-500/20 text-purple-400 border border-purple-500/40 shadow-sm shadow-purple-500/10'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-700/50'
                }`}
                title={isThinkingModeEnabled ? 'Thinking mode enabled (step-by-step reasoning)' : 'Enable thinking mode'}
              >
                <Brain className={`w-3.5 h-3.5 ${isThinkingModeEnabled ? 'text-purple-400' : ''}`} />
                <span className="text-[11px]">Think</span>
              </button>

              {/* Autonomous Deep Research Button */}
              <button
                type="button"
                onClick={() => setIsDeepResearchOpen(true)}
                className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium text-zinc-400 hover:text-indigo-300 hover:bg-indigo-500/10 transition-all border border-transparent hover:border-indigo-500/30"
                title="Open Deep Research Mode"
              >
                <Compass className="w-3.5 h-3.5 text-indigo-400" />
                <span className="text-[11px]">Research</span>
              </button>

              {/* AI Persona Quick Button */}
              <button
                type="button"
                onClick={() => setIsPersonaOpen(true)}
                className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium text-zinc-400 hover:text-emerald-300 hover:bg-emerald-500/10 transition-all border border-transparent hover:border-emerald-500/30"
                title={`Active Persona: ${currentPersona?.name || 'Standard'}`}
              >
                <Bot className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-[11px] truncate max-w-[90px]">{currentPersona?.name || 'Persona'}</span>
              </button>
            </div>

            {/* Right: Send or Stop Button */}
            <button
              onClick={handleSubmit}
              disabled={!isGenerating && !prompt.trim() && !attachment}
              className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                isGenerating
                  ? 'bg-white text-black hover:bg-zinc-200'
                  : prompt.trim() || attachment
                  ? 'bg-white text-black hover:bg-zinc-200 shadow-md'
                  : 'bg-zinc-700/50 text-zinc-500 cursor-not-allowed'
              }`}
              title={isGenerating ? 'Stop generating' : 'Send message'}
            >
              {isGenerating ? (
                <Square className="w-3.5 h-3.5 fill-current" />
              ) : (
                <ArrowUp className="w-4 h-4 stroke-[2.5]" />
              )}
            </button>
          </div>
        </div>

        {/* Footer Disclaimer */}
        <p className="text-center text-[11px] text-zinc-500 select-none">
          NamoGPT can make mistakes. Check important info. LiteLLM multi-provider load balancing active.
        </p>
      </div>
    </div>
  );
}
