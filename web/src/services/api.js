/**
 * NamoGPT API Service
 * Connects to the LiteLLM Proxy server
 */

export const DEFAULT_SERVER_URL = window.location.port === '5173'
  ? 'http://localhost:3001'
  : window.location.origin;

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
        name: "Gemini 2.5 Flash",
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
        name: "Llama 3.3 70B",
        provider: "Groq Cloud",
        category: "General Intelligence",
        badge: "Ultra Fast",
        badgeColor: "bg-amber-500/10 text-amber-400 border-amber-500/20",
        description: "Blazing fast inference (~300 tokens/sec) on Groq LPUs. Exceptional for coding and chat.",
        supportsVision: false,
        supportsReasoning: false,
        speed: "⚡⚡⚡⚡⚡ 300 t/s",
        cost: "Free Tier"
      },
      {
        id: "groq-r1",
        name: "DeepSeek R1 Distill 70B",
        provider: "Groq Cloud",
        category: "Deep Reasoning",
        badge: "Reasoning",
        badgeColor: "bg-purple-500/10 text-purple-400 border-purple-500/20",
        description: "DeepSeek R1 distilled into Llama 70B. Chain-of-thought mathematical & logical reasoning.",
        supportsVision: false,
        supportsReasoning: true,
        speed: "⚡⚡⚡⚡ ~250 t/s",
        cost: "Free Tier"
      },
      {
        id: "openrouter",
        name: "Nemotron 3 Ultra 550B",
        provider: "OpenRouter (Free)",
        category: "High Parameter Free",
        badge: "Free 550B",
        badgeColor: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
        description: "Massive 550B parameter open model with advanced tool calling and agentic capabilities.",
        supportsVision: false,
        supportsReasoning: true,
        speed: "⚡⚡ Medium",
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

    // Attach custom user API keys if provided in settings
    if (apiKeys.gemini) headers['X-Gemini-Key'] = apiKeys.gemini;
    if (apiKeys.groq) headers['X-Groq-Key'] = apiKeys.groq;
    if (apiKeys.openrouter) headers['X-OpenRouter-Key'] = apiKeys.openrouter;
    if (apiKeys.nvidia) headers['X-Nvidia-Key'] = apiKeys.nvidia;
    if (apiKeys.aion) headers['X-Aion-Key'] = apiKeys.aion;

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
