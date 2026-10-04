export const DEFAULT_MOBILE_SERVER = 'http://10.0.2.2:3001'; // Default for Android Emulator or localhost

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
    id: "openrouter",
    name: "Nemotron 3 Ultra 550B",
    provider: "OpenRouter",
    badge: "Free 550B",
    description: "Massive open model",
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
  apiKeys = {}
}) {
  const headers = {
    'Content-Type': 'application/json',
    'X-Model-Name': model
  };

  if (apiKeys.gemini) headers['X-Gemini-Key'] = apiKeys.gemini;
  if (apiKeys.groq) headers['X-Groq-Key'] = apiKeys.groq;
  if (apiKeys.openrouter) headers['X-OpenRouter-Key'] = apiKeys.openrouter;
  if (apiKeys.nvidia) headers['X-Nvidia-Key'] = apiKeys.nvidia;

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
