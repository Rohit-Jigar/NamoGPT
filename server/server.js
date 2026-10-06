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
import { AVAILABLE_MODELS, getProviderKeysStatus } from './models-metadata.js';
import { getMetrics } from './metrics.js';
import { searchWeb, formatSearchContext } from './search.js';
import { queryRag, formatRagContext } from './rag.js';
import { executeCode } from './sandbox.js';
import { conductDeepResearch } from './research.js';

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
    return res.status(200).json(status);
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
        const axios = (await import('axios')).default;
        const pageRes = await axios.get(targetUrl, {
          timeout: 6000,
          headers: { 'User-Agent': 'NamoGPT/1.0 WebExtractor' },
          validateStatus: () => true
        });
        const html = typeof pageRes.data === 'string' ? pageRes.data : JSON.stringify(pageRes.data);
        const textOnly = html
          .replace(/<script[\s\S]*?<\/script>/gi, '')
          .replace(/<style[\s\S]*?<\/style>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 5000);
        return res.status(200).json({
          success: true,
          toolName: cleanTool,
          result: {
            url: targetUrl,
            status: pageRes.status,
            extractedText: textOnly,
            length: textOnly.length
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

    // 4. External Remote MCP Server execution (HTTP JSON-RPC or REST)
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
