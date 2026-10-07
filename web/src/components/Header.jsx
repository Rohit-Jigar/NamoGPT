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
  User,
  LogIn,
  LogOut,
  Settings as SettingsIcon,
  ShieldCheck,
  Compass,
  Bot,
  Cpu,
  Lock,
  ExternalLink,
  Layers
} from 'lucide-react';

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

  const currentModelObj = models.find((m) => m.id === selectedModel) || {
    name: 'Auto (Smart Router)',
    badge: 'Recommended',
    badgeColor: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
  };

  return (
    <header className="h-14 glass-nav px-3 sm:px-4 flex items-center justify-between shrink-0 select-none z-30">
      {/* Left: Sidebar Toggle & Model Switcher */}
      <div className="flex items-center space-x-2">
        <button
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="p-2 rounded-xl text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/70 border border-transparent hover:border-zinc-700/50 transition-all"
          title={isSidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
        >
          <PanelLeft className="w-4 h-4" />
        </button>

        {/* Model Selector Dropdown (shadcn-style model-select) */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-zinc-900/80 hover:bg-zinc-800/80 border border-zinc-800 hover:border-zinc-700 text-zinc-100 font-medium text-xs sm:text-sm tracking-tight transition-all shadow-sm group"
          >
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
            <span className="truncate max-w-[130px] sm:max-w-[190px] md:max-w-none font-semibold">
              {currentModelObj.name}
            </span>
            <span
              className={`text-[10px] font-medium px-2 py-0.5 rounded-full border hidden xs:inline-block ${
                currentModelObj.badgeColor || 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
              }`}
            >
              {currentModelObj.badge || 'Ready'}
            </span>
            <ChevronDown className={`w-3.5 h-3.5 text-zinc-400 transition-transform duration-200 ${isDropdownOpen ? 'rotate-180 text-zinc-100' : ''}`} />
          </button>

          {isDropdownOpen && (
            <div className="absolute left-0 mt-2 w-84 sm:w-96 bg-[#121215] border border-zinc-800/90 rounded-2xl shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95 duration-150 backdrop-blur-xl">
              <div className="px-3 py-2 text-xs font-semibold text-zinc-400 uppercase tracking-wider border-b border-zinc-800/70 flex items-center justify-between">
                <span>Model Intelligence Catalog</span>
                <span className="text-[10px] text-emerald-400 font-mono">100% Free Tiers</span>
              </div>

              <div className="max-h-[380px] overflow-y-auto py-1 space-y-1 no-scrollbar">
                {models
                  .filter((m) => m.id !== '9router' || settings?.nineRouter?.enabled !== false)
                  .map((m) => {
                    const isSelected = m.id === selectedModel;
                    const isComingSoon = m.isComingSoon || m.badge === 'Coming Soon';
                    const isAuto = m.id === 'auto';

                    return (
                      <div
                        key={m.id}
                        onClick={() => {
                          setSelectedModel(m.id);
                          setIsDropdownOpen(false);
                        }}
                        className={`flex items-start justify-between p-2.5 rounded-xl cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-zinc-800/90 border border-emerald-500/50 text-white shadow-md'
                            : isAuto
                            ? 'bg-emerald-950/20 hover:bg-emerald-950/40 border border-emerald-500/30 text-zinc-100'
                            : isComingSoon
                            ? 'hover:bg-zinc-900/50 text-zinc-400 opacity-80'
                            : 'hover:bg-zinc-800/60 text-zinc-300 hover:text-white'
                        }`}
                      >
                        <div className="space-y-1 flex-1 pr-2">
                          <div className="flex items-center space-x-2">
                            <span className={`font-semibold text-xs sm:text-sm ${isAuto ? 'text-emerald-400' : ''}`}>
                              {m.name}
                            </span>
                            <span
                              className={`text-[9px] font-medium px-1.5 py-0.2 rounded border flex items-center gap-0.5 ${
                                isComingSoon
                                  ? 'bg-zinc-800 text-zinc-400 border-zinc-700'
                                  : m.badgeColor || 'bg-zinc-800 text-zinc-300 border-zinc-700'
                              }`}
                            >
                              {isComingSoon && <Lock className="w-2.5 h-2.5" />}
                              {m.badge || (isComingSoon ? 'Coming Soon' : 'Ready')}
                            </span>
                          </div>
                          <p className="text-[11px] text-zinc-400 line-clamp-1 leading-relaxed">{m.description}</p>
                          <div className="flex items-center space-x-2 text-[10px] text-zinc-500 pt-0.5">
                            <span className="flex items-center gap-1">
                              <Zap className="w-3 h-3 text-amber-400" /> {m.speed}
                            </span>
                            <span>•</span>
                            <span>{m.provider}</span>
                            {m.supportsVision && (
                              <>
                                <span>•</span>
                                <span className="flex items-center gap-0.5 text-blue-400">
                                  <Eye className="w-3 h-3" /> Vision
                                </span>
                              </>
                            )}
                            {m.supportsReasoning && (
                              <>
                                <span>•</span>
                                <span className="flex items-center gap-0.5 text-purple-400">
                                  <Brain className="w-3 h-3" /> Reasoning
                                </span>
                              </>
                            )}
                          </div>
                        </div>

                        {isSelected && (
                          <div className="shrink-0 pt-1">
                            <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                              <Check className="w-3 h-3 stroke-[3]" />
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
          className="hidden md:flex items-center space-x-1.5 px-2.5 py-1.5 rounded-xl bg-zinc-900/60 hover:bg-zinc-800/80 border border-zinc-800 text-zinc-300 hover:text-white text-xs font-medium transition-all"
          title="Switch AI Persona or Custom GPT"
        >
          <Bot className="w-3.5 h-3.5 text-emerald-400" />
          <span className="truncate max-w-[110px]">{currentPersona?.name || 'Persona'}</span>
        </button>
      </div>

      {/* Right Action Bar */}
      <div className="flex items-center space-x-1.5 sm:space-x-2">
        {/* Live Generation Telemetry */}
        {generationStats && isGenerating && (
          <div className="hidden md:flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-mono animate-pulse">
            <Zap className="w-3.5 h-3.5" />
            <span>{generationStats.tps} t/s</span>
          </div>
        )}

        {/* Super Admin Console Button */}
        {isSuperAdmin && (
          <button
            onClick={() => setIsAdminModalOpen(true)}
            className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-semibold shadow-sm transition-all hover:scale-105"
            title="Open Super Admin Console"
          >
            <Crown className="w-3.5 h-3.5 fill-current text-amber-400" />
            <span className="hidden sm:inline">Admin</span>
          </button>
        )}

        {/* MCP Tools Button */}
        <button
          onClick={() => setIsMcpOpen(true)}
          className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-semibold shadow-sm transition-all hover:scale-105"
          title="Model Context Protocol (MCP) Tools Registry"
        >
          <Cpu className="w-3.5 h-3.5 text-amber-400" />
          <span className="hidden sm:inline">MCP</span>
        </button>

        {/* Autonomous Deep Research Button */}
        <button
          onClick={() => setIsDeepResearchOpen(true)}
          className="hidden sm:flex items-center space-x-1.5 px-2.5 py-1.5 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-xs font-semibold shadow-sm transition-all hover:scale-105"
          title="Autonomous Deep Research Mode"
        >
          <Compass className="w-3.5 h-3.5 text-indigo-400" />
          <span className="hidden md:inline">Research</span>
        </button>

        {/* New Chat Button (Mobile) */}
        <button
          onClick={() => createNewChat()}
          className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 border border-transparent hover:border-zinc-700/50 transition-all sm:hidden"
          title="New Chat"
        >
          <Plus className="w-4 h-4" />
        </button>

        {/* Export Conversation Button */}
        <button
          onClick={() => setIsExportOpen(true)}
          className="flex items-center space-x-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-zinc-300 hover:text-white hover:bg-zinc-800/80 text-xs font-medium border border-zinc-800 transition-all"
          title="Export conversation"
        >
          <Share2 className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Export</span>
        </button>

        {/* User Auth Section */}
        {isAuthenticated ? (
          <div className="relative" ref={userMenuRef}>
            <button
              onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              className="flex items-center space-x-2 p-1 pl-2 rounded-full hover:bg-zinc-800/80 transition-colors border border-zinc-800"
            >
              <span className="text-xs font-medium text-zinc-300 hidden md:inline max-w-[90px] truncate">
                {user.name}
              </span>
              <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-400 text-black font-bold text-xs flex items-center justify-center shadow-sm">
                {user.name ? user.name[0].toUpperCase() : 'U'}
              </div>
            </button>

            {isUserMenuOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-[#121215] border border-zinc-800 rounded-2xl shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                <div className="px-3 py-2 border-b border-zinc-800">
                  <div className="font-semibold text-xs text-white truncate">{user.name}</div>
                  <div className="text-[10px] text-zinc-400 truncate">{user.email}</div>
                  <div className="text-[10px] text-emerald-400 font-mono mt-0.5 uppercase tracking-wider">{user.role}</div>
                </div>

                <div className="py-1">
                  <button
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      setIsSettingsOpen(true);
                    }}
                    className="w-full flex items-center space-x-2.5 px-3 py-2 text-xs text-zinc-300 hover:text-white hover:bg-zinc-800 rounded-xl transition-colors"
                  >
                    <SettingsIcon className="w-3.5 h-3.5 text-zinc-400" />
                    <span>Settings & Keys</span>
                  </button>

                  <button
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      setIsMcpOpen(true);
                    }}
                    className="w-full flex items-center space-x-2.5 px-3 py-2 text-xs text-zinc-300 hover:text-white hover:bg-zinc-800 rounded-xl transition-colors"
                  >
                    <Cpu className="w-3.5 h-3.5 text-amber-400" />
                    <span>MCP Tools Protocol</span>
                  </button>

                  {isSuperAdmin && (
                    <button
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        setIsAdminModalOpen(true);
                      }}
                      className="w-full flex items-center space-x-2.5 px-3 py-2 text-xs text-amber-300 hover:text-amber-200 hover:bg-amber-500/10 rounded-xl transition-colors font-medium"
                    >
                      <Crown className="w-3.5 h-3.5 text-amber-400" />
                      <span>Admin Console</span>
                    </button>
                  )}

                  <button
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      logout();
                    }}
                    className="w-full flex items-center space-x-2.5 px-3 py-2 text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-xl transition-colors mt-1 border-t border-zinc-800 pt-2"
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
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-100 hover:text-white text-xs font-semibold border border-zinc-800 hover:border-zinc-700 shadow-sm transition-all"
          >
            <LogIn className="w-3.5 h-3.5 text-emerald-400" />
            <span>Sign In</span>
          </button>
        )}
      </div>
    </header>
  );
}
