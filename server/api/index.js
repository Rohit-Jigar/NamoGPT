import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import axios from 'axios';
import anthropicHandler from './anthropic_adaptions.js';
import { AVAILABLE_MODELS } from '../models-metadata.js';

let cachedConfig = null;
let cachedPools = null;

export function loadConfig() {
  if (cachedConfig) return cachedConfig;
  
  if (process.env.LITELLM_CONFIG_JSON) {
    cachedConfig = JSON.parse(process.env.LITELLM_CONFIG_JSON);
    return cachedConfig;
  }
  
  try {
    const configPath = path.resolve(process.cwd(), 'config.yaml');
    if (fs.existsSync(configPath)) {
      const raw = fs.readFileSync(configPath, 'utf8');
      cachedConfig = yaml.load(raw);
      return cachedConfig;
    }
    // Fallback: look one directory up
    const parentConfig = path.resolve(process.cwd(), '..', 'config.yaml');
    if (fs.existsSync(parentConfig)) {
      const raw = fs.readFileSync(parentConfig, 'utf8');
      cachedConfig = yaml.load(raw);
      return cachedConfig;
    }
  } catch (err) {
    console.warn('Config loading warning:', err.message);
  }
  
  // Minimal fallback config if no config.yaml found
  cachedConfig = {
    model_list: [
      { model_name: 'gemini', litellm_params: { model: 'gemini/gemini-2.5-flash', api_key: 'os.environ/GEMINI_API_KEY_1' } },
      { model_name: 'groq', litellm_params: { model: 'groq/llama-3.3-70b-versatile', api_key: 'os.environ/GROQ_API_KEY_1' } }
    ]
  };
  return cachedConfig;
}

