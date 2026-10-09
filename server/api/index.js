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
  
  // Only rotate across items that actually have an API key or when client override is present
  const validItems = pool.items.filter(it => Boolean(overrideApiKey || it.apiKey));
  if (validItems.length === 0) return null;
  
  const n = validItems.length;
  for (let i = 0; i < n; i++) {
    const idx = (pool.rr + i) % n;
    const item = validItems[idx];
    
    refillTokens(item);
    if (item.tokens === null || item.tokens > 0) {
      pool.rr = (idx + 1) % n;
      if (item.tokens !== null) item.tokens -= 1;
      
      if (overrideApiKey) {
        return {
          item: { ...item, apiKey: overrideApiKey },
          idx
        };
      }
      return { item, idx };
    }
  }
  
  // Fallback to first valid item rather than dropping user
  const fallbackItem = validItems[0];
  return {
    item: overrideApiKey ? { ...fallbackItem, apiKey: overrideApiKey } : fallbackItem,
    idx: 0
  };
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

export const NAMOGPT_IDENTITY_PROMPT = `You are NamoGPT, a premier AI assistant built by NamoGPT. Never claim to be Google, Meta, OpenAI, Claude, or DeepSeek. Always represent yourself exclusively as NamoGPT.

Strict Quality & Response Guidelines:
1. Answer the user prompt directly, factually, and concisely.
2. NEVER offer or generate unsolicited code, programming tutorials, or code templates unless the user explicitly requested code or technical implementation.
3. NEVER mention internal tool names (e.g. mcp_web_fetcher) in conversational responses unless explicitly asked.
4. When real-time search context or news findings are provided, present the information directly with source citations. Never claim you lack real-time access.`;

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
      if (!existing.includes('Strict Quality & Response Guidelines')) {
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
    
    const rawModel = (
      req.query?.model_name || 
      req.headers['x-model-name'] || 
      req.body?.model_name ||
      req.body?.model ||
      ''
    ).toString().trim().toLowerCase();

    const isAuto = !rawModel || rawModel === 'auto' || rawModel.includes('auto');

    // Extract user text and inspect for multimodal imagery
    const messages = Array.isArray(req.body?.messages) ? req.body.messages : [];
    const lastUserMsgObj = messages.filter(m => m.role === 'user').pop();
    let userText = '';
    let hasVision = Boolean(req.body?.image || req.body?.images);

    if (lastUserMsgObj) {
      if (typeof lastUserMsgObj.content === 'string') {
        userText = lastUserMsgObj.content;
        if (userText.includes('image_url') || userText.includes('data:image/')) {
          hasVision = true;
        }
      } else if (Array.isArray(lastUserMsgObj.content)) {
        for (const part of lastUserMsgObj.content) {
          if (part.type === 'text') {
            userText += (part.text || '') + ' ';
          } else if (part.type === 'image_url' || part.image_url || part.type === 'image') {
            hasVision = true;
          }
        }
      }
    }
    userText = userText.trim();

    // Intent detection flags
    const isVisionIntent = hasVision || /\b(describe this image|what is in this picture|look at this image|look at this photo|read this screenshot|image ocr|inspect this image)\b/i.test(userText);
    const isRealTimeNewsWeather = /\b(today('?s)?|tonight|yesterday|tomorrow|this week|this month|this year|right now|current|currently|latest|recent|recently|breaking|news|headline|headlines|weather|temperature|forecast|stock|crypto|price|prices|market|live score|who won|election)\b/i.test(userText);
    const isComplexStem = /\b(proof|prove|calculate|solve|derive|integral|differential|equation|calculus|algebra|physics|chemistry|algorithm|theorem|complexity|benchmark|step[- ]by[- ]step reasoning|logic puzzle|math problem)\b/i.test(userText);

    // Auto Real-Time Web Search Augmentation: auto-augment with searchWeb if query has time-sensitive intent
    const hasExistingSearchContext = userText.includes('REAL-TIME WEB SEARCH') || messages.some(m => typeof m.content === 'string' && m.content.includes('REAL-TIME WEB SEARCH'));

    if (isRealTimeNewsWeather && !hasExistingSearchContext && userText) {
      try {
        const { searchWeb, formatSearchContext } = await import('../search.js');
        const searchResults = await searchWeb(userText, 5);
        if (searchResults && searchResults.length > 0) {
          const searchContext = formatSearchContext(searchResults);
          for (let i = req.body.messages.length - 1; i >= 0; i--) {
            if (req.body.messages[i].role === 'user') {
              if (typeof req.body.messages[i].content === 'string') {
                req.body.messages[i].content = `${searchContext}\n\nUser Question: ${req.body.messages[i].content.trim()}`;
              } else if (Array.isArray(req.body.messages[i].content)) {
                const textPart = req.body.messages[i].content.find(p => p.type === 'text');
                if (textPart) {
                  textPart.text = `${searchContext}\n\nUser Question: ${textPart.text.trim()}`;
                }
              }
              break;
            }
          }
        }
      } catch (searchErr) {
        console.warn('[AutoWebSearch] Background search augmentation notice:', searchErr.message);
      }
    }

    // Provider client key resolver
    const getClientKeyForPool = (pName) => {
      if (pName.startsWith('gemini')) return req.headers['x-gemini-key'] || null;
      if (pName.startsWith('groq')) return req.headers['x-groq-key'] || null;
      if (pName.includes('openrouter')) return req.headers['x-openrouter-key'] || null;
      if (pName.includes('nvidia')) return req.headers['x-nvidia-key'] || null;
      if (pName.includes('aion')) return req.headers['x-aion-key'] || null;
      if (pName.includes('cf') || pName.includes('cloudflare')) return req.headers['x-cf-key'] || req.headers['x-cloudflare-key'] || null;
      if (pName.includes('9router')) return req.headers['x-9router-key'] || req.headers['x-ninerouter-key'] || null;
      return null;
    };

    const isPoolActive = (pName) => {
      const p = pools[pName];
      if (!p || !p.items) return false;
      return p.items.some(item => Boolean(getClientKeyForPool(pName) || item.apiKey));
    };

    let selectedPrimaryPool = 'groq';
    let fallbackCandidates = [];

    if (isAuto) {
      if (isVisionIntent) {
        // Vision/images: route to groq-vision or gemini
        if (isPoolActive('groq-vision')) {
          selectedPrimaryPool = 'groq-vision';
          fallbackCandidates = ['groq-vision', 'gemini', '9router', 'omnirouter', 'groq'];
        } else {
          selectedPrimaryPool = 'gemini';
          fallbackCandidates = ['gemini', 'groq-vision', '9router', 'omnirouter', 'groq'];
        }
      } else if (isRealTimeNewsWeather) {
        // Real-time/news/weather: auto-augment with searchWeb and route to active fast model (groq or gemini)
        if (isPoolActive('groq')) {
          selectedPrimaryPool = 'groq';
          fallbackCandidates = ['groq', 'gemini', 'groq-instant', 'openrouter', 'nvidia', 'cloudflare', '9router'];
        } else {
          selectedPrimaryPool = 'gemini';
          fallbackCandidates = ['gemini', 'groq', 'groq-instant', 'openrouter', 'nvidia', 'cloudflare', '9router'];
        }
      } else if (isComplexStem) {
        // Complex STEM/reasoning: route to deepseek-r1 or gemini
        if (isPoolActive('deepseek-r1')) {
          selectedPrimaryPool = 'deepseek-r1';
          fallbackCandidates = ['deepseek-r1', 'groq-r1', 'gemini', 'openrouter-r1', 'nvidia', 'groq'];
        } else if (isPoolActive('groq-r1')) {
          selectedPrimaryPool = 'groq-r1';
          fallbackCandidates = ['groq-r1', 'deepseek-r1', 'gemini', 'openrouter-r1', 'nvidia', 'groq'];
        } else if (isPoolActive('gemini')) {
          selectedPrimaryPool = 'gemini';
          fallbackCandidates = ['gemini', 'deepseek-r1', 'groq-r1', 'openrouter-r1', 'nvidia', 'groq'];
        } else {
          selectedPrimaryPool = 'groq-r1';
          fallbackCandidates = ['groq-r1', 'gemini', 'deepseek-r1', 'groq'];
        }
      } else {
        // General conversation: route to groq (300 t/s) or gemini (1M context)
        if (isPoolActive('groq')) {
          selectedPrimaryPool = 'groq';
          fallbackCandidates = ['groq', 'gemini', 'groq-instant', 'openrouter', 'nvidia', 'cloudflare', '9router'];
        } else {
          selectedPrimaryPool = 'gemini';
          fallbackCandidates = ['gemini', 'groq', 'groq-instant', 'openrouter', 'nvidia', 'cloudflare', '9router'];
        }
      }
    } else {
      // Explicit model requested
      let explicitModel = rawModel;
      if (explicitModel === 'cloudflare' || explicitModel.includes('cloudflare')) explicitModel = 'cloudflare';
      else if (explicitModel.startsWith('gemini')) explicitModel = 'gemini';
      else if (explicitModel === 'deepseek-r1' || explicitModel.includes('deepseek-r1')) explicitModel = 'deepseek-r1';
      else if (explicitModel === 'groq-vision' || explicitModel.includes('vision')) explicitModel = 'groq-vision';
      else if (explicitModel === 'groq-r1' || (explicitModel.includes('qwen') && !explicitModel.includes('openrouter'))) explicitModel = 'groq-r1';
      else if (explicitModel === 'openrouter-r1' || (explicitModel.includes('qwen') && explicitModel.includes('openrouter'))) explicitModel = 'openrouter-r1';
      else if (explicitModel.includes('instant') || explicitModel === 'groq-instant' || explicitModel.includes('gpt-oss-20b')) explicitModel = 'groq-instant';
      else if (explicitModel.includes('gpt-oss') || explicitModel.includes('groq') || explicitModel.includes('llama')) explicitModel = 'groq';
      else if (explicitModel.includes('nemotron') && explicitModel.includes('super')) explicitModel = 'nvidia';
      else if (explicitModel.includes('nemotron') || explicitModel.includes('openrouter')) explicitModel = 'openrouter';
      else if (explicitModel.includes('nvidia') && pools['nvidia']) explicitModel = 'nvidia';
      else if (explicitModel.includes('aion') && pools['aion-2.0']) explicitModel = 'aion-2.0';
      else if (explicitModel === '9router' || explicitModel.includes('9router')) explicitModel = '9router';
      else if (explicitModel === 'omnirouter' || explicitModel.includes('omnirouter')) explicitModel = 'omnirouter';

      selectedPrimaryPool = explicitModel;
      fallbackCandidates = [explicitModel, 'groq', 'gemini', 'openrouter', 'nvidia', 'cloudflare'];
    }

    // Build ordered list of candidate pools to try
    const candidatePoolsList = [];
    const seenPools = new Set();
    for (const p of [selectedPrimaryPool, ...fallbackCandidates]) {
      if (p && pools[p] && !seenPools.has(p)) {
        seenPools.add(p);
        candidatePoolsList.push(p);
      }
    }
    // Also include any other pool that is active as emergency cascade
    for (const p of Object.keys(pools)) {
      if (!seenPools.has(p) && isPoolActive(p)) {
        seenPools.add(p);
        candidatePoolsList.push(p);
      }
    }

    // Verify if ANY key is available across any candidate pool
    const hasAnyActiveKey = candidatePoolsList.some(p => isPoolActive(p));
    if (!hasAnyActiveKey) {
      console.log(`[NamoGPT] Notice: No API key found for ${selectedPrimaryPool}. Serving smart guidance response.`);
      return handleDemoFallback(req, res, selectedPrimaryPool);
    }

    // Robust LiteLLM key & pool cascade failover:
    // If primary key in pool returns 400/404/429/500, cascade to next key and next active pool without dropping the user
    let requestSucceeded = false;
    let lastErr = null;
    const attemptedCascades = [];

    for (const currentPoolName of candidatePoolsList) {
      const pool = pools[currentPoolName];
      if (!pool || !pool.items || pool.items.length === 0) continue;

      const poolClientKey = getClientKeyForPool(currentPoolName);
      const validItems = pool.items.filter(it => Boolean(poolClientKey || it.apiKey));
      if (validItems.length === 0) continue;

      const n = validItems.length;
      const startIdx = pool.rr || 0;

      for (let k = 0; k < n; k++) {
        const itemIdx = (startIdx + k) % n;
        const baseItem = validItems[itemIdx];
        refillTokens(baseItem);

        const effectiveKey = poolClientKey || baseItem.apiKey;
        if (!effectiveKey) continue;

        const item = { ...baseItem, apiKey: effectiveKey };
        attemptedCascades.push({ pool: currentPoolName, idx: itemIdx, apiBase: item.apiBase || null });

        try {
          const resp = await forwardRequest(item, forwardPath, req);

          // Success: only 2xx is considered successful
          if (resp.status >= 200 && resp.status < 300) {
            requestSucceeded = true;
            pool.rr = (itemIdx + 1) % n;
            if (baseItem.tokens !== null) baseItem.tokens -= 1;

            for (const h of Object.keys(resp.headers || {})) {
              if (['transfer-encoding', 'connection', 'content-encoding'].includes(h)) continue;
              res.setHeader(h, resp.headers[h]);
            }
            res.status(resp.status);

            if (typeof resp.data?.pipe === 'function') {
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
              resp.data.on('error', (streamErr) => {
                console.error('[NamoGPT Stream] Upstream stream error:', streamErr.message);
                res.destroy(streamErr);
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
                  return res.json(json);
                }
              } catch {
                const text = responseData.toString('utf8');
                return res.send(Buffer.from(sanitizeCompletionText(text)));
              }
            }
            return res.send(responseData);
          }

          // Clean up stream if non-2xx
          if (resp.data && typeof resp.data.destroy === 'function') {
            resp.data.destroy();
          }

          console.warn(`[NamoGPT Failover] Upstream status ${resp.status} for pool '${currentPoolName}' (key idx ${itemIdx}). Cascading to next available key/pool...`);
          lastErr = new Error(`upstream status ${resp.status}`);
        } catch (err) {
          console.warn(`[NamoGPT Failover] Upstream request exception for pool '${currentPoolName}' (key idx ${itemIdx}): ${err.message}. Cascading...`);
          lastErr = err;
        }
      }

      if (requestSucceeded) break;
    }

    if (!requestSucceeded) {
      console.log(`[NamoGPT] Notice: All upstream keys & pools failed. Serving smart demo fallback without dropping user.`);
      return handleDemoFallback(req, res, selectedPrimaryPool || 'auto');
    }
  } catch (err) {
    console.error('Handler error:', err);
    const politeGuidance = "Unable to reach the provider upstream. Please verify your API key in Settings or switch to Auto Mode.";
    res.status(500).json({
      error: politeGuidance,
      message: politeGuidance
    });
  }
}
