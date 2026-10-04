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
  ShieldCheck
} from 'lucide-react';

export default function SettingsModal() {
  const { isSettingsOpen, setIsSettingsOpen, settings, updateSettings } = useChat();

  const [activeTab, setActiveTab] = useState('keys');
  const [formData, setFormData] = useState(settings);
  const [savedSuccess, setSavedSuccess] = useState(false);

  if (!isSettingsOpen) return null;

  function handleSave() {
    updateSettings(formData);
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
      desc: 'Free 1M token context window & vision',
      url: 'https://aistudio.google.com/apikey',
      keyField: 'gemini'
    },
    {
      id: 'groq',
      name: 'Groq Cloud',
      desc: 'Blazing 300 t/s LPU inference',
      url: 'https://console.groq.com/keys',
      keyField: 'groq'
    },
    {
      id: 'openrouter',
      name: 'OpenRouter Free Tier',
      desc: 'Free Nemotron 550B & DeepSeek R1',
      url: 'https://openrouter.ai/keys',
      keyField: 'openrouter'
    },
    {
      id: 'nvidia',
      name: 'NVIDIA NIM',
      desc: '1,000 free GPU credits on signup',
      url: 'https://build.nvidia.com',
      keyField: 'nvidia'
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
