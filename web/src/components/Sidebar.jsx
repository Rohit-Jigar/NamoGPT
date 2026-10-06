import React, { useState, useMemo } from 'react';
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
  User,
  Compass,
  Brain
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
    setIsMemoryOpen
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

  // Group chats by date
  const filteredChats = useMemo(() => {
    if (!searchQuery.trim()) return chats;
    const query = searchQuery.toLowerCase();
    return chats.filter((c) => c.title.toLowerCase().includes(query));
  }, [chats, searchQuery]);

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
    renameChat(id, editTitle);
    setEditingChatId(null);
  }

  function renderGroup(title, chatList) {
    if (chatList.length === 0) return null;
    return (
      <div className="mb-4">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 px-3 py-1">
          {title}
        </div>
        <div className="space-y-0.5">
          {chatList.map((chat) => {
            const isActive = chat.id === currentChatId;
            const isEditing = editingChatId === chat.id;

            return (
              <div
                key={chat.id}
                onClick={() => !isEditing && handleSelectChat(chat.id)}
                className={`group relative flex items-center justify-between px-3 py-2 rounded-lg text-sm cursor-pointer transition-colors ${
                  isActive
                    ? 'bg-[#212121] text-white font-medium'
                    : 'text-zinc-300 hover:bg-[#212121]/60 hover:text-white'
                }`}
              >
                <div className="flex items-center space-x-2.5 truncate flex-1 min-w-0">
                  {chat.isPinned ? (
                    <Pin className="w-4 h-4 text-emerald-400 shrink-0 fill-emerald-400/20" />
                  ) : (
                    <MessageSquare className="w-4 h-4 text-zinc-400 shrink-0" />
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
                      className="bg-zinc-800 text-white text-xs px-2 py-1 rounded outline-none border border-emerald-500 w-full"
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <span className="truncate select-none">{chat.title}</span>
                  )}
                </div>

                {/* Action Buttons */}
                <div
                  className={`flex items-center space-x-1 shrink-0 ${
                    isEditing || isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                  } transition-opacity`}
                  onClick={(e) => e.stopPropagation()}
                >
                  {isEditing ? (
                    <>
                      <button
                        onClick={() => saveEditing(chat.id)}
                        className="p-1 hover:text-emerald-400 text-zinc-400"
                        title="Save"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setEditingChatId(null)}
                        className="p-1 hover:text-rose-400 text-zinc-400"
                        title="Cancel"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => pinChat(chat.id)}
                        className="p-1 hover:text-emerald-400 text-zinc-400 transition-colors"
                        title={chat.isPinned ? 'Unpin' : 'Pin'}
                      >
                        <Pin className={`w-3.5 h-3.5 ${chat.isPinned ? 'fill-emerald-400 text-emerald-400' : ''}`} />
                      </button>
                      <button
                        onClick={() => startEditing(chat)}
                        className="p-1 hover:text-white text-zinc-400 transition-colors"
                        title="Rename"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => deleteChat(chat.id)}
                        className="p-1 hover:text-rose-400 text-zinc-400 transition-colors"
                        title="Delete"
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
      {/* Mobile Backdrop */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-30 md:hidden backdrop-blur-sm transition-opacity"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed md:static inset-y-0 left-0 z-40 flex flex-col w-[260px] bg-[#171717] border-r border-[#303030] transition-transform duration-300 ease-in-out select-none ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0 md:w-0 md:overflow-hidden md:border-r-0'
        }`}
      >
        {/* Header: Logo & New Chat */}
        <div className="p-3 border-b border-[#303030]/60 space-y-2">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center space-x-2.5">
              <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-emerald-400" />
              </div>
              <span className="font-semibold text-base tracking-tight text-white flex items-center gap-1.5">
                NamoGPT
                <span className="text-[10px] font-mono font-medium px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  LiteLLM
                </span>
              </span>
            </div>
            <button
              onClick={() => setIsSidebarOpen(false)}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors md:hidden"
              title="Close sidebar"
            >
              <PanelLeftClose className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={handleCreateNewChat}
            className="w-full flex items-center justify-between px-3 py-2.5 bg-[#212121] hover:bg-[#2f2f2f] text-white rounded-xl text-sm font-medium border border-[#303030] transition-all shadow-sm group"
          >
            <div className="flex items-center space-x-2">
              <Plus className="w-4 h-4 text-emerald-400 group-hover:rotate-90 transition-transform duration-200" />
              <span>New chat</span>
            </div>
            <span className="text-[10px] font-mono text-zinc-500 bg-zinc-800/80 px-1.5 py-0.5 rounded border border-zinc-700/50">
              Ctrl+N
            </span>
          </button>
        </div>

        {/* Search Input */}
        <div className="px-3 pt-2.5">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#212121] text-xs text-white placeholder-zinc-500 pl-8 pr-3 py-1.5 rounded-lg border border-[#303030] focus:border-emerald-500 outline-none transition-colors"
            />
          </div>
        </div>

        {/* Chat History List */}
        <div className="flex-1 overflow-y-auto px-2 py-3">
          {chats.length === 0 ? (
            <div className="text-center py-10 px-4">
              <Bot className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
              <p className="text-xs text-zinc-500">No chats yet.</p>
              <p className="text-[11px] text-zinc-600 mt-1">Start a conversation above!</p>
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

        {/* Footer: User profile, Admin console & Settings */}
        <div className="p-3 border-t border-[#303030] bg-[#171717] space-y-1.5">
          {chats.length > 0 && (
            <button
              onClick={() => {
                if (confirm('Clear all conversation history?')) clearAllChats();
              }}
              className="w-full flex items-center space-x-2.5 px-3 py-1.5 text-xs text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5 text-zinc-500 group-hover:text-rose-400" />
              <span>Clear all chats</span>
            </button>
          )}

          {/* ChatGPT-style Platform Features */}
          <div className="pt-2 border-t border-zinc-800/80 space-y-0.5">
            <button
              onClick={() => setIsDeepResearchOpen(true)}
              className="w-full flex items-center space-x-2.5 px-3 py-1.5 text-xs text-indigo-300 hover:text-white hover:bg-indigo-500/10 rounded-lg transition-colors group"
            >
              <Compass className="w-3.5 h-3.5 text-indigo-400 group-hover:rotate-45 transition-transform" />
              <span>Deep Research</span>
            </button>
            <button
              onClick={() => setIsPersonaOpen(true)}
              className="w-full flex items-center space-x-2.5 px-3 py-1.5 text-xs text-emerald-300 hover:text-white hover:bg-emerald-500/10 rounded-lg transition-colors"
            >
              <Bot className="w-3.5 h-3.5 text-emerald-400" />
              <span>AI Personas & GPTs</span>
            </button>
            <button
              onClick={() => setIsMemoryOpen(true)}
              className="w-full flex items-center space-x-2.5 px-3 py-1.5 text-xs text-purple-300 hover:text-white hover:bg-purple-500/10 rounded-lg transition-colors"
            >
              <Brain className="w-3.5 h-3.5 text-purple-400" />
              <span>Long-Term Memory</span>
            </button>
          </div>

          {/* Super Admin Quick Access */}
          {isSuperAdmin && (
            <button
              onClick={() => setIsAdminModalOpen(true)}
              className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded-xl transition-all"
            >
              <div className="flex items-center space-x-2">
                <Crown className="w-4 h-4 text-amber-400 fill-current" />
                <span>Super Admin Console</span>
              </div>
              <span className="text-[9px] font-mono uppercase bg-amber-500/20 px-1.5 py-0.5 rounded">
                Telemetry
              </span>
            </button>
          )}

          {/* User Profile or Sign In Card */}
          {isAuthenticated ? (
            <div className="flex items-center justify-between px-2.5 py-2 rounded-xl bg-[#212121] border border-zinc-800">
              <div className="flex items-center space-x-2 min-w-0">
                <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-400 text-black font-bold text-xs flex items-center justify-center shrink-0">
                  {user.name ? user.name[0].toUpperCase() : 'U'}
                </div>
                <div className="truncate">
                  <div className="text-xs font-medium text-white truncate leading-tight">{user.name}</div>
                  <div className="text-[10px] text-zinc-400 font-mono truncate">{user.role}</div>
                </div>
              </div>
              <button
                onClick={() => setIsSettingsOpen(true)}
                className="p-1 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-700/60"
                title="Settings"
              >
                <Settings className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setIsAuthModalOpen(true)}
                className="flex-1 flex items-center justify-center space-x-2 px-3 py-2 text-xs font-semibold text-white bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-xl transition-colors"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Sign In / Register</span>
              </button>
              <button
                onClick={() => setIsSettingsOpen(true)}
                className="p-2 text-zinc-400 hover:text-white bg-zinc-800/60 hover:bg-zinc-800 rounded-xl border border-zinc-700/60"
                title="Settings"
              >
                <Settings className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