export function resolveApiKey(maybeEnv) {
  if (!maybeEnv) return null;
  if (typeof maybeEnv !== 'string') return maybeEnv;
  if (maybeEnv.startsWith('os.environ/')) {
    const varName = maybeEnv.replace(/^os\.environ\//, '');
    if (process.env[varName]) return process.env[varName];

    // Check base name without indexed _1 suffix
    if (varName.endsWith('_1')) {
      const base = varName.replace(/_1$/, '');
      if (process.env[base]) return process.env[base];
    }
    // Check OpenRouter variations
    if (varName.includes('OPEN_ROUTER')) {
      const alt = varName.replace('OPEN_ROUTER', 'OPENROUTER');
      if (process.env[alt]) return process.env[alt];
      if (process.env.OPENROUTER_API_KEY) return process.env.OPENROUTER_API_KEY;
      if (process.env.OPEN_ROUTER_API_KEY) return process.env.OPEN_ROUTER_API_KEY;
    }
    // Check NVIDIA NIM variations
    if (varName.includes('NVIDIA')) {
      if (process.env.NVIDIA_NIM_API_KEY) return process.env.NVIDIA_NIM_API_KEY;
      if (process.env.NVIDIA_API_KEY) return process.env.NVIDIA_API_KEY;
    }
    // Check Cloudflare variations
    if (varName.includes('CF_API_TOKEN')) {
      if (process.env.CF_API_TOKEN) return process.env.CF_API_TOKEN;
      if (process.env.CLOUDFLARE_API_TOKEN) return process.env.CLOUDFLARE_API_TOKEN;
      if (process.env.CLOUDFLARE_API_KEY) return process.env.CLOUDFLARE_API_KEY;
    }
    // Check AION variations
    if (varName.includes('AION')) {
      if (process.env.AION_API_KEY) return process.env.AION_API_KEY;
    }
    // Check 9Router variations
    if (varName.includes('NINEROUTER') || varName.includes('9ROUTER')) {
      if (process.env.NINEROUTER_API_KEY) return process.env.NINEROUTER_API_KEY;
      if (process.env['9ROUTER_API_KEY']) return process.env['9ROUTER_API_KEY'];
      return 'sk-9router-local';
    }
    return null;
  }
  return maybeEnv;
}

export function buildPools(cfg) {
  if (cachedPools) return cachedPools;
  
  const pools = {};
  const list = cfg.model_list || [];
  
  for (const entry of list) {
    const name = entry.model_name;
    if (!pools[name]) pools[name] = { items: [], rr: 0 };
    
    const params = entry.litellm_params || {};
    const apiKey = resolveApiKey(params.api_key);
    let apiBase = params.api_base || null;

    // Expand Cloudflare Account ID template if provided
    if (apiBase && apiBase.includes('${CF_ACCOUNT_ID}')) {
      const accId = process.env.CF_ACCOUNT_ID || '';
      apiBase = apiBase.replace('${CF_ACCOUNT_ID}', accId);
    }
    
    const rpm = params.rpm || null;
    
    pools[name].items.push({
      params,
      apiKey,
      apiBase,
      rpm,
      tokens: rpm || null,
      lastRefill: Date.now()
    });
  }
  
  cachedPools = pools;
  return pools;
}

function refillTokens(item) {
  if (!item.rpm) return;
  const now = Date.now();
  if (now - item.lastRefill >= 60000) {
    item.tokens = item.rpm;
    item.lastRefill = now;
  }
}

function pickProvider(pool, overrideApiKey = null) {
  if (!pool || pool.items.length === 0) return null;
  
  const n = pool.items.length;
  for (let i = 0; i < n; i++) {
    const idx = (pool.rr + i) % n;
    const item = pool.items[idx];
    
    refillTokens(item);
    if (item.tokens === null || item.tokens > 0) {
      pool.rr = (idx + 1) % n;
      if (item.tokens !== null) item.tokens -= 1;
      
      // If client supplied an explicit override key, clone item and attach it
      if (overrideApiKey) {
        return {
          item: { ...item, apiKey: overrideApiKey },
          idx
        };
      }
      return { item, idx };
    }
  }
  
  return null;
}

function inferApiBaseFromModel(model) {
  if (!model) return null;
  if (model.startsWith('gemini/')) return 'https://generativelanguage.googleapis.com/v1beta/openai';
  if (model.startsWith('groq/')) return 'https://api.groq.com/openai/v1';
  if (model.startsWith('openrouter/')) return 'https://openrouter.ai/api/v1';
  if (model.startsWith('nvidia/') || model.includes('nvidia')) return 'https://integrate.api.nvidia.com/v1';
  if (model.includes('@cf/')) {
    const acc = process.env.CF_ACCOUNT_ID || '';
    return acc ? `https://api.cloudflare.com/client/v4/accounts/${acc}/ai/v1` : 'https://api.cloudflare.com/client/v4/ai/v1';
  }
  return 'https://api.openai.com/v1';
}

function modelForUpstream(model) {
  if (model.includes('@cf/')) return model.replace(/^openai\//, '');
  return model.replace(/^(gemini|groq|openrouter|openai|nvidia)\//, '');
}

export const NAMOGPT_IDENTITY_PROMPT = "You are NamoGPT, a premier AI assistant built by NamoGPT. Never claim to be Google, Meta, OpenAI, Claude, or DeepSeek. Always represent yourself exclusively as NamoGPT.";

export function sanitizeCompletionText(text) {
  if (!text || typeof text !== 'string') return text;
  return text
    .replace(/I am a (?:large )?language model(?:,| and)? trained by (?:Google|OpenAI|Meta|DeepSeek|Anthropic)/gi, 'I am NamoGPT')
    .replace(/I am (?:Llama|Claude|ChatGPT|DeepSeek|Gemini)(?:, (?:an AI|a large language model)?)?(?: developed| created| trained)? by (?:Meta|Anthropic|OpenAI|Google|DeepSeek)/gi, 'I am NamoGPT')
    .replace(/I am a large language model developed by (?:Google|Meta|OpenAI|Anthropic|DeepSeek)/gi, 'I am NamoGPT')
    .replace(/I am an AI developed by (?:Google|Meta|OpenAI|Anthropic|DeepSeek)/gi, 'I am NamoGPT')
    .replace(/\b(as a large language model trained by Google)\b/gi, 'as NamoGPT')
    .replace(/\b(as an AI trained by Google)\b/gi, 'as NamoGPT');
}

function buildUpstreamBody(item, originalBody) {
  if (!originalBody || Array.isArray(originalBody) || typeof originalBody !== 'object') {
    return originalBody;
  }

  const body = { ...originalBody };
  if (item.params && item.params.model) {
    body.model = modelForUpstream(item.params.model);
  }
  delete body.model_name;

  // Enforce NamoGPT identity in system prompt
  if (Array.isArray(body.messages)) {
    const messages = [...body.messages];
    const systemIdx = messages.findIndex(m => m.role === 'system');
    if (systemIdx !== -1) {
      const existing = messages[systemIdx].content || '';
      if (!existing.includes('You are NamoGPT')) {
        messages[systemIdx] = {
          ...messages[systemIdx],
          content: `${NAMOGPT_IDENTITY_PROMPT}\n\n${existing}`
        };
      }
    } else {
      messages.unshift({
        role: 'system',
        content: NAMOGPT_IDENTITY_PROMPT
      });
    }
    body.messages = messages;
  }

  return body;
}

async function forwardRequest(item, forwardPath, originalReq) {
  const base = item.apiBase || inferApiBaseFromModel(item.params?.model) || 'https://api.openai.com/v1';
  const normalizedBase = base.replace(/\/$/, '');
  const normalizedPath = '/' + forwardPath.replace(/^\//, '');
  const cleanRelativePath = normalizedPath.replace(/^\/v1\//, '/');
  const url = `${normalizedBase}${cleanRelativePath}`;
  
  const headers = { ...originalReq.headers };
  if (item.apiKey) {
    headers['authorization'] = `Bearer ${item.apiKey}`;
  }
  
  delete headers['host'];
  delete headers['connection'];
  delete headers['content-length'];
  delete headers['origin'];
  delete headers['referer'];
  
  const isMultipart = originalReq.headers['content-type']?.startsWith('multipart/form-data');
  const wantsStream = originalReq.body?.stream === true;
  
  try {
    const resp = await axios({
      url,
      method: originalReq.method,
      headers,
      data: isMultipart ? originalReq : buildUpstreamBody(item, originalReq.body),
      maxBodyLength: Infinity,
      timeout: 30000,
      responseType: wantsStream ? 'stream' : 'arraybuffer',
      validateStatus: () => true
    });
    return resp;
  } catch (err) {
    throw new Error(`Forward request failed: ${err.message}`);
  }
}

// Generate intelligent mock response if no external API keys are configured yet
function handleDemoFallback(req, res, modelName) {
  const messages = req.body?.messages || [];
  const lastUserMsg = messages.filter(m => m.role === 'user').pop()?.content || 'Hello';
  const wantsStream = req.body?.stream === true;
  
  const greeting = `### 🌟 Welcome to NamoGPT!\n\nI received your prompt: **"${lastUserMsg.length > 80 ? lastUserMsg.slice(0, 80) + '...' : lastUserMsg}"** using the **${modelName}** pool.\n\n> 💡 **Notice:** Your LiteLLM proxy server is running perfectly! To connect to real live API responses from **${modelName}**, simply provide your free API key:\n\n1. **Option A (Web UI)**: Click the **⚙️ Settings** gear in the bottom-left of NamoGPT and paste your key into the provider section.\n2. **Option B (Server .env)**: Add your free API key to your \`.env\` file (e.g. \`GEMINI_API_KEY_1=...\` or \`GROQ_API_KEY_1=...\`).\n\n#### 🚀 Quick Free Key Links:\n- **Google Gemini**: [aistudio.google.com/apikey](https://aistudio.google.com/apikey) (Free, 1M context)\n- **Groq Cloud**: [console.groq.com/keys](https://console.groq.com/keys) (Free, 300 tokens/s)\n- **OpenRouter**: [openrouter.ai/keys](https://openrouter.ai/keys) (Free Nemotron & DeepSeek R1)\n- **NVIDIA NIM**: [build.nvidia.com](https://build.nvidia.com) (Free 1,000 credits)\n\nOnce added, NamoGPT will automatically balance and route all your requests across free models seamlessly!`;

  if (!wantsStream) {
    return res.status(200).json({
      id: `chatcmpl-${Date.now()}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: modelName,
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: greeting
          },
          finish_reason: 'stop'
        }
      ],
      usage: {
        prompt_tokens: 20,
        completion_tokens: 150,
        total_tokens: 170
      }
    });
  }

  // Stream output with realistic chunks
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const words = greeting.split(' ');
  let i = 0;
  
  const timer = setInterval(() => {
    if (i < words.length) {
      const chunk = (i === 0 ? '' : ' ') + words[i];
      const payload = {
        id: `chatcmpl-${Date.now()}`,
        object: 'chat.completion.chunk',
        created: Math.floor(Date.now() / 1000),
        model: modelName,
        choices: [
          {
            index: 0,
            delta: { content: chunk },
            finish_reason: null
          }
        ]
      };
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
      i++;
    } else {
      res.write(`data: ${JSON.stringify({
        id: `chatcmpl-${Date.now()}`,
        object: 'chat.completion.chunk',
        created: Math.floor(Date.now() / 1000),
        model: modelName,
        choices: [{ index: 0, delta: {}, finish_reason: 'stop' }]
      })}\n\n`);
      res.write('data: [DONE]\n\n');
      clearInterval(timer);
      res.end();
    }
  }, 25);
}

export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Model-Name, X-Gemini-Key, X-Groq-Key, X-OpenRouter-Key, X-Nvidia-Key, X-Aion-Key, X-Cf-Key, X-9Router-Key, X-NineRouter-Key');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const cleanPath = req.url ? req.url.split('?')[0] : '';

  // Public Health & Models Info
  if (cleanPath === '/health' || cleanPath === '/api/hello' || cleanPath === '/v1/api/hello') {
    return res.status(200).json({ ok: true, name: 'NamoGPT LiteLLM Proxy', version: '1.0.0', status: 'operational' });
  }

  if (cleanPath === '/api/models' || cleanPath === '/v1/models' || cleanPath === '/pools') {
    try {
      const cfg = loadConfig();
      const pools = buildPools(cfg);
      
      const enrichedModels = AVAILABLE_MODELS.map(m => {
        const pool = pools[m.id];
        const activeKeysCount = pool ? pool.items.filter(item => Boolean(item.apiKey)).length : 0;
        return {
          ...m,
          isConfigured: activeKeysCount > 0,
          activeKeys: activeKeysCount
        };
      });

      return res.status(200).json({
        object: 'list',
        data: enrichedModels,
        model_names: Object.keys(pools)
      });
    } catch (e) {
      return res.status(200).json({ object: 'list', data: AVAILABLE_MODELS });
    }
  }

  // Master Key Authorization Check (Optional if not set)
  try {
    const cfg = loadConfig();
    const masterKey = resolveApiKey(cfg.general_settings && cfg.general_settings.master_key);
    
    // Only enforce master key if explicitly configured in environment
    if (masterKey && !cleanPath.startsWith('/docs') && !cleanPath.startsWith('/openapi')) {
      const auth = req.headers['authorization'] || req.headers['Authorization'];
      const xApiKey = req.headers['x-api-key'] || req.headers['X-Api-Key'];
      const authToken = auth && auth.startsWith('Bearer ') ? auth.slice(7).trim() : null;
      const providedKey = authToken || xApiKey || null;

      if (providedKey && providedKey !== masterKey) {
        return res.status(403).json({ error: 'forbidden: invalid master key' });
      }
    }
  } catch (err) {
    console.warn('Auth check notice:', err.message);
  }

  try {
    const cfg = loadConfig();
    const pools = buildPools(cfg);

    if (cleanPath === '/anthropic/models' || cleanPath.startsWith('/anthropic') || cleanPath.startsWith('/v1/messages')) {
      return anthropicHandler(req, res);
    }

    const requestUrl = new URL(req.url, 'http://localhost');
    requestUrl.searchParams.delete('model_name');
    const forwardPath = (requestUrl.pathname.startsWith('/v1/')
      ? requestUrl.pathname
      : '/v1' + requestUrl.pathname) + requestUrl.search;
    
    let modelName = 
      req.query?.model_name || 
      req.headers['x-model-name'] || 
      req.body?.model_name ||
      req.body?.model;

    // Normalization of model aliases & Auto Smart Router
    if (!modelName || modelName === 'auto') {
      const messagesStr = JSON.stringify(req.body?.messages || []);
      const hasVision = messagesStr.includes('image_url') || req.body?.image;
      const isComplexStem = /\b(proof|calculate|solve|derive|integral|differential|algorithm|theorem|complexity|benchmark)\b/i.test(messagesStr);

      if (hasVision) {
        modelName = pools['gemini']?.items.some(i => i.apiKey) ? 'gemini' : (pools['groq-vision']?.items.some(i => i.apiKey) ? 'groq-vision' : 'gemini');
      } else if (isComplexStem) {
        modelName = pools['deepseek-r1']?.items.some(i => i.apiKey) ? 'deepseek-r1' : (pools['groq-r1']?.items.some(i => i.apiKey) ? 'groq-r1' : 'gemini');
      } else {
        const fastCandidates = ['groq-instant', 'groq', 'gemini', 'openrouter', 'cloudflare', '9router', 'omnirouter'];
        const activePool = fastCandidates.find(c => pools[c]?.items.some(i => i.apiKey));
        modelName = activePool || 'gemini';
      }
    }
    if (modelName === 'cloudflare' || modelName.includes('cloudflare')) modelName = 'cloudflare';
    else if (modelName.startsWith('gemini')) modelName = 'gemini';
    else if (modelName === 'groq-r1' || (modelName.includes('qwen') && !modelName.includes('openrouter'))) modelName = 'groq-r1';
    else if (modelName === 'openrouter-r1' || (modelName.includes('qwen') && modelName.includes('openrouter')) || modelName.includes('deepseek-r1')) modelName = 'openrouter-r1';
    else if (modelName.includes('instant') || modelName === 'groq-instant' || modelName.includes('gpt-oss-20b')) modelName = 'groq-instant';
    else if (modelName.includes('gpt-oss') || modelName.includes('groq') || modelName.includes('llama')) modelName = 'groq';
    else if (modelName.includes('nemotron') && modelName.includes('super')) modelName = 'nvidia';
    else if (modelName.includes('nemotron') || modelName.includes('openrouter')) modelName = 'openrouter';
    else if (modelName.includes('nvidia') && pools['nvidia']) modelName = 'nvidia';
    else if (modelName.includes('aion') && pools['aion-2.0']) modelName = 'aion-2.0';
    else if (modelName === '9router' || modelName.includes('9router')) modelName = '9router';

    const pool = pools[modelName] || pools['gemini'] || pools['groq'] || Object.values(pools)[0];
    if (!pool) {
      return res.status(404).json({ error: `no pool found for model_name=${modelName}` });
    }

    // Check for client-provided API key overrides from headers
    const clientKey = 
      req.headers['x-gemini-key'] ||
      req.headers['x-groq-key'] ||
      req.headers['x-openrouter-key'] ||
      req.headers['x-nvidia-key'] ||
      req.headers['x-aion-key'] ||
      req.headers['x-cf-key'] ||
      req.headers['x-cloudflare-key'] ||
      req.headers['x-9router-key'] ||
      req.headers['x-ninerouter-key'] ||
      null;

    const tried = [];
    let lastErr = null;
    let anyKeyAvailable = Boolean(clientKey) || pool.items.some(it => Boolean(it.apiKey));

    // If no keys configured anywhere, provide demo fallback guidance
    if (!anyKeyAvailable) {
      console.log(`[NamoGPT] Notice: No API key found for ${modelName}. Serving smart guidance response.`);
      return handleDemoFallback(req, res, modelName);
    }

    for (let attempt = 0; attempt < pool.items.length; attempt++) {
      const pick = pickProvider(pool, clientKey);
      if (!pick) break;

      const { item, idx } = pick;
      if (!item.apiKey) continue; // skip unconfigured keys

      tried.push({ idx, apiBase: item.apiBase || null });

      try {
        const resp = await forwardRequest(item, forwardPath, req);
        
        // Only 2xx responses are treated as success; 4xx/5xx failover to next key in pool
        if (resp.status >= 200 && resp.status < 300) {
          for (const h of Object.keys(resp.headers || {})) {
            if (['transfer-encoding', 'connection', 'content-encoding'].includes(h)) continue;
            res.setHeader(h, resp.headers[h]);
          }
          if (typeof resp.data?.pipe === 'function') {
            res.status(resp.status);
            const { Transform } = await import('stream');
            const sanitizeStream = new Transform({
              transform(chunk, encoding, callback) {
                try {
                  const chunkStr = chunk.toString();
                  const sanitized = sanitizeCompletionText(chunkStr);
                  callback(null, Buffer.from(sanitized));
                } catch {
                  callback(null, chunk);
                }
              }
            });
            resp.data.on('error', (err) => {
              console.error('Upstream stream error:', err.message);
              res.destroy(err);
            });
            return resp.data.pipe(sanitizeStream).pipe(res);
          }
          
          let responseData = resp.data;
          if (Buffer.isBuffer(responseData)) {
            try {
              const text = responseData.toString('utf8');
              const json = JSON.parse(text);
              if (json.choices && Array.isArray(json.choices)) {
                json.choices.forEach(c => {
                  if (c.message?.content) {
                    c.message.content = sanitizeCompletionText(c.message.content);
                  }
                });
                return res.status(resp.status).json(json);
              }
            } catch {
              const text = responseData.toString('utf8');
              return res.status(resp.status).send(Buffer.from(sanitizeCompletionText(text)));
            }
          }
          return res.status(resp.status).send(responseData);
        }
        
        lastErr = new Error(`upstream status ${resp.status}`);
        console.warn(`[NamoGPT] Upstream returned ${resp.status} for ${modelName} (key index ${idx}), attempting failover...`);
      } catch (err) {
        lastErr = err;
        console.error(`Attempt ${attempt} for ${modelName} failed:`, err.message);
      }
    }

    // If all configured keys failed (e.g. rate limit), return fallback or 502
    if (lastErr && tried.length === 0) {
      return handleDemoFallback(req, res, modelName);
    }

    const politeGuidance = "Unable to reach the provider upstream. Please verify your API key in Settings or switch to Auto Mode.";

    res.status(502).json({
      error: politeGuidance,
      message: politeGuidance,
      model: modelName
    });
  } catch (err) {
    console.error('Handler error:', err);
    const politeGuidance = "Unable to reach the provider upstream. Please verify your API key in Settings or switch to Auto Mode.";
    res.status(500).json({
      error: politeGuidance,
      message: politeGuidance
    });
  }
}
