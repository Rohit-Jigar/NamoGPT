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
  getUserById,
  getAllUsers,
  authMiddleware,
  requireAdmin,
  seedSuperAdmin,
  SUPER_ADMIN_CREDENTIALS
} from './auth.js';
import { AVAILABLE_MODELS } from './models-metadata.js';
import { getMetrics } from './metrics.js';
import { searchWeb, formatSearchContext } from './search.js';

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

// Attach global auth middleware to decode JWT or LiteLLM Master Key
app.use(authMiddleware);

// --- AUTHENTICATION ROUTES ---

// 1. Register new user
app.post('/api/auth/register', (req, res) => {
  try {
    const { name, email, password } = req.body || {};
    const result = registerUser({ name, email, password });
    return res.status(201).json({
      success: true,
      message: 'Account created successfully.',
      ...result
    });
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

// 2. Login user
app.post('/api/auth/login', (req, res) => {
  try {
    const { email, password } = req.body || {};
    const result = loginUser({ email, password });
    return res.status(200).json({
      success: true,
      message: 'Logged in successfully.',
      ...result
    });
  } catch (err) {
    return res.status(401).json({ success: false, error: err.message });
  }
});

// 3. Current user profile
app.get('/api/auth/me', (req, res) => {
  if (!req.user) {
    return res.status(401).json({ success: false, error: 'Unauthorized. Please log in.' });
  }
  const user = getUserById(req.user.id);
  if (!user) {
    return res.status(404).json({ success: false, error: 'User not found.' });
  }
  return res.status(200).json({ success: true, user });
});

// 4. List all users (Super Admin only)
app.get('/api/auth/users', requireAdmin, (req, res) => {
  try {
    const users = getAllUsers();
    return res.status(200).json({ success: true, users });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 5. Public Super Admin Credentials info (for 1-click evaluation & deployment login)
app.get('/api/auth/superadmin-credentials', (_req, res) => {
  return res.status(200).json({
    email: SUPER_ADMIN_CREDENTIALS.email,
    password: SUPER_ADMIN_CREDENTIALS.password,
    role: SUPER_ADMIN_CREDENTIALS.role,
    name: SUPER_ADMIN_CREDENTIALS.name,
    isDefault: SUPER_ADMIN_CREDENTIALS.email === 'admin@namogpt.com'
  });
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
      aion: Object.keys(process.env).filter(k => k.startsWith('AION_API_KEY') && Boolean(process.env[k]?.trim())).map(k => maskKey(process.env[k])),
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

// 9Router Live Connectivity Ping Helper
app.get('/api/9router/ping', async (req, res) => {
  const baseUrl = (req.query.url || 'http://localhost:20128/v1').replace(/\/$/, '');
  const apiKey = req.query.apiKey || process.env.NINEROUTER_API_KEY || '';
  const startTime = Date.now();
  try {
    const axios = (await import('axios')).default;
    const axiosRes = await axios.get(`${baseUrl}/models`, {
      headers: {
        'Accept': 'application/json',
        ...(apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {})
      },
      timeout: 5000,
      validateStatus: () => true
    });
    const latency = Date.now() - startTime;
    return res.status(200).json({
      success: axiosRes.status >= 200 && axiosRes.status < 300,
      status: axiosRes.status,
      latency,
      data: axiosRes.data,
      url: `${baseUrl}/models`
    });
  } catch (err) {
    const latency = Date.now() - startTime;
    return res.status(200).json({
      success: false,
      error: err.message,
      latency,
      url: `${baseUrl}/models`
    });
  }
});

// Real-Time Free Web Search Endpoint (DuckDuckGo & Wikipedia)
app.get('/api/search', async (req, res) => {
  try {
    const q = req.query.q;
    if (!q || !q.trim()) {
      return res.status(400).json({ success: false, error: 'Query parameter q is required.' });
    }
    const maxResults = Math.min(Number(req.query.limit) || 5, 10);
    const results = await searchWeb(q.trim(), maxResults);
    return res.status(200).json({
      success: true,
      query: q.trim(),
      count: results.length,
      results
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

// OmniRouter Health Ping Endpoint
app.get('/api/omnirouter/ping', async (req, res) => {
  const baseUrl = (req.query.url || process.env.OMNIROUTER_BASE_URL || 'http://localhost:20128/v1').replace(/\/$/, '');
  const apiKey = req.query.apiKey || process.env.OMNIROUTER_API_KEY || '';
  const startTime = Date.now();

  try {
    const headers = { Accept: 'application/json' };
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;
    const axiosRes = await axios.get(`${baseUrl}/models`, { headers, timeout: 3000 });
    const latency = Date.now() - startTime;
    return res.status(200).json({
      success: axiosRes.status >= 200 && axiosRes.status < 300,
      status: axiosRes.status,
      latency,
      data: axiosRes.data,
      url: `${baseUrl}/models`
    });
  } catch (err) {
    const latency = Date.now() - startTime;
    return res.status(200).json({
      success: false,
      error: err.message,
      latency,
      url: `${baseUrl}/models`
    });
  }
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

if (activeWebDist) {
  console.log(`Serving NamoGPT Web UI from: ${activeWebDist}`);
  app.use(express.static(activeWebDist));

  // Single page app fallback for GET requests that are not API paths
  app.get('*', (req, res, next) => {
    const p = req.path;
    if (
      p.startsWith('/v1') ||
      p.startsWith('/api') ||
      p === '/health' ||
      p.startsWith('/docs') ||
      p.startsWith('/openapi') ||
      p.startsWith('/anthropic')
    ) {
      return next();
    }
    res.sendFile(path.join(activeWebDist, 'index.html'));
  });
}

// All remaining requests routed to LiteLLM handler
app.all('*', handler);

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
