import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { fetchAvailableModels, streamChatCompletion, DEFAULT_SERVER_URL } from '../services/api';
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

  // UI Modals & Sidebar State
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);

  // Settings State
  const [settings, setSettings] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_SETTINGS);
      if (saved) return JSON.parse(saved);
    } catch {}
    return {
      apiKeys: {
        gemini: '',
        groq: '',
        openrouter: '',
        nvidia: '',
        aion: ''
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

    const userMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: promptText.trim(),
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
    const outgoingMessages = [
      ...historyMessages.map((m) => ({ role: m.role, content: m.content })),
      { role: 'user', content: promptText }
    ];

    try {
      await streamChatCompletion({
        messages: outgoingMessages,
        model: selectedModel,
        temperature: settings.temperature,
        systemPrompt: settings.systemPrompt,
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
