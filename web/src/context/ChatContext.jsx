import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import {
  fetchAvailableModels,
  streamChatCompletion,
  searchWebAPI,
  DEFAULT_SERVER_URL,
  fetchChatsAPI,
  saveChatAPI,
  deleteChatAPI,
  renameChatAPI,
  getUsageStatsAPI,
  recordUsageAPI,
  resetUsageAPI
} from '../services/api';
import { autoDetectMemory, getRelevantMemories, formatMemoryContext } from '../services/memory';
import { getAllPersonas } from '../services/personas';
import { formatMcpToolsPrompt } from '../services/mcp';
import { useAuth } from './AuthContext';

const ChatContext = createContext();

export const NAMOGPT_IDENTITY_PROMPT = `You are NamoGPT, a premier AI assistant built by NamoGPT. Never claim to be Google, Meta, OpenAI, Claude, or DeepSeek. Always represent yourself exclusively as NamoGPT.

Strict Quality & Response Guidelines:
1. Answer the user prompt directly, factually, and concisely.
2. NEVER offer or generate unsolicited code, programming tutorials, or code templates unless the user explicitly requested code or technical implementation.
3. NEVER mention internal tool names (e.g. mcp_web_fetcher) in conversational responses unless explicitly asked.
4. When real-time search context or news findings are provided, present the information directly with source citations. Never claim you lack real-time access.`;

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
  const [isSearchingWeb, setIsSearchingWeb] = useState(false);
  const [isThinkingModeEnabled, setIsThinkingModeEnabled] = useState(false);

  // UI Modals & Sidebar State
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isDeepResearchOpen, setIsDeepResearchOpen] = useState(false);
  const [isMemoryOpen, setIsMemoryOpen] = useState(false);
  const [isPersonaOpen, setIsPersonaOpen] = useState(false);
  const [isMcpOpen, setIsMcpOpen] = useState(false);
  const [isUsageMeterOpen, setIsUsageMeterOpen] = useState(false);
  const [usageStats, setUsageStats] = useState(null);
  const [sessionTokens, setSessionTokens] = useState({ promptTokens: 0, completionTokens: 0, totalTokens: 0 });

  // Resilience & Negative Flow States (Rate Limiting 429, Failover, Context Limiting)
  const [rateLimitInfo, setRateLimitInfo] = useState(null); // { active, resetSeconds, failoverModel, originalModel, message }

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
      systemPrompt: 'Answer the user prompt directly, factually, and concisely. Never offer unsolicited code, tutorials, or internal tool chatter unless explicitly requested.',
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

  // Load chats from backend /api/chats when token is available
  useEffect(() => {
    let isMounted = true;
    if (token) {
      fetchChatsAPI(settings.serverUrl, token).then((remoteChats) => {
        if (!isMounted) return;
        if (Array.isArray(remoteChats) && remoteChats.length > 0) {
          setChats((prev) => {
            const combinedMap = new Map();
            remoteChats.forEach((c) => {
              if (c && c.id) combinedMap.set(c.id, c);
            });
            prev.forEach((c) => {
              if (c && c.id && !combinedMap.has(c.id)) {
                combinedMap.set(c.id, c);
              }
            });
            return Array.from(combinedMap.values()).sort(
              (a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0)
            );
          });
        }
      });
    }
    return () => {
      isMounted = false;
    };
  }, [token, settings.serverUrl]);

  // Load models on mount
  useEffect(() => {
    fetchAvailableModels(settings.serverUrl).then((fetched) => {
      if (fetched && fetched.length > 0) {
        setModels(fetched);
        if (!selectedModel || selectedModel === '') {
          setSelectedModel('auto');
        }
      }
    });
  }, [settings.serverUrl]);

  // Load and refresh usage telemetry statistics
  const fetchUsageStats = async () => {
    try {
      const stats = await getUsageStatsAPI(token, settings.serverUrl);
      if (stats) {
        setUsageStats(stats);
      }
    } catch (err) {
      console.warn('[ChatContext] Failed to load usage stats:', err);
    }
  };

  useEffect(() => {
    fetchUsageStats();
  }, [token, settings.serverUrl]);

  // Select or create chat
  const currentChat = chats.find((c) => c.id === currentChatId) || null;

  function createNewChat(modelId = selectedModel || 'auto') {
    const newId = `chat-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    const effectiveModel = modelId || 'auto';
    const newChat = {
      id: newId,
      title: 'New Chat',
      model: effectiveModel,
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isPinned: false
    };

    setChats((prev) => [newChat, ...prev]);
    setCurrentChatId(newId);
    setSelectedModel(effectiveModel);

    // Sync new chat creation to backend API
    saveChatAPI(settings.serverUrl, token, newChat).catch((err) =>
      console.warn('Failed to sync new chat to backend:', err.message)
    );

    return newId;
  }

  function selectChat(id) {
    setCurrentChatId(id);
    const chat = chats.find((c) => c.id === id);
    if (chat && chat.model) {
      setSelectedModel(chat.model);
    } else {
      setSelectedModel('auto');
    }
  }

  function deleteChat(id) {
    setChats((prev) => prev.filter((c) => c.id !== id));
    if (currentChatId === id) {
      const remaining = chats.filter((c) => c.id !== id);
      setCurrentChatId(remaining.length > 0 ? remaining[0].id : null);
    }
    deleteChatAPI(settings.serverUrl, token, id).catch((err) =>
      console.warn('Failed to delete chat from backend:', err.message)
    );
  }

  function renameChat(id, newTitle) {
    const cleanTitle = newTitle.trim() || 'Untitled Chat';
    setChats((prev) =>
      prev.map((c) => (c.id === id ? { ...c, title: cleanTitle } : c))
    );
    renameChatAPI(settings.serverUrl, token, id, cleanTitle).catch((err) =>
      console.warn('Failed to rename chat on backend:', err.message)
    );
  }

  function pinChat(id) {
    setChats((prev) =>
      prev.map((c) => (c.id === id ? { ...c, isPinned: !c.isPinned } : c))
    );
  }

  function forkChat(chatId, sourceMessageId) {
    const targetChat = chats.find((c) => c.id === chatId) || currentChat;
    if (!targetChat) return null;

    const messages = Array.isArray(targetChat.messages) ? targetChat.messages : [];
    let branchedMessages = [...messages];
    if (sourceMessageId) {
      const idx = messages.findIndex((m) => m.id === sourceMessageId);
      if (idx !== -1) {
        branchedMessages = messages.slice(0, idx + 1);
      }
    }

    const newId = `chat-fork-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    const newForkedChat = {
      id: newId,
      title: `${targetChat.title || 'Chat'} (Fork)`,
      model: targetChat.model || selectedModel || 'auto',
      messages: branchedMessages,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isPinned: false
    };

    setChats((prev) => [newForkedChat, ...prev]);
    setCurrentChatId(newId);

    saveChatAPI(settings.serverUrl, token, newForkedChat).catch((err) =>
      console.warn('Failed to save forked chat:', err.message)
    );
    return newId;
  }

  function rewindChat(chatId, targetMessageId) {
    const targetChat = chats.find((c) => c.id === chatId) || currentChat;
    if (!targetChat) return;

    const messages = Array.isArray(targetChat.messages) ? targetChat.messages : [];
    const idx = messages.findIndex((m) => m.id === targetMessageId);
    if (idx === -1) return;

    const rewoundMessages = messages.slice(0, idx + 1);
    setChats((prev) =>
      prev.map((c) =>
        c.id === targetChat.id ? { ...c, messages: rewoundMessages, updatedAt: Date.now() } : c
      )
    );

    saveChatAPI(settings.serverUrl, token, { ...targetChat, messages: rewoundMessages }).catch((err) =>
      console.warn('Failed to sync rewound chat:', err.message)
    );
  }

  function clearAllChats() {
    chats.forEach((c) => {
      deleteChatAPI(settings.serverUrl, token, c.id).catch(() => {});
    });
    setChats([]);
    setCurrentChatId(null);
  }

  function stopGeneration() {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsGenerating(false);
    setIsSearchingWeb(false);
  }

  async function sendMessage(promptText, attachment = null) {
    if ((!promptText || !promptText.trim()) && !attachment) return;
    if (isGenerating) return;

    let chatId = currentChatId;
    if (!chatId) {
      chatId = createNewChat(selectedModel);
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;
    setIsGenerating(true);

    const userMessageId = `msg-${Date.now()}`;
    const assistantPlaceholderId = `msg-reply-${Date.now()}`;

    const userMessage = {
      id: userMessageId,
      role: 'user',
      content: promptText.trim(),
      sources: null,
      attachment: attachment ? {
        name: attachment.name,
        type: attachment.type,
        dataUrl: attachment.dataUrl
      } : null,
      createdAt: Date.now()
    };

    const assistantMessage = {
      id: assistantPlaceholderId,
      role: 'assistant',
      content: '',
      modelUsed: selectedModel,
      sources: null,
      createdAt: Date.now()
    };

    // Auto-generate title from first prompt & add user + placeholder assistant messages immediately
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
    // Persist user prompt to backend
    const currentChatSnapshot = chats.find((c) => c.id === chatId);
    const isFirstMsg = !currentChatSnapshot || currentChatSnapshot.messages.length === 0;
    const computedTitle = isFirstMsg
      ? promptText.slice(0, 36) + (promptText.length > 36 ? '...' : '')
      : (currentChatSnapshot?.title || 'New Chat');

    saveChatAPI(settings.serverUrl, token, {
      id: chatId,
      title: computedTitle,
      model: selectedModel || 'auto',
      messages: [...(currentChatSnapshot ? currentChatSnapshot.messages : []), userMessage],
      createdAt: currentChatSnapshot?.createdAt || Date.now(),
      updatedAt: Date.now()
    }).catch((err) => console.warn('[ChatContext] Failed to save user prompt turn to backend:', err.message));

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

    // 3. Real-time web search (Explicit toggle OR Auto-detected real-time query intent)
    let searchResults = [];
    let searchContext = '';

    const hasRealTimeSearchIntent = /\b(today('?s)?|tonight|yesterday|tomorrow|right now|current|currently|latest|breaking|news|headline|headlines|weather|forecast|temperature|stock|stocks|crypto|bitcoin|btc|eth|ethereum|solana|coin|coins|market|markets|share|shares|nasdaq|nifty|sensex|price|prices|score|scores|game|match|tournament|league|standing|standings|who won|who is winning|medal|medals|championship|cup|election|elections|poll|polls|update|updates|live|recent|recently|what happened|happening|situation|event|events|presidential)\b/i.test(promptText.trim()) || /\b(202[4-9]|203[0-9])\b/.test(promptText.trim());
    const shouldSearch = isWebSearchEnabled || hasRealTimeSearchIntent;

    if (shouldSearch && promptText.trim()) {
      if (hasRealTimeSearchIntent && !isWebSearchEnabled) {
        setIsWebSearchEnabled(true);
      }
      setIsSearchingWeb(true);
      try {
        searchResults = await searchWebAPI(promptText.trim(), settings.serverUrl);
        if (searchResults && searchResults.length > 0) {
          searchContext = '\n\n=== LIVE REAL-TIME WEB SEARCH RESULTS ===\n';
          searchResults.forEach((r, idx) => {
            searchContext += `[Source ${idx + 1}] ${r.title}\nURL: ${r.url || 'N/A'}\nSnippet: ${r.snippet || ''}\n\n`;
          });
          searchContext += 'Instructions: You are equipped with the live real-time web search results above. Synthesize these findings to directly answer the user\'s real-time query. List key facts, updates, or headlines with concise descriptions, and cite sources using Markdown links [Title](URL). DO NOT state that you lack real-time information or that your cutoff is limited, because verified live search findings are explicitly provided above. DO NOT offer unsolicited code, tutorials, or mention internal tool names.\n=========================================\n\n';

          // Attach searchResults to both userMessage.sources and assistantMessage.sources
          setChats((prev) =>
            prev.map((c) => {
              if (c.id !== chatId) return c;
              return {
                ...c,
                messages: c.messages.map((m) =>
                  m.id === userMessageId || m.id === assistantPlaceholderId
                    ? { ...m, sources: searchResults }
                    : m
                )
              };
            })
          );
        }
      } catch (err) {
        console.warn('Live web search error:', err);
      } finally {
        setIsSearchingWeb(false);
      }
    }

    if (controller.signal.aborted) return;

    // Assemble final augmented prompt
    let augmentedPrompt = promptText.trim();
    if (documentContext || searchContext || memoryContext) {
      augmentedPrompt = `${memoryContext ? memoryContext + '\n\n' : ''}${documentContext}${searchContext}User Prompt: ${promptText.trim()}`;
    }

    const startTime = performance.now();
    let tokenCount = 0;

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
    let effectiveModel = selectedModel || 'auto';
    const hasImage = attachment && attachment.dataUrl?.startsWith('data:image');

    // Auto Mode (Smart Router) selection: Auto handles routing transparently on backend
    if (effectiveModel === 'auto') {
      if (isThinkingModeEnabled) {
        effectiveModel = 'deepseek-r1';
      } else {
        effectiveModel = 'auto'; // backend LiteLLM smart router handles intent routing (vision, STEM, real-time search) & key cascade failovers
      }
    } else if (hasImage && !['gemini', 'groq-vision', '9router', 'omnirouter'].includes(effectiveModel)) {
      effectiveModel = 'auto';
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
      .slice(-20)
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
    const hasToolIntent = /\b(mcp|call tool|use tool|run tool|invoke tool|list tools)\b/i.test(promptText);
    const mcpToolsPrompt = formatMcpToolsPrompt(hasToolIntent);

    let effectiveSystemPrompt = `${NAMOGPT_IDENTITY_PROMPT}\n\n${temporalContext}`;
    if (mcpToolsPrompt) {
      effectiveSystemPrompt += `\n\n${mcpToolsPrompt}`;
    }
    const isOldDefaultPrompt = !settings.systemPrompt || settings.systemPrompt.includes('Provide clean, well-structured, and insightful answers');
    if (settings.systemPrompt && !isOldDefaultPrompt && settings.systemPrompt !== NAMOGPT_IDENTITY_PROMPT) {
      effectiveSystemPrompt += `\n\n${settings.systemPrompt}`;
    }
    if (currentPersona && currentPersona.systemPrompt && currentPersona.id !== 'default') {
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

    // Calculate prompt tokens for telemetry & usage stats
    const promptCharCount = (effectiveSystemPrompt?.length || 0) + outgoingMessages.reduce((acc, m) => {
      const contentStr = typeof m.content === 'string' ? m.content : JSON.stringify(m.content);
      return acc + (contentStr?.length || 0);
    }, 0);
    const promptTokens = Math.max(1, Math.ceil(promptCharCount / 3.8));

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
          const elapsedSec = Math.max(0.01, (performance.now() - startTime) / 1000);
          const completionTokens = Math.max(tokenCount, Math.ceil(fullText.length / 3.8));
          const totalTokens = promptTokens + completionTokens;
          const tps = Number((completionTokens / elapsedSec).toFixed(1));
          setGenerationStats({
            tps,
            elapsed: elapsedSec.toFixed(1),
            promptTokens,
            completionTokens,
            totalTokens
          });

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
          setIsSearchingWeb(false);
          abortControllerRef.current = null;

          const elapsedSec = Math.max(0.05, (performance.now() - startTime) / 1000);
          const completionTokens = Math.max(tokenCount, Math.ceil(fullText.length / 3.8));
          const totalTokens = promptTokens + completionTokens;
          const tps = Number((completionTokens / elapsedSec).toFixed(1));

          setGenerationStats({
            tps,
            elapsed: elapsedSec.toFixed(1),
            promptTokens,
            completionTokens,
            totalTokens
          });

          // Track cumulative session tokens
          setSessionTokens((prev) => ({
            promptTokens: prev.promptTokens + promptTokens,
            completionTokens: prev.completionTokens + completionTokens,
            totalTokens: prev.totalTokens + totalTokens
          }));

          // Record usage telemetry to backend and reload usage stats
          recordUsageAPI(token, {
            model: effectiveModel,
            promptTokens,
            completionTokens,
            totalTokens,
            elapsedSec: Number(elapsedSec.toFixed(2)),
            tps
          }, settings.serverUrl)
            .then((newStats) => {
              if (newStats) setUsageStats(newStats);
            })
            .catch((err) => {
              console.warn('[ChatContext] Failed to record usage stats:', err);
            })
            .finally(() => {
              fetchUsageStats();
            });

          const cleanedText = sanitizeClientText(fullText);

          setChats((prev) => {
            const nextChats = prev.map((c) => {
              if (c.id !== chatId) return c;
              return {
                ...c,
                messages: c.messages.map((m) =>
                  m.id === assistantPlaceholderId ? { ...m, content: cleanedText } : m
                ),
                updatedAt: Date.now()
              };
            });

            const finalizedChat = nextChats.find((c) => c.id === chatId);
            if (finalizedChat) {
              saveChatAPI(settings.serverUrl, token, finalizedChat).catch((err) =>
                console.warn('[ChatContext] Failed to persist finished chat to backend:', err.message)
              );
            }

            return nextChats;
          });
        },
        onError: (err) => {
          setIsGenerating(false);
          setIsSearchingWeb(false);
          abortControllerRef.current = null;

          let friendlyError = err.message || 'Server connection failed.';

          // Check for Rate Limit (HTTP 429) or Upstream Provider Quota Saturation
          const isRateLimit =
            err?.status === 429 ||
            friendlyError.includes('429') ||
            /rate limit|quota exceeded|tpm|rpm|too many requests/i.test(friendlyError);

          if (isRateLimit) {
            setRateLimitInfo({
              active: true,
              resetSeconds: 35,
              failoverModel: 'Groq Llama 3.3',
              originalModel: effectiveModel,
              message: friendlyError
            });
            friendlyError = 'Upstream provider rate limit reached (HTTP 429). Continuous zero-downtime failover to Groq Llama 3.3 is available.';
          } else if (
            friendlyError.includes('Upstream returned') ||
            friendlyError.includes('no healthy upstreams') ||
            friendlyError.includes('400') ||
            friendlyError.includes('401')
          ) {
            friendlyError = 'The upstream model provider returned an error (rate limit reached or unverified API key).\n\n💡 **Tip:** Switch to **✨ Auto (Smart Router)** for automatic failover, or enter your personal API key in **⚙️ Settings**.';
          }

          // Check for Gateway Timeout (HTTP 504)
          const isTimeout =
            err?.status === 504 ||
            friendlyError.includes('504') ||
            /gateway timeout|timed out|request timeout/i.test(friendlyError);

          if (isTimeout) {
            window.dispatchEvent(
              new CustomEvent('namogpt:timeout', {
                detail: {
                  chatId,
                  assistantPlaceholderId,
                  message: friendlyError
                }
              })
            );
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

    // Truncate messages before the user message, then re-send
    const truncated = messages.slice(0, assistantMessageIndex - 1);
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

  function dismissRateLimit() {
    setRateLimitInfo(null);
  }

  async function summarizeChatContext(chatId) {
    const targetChat = chats.find((c) => c.id === chatId);
    if (!targetChat || !targetChat.messages || targetChat.messages.length < 3) return 0;

    const charsBefore = targetChat.messages.reduce(
      (sum, m) => sum + (typeof m.content === 'string' ? m.content.length : 0),
      0
    );
    const tokensBefore = Math.round(charsBefore / 4);

    const recentMessages = targetChat.messages.slice(-2);
    const olderMessages = targetChat.messages.slice(0, -2);

    const keyPoints = [];
    olderMessages.forEach((m) => {
      if (m.role === 'user' && typeof m.content === 'string') {
        keyPoints.push(`• User: "${m.content.slice(0, 100)}${m.content.length > 100 ? '...' : ''}"`);
      } else if (m.role === 'assistant' && typeof m.content === 'string') {
        const firstLine = m.content.replace(/<think>[\s\S]*?<\/think>/g, '').trim().split('\n')[0].slice(0, 120);
        keyPoints.push(`• NamoGPT: "${firstLine}..."`);
      }
    });

    const summaryMessage = {
      id: `summary-${Date.now()}`,
      role: 'system',
      content: `[NamoGPT Compressed Context Summary]: Earlier conversation turns were compressed to free model context window capacity:\n${keyPoints.join('\n')}\nUse these key facts for continuous topic continuity.`,
      createdAt: Date.now(),
      isSummary: true
    };

    const updatedMessages = [summaryMessage, ...recentMessages];
    const charsAfter = updatedMessages.reduce(
      (sum, m) => sum + (typeof m.content === 'string' ? m.content.length : 0),
      0
    );
    const tokensAfter = Math.round(charsAfter / 4);
    const freedTokens = Math.max(0, tokensBefore - tokensAfter);

    setChats((prev) =>
      prev.map((c) => (c.id === chatId ? { ...c, messages: updatedMessages, updatedAt: Date.now() } : c))
    );

    const updatedChat = { ...targetChat, messages: updatedMessages, updatedAt: Date.now() };
    saveChatAPI(settings.serverUrl, token, updatedChat).catch((err) =>
      console.warn('[ChatContext] Failed to persist summarized chat to backend:', err.message)
    );

    return freedTokens;
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
        isSearchingWeb,
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
        isUsageMeterOpen,
        setIsUsageMeterOpen,
        usageStats,
        setUsageStats,
        fetchUsageStats,
        sessionTokens,
        currentPersona,
        setCurrentPersona,
        settings,
        updateSettings,
        createNewChat,
        forkChat,
        rewindChat,
        selectChat,
        deleteChat,
        renameChat,
        pinChat,
        clearAllChats,
        sendMessage,
        stopGeneration,
        regenerateMessage,
        editAndResend,
        rateLimitInfo,
        setRateLimitInfo,
        dismissRateLimit,
        summarizeChatContext
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
