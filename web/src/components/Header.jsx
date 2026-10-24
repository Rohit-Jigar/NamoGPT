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
        name: '✨ Auto (Dynamic Router)',
        badge: 'LiteLLM Cascade',
        speed: '⚡ Adaptive',
        badgeColor: 'bg-[#6F4E37]/30 text-[#E5E4E2] border-[#6F4E37]'
      }
    : (foundModel || {
        name: '✨ Auto (Dynamic Router)',
        badge: 'LiteLLM Cascade',
        speed: '⚡ Adaptive',
        badgeColor: 'bg-[#6F4E37]/30 text-[#E5E4E2] border-[#6F4E37]'
      });

  function getModelTags(m) {
    const tags = [];
    const id = (m.id || '').toLowerCase();
    const name = (m.name || '').toLowerCase();
    const desc = (m.description || '').toLowerCase();

    if (m.supportsVision || id.includes('vision') || name.includes('vision') || desc.includes('vision') || desc.includes('image')) {
      tags.push({ label: 'Vision', color: 'bg-[#241E1A] text-[#E6E0F0] border-[#E5E4E2]/15', icon: 'vision' });
    }
    if (id === 'gemini' || desc.includes('1m') || name.includes('gemini') || desc.includes('context')) {
      tags.push({ label: '1M Context', color: 'bg-[#241E1A] text-[#E5E4E2] border-[#E5E4E2]/15', icon: 'context' });
    }
    if (m.speed?.includes('300') || id.includes('groq') || desc.includes('300')) {
      tags.push({ label: '~300 t/s', color: 'bg-[#6F4E37]/30 text-[#FAF9F8] border-[#6F4E37]', icon: 'speed' });
    }
    if (m.supportsReasoning || id.includes('r1') || id.includes('deepseek') || name.includes('reasoning') || desc.includes('reasoning') || desc.includes('thinking')) {
      tags.push({ label: 'Reasoning R1', color: 'bg-[#241E1A] text-[#E6E0F0] border-[#E6E0F0]/40', icon: 'reasoning' });
    }
    if (id === 'auto') {
      tags.push({ label: 'Smart Router', color: 'bg-[#6F4E37]/30 text-[#E5E4E2] border-[#6F4E37]', icon: 'router' });
    }
    return tags;
  }

  return (
    <header className="h-14 bg-[#13100E]/90 backdrop-blur-2xl border-b border-[#E5E4E2]/10 px-3 sm:px-4 flex items-center justify-between shrink-0 select-none z-30 transition-all duration-200">
      {/* Left: Sidebar Toggle & Model Switcher Capsule */}
      <div className="flex items-center space-x-2 sm:space-x-3">
        <button
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="p-2 rounded-xl text-[#BDB8B3] hover:text-[#FAF9F8] hover:bg-[#241E1A] border border-transparent hover:border-[#E5E4E2]/10 transition-all"
          title={isSidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
        >
          <PanelLeft className="w-4 h-4" />
        </button>

        {/* Model Switcher Capsule */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-[#1A1613] hover:bg-[#241E1A] border border-[#E5E4E2]/15 hover:border-[#E6E0F0]/30 text-[#FAF9F8] font-medium text-xs sm:text-sm tracking-tight transition-all duration-200 shadow-sm group"
          >
            <div className="w-2 h-2 rounded-full bg-[#E6E0F0] animate-pulse shadow-sm shadow-[#E6E0F0]/50 shrink-0" />
            <span className="truncate max-w-[130px] sm:max-w-[200px] md:max-w-none font-semibold text-[#FAF9F8]">
              {currentModelObj.name}
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#241E1A] text-[#E5E4E2] border border-[#E5E4E2]/15 hidden xs:inline-flex items-center gap-0.5">
              {currentModelObj.speed || '⚡ Fast'}
            </span>
            <ChevronDown
              className={`w-3.5 h-3.5 text-[#BDB8B3] transition-transform duration-200 ${
                isDropdownOpen ? 'rotate-180 text-[#FAF9F8]' : 'group-hover:text-[#FAF9F8]'
              }`}
            />
          </button>

          {/* Model Switcher Dropdown */}
          {isDropdownOpen && (
            <div className="absolute left-0 mt-2 w-84 sm:w-96 bg-[#13100E] backdrop-blur-2xl border border-[#E5E4E2]/15 rounded-2xl shadow-2xl p-2.5 z-50 animate-in fade-in zoom-in-95 duration-150">
              <div className="px-3 py-2 text-xs font-semibold text-[#BDB8B3] uppercase tracking-wider border-b border-[#E5E4E2]/10 flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-[#FAF9F8]">
                  <Sparkles className="w-3.5 h-3.5 text-[#E6E0F0]" />
                  Model Intelligence Mesh
                </span>
                <span className="text-[10px] text-[#E5E4E2] font-mono px-2 py-0.5 rounded-full bg-[#6F4E37]/30 border border-[#6F4E37]">
                  Unified Cluster
                </span>
              </div>

              <div className="mx-1 my-2 p-2.5 rounded-xl bg-[#1A1613] border border-[#6F4E37]/30 text-[11px] text-[#E5E4E2] flex items-start gap-2 leading-relaxed">
                <Sparkles className="w-3.5 h-3.5 text-[#E6E0F0] shrink-0 mt-0.5" />
                <span>
                  <strong>Dynamic Auto Cascade</strong> selects the optimal model per prompt, routing vision to multimodal LPUs and complex math to DeepSeek R1.
                </span>
              </div>

              <div className="max-h-[380px] overflow-y-auto py-1 space-y-1.5 no-scrollbar">
                {models
                  .filter((m) => m.id !== '9router' || settings?.nineRouter?.enabled !== false)
                  .map((m) => {
                    const isSelected = m.id === selectedModel;
                    const isComingSoon = m.isComingSoon || m.badge === 'Coming Soon';
                    const isAuto = m.id === 'auto';
                    const modelName = isAuto ? '✨ Auto (Dynamic Router)' : m.name;
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
                            ? 'bg-[#241E1A] border border-[#6F4E37] text-white shadow-md'
                            : isAuto
                            ? 'bg-[#1A1613] hover:bg-[#241E1A] border border-[#E5E4E2]/15 text-[#FAF9F8]'
                            : isComingSoon
                            ? 'hover:bg-[#1A1613]/50 text-[#7A7570] opacity-75'
                            : 'hover:bg-[#1A1613] text-[#BDB8B3] hover:text-[#FAF9F8] border border-transparent hover:border-[#E5E4E2]/10'
                        }`}
                      >
                        <div className="space-y-1.5 flex-1 pr-2">
                          <div className="flex items-center space-x-2">
                            <span className={`font-semibold text-xs sm:text-sm ${isSelected ? 'text-[#FAF9F8]' : isAuto ? 'text-[#E6E0F0]' : 'text-[#FAF9F8]'}`}>
                              {modelName}
                            </span>
                            {isComingSoon && (
                              <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-[#241E1A] text-[#BDB8B3] border border-[#E5E4E2]/10 flex items-center gap-0.5">
                                <Lock className="w-2.5 h-2.5" /> Coming Soon
                              </span>
                            )}
                          </div>
                          
                          <p className="text-[11px] text-[#BDB8B3] line-clamp-1 leading-relaxed">
                            {m.description}
                          </p>

                          {/* Model Tags */}
                          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                            <span className="text-[10px] font-mono text-[#BDB8B3] flex items-center gap-1 mr-1">
                              <Zap className="w-3 h-3 text-[#E6E0F0]" />
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
                            <div className="w-5 h-5 rounded-full bg-[#6F4E37] text-white flex items-center justify-center border border-[#E6E0F0]/40">
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
          className="hidden md:flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-[#1A1613] hover:bg-[#241E1A] border border-[#E5E4E2]/15 hover:border-[#E6E0F0]/30 text-[#FAF9F8] text-xs font-medium transition-all"
          title="Switch AI Persona"
        >
          <Bot className="w-3.5 h-3.5 text-[#E6E0F0]" />
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
          className="flex items-center space-x-1 px-2.5 py-1.5 rounded-xl bg-[#1A1613] hover:bg-[#241E1A] border border-[#E5E4E2]/15 hover:border-[#E6E0F0]/30 text-[#FAF9F8] text-xs font-medium transition-all"
          title="New Chat (Ctrl+N)"
        >
          <Plus className="w-3.5 h-3.5 text-[#E6E0F0]" />
          <span className="hidden sm:inline">New Chat</span>
        </button>

        {/* MCP Tools Button */}
        <button
          onClick={() => setIsMcpOpen(true)}
          className="hidden sm:flex items-center space-x-1.5 px-2.5 py-1.5 rounded-xl bg-[#241E1A] hover:bg-[#2D2520] text-[#E5E4E2] border border-[#E5E4E2]/15 text-xs font-semibold transition-all hover:scale-105"
          title="Model Context Protocol (MCP) Tools Registry"
        >
          <Cpu className="w-3.5 h-3.5 text-[#E6E0F0]" />
          <span className="hidden md:inline">MCP</span>
        </button>

        {/* Autonomous Deep Research Button */}
        <button
          onClick={() => setIsDeepResearchOpen(true)}
          className="hidden md:flex items-center space-x-1.5 px-2.5 py-1.5 rounded-xl bg-[#6F4E37]/30 hover:bg-[#6F4E37]/50 text-[#FAF9F8] border border-[#6F4E37] text-xs font-semibold transition-all hover:scale-105"
          title="Autonomous Deep Research Mode"
        >
          <Compass className="w-3.5 h-3.5 text-[#E6E0F0]" />
          <span>Research</span>
        </button>

        {/* Export Conversation Button */}
        <button
          onClick={() => setIsExportOpen(true)}
          className="flex items-center space-x-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-[#BDB8B3] hover:text-[#FAF9F8] bg-[#1A1613] hover:bg-[#241E1A] border border-[#E5E4E2]/15 text-xs font-medium transition-all"
          title="Export conversation"
        >
          <Share2 className="w-3.5 h-3.5 text-[#BDB8B3]" />
          <span className="hidden sm:inline">Export</span>
        </button>

        {/* Settings Gear Button */}
        <button
          onClick={() => setIsSettingsOpen(true)}
          className="p-2 rounded-xl text-[#BDB8B3] hover:text-[#FAF9F8] bg-[#1A1613] hover:bg-[#241E1A] border border-[#E5E4E2]/15 transition-all"
          title="Settings & Keys"
        >
          <SettingsIcon className="w-4 h-4" />
        </button>

        {/* User Auth / Profile Menu */}
        {isAuthenticated ? (
          <div className="relative" ref={userMenuRef}>
            <button
              onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              className="flex items-center space-x-2 p-1 pl-2.5 rounded-xl bg-[#1A1613] hover:bg-[#241E1A] border border-[#E5E4E2]/15 hover:border-[#E6E0F0]/40 transition-all duration-200 shadow-sm group"
              title="User Profile"
            >
              <div className="flex flex-col items-end mr-0.5 hidden md:flex">
                <span className="text-xs font-semibold text-[#FAF9F8] group-hover:text-white max-w-[110px] truncate">
                  {user.name}
                </span>
                <span className="text-[9px] font-mono font-bold text-[#E6E0F0] uppercase tracking-wider flex items-center gap-1">
                  <ShieldCheck className="w-2.5 h-2.5 text-[#E6E0F0]" />
                  <span>SuperAdmin</span>
                </span>
              </div>
              <div className="w-7 h-7 rounded-lg bg-[#6F4E37] text-white font-extrabold text-xs flex items-center justify-center shadow-md border border-[#E6E0F0]/30">
                {user.name ? user.name[0].toUpperCase() : 'U'}
              </div>
            </button>

            {isUserMenuOpen && (
              <div className="absolute right-0 mt-2 w-64 bg-[#13100E] backdrop-blur-2xl border border-[#E5E4E2]/15 rounded-2xl shadow-2xl p-2.5 z-50 animate-in fade-in zoom-in-95 duration-150">
                {/* User Profile Card Header */}
                <div className="p-3 rounded-xl bg-[#1A1613] border border-[#E5E4E2]/10 space-y-1.5">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-lg bg-[#6F4E37] text-white font-extrabold text-sm flex items-center justify-center shadow-lg border border-[#E6E0F0]/30">
                      {user.name ? user.name[0].toUpperCase() : 'U'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-xs text-[#FAF9F8] truncate">{user.name}</div>
                      <div className="text-[11px] text-[#BDB8B3] truncate">{user.email}</div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#6F4E37]/30 text-[#E5E4E2] border border-[#6F4E37] font-bold uppercase tracking-wider flex items-center gap-1">
                      <Crown className="w-3 h-3 text-[#E6E0F0]" />
                      <span>Full Access</span>
                    </span>
                  </div>
                </div>

                <div className="py-1 mt-1 space-y-0.5">
                  <button
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      setIsSettingsOpen(true);
                    }}
                    className="w-full flex items-center space-x-2.5 px-3 py-2 text-xs text-[#E5E4E2] hover:text-[#FAF9F8] hover:bg-[#1A1613] rounded-xl transition-colors"
                  >
                    <SettingsIcon className="w-3.5 h-3.5 text-[#BDB8B3]" />
                    <span>Settings & API Keys</span>
                  </button>

                  <button
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      setIsMcpOpen(true);
                    }}
                    className="w-full flex items-center space-x-2.5 px-3 py-2 text-xs text-[#E5E4E2] hover:text-[#FAF9F8] hover:bg-[#1A1613] rounded-xl transition-colors"
                  >
                    <Cpu className="w-3.5 h-3.5 text-[#E6E0F0]" />
                    <span>MCP Tools Protocol</span>
                  </button>

                  <button
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      setIsAdminModalOpen(true);
                    }}
                    className="w-full flex items-center space-x-2.5 px-3 py-2 text-xs text-[#FAF9F8] hover:bg-[#241E1A] rounded-xl transition-colors font-semibold"
                  >
                    <Crown className="w-3.5 h-3.5 text-[#E6E0F0]" />
                    <span>Admin Telemetry Console</span>
                  </button>

                  <button
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      logout();
                    }}
                    className="w-full flex items-center space-x-2.5 px-3 py-2 text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-950/20 rounded-xl transition-colors mt-1 border-t border-[#E5E4E2]/10 pt-2"
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
            className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl bg-[#6F4E37] hover:bg-[#8C6549] text-white text-xs font-semibold border border-[#6F4E37] shadow-sm transition-all hover:scale-105 active:scale-95"
          >
            <LogIn className="w-3.5 h-3.5 text-[#FAF9F8]" />
            <span>Sign In</span>
          </button>
        )}
      </div>
    </header>
  );
}
