import React, { useEffect } from 'react';
import { AuthProvider } from './context/AuthContext';
import { ChatProvider, useChat } from './context/ChatContext';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import ChatArea from './components/ChatArea';
import ChatInput from './components/ChatInput';
import SettingsModal from './components/SettingsModal';
import ExportModal from './components/ExportModal';
import AuthModal from './components/AuthModal';
import AdminModal from './components/AdminModal';

function MainApp() {
  const { createNewChat, setIsSettingsOpen } = useChat();

  // Global keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        createNewChat();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === ',') {
        e.preventDefault();
        setIsSettingsOpen(true);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [createNewChat, setIsSettingsOpen]);

  return (
    <div className="flex h-[100dvh] min-h-[100dvh] w-screen overflow-hidden bg-[#212121]">
      <Sidebar />
      <main className="flex-1 flex flex-col min-w-0 h-full relative">
        <Header />
        <ChatArea />
        <ChatInput />
      </main>
      <SettingsModal />
      <ExportModal />
      <AuthModal />
      <AdminModal />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ChatProvider>
        <MainApp />
      </ChatProvider>
    </AuthProvider>
  );
}
