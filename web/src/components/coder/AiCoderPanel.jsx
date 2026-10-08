import React, { useState, useRef, useEffect } from 'react';
import {
  Bot,
  Sparkles,
  History,
  Send,
  RotateCcw,
  Plus,
  Trash2,
  GitCommit,
  Check,
  ChevronDown,
  Cpu,
  Shield,
  Wand2,
  TestTube,
  FileCode,
  FileCheck,
  Layers,
  X,
  ExternalLink,
  Code
} from 'lucide-react';
import { streamChatCompletion, runCoderAgentQuery, DEFAULT_SERVER_URL } from '../../services/api';

const CODER_MODELS = [
  { id: 'ollama', name: 'Ollama (Local Offline)', provider: 'Local Llama/Qwen', badge: '100% Offline', color: 'text-amber-400' },
  { id: 'omnirouter', name: 'OmniRouter / 9Router', provider: 'Universal Gateway', badge: 'Sonnet 3.5', color: 'text-orange-400' },
  { id: 'gemini', name: 'Gemini 2.5 Flash', provider: 'Google AI', badge: '1M Context', color: 'text-emerald-400' },
  { id: 'groq', name: 'Groq Cloud LPU', provider: 'Groq Llama 3.3', badge: '300 t/s', color: 'text-cyan-400' }
];

const QUICK_ACTIONS = [
  { id: 'explain', label: 'Explain Code', icon: Wand2, prompt: 'Explain the architecture, functions, and logic of the active file in detail.' },
  { id: 'bugs', label: 'Find Bugs & Security', icon: Shield, prompt: 'Perform a comprehensive code review and security audit on the active file. Highlight potential vulnerabilities and memory leaks.' },
  { id: 'refactor', label: 'Refactor Code', icon: Sparkles, prompt: 'Refactor the active file for cleaner readability, modern best practices, and performance. Propose complete updated code.' },
  { id: 'tests', label: 'Write Tests', icon: TestTube, prompt: 'Write comprehensive unit and integration tests with edge cases for the active code.' },
  { id: 'feature', label: 'Generate Feature', icon: Layers, prompt: 'Propose a new feature extension or optimization for this file.' }
];

