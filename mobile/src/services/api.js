export const DEFAULT_MOBILE_SERVER = 'http://10.0.2.2:3001'; // Default for Android Emulator, or LAN IP (e.g. http://192.168.1.x:3001)

export const FALLBACK_MODELS = [
  {
    id: "gemini",
    name: "Gemini 2.5 Flash",
    provider: "Google AI",
    badge: "Recommended",
    description: "Multimodal, ultra-fast 1M context",
    speed: "⚡ Fast",
    supportsVision: true
  },
  {
    id: "groq",
    name: "Llama 3.3 70B",
    provider: "Groq Cloud",
    badge: "Ultra Fast",
    description: "300 tokens/s LPU inference",
    speed: "⚡⚡⚡ 300 t/s",
    supportsVision: false
  },
  {
    id: "groq-r1",
    name: "DeepSeek R1 Distill",
    provider: "Groq Cloud",
    badge: "Reasoning",
    description: "Chain of thought logic & math",
    speed: "⚡⚡ 250 t/s",
    supportsVision: false
  },
  {
    id: "groq-instant",
    name: "Llama 3.1 8B Instant",
    provider: "Groq Cloud",
    badge: "Lowest Latency",
    description: "Near-instantaneous responses",
    speed: "⚡⚡⚡⚡ 750 t/s",
    supportsVision: false
  },
  {
    id: "openrouter",
    name: "Nemotron 3 Ultra 550B",
    provider: "OpenRouter",
    badge: "Free 550B",
    description: "Massive open model",
    speed: "⚡ Steady",
    supportsVision: false
  },
  {
    id: "openrouter-r1",
    name: "DeepSeek R1 (OpenRouter)",
    provider: "OpenRouter",
    badge: "Free Tier",
    description: "Flagship reasoning open model",
    speed: "⚡ Steady",
    supportsVision: false
  },
  {
    id: "nvidia",
    name: "NVIDIA Super 120B",
    provider: "NVIDIA NIM",
    badge: "NVIDIA",
    description: "Accelerated enterprise intelligence",
    speed: "⚡ Fast",
    supportsVision: false
  },
  {
    id: "cloudflare",
    name: "Llama 3.3 70B (Cloudflare)",
    provider: "Cloudflare Workers AI",
    badge: "10k Free Neurons",
    description: "Edge accelerated serverless inference",
    speed: "⚡⚡ Fast",
    supportsVision: false
  }
];

export async function fetchMobileModels(serverUrl) {
  try {
    const res = await fetch(`${serverUrl}/api/models`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data.data || FALLBACK_MODELS;
  } catch (err) {
    return FALLBACK_MODELS;
  }
}

export async function sendMobileMessage({
  messages,
  model,
  serverUrl,
  token = null,
  apiKeys = {}
}) {
  const headers = {
    'Content-Type': 'application/json',
    'X-Model-Name': model
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  if (apiKeys.gemini) headers['X-Gemini-Key'] = apiKeys.gemini;
  if (apiKeys.groq) headers['X-Groq-Key'] = apiKeys.groq;
  if (apiKeys.openrouter) headers['X-OpenRouter-Key'] = apiKeys.openrouter;
  if (apiKeys.nvidia) headers['X-Nvidia-Key'] = apiKeys.nvidia;
  if (apiKeys.cloudflare) headers['X-Cf-Key'] = apiKeys.cloudflare;

  const res = await fetch(`${serverUrl}/v1/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model,
      messages,
      stream: false
    })
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => `HTTP ${res.status}`);
    throw new Error(errText || 'Request failed');
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || 'No response';
}

export async function mobileLoginApi(serverUrl, { email, password }) {
  const res = await fetch(`${serverUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Login failed');
  return data;
}

export async function mobileRegisterApi(serverUrl, { name, email, password }) {
  const res = await fetch(`${serverUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Registration failed');
  return data;
}

export async function mobileFetchSuperAdminCredentials(serverUrl) {
  try {
    const res = await fetch(`${serverUrl}/api/auth/superadmin-credentials`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return {
      email: 'admin@namogpt.com',
      password: 'Admin@NamoGPT2026!',
      role: 'superadmin',
      name: 'Super Admin'
    };
  }
}
