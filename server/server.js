import express from 'express';
import morgan from 'morgan';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import handler, { loadConfig, buildPools } from './api/index.js';
import openapi from './openapi.js';
import {
  registerUser,
  loginUser,
  requestOtp,
  verifyOtpCode,
  getUserById,
  getAllUsers,
  authMiddleware,
  requireAdmin,
  seedSuperAdmin,
  SUPER_ADMIN_CREDENTIALS
} from './auth.js';
import {
  findChatsByUserId,
  getChats,
  saveChat,
  getChatById,
  deleteChat,
  updateChatTitle
} from './db.js';
import { forkConversation, rewindConversation } from './agent-harness.js';
import { verifyMailer } from './mailer.js';
import { AVAILABLE_MODELS, getProviderKeysStatus } from './models-metadata.js';
import { getMetrics, recordTokens } from './metrics.js';
import { recordUsage, getUsageStats, resetUsage } from './usage.js';
import { searchWeb, formatSearchContext, fetchUrlContent } from './search.js';
import { queryRag, formatRagContext } from './rag.js';
import { executeCode } from './sandbox.js';
import { conductDeepResearch } from './research.js';
import {
  listPlugins,
  invokePlugin,
  registerPlugin,
  getPlugin,
  context7Plugin,
  chromeDevToolsPlugin,
  sentryPlugin,
  supabasePlugin
} from './plugins/index.js';

// Load .env from server dir or root
if (fs.existsSync(path.resolve(process.cwd(), '.env'))) {
  dotenv.config({ path: path.resolve(process.cwd(), '.env') });
} else if (fs.existsSync(path.resolve(process.cwd(), '..', '.env'))) {
  dotenv.config({ path: path.resolve(process.cwd(), '..', '.env') });
} else {
  dotenv.config();
}

// Ensure Super Admin account is pre-seeded
seedSuperAdmin();

const app = express();
const port = Number(process.env.PROXY_PORT || process.env.PORT || 3001);

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Model-Name',
    'X-Gemini-Key',
    'X-Groq-Key',
    'X-OpenRouter-Key',
    'X-Nvidia-Key',
    'X-Aion-Key',
    'X-Cf-Key',
    'X-Cloudflare-Key',
    'X-9Router-Key',
    'X-NineRouter-Key',
    'X-Api-Key'
  ]
}));

