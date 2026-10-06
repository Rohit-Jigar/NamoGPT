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
  Bot
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
    setIsMemoryOpen
  } = useChat();

  const {
    user,
    isAuthenticated,
    isSuperAdmin,
    setIsAuthModalOpen,
    setIsAdminModalOpen,
    demoAdminLogin,
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
    name: 'Gemini 2.5 Flash',
    badge: 'Recommended',
    badgeColor: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
  };

  return (
    <header className="h-14 border-b border-[#303030]/80 bg-[#212121]/90 backdrop-blur-md px-3 sm:px-4 flex items-center justify-between shrink-0 select-none z-20">
      {/* Left: Sidebar Toggle & Model Switcher */}
      <div className="flex items-center space-x-2">
        <button
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          title={isSidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
        >
          <PanelLeft className="w-5 h-5" />
        </button>

        {/* Model Selector Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="flex items-center space-x-2 px-2.5 sm:px-3 py-1.5 rounded-xl hover:bg-zinc-800/80 transition-colors text-white font-semibold text-sm sm:text-base tracking-tight group"
          >
            <span className="truncate max-w-[140px] sm:max-w-none">{currentModelObj.name}</span>
            <span
              className={`text-[10px] font-medium px-2 py-0.5 rounded-full border hidden xs:inline-block ${
                currentModelObj.badgeColor || 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
              }`}
            >
              {currentModelObj.badge || 'Free'}
            </span>
            <ChevronDown className="w-4 h-4 text-zinc-400 group-hover:text-white transition-transform duration-200" />
          </button>

          {isDropdownOpen && (
            <div className="absolute left-0 mt-2 w-80 sm:w-96 bg-[#171717] border border-[#303030] rounded-2xl shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95 duration-150">
              <div className="px-3 py-2 text-xs font-semibold text-zinc-400 uppercase tracking-wider border-b border-zinc-800 flex items-center justify-between">
                <span>Select AI Model Pool</span>
                <span className="text-[10px] text-emerald-400 font-mono">100% Free Tiers</span>
              </div>

              <div className="max-h-[360px] overflow-y-auto py-1 space-y-1">
                {models
                  .filter((m) => m.id !== '9router' || settings?.nineRouter?.enabled !== false)
                  .map((m) => {
                  const isSelected = m.id === selectedModel;
                  return (
                    <div
                      key={m.id}
                      onClick={() => {
                        setSelectedModel(m.id);
                        setIsDropdownOpen(false);
                      }}
                      className={`flex items-start justify-between p-2.5 rounded-xl cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-[#212121] border border-emerald-500/30 text-white'
                          : 'hover:bg-[#212121]/70 text-zinc-300 hover:text-white'
                      }`}
                    >
                      <div className="space-y-1 flex-1 pr-2">
                        <div className="flex items-center space-x-2">
                          <span className="font-semibold text-sm">{m.name}</span>
                          <span
                            className={`text-[10px] font-medium px-1.5 py-0.2 rounded border ${
                              m.badgeColor || 'bg-zinc-800 text-zinc-300 border-zinc-700'
                            }`}
                          >
                            {m.badge || 'Free'}
                          </span>
                        </div>
                        <p className="text-xs text-zinc-400 line-clamp-1">{m.description}</p>
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
                            <Check className="w-3.5 h-3.5" />
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

        {/* AI Persona Selector Button */}
        <button
          onClick={() => setIsPersonaOpen(true)}
          className="hidden sm:flex items-center space-x-1.5 px-2.5 py-1.5 rounded-xl bg-zinc-800/80 hover:bg-zinc-800 border border-zinc-700/60 text-zinc-300 hover:text-white text-xs font-medium transition-colors"
          title="Switch AI Persona or Custom GPT"
        >
          <Bot className="w-3.5 h-3.5 text-emerald-400" />
          <span className="truncate max-w-[120px]">{currentPersona?.name || 'Persona'}</span>
        </button>
      </div>

      {/* Right: Stats, Admin Badge, Export & Auth Profile */}
      <div className="flex items-center space-x-2 sm:space-x-3">
        {/* Live Generation Stats */}
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
            <span className="hidden sm:inline">Admin Console</span>
          </button>
        )}

        {/* New Chat Button (Mobile) */}
        <button
          onClick={() => createNewChat()}
          className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors sm:hidden"
          title="New Chat"
        >
          <Plus className="w-5 h-5" />
        </button>

        {/* Autonomous Deep Research Button */}
        <button
          onClick={() => setIsDeepResearchOpen(true)}
          className="hidden md:flex items-center space-x-1.5 px-2.5 py-1.5 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-xs font-semibold shadow-sm transition-all hover:scale-105"
          title="Autonomous Deep Research Mode"
        >
          <Compass className="w-3.5 h-3.5 text-indigo-400" />
          <span className="hidden lg:inline">Deep Research</span>
        </button>

        {/* Export Conversation Button */}
        <button
          onClick={() => setIsExportOpen(true)}
          className="flex items-center space-x-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-zinc-300 hover:text-white hover:bg-zinc-800 text-xs font-medium border border-zinc-700/60 transition-colors"
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
              className="flex items-center space-x-2 p-1 pl-2 rounded-full hover:bg-zinc-800 transition-colors border border-zinc-700/60"
            >
              <span className="text-xs font-medium text-zinc-300 hidden md:inline max-w-[100px] truncate">
                {user.name}
              </span>
              <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-400 text-black font-bold text-xs flex items-center justify-center shadow-sm">
                {user.name ? user.name[0].toUpperCase() : 'U'}
              </div>
            </button>

            {isUserMenuOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-[#171717] border border-[#303030] rounded-2xl shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                <div className="px-3 py-2 border-b border-zinc-800">
                  <div className="font-semibold text-xs text-white truncate">{user.name}</div>
                  <div className="text-[11px] text-zinc-400 truncate font-mono">{user.email}</div>
                  <div className="mt-1">
                    <span
                      className={`text-[9px] font-mono px-2 py-0.5 rounded-full font-semibold ${
                        isSuperAdmin
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                      }`}
                    >
                      {isSuperAdmin ? '👑 Super Admin' : '👤 Standard User'}
                    </span>
                  </div>
                </div>

                <div className="py-1">
                  {isSuperAdmin && (
                    <button
                      onClick={() => {
                        setIsAdminModalOpen(true);
                        setIsUserMenuOpen(false);
                      }}
                      className="w-full flex items-center space-x-2 px-3 py-2 text-xs text-amber-300 hover:bg-zinc-800 rounded-lg transition-colors"
                    >
                      <Crown className="w-3.5 h-3.5" />
                      <span>Super Admin Console</span>
                    </button>
                  )}

                  <button
                    onClick={() => {
                      setIsPersonaOpen(true);
                      setIsUserMenuOpen(false);
                    }}
                    className="w-full flex items-center space-x-2 px-3 py-2 text-xs text-zinc-300 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
                  >
                    <Bot className="w-3.5 h-3.5 text-emerald-400" />
                    <span>AI Personas & GPTs</span>
                  </button>

                  <button
                    onClick={() => {
                      setIsMemoryOpen(true);
                      setIsUserMenuOpen(false);
                    }}
                    className="w-full flex items-center space-x-2 px-3 py-2 text-xs text-zinc-300 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
                  >
                    <Brain className="w-3.5 h-3.5 text-purple-400" />
                    <span>Long-Term Memory</span>
                  </button>

                  <button
                    onClick={() => {
                      setIsDeepResearchOpen(true);
                      setIsUserMenuOpen(false);
                    }}
                    className="w-full flex items-center space-x-2 px-3 py-2 text-xs text-zinc-300 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
                  >
                    <Compass className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Deep Research</span>
                  </button>

                  <button
                    onClick={() => {
                      setIsSettingsOpen(true);
                      setIsUserMenuOpen(false);
                    }}
                    className="w-full flex items-center space-x-2 px-3 py-2 text-xs text-zinc-300 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
                  >
                    <SettingsIcon className="w-3.5 h-3.5" />
                    <span>Settings & Keys</span>
                  </button>

                  <button
                    onClick={() => {
                      logout();
                      setIsUserMenuOpen(false);
                    }}
                    className="w-full flex items-center space-x-2 px-3 py-2 text-xs text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center space-x-1.5">
            <button
              onClick={() => setIsAuthModalOpen(true)}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-white text-black hover:bg-zinc-200 text-xs font-semibold transition-all shadow-sm active:scale-95"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Sign In</span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
