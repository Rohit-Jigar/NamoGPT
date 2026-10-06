import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { fetchAvailableModels, streamChatCompletion, searchWebAPI, DEFAULT_SERVER_URL } from '../services/api';
import { useAuth } from './AuthContext';

const ChatContext = createContext();

const STORAGE_KEY_CHATS = 'namogpt_chats_v1';
const STORAGE_KEY_SETTINGS = 'namogpt_settings_v1';

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
  const [selectedModel, setSelectedModel] = useState('gemini');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStats, setGenerationStats] = useState(null); // { tps, elapsed }

  // Advanced Feature Toggles (ChatGPT-style Web Search & Thinking Mode)
  const [isWebSearchEnabled, setIsWebSearchEnabled] = useState(false);
  const [isThinkingModeEnabled, setIsThinkingModeEnabled] = useState(false);

  // UI Modals & Sidebar State
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);

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

    // 1. Check for real-time web search
    let searchResults = [];
    let augmentedPrompt = promptText.trim();

    if (isWebSearchEnabled && promptText.trim()) {
      try {
        searchResults = await searchWebAPI(promptText.trim(), settings.serverUrl);
        if (searchResults.length > 0) {
          let searchContext = '\n\n=== LIVE REAL-TIME WEB SEARCH RESULTS ===\n';
          searchResults.forEach((r, idx) => {
            searchContext += `[${idx + 1}] ${r.title}\nURL: ${r.url}\nSummary: ${r.snippet}\n\n`;
          });
          searchContext += 'Instructions: Synthesize the above web search results to answer the query accurately. Cite your references using Markdown links [Title](URL).\n=========================================\n\n';
          augmentedPrompt = `${searchContext}User Question: ${promptText.trim()}`;
        }
      } catch (err) {
        console.warn('Live web search error:', err);
      }
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

    // Multimodal image processing: if image attachment is present
    let effectiveModel = selectedModel;
    const hasImage = attachment && attachment.dataUrl?.startsWith('data:image');

    // Auto-route to a vision model if current model does not support vision
    if (hasImage && !['gemini', 'groq-vision', '9router', 'omnirouter'].includes(selectedModel)) {
      effectiveModel = 'gemini';
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

    const outgoingMessages = [
      ...historyMessages.map((m) => ({ role: m.role, content: m.content })),
      { role: 'user', content: finalUserContent }
    ];

    // Thinking mode system prompt injection
    let effectiveSystemPrompt = settings.systemPrompt || '';
    if (isThinkingModeEnabled || effectiveModel === 'deepseek-r1') {
      effectiveSystemPrompt += '\n\n[Thinking Mode Active]: Think methodically step-by-step. Wrap your entire internal thought and reasoning process inside <think>...</think> tags before providing your direct final answer.';
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

          setChats((prev) =>
            prev.map((c) => {
              if (c.id !== chatId) return c;
              return {
                ...c,
                messages: c.messages.map((m) =>
                  m.id === assistantPlaceholderId ? { ...m, content: fullText } : m
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
          setChats((prev) =>
            prev.map((c) => {
              if (c.id !== chatId) return c;
              return {
                ...c,
                messages: c.messages.map((m) =>
                  m.id === assistantPlaceholderId
                    ? {
                        ...m,
                        content: `⚠️ **Error generating response:** ${err.message || 'Server connection failed.'}\n\nPlease check your server connection or configure your API key in **Settings**.`,
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
