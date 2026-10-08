import React, { useState, useRef, useEffect } from 'react';
import {
  Terminal as TerminalIcon,
  Trash2,
  Play,
  Maximize2,
  Minimize2,
  ChevronDown,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles
} from 'lucide-react';

export default function TerminalPanel({
  cwd = 'namo-project',
  onExecuteCommand,
  isOpen = true,
  onToggleOpen,
  isMaximized = false,
  onToggleMaximize
}) {
  const [logs, setLogs] = useState([
    {
      id: 'init_welcome',
      command: 'namo-coder --version',
      cwd,
      stdout: 'Namo Coder Studio v2.0.0 [Local AI + OmniRouter Runtime]\nType commands or click quick actions below.\n',
      stderr: '',
      exitCode: 0,
      executionTimeMs: 10,
      timestamp: new Date().toLocaleTimeString()
    }
  ]);

  const [inputCommand, setInputCommand] = useState('');
  const [history, setHistory] = useState(['namo-coder --version']);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [isExecuting, setIsExecuting] = useState(false);

  const terminalEndRef = useRef(null);
  const inputRef = useRef(null);

  // Auto-scroll to bottom on new log
  useEffect(() => {
    if (isOpen) {
      terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, isOpen]);

  // Handle Command Submit
  const handleSubmit = async (e) => {
    e?.preventDefault();
    const cleanCmd = inputCommand.trim();
    if (!cleanCmd || isExecuting) return;

    // Add to history
    setHistory((prev) => [...prev, cleanCmd]);
    setHistoryIndex(-1);
    setInputCommand('');
    setIsExecuting(true);

    const logEntry = {
      id: `cmd_${Date.now()}`,
      command: cleanCmd,
      cwd,
      stdout: '',
      stderr: '',
      exitCode: null,
      executionTimeMs: null,
      timestamp: new Date().toLocaleTimeString(),
      isRunning: true
    };

    setLogs((prev) => [...prev, logEntry]);

    try {
      const result = await onExecuteCommand(cleanCmd);
      setLogs((prev) =>
        prev.map((l) =>
          l.id === logEntry.id
            ? {
                ...l,
                stdout: result?.stdout || '',
                stderr: result?.stderr || '',
                exitCode: result?.exitCode ?? (result?.success ? 0 : 1),
                executionTimeMs: result?.executionTimeMs ?? 20,
                isRunning: false
              }
            : l
        )
      );
    } catch (err) {
      setLogs((prev) =>
        prev.map((l) =>
          l.id === logEntry.id
            ? {
                ...l,
                stderr: err.message || 'Execution failed',
                exitCode: 1,
                executionTimeMs: 5,
                isRunning: false
              }
            : l
        )
      );
    } finally {
      setIsExecuting(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  // History Navigation: Up / Down arrows
  const handleKeyDown = (e) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (history.length === 0) return;
      const nextIdx = historyIndex === -1 ? history.length - 1 : Math.max(0, historyIndex - 1);
      setHistoryIndex(nextIdx);
      setInputCommand(history[nextIdx] || '');
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex === -1) return;
      const nextIdx = historyIndex + 1;
      if (nextIdx >= history.length) {
        setHistoryIndex(-1);
        setInputCommand('');
      } else {
        setHistoryIndex(nextIdx);
        setInputCommand(history[nextIdx] || '');
      }
    }
  };

  // Quick Action Run
  const handleQuickRun = (cmd) => {
    setInputCommand(cmd);
    setTimeout(() => {
      inputRef.current?.focus();
    }, 0);
  };

  if (!isOpen) return null;

  return (
    <div
      className={`flex flex-col bg-[#08090b] border-t border-zinc-800/90 text-xs font-mono select-text transition-all ${
        isMaximized ? 'h-full' : 'h-64 sm:h-72'
      }`}
    >
      {/* Terminal Title Bar */}
      <div className="h-9 px-3 bg-[#0c0d10] border-b border-zinc-800/80 flex items-center justify-between shrink-0 select-none">
        <div className="flex items-center space-x-2">
          <TerminalIcon className="w-3.5 h-3.5 text-emerald-400" />
          <span className="font-semibold text-zinc-300">Terminal</span>
          <span className="text-[10px] text-zinc-500 font-mono">({cwd})</span>
        </div>

        {/* Quick Action Chips & Controls */}
        <div className="flex items-center space-x-1.5">
          <div className="hidden md:flex items-center space-x-1 mr-2">
            {['npm test', 'git status', 'npm run build', 'ls'].map((cmd) => (
              <button
                key={cmd}
                onClick={() => handleQuickRun(cmd)}
                className="px-2 py-0.5 rounded bg-zinc-800/70 hover:bg-zinc-700/80 text-[10px] text-zinc-400 hover:text-zinc-200 transition-colors border border-zinc-700/50"
              >
                {cmd}
              </button>
            ))}
          </div>

          <button
            onClick={() => setLogs([])}
            className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
            title="Clear Terminal Output"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>

          {onToggleMaximize && (
            <button
              onClick={onToggleMaximize}
              className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
              title={isMaximized ? 'Restore Terminal' : 'Maximize Terminal'}
            >
              {isMaximized ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            </button>
          )}

          {onToggleOpen && (
            <button
              onClick={onToggleOpen}
              className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
              title="Collapse Terminal"
            >
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Terminal Output Area */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar font-mono leading-relaxed bg-[#08090b]">
        {logs.map((log) => (
          <div key={log.id} className="space-y-1">
            {/* Command Header line */}
            <div className="flex items-center justify-between text-[11px] text-zinc-400">
              <div className="flex items-center space-x-1.5 truncate">
                <span className="text-emerald-400 font-bold">namo@coder:~$</span>
                <span className="text-zinc-100 font-semibold truncate">{log.command}</span>
              </div>

              <div className="flex items-center space-x-2 shrink-0 text-[10px]">
                {log.isRunning ? (
                  <span className="text-amber-400 flex items-center gap-1 animate-pulse">
                    <Clock className="w-3 h-3" /> running...
                  </span>
                ) : (
                  <>
                    {log.executionTimeMs !== null && (
                      <span className="text-zinc-500">{log.executionTimeMs}ms</span>
                    )}
                    {log.exitCode === 0 ? (
                      <span className="px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-0.5">
                        <CheckCircle2 className="w-2.5 h-2.5" /> 0
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.2 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center gap-0.5">
                        <AlertCircle className="w-2.5 h-2.5" /> {log.exitCode ?? 1}
                      </span>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* stdout (zinc-200) */}
            {log.stdout && (
              <pre className="text-zinc-200 whitespace-pre-wrap pl-3 border-l-2 border-zinc-800/60 font-mono text-xs">
                {log.stdout}
              </pre>
            )}

            {/* stderr (rose-400) */}
            {log.stderr && (
              <pre className="text-rose-400 whitespace-pre-wrap pl-3 border-l-2 border-rose-500/40 font-mono text-xs">
                {log.stderr}
              </pre>
            )}
          </div>
        ))}
        <div ref={terminalEndRef} />
      </div>

      {/* Terminal Input Line */}
      <form
        onSubmit={handleSubmit}
        className="px-3 py-2 bg-[#0a0b0e] border-t border-zinc-800/70 flex items-center space-x-2 shrink-0"
      >
        <span className="text-emerald-400 font-bold shrink-0">namo@coder:~$</span>
        <input
          ref={inputRef}
          type="text"
          value={inputCommand}
          onChange={(e) => setInputCommand(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isExecuting}
          placeholder={isExecuting ? 'Running command...' : 'Type shell command (e.g. npm test, ls, git status)...'}
          className="flex-1 bg-transparent text-zinc-100 placeholder-zinc-600 focus:outline-none font-mono text-xs"
        />
        <button
          type="submit"
          disabled={!inputCommand.trim() || isExecuting}
          className="p-1 rounded hover:bg-emerald-500/20 text-zinc-400 hover:text-emerald-400 disabled:opacity-40 transition-colors"
        >
          <Play className="w-3.5 h-3.5 fill-current" />
        </button>
      </form>
    </div>
  );
}
