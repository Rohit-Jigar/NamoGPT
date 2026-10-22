import React, { useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ChatProvider, useChat } from './context/ChatContext';
import { ToastProvider } from './context/ToastContext';
import ErrorBoundary from './components/common/ErrorBoundary';
import NetworkOfflineBanner from './components/common/NetworkOfflineBanner';
import RateLimitNotice from './components/common/RateLimitNotice';
import ContextLimitWarning from './components/common/ContextLimitWarning';
import ToastContainer from './components/common/ToastContainer';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import ChatArea from './components/ChatArea';
import ChatInput from './components/ChatInput';
import SettingsModal from './components/SettingsModal';
import ExportModal from './components/ExportModal';
import AuthModal3D from './components/auth/AuthModal3D';
import AdminModal from './components/AdminModal';
import DeepResearchModal from './components/DeepResearchModal';
import MemoryModal from './components/MemoryModal';
import PersonaSelectorModal from './components/PersonaSelectorModal';
import McpModal from './components/McpModal';
import ModelUsageMeter from './components/ModelUsageMeter';
import { Sparkles, ArrowRight } from 'lucide-react';

function MainApp() {
  const {
    createNewChat,
    setIsSettingsOpen,
    isDeepResearchOpen,
    setIsDeepResearchOpen,
    isMemoryOpen,
    setIsMemoryOpen,
    isPersonaOpen,
    setIsPersonaOpen,
    isMcpOpen,
    setIsMcpOpen,
    isUsageMeterOpen,
    setIsUsageMeterOpen
  } = useChat();

  const {
    isAuthenticated,
    setIsAuthModalOpen
  } = useAuth();

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
    <div className="flex h-[100dvh] min-h-[100dvh] w-screen overflow-hidden bg-[#0a0d14] relative">
      <NetworkOfflineBanner />
      <Sidebar />
      <main className="flex-1 flex flex-col min-w-0 h-full relative">
        {/* Unauthenticated Top Notice Bar */}
        {!isAuthenticated && (
          <div className="bg-gradient-to-r from-emerald-950/70 via-zinc-950/80 to-teal-950/70 border-b border-emerald-500/25 px-3 sm:px-4 py-1.5 flex items-center justify-between text-xs backdrop-blur-md shrink-0 z-20">
            <div className="flex items-center space-x-2 truncate">
              <span className="flex h-2 w-2 relative shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-zinc-300 truncate text-[11px] sm:text-xs">
                <strong className="text-emerald-400 font-semibold">NamoGPT 3D Glass:</strong>{' '}
                Sign In or Register to sync chat telemetry and unlock SuperAdmin access!
              </span>
            </div>
            <button
              onClick={() => setIsAuthModalOpen(true)}
              className="shrink-0 ml-3 flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-[11px] shadow-sm transition-all hover:scale-105 active:scale-95"
            >
              <span>Sign In / Register</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        )}

        <Header />
        <ChatArea />
        <RateLimitNotice />
        <ContextLimitWarning />
        <ChatInput />
      </main>
      <SettingsModal />
      <ExportModal />
      <AuthModal3D />
      <AdminModal />
      <DeepResearchModal
        isOpen={isDeepResearchOpen}
        onClose={() => setIsDeepResearchOpen(false)}
      />
      <MemoryModal
        isOpen={isMemoryOpen}
        onClose={() => setIsMemoryOpen(false)}
      />
      <PersonaSelectorModal
        isOpen={isPersonaOpen}
        onClose={() => setIsPersonaOpen(false)}
      />
      <McpModal
        isOpen={isMcpOpen}
        onClose={() => setIsMcpOpen(false)}
      />
      <ModelUsageMeter
        isOpen={isUsageMeterOpen}
        onClose={() => setIsUsageMeterOpen(false)}
      />
      <ToastContainer />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <ToastProvider>
          <ChatProvider>
            <MainApp />
          </ChatProvider>
        </ToastProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
