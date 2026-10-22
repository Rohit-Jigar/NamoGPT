/**
 * NamoGPT Agent Harness & Session Event Bus
 * Inspired by DeepSeek Harness (dsh) architecture ("Everything is a Plugin")
 *
 * Implements:
 * 1. Pluggable event-driven agent lifecycle hooks (before_request, on_chunk, on_failover, after_request)
 * 2. Session Rewind and Conversation Forking (branching alternate thinking paths)
 * 3. Prompt Cache Detection & Token Savings Calculation
 */

import { EventEmitter } from 'node:events';
import { getChatById, saveChat } from './db.js';
import { recordUsage } from './usage.js';

export class AgentHarness extends EventEmitter {
  constructor() {
    super();
    this.plugins = new Map();
  }

  /**
   * Register a custom agent lifecycle plugin
   * @param {string} name 
   * @param {Object} plugin - { beforeRequest?, onChunk?, onFailover?, afterRequest? }
   */
  registerPlugin(name, plugin) {
    this.plugins.set(name, plugin);
    return this;
  }

  /**
   * Execute all registered before_request hooks
   */
  async runBeforeRequest(context) {
    this.emit('before_request', context);
    for (const [name, plugin] of this.plugins.entries()) {
      if (typeof plugin.beforeRequest === 'function') {
        try {
          await plugin.beforeRequest(context);
        } catch (err) {
          console.warn(`[Agent Harness] Plugin ${name} beforeRequest error:`, err.message);
        }
      }
    }
    return context;
  }

  /**
   * Execute all on_chunk hooks during token streaming
   */
  runOnChunk(chunkContext) {
    this.emit('chunk', chunkContext);
    for (const [name, plugin] of this.plugins.entries()) {
      if (typeof plugin.onChunk === 'function') {
        try {
          plugin.onChunk(chunkContext);
        } catch (err) {
          console.warn(`[Agent Harness] Plugin ${name} onChunk error:`, err.message);
        }
      }
    }
  }

  /**
   * Execute on_failover hooks when a model or API key cascades
   */
  runOnFailover(failoverContext) {
    this.emit('failover', failoverContext);
    for (const [name, plugin] of this.plugins.entries()) {
      if (typeof plugin.onFailover === 'function') {
        try {
          plugin.onFailover(failoverContext);
        } catch (err) {
          console.warn(`[Agent Harness] Plugin ${name} onFailover error:`, err.message);
        }
      }
    }
  }

  /**
   * Execute after_request hooks upon completion
   */
  async runAfterRequest(resultContext) {
    this.emit('after_request', resultContext);
    for (const [name, plugin] of this.plugins.entries()) {
      if (typeof plugin.afterRequest === 'function') {
        try {
          await plugin.afterRequest(resultContext);
        } catch (err) {
          console.warn(`[Agent Harness] Plugin ${name} afterRequest error:`, err.message);
        }
      }
    }
    return resultContext;
  }
}

// Global Agent Harness instance
export const globalAgentHarness = new AgentHarness();

/**
 * Fork a conversation from a specific message checkpoint (Branching Chat Tree)
 * Inspired by DeepSeek Harness durable session branching.
 *
 * @param {Object} params
 * @param {string} params.chatId - Source chat ID
 * @param {string} [params.sourceMessageId] - Checkpoint message ID to fork from (if omitted, forks entire chat)
 * @param {string} [params.userId='guest-session']
 * @param {string} [params.newTitle] - Custom title for the forked branch
 * @returns {Promise<Object>} Newly created forked chat
 */
export async function forkConversation({ chatId, sourceMessageId, userId = 'guest-session', newTitle }) {
  const originalChat = await getChatById(chatId, userId === 'all' ? null : userId);
  if (!originalChat) {
    throw new Error(`Original conversation '${chatId}' not found.`);
  }

  const messages = Array.isArray(originalChat.messages) ? originalChat.messages : [];
  let branchedMessages = [...messages];

  if (sourceMessageId) {
    const targetIdx = messages.findIndex(m => m.id === sourceMessageId);
    if (targetIdx !== -1) {
      branchedMessages = messages.slice(0, targetIdx + 1);
    }
  }

  const forkedChatId = `chat-fork-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
  const title = newTitle || `${originalChat.title || 'Conversation'} (Fork)`;

  const forkedChat = {
    id: forkedChatId,
    userId: originalChat.userId || userId,
    title,
    model: originalChat.model || 'auto',
    messages: branchedMessages,
    isPinned: false,
    forkedFrom: {
      parentChatId: chatId,
      sourceMessageId: sourceMessageId || (messages.length > 0 ? messages[messages.length - 1].id : null),
      forkedAt: new Date().toISOString()
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  const saved = await saveChat(forkedChat);
  globalAgentHarness.emit('chat:fork', { parentChatId: chatId, newChatId: forkedChatId, userId });
  return saved;
}

/**
 * Rewind a conversation to a prior message turn (Durable session rollback)
 *
 * @param {Object} params
 * @param {string} params.chatId - Chat ID to rewind
 * @param {string} params.targetMessageId - Message ID to rewind back to (inclusive)
 * @param {string} [params.userId='guest-session']
 * @returns {Promise<Object>} Updated chat with rewound messages
 */
export async function rewindConversation({ chatId, targetMessageId, userId = 'guest-session' }) {
  const chat = await getChatById(chatId, userId === 'all' ? null : userId);
  if (!chat) {
    throw new Error(`Conversation '${chatId}' not found.`);
  }

  const messages = Array.isArray(chat.messages) ? chat.messages : [];
  const targetIdx = messages.findIndex(m => m.id === targetMessageId);
  if (targetIdx === -1) {
    throw new Error(`Target message '${targetMessageId}' not found in conversation.`);
  }

  const rewoundMessages = messages.slice(0, targetIdx + 1);

  const updatedChat = {
    ...chat,
    messages: rewoundMessages,
    updatedAt: new Date().toISOString()
  };

  const saved = await saveChat(updatedChat);
  globalAgentHarness.emit('chat:rewind', { chatId, targetMessageId, remainingCount: rewoundMessages.length });
  return saved;
}

/**
 * Detect prompt caching benefits from response metadata or message repetition
 * (e.g. Gemini context caching or repeated conversational prefixes)
 */
export function detectPromptCache({ messages = [], usage = null, model = '' }) {
  // If upstream explicitly provided prompt cache hit stats
  if (usage && typeof usage.prompt_cache_hit_tokens === 'number') {
    return {
      cachedTokens: usage.prompt_cache_hit_tokens,
      isCached: usage.prompt_cache_hit_tokens > 0,
      cacheSource: 'upstream'
    };
  }

  // Gemini 2.5 Flash / DeepSeek prefix context caching estimation
  // In multi-turn chat (> 3 turns), the prior conversation history prefix is cached by Gemini / DeepSeek
  if (Array.isArray(messages) && messages.length > 3) {
    const priorTurns = messages.slice(0, -2);
    const priorText = priorTurns.map(m => typeof m.content === 'string' ? m.content : '').join(' ');
    const estimatedCachedTokens = Math.max(0, Math.floor(priorText.length / 4));
    if (estimatedCachedTokens > 200) {
      return {
        cachedTokens: estimatedCachedTokens,
        isCached: true,
        cacheSource: 'context-prefix'
      };
    }
  }

  return {
    cachedTokens: 0,
    isCached: false,
    cacheSource: 'none'
  };
}

export default {
  AgentHarness,
  globalAgentHarness,
  forkConversation,
  rewindConversation,
  detectPromptCache
};
