/**
 * NamoGPT Models Catalog & Metadata
 * 
 * Defines model definitions, capabilities, status, and environment key requirements.
 * Auto (Smart Router) is mounted at index 0.
 * Models dynamically reflect active/coming_soon status based on configured server keys.
 */

/**
 * Checks whether an environment variable key is configured and non-empty in process.env.
 * Supports variations and numbered keys (e.g. GEMINI_API_KEY_1).
 * 
 * @param {string} keyEnvVar 
 * @returns {boolean}
 */
export function checkProviderKey(keyEnvVar) {
  if (!keyEnvVar) return false;
  if (process.env[keyEnvVar] && Boolean(process.env[keyEnvVar].trim())) {
    return true;
  }

  // Check indexed keys (e.g., GEMINI_API_KEY_1, GROQ_API_KEY_2)
  const matchingEnv = Object.keys(process.env).find(k =>
    k.startsWith(keyEnvVar) && Boolean(process.env[k]?.trim())
  );
  if (matchingEnv) return true;

  // OpenRouter aliases
  if (keyEnvVar.includes('OPEN_ROUTER') || keyEnvVar.includes('OPENROUTER')) {
    if (process.env.OPENROUTER_API_KEY?.trim() || process.env.OPEN_ROUTER_API_KEY?.trim()) return true;
  }

  // NVIDIA NIM aliases
  if (keyEnvVar.includes('NVIDIA')) {
    if (process.env.NVIDIA_NIM_API_KEY?.trim() || process.env.NVIDIA_API_KEY?.trim()) return true;
  }

  // Cloudflare aliases
  if (keyEnvVar.includes('CF_API_TOKEN')) {
    if (process.env.CF_API_TOKEN?.trim() || process.env.CLOUDFLARE_API_TOKEN?.trim() || process.env.CLOUDFLARE_API_KEY?.trim()) {
      return true;
    }
  }

  return false;
}

/**
 * Returns current status map of all supported provider keys.
 * @returns {Record<string, 'active'|'coming_soon'>}
 */
export function getProviderKeysStatus() {
  return {
    gemini: 'active',
    groq: 'active',
    openrouter: checkProviderKey('OPEN_ROUTER_API_KEY') ? 'active' : 'coming_soon',
    nvidia: checkProviderKey('NVIDIA_NIM_API_KEY') ? 'active' : 'coming_soon',
    aion: checkProviderKey('AION_API_KEY') ? 'active' : 'coming_soon',
    cloudflare: checkProviderKey('CF_API_TOKEN') ? 'active' : 'coming_soon',
    ninerouter: 'active',
    omnirouter: 'active'
  };
}