export default function AiCoderPanel({
  activeFilePath = '',
  activeFileContent = '',
  openFiles = [],
  onProposeDiff,
  checkpoints = [],
  onCreateCheckpoint,
  onRollbackCheckpoint,
  onDeleteCheckpoint,
  onClose
}) {
  const [activeTab, setActiveTab] = useState('agent'); // 'agent' | 'checkpoints'
  const [selectedModel, setSelectedModel] = useState('gemini');
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);

  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      role: 'assistant',
      content: `👋 Hello! I am your Namo Coder Agent. I have full context of your repository and active file (\`${activeFilePath || 'none'}\`).\n\nAsk me anything, click a quick action, or ask me to modify code directly to review a diff.`,
      timestamp: new Date().toLocaleTimeString()
    }
  ]);

  const [promptInput, setPromptInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Checkpoint Modal
  const [isNewCheckpointOpen, setIsNewCheckpointOpen] = useState(false);
  const [checkpointName, setCheckpointName] = useState('');
  const [checkpointDesc, setCheckpointDesc] = useState('');

  const chatEndRef = useRef(null);

  // Auto-scroll chat
  useEffect(() => {
    if (activeTab === 'agent') {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, activeTab]);

  // Handle Send Query
  const handleSendMessage = async (userPrompt) => {
    const query = (userPrompt || promptInput).trim();
    if (!query || isLoading) return;

    setPromptInput('');
    const userMsgId = `usr_${Date.now()}`;
    const assistantMsgId = `asst_${Date.now()}`;

    setMessages((prev) => [
      ...prev,
      {
        id: userMsgId,
        role: 'user',
        content: query,
        timestamp: new Date().toLocaleTimeString()
      },
      {
        id: assistantMsgId,
        role: 'assistant',
        content: '',
        isLoading: true,
        timestamp: new Date().toLocaleTimeString()
      }
    ]);

    setIsLoading(true);

    try {
      // Build context prompt with repository and active file
      const systemInstruction = `You are Namo Coder, an elite AI coding assistant operating inside a desktop IDE.
Active File: "${activeFilePath || 'None'}"
Active File Content:
\`\`\`
${activeFileContent ? activeFileContent.slice(0, 15000) : '// No active file'}
\`\`\`

When proposing code modifications or rewrites:
1. Provide a concise explanation.
2. Provide the full replacement code block in triple backticks with file language.
3. Be clean, deterministic, and verify syntax.`;

      // 1. Try backend coder agent endpoint first
      let fullText = '';
      try {
        const agentRes = await runCoderAgentQuery({
          prompt: query,
          conversationId: `coder_${Date.now()}`,
          provider: selectedModel,
          model: selectedModel,
          maxSteps: 6,
          dryRun: true
        });

        if (agentRes && agentRes.finalAnswer) {
          fullText = agentRes.finalAnswer;
          // Check if diff proposals exist
          if (Array.isArray(agentRes.diffProposals) && agentRes.diffProposals.length > 0) {
            const proposal = agentRes.diffProposals[0];
            onProposeDiff?.({
              filePath: proposal.path || activeFilePath,
              original: proposal.original || activeFileContent,
              modified: proposal.modified
            });
          }
        }
      } catch (_backendErr) {
        // Fallback to standard chat completion
      }

      if (!fullText) {
        await streamChatCompletion({
          messages: [
            {
              role: 'user',
              content: query
            }
          ],
          model: selectedModel,
          systemPrompt: systemInstruction,
          onChunk: (delta, accumulated) => {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMsgId
                  ? { ...m, content: accumulated, isLoading: false }
                  : m
              )
            );
          },
          onFinish: (completeText) => {
            fullText = completeText;
          }
        });
      } else {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsgId
              ? { ...m, content: fullText, isLoading: false }
              : m
          )
        );
      }

      // Check if message contains code block to propose diff
      const codeBlockMatch = fullText.match(/```(?:[a-zA-Z0-9_-]+)?\s*([\s\S]*?)```/);
      if (codeBlockMatch && codeBlockMatch[1] && activeFilePath) {
        const extractedCode = codeBlockMatch[1].trim();
        // Attach extracted proposal to message
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsgId
              ? { ...m, proposedCode: extractedCode }
              : m
          )
        );
      }
    } catch (err) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsgId
            ? {
                ...m,
                content: `⚠️ Request failed: ${err.message || 'Error communicating with AI model.'}`,
                isLoading: false
              }
            : m
        )
      );
    } finally {
      setIsLoading(false);
    }
  };

  const currentModelObj = CODER_MODELS.find((m) => m.id === selectedModel) || CODER_MODELS[0];

  return (
    <aside className="w-full h-full flex flex-col bg-[#0b0c0f] border-l border-zinc-800/80 font-mono text-xs select-none">
      {/* Top Header & Tab Switcher */}
      <div className="h-10 px-3 border-b border-zinc-800/80 flex items-center justify-between shrink-0 bg-[#0c0d10]">
        <div className="flex items-center space-x-1">
          <button
            onClick={() => setActiveTab('agent')}
            className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${
              activeTab === 'agent'
                ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
            }`}
          >
            <Bot className="w-3.5 h-3.5 text-emerald-400" />
            <span>AI Sidecar</span>
          </button>

          <button
            onClick={() => setActiveTab('checkpoints')}
            className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${
              activeTab === 'checkpoints'
                ? 'bg-purple-500/15 text-purple-300 border border-purple-500/30'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
            }`}
          >
            <History className="w-3.5 h-3.5 text-purple-400" />
            <span>Snapshots ({checkpoints.length})</span>
          </button>
        </div>

        {onClose && (
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
            title="Collapse AI Panel"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Model Selector Bar */}
      {activeTab === 'agent' && (
        <div className="px-3 py-1.5 border-b border-zinc-800/60 bg-zinc-950/60 flex items-center justify-between shrink-0 relative">
          <div className="flex items-center space-x-2">
            <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Model:</span>
            <div className="relative">
              <button
                onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
                className="flex items-center space-x-1 px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-200 text-xs font-semibold"
              >
                <span className={`w-1.5 h-1.5 rounded-full ${currentModelObj.color.replace('text-', 'bg-')}`} />
                <span className="truncate max-w-[130px]">{currentModelObj.name}</span>
                <ChevronDown className="w-3 h-3 text-zinc-400" />
              </button>

              {isModelDropdownOpen && (
                <div className="absolute left-0 mt-1 w-64 bg-[#14151a] border border-zinc-800 rounded-xl shadow-2xl p-1.5 z-50">
                  <div className="text-[10px] text-zinc-500 font-semibold px-2 py-1 uppercase tracking-wider">
                    Select AI Coder Provider
                  </div>
                  {CODER_MODELS.map((m) => (
                    <div
                      key={m.id}
                      onClick={() => {
                        setSelectedModel(m.id);
                        setIsModelDropdownOpen(false);
                      }}
                      className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors ${
                        selectedModel === m.id
                          ? 'bg-emerald-500/10 text-emerald-300 font-semibold border border-emerald-500/20'
                          : 'hover:bg-zinc-800/70 text-zinc-300'
                      }`}
                    >
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className={`w-1.5 h-1.5 rounded-full ${m.color.replace('text-', 'bg-')}`} />
                          <span className="text-xs">{m.name}</span>
                        </div>
                        <div className="text-[10px] text-zinc-500 mt-0.5">{m.provider}</div>
                      </div>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700">
                        {m.badge}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Context Pill */}
          <div className="flex items-center space-x-1 text-[10px] text-zinc-500 truncate max-w-[130px]">
            <FileCode className="w-3 h-3 text-emerald-400 shrink-0" />
            <span className="truncate">{activeFilePath ? activeFilePath.split('/').pop() : 'No file'}</span>
          </div>
        </div>
      )}

      {/* Main Tab Body */}
      {activeTab === 'agent' ? (
        /* AI Coder Agent Chat */
        <div className="flex-1 flex flex-col min-h-0">
          {/* Quick Action Pills */}
          <div className="p-2 border-b border-zinc-800/60 overflow-x-auto no-scrollbar flex items-center space-x-1.5 shrink-0 bg-zinc-950/30">
            {QUICK_ACTIONS.map((action) => {
              const Icon = action.icon;
              return (
                <button
                  key={action.id}
                  disabled={isLoading}
                  onClick={() => handleSendMessage(action.prompt)}
                  className="flex items-center space-x-1 px-2.5 py-1 rounded-full bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-emerald-500/40 text-zinc-300 hover:text-white text-[11px] font-medium shrink-0 transition-colors"
                >
                  <Icon className="w-3 h-3 text-emerald-400" />
                  <span>{action.label}</span>
                </button>
              );
            })}
          </div>

          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar select-text leading-relaxed">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col space-y-1 ${
                  msg.role === 'user' ? 'items-end' : 'items-start'
                }`}
              >
                <div className="flex items-center space-x-1.5 text-[10px] text-zinc-500">
                  <span className="font-semibold text-zinc-400">
                    {msg.role === 'user' ? 'You' : 'Namo Coder'}
                  </span>
                  <span>•</span>
                  <span>{msg.timestamp}</span>
                </div>

                <div
                  className={`p-3 rounded-xl max-w-[92%] leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-100'
                      : 'bg-[#121318] border border-zinc-800/80 text-zinc-200'
                  }`}
                >
                  {msg.isLoading ? (
                    <div className="flex items-center space-x-2 text-zinc-400">
                      <Sparkles className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                      <span>Reasoning & inspecting repository...</span>
                    </div>
                  ) : (
                    <div className="whitespace-pre-wrap font-sans text-xs leading-relaxed">
                      {msg.content}
                    </div>
                  )}

                  {/* Proposed Diff Action Pill */}
                  {msg.proposedCode && (
                    <div className="mt-3 pt-2.5 border-t border-zinc-800 flex items-center justify-between">
                      <span className="text-[10px] text-purple-400 font-mono font-semibold flex items-center gap-1">
                        <Code className="w-3 h-3" /> Code changes available
                      </span>
                      <button
                        onClick={() => {
                          onProposeDiff?.({
                            filePath: activeFilePath,
                            original: activeFileContent,
                            modified: msg.proposedCode
                          });
                        }}
                        className="px-2.5 py-1 bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/40 rounded-lg text-[10px] font-mono font-semibold transition-colors flex items-center gap-1"
                      >
                        <Wand2 className="w-3 h-3" />
                        <span>Review Diff in Editor</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>

          {/* Chat Input */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="p-2 border-t border-zinc-800/80 bg-[#0c0d10] flex items-center space-x-1.5 shrink-0"
          >
            <input
              type="text"
              value={promptInput}
              onChange={(e) => setPromptInput(e.target.value)}
              disabled={isLoading}
              placeholder="Ask Namo Coder to explain, write, or refactor..."
              className="flex-1 bg-zinc-900 text-zinc-100 placeholder-zinc-500 px-3 py-2 rounded-xl border border-zinc-800 focus:outline-none focus:border-emerald-500/60 font-sans text-xs transition-colors"
            />
            <button
              type="submit"
              disabled={!promptInput.trim() || isLoading}
              className="p-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-black font-semibold transition-all shrink-0"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      ) : (
        /* Checkpoints / Snapshot Manager */
        <div className="flex-1 flex flex-col min-h-0 p-3 space-y-3">
          {/* Header Action */}
          <div className="flex items-center justify-between">
            <span className="text-zinc-400 font-semibold text-xs">Repository Checkpoints</span>
            <button
              onClick={() => setIsNewCheckpointOpen(true)}
              className="flex items-center space-x-1 px-2.5 py-1 bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/40 rounded-lg text-xs font-semibold transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Snapshot</span>
            </button>
          </div>

          {/* Inline Create Form */}
          {isNewCheckpointOpen && (
            <div className="p-3 bg-zinc-900 border border-purple-500/40 rounded-xl space-y-2">
              <div className="text-[11px] font-semibold text-purple-300">New Workspace Snapshot</div>
              <input
                type="text"
                value={checkpointName}
                onChange={(e) => setCheckpointName(e.target.value)}
                placeholder="Snapshot Name (e.g. Before Auth Refactor)"
                className="w-full bg-black/60 text-xs text-zinc-100 px-2.5 py-1.5 rounded-lg border border-zinc-800 focus:outline-none focus:border-purple-500"
              />
              <input
                type="text"
                value={checkpointDesc}
                onChange={(e) => setCheckpointDesc(e.target.value)}
                placeholder="Optional description"
                className="w-full bg-black/60 text-xs text-zinc-100 px-2.5 py-1.5 rounded-lg border border-zinc-800 focus:outline-none focus:border-purple-500"
              />
              <div className="flex justify-end space-x-2 pt-1">
                <button
                  onClick={() => setIsNewCheckpointOpen(false)}
                  className="px-2.5 py-1 text-zinc-400 hover:text-zinc-200 text-xs"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    onCreateCheckpoint(checkpointName, checkpointDesc);
                    setIsNewCheckpointOpen(false);
                    setCheckpointName('');
                    setCheckpointDesc('');
                  }}
                  className="px-3 py-1 bg-purple-500 hover:bg-purple-400 text-black rounded-lg text-xs font-semibold"
                >
                  Save Snapshot
                </button>
              </div>
            </div>
          )}

          {/* List of Checkpoints */}
          <div className="flex-1 overflow-y-auto space-y-2 custom-scrollbar">
            {checkpoints.length === 0 ? (
              <div className="p-6 text-center text-zinc-500 text-xs">
                No snapshots created yet. Create one before making large AI edits to enable instant rollback.
              </div>
            ) : (
              checkpoints.map((cp) => (
                <div
                  key={cp.id}
                  className="p-3 bg-zinc-900/80 border border-zinc-800 rounded-xl hover:border-zinc-700 space-y-2 transition-all"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-semibold text-zinc-200 text-xs flex items-center gap-1.5">
                        <GitCommit className="w-3.5 h-3.5 text-purple-400" />
                        <span>{cp.name}</span>
                      </div>
                      <div className="text-[10px] text-zinc-500 mt-0.5">
                        {cp.createdAt ? new Date(cp.createdAt).toLocaleString() : 'Just now'} • {cp.fileCount || 1} files
                      </div>
                    </div>

                    <div className="flex items-center space-x-1">
                      <button
                        onClick={() => {
                          if (window.confirm(`Rollback workspace to snapshot "${cp.name}"?`)) {
                            onRollbackCheckpoint(cp.id);
                          }
                        }}
                        className="flex items-center space-x-1 px-2 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded text-[11px] font-semibold transition-colors"
                        title="Restore files to this snapshot"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Rollback</span>
                      </button>

                      {onDeleteCheckpoint && (
                        <button
                          onClick={() => onDeleteCheckpoint(cp.id)}
                          className="p-1 hover:bg-rose-500/20 text-zinc-500 hover:text-rose-400 rounded transition-colors"
                          title="Delete snapshot"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>

                  {cp.description && (
                    <p className="text-[11px] text-zinc-400 leading-relaxed">{cp.description}</p>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </aside>
  );
}
