import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useChat } from '../context/ChatContext';
import { useAuth } from '../context/AuthContext';
import {
  MessageSquare,
  Plus,
  Search,
  Settings,
  Trash2,
  Edit2,
  Pin,
  Check,
  X,
  PanelLeftClose,
  Sparkles,
  Bot,
  Crown,
  LogIn,
  Compass,
  Brain,
  Cpu,
  Code2
} from 'lucide-react';

export default function Sidebar() {
  const {
    chats,
    currentChatId,
    selectChat,
    createNewChat,
    deleteChat,
    renameChat,
    pinChat,
    clearAllChats,
    isSidebarOpen,
    setIsSidebarOpen,
    setIsSettingsOpen,
    setIsDeepResearchOpen,
    setIsPersonaOpen,
    setIsMemoryOpen,
    setIsMcpOpen,
    currentPersona
  } = useChat();

  const {
    user,
    isAuthenticated,
    isSuperAdmin,
    setIsAuthModalOpen,
    setIsAdminModalOpen
  } = useAuth();

  const [searchQuery, setSearchQuery] = useState('');
  const [editingChatId, setEditingChatId] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const searchInputRef = useRef(null);

  // Global Ctrl+K / Cmd+K listener
  useEffect(() => {
    function handleKeyDown(e) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  function handleSelectChat(id) {
    selectChat(id);
    if (window.innerWidth < 768) {
      setIsSidebarOpen(false);
    }
  }

  function handleCreateNewChat() {
    createNewChat();
    if (window.innerWidth < 768) {
      setIsSidebarOpen(false);
    }
  }

  // Filter chats by query
  const filteredChats = useMemo(() => {
    if (!searchQuery.trim()) return chats;
    const query = searchQuery.toLowerCase();
    return chats.filter((c) => c.title.toLowerCase().includes(query));
  }, [chats, searchQuery]);

  // Group chats by date
  const groupedChats = useMemo(() => {
    const pinned = [];
    const today = [];
    const yesterday = [];
    const pastWeek = [];
    const older = [];

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfYesterday = startOfToday - 86400000;
    const startOfPastWeek = startOfToday - 7 * 86400000;

    filteredChats.forEach((chat) => {
      if (chat.isPinned) {
        pinned.push(chat);
        return;
      }
      const time = chat.updatedAt || chat.createdAt || 0;
      if (time >= startOfToday) {
        today.push(chat);
      } else if (time >= startOfYesterday) {
        yesterday.push(chat);
      } else if (time >= startOfPastWeek) {
        pastWeek.push(chat);
      } else {
        older.push(chat);
      }
    });

    return { pinned, today, yesterday, pastWeek, older };
  }, [filteredChats]);

  function startEditing(chat) {
    setEditingChatId(chat.id);
    setEditTitle(chat.title);
  }

  function saveEditing(id) {
    if (editTitle.trim()) {
      renameChat(id, editTitle.trim());
    }
    setEditingChatId(null);
  }

  function renderGroup(title, chatList) {
    if (chatList.length === 0) return null;
    return (
      <div className="mb-4">
        <div className="text-[10px] font-mono font-semibold uppercase tracking-wider text-[#BDB8B3] px-3 py-1 select-none flex items-center justify-between">
          <span>{title}</span>
          <span className="text-[9px] text-[#7A7570] font-mono">({chatList.length})</span>
        </div>
        <div className="space-y-1 mt-0.5">
          {chatList.map((chat) => {
            const isActive = chat.id === currentChatId;
            const isEditing = editingChatId === chat.id;

            return (
              <div
                key={chat.id}
                onClick={() => !isEditing && handleSelectChat(chat.id)}
                className={`group relative flex items-center justify-between px-3 py-2 rounded-xl text-xs cursor-pointer transition-all duration-200 ${
                  isActive
                    ? 'bg-[#241E1A] text-[#FAF9F8] font-medium border border-[#6F4E37] shadow-sm'
                    : 'text-[#BDB8B3] hover:text-[#FAF9F8] hover:bg-[#1A1613] border border-transparent hover:border-[#E5E4E2]/10'
                }`}
              >
                <div className="flex items-center space-x-2.5 truncate flex-1 min-w-0">
                  {isActive ? (
                    <span className="w-1.5 h-3.5 bg-[#6F4E37] rounded-full shrink-0 -ml-0.5 shadow-sm" />
                  ) : chat.isPinned ? (
                    <Pin className="w-3.5 h-3.5 text-[#E6E0F0] shrink-0 fill-[#E6E0F0]/30" />
                  ) : (
                    <MessageSquare className="w-3.5 h-3.5 text-[#7A7570] group-hover:text-[#E6E0F0] shrink-0 transition-colors" />
                  )}

                  {isEditing ? (
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveEditing(chat.id);
                        if (e.key === 'Escape') setEditingChatId(null);
                      }}
                      autoFocus
                      className="bg-[#0D0B0A] text-[#FAF9F8] text-xs px-2.5 py-1 rounded-lg outline-none border border-[#6F4E37] w-full shadow-inner focus:ring-1 focus:ring-[#E6E0F0]/30"
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <span className="truncate select-none tracking-tight">{chat.title}</span>
                  )}
                </div>

                {/* Hover Quick Actions */}
                <div
                  className={`flex items-center space-x-1 shrink-0 ${
                    isEditing || isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                  } transition-opacity duration-150`}
                  onClick={(e) => e.stopPropagation()}
                >
                  {isEditing ? (
                    <>
                      <button
                        onClick={() => saveEditing(chat.id)}
                        className="p-1 text-emerald-400 hover:text-emerald-300 rounded-lg hover:bg-emerald-500/15 transition-all"
                        title="Save title"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setEditingChatId(null)}
                        className="p-1 text-[#BDB8B3] hover:text-rose-400 rounded-lg hover:bg-rose-500/15 transition-all"
                        title="Cancel"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => pinChat(chat.id)}
                        className={`p-1 rounded-lg transition-all ${
                          chat.isPinned
                            ? 'text-[#E6E0F0] hover:bg-[#6F4E37]/30'
                            : 'text-[#7A7570] hover:text-[#E6E0F0] hover:bg-[#241E1A]'
                        }`}
                        title={chat.isPinned ? 'Unpin thread' : 'Pin thread'}
                      >
                        <Pin className={`w-3.5 h-3.5 ${chat.isPinned ? 'fill-[#E6E0F0] text-[#E6E0F0]' : ''}`} />
                      </button>
                      <button
                        onClick={() => startEditing(chat)}
                        className="p-1 text-[#7A7570] hover:text-[#FAF9F8] rounded-lg hover:bg-[#241E1A] transition-all"
                        title="Rename conversation"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => deleteChat(chat.id)}
                        className="p-1 text-[#7A7570] hover:text-rose-400 rounded-lg hover:bg-rose-950/20 transition-all"
                        title="Delete conversation"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Mobile Drawer Fluid Backdrop */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/75 z-40 md:hidden backdrop-blur-md transition-opacity duration-300"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed md:static inset-y-0 left-0 z-50 md:z-auto flex flex-col w-[280px] bg-[#13100E] border-r border-[#E5E4E2]/10 transition-transform duration-300 ease-in-out select-none shadow-2xl md:shadow-none ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0 md:w-0 md:overflow-hidden md:border-r-0'
        }`}
      >
        {/* Brand & Action Header */}
        <div className="p-3.5 border-b border-[#E5E4E2]/10 space-y-3 bg-[#13100E]/90 backdrop-blur-md">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center space-x-2.5">
              <div className="w-7 h-7 rounded-lg bg-[#6F4E37] border border-[#E6E0F0]/20 flex items-center justify-center shadow-sm">
                <Sparkles className="w-3.5 h-3.5 text-[#FAF9F8]" />
              </div>
              <span className="font-bold text-sm tracking-tight text-[#FAF9F8] flex items-center gap-1.5">
                NAMO<span className="text-[#E6E0F0]">GPT</span>
                <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-full bg-[#6F4E37]/30 text-[#E5E4E2] border border-[#6F4E37] shadow-sm">
                  v2.6
                </span>
              </span>
            </div>
            <button
              onClick={() => setIsSidebarOpen(false)}
              className="p-1.5 rounded-lg text-[#BDB8B3] hover:text-[#FAF9F8] hover:bg-[#241E1A] transition-colors md:hidden"
              title="Close sidebar"
            >
              <PanelLeftClose className="w-4 h-4" />
            </button>
          </div>

          {/* New Chat Button */}
          <button
            onClick={handleCreateNewChat}
            className="w-full relative group overflow-hidden flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-[#6F4E37] hover:bg-[#8C6549] text-[#FAF9F8] text-xs font-semibold border border-[#6F4E37] shadow-md transition-all duration-200 active:scale-[0.98]"
          >
            <div className="flex items-center space-x-2.5">
              <div className="w-5 h-5 rounded-md bg-[#241E1A] text-[#FAF9F8] flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              </div>
              <span className="tracking-tight text-[#FAF9F8] font-medium">New Conversation</span>
            </div>
            <kbd className="text-[10px] font-mono text-[#E5E4E2] bg-[#241E1A] px-1.5 py-0.5 rounded-md border border-[#E5E4E2]/15">
              Ctrl+N
            </kbd>
          </button>
        </div>

        {/* Capsule Search Input */}
        <div className="px-3 pt-3 pb-1">
          <div className="relative group">
            <Search className="w-3.5 h-3.5 text-[#BDB8B3] group-focus-within:text-[#E6E0F0] absolute left-3.5 top-1/2 -translate-y-1/2 transition-colors pointer-events-none" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#1A1613] hover:bg-[#241E1A] focus:bg-[#241E1A] text-xs text-[#FAF9F8] placeholder-[#7A7570] pl-9 pr-14 py-2 rounded-xl border border-[#E5E4E2]/10 focus:border-[#6F4E37] focus:ring-1 focus:ring-[#E6E0F0]/30 outline-none transition-all shadow-inner"
            />
            {searchQuery ? (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#BDB8B3] hover:text-[#FAF9F8] transition-colors p-0.5 rounded-full hover:bg-white/10"
              >
                <X className="w-3 h-3" />
              </button>
            ) : (
              <kbd className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-mono text-[#7A7570] bg-[#241E1A] border border-[#E5E4E2]/10 px-1.5 py-0.5 rounded-md pointer-events-none">
                Ctrl+K
              </kbd>
            )}
          </div>
        </div>

        {/* Conversation List Grouped */}
        <div className="flex-1 overflow-y-auto px-2.5 py-3">
          {chats.length === 0 ? (
            <div className="text-center py-12 px-4">
              <div className="w-10 h-10 rounded-2xl bg-[#1A1613] border border-[#E5E4E2]/10 flex items-center justify-center mx-auto mb-3">
                <Bot className="w-5 h-5 text-[#BDB8B3]" />
              </div>
              <p className="text-xs font-medium text-[#FAF9F8]">No conversations yet</p>
              <p className="text-[11px] text-[#7A7570] mt-1">Start a fresh turn to engage the cognitive inference mesh.</p>
            </div>
          ) : (
            <>
              {renderGroup('Pinned', groupedChats.pinned)}
              {renderGroup('Today', groupedChats.today)}
              {renderGroup('Yesterday', groupedChats.yesterday)}
              {renderGroup('Previous 7 Days', groupedChats.pastWeek)}
              {renderGroup('Older', groupedChats.older)}
            </>
          )}
        </div>

        {/* Footer: Badges & Profile */}
        <div className="p-3 border-t border-[#E5E4E2]/10 bg-[#13100E] space-y-2">
          {chats.length > 0 && (
            <button
              onClick={() => {
                if (confirm('Clear all conversation history?')) clearAllChats();
              }}
              className="w-full flex items-center space-x-2 px-2.5 py-1 text-[11px] text-[#7A7570] hover:text-rose-400 hover:bg-rose-950/20 rounded-lg transition-colors"
            >
              <Trash2 className="w-3 h-3 text-[#7A7570] group-hover:text-rose-400" />
              <span>Clear conversation history</span>
            </button>
          )}

          {/* Quick Navigation Badges */}
          <div className="pt-2 border-t border-[#E5E4E2]/10 space-y-1">
            {/* Persona Selector Badge */}
            <button
              onClick={() => setIsPersonaOpen(true)}
              className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl bg-[#1A1613] hover:bg-[#241E1A] border border-[#E5E4E2]/10 hover:border-[#E6E0F0]/30 text-xs text-[#FAF9F8] transition-all group"
              title="Switch AI Persona"
            >
              <div className="flex items-center space-x-2 min-w-0">
                <Bot className="w-3.5 h-3.5 text-[#E6E0F0] shrink-0" />
                <span className="truncate">{currentPersona?.name || 'Persona'}</span>
              </div>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-[#6F4E37]/30 text-[#E5E4E2] border border-[#6F4E37] shrink-0">
                GPT
              </span>
            </button>

            {/* Deep Research Link */}
            <button
              onClick={() => setIsDeepResearchOpen(true)}
              className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl bg-[#1A1613] hover:bg-[#241E1A] border border-[#E5E4E2]/10 hover:border-[#E6E0F0]/30 text-xs text-[#FAF9F8] transition-all group"
              title="Autonomous Deep Research"
            >
              <div className="flex items-center space-x-2">
                <Compass className="w-3.5 h-3.5 text-[#E5E4E2] group-hover:rotate-45 transition-transform" />
                <span>Deep Research</span>
              </div>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-[#241E1A] text-[#E5E4E2] border border-[#E5E4E2]/15">
                Multi-Step
              </span>
            </button>

            {/* Long-Term Memory & MCP */}
            <div className="grid grid-cols-2 gap-1.5 pt-0.5">
              <button
                onClick={() => setIsMemoryOpen(true)}
                className="flex items-center justify-center space-x-1.5 px-2 py-1.5 rounded-xl bg-[#1A1613] hover:bg-[#241E1A] border border-[#E5E4E2]/10 text-xs text-[#E5E4E2] hover:text-[#FAF9F8] transition-all"
                title="Long-Term Memory"
              >
                <Brain className="w-3.5 h-3.5 text-[#E6E0F0]" />
                <span className="text-[11px] font-medium">Memory</span>
              </button>
              <button
                onClick={() => setIsMcpOpen(true)}
                className="flex items-center justify-center space-x-1.5 px-2 py-1.5 rounded-xl bg-[#1A1613] hover:bg-[#241E1A] border border-[#E5E4E2]/10 text-xs text-[#E5E4E2] hover:text-[#FAF9F8] transition-all"
                title="MCP Tools Protocol"
              >
                <Cpu className="w-3.5 h-3.5 text-[#E6E0F0]" />
                <span className="text-[11px] font-medium">MCP Tools</span>
              </button>
            </div>

            {/* Coder Studio Quick Action */}
            <button
              onClick={() => {
                const chatInput = document.querySelector('textarea');
                if (chatInput) {
                  chatInput.focus();
                  chatInput.value = '/// Coder Studio: Write a clean, modern, and production-ready implementation of ';
                  chatInput.dispatchEvent(new Event('input', { bubbles: true }));
                }
              }}
              className="w-full flex items-center space-x-2 px-2.5 py-1.5 rounded-xl bg-[#1A1613] hover:bg-[#241E1A] border border-[#E5E4E2]/10 text-xs text-[#E5E4E2] hover:text-[#FAF9F8] transition-all"
            >
              <Code2 className="w-3.5 h-3.5 text-[#E6E0F0]" />
              <span className="text-[11px] font-medium">Coder Studio</span>
            </button>
          </div>

          {/* SuperAdmin Telemetry Badge */}
          <button
            onClick={() => setIsAdminModalOpen(true)}
            className="w-full flex items-center justify-between px-2.5 py-1.5 text-xs font-semibold text-[#FAF9F8] bg-[#241E1A] hover:bg-[#2D2520] border border-[#6F4E37] rounded-xl transition-all shadow-sm"
            title="Open Admin & Telemetry Console"
          >
            <div className="flex items-center space-x-2">
              <Crown className="w-3.5 h-3.5 text-[#E6E0F0]" />
              <span>Telemetry Console</span>
            </div>
            <span className="text-[9px] font-mono uppercase bg-[#6F4E37] text-white px-1.5 py-0.5 rounded-md">
              Active
            </span>
          </button>

          {/* User Profile or Sign In Card */}
          {isAuthenticated ? (
            <div className="flex items-center justify-between px-2.5 py-2 rounded-xl bg-[#1A1613] border border-[#E5E4E2]/15 shadow-sm">
              <div className="flex items-center space-x-2.5 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-[#6F4E37] text-white font-extrabold text-xs flex items-center justify-center shrink-0 shadow-md">
                  {user.name ? user.name[0].toUpperCase() : 'U'}
                </div>
                <div className="truncate">
                  <div className="text-xs font-semibold text-[#FAF9F8] truncate leading-tight">{user.name}</div>
                  <div className="text-[10px] text-[#BDB8B3] font-mono truncate">{user.role || 'Member'}</div>
                </div>
              </div>
              <button
                onClick={() => setIsSettingsOpen(true)}
                className="p-1.5 text-[#BDB8B3] hover:text-[#FAF9F8] rounded-lg hover:bg-[#241E1A] transition-colors"
                title="Settings"
              >
                <Settings className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setIsAuthModalOpen(true)}
                className="flex-1 flex items-center justify-center space-x-1.5 px-3 py-2 text-xs font-semibold text-[#FAF9F8] bg-[#6F4E37] hover:bg-[#8C6549] border border-[#6F4E37] rounded-xl transition-all shadow-sm group"
              >
                <LogIn className="w-3.5 h-3.5 text-[#FAF9F8] group-hover:translate-x-0.5 transition-transform" />
                <span>Sign In / Register</span>
              </button>
              <button
                onClick={() => setIsSettingsOpen(true)}
                className="p-2 text-[#BDB8B3] hover:text-[#FAF9F8] bg-[#1A1613] hover:bg-[#241E1A] rounded-xl border border-[#E5E4E2]/10 transition-colors"
                title="Settings"
              >
                <Settings className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
