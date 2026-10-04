import React, { useState, useRef, useEffect } from 'react';
import { useChat } from '../context/ChatContext';
import {
  PanelLeft,
  ChevronDown,
  Sparkles,
  Share2,
  Check,
  Zap,
  Eye,
  Brain,
  Plus
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
    createNewChat
  } = useChat();

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
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
    <header className="h-14 border-b border-[#303030]/80 bg-[#212121]/90 backdrop-blur-md px-3.5 flex items-center justify-between shrink-0 select-none z-20">
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
            className="flex items-center space-x-2 px-3 py-1.5 rounded-xl hover:bg-zinc-800/80 transition-colors text-white font-semibold text-base tracking-tight group"
          >
            <span>{currentModelObj.name}</span>
            <span
              className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${currentModelObj.badgeColor || 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'}`}
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
                {models.map((m) => {
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
                            className={`text-[10px] font-medium px-1.5 py-0.2 rounded border ${m.badgeColor || 'bg-zinc-800 text-zinc-300 border-zinc-700'}`}
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
      </div>

      {/* Right: Stats & Actions */}
      <div className="flex items-center space-x-2">
        {/* Live Generation Stats */}
        {generationStats && isGenerating && (
          <div className="hidden sm:flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-mono animate-pulse">
            <Zap className="w-3.5 h-3.5" />
            <span>{generationStats.tps} t/s</span>
          </div>
        )}

        <button
          onClick={() => createNewChat()}
          className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors sm:hidden"
          title="New Chat"
        >
          <Plus className="w-5 h-5" />
        </button>

        <button
          onClick={() => setIsExportOpen(true)}
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-zinc-300 hover:text-white hover:bg-zinc-800 text-xs font-medium border border-zinc-700/60 transition-colors"
          title="Export conversation"
        >
          <Share2 className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Export</span>
        </button>
      </div>
    </header>
  );
}
