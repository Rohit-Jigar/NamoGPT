import React, { useEffect } from 'react';
import { ChatProvider, useChat } from './context/ChatContext';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import ChatArea from './components/ChatArea';
import ChatInput from './components/ChatInput';
import SettingsModal from './components/SettingsModal';
import ExportModal from './components/ExportModal';

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
  }, []);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#212121]">
      <Sidebar />
      <main className="flex-1 flex flex-col min-w-0 h-full relative">
        <Header />
        <ChatArea />
        <ChatInput />
      </main>
      <SettingsModal />
      <ExportModal />
    </div>
  );
}

export default function App() {
  return (
    <ChatProvider>
      <MainApp />
    </ChatProvider>
  );
}
