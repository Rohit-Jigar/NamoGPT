import React, { useState, useRef, useEffect } from 'react';
import { useChat } from '../context/ChatContext';
import { useAuth } from '../context/AuthContext';
import {
  PanelLeft,
  ChevronDown,
  Sparkles,
  Share2,
  Check,
  Zap,
  Eye,
  Brain,
  Plus,
  Crown,
  LogIn,
  LogOut,
  Settings as SettingsIcon,
  ShieldCheck,
  Compass,
  Bot,
  Cpu,
  Lock,
  Activity
} from 'lucide-react';
import { ModelUsageMeterPill } from './ModelUsageMeter';

export default function Header() {
  const {
    models,
    selectedModel,
    setSelectedModel,
    isSidebarOpen,
    setIsSidebarOpen,
    generationStats,
    isGenerating,
    setIsExportOpen,
    createNewChat,
    setIsSettingsOpen,
    settings,
    currentPersona,
    setIsPersonaOpen,
    setIsDeepResearchOpen,
    setIsMemoryOpen,
    isMcpOpen,
    setIsMcpOpen
  } = useChat();

  const {
    user,
    isAuthenticated,
    isSuperAdmin,
    setIsAuthModalOpen,
    setIsAdminModalOpen,
    logout
  } = useAuth();

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  const dropdownRef = useRef(null);
  const userMenuRef = useRef(null);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setIsUserMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const foundModel = models.find((m) => m.id === selectedModel);
  const currentModelObj = selectedModel === 'auto'
    ? {
        ...(foundModel || {}),
        name: '✨ Auto (Smart Router)',
        badge: 'LiteLLM Dynamic',
        speed: '⚡ Dynamic',
        badgeColor: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/20'
      }
    : (foundModel || {
        name: '✨ Auto (Smart Router)',
        badge: 'LiteLLM Dynamic',
        speed: '⚡ Dynamic',
        badgeColor: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/20'
      });

  function getModelTags(m) {
    const tags = [];
    const id = (m.id || '').toLowerCase();
    const name = (m.name || '').toLowerCase();
    const desc = (m.description || '').toLowerCase();

    if (m.supportsVision || id.includes('vision') || name.includes('vision') || desc.includes('vision') || desc.includes('image')) {
      tags.push({ label: 'Vision', color: 'bg-sky-500/10 text-sky-400 border-sky-500/25', icon: 'vision' });
    }
    if (id === 'gemini' || desc.includes('1m') || name.includes('gemini') || desc.includes('context')) {
      tags.push({ label: '1M Context', color: 'bg-indigo-500/10 text-indigo-300 border-indigo-500/25', icon: 'context' });
    }
    if (m.speed?.includes('300') || id.includes('groq') || desc.includes('300')) {
      tags.push({ label: '~300 t/s', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25', icon: 'speed' });
    }
    if (m.supportsReasoning || id.includes('r1') || id.includes('deepseek') || name.includes('reasoning') || desc.includes('reasoning') || desc.includes('thinking')) {
      tags.push({ label: 'Deep Reasoning', color: 'bg-purple-500/10 text-purple-300 border-purple-500/25', icon: 'reasoning' });
    }
    if (id === 'auto') {
      tags.push({ label: 'Smart Router', color: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/25', icon: 'router' });
    }
    return tags;
  }

  return (
    <header className="h-14 glass-nav px-3 sm:px-4 flex items-center justify-between shrink-0 select-none z-30 transition-all duration-200">
      {/* Left: Sidebar Toggle & Stitch Model Switcher Capsule */}
      <div className="flex items-center space-x-2 sm:space-x-3">
        <button
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/[0.06] border border-transparent hover:border-white/[0.08] transition-all"
          title={isSidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
        >
          <PanelLeft className="w-4 h-4" />
        </button>

        {/* Google Stitch Model Switcher Capsule */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="flex items-center space-x-2 px-3 py-1.5 rounded-full bg-[#121622]/90 hover:bg-[#161c2b] border border-white/[0.08] hover:border-cyan-500/35 text-slate-100 font-medium text-xs sm:text-sm tracking-tight transition-all duration-200 shadow-sm group"
          >
            <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse shadow-sm shadow-cyan-400/50 shrink-0" />
            <span className="truncate max-w-[130px] sm:max-w-[200px] md:max-w-none font-semibold text-white">
              {currentModelObj.name}
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/[0.06] text-cyan-300 border border-white/[0.08] hidden xs:inline-flex items-center gap-0.5">
              {currentModelObj.speed || '⚡ Fast'}
            </span>
            <ChevronDown
              className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
                isDropdownOpen ? 'rotate-180 text-white' : 'group-hover:text-slate-200'
              }`}
            />
          </button>

          {/* Model Switcher Dropdown */}
          {isDropdownOpen && (
            <div className="absolute left-0 mt-2 w-84 sm:w-96 bg-[#121622]/95 backdrop-blur-2xl border border-white/[0.1] rounded-2xl shadow-2xl p-2.5 z-50 animate-in fade-in zoom-in-95 duration-150">
              <div className="px-3 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-white/[0.06] flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-slate-300">
                  <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                  Model Intelligence Catalog
                </span>
                <span className="text-[10px] text-cyan-400 font-mono px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/20">
                  100% Free Tiers
                </span>
              </div>

              <div className="mx-1 my-2 p-2.5 rounded-xl bg-gradient-to-r from-indigo-500/10 via-violet-500/10 to-cyan-500/10 border border-indigo-500/20 text-[11px] text-slate-300 flex items-start gap-2 leading-relaxed">
                <Sparkles className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
                <span>
                  <strong>Auto Mode</strong> selects optimal latency, routes images to multimodal LPUs, and triggers deep thinking automatically.
                </span>
              </div>

              <div className="max-h-[380px] overflow-y-auto py-1 space-y-1.5 no-scrollbar">
                {models
                  .filter((m) => m.id !== '9router' || settings?.nineRouter?.enabled !== false)
                  .map((m) => {
                    const isSelected = m.id === selectedModel;
                    const isComingSoon = m.isComingSoon || m.badge === 'Coming Soon';
                    const isAuto = m.id === 'auto';
                    const modelName = isAuto ? '✨ Auto (Smart Router)' : m.name;
                    const tags = getModelTags(m);

                    return (
                      <div
                        key={m.id}
                        onClick={() => {
                          setSelectedModel(m.id);
                          setIsDropdownOpen(false);
                        }}
                        className={`flex items-start justify-between p-2.5 rounded-xl cursor-pointer transition-all duration-150 ${
                          isSelected
                            ? 'bg-[#181f30] border border-cyan-500/50 text-white shadow-md shadow-cyan-950/20'
                            : isAuto
                            ? 'bg-gradient-to-r from-indigo-950/20 to-cyan-950/20 hover:from-indigo-950/40 hover:to-cyan-950/40 border border-cyan-500/20 text-slate-200'
                            : isComingSoon
                            ? 'hover:bg-white/[0.02] text-slate-500 opacity-75'
                            : 'hover:bg-white/[0.04] text-slate-300 hover:text-white border border-transparent hover:border-white/[0.05]'
                        }`}
                      >
                        <div className="space-y-1.5 flex-1 pr-2">
                          <div className="flex items-center space-x-2">
                            <span className={`font-semibold text-xs sm:text-sm ${isAuto ? 'text-cyan-300' : 'text-slate-100'}`}>
                              {modelName}
                            </span>
                            {isComingSoon && (
                              <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-white/[0.05] text-slate-400 border border-white/[0.08] flex items-center gap-0.5">
                                <Lock className="w-2.5 h-2.5" /> Coming Soon
                              </span>
                            )}
                          </div>
                          
                          <p className="text-[11px] text-slate-400 line-clamp-1 leading-relaxed">
                            {m.description}
                          </p>

                          {/* Stitch Pill Model Tags */}
                          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                            <span className="text-[10px] font-mono text-slate-400 flex items-center gap-1 mr-1">
                              <Zap className="w-3 h-3 text-amber-400" />
                              {m.speed}
                            </span>

                            {tags.map((tag, idx) => (
                              <span
                                key={idx}
                                className={`text-[9px] font-mono font-medium px-2 py-0.5 rounded-full border ${tag.color} flex items-center gap-1`}
                              >
                                {tag.icon === 'vision' && <Eye className="w-2.5 h-2.5" />}
                                {tag.icon === 'reasoning' && <Brain className="w-2.5 h-2.5" />}
                                {tag.icon === 'speed' && <Zap className="w-2.5 h-2.5" />}
                                {tag.label}
                              </span>
                            ))}
                          </div>
                        </div>

                        {isSelected && (
                          <div className="shrink-0 pt-1">
                            <div className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-300 flex items-center justify-center border border-cyan-500/40">
                              <Check className="w-3 h-3 stroke-[2.5]" />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
        </div>

        {/* AI Persona Selector Pill */}
        <button
          onClick={() => setIsPersonaOpen(true)}
          className="hidden md:flex items-center space-x-1.5 px-3 py-1.5 rounded-full bg-[#121622]/80 hover:bg-[#161c2b] border border-white/[0.08] hover:border-emerald-500/30 text-slate-300 hover:text-white text-xs font-medium transition-all"
          title="Switch AI Persona or Custom GPT"
        >
          <Bot className="w-3.5 h-3.5 text-emerald-400" />
          <span className="truncate max-w-[110px]">{currentPersona?.name || 'Persona'}</span>
        </button>
      </div>

      {/* Center/Right: Usage Meter, New Chat, Badges & Profile */}
      <div className="flex items-center space-x-1.5 sm:space-x-2">
        {/* Live Model Usage Meter Trigger Pill */}
        <ModelUsageMeterPill />

        {/* New Chat Button */}
        <button
          onClick={() => createNewChat()}
          className="flex items-center space-x-1 px-2.5 py-1.5 rounded-full bg-[#121622]/80 hover:bg-[#161c2b] border border-white/[0.08] hover:border-white/[0.18] text-slate-300 hover:text-white text-xs font-medium transition-all"
          title="New Chat (Ctrl+N)"
        >
          <Plus className="w-3.5 h-3.5 text-cyan-400" />
          <span className="hidden sm:inline">New Chat</span>
        </button>

        {/* MCP Tools Button */}
        <button
          onClick={() => setIsMcpOpen(true)}
          className="hidden sm:flex items-center space-x-1.5 px-2.5 py-1.5 rounded-full bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/25 text-xs font-semibold transition-all hover:scale-105"
          title="Model Context Protocol (MCP) Tools Registry"
        >
          <Cpu className="w-3.5 h-3.5 text-amber-400" />
          <span className="hidden md:inline">MCP</span>
        </button>

        {/* Autonomous Deep Research Button */}
        <button
          onClick={() => setIsDeepResearchOpen(true)}
          className="hidden md:flex items-center space-x-1.5 px-2.5 py-1.5 rounded-full bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/25 text-xs font-semibold transition-all hover:scale-105"
          title="Autonomous Deep Research Mode"
        >
          <Compass className="w-3.5 h-3.5 text-indigo-400" />
          <span>Research</span>
        </button>

        {/* Export Conversation Button */}
        <button
          onClick={() => setIsExportOpen(true)}
          className="flex items-center space-x-1.5 px-2.5 sm:px-3 py-1.5 rounded-full text-slate-300 hover:text-white bg-[#121622]/80 hover:bg-[#161c2b] border border-white/[0.08] hover:border-white/[0.18] text-xs font-medium transition-all"
          title="Export conversation"
        >
          <Share2 className="w-3.5 h-3.5 text-slate-400" />
          <span className="hidden sm:inline">Export</span>
        </button>

        {/* Settings Gear Button */}
        <button
          onClick={() => setIsSettingsOpen(true)}
          className="p-2 rounded-full text-slate-400 hover:text-white bg-[#121622]/80 hover:bg-[#161c2b] border border-white/[0.08] hover:border-white/[0.18] transition-all"
          title="Settings & API Keys"
        >
          <SettingsIcon className="w-4 h-4" />
        </button>

        {/* User Auth / Profile Menu */}
        {isAuthenticated ? (
          <div className="relative" ref={userMenuRef}>
            <button
              onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              className="flex items-center space-x-2 p-1 pl-2.5 rounded-full bg-[#121622]/90 hover:bg-[#161c2b] border border-white/[0.08] hover:border-cyan-500/40 transition-all duration-200 shadow-sm group"
              title="User Profile Card"
            >
              <div className="flex flex-col items-end mr-0.5 hidden md:flex">
                <span className="text-xs font-semibold text-slate-200 group-hover:text-white max-w-[110px] truncate">
                  {user.name}
                </span>
                <span className="text-[9px] font-mono font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-1">
                  <ShieldCheck className="w-2.5 h-2.5" />
                  <span>SuperAdmin</span>
                </span>
              </div>
              <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-violet-500 via-indigo-500 to-cyan-400 text-black font-extrabold text-xs flex items-center justify-center shadow-md ring-2 ring-cyan-500/30">
                {user.name ? user.name[0].toUpperCase() : 'U'}
              </div>
            </button>

            {isUserMenuOpen && (
              <div className="absolute right-0 mt-2 w-64 bg-[#121622]/98 backdrop-blur-2xl border border-white/[0.1] rounded-2xl shadow-2xl p-2.5 z-50 animate-in fade-in zoom-in-95 duration-150">
                {/* User Profile Card Header */}
                <div className="p-3 rounded-xl bg-gradient-to-br from-white/[0.04] to-transparent border border-white/[0.06] space-y-1.5">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-violet-500 via-indigo-500 to-cyan-400 text-black font-extrabold text-sm flex items-center justify-center shadow-lg ring-2 ring-cyan-500/30">
                      {user.name ? user.name[0].toUpperCase() : 'U'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-xs text-white truncate">{user.name}</div>
                      <div className="text-[11px] text-slate-400 truncate">{user.email}</div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/25 font-bold uppercase tracking-wider flex items-center gap-1">
                      <Crown className="w-3 h-3 text-amber-400" />
                      <span>SuperAdmin (All Unlocked)</span>
                    </span>
                  </div>
                </div>

                <div className="py-1 mt-1 space-y-0.5">
                  <button
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      setIsSettingsOpen(true);
                    }}
                    className="w-full flex items-center space-x-2.5 px-3 py-2 text-xs text-slate-300 hover:text-white hover:bg-white/[0.04] rounded-xl transition-colors"
                  >
                    <SettingsIcon className="w-3.5 h-3.5 text-slate-400" />
                    <span>Settings & API Keys</span>
                  </button>

                  <button
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      setIsMcpOpen(true);
                    }}
                    className="w-full flex items-center space-x-2.5 px-3 py-2 text-xs text-slate-300 hover:text-white hover:bg-white/[0.04] rounded-xl transition-colors"
                  >
                    <Cpu className="w-3.5 h-3.5 text-amber-400" />
                    <span>MCP Tools Protocol</span>
                  </button>

                  <button
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      setIsAdminModalOpen(true);
                    }}
                    className="w-full flex items-center space-x-2.5 px-3 py-2 text-xs text-amber-300 hover:text-amber-200 hover:bg-amber-500/10 rounded-xl transition-colors font-semibold"
                  >
                    <Crown className="w-3.5 h-3.5 text-amber-400" />
                    <span>Admin Telemetry Console</span>
                  </button>

                  <button
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      logout();
                    }}
                    className="w-full flex items-center space-x-2.5 px-3 py-2 text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-xl transition-colors mt-1 border-t border-white/[0.06] pt-2"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <button
            onClick={() => setIsAuthModalOpen(true)}
            className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-full bg-gradient-to-r from-indigo-500/20 via-violet-500/20 to-cyan-500/20 hover:from-indigo-500/30 hover:via-violet-500/30 hover:to-cyan-500/30 text-white text-xs font-semibold border border-indigo-500/35 hover:border-cyan-400/50 shadow-sm transition-all hover:scale-105 active:scale-95"
          >
            <LogIn className="w-3.5 h-3.5 text-cyan-400" />
            <span>Sign In</span>
          </button>
        )}
      </div>
    </header>
  );
}