const RAW_MODELS_DEFINITIONS = [
  // Index 0: Auto (Smart Router)
  {
    id: "auto",
    name: "✨ Auto (Smart Router)",
    provider: "NamoGPT Core",
    category: "Intelligent Routing",
    badge: "Recommended",
    badgeColor: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    description: "Automatically selects the fastest available model, routes images to vision LPUs, and applies deep reasoning on complex STEM problems.",
    supportsVision: true,
    supportsAudio: false,
    supportsReasoning: true,
    speed: "⚡⚡⚡⚡ Dynamic",
    cost: "100% Free",
    status: "active",
    isWorking: true,
    upstreamModel: "auto",
    keyEnvVar: null,
    icon: "sparkles"
  },
  {
    id: "gemini",
    name: "Gemini 2.5 Flash (Vision & Reasoning)",
    provider: "Google AI",
    category: "Multimodal & Fast",
    badge: "Recommended",
    badgeColor: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    description: "Ultra-fast multimodal reasoning, image vision, OCR, coding, and 1M token context window.",
    contextWindow: "1,048,576 tokens",
    maxTokens: 8192,
    supportsVision: true,
    supportsAudio: false,
    supportsReasoning: true,
    speed: "⚡⚡⚡ Fast",
    cost: "Free Tier",
    upstreamModel: "gemini/gemini-2.5-flash",
    keyEnvVar: "GEMINI_API_KEY",
    icon: "google"
  },
  {
    id: "groq",
    name: "GPT-OSS 120B (Groq)",
    provider: "Groq Cloud",
    category: "General Intelligence",
    badge: "Ultra Fast",
    badgeColor: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    description: "Massive 120B parameter open intelligence running at blazing LPU speeds (~300 t/s).",
    contextWindow: "128,000 tokens",
    maxTokens: 8192,
    supportsVision: false,
    supportsAudio: false,
    supportsReasoning: false,
    speed: "⚡⚡⚡⚡⚡ 300 t/s",
    cost: "Free Tier",
    upstreamModel: "groq/openai/gpt-oss-120b",
    keyEnvVar: "GROQ_API_KEY",
    icon: "groq"
  },
  {
    id: "groq-r1",
    name: "Qwen 3.8 27B Reasoning (Groq)",
    provider: "Groq Cloud",
    category: "Deep Reasoning",
    badge: "Reasoning",
    badgeColor: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    description: "Advanced mathematical & logical reasoning model accelerated on Groq LPUs (~250 t/s).",
    contextWindow: "128,000 tokens",
    maxTokens: 8192,
    supportsVision: false,
    supportsAudio: false,
    supportsReasoning: true,
    speed: "⚡⚡⚡⚡ ~250 t/s",
    cost: "Free Tier",
    upstreamModel: "groq/qwen/qwen3.8-27b",
    keyEnvVar: "GROQ_API_KEY",
    icon: "deepseek"
  },
  {
    id: "groq-instant",
    name: "GPT-OSS 20B Instant (Groq)",
    provider: "Groq Cloud",
    category: "Instant Responses",
    badge: "Lowest Latency",
    badgeColor: "bg-sky-500/10 text-sky-400 border-sky-500/20",
    description: "Ultra-low latency output (~750 tokens/sec). Perfect for fast edits and quick queries.",
    contextWindow: "128,000 tokens",
    maxTokens: 8192,
    supportsVision: false,
    supportsAudio: false,
    supportsReasoning: false,
    speed: "⚡⚡⚡⚡⚡ 750 t/s",
    cost: "Free Tier",
    upstreamModel: "groq/openai/gpt-oss-20b",
    keyEnvVar: "GROQ_API_KEY",
    icon: "groq"
  },
  {
    id: "openrouter",
    name: "Nemotron 3.5 Lightning (Free)",
    provider: "OpenRouter (Free)",
    category: "High Parameter Free",
    badge: "Free 100%",
    badgeColor: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
    description: "Accelerated Nemotron intelligence available 100% free via OpenRouter public tier.",
    contextWindow: "128,000 tokens",
    maxTokens: 4096,
    supportsVision: false,
    supportsAudio: false,
    supportsReasoning: true,
    speed: "⚡⚡ Fast",
    cost: "100% Free",
    upstreamModel: "openrouter/nvidia/nemotron-3.5-lightning:free",
    keyEnvVar: "OPEN_ROUTER_API_KEY",
    icon: "openrouter"
  },
  {
    id: "openrouter-r1",
    name: "Qwen 3.8 27B Free Reasoning",
    provider: "OpenRouter (Free)",
    category: "Full Reasoning",
    badge: "Free Reasoning",
    badgeColor: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    description: "Flagship deep reasoning model available 100% free with chain-of-thought capabilities.",
    contextWindow: "64,000 tokens",
    maxTokens: 4096,
    supportsVision: false,
    supportsAudio: false,
    supportsReasoning: true,
    speed: "⚡ Steady",
    cost: "100% Free",
    upstreamModel: "openrouter/qwen/qwen3.8-27b:free",
    keyEnvVar: "OPEN_ROUTER_API_KEY",
    icon: "deepseek"
  },
  {
    id: "nvidia",
    name: "NVIDIA Nemotron 3 Super 120B",
    provider: "NVIDIA NIM",
    category: "Enterprise Reasoning",
    badge: "NVIDIA NIM",
    badgeColor: "bg-green-500/10 text-green-400 border-green-500/20",
    description: "NVIDIA hosted accelerated Nemotron model with high precision and STEM proficiency.",
    contextWindow: "128,000 tokens",
    maxTokens: 4096,
    supportsVision: false,
    supportsAudio: false,
    supportsReasoning: true,
    speed: "⚡⚡⚡ Fast",
    cost: "Free Tier Credits",
    upstreamModel: "openai/nvidia/nemotron-3-super-120b-a12b",
    keyEnvVar: "NVIDIA_NIM_API_KEY",
    icon: "nvidia"
  },
  {
    id: "aion-2.0",
    name: "AION 2.0 Labs",
    provider: "AION Labs",
    category: "Domain Intelligence",
    badge: "Specialized",
    badgeColor: "bg-rose-500/10 text-rose-400 border-rose-500/20",
    description: "Next-gen AION Labs reasoning engine optimized for complex logic and instructions.",
    contextWindow: "32,000 tokens",
    maxTokens: 4096,
    supportsVision: false,
    supportsAudio: false,
    supportsReasoning: true,
    speed: "⚡⚡ Medium",
    cost: "Free Tier",
    upstreamModel: "openai/aion-labs/aion-2.0",
    keyEnvVar: "AION_API_KEY",
    icon: "aion"
  },
  {
    id: "cloudflare",
    name: "Llama 3.3 70B (Cloudflare)",
    provider: "Cloudflare Workers AI",
    category: "Edge Accelerated",
    badge: "Free 10k Neurons",
    badgeColor: "bg-orange-500/10 text-orange-400 border-orange-500/20",
    description: "Serverless edge inference powered by Cloudflare Workers AI with 10k free daily neurons.",
    contextWindow: "128,000 tokens",
    maxTokens: 4096,
    supportsVision: false,
    supportsAudio: false,
    supportsReasoning: false,
    speed: "⚡⚡⚡ Fast",
    cost: "100% Free",
    upstreamModel: "openai/@cf/meta/llama-3.3-70b-instruct",
    keyEnvVar: "CF_API_TOKEN",
    icon: "cloudflare"
  },
  {
    id: "9router",
    name: "Claude 3.5 Sonnet (via 9Router)",
    provider: "9Router Bridge",
    category: "Coding & Reasoning",
    badge: "9Router Local",
    badgeColor: "bg-orange-500/10 text-orange-400 border-orange-500/20",
    description: "Routes locally via 9Router (port 20128) with 3-tier smart fallback and 40+ provider support.",
    contextWindow: "200,000 tokens",
    maxTokens: 8192,
    supportsVision: true,
    supportsReasoning: true,
    speed: "⚡⚡⚡ Fast",
    cost: "Local Bridge",
    status: "active",
    isWorking: true,
    upstreamModel: "openai/claude-3-5-sonnet",
    keyEnvVar: "NINEROUTER_API_KEY",
    icon: "router"
  },
  {
    id: "omnirouter",
    name: "OmniRouter Universal Gateway",
    provider: "OmniRouter Bridge",
    category: "Universal AI Proxy",
    badge: "OmniRouter",
    badgeColor: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    description: "Routes locally via OmniRoute/OmniRouter (port 20128) across 60+ providers with auto-fallback.",
    contextWindow: "128,000 tokens",
    maxTokens: 8192,
    supportsVision: true,
    supportsReasoning: true,
    speed: "⚡⚡⚡ Fast",
    cost: "Local Bridge",
    status: "active",
    isWorking: true,
    upstreamModel: "openai/omni-auto",
    keyEnvVar: "OMNIROUTER_API_KEY",
    icon: "router"
  },
  {
    id: "groq-vision",
    name: "Llama 3.2 90B Vision (Groq)",
    provider: "Groq Cloud",
    category: "Vision & Multimodal",
    badge: "Free Vision",
    badgeColor: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    description: "Free multimodal image understanding, chart reading, and OCR accelerated on Groq LPUs.",
    contextWindow: "128,000 tokens",
    maxTokens: 8192,
    supportsVision: true,
    supportsReasoning: false,
    speed: "⚡⚡⚡⚡ ~250 t/s",
    cost: "Free Tier",
    upstreamModel: "groq/llama-3.2-90b-vision-preview",
    keyEnvVar: "GROQ_API_KEY",
    icon: "groq"
  },
  {
    id: "deepseek-r1",
    name: "DeepSeek R1 (Thinking Mode)",
    provider: "Groq Cloud / DeepSeek",
    category: "Thinking & Deep Reasoning",
    badge: "Thinking Mode",
    badgeColor: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    description: "Full chain-of-thought mathematical and logical reasoning with collapsible thinking steps.",
    contextWindow: "128,000 tokens",
    maxTokens: 8192,
    supportsVision: false,
    supportsReasoning: true,
    speed: "⚡⚡⚡⚡ ~250 t/s",
    cost: "Free Tier",
    upstreamModel: "groq/deepseek-r1-distill-llama-70b",
    keyEnvVar: "GROQ_API_KEY",
    icon: "deepseek"
  }
];

/**
 * Creates dynamic model descriptor with getters that dynamically reflect current environment keys.
 */
function createModelDescriptor(m) {
  // Models confirmed active and ready out of the box
  if (
    m.id === 'auto' ||
    m.id === 'gemini' ||
    m.id.startsWith('groq') ||
    m.id === 'deepseek-r1' ||
    m.id === '9router' ||
    m.id === 'omnirouter'
  ) {
    return {
      ...m,
      status: 'active',
      isWorking: true
    };
  }

  const defaultBadge = m.badge;
  const defaultBadgeColor = m.badgeColor;
  const keyVar = m.keyEnvVar;

  return {
    ...m,
    get status() {
      return checkProviderKey(keyVar) ? 'active' : 'coming_soon';
    },
    get badge() {
      return checkProviderKey(keyVar) ? defaultBadge : 'Coming Soon';
    },
    get badgeColor() {
      return checkProviderKey(keyVar) ? defaultBadgeColor : 'bg-zinc-800 text-zinc-400 border-zinc-700';
    },
    get isWorking() {
      return checkProviderKey(keyVar);
    }
  };
}

export const AVAILABLE_MODELS = RAW_MODELS_DEFINITIONS.map(createModelDescriptor);
