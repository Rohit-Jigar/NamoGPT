import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { fetchAdminStatus, fetchAdminUsers } from '../services/api';
import {
  Crown,
  X,
  Server,
  Key,
  Users,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Cpu,
  Database,
  Shield,
  Activity,
  Zap,
  Globe
} from 'lucide-react';

export default function AdminModal() {
  const { isAdminModalOpen, setIsAdminModalOpen, token, serverUrl } = useAuth();

  const [activeTab, setActiveTab] = useState('telemetry'); // 'telemetry' or 'users'
  const [statusData, setStatusData] = useState(null);
  const [usersList, setUsersList] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (isAdminModalOpen && token) {
      loadData();
    }
  }, [isAdminModalOpen, token]);

  async function loadData() {
    setIsLoading(true);
    setErrorMsg('');
    try {
      const [status, users] = await Promise.all([
        fetchAdminStatus(serverUrl, token),
        fetchAdminUsers(serverUrl, token)
      ]);
      setStatusData(status);
      setUsersList(users);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to fetch admin diagnostic data.');
    } finally {
      setIsLoading(false);
    }
  }

  if (!isAdminModalOpen) return null;

  function formatBytes(bytes) {
    if (!bytes) return '0 MB';
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }

  function formatUptime(seconds) {
    if (!seconds) return '0s';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs > 0 ? `${hrs}h ` : ''}${mins}m ${secs}s`;
  }

  const providersConfig = [
    { id: 'gemini', name: 'Google Gemini 2.5 Flash', icon: '🟢', envVar: 'GEMINI_API_KEY_1..6' },
    { id: 'groq', name: 'Groq Cloud (Llama 3.3 & DeepSeek R1)', icon: '🟠', envVar: 'GROQ_API_KEY_1..7' },
    { id: 'openrouter', name: 'OpenRouter Free Tier (Nemotron & DeepSeek)', icon: '🔵', envVar: 'OPEN_ROUTER_API_KEY_1..7' },
    { id: 'nvidia', name: 'NVIDIA NIM (Nemotron Super 120B)', icon: '🟢', envVar: 'NVIDIA_NIM_API_KEY_1..5' },
    { id: 'cloudflare', name: 'Cloudflare Workers AI (10k Neurons)', icon: '🟠', envVar: 'CF_API_TOKEN' },
    { id: 'aion', name: 'AION Labs 2.0 Engine', icon: '🔴', envVar: 'AION_API_KEY_1..8' },
    { id: 'ninerouter', name: '9Router Bridge (Port 20128)', icon: '🔄', envVar: 'NINEROUTER_API_KEY' }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md select-none animate-in fade-in duration-200">
      <div className="bg-[#171717] border border-amber-500/30 rounded-3xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-5 border-b border-[#303030] flex items-center justify-between bg-gradient-to-r from-amber-950/20 via-[#212121] to-[#171717]">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <Crown className="w-5 h-5 fill-current" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-base font-bold text-white">Super Admin Console</h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Full Access
                </span>
              </div>
              <p className="text-xs text-zinc-400">
                Inspect LiteLLM proxy status, configured keys in <code className="text-amber-300 font-mono">.env</code>, and user directory.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={loadData}
              disabled={isLoading}
              className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
              title="Refresh Telemetry"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-amber-400' : ''}`} />
            </button>
            <button
              onClick={() => setIsAdminModalOpen(false)}
              className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Selection */}
        <div className="flex items-center space-x-2 px-6 pt-3 border-b border-[#303030]/60 bg-[#1c1c1c]">
          <button
            onClick={() => setActiveTab('telemetry')}
            className={`flex items-center space-x-2 px-3 py-2 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === 'telemetry'
                ? 'border-amber-400 text-amber-300'
                : 'border-transparent text-zinc-400 hover:text-white'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Proxy Telemetry & Keys</span>
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`flex items-center space-x-2 px-3 py-2 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === 'users'
                ? 'border-amber-400 text-amber-300'
                : 'border-transparent text-zinc-400 hover:text-white'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>User Accounts ({usersList.length})</span>
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          {activeTab === 'telemetry' && statusData && (
            <>
              {/* Server Stats Banner */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-2xl bg-[#212121] border border-zinc-800 space-y-1">
                  <div className="text-[11px] text-zinc-400 flex items-center gap-1.5">
                    <Server className="w-3.5 h-3.5 text-emerald-400" /> Uptime
                  </div>
                  <div className="text-sm font-bold text-white font-mono">
                    {formatUptime(statusData.server?.uptime)}
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-[#212121] border border-zinc-800 space-y-1">
                  <div className="text-[11px] text-zinc-400 flex items-center gap-1.5">
                    <Cpu className="w-3.5 h-3.5 text-blue-400" /> Memory (RSS)
                  </div>
                  <div className="text-sm font-bold text-white font-mono">
                    {formatBytes(statusData.server?.memory?.rss)}
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-[#212121] border border-zinc-800 space-y-1">
                  <div className="text-[11px] text-zinc-400 flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5 text-amber-400" /> Master Key
                  </div>
                  <div className="text-sm font-bold font-mono">
                    {statusData.server?.masterKeyConfigured ? (
                      <span className="text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Enforced
                      </span>
                    ) : (
                      <span className="text-zinc-400 text-xs">Optional</span>
                    )}
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-[#212121] border border-zinc-800 space-y-1">
                  <div className="text-[11px] text-zinc-400 flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5 text-orange-400" /> Cloudflare Acc
                  </div>
                  <div className="text-sm font-bold font-mono">
                    {statusData.server?.cloudflareAccountIdConfigured ? (
                      <span className="text-emerald-400 text-xs flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Bound
                      </span>
                    ) : (
                      <span className="text-zinc-400 text-xs">Standard</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Provider Keys Detection Matrix */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
                    <Key className="w-4 h-4 text-emerald-400" />
                    <span>Upstream Providers & Loaded .env Keys</span>
                  </h3>
                  <span className="text-[11px] text-zinc-400 font-mono">
                    Keys masked for security
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {providersConfig.map((prov) => {
                    const detectedKeys = statusData.keysDetected?.[prov.id] || [];
                    const isConfigured = detectedKeys.length > 0;

                    return (
                      <div
                        key={prov.id}
                        className={`p-4 rounded-2xl border transition-all ${
                          isConfigured
                            ? 'bg-[#1e261e]/50 border-emerald-500/30'
                            : 'bg-[#212121] border-zinc-800'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center space-x-2">
                            <span>{prov.icon}</span>
                            <span className="font-semibold text-xs text-white">{prov.name}</span>
                          </div>
                          <span
                            className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                              isConfigured
                                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                                : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                            }`}
                          >
                            {isConfigured ? `${detectedKeys.length} key(s) active` : '0 keys in .env'}
                          </span>
                        </div>

                        <div className="text-[11px] text-zinc-400 font-mono mb-2">
                          Env template: <span className="text-zinc-300">{prov.envVar}</span>
                        </div>

                        {isConfigured ? (
                          <div className="space-y-1">
                            {detectedKeys.map((masked, idx) => (
                              <div
                                key={idx}
                                className="text-[10px] font-mono text-emerald-300 bg-emerald-950/40 px-2.5 py-1 rounded border border-emerald-500/20 flex items-center justify-between"
                              >
                                <span>Key #{idx + 1}</span>
                                <span>{masked}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-[11px] text-zinc-500 italic">
                            No keys detected. Client fallback guidance or Settings key will be used.
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {activeTab === 'users' && (
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
                <Users className="w-4 h-4 text-amber-400" />
                <span>Registered Users Directory</span>
              </h3>

              <div className="rounded-2xl border border-zinc-800 overflow-hidden bg-[#212121]">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#171717] border-b border-zinc-800 text-zinc-400 font-semibold uppercase text-[10px]">
                    <tr>
                      <th className="px-4 py-3">User</th>
                      <th className="px-4 py-3">Role</th>
                      <th className="px-4 py-3">Created</th>
                      <th className="px-4 py-3">Last Login</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {usersList.map((u) => (
                      <tr key={u.id} className="hover:bg-zinc-800/40">
                        <td className="px-4 py-3">
                          <div className="font-semibold text-white">{u.name}</div>
                          <div className="text-[11px] text-zinc-400 font-mono">{u.email}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono font-medium ${
                              u.role === 'superadmin'
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                : 'bg-zinc-800 text-zinc-300 border border-zinc-700'
                            }`}
                          >
                            {u.role === 'superadmin' ? '👑 Super Admin' : '👤 User'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-zinc-400 font-mono text-[11px]">
                          {new Date(u.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 text-zinc-400 font-mono text-[11px]">
                          {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleTimeString() : 'Never'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#303030] bg-[#141414] flex items-center justify-between text-xs text-zinc-400">
          <div>
            NamoGPT Super Admin Console • Connected to <code className="text-zinc-300 font-mono">{serverUrl}</code>
          </div>
          <button
            onClick={() => setIsAdminModalOpen(false)}
            className="px-4 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
