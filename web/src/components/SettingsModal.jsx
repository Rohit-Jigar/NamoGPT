import React, { useState } from 'react';
import { useChat } from '../context/ChatContext';
import {
  X,
  Key,
  Sliders,
  Server,
  Sparkles,
  ExternalLink,
  Check,
  ShieldCheck,
  Router,
  Activity,
  CheckCircle2,
  XCircle,
  Loader2,
  Zap
} from 'lucide-react';

export default function SettingsModal() {
  const { isSettingsOpen, setIsSettingsOpen, settings, updateSettings } = useChat();

  const [activeTab, setActiveTab] = useState('keys');
  const [formData, setFormData] = useState(() => ({
    ...settings,
    apiKeys: {
      gemini: '',
      groq: '',
      openrouter: '',
      nvidia: '',
      aion: '',
      cloudflare: '',
      ninerouter: '',
      omnirouter: '',
      ...(settings.apiKeys || {})
    },
    nineRouter: {
      enabled: settings.nineRouter?.enabled ?? true,
      baseUrl: settings.nineRouter?.baseUrl || 'http://localhost:20128/v1',
      apiKey: settings.nineRouter?.apiKey || settings.apiKeys?.ninerouter || ''
    },
    omniRouter: {
      enabled: settings.omniRouter?.enabled ?? true,
      baseUrl: settings.omniRouter?.baseUrl || 'http://localhost:20128/v1',
      apiKey: settings.omniRouter?.apiKey || settings.apiKeys?.omnirouter || ''
    }
  }));
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [isPinging, setIsPinging] = useState(false);
  const [pingResult, setPingResult] = useState(null);
  const [isPingingOmni, setIsPingingOmni] = useState(false);
  const [pingOmniResult, setPingOmniResult] = useState(null);

  if (!isSettingsOpen) return null;

  async function handlePing9Router() {
    setIsPinging(true);
    setPingResult(null);

    const baseUrl = (formData.nineRouter?.baseUrl || 'http://localhost:20128/v1').replace(/\/$/, '');
    const pingEndpoint = `${baseUrl}/models`;
    const apiKey = formData.nineRouter?.apiKey || formData.apiKeys?.ninerouter || '';
    const startTime = performance.now();

    try {
      // 1. Direct browser fetch to 9router /v1/models
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      const headers = { Accept: 'application/json' };
      if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

      const res = await fetch(pingEndpoint, {
        method: 'GET',
        headers,
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      const latency = Math.round(performance.now() - startTime);

      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        const count = Array.isArray(data?.data)
          ? data.data.length
          : Array.isArray(data)
          ? data.length
          : 0;
        setPingResult({
          success: true,
          latency,
          message: `Live bridge connected on port 20128 (${latency}ms latency${
            count > 0 ? ` • ${count} upstream models detected` : ' • HTTP 200 OK'
          })`
        });
        return;
      } else {
        setPingResult({
          success: false,
          latency,
          message: `9Router reached but responded with HTTP ${res.status}: ${res.statusText}`
        });
        return;
      }
    } catch (directErr) {
      // 2. Direct browser fetch failed (e.g. CORS restrictions on localhost:20128 or network).
      // Fallback: ping via backend server /api/9router/ping
      try {
        const proxyRes = await fetch(
          `${formData.serverUrl || ''}/api/9router/ping?url=${encodeURIComponent(baseUrl)}${
            apiKey ? `&apiKey=${encodeURIComponent(apiKey)}` : ''
          }`
        );
        const latency = Math.round(performance.now() - startTime);
        if (proxyRes.ok) {
          const data = await proxyRes.json();
          if (data.success) {
            const count = Array.isArray(data.data?.data)
              ? data.data.data.length
              : 0;
            setPingResult({
              success: true,
              latency: data.latency || latency,
              message: `Live bridge connected via server proxy (${data.latency || latency}ms latency${
                count > 0 ? ` • ${count} models reported` : ' • HTTP 200 OK'
              })`
            });
            return;
          }
        }
      } catch (proxyErr) {
        // Fall through to error
      }

      const latency = Math.round(performance.now() - startTime);
      setPingResult({
        success: false,
        latency,
        message:
          directErr.name === 'AbortError'
            ? `Connection timed out after 4 seconds. Ensure 9Router is actively running at ${baseUrl}.`
            : `Could not connect to ${pingEndpoint}. Please ensure 9Router is running on port 20128.`
      });
    } finally {
      setIsPinging(false);
    }
  }

  async function handlePingOmniRouter() {
    setIsPingingOmni(true);
    setPingOmniResult(null);

    const baseUrl = (formData.omniRouter?.baseUrl || 'http://localhost:20128/v1').replace(/\/$/, '');
    const pingEndpoint = `${baseUrl}/models`;
    const apiKey = formData.omniRouter?.apiKey || formData.apiKeys?.omnirouter || '';
    const startTime = performance.now();

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      const headers = { Accept: 'application/json' };
      if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

      const res = await fetch(pingEndpoint, {
        method: 'GET',
        headers,
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      const latency = Math.round(performance.now() - startTime);

      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        const count = Array.isArray(data?.data) ? data.data.length : 0;
        setPingOmniResult({
          success: true,
          latency,
          message: `OmniRouter bridge connected on port 20128 (${latency}ms latency${
            count > 0 ? ` • ${count} upstream models active` : ' • HTTP 200 OK'
          })`
        });
        return;
      } else {
        setPingOmniResult({
          success: false,
          latency,
          message: `OmniRouter responded with HTTP ${res.status}: ${res.statusText}`
        });
        return;
      }
    } catch (directErr) {
      try {
        const proxyRes = await fetch(
          `${formData.serverUrl || ''}/api/omnirouter/ping?url=${encodeURIComponent(baseUrl)}${
            apiKey ? `&apiKey=${encodeURIComponent(apiKey)}` : ''
          }`
        );
        const latency = Math.round(performance.now() - startTime);
        if (proxyRes.ok) {
          const data = await proxyRes.json();
          if (data.success) {
            setPingOmniResult({
              success: true,
              latency: data.latency || latency,
              message: `OmniRouter connected via server proxy (${data.latency || latency}ms latency)`
            });
            return;
          }
        }
      } catch {}

      const latency = Math.round(performance.now() - startTime);
      setPingOmniResult({
        success: false,
        latency,
        message:
          directErr.name === 'AbortError'
            ? `Connection timed out after 4 seconds. Ensure OmniRouter is running at ${baseUrl}.`
            : `Could not connect to ${pingEndpoint}. Please ensure OmniRoute / OmniRouter is running.`
      });
    } finally {
      setIsPingingOmni(false);
    }
  }

  function handleSave() {
    updateSettings({
      ...formData,
      apiKeys: {
        ...formData.apiKeys,
        ninerouter: formData.nineRouter?.apiKey || formData.apiKeys?.ninerouter || '',
        omnirouter: formData.omniRouter?.apiKey || formData.apiKeys?.omnirouter || ''
      },
      nineRouter: {
        enabled: formData.nineRouter?.enabled ?? true,
        baseUrl: formData.nineRouter?.baseUrl || 'http://localhost:20128/v1',
        apiKey: formData.nineRouter?.apiKey || ''
      },
      omniRouter: {
        enabled: formData.omniRouter?.enabled ?? true,
        baseUrl: formData.omniRouter?.baseUrl || 'http://localhost:20128/v1',
        apiKey: formData.omniRouter?.apiKey || ''
      }
    });
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      setIsSettingsOpen(false);
    }, 1000);
  }

  const freeKeyProviders = [
    {
      id: 'gemini',
      name: 'Google Gemini AI',
      desc: 'Free Gemini 2.5 Flash, 1M context, vision OCR & reasoning',
      url: 'https://aistudio.google.com/app/apikey',
      keyField: 'gemini'
    },
    {
      id: 'groq',
      name: 'Groq Cloud',
      desc: 'Free DeepSeek R1 Distill, Llama 3.2 90B Vision, Llama 3.3 (~300 t/s)',
      url: 'https://console.groq.com/keys',
      keyField: 'groq'
    },
    {
      id: 'openrouter',
      name: 'OpenRouter Free Tier',
      desc: 'Free access to open-source models ending in :free',
      url: 'https://openrouter.ai/keys',
      keyField: 'openrouter'
    },
    {
      id: 'nvidia',
      name: 'NVIDIA NIM',
      desc: '1,000 free enterprise inference GPU credits on signup',
      url: 'https://build.nvidia.com',
      keyField: 'nvidia'
    },
    {
      id: 'cloudflare',
      name: 'Cloudflare Workers AI',
      desc: '10,000 free daily neurons (Llama 3.3 70B & Vision)',
      url: 'https://dash.cloudflare.com/profile/api-tokens',
      keyField: 'cloudflare'
    },
    {
      id: '9router',
      name: '9Router Local Bridge',
      desc: 'Local bridge on port 20128 (Claude 3.5 & GPT-4o)',
      url: 'http://localhost:20128/v1/models',
      keyField: 'ninerouter'
    },
    {
      id: 'omnirouter',
      name: 'OmniRouter AI Gateway',
      desc: 'Universal gateway for 60+ providers on port 20128 with failover',
      url: 'http://localhost:20128/v1/models',
      keyField: 'omnirouter'
    }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm select-none">
      <div className="bg-[#171717] border border-[#303030] rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#303030]">
          <div className="flex items-center space-x-2.5">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-emerald-400" />
            </div>
            <h2 className="text-base font-semibold text-white">NamoGPT Settings</h2>
          </div>
          <button
            onClick={() => setIsSettingsOpen(false)}
            className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs Bar */}
        <div className="flex items-center space-x-2 px-6 pt-3 border-b border-[#303030]/60">
          <button
            onClick={() => setActiveTab('keys')}
            className={`flex items-center space-x-2 px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
              activeTab === 'keys'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-zinc-400 hover:text-white'
            }`}
          >
            <Key className="w-3.5 h-3.5" />
            <span>API Keys</span>
          </button>
          <button
            onClick={() => setActiveTab('persona')}
            className={`flex items-center space-x-2 px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
              activeTab === 'persona'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-zinc-400 hover:text-white'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Instructions & Model</span>
          </button>
          <button
            onClick={() => setActiveTab('server')}
            className={`flex items-center space-x-2 px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
              activeTab === 'server'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-zinc-400 hover:text-white'
            }`}
          >
            <Server className="w-3.5 h-3.5" />
            <span>LiteLLM Server</span>
          </button>
          <button
            onClick={() => setActiveTab('9router')}
            className={`flex items-center space-x-2 px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
              activeTab === '9router'
                ? 'border-orange-500 text-orange-400'
                : 'border-transparent text-zinc-400 hover:text-white'
            }`}
          >
            <Router className="w-3.5 h-3.5" />
            <span>AI Bridges (9Router / Omni)</span>
          </button>
        </div>

        {/* Tab Body */}
        <div className="p-6 max-h-[60vh] overflow-y-auto space-y-4">
          {/* TAB 1: API Keys */}
          {activeTab === 'keys' && (
            <div className="space-y-4">
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 flex items-start gap-2.5">
                <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold">Local & Client Storage:</span> Your API keys are stored in your browser and sent securely only to your LiteLLM server to authenticate upstream requests.
                </div>
              </div>

              <div className="space-y-3">
                {freeKeyProviders.map((item) => (
                  <div key={item.id} className="space-y-1.5 p-3 rounded-xl bg-[#212121] border border-zinc-800">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-white">{item.name}</label>
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
                      >
                        <span>Get Free Key</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                    <p className="text-[11px] text-zinc-400">{item.desc}</p>
                    <input
                      type="password"
                      placeholder={`Paste your ${item.name} key...`}
                      value={formData.apiKeys[item.keyField] || ''}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          apiKeys: { ...formData.apiKeys, [item.keyField]: e.target.value }
                        })
                      }
                      className="w-full bg-zinc-900 text-xs text-white placeholder-zinc-500 px-3 py-2 rounded-lg border border-zinc-700/60 focus:border-emerald-500 outline-none"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 2: Persona & Model Parameters */}
          {activeTab === 'persona' && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-white">Custom System Prompt</label>
                <p className="text-[11px] text-zinc-400">
                  Define instructions or personality for NamoGPT.
                </p>
                <textarea
                  rows={4}
                  value={formData.systemPrompt}
                  onChange={(e) => setFormData({ ...formData, systemPrompt: e.target.value })}
                  placeholder="You are an expert software architect and mathematical assistant..."
                  className="w-full bg-[#212121] text-xs text-white placeholder-zinc-500 p-3 rounded-xl border border-zinc-800 focus:border-emerald-500 outline-none"
                />
              </div>

              <div className="space-y-2 p-3 rounded-xl bg-[#212121] border border-zinc-800">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-white">Temperature</span>
                  <span className="font-mono text-emerald-400">{formData.temperature}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={formData.temperature}
                  onChange={(e) =>
                    setFormData({ ...formData, temperature: parseFloat(e.target.value) })
                  }
                  className="w-full accent-emerald-500 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-zinc-500">
                  <span>Precise / Factual (0.0)</span>
                  <span>Creative (1.0)</span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: Server Endpoint */}
          {activeTab === 'server' && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-white">LiteLLM Server URL</label>
                <p className="text-[11px] text-zinc-400">
                  Point to your local LiteLLM proxy instance or a deployed Vercel/cloud endpoint.
                </p>
                <input
                  type="text"
                  value={formData.serverUrl}
                  onChange={(e) => setFormData({ ...formData, serverUrl: e.target.value })}
                  placeholder="http://localhost:3001"
                  className="w-full bg-[#212121] text-xs text-white placeholder-zinc-500 px-3 py-2 rounded-lg border border-zinc-800 focus:border-emerald-500 outline-none font-mono"
                />
              </div>
            </div>
          )}

          {/* TAB 4: 9Router Local Bridge */}
          {activeTab === '9router' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-orange-500/10 border border-orange-500/20 text-xs text-orange-300 flex items-start gap-2.5">
                <Router className="w-5 h-5 text-orange-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-white">9Router Local Bridge Integration</div>
                  <div className="text-[11px] text-zinc-300 mt-0.5 leading-relaxed">
                    Routes queries locally through 9Router on port 20128 with smart 3-tier fallback and 40+ provider capabilities (Claude 3.5 Sonnet, GPT-4o, etc.).
                  </div>
                </div>
              </div>

              {/* Enable / Disable Switch */}
              <div className="p-4 rounded-xl bg-[#212121] border border-zinc-800 flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-white flex items-center gap-2">
                    <span>Enable 9Router Bridge</span>
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                        formData.nineRouter?.enabled
                          ? 'bg-orange-500/20 text-orange-400 border-orange-500/30'
                          : 'bg-zinc-800 text-zinc-500 border-zinc-700'
                      }`}
                    >
                      {formData.nineRouter?.enabled ? 'Active' : 'Disabled'}
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-400 mt-0.5">
                    Allow NamoGPT to route requests through the local 9Router bridge.
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.nineRouter?.enabled ?? true}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        nineRouter: {
                          ...formData.nineRouter,
                          enabled: e.target.checked
                        }
                      })
                    }
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-600"></div>
                </label>
              </div>

              {/* 9Router Base URL */}
              <div className="space-y-1.5 p-4 rounded-xl bg-[#212121] border border-zinc-800">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-white">9Router Base URL</label>
                  <span className="text-[10px] text-zinc-500 font-mono">Port 20128</span>
                </div>
                <p className="text-[11px] text-zinc-400">
                  OpenAI-compatible HTTP endpoint where 9Router listens for requests.
                </p>
                <input
                  type="text"
                  value={formData.nineRouter?.baseUrl ?? 'http://localhost:20128/v1'}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      nineRouter: {
                        ...formData.nineRouter,
                        baseUrl: e.target.value
                      }
                    })
                  }
                  placeholder="http://localhost:20128/v1"
                  className="w-full bg-zinc-900 text-xs text-white placeholder-zinc-500 px-3 py-2 rounded-lg border border-zinc-700/60 focus:border-orange-500 outline-none font-mono"
                />
              </div>

              {/* Optional API Key */}
              <div className="space-y-1.5 p-4 rounded-xl bg-[#212121] border border-zinc-800">
                <label className="text-xs font-semibold text-white">9Router API Key (Optional)</label>
                <p className="text-[11px] text-zinc-400">
                  Only needed if you configured an authorization token on your local 9Router proxy.
                </p>
                <input
                  type="password"
                  value={formData.nineRouter?.apiKey ?? ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      nineRouter: {
                        ...formData.nineRouter,
                        apiKey: e.target.value
                      }
                    })
                  }
                  placeholder="Leave blank or enter custom key..."
                  className="w-full bg-zinc-900 text-xs text-white placeholder-zinc-500 px-3 py-2 rounded-lg border border-zinc-700/60 focus:border-orange-500 outline-none"
                />
              </div>

              {/* Connectivity Ping Button & Status */}
              <div className="p-4 rounded-xl bg-[#212121] border border-zinc-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-semibold text-white flex items-center gap-1.5">
                      <Activity className="w-3.5 h-3.5 text-orange-400" />
                      <span>Live Bridge Connectivity Ping</span>
                    </div>
                    <p className="text-[11px] text-zinc-400 mt-0.5">
                      Sends a live HTTP GET request to <code className="text-orange-300 font-mono text-[10px]">{(formData.nineRouter?.baseUrl || 'http://localhost:20128/v1').replace(/\/$/, '')}/models</code>.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handlePing9Router}
                    disabled={isPinging}
                    className="flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white text-xs font-semibold transition-all shadow-md shadow-orange-950/30 shrink-0"
                  >
                    {isPinging ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Testing...</span>
                      </>
                    ) : (
                      <>
                        <Zap className="w-3.5 h-3.5" />
                        <span>Ping 9Router</span>
                      </>
                    )}
                  </button>
                </div>

                {pingResult && (
                  <div
                    className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 animate-in fade-in duration-150 ${
                      pingResult.success
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                        : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                    }`}
                  >
                    {pingResult.success ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1 space-y-0.5">
                      <div className="font-semibold">
                        {pingResult.success ? 'Bridge Operational' : 'Bridge Unreachable'}
                      </div>
                      <div className="text-[11px] text-zinc-300">{pingResult.message}</div>
                    </div>
                  </div>
                )}
              </div>

              {/* OmniRouter Universal Gateway Section */}
              <div className="pt-4 border-t border-zinc-800 space-y-4">
                <div className="p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-300 flex items-start gap-2.5">
                  <Router className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold text-white">OmniRouter / OmniRoute Gateway Integration</div>
                    <div className="text-[11px] text-zinc-300 mt-0.5 leading-relaxed">
                      Connects locally through OmniRoute gateway on port 20128 aggregating 60+ upstream AI providers with auto-fallback and unified rate-limit bypass.
                    </div>
                  </div>
                </div>

                {/* OmniRouter Switch */}
                <div className="p-4 rounded-xl bg-[#212121] border border-zinc-800 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-semibold text-white flex items-center gap-2">
                      <span>Enable OmniRouter Gateway</span>
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                          formData.omniRouter?.enabled
                            ? 'bg-blue-500/20 text-blue-400 border-blue-500/30'
                            : 'bg-zinc-800 text-zinc-500 border-zinc-700'
                        }`}
                      >
                        {formData.omniRouter?.enabled ? 'Active' : 'Disabled'}
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-400 mt-0.5">
                      Route queries through local OmniRoute multi-provider gateway.
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.omniRouter?.enabled ?? true}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          omniRouter: {
                            ...formData.omniRouter,
                            enabled: e.target.checked
                          }
                        })
                      }
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>

                {/* OmniRouter Base URL */}
                <div className="space-y-1.5 p-4 rounded-xl bg-[#212121] border border-zinc-800">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-white">OmniRouter Base URL</label>
                    <span className="text-[10px] text-zinc-500 font-mono">Port 20128</span>
                  </div>
                  <input
                    type="text"
                    value={formData.omniRouter?.baseUrl ?? 'http://localhost:20128/v1'}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        omniRouter: {
                          ...formData.omniRouter,
                          baseUrl: e.target.value
                        }
                      })
                    }
                    placeholder="http://localhost:20128/v1"
                    className="w-full bg-zinc-900 text-xs text-white placeholder-zinc-500 px-3 py-2 rounded-lg border border-zinc-700/60 focus:border-blue-500 outline-none font-mono"
                  />
                </div>

                {/* Optional OmniRouter Key */}
                <div className="space-y-1.5 p-4 rounded-xl bg-[#212121] border border-zinc-800">
                  <label className="text-xs font-semibold text-white">OmniRouter API Key (Optional)</label>
                  <input
                    type="password"
                    value={formData.omniRouter?.apiKey ?? ''}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        omniRouter: {
                          ...formData.omniRouter,
                          apiKey: e.target.value
                        }
                      })
                    }
                    placeholder="Leave blank or enter custom gateway token..."
                    className="w-full bg-zinc-900 text-xs text-white placeholder-zinc-500 px-3 py-2 rounded-lg border border-zinc-700/60 focus:border-blue-500 outline-none"
                  />
                </div>

                {/* OmniRouter Ping Button & Status */}
                <div className="p-4 rounded-xl bg-[#212121] border border-zinc-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-semibold text-white flex items-center gap-1.5">
                        <Activity className="w-3.5 h-3.5 text-blue-400" />
                        <span>OmniRouter Connectivity Test</span>
                      </div>
                      <p className="text-[11px] text-zinc-400 mt-0.5">
                        Tests connection to <code className="text-blue-300 font-mono text-[10px]">{(formData.omniRouter?.baseUrl || 'http://localhost:20128/v1').replace(/\/$/, '')}/models</code>.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handlePingOmniRouter}
                      disabled={isPingingOmni}
                      className="flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold transition-all shadow-md shadow-blue-950/30 shrink-0"
                    >
                      {isPingingOmni ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Testing...</span>
                        </>
                      ) : (
                        <>
                          <Zap className="w-3.5 h-3.5" />
                          <span>Ping OmniRouter</span>
                        </>
                      )}
                    </button>
                  </div>

                  {pingOmniResult && (
                    <div
                      className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 animate-in fade-in duration-150 ${
                        pingOmniResult.success
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                          : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                      }`}
                    >
                      {pingOmniResult.success ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      ) : (
                        <XCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                      )}
                      <div className="flex-1 space-y-0.5">
                        <div className="font-semibold">
                          {pingOmniResult.success ? 'OmniRouter Connected' : 'OmniRouter Unreachable'}
                        </div>
                        <div className="text-[11px] text-zinc-300">{pingOmniResult.message}</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#303030] bg-[#141414]">
          <button
            onClick={() => setIsSettingsOpen(false)}
            className="px-4 py-2 text-xs font-medium text-zinc-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-lg shadow-emerald-950/40 transition-all hover:scale-[1.02]"
          >
            {savedSuccess ? (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>Saved!</span>
              </>
            ) : (
              <span>Save Changes</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
