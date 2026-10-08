import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { fetchAvailableModels, streamChatCompletion, searchWebAPI, DEFAULT_SERVER_URL } from '../services/api';
import { autoDetectMemory, getRelevantMemories, formatMemoryContext } from '../services/memory';
import { getAllPersonas } from '../services/personas';
import { formatMcpToolsPrompt } from '../services/mcp';
import { useAuth } from './AuthContext';

const ChatContext = createContext();

const STORAGE_KEY_CHATS = 'namogpt_chats_v1';
const STORAGE_KEY_SETTINGS = 'namogpt_settings_v1';
const STORAGE_KEY_PERSONA = 'namogpt_active_persona_v1';

export function ChatProvider({ children }) {
  const { token } = useAuth();

  // Chats State
  const [chats, setChats] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_CHATS);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [currentChatId, setCurrentChatId] = useState(null);
  const [models, setModels] = useState([]);
  const [selectedModel, setSelectedModel] = useState('auto');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStats, setGenerationStats] = useState(null); // { tps, elapsed }

  // Advanced Feature Toggles (ChatGPT-style Web Search & Thinking Mode)
  const [isWebSearchEnabled, setIsWebSearchEnabled] = useState(false);
  const [isThinkingModeEnabled, setIsThinkingModeEnabled] = useState(false);

  // UI Modals & Sidebar State
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isDeepResearchOpen, setIsDeepResearchOpen] = useState(false);
  const [isMemoryOpen, setIsMemoryOpen] = useState(false);
  const [isPersonaOpen, setIsPersonaOpen] = useState(false);
  const [isMcpOpen, setIsMcpOpen] = useState(false);

  // Active App Mode: 'chat' vs 'coder'
  const [activeAppMode, setActiveAppMode] = useState(() => {
    try {
      return localStorage.getItem('namo_app_mode') || 'chat';
    } catch {
      return 'chat';
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('namo_app_mode', activeAppMode);
    } catch {}
  }, [activeAppMode]);

  // Active AI Persona / Custom GPT
  const [currentPersona, setCurrentPersona] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_PERSONA);
      if (saved) return JSON.parse(saved);
    } catch {}
    return getAllPersonas()[0] || null;
  });

  useEffect(() => {
    if (currentPersona) {
      try {
        localStorage.setItem(STORAGE_KEY_PERSONA, JSON.stringify(currentPersona));
      } catch (err) {
        console.warn('Failed to persist active persona', err);
      }
    }
  }, [currentPersona]);

  // Settings State
  const [settings, setSettings] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_SETTINGS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.serverUrl && parsed.serverUrl.includes('github.io')) {
          parsed.serverUrl = DEFAULT_SERVER_URL;
        }
        return parsed;
      }
    } catch {}
    return {
      apiKeys: {
        gemini: '',
        groq: '',
        openrouter: '',
        nvidia: '',
        aion: '',
        cloudflare: '',
        ninerouter: '',
        omnirouter: ''
      },
      nineRouter: {
        enabled: true,
        baseUrl: 'http://localhost:20128/v1',
        apiKey: ''
      },
      omniRouter: {
        enabled: true,
        baseUrl: 'http://localhost:20128/v1',
        apiKey: ''
      },
      serverUrl: DEFAULT_SERVER_URL,
      temperature: 0.7,
      systemPrompt: 'You are NamoGPT, a versatile, articulate, and deeply intelligent AI assistant powered by multiple state-of-the-art models. Provide clean, well-structured, and insightful answers.',
      theme: 'dark'
    };
  });

  const abortControllerRef = useRef(null);

  // Save chats to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_CHATS, JSON.stringify(chats));
    } catch (e) {
      console.warn('Failed to persist chats to localStorage', e);
    }
  }, [chats]);

  // Save settings to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(settings));
    } catch (e) {
      console.warn('Failed to persist settings', e);
    }
  }, [settings]);

  // Load models on mount
  useEffect(() => {
    fetchAvailableModels(settings.serverUrl).then((fetched) => {
      if (fetched && fetched.length > 0) {
        setModels(fetched);
        if (!selectedModel) setSelectedModel(fetched[0].id);
      }
    });
  }, [settings.serverUrl]);

  // Select or create chat
  const currentChat = chats.find((c) => c.id === currentChatId) || null;

  function createNewChat(modelId = selectedModel) {
    const newId = `chat-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    const newChat = {
      id: newId,
      title: 'New Chat',
      model: modelId,
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isPinned: false
    };

    setChats((prev) => [newChat, ...prev]);
    setCurrentChatId(newId);
    setSelectedModel(modelId);
    return newId;
  }

  function selectChat(id) {
    setCurrentChatId(id);
    const chat = chats.find((c) => c.id === id);
    if (chat && chat.model) {
      setSelectedModel(chat.model);
    }
  }

  function deleteChat(id) {
    setChats((prev) => prev.filter((c) => c.id !== id));
    if (currentChatId === id) {
      const remaining = chats.filter((c) => c.id !== id);
      setCurrentChatId(remaining.length > 0 ? remaining[0].id : null);
    }
  }

  function renameChat(id, newTitle) {
    setChats((prev) =>
      prev.map((c) => (c.id === id ? { ...c, title: newTitle.trim() || 'Untitled Chat' } : c))
    );
  }

  function pinChat(id) {
    setChats((prev) =>
      prev.map((c) => (c.id === id ? { ...c, isPinned: !c.isPinned } : c))
    );
  }

  function clearAllChats() {
    setChats([]);
    setCurrentChatId(null);
  }

  function stopGeneration() {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsGenerating(false);
  }

  async function sendMessage(promptText, attachment = null) {
    if ((!promptText || !promptText.trim()) && !attachment) return;
    if (isGenerating) return;

    let chatId = currentChatId;
    if (!chatId) {
      chatId = createNewChat(selectedModel);
    }

    // 1. Long-Term Memory Auto-Detection & Context Injection
    if (promptText.trim()) {
      autoDetectMemory(promptText.trim());
    }
    const relevantMemories = getRelevantMemories(promptText.trim(), 3);
    const memoryContext = formatMemoryContext(relevantMemories);

    // 2. Attached Document Intelligence (Text / CSV / Markdown / JSON)
    let documentContext = '';
    if (attachment && attachment.textContent) {
      documentContext = `\n\n=== ATTACHED DOCUMENT: ${attachment.name} ===\n${attachment.textContent.slice(0, 16000)}\n=========================================\nInstructions: Base your response on the attached document content. Extract relevant data, analyze patterns, or answer questions with clear citations.\n\n`;
    }

    // 3. Real-time web search
    let searchResults = [];
    let searchContext = '';

    if (isWebSearchEnabled && promptText.trim()) {
      try {
        searchResults = await searchWebAPI(promptText.trim(), settings.serverUrl);
        if (searchResults.length > 0) {
          searchContext = '\n\n=== LIVE REAL-TIME WEB SEARCH RESULTS ===\n';
          searchResults.forEach((r, idx) => {
            searchContext += `[${idx + 1}] ${r.title}\nURL: ${r.url}\nSummary: ${r.snippet}\n\n`;
          });
          searchContext += 'Instructions: Synthesize the above web search results to answer the query accurately. Cite your references using Markdown links [Title](URL).\n=========================================\n\n';
        }
      } catch (err) {
        console.warn('Live web search error:', err);
      }
    }

    // Assemble final augmented prompt
    let augmentedPrompt = promptText.trim();
    if (documentContext || searchContext || memoryContext) {
      augmentedPrompt = `${memoryContext ? memoryContext + '\n\n' : ''}${documentContext}${searchContext}User Prompt: ${promptText.trim()}`;
    }

    const userMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: promptText.trim(),
      sources: searchResults.length > 0 ? searchResults : null,
      attachment: attachment ? {
        name: attachment.name,
        type: attachment.type,
        dataUrl: attachment.dataUrl
      } : null,
      createdAt: Date.now()
    };

    const assistantPlaceholderId = `msg-reply-${Date.now()}`;
    const assistantMessage = {
      id: assistantPlaceholderId,
      role: 'assistant',
      content: '',
      modelUsed: selectedModel,
      createdAt: Date.now()
    };

    // Auto-generate title from first prompt
    setChats((prev) =>
      prev.map((c) => {
        if (c.id !== chatId) return c;
        const isFirstMessage = c.messages.length === 0;
        const newTitle = isFirstMessage
          ? promptText.slice(0, 36) + (promptText.length > 36 ? '...' : '')
          : c.title;

        return {
          ...c,
          title: newTitle,
          messages: [...c.messages, userMessage, assistantMessage],
          updatedAt: Date.now()
        };
      })
    );

    setIsGenerating(true);
    const startTime = performance.now();
    let tokenCount = 0;

    const controller = new AbortController();
    abortControllerRef.current = controller;

    // Build payload messages
    const chatInstance = chats.find((c) => c.id === chatId);
    const historyMessages = chatInstance ? chatInstance.messages : [];

    // Temporal awareness: provide user's accurate local time, date, and timezone
    const userTz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    const now = new Date();
    const localTimeStr = now.toLocaleString('en-US', {
      dateStyle: 'full',
      timeStyle: 'medium',
      timeZone: userTz
    });
    const temporalContext = `[Local System Temporal Ground Truth]: Current User Local Date & Time is ${localTimeStr} (Timezone: ${userTz}). Use this as the definitive factual reference for any questions asking for current time, day of week, month, or year.`;

    // Multimodal image processing & Auto Router
    let effectiveModel = selectedModel;
    const hasImage = attachment && attachment.dataUrl?.startsWith('data:image');

    // Auto Mode (Smart Router) selection
    if (selectedModel === 'auto') {
      if (hasImage) {
        effectiveModel = 'groq-vision';
      } else if (isThinkingModeEnabled || /\b(proof|calculate|solve|derive|integral|differential|algorithm|complexity|benchmark)\b/i.test(promptText)) {
        effectiveModel = 'deepseek-r1';
      } else {
        effectiveModel = 'auto'; // backend LiteLLM smart router handles auto failover
      }
    } else if (hasImage && !['gemini', 'groq-vision', '9router', 'omnirouter'].includes(selectedModel)) {
      effectiveModel = 'groq-vision';
    }

    // Format current user message with image payload if applicable
    let finalUserContent;
    if (hasImage) {
      finalUserContent = [
        { type: 'text', text: augmentedPrompt || 'Please inspect and analyze this image.' },
        { type: 'image_url', image_url: { url: attachment.dataUrl } }
      ];
    } else {
      finalUserContent = augmentedPrompt;
    }

    const cleanHistory = historyMessages
      .filter((m) => !m.isError && m.content && (typeof m.content === 'string' ? m.content.trim() : true))
      .slice(-12)
      .map((m) => {
        // Strip <think> tags from previous assistant turns for compact clean context
        const cleanContent = m.role === 'assistant' && typeof m.content === 'string'
          ? m.content.replace(/<think>[\s\S]*?<\/think>/g, '').trim()
          : m.content;
        return { role: m.role, content: cleanContent || m.content };
      });

    const outgoingMessages = [
      ...cleanHistory,
      { role: 'user', content: finalUserContent }
    ];

    // Identity protection, temporal context, and MCP tools prompt injection
    const identityPrompt = 'You are NamoGPT, a premier AI assistant built by NamoGPT. Never identify yourself as Google, Gemini, Meta, Llama, OpenAI, ChatGPT, Claude, Anthropic, or DeepSeek. You are strictly and proudly NamoGPT.';
    const mcpToolsPrompt = formatMcpToolsPrompt();

    let effectiveSystemPrompt = `${identityPrompt}\n\n${temporalContext}`;
    if (mcpToolsPrompt) {
      effectiveSystemPrompt += `\n\n${mcpToolsPrompt}`;
    }
    if (settings.systemPrompt) {
      effectiveSystemPrompt += `\n\n${settings.systemPrompt}`;
    }
    if (currentPersona && currentPersona.systemPrompt) {
      effectiveSystemPrompt = `${currentPersona.systemPrompt}\n\n${effectiveSystemPrompt}`.trim();
    }
    if (isThinkingModeEnabled || effectiveModel === 'deepseek-r1') {
      effectiveSystemPrompt += '\n\n[Thinking Mode Active]: Think methodically step-by-step. Wrap your entire internal thought and reasoning process inside <think>...</think> tags before providing your direct final answer.';
    }

    // Client-side sanitization helper to prevent vendor leakage in output
    function sanitizeClientText(text) {
      if (!text || typeof text !== 'string') return text;
      return text
        .replace(/I am a (?:large )?language model(?:,| and)? trained by (?:Google|OpenAI|Meta|DeepSeek|Anthropic)/gi, 'I am NamoGPT')
        .replace(/I am (?:Llama|Claude|ChatGPT|DeepSeek|Gemini)(?:, (?:an AI|a large language model)?)?(?: developed| created| trained)? by (?:Meta|Anthropic|OpenAI|Google|DeepSeek)/gi, 'I am NamoGPT')
        .replace(/I am a large language model developed by (?:Google|Meta|OpenAI|Anthropic|DeepSeek)/gi, 'I am NamoGPT')
        .replace(/I am an AI developed by (?:Google|Meta|OpenAI|Anthropic|DeepSeek)/gi, 'I am NamoGPT')
        .replace(/\b(as a large language model trained by Google)\b/gi, 'as NamoGPT')
        .replace(/\b(as an AI trained by Google)\b/gi, 'as NamoGPT');
    }

    try {
      await streamChatCompletion({
        messages: outgoingMessages,
        model: effectiveModel,
        temperature: isThinkingModeEnabled ? 0.6 : settings.temperature,
        systemPrompt: effectiveSystemPrompt,
        serverUrl: settings.serverUrl,
        apiKeys: settings.apiKeys,
        token: token,
        signal: controller.signal,
        onChunk: (delta, fullText) => {
          tokenCount++;
          const elapsedSec = (performance.now() - startTime) / 1000;
          const tps = elapsedSec > 0 ? (tokenCount / elapsedSec).toFixed(1) : 0;
          setGenerationStats({ tps, elapsed: elapsedSec.toFixed(1) });

          const cleanedText = sanitizeClientText(fullText);

          setChats((prev) =>
            prev.map((c) => {
              if (c.id !== chatId) return c;
              return {
                ...c,
                messages: c.messages.map((m) =>
                  m.id === assistantPlaceholderId ? { ...m, content: cleanedText } : m
                )
              };
            })
          );
        },
        onFinish: (fullText) => {
          setIsGenerating(false);
          abortControllerRef.current = null;
        },
        onError: (err) => {
          setIsGenerating(false);
          abortControllerRef.current = null;

          let friendlyError = err.message || 'Server connection failed.';
          if (
            friendlyError.includes('Upstream returned') ||
            friendlyError.includes('no healthy upstreams') ||
            friendlyError.includes('400') ||
            friendlyError.includes('401')
          ) {
            friendlyError = 'The upstream model provider returned an error (rate limit reached or unverified API key).\n\n💡 **Tip:** Switch to **✨ Auto (Smart Router)** for automatic failover, or enter your personal API key in **⚙️ Settings**.';
          }

          setChats((prev) =>
            prev.map((c) => {
              if (c.id !== chatId) return c;
              return {
                ...c,
                messages: c.messages.map((m) =>
                  m.id === assistantPlaceholderId
                    ? {
                        ...m,
                        content: `⚠️ **NamoGPT Alert:** ${friendlyError}`,
                        isError: true
                      }
                    : m
                )
              };
            })
          );
        }
      });
    } catch (err) {
      setIsGenerating(false);
    }
  }

  // Regenerate response for the last assistant turn
  async function regenerateMessage(assistantMessageIndex) {
    if (!currentChat || isGenerating) return;
    const messages = currentChat.messages;
    if (assistantMessageIndex < 1) return;

    // Previous user message
    const userMsg = messages[assistantMessageIndex - 1];
    if (userMsg.role !== 'user') return;

    // Truncate messages up to the user message
    const truncated = messages.slice(0, assistantMessageIndex);
    setChats((prev) =>
      prev.map((c) => (c.id === currentChatId ? { ...c, messages: truncated } : c))
    );

    // Resend
    await sendMessage(userMsg.content, userMsg.attachment);
  }

  // Edit user message and branch
  async function editAndResend(userMessageIndex, newContent) {
    if (!currentChat || isGenerating) return;
    const truncated = currentChat.messages.slice(0, userMessageIndex);
    setChats((prev) =>
      prev.map((c) => (c.id === currentChatId ? { ...c, messages: truncated } : c))
    );
    await sendMessage(newContent);
  }

  function updateSettings(partial) {
    setSettings((prev) => ({
      ...prev,
      ...partial,
      apiKeys: {
        ...prev.apiKeys,
        ...(partial.apiKeys || {})
      },
      nineRouter: {
        ...(prev.nineRouter || {}),
        ...(partial.nineRouter || {})
      },
      omniRouter: {
        ...(prev.omniRouter || {}),
        ...(partial.omniRouter || {})
      }
    }));
  }

  return (
    <ChatContext.Provider
      value={{
        chats,
        currentChatId,
        currentChat,
        models,
        selectedModel,
        setSelectedModel,
        isGenerating,
        generationStats,
        isWebSearchEnabled,
        setIsWebSearchEnabled,
        isThinkingModeEnabled,
        setIsThinkingModeEnabled,
        isSidebarOpen,
        setIsSidebarOpen,
        isSettingsOpen,
        setIsSettingsOpen,
        isExportOpen,
        setIsExportOpen,
        isDeepResearchOpen,
        setIsDeepResearchOpen,
        isMemoryOpen,
        setIsMemoryOpen,
        isPersonaOpen,
        setIsPersonaOpen,
        isMcpOpen,
        setIsMcpOpen,
        currentPersona,
        setCurrentPersona,
        activeAppMode,
        setActiveAppMode,
        settings,
        updateSettings,
        createNewChat,
        selectChat,
        deleteChat,
        renameChat,
        pinChat,
        clearAllChats,
        sendMessage,
        stopGeneration,
        regenerateMessage,
        editAndResend
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
}