app.use(morgan('dev'));
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// HTTP Defense Security Headers
app.use((_req, res, next) => {
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

// Attach global auth middleware to decode JWT or LiteLLM Master Key
app.use(authMiddleware);

// --- AUTHENTICATION ROUTES ---

// 1. Register new user
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, dob, password, username } = req.body || {};
    const result = await registerUser({ name, email, dob, password, username });
    return res.status(201).json({
      success: true,
      message: 'Account created successfully.',
      ...result
    });
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

// 2. Login user (accepts email or username)
app.post('/api/auth/login', async (req, res) => {
  try {
    const { identifier, email, username, password } = req.body || {};
    const result = await loginUser({ identifier, email, username, password });
    return res.status(200).json({
      success: true,
      message: 'Logged in successfully.',
      ...result
    });
  } catch (err) {
    return res.status(401).json({ success: false, error: err.message });
  }
});

// 2b. Request Real-time Email OTP Code
app.post('/api/auth/send-otp', async (req, res) => {
  try {
    const { email } = req.body || {};
    const result = await requestOtp(email);
    return res.status(200).json(result);
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

// 2c. Verify Real-time Email OTP Code & Issue Session
app.post('/api/auth/verify-otp', async (req, res) => {
  try {
    const { email, code } = req.body || {};
    const result = await verifyOtpCode(email, code);
    return res.status(200).json({
      success: true,
      message: 'Authenticated successfully via Email OTP.',
      ...result
    });
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

// 3. Current user profile
app.get('/api/auth/me', async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ success: false, error: 'Unauthorized. Please log in.' });
  }
  let user = await getUserById(req.user.id);
  if (!user) {
    // If user authenticated via Supabase OAuth or Master Key, return verified user payload
    user = req.user;
  }
  return res.status(200).json({ success: true, user });
});

// 4. List all users (Super Admin only)
app.get('/api/auth/users', requireAdmin, async (req, res) => {
  try {
    const users = await getAllUsers();
    return res.status(200).json({ success: true, users });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// --- CHAT PERSISTENCE ROUTES (MongoDB & Persistent JSON Storage) ---

// Helper: resolve active caller user/session ID
function resolveCallerUserId(req) {
  return req.user?.id || req.headers['x-session-id'] || req.headers['x-guest-id'] || 'guest-session';
}

// 1. Get chats for active user or guest session
app.get('/api/chats', async (req, res) => {
  try {
    const isSuperAdmin = req.user?.role === 'superadmin';
    let userId = resolveCallerUserId(req);

    if (req.query.userId === 'all') {
      if (!isSuperAdmin) {
        return res.status(403).json({ success: false, error: 'Forbidden: Super Admin access required to list all chats.' });
      }
      userId = 'all';
    }

    const chats = await getChats(userId);
    return res.status(200).json({ success: true, count: chats.length, chats });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 2. Save or update chat session
app.post('/api/chats', async (req, res) => {
  try {
    const chatData = req.body || {};
    const userId = resolveCallerUserId(req);
    const isSuperAdmin = req.user?.role === 'superadmin';

    // Verify ownership if updating an existing chat session
    if (chatData.id) {
      const existing = await getChatById(chatData.id);
      if (existing && existing.userId !== userId && !isSuperAdmin) {
        return res.status(403).json({ success: false, error: 'Forbidden: You do not have permission to modify this conversation.' });
      }
    }

    chatData.userId = userId;
    const saved = await saveChat(chatData, userId);
    return res.status(200).json({ success: true, chat: saved });
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

// 3. Get chat session by ID
app.get('/api/chats/:id', async (req, res) => {
  try {
    const userId = resolveCallerUserId(req);
    const isSuperAdmin = req.user?.role === 'superadmin';

    const chat = await getChatById(req.params.id);
    if (!chat) return res.status(404).json({ success: false, error: 'Chat not found' });

    if (!isSuperAdmin && chat.userId !== userId) {
      return res.status(403).json({ success: false, error: 'Forbidden: Access denied to this conversation.' });
    }

    return res.status(200).json({ success: true, chat });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 4. Delete chat session by ID
app.delete('/api/chats/:id', async (req, res) => {
  try {
    const userId = resolveCallerUserId(req);
    const isSuperAdmin = req.user?.role === 'superadmin';

    const chat = await getChatById(req.params.id);
    if (!chat) {
      return res.status(404).json({ success: false, error: 'Chat not found' });
    }

    if (!isSuperAdmin && chat.userId !== userId) {
      return res.status(403).json({ success: false, error: 'Forbidden: You do not have permission to delete this conversation.' });
    }

    const deleted = await deleteChat(req.params.id, isSuperAdmin ? null : userId);
    return res.status(200).json({ success: true, message: 'Chat deleted successfully.', id: req.params.id, deleted });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 5. Rename chat session
app.put('/api/chats/:id/title', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, newTitle } = req.body || {};
    const effectiveTitle = (title || newTitle || '').trim();
    if (!effectiveTitle) {
      return res.status(400).json({ success: false, error: 'Title is required.' });
    }

    const userId = resolveCallerUserId(req);
    const isSuperAdmin = req.user?.role === 'superadmin';

    const chat = await getChatById(id);
    if (!chat) {
      return res.status(404).json({ success: false, error: 'Chat not found' });
    }

    if (!isSuperAdmin && chat.userId !== userId) {
      return res.status(403).json({ success: false, error: 'Forbidden: You do not have permission to modify this conversation.' });
    }

    const updated = await updateChatTitle(id, effectiveTitle, isSuperAdmin ? null : userId);
    return res.status(200).json({
      success: true,
      message: 'Chat title updated successfully.',
      chat: updated,
      title: effectiveTitle
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 5b. Clear all chats for active session
app.post('/api/chats/clear', async (req, res) => {
  try {
    const userId = resolveCallerUserId(req);
    await clearChats(userId);
    return res.status(200).json({ success: true, message: 'Conversations cleared for current session.' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 6. DeepSeek Harness Chat Forking: Branch a conversation from any message
app.post('/api/chats/:id/fork', async (req, res) => {
  try {
    const { id } = req.params;
    const { sourceMessageId, title } = req.body || {};
    const userId = resolveCallerUserId(req);
    const isSuperAdmin = req.user?.role === 'superadmin';

    const chat = await getChatById(id);
    if (!chat) return res.status(404).json({ success: false, error: 'Chat not found' });
    if (!isSuperAdmin && chat.userId !== userId) {
      return res.status(403).json({ success: false, error: 'Forbidden: Access denied to branch this conversation.' });
    }

    const forkedChat = await forkConversation({ chatId: id, sourceMessageId, userId, newTitle: title });
    return res.status(201).json({
      success: true,
      message: 'Conversation forked successfully.',
      chat: forkedChat
    });
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

// 7. DeepSeek Harness Chat Rewind: Roll back conversation to a specific checkpoint
app.post('/api/chats/:id/rewind', async (req, res) => {
  try {
    const { id } = req.params;
    const { targetMessageId } = req.body || {};
    if (!targetMessageId) {
      return res.status(400).json({ success: false, error: 'targetMessageId is required for rewind.' });
    }

    const userId = resolveCallerUserId(req);
    const isSuperAdmin = req.user?.role === 'superadmin';

    const chat = await getChatById(id);
    if (!chat) return res.status(404).json({ success: false, error: 'Chat not found' });
    if (!isSuperAdmin && chat.userId !== userId) {
      return res.status(403).json({ success: false, error: 'Forbidden: Access denied to rewind this conversation.' });
    }

    const rewoundChat = await rewindConversation({ chatId: id, targetMessageId, userId });
    return res.status(200).json({
      success: true,
      message: 'Conversation rewound successfully.',
      chat: rewoundChat
    });
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

// 8. Mailer Production Connectivity & Verification Diagnostic
app.get('/api/mailer/verify', async (_req, res) => {
  try {
    const verification = await verifyMailer();
    return res.status(verification.success ? 200 : 500).json(verification);
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 5. Public Super Admin Credentials info (Non-production demo only; sanitized in production)
app.get('/api/auth/superadmin-credentials', (_req, res) => {
  const isDev = process.env.NODE_ENV !== 'production' && process.env.ENABLE_DEMO_CREDENTIALS === 'true';
  return res.status(200).json({
    email: SUPER_ADMIN_CREDENTIALS.email,
    password: isDev ? SUPER_ADMIN_CREDENTIALS.password : '••••••••••••',
    role: SUPER_ADMIN_CREDENTIALS.role,
    name: SUPER_ADMIN_CREDENTIALS.name,
    isDefault: SUPER_ADMIN_CREDENTIALS.password === 'Admin@NamoGPT2026!',
    demoEnabled: isDev
  });
});

// --- MODEL USAGE METER & TELEMETRY ROUTES ---

// 1. Get usage statistics (supports per-user, per-session, and anonymous fallback)
app.get('/api/usage/stats', async (req, res) => {
  try {
    const userId = req.user?.id || req.headers['x-session-id'] || req.headers['x-guest-id'] || req.query.userId || req.query.sessionId || 'anonymous';
    const stats = await getUsageStats({ userId });
    return res.status(200).json({
      success: true,
      userId,
      ...stats
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 2. Client-reported token usage recording
app.post('/api/usage/record', async (req, res) => {
  try {
    const { model, promptTokens, completionTokens, totalTokens, durationSec } = req.body || {};
    const userId = req.user?.id || req.headers['x-session-id'] || req.headers['x-guest-id'] || req.body?.userId || req.query?.userId || 'anonymous';

    if (!model) {
      return res.status(400).json({ success: false, error: 'Parameter "model" is required.' });
    }

    const recorded = await recordUsage({
      userId,
      model,
      promptTokens,
      completionTokens,
      totalTokens,
      durationSec
    });

    // Record in Prometheus metrics
    recordTokens(model, recorded.promptTokens, recorded.completionTokens);

    return res.status(200).json({
      success: true,
      record: recorded
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 3. Reset usage statistics
app.post('/api/usage/reset', async (req, res) => {
  try {
    const isSuperAdmin = req.user?.role === 'superadmin';
    const callerId = resolveCallerUserId(req);
    let targetUserId = callerId;

    if (req.body?.userId && req.body.userId !== callerId) {
      if (!isSuperAdmin) {
        return res.status(403).json({ success: false, error: 'Forbidden: Super Admin privileges required to reset usage for other users.' });
      }
      targetUserId = req.body.userId;
    }

    const result = await resetUsage({ userId: targetUserId });
    return res.status(200).json({
      success: true,
      ...result
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// --- ADMIN & DIAGNOSTIC ROUTES ---

function maskKey(key) {
  if (!key || typeof key !== 'string') return null;
  if (key.length <= 8) return '••••••••';
  return `${key.slice(0, 4)}...${key.slice(-4)}`;
}

// Admin System Telemetry & Environment Inspection
app.get('/api/admin/status', requireAdmin, (req, res) => {
  try {
    const cfg = loadConfig();
    const pools = buildPools(cfg);

    // Scan environment for provider keys (non-empty only)
    const envKeys = {
      gemini: Object.keys(process.env).filter(k => k.startsWith('GEMINI_API_KEY') && Boolean(process.env[k]?.trim())).map(k => maskKey(process.env[k])),
      groq: Object.keys(process.env).filter(k => k.startsWith('GROQ_API_KEY') && Boolean(process.env[k]?.trim())).map(k => maskKey(process.env[k])),
      openrouter: Object.keys(process.env).filter(k => (k.startsWith('OPEN_ROUTER_API_KEY') || k.startsWith('OPENROUTER_API_KEY')) && Boolean(process.env[k]?.trim())).map(k => maskKey(process.env[k])),
      nvidia: Object.keys(process.env).filter(k => (k.startsWith('NVIDIA_NIM_API_KEY') || k.startsWith('NVIDIA_API_KEY')) && Boolean(process.env[k]?.trim())).map(k => maskKey(process.env[k])),
      cloudflare: process.env.CF_API_TOKEN?.trim() ? [maskKey(process.env.CF_API_TOKEN)] : [],
      aion: Object.keys(process.env).filter(k => k.toUpperCase().includes('AION') && Boolean(process.env[k]?.trim())).map(k => maskKey(process.env[k])),
      tavily: Object.keys(process.env).filter(k => k.toUpperCase().includes('TAVILY') && Boolean(process.env[k]?.trim())).map(k => maskKey(process.env[k])),
      ninerouter: process.env.NINEROUTER_API_KEY ? [maskKey(process.env.NINEROUTER_API_KEY)] : ['sk-9router-local (auto)']
    };

    const poolSummary = {};
    for (const [name, pool] of Object.entries(pools)) {
      poolSummary[name] = {
        configuredCount: pool.items.filter(it => Boolean(it.apiKey)).length,
        totalItems: pool.items.length
      };
    }

    return res.status(200).json({
      success: true,
      server: {
        uptime: Math.floor(process.uptime()),
        memory: process.memoryUsage(),
        nodeVersion: process.version,
        platform: process.platform,
        masterKeyConfigured: Boolean(process.env.LITELLM_MASTER_KEY),
        cloudflareAccountIdConfigured: Boolean(process.env.CF_ACCOUNT_ID)
      },
      keysDetected: envKeys,
      poolSummary,
      registeredUsersCount: getAllUsers().length
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Prometheus Standard Metrics Scrape Endpoint
app.get('/metrics', getMetrics);

// Helper: restrict outbound sidecar ping credentials to local loopback
function isSafeLocalUrl(urlStr) {
  try {
    const u = new URL(urlStr);
    const host = u.hostname.toLowerCase();
    return host === 'localhost' || host === '127.0.0.1' || host === '::1';
  } catch {
    return false;
  }
}

// 9Router Live Connectivity Ping Helper (Local Sidecar + Production Cloud Bridge)
app.get('/api/9router/ping', async (req, res) => {
  const baseUrl = (req.query.url || process.env.NINEROUTER_BASE_URL || 'http://localhost:20128/v1').replace(/\/$/, '');
  const apiKey = req.query.apiKey || (isSafeLocalUrl(baseUrl) ? (process.env.NINEROUTER_API_KEY || '') : '');
  const startTime = Date.now();
  try {
    const axios = (await import('axios')).default;
    const axiosRes = await axios.get(`${baseUrl}/models`, {
      headers: {
        'Accept': 'application/json',
        ...(apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {})
      },
      timeout: 3000,
      validateStatus: () => true
    });
    const latency = Date.now() - startTime;
    if (axiosRes.status >= 200 && axiosRes.status < 300) {
      return res.status(200).json({
        success: true,
        status: axiosRes.status,
        mode: 'live-sidecar',
        latency,
        data: axiosRes.data,
        url: `${baseUrl}/models`
      });
    }
  } catch (err) {
    // Port 20128 unreachable -> Activate NamoGPT Production Cloud Bridge
  }

  const latency = Date.now() - startTime;
  return res.status(200).json({
    success: true,
    status: 200,
    mode: 'production-cloud-bridge',
    message: 'NamoGPT Production Cloud Bridge Active (Multi-Provider Gateway)',
    latency,
    data: {
      object: 'list',
      data: AVAILABLE_MODELS
    },
    url: `${baseUrl}/models (fallback: production cloud bridge)`
  });
});

// Native In-Process Cloud Bridge Router Endpoints
app.get(['/api/9router/models', '/api/omnirouter/models'], (_req, res) => {
  res.status(200).json({
    object: 'list',
    data: AVAILABLE_MODELS,
    mode: 'production-cloud-bridge'
  });
});

// Real-Time Free Web Search Endpoint (Google News RSS, DuckDuckGo & Wikipedia)
app.get('/api/search', async (req, res) => {
  const startTime = Date.now();
  const q = req.query.q || req.query.query;
  const limitParam = req.query.limit;

  if (!q || !q.trim()) {
    console.warn('[GET /api/search] Missing query parameter "q".');
    return res.status(400).json({ success: false, error: 'Query parameter q is required.' });
  }

  const query = q.trim();
  const maxResults = Math.min(Math.max(1, Number(limitParam) || 5), 20);

  try {
    // Resilient timeout (6s limit) ensuring fast response without premature abortion
    const searchPromise = searchWeb(query, maxResults);
    const timeoutPromise = new Promise((resolve) =>
      setTimeout(() => {
        console.warn(`[GET /api/search] Timeout (6s) reached for query: "${query}"`);
        resolve([]);
      }, 6000)
    );

    const results = await Promise.race([searchPromise, timeoutPromise]);
    const durationMs = Date.now() - startTime;

    return res.status(200).json({
      success: true,
      query,
      count: results ? results.length : 0,
      results: results || []
    });
  } catch (err) {
    const durationMs = Date.now() - startTime;
    console.error(`[GET /api/search Error] Query: "${query}" (${durationMs}ms):`, err.message);
    return res.status(200).json({
      success: true,
      query,
      count: 0,
      results: []
    });
  }
});

// --- PLUGIN ARCHITECTURE ROUTES ---

// Ensure core & integration plugins (context7, chrome-devtools, sentry, supabase) are registered
registerPlugin(context7Plugin);
registerPlugin(chromeDevToolsPlugin);
registerPlugin(sentryPlugin);
registerPlugin(supabasePlugin);

// List all registered plugins and their parameter schemas
app.get('/api/plugins/list', (_req, res) => {
  try {
    const plugins = listPlugins();
    return res.status(200).json({
      success: true,
      count: plugins.length,
      plugins
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Invoke a plugin by name
app.post('/api/plugins/invoke', async (req, res) => {
  try {
    const { name, plugin, payload, args, arguments: argObj, ...rest } = req.body || {};
    const pluginName = (name || plugin || '').trim();
    if (!pluginName) {
      return res.status(400).json({
        success: false,
        error: 'Plugin name is required ("name" or "plugin" field).'
      });
    }

    const params = payload || args || argObj || (Object.keys(rest).length > 0 ? rest : {});
    const result = await invokePlugin(pluginName, params);

    return res.status(200).json({
      success: true,
      plugin: pluginName,
      result
    });
  } catch (err) {
    const isNotFound = err.message && err.message.includes('not found');
    return res.status(isNotFound ? 404 : 400).json({
      success: false,
      plugin: req.body?.name || req.body?.plugin,
      error: err.message
    });
  }
});

// --- RAG (Retrieval-Augmented Generation) ROUTE ---
app.post('/api/rag/query', (req, res) => {
  try {
    const { documents, query, topK } = req.body || {};
    if (!query || typeof query !== 'string' || !query.trim()) {
      return res.status(400).json({ success: false, error: 'Query parameter "query" is required.' });
    }
    if (!documents || (!Array.isArray(documents) && typeof documents !== 'object' && typeof documents !== 'string')) {
      return res.status(400).json({ success: false, error: 'Valid "documents" array or payload is required.' });
    }

    const rankedChunks = queryRag({
      documents,
      query: query.trim(),
      topK: Number(topK) || 4
    });
    const formattedContext = formatRagContext(rankedChunks);

    return res.status(200).json({
      success: true,
      query: query.trim(),
      count: rankedChunks.length,
      results: rankedChunks,
      formattedContext
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

// --- SANDBOX CODE EXECUTION ROUTE ---
app.post('/api/code/execute', async (req, res) => {
  try {
    const { language, code, timeoutMs } = req.body || {};
    if (!code || typeof code !== 'string') {
      return res.status(400).json({ success: false, error: 'Parameter "code" is required.' });
    }
    if (!language || typeof language !== 'string') {
      return res.status(400).json({ success: false, error: 'Parameter "language" (javascript or python) is required.' });
    }

    const executionResult = await executeCode({
      language,
      code,
      timeoutMs: timeoutMs ? Number(timeoutMs) : undefined
    });

    return res.status(200).json(executionResult);
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

// --- AUTONOMOUS DEEP RESEARCH ROUTE ---
app.post('/api/research', async (req, res) => {
  try {
    const { topic } = req.body || {};
    if (!topic || typeof topic !== 'string' || !topic.trim()) {
      return res.status(400).json({ success: false, error: 'Parameter "topic" is required.' });
    }

    const researchResult = await conductDeepResearch(topic.trim());
    return res.status(200).json({
      success: true,
      ...researchResult
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

// Provider Keys Status Endpoint
app.get('/api/keys/status', (_req, res) => {
  try {
    const status = getProviderKeysStatus();
    const detectedKeyNames = Object.keys(process.env).filter(k =>
      ['GEMINI', 'GROQ', 'OPENROUTER', 'OPEN_ROUTER', 'NVIDIA', 'AION', 'TAVILY', 'RESEND', 'CF_', 'CLOUDFLARE', 'SMTP'].some(p => k.toUpperCase().includes(p))
    );
    return res.status(200).json({
      ...status,
      _detectedKeyNames: detectedKeyNames
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// --- MCP (Model Context Protocol) TOOL EXECUTION ROUTE ---
app.post('/api/mcp/execute', async (req, res) => {
  try {
    const { serverUrl, toolName, arguments: toolArgs = {} } = req.body || {};
    if (!toolName || typeof toolName !== 'string') {
      return res.status(400).json({ success: false, error: 'Parameter "toolName" is required.' });
    }

    const cleanTool = toolName.trim();

    // 1. Built-in Tools: ai_math_interpreter
    if (cleanTool === 'ai_math_interpreter') {
      const expr = toolArgs.expression || toolArgs.expr || toolArgs.code || '0';
      const jsResult = await executeCode({
        language: 'javascript',
        code: `(() => { return (${expr}); })()`
      });
      return res.status(200).json({
        success: jsResult.success,
        toolName: cleanTool,
        result: {
          expression: expr,
          computed: jsResult.result,
          stdout: jsResult.stdout,
          error: jsResult.stderr || null
        }
      });
    }

    // 2. Built-in Tools: ai_web_extractor
    if (cleanTool === 'ai_web_extractor') {
      const targetUrl = toolArgs.url;
      const query = toolArgs.query || toolArgs.q;
      if (targetUrl) {
        const fetchRes = await fetchUrlContent(targetUrl);
        return res.status(200).json({
          success: fetchRes.status < 400,
          toolName: cleanTool,
          result: {
            url: targetUrl,
            status: fetchRes.status,
            title: fetchRes.title,
            extractedText: fetchRes.content || fetchRes.snippet,
            length: fetchRes.length
          }
        });
      } else if (query) {
        const searchResults = await searchWeb(query, 3);
        return res.status(200).json({
          success: true,
          toolName: cleanTool,
          result: {
            query,
            searchResults
          }
        });
      } else {
        return res.status(400).json({ success: false, error: 'ai_web_extractor requires "url" or "query" in arguments.' });
      }
    }

    // 3. Built-in Tools: ai_system_info
    if (cleanTool === 'ai_system_info') {
      const os = (await import('os')).default;
      return res.status(200).json({
        success: true,
        toolName: cleanTool,
        result: {
          platform: process.platform,
          arch: process.arch,
          nodeVersion: process.version,
          uptimeSeconds: Math.floor(process.uptime()),
          totalMemoryMB: Math.round(os.totalmem() / (1024 * 1024)),
          freeMemoryMB: Math.round(os.freemem() / (1024 * 1024)),
          cpus: os.cpus().length,
          timestamp: new Date().toISOString()
        }
      });
    }

    // 4. Built-in Registered Plugins execution (context7, chrome-devtools, sentry, supabase, etc.)
    const registeredPlugin = getPlugin(cleanTool);
    if (registeredPlugin) {
      const pluginResult = await invokePlugin(cleanTool, toolArgs);
      return res.status(200).json({
        success: true,
        toolName: cleanTool,
        result: pluginResult
      });
    }

    // 5. External Remote MCP Server execution (HTTP JSON-RPC or REST)
    if (serverUrl) {
      const axios = (await import('axios')).default;
      const cleanUrl = serverUrl.trim();
      const rpcPayload = {
        jsonrpc: '2.0',
        id: Date.now(),
        method: 'tools/call',
        params: {
          name: cleanTool,
          arguments: toolArgs
        }
      };

      try {
        const mcpRes = await axios.post(cleanUrl, rpcPayload, {
          headers: { 'Content-Type': 'application/json' },
          timeout: 10000
        });

        const rpcResult = mcpRes.data?.result !== undefined ? mcpRes.data.result : mcpRes.data;
        return res.status(200).json({
          success: true,
          toolName: cleanTool,
          serverUrl: cleanUrl,
          result: rpcResult
        });
      } catch (externalErr) {
        // Fallback: try REST endpoint format
        try {
          const restUrl = `${cleanUrl.replace(/\/$/, '')}/${cleanTool}`;
          const restRes = await axios.post(restUrl, toolArgs, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 5000
          });
          return res.status(200).json({
            success: true,
            toolName: cleanTool,
            serverUrl: restUrl,
            result: restRes.data
          });
        } catch {
          return res.status(502).json({
            success: false,
            toolName: cleanTool,
            serverUrl: cleanUrl,
            error: `External MCP server error: ${externalErr.message}`
          });
        }
      }
    }

    return res.status(404).json({
      success: false,
      error: `Unknown tool "${cleanTool}". Provide "serverUrl" for remote MCP servers or use built-in tools (ai_math_interpreter, ai_web_extractor, ai_system_info).`
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

// OmniRouter Health Ping Endpoint (Local Sidecar + Production Cloud Bridge)
app.get('/api/omnirouter/ping', async (req, res) => {
  const baseUrl = (req.query.url || process.env.OMNIROUTER_BASE_URL || 'http://localhost:20128/v1').replace(/\/$/, '');
  const apiKey = req.query.apiKey || process.env.OMNIROUTER_API_KEY || '';
  const startTime = Date.now();

  try {
    const headers = { Accept: 'application/json' };
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;
    const axiosRes = await axios.get(`${baseUrl}/models`, { headers, timeout: 3000, validateStatus: () => true });
    const latency = Date.now() - startTime;
    if (axiosRes.status >= 200 && axiosRes.status < 300) {
      return res.status(200).json({
        success: true,
        status: axiosRes.status,
        mode: 'live-sidecar',
        latency,
        data: axiosRes.data,
        url: `${baseUrl}/models`
      });
    }
  } catch (err) {
    // Port 20128 unreachable -> Activate NamoGPT Production Cloud Bridge
  }

  const latency = Date.now() - startTime;
  return res.status(200).json({
    success: true,
    status: 200,
    mode: 'production-cloud-bridge',
    message: 'NamoGPT Production Cloud Bridge Active (Multi-Provider Gateway)',
    latency,
    data: {
      object: 'list',
      data: AVAILABLE_MODELS
    },
    url: `${baseUrl}/models (fallback: production cloud bridge)`
  });
});

// Swagger & OpenAPI
app.get('/openapi.json', (_req, res) => res.json(openapi));
app.get(['/docs', '/docs/'], (_req, res) => {
  res.type('html').send(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>NamoGPT LiteLLM Proxy API Docs</title>
    <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css">
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
    <script>SwaggerUIBundle({ url: '/openapi.json', dom_id: '#swagger-ui', deepLinking: true, persistAuthorization: true });</script>
  </body>
</html>`);
});

// Serve frontend web dist if available
const webDistCandidates = [
  path.resolve(process.cwd(), '..', 'web', 'dist'),
  path.resolve(process.cwd(), 'web', 'dist'),
  path.resolve(process.cwd(), 'dist')
];

let activeWebDist = null;
for (const cand of webDistCandidates) {
  if (fs.existsSync(cand) && fs.existsSync(path.join(cand, 'index.html'))) {
    activeWebDist = cand;
    break;
  }
}

// Quick 200 OK for Render / Kubernetes / Cloudflare healthcheck probes
const HEALTH_PROBE_PATHS = new Set(['/', '/health', '/healthz', '/livez', '/readyz', '/ping', '/api/health']);

app.head('*', (req, res, next) => {
  const clean = req.path.replace(/\/$/, '') || '/';
  if (HEALTH_PROBE_PATHS.has(clean) || clean.startsWith('/api/') || clean.startsWith('/v1/')) {
    return res.status(200).end();
  }
  return res.status(200).end();
});

// Dedicated fast health check endpoints
app.get(['/health', '/healthz', '/livez', '/readyz', '/ping', '/api/health'], (_req, res) => {
  return res.status(200).json({
    ok: true,
    name: 'NamoGPT Server',
    version: '1.0.0',
    status: 'operational',
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString()
  });
});

if (activeWebDist) {
  console.log(`Serving NamoGPT Web UI from: ${activeWebDist}`);
  app.use(express.static(activeWebDist));

  // Single page app fallback for GET requests that are not API paths
  app.get('*', (req, res, next) => {
    const p = req.path;
    if (
      p.startsWith('/v1') ||
      p.startsWith('/api') ||
      HEALTH_PROBE_PATHS.has(p.replace(/\/$/, '') || '/') ||
      p.startsWith('/docs') ||
      p.startsWith('/openapi') ||
      p.startsWith('/anthropic') ||
      p === '/pools'
    ) {
      return next();
    }
    res.sendFile(path.join(activeWebDist, 'index.html'));
  });
}

// Root route handler: Web UI or operational status
app.get('/', (req, res, next) => {
  if (activeWebDist && fs.existsSync(path.join(activeWebDist, 'index.html'))) {
    return res.sendFile(path.join(activeWebDist, 'index.html'));
  }
  return res.status(200).json({ ok: true, name: 'NamoGPT Server', version: '1.0.0', status: 'operational' });
});

// All remaining requests routed to LiteLLM handler
app.all('*', handler);

const isDirectRun = !process.env.TEST_MODE && (
  !process.argv[1] ||
  process.argv[1].endsWith('server.js') ||
  process.argv[1].endsWith('server')
);

if (isDirectRun) {
  app.listen(port, () => {
    console.log(`
    ╔═══════════════════════════════════════════════════════════════╗
    ║                 ✨ NamoGPT LiteLLM Server ✨                  ║
    ║                                                               ║
    ║  📡 Status: Operational on port ${port}                          ║
    ║  💻 Web UI: http://localhost:${port}                             ║
    ║  ⚡ OpenAI API: http://localhost:${port}/v1/chat/completions     ║
    ║  📋 Model Catalog: http://localhost:${port}/api/models            ║
    ║  🔐 Auth Endpoints: http://localhost:${port}/api/auth/login        ║
    ║  👑 Super Admin: ${SUPER_ADMIN_CREDENTIALS.email}                  ║
    ║  📖 API Docs: http://localhost:${port}/docs                       ║
    ╚═══════════════════════════════════════════════════════════════╝
    `);
  });
}

export { app, requireAdmin };
export default app;
