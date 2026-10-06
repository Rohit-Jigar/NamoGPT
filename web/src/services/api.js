/**
 * NamoGPT API Service
 * Connects to the LiteLLM Proxy server
 */

export const DEFAULT_SERVER_URL = window.location.port === '5173'
  ? 'http://localhost:3001'
  : (window.location.hostname.includes('github.io')
      ? 'https://namogpt.onrender.com'
      : window.location.origin);

export async function fetchAvailableModels(serverUrl = DEFAULT_SERVER_URL) {
  try {
    const res = await fetch(`${serverUrl}/api/models`, {
      headers: { 'Accept': 'application/json' }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data.data || [];
  } catch (err) {
    console.warn('Failed to fetch models from server, using fallback list:', err.message);
    // Return standard fallback models if server is unreachable
    return [
      {
        id: "gemini",
        name: "Gemini 3.8 Flash",
        provider: "Google AI",
        category: "Multimodal & Fast",
        badge: "Recommended",
        badgeColor: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
        description: "Ultra-fast multimodal reasoning, coding, and 1M token context window.",
        supportsVision: true,
        supportsReasoning: true,
        speed: "⚡⚡⚡ Fast",
        cost: "Free Tier"
      },
      {
        id: "groq",
        name: "GPT-OSS 120B (Groq)",
        provider: "Groq Cloud",
        category: "General Intelligence",
        badge: "Ultra Fast",
        badgeColor: "bg-amber-500/10 text-amber-400 border-amber-500/20",
        description: "Massive 120B open intelligence running at blazing LPU speeds (~300 t/s).",
        supportsVision: false,
        supportsReasoning: false,
        speed: "⚡⚡⚡⚡⚡ 300 t/s",
        cost: "Free Tier"
      },
      {
        id: "groq-r1",
        name: "Qwen 3.8 27B Reasoning (Groq)",
        provider: "Groq Cloud",
        category: "Deep Reasoning",
        badge: "Reasoning",
        badgeColor: "bg-purple-500/10 text-purple-400 border-purple-500/20",
        description: "Advanced mathematical & logical reasoning model accelerated on Groq LPUs (~250 t/s).",
        supportsVision: false,
        supportsReasoning: true,
        speed: "⚡⚡⚡⚡ ~250 t/s",
        cost: "Free Tier"
      },
      {
        id: "openrouter",
        name: "Nemotron 3.5 Lightning (Free)",
        provider: "OpenRouter (Free)",
        category: "High Parameter Free",
        badge: "Free 100%",
        badgeColor: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
        description: "Accelerated Nemotron intelligence available 100% free via OpenRouter public tier.",
        supportsVision: false,
        supportsReasoning: true,
        speed: "⚡⚡ Fast",
        cost: "100% Free"
      },
      {
        id: "nvidia",
        name: "NVIDIA Nemotron 3 Super 120B",
        provider: "NVIDIA NIM",
        category: "Enterprise Reasoning",
        badge: "NVIDIA NIM",
        badgeColor: "bg-green-500/10 text-green-400 border-green-500/20",
        description: "NVIDIA hosted accelerated Nemotron model with high precision and STEM proficiency.",
        supportsVision: false,
        supportsReasoning: true,
        speed: "⚡⚡⚡ Fast",
        cost: "Free Credits"
      },
      {
        id: "9router",
        name: "Claude 3.5 Sonnet (via 9Router)",
        provider: "9Router Bridge",
        category: "Coding & Reasoning",
        badge: "9Router Local",
        badgeColor: "bg-orange-500/10 text-orange-400 border-orange-500/20",
        description: "Routes locally via 9Router (port 20128) with 3-tier smart fallback and 40+ provider support.",
        supportsVision: true,
        supportsReasoning: true,
        speed: "⚡⚡⚡ Fast",
        cost: "Local Bridge"
      }
    ];
  }
}

/**
 * Stream a chat completion from LiteLLM proxy
 */
export async function streamChatCompletion({
  messages,
  model,
  temperature = 0.7,
  systemPrompt = '',
  serverUrl = DEFAULT_SERVER_URL,
  apiKeys = {},
  token = null,
  signal,
  onChunk,
  onFinish,
  onError
}) {
  try {
    const formattedMessages = [];
    if (systemPrompt && systemPrompt.trim()) {
      formattedMessages.push({ role: 'system', content: systemPrompt.trim() });
    }
    formattedMessages.push(...messages);

    const headers = {
      'Content-Type': 'application/json',
      'X-Model-Name': model
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    // Attach custom user API keys if provided in settings
    if (apiKeys.gemini) headers['X-Gemini-Key'] = apiKeys.gemini;
    if (apiKeys.groq) headers['X-Groq-Key'] = apiKeys.groq;
    if (apiKeys.openrouter) headers['X-OpenRouter-Key'] = apiKeys.openrouter;
    if (apiKeys.nvidia) headers['X-Nvidia-Key'] = apiKeys.nvidia;
    if (apiKeys.aion) headers['X-Aion-Key'] = apiKeys.aion;
    if (apiKeys.cloudflare) headers['X-Cf-Key'] = apiKeys.cloudflare;
    if (apiKeys.ninerouter || apiKeys['9router']) headers['X-9Router-Key'] = apiKeys.ninerouter || apiKeys['9router'];

    const res = await fetch(`${serverUrl}/v1/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model,
        messages: formattedMessages,
        temperature,
        stream: true
      }),
      signal
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => `HTTP ${res.status}`);
      throw new Error(errText || `Server responded with ${res.status}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let fullText = '';
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // Keep incomplete line in buffer

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith(':')) continue;

        if (trimmed === 'data: [DONE]') {
          onFinish?.(fullText);
          return fullText;
        }

        if (trimmed.startsWith('data: ')) {
          try {
            const jsonStr = trimmed.slice(6);
            const parsed = JSON.parse(jsonStr);
            const delta = parsed.choices?.[0]?.delta?.content || '';
            if (delta) {
              fullText += delta;
              onChunk?.(delta, fullText);
            }
          } catch (e) {
            // Not valid JSON chunk, ignore or pass through raw
          }
        }
      }
    }

    onFinish?.(fullText);
    return fullText;
  } catch (err) {
    if (err.name === 'AbortError') {
      console.log('Stream aborted by user');
      return;
    }
    onError?.(err);
    throw err;
  }
}

/**
 * Authentication & Admin API helpers
 */

export async function loginApi(serverUrl, { email, password }) {
  const res = await fetch(`${serverUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Login failed.');
  return data;
}

export async function registerApi(serverUrl, { name, email, password }) {
  const res = await fetch(`${serverUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Registration failed.');
  return data;
}

export async function fetchCurrentUser(serverUrl, token) {
  if (!token) return null;
  const res = await fetch(`${serverUrl}/api/auth/me`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.user || null;
}

export async function fetchSuperAdminCredentials(serverUrl) {
  try {
    const res = await fetch(`${serverUrl}/api/auth/superadmin-credentials`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return {
      email: 'admin@namogpt.com',
      password: 'Admin@NamoGPT2026!',
      role: 'superadmin',
      name: 'Super Admin',
      isDefault: true
    };
  }
}

export async function fetchAdminStatus(serverUrl, token) {
  const res = await fetch(`${serverUrl}/api/admin/status`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to fetch admin status.');
  return data;
}

export async function fetchAdminUsers(serverUrl, token) {
  const res = await fetch(`${serverUrl}/api/auth/users`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to fetch users list.');
  return data.users || [];
}

