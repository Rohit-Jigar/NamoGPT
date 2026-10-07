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
  Compass,
  Brain,
  Cpu
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
    setIsMcpOpen
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
    renameChat(id, editTitle);
    setEditingChatId(null);
  }

  function renderGroup(title, chatList) {
    if (chatList.length === 0) return null;
    return (
      <div className="mb-4">
        <div className="text-[10px] font-mono font-semibold uppercase tracking-wider text-zinc-500 px-3 py-1 select-none">
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
                className={`group relative flex items-center justify-between px-3 py-2 rounded-xl text-xs cursor-pointer transition-all duration-150 ${
                  isActive
                    ? 'bg-zinc-800/90 text-white font-medium border border-zinc-700/60 shadow-sm shadow-black/20'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
                }`}
              >
                <div className="flex items-center space-x-2 truncate flex-1 min-w-0">
                  {isActive && (
                    <span className="w-1 h-3.5 bg-emerald-400 rounded-full shrink-0 -ml-1 mr-0.5 shadow-sm shadow-emerald-400/50" />
                  )}
                  {chat.isPinned ? (
                    <Pin className="w-3.5 h-3.5 text-emerald-400 shrink-0 fill-emerald-400/20" />
                  ) : (
                    <MessageSquare className="w-3.5 h-3.5 text-zinc-500 group-hover:text-zinc-400 shrink-0" />
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
                      className="bg-zinc-900 text-white text-xs px-2 py-0.5 rounded outline-none border border-emerald-500 w-full"
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <span className="truncate select-none">{chat.title}</span>
                  )}
                </div>

                {/* Action Buttons on Hover */}
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
                        className="p-1 hover:text-emerald-400 text-zinc-400 rounded hover:bg-zinc-700/50"
                        title="Save"
                      >
                        <Check className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => setEditingChatId(null)}
                        className="p-1 hover:text-rose-400 text-zinc-400 rounded hover:bg-zinc-700/50"
                        title="Cancel"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => pinChat(chat.id)}
                        className="p-1 hover:text-emerald-400 text-zinc-500 hover:text-zinc-300 rounded hover:bg-zinc-700/40 transition-colors"
                        title={chat.isPinned ? 'Unpin' : 'Pin'}
                      >
                        <Pin className={`w-3 h-3 ${chat.isPinned ? 'fill-emerald-400 text-emerald-400' : ''}`} />
                      </button>
                      <button
                        onClick={() => startEditing(chat)}
                        className="p-1 text-zinc-500 hover:text-zinc-200 rounded hover:bg-zinc-700/40 transition-colors"
                        title="Rename"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => deleteChat(chat.id)}
                        className="p-1 text-zinc-500 hover:text-rose-400 rounded hover:bg-rose-500/10 transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-3 h-3" />
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
          className="fixed inset-0 bg-black/70 z-30 md:hidden backdrop-blur-sm transition-opacity"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed md:static inset-y-0 left-0 z-40 flex flex-col w-[270px] bg-[#0c0c0e] border-r border-zinc-800/80 transition-transform duration-300 ease-in-out select-none ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0 md:w-0 md:overflow-hidden md:border-r-0'
        }`}
      >
        {/* Header: Brand & New Chat */}
        <div className="p-3.5 border-b border-zinc-800/80 space-y-2.5">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center space-x-2.5">
              <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center shadow-sm shadow-emerald-500/20">
                <Sparkles className="w-4 h-4 text-emerald-400" />
              </div>
              <span className="font-semibold text-sm tracking-tight text-white flex items-center gap-1.5">
                NamoGPT
                <span className="text-[10px] font-mono font-medium px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
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
            className="w-full flex items-center justify-between px-3 py-2 bg-zinc-900/90 hover:bg-zinc-800 text-zinc-100 rounded-xl text-xs font-medium border border-zinc-800/80 hover:border-zinc-700/80 transition-all shadow-sm group"
          >
            <div className="flex items-center space-x-2">
              <Plus className="w-3.5 h-3.5 text-emerald-400 group-hover:rotate-90 transition-transform duration-200" />
              <span>New conversation</span>
            </div>
            <span className="text-[10px] font-mono text-zinc-500 bg-zinc-800/80 px-1.5 py-0.5 rounded border border-zinc-700/40">
              Ctrl+N
            </span>
          </button>
        </div>

        {/* Search Input */}
        <div className="px-3 pt-3">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search chats..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-zinc-900/80 text-xs text-white placeholder-zinc-500 pl-8.5 pr-7 py-1.5 rounded-lg border border-zinc-800/80 focus:border-zinc-600 outline-none transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* Chat History List */}
        <div className="flex-1 overflow-y-auto px-2.5 py-3">
          {chats.length === 0 ? (
            <div className="text-center py-10 px-4">
              <Bot className="w-8 h-8 text-zinc-700 mx-auto mb-2" />
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

        {/* Footer: Platform Features, Admin console & User profile */}
        <div className="p-3 border-t border-zinc-800/80 bg-[#0c0c0e] space-y-2">
          {chats.length > 0 && (
            <button
              onClick={() => {
                if (confirm('Clear all conversation history?')) clearAllChats();
              }}
              className="w-full flex items-center space-x-2 px-2.5 py-1 text-[11px] text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
            >
              <Trash2 className="w-3 h-3 text-zinc-500 group-hover:text-rose-400" />
              <span>Clear conversation history</span>
            </button>
          )}

          {/* ChatGPT-style Platform Features Drawer */}
          <div className="pt-2 border-t border-zinc-800/60 space-y-0.5">
            <button
              onClick={() => setIsDeepResearchOpen(true)}
              className="w-full flex items-center space-x-2.5 px-2.5 py-1.5 text-xs text-indigo-300/90 hover:text-white hover:bg-indigo-500/10 rounded-lg transition-colors group"
            >
              <Compass className="w-3.5 h-3.5 text-indigo-400 group-hover:rotate-45 transition-transform" />
              <span className="font-medium">Deep Research</span>
            </button>
            <button
              onClick={() => setIsPersonaOpen(true)}
              className="w-full flex items-center space-x-2.5 px-2.5 py-1.5 text-xs text-emerald-300/90 hover:text-white hover:bg-emerald-500/10 rounded-lg transition-colors"
            >
              <Bot className="w-3.5 h-3.5 text-emerald-400" />
              <span className="font-medium">AI Personas & GPTs</span>
            </button>
            <button
              onClick={() => setIsMemoryOpen(true)}
              className="w-full flex items-center space-x-2.5 px-2.5 py-1.5 text-xs text-purple-300/90 hover:text-white hover:bg-purple-500/10 rounded-lg transition-colors"
            >
              <Brain className="w-3.5 h-3.5 text-purple-400" />
              <span className="font-medium">Long-Term Memory</span>
            </button>
            <button
              onClick={() => setIsMcpOpen(true)}
              className="w-full flex items-center space-x-2.5 px-2.5 py-1.5 text-xs text-amber-300/90 hover:text-white hover:bg-amber-500/10 rounded-lg transition-colors"
            >
              <Cpu className="w-3.5 h-3.5 text-amber-400" />
              <span className="font-medium">MCP Tools Protocol</span>
            </button>
          </div>

          {/* Super Admin Quick Access */}
          {isSuperAdmin && (
            <button
              onClick={() => setIsAdminModalOpen(true)}
              className="w-full flex items-center justify-between px-2.5 py-1.5 text-xs font-semibold text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded-xl transition-all"
            >
              <div className="flex items-center space-x-2">
                <Crown className="w-3.5 h-3.5 text-amber-400 fill-current" />
                <span>Super Admin Console</span>
              </div>
              <span className="text-[9px] font-mono uppercase bg-amber-500/20 px-1.5 py-0.5 rounded">
                Telemetry
              </span>
            </button>
          )}

          {/* User Profile or Sign In Card */}
          {isAuthenticated ? (
            <div className="flex items-center justify-between px-2.5 py-1.5 rounded-xl bg-zinc-900/90 border border-zinc-800/80">
              <div className="flex items-center space-x-2 min-w-0">
                <div className="w-6 h-6 rounded-lg bg-gradient-to-tr from-emerald-500 to-teal-400 text-black font-bold text-xs flex items-center justify-center shrink-0">
                  {user.name ? user.name[0].toUpperCase() : 'U'}
                </div>
                <div className="truncate">
                  <div className="text-xs font-medium text-white truncate leading-tight">{user.name}</div>
                  <div className="text-[10px] text-zinc-400 font-mono truncate">{user.role}</div>
                </div>
              </div>
              <button
                onClick={() => setIsSettingsOpen(true)}
                className="p-1 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800"
                title="Settings"
              >
                <Settings className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setIsAuthModalOpen(true)}
                className="flex-1 flex items-center justify-center space-x-1.5 px-3 py-1.5 text-xs font-medium text-zinc-200 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 rounded-xl transition-colors"
              >
                <LogIn className="w-3.5 h-3.5 text-emerald-400" />
                <span>Sign In / Register</span>
              </button>
              <button
                onClick={() => setIsSettingsOpen(true)}
                className="p-2 text-zinc-400 hover:text-white bg-zinc-900 hover:bg-zinc-800 rounded-xl border border-zinc-800"
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
