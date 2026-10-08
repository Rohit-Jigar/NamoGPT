import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  FileCode,
  FileCode2,
  FileText,
  Braces,
  File,
  X,
  Save,
  GitCompare,
  Check,
  RotateCcw,
  Columns2,
  AlignLeft,
  Copy,
  Code
} from 'lucide-react';

/**
 * Detect language based on file extension
 */
function detectLanguage(path) {
  if (!path) return 'Plain Text';
  const ext = path.split('.').pop().toLowerCase();
  switch (ext) {
    case 'js': return 'JavaScript';
    case 'jsx': return 'JavaScript (React)';
    case 'ts': return 'TypeScript';
    case 'tsx': return 'TypeScript (React)';
    case 'json': return 'JSON';
    case 'css': return 'CSS';
    case 'scss': return 'SCSS';
    case 'html': return 'HTML';
    case 'md': case 'markdown': return 'Markdown';
    case 'py': return 'Python';
    case 'sh': case 'bash': return 'Shell';
    case 'sql': return 'SQL';
    case 'yaml': case 'yml': return 'YAML';
    default: return 'Plain Text';
  }
}

/**
 * Custom line-by-line diff calculator
 */
function computeLineDiff(original = '', modified = '') {
  const origLines = original.split(/\r?\n/);
  const modLines = modified.split(/\r?\n/);
  const diff = [];
  const maxLines = Math.max(origLines.length, modLines.length);

  for (let i = 0; i < maxLines; i++) {
    const o = origLines[i];
    const m = modLines[i];

    if (o === undefined) {
      diff.push({ type: 'add', oldLine: null, newLine: i + 1, content: m });
    } else if (m === undefined) {
      diff.push({ type: 'remove', oldLine: i + 1, newLine: null, content: o });
    } else if (o !== m) {
      diff.push({ type: 'remove', oldLine: i + 1, newLine: null, content: o });
      diff.push({ type: 'add', oldLine: null, newLine: i + 1, content: m });
    } else {
      diff.push({ type: 'keep', oldLine: i + 1, newLine: i + 1, content: o });
    }
  }

  const additions = diff.filter(d => d.type === 'add').length;
  const deletions = diff.filter(d => d.type === 'remove').length;

  return { diff, additions, deletions };
}

export default function CodeEditor({
  openFiles = [],
  activeFilePath = '',
  onSelectTab,
  onCloseTab,
  onContentChange,
  onSaveFile,
  diffProposal = null,
  onAcceptDiff,
  onRejectDiff
}) {
  const [isDiffMode, setIsDiffMode] = useState(false);
  const [diffViewType, setDiffViewType] = useState('unified'); // 'unified' | 'split'
  const [cursorPos, setCursorPos] = useState({ line: 1, col: 1 });
  const [copied, setCopied] = useState(false);

  const textareaRef = useRef(null);
  const gutterRef = useRef(null);

  // Active file object
  const activeFile = useMemo(() => {
    return openFiles.find(f => f.path === activeFilePath) || openFiles[0] || null;
  }, [openFiles, activeFilePath]);

  // Synchronize scroll between gutter and textarea
  const handleScroll = () => {
    if (textareaRef.current && gutterRef.current) {
      gutterRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  };

  // Cursor position tracking
  const handleCursorMove = () => {
    if (!textareaRef.current || !activeFile) return;
    const text = activeFile.content || '';
    const selStart = textareaRef.current.selectionStart || 0;
    const textUpToCursor = text.substring(0, selStart);
    const lines = textUpToCursor.split('\n');
    setCursorPos({
      line: lines.length,
      col: (lines[lines.length - 1] || '').length + 1
    });
  };

  // Keyboard shortcut listener: Ctrl+S to save, Tab to indent
  const handleKeyDown = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      if (activeFile) {
        onSaveFile(activeFile.path);
      }
    }

    if (e.key === 'Tab') {
      e.preventDefault();
      const ta = textareaRef.current;
      if (!ta || !activeFile) return;

      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const val = activeFile.content || '';

      // Insert 2 spaces
      const updated = val.substring(0, start) + '  ' + val.substring(end);
      onContentChange(activeFile.path, updated);

      // Restore cursor position
      setTimeout(() => {
        ta.selectionStart = ta.selectionEnd = start + 2;
      }, 0);
    }
  };

  // Auto-switch to diff mode when a diff proposal is received
  useEffect(() => {
    if (diffProposal && diffProposal.filePath === activeFilePath) {
      setIsDiffMode(true);
    }
  }, [diffProposal, activeFilePath]);

  // Compute diff when in diff mode
  const diffData = useMemo(() => {
    if (!activeFile) return null;
    const original = diffProposal?.original !== undefined ? diffProposal.original : (activeFile.originalContent || activeFile.content || '');
    const modified = diffProposal?.modified !== undefined ? diffProposal.modified : (activeFile.content || '');
    return computeLineDiff(original, modified);
  }, [activeFile, diffProposal]);

  const linesCount = useMemo(() => {
    return (activeFile?.content || '').split('\n').length;
  }, [activeFile?.content]);

  // Copy code to clipboard
  const handleCopyCode = () => {
    if (!activeFile?.content) return;
    navigator.clipboard.writeText(activeFile.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!activeFile) {
    return (
      <div className="flex-1 h-full bg-[#0d0e12] flex flex-col items-center justify-center text-zinc-500 font-mono select-none">
        <Code className="w-12 h-12 text-zinc-700 mb-3" />
        <p className="text-sm font-semibold text-zinc-400">No File Open</p>
        <p className="text-xs text-zinc-600 mt-1">Select a file from the explorer or ask AI to create one</p>
      </div>
    );
  }

  return (
    <div className="flex-1 h-full flex flex-col bg-[#0d0e12] min-w-0 select-none overflow-hidden">
      {/* Multi-Tab Bar */}
      <div className="h-10 bg-[#090a0d] border-b border-zinc-800/80 flex items-center justify-between shrink-0 px-2 overflow-x-auto no-scrollbar">
        {/* Tabs */}
        <div className="flex items-center space-x-1 min-w-0">
          {openFiles.map((file) => {
            const isActive = file.path === activeFilePath;
            return (
              <div
                key={file.path}
                onClick={() => onSelectTab(file.path)}
                className={`group flex items-center space-x-2 px-3 py-1.5 rounded-t-lg border-t-2 text-xs font-mono cursor-pointer transition-all ${
                  isActive
                    ? 'bg-[#0d0e12] border-emerald-500 text-zinc-100 font-medium'
                    : 'bg-zinc-900/40 border-transparent text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
                }`}
              >
                <FileCode className={`w-3.5 h-3.5 ${isActive ? 'text-emerald-400' : 'text-zinc-500'}`} />
                <span className="truncate max-w-[140px]">{file.name || file.path.split('/').pop()}</span>
                {file.isDirty && (
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" title="Unsaved changes" />
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onCloseTab(file.path);
                  }}
                  className="p-0.5 rounded hover:bg-zinc-700/60 text-zinc-500 hover:text-zinc-200 opacity-60 group-hover:opacity-100 transition-opacity"
                  title="Close tab"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            );
          })}
        </div>

        {/* Tab Right Action Bar */}
        <div className="flex items-center space-x-1 shrink-0 ml-2">
          {/* Diff Mode Toggle Pill */}
          <button
            onClick={() => setIsDiffMode(!isDiffMode)}
            className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-md text-xs font-mono font-medium border transition-colors ${
              isDiffMode
                ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                : diffProposal
                ? 'bg-purple-500/10 text-purple-400 border-purple-500/20 animate-pulse'
                : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-zinc-200'
            }`}
            title="Toggle Diff View"
          >
            <GitCompare className="w-3.5 h-3.5" />
            <span>Diff {diffProposal ? '(AI Proposal)' : ''}</span>
          </button>

          {/* Copy Button */}
          <button
            onClick={handleCopyCode}
            className="p-1.5 rounded-md text-zinc-400 hover:text-white bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 transition-colors"
            title="Copy code"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>

          {/* Save Button */}
          <button
            onClick={() => onSaveFile(activeFile.path)}
            disabled={!activeFile.isDirty}
            className={`flex items-center space-x-1 px-2.5 py-1 rounded-md text-xs font-mono font-semibold transition-all ${
              activeFile.isDirty
                ? 'bg-emerald-500 text-black hover:bg-emerald-400 shadow-sm'
                : 'bg-zinc-800/60 text-zinc-500 border border-zinc-800 cursor-not-allowed'
            }`}
            title="Save file (Ctrl+S)"
          >
            <Save className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Save</span>
          </button>
        </div>
      </div>

      {/* Diff Review Action Toolbar (Only shown when diff mode is active) */}
      {isDiffMode && (
        <div className="px-3 py-2 bg-purple-950/20 border-b border-purple-500/30 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3 text-xs font-mono">
            <span className="font-semibold text-purple-300 flex items-center gap-1.5">
              <GitCompare className="w-4 h-4 text-purple-400" />
              Diff Review Mode
            </span>
            {diffData && (
              <span className="flex items-center space-x-2 text-[11px]">
                <span className="text-emerald-400 font-semibold">+{diffData.additions}</span>
                <span className="text-rose-400 font-semibold">-{diffData.deletions}</span>
              </span>
            )}
            <div className="flex items-center bg-black/40 rounded-lg p-0.5 border border-zinc-800">
              <button
                onClick={() => setDiffViewType('unified')}
                className={`px-2 py-0.5 rounded text-[11px] font-mono ${
                  diffViewType === 'unified' ? 'bg-purple-600/30 text-purple-200' : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                Unified
              </button>
              <button
                onClick={() => setDiffViewType('split')}
                className={`px-2 py-0.5 rounded text-[11px] font-mono ${
                  diffViewType === 'split' ? 'bg-purple-600/30 text-purple-200' : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                Split
              </button>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => {
                if (diffProposal) {
                  onAcceptDiff(diffProposal.filePath, diffProposal.modified);
                }
                setIsDiffMode(false);
              }}
              className="flex items-center space-x-1 px-3 py-1 bg-emerald-500 hover:bg-emerald-400 text-black rounded-lg text-xs font-mono font-semibold transition-colors"
            >
              <Check className="w-3.5 h-3.5 stroke-[3]" />
              <span>Accept Changes</span>
            </button>
            <button
              onClick={() => {
                if (diffProposal) {
                  onRejectDiff(diffProposal.filePath);
                }
                setIsDiffMode(false);
              }}
              className="flex items-center space-x-1 px-2.5 py-1 bg-zinc-800 hover:bg-rose-500/20 text-zinc-300 hover:text-rose-300 rounded-lg text-xs font-mono border border-zinc-700 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reject</span>
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area: Normal Editor or Diff View */}
      <div className="flex-1 relative flex overflow-hidden min-h-0 bg-[#0d0e12]">
        {isDiffMode ? (
          /* Diff Mode View */
          <div className="flex-1 overflow-auto font-mono text-xs p-2 custom-scrollbar">
            {diffViewType === 'unified' ? (
              /* Unified Diff */
              <div className="space-y-0.5">
                {diffData?.diff.map((item, idx) => (
                  <div
                    key={idx}
                    className={`flex items-start px-2 py-0.5 rounded leading-relaxed select-text ${
                      item.type === 'add'
                        ? 'bg-emerald-950/30 text-emerald-300 border-l-2 border-emerald-500'
                        : item.type === 'remove'
                        ? 'bg-rose-950/30 text-rose-300 border-l-2 border-rose-500 line-through opacity-85'
                        : 'text-zinc-400 hover:bg-zinc-800/30'
                    }`}
                  >
                    <span className="w-8 shrink-0 text-zinc-600 text-right pr-2 select-none">
                      {item.type === 'remove' ? item.oldLine : item.newLine || ''}
                    </span>
                    <span className="w-4 shrink-0 font-bold select-none">
                      {item.type === 'add' ? '+' : item.type === 'remove' ? '-' : ' '}
                    </span>
                    <pre className="flex-1 font-mono whitespace-pre-wrap break-all">{item.content}</pre>
                  </div>
                ))}
              </div>
            ) : (
              /* Side-by-Side Split Diff */
              <div className="grid grid-cols-2 gap-2 h-full">
                <div className="border border-zinc-800/80 rounded-lg p-2 bg-black/40 overflow-auto">
                  <div className="text-[11px] font-bold text-rose-400 mb-2 border-b border-zinc-800 pb-1">Original</div>
                  <pre className="text-zinc-400 whitespace-pre font-mono leading-relaxed">
                    {diffProposal?.original || activeFile.originalContent || activeFile.content}
                  </pre>
                </div>
                <div className="border border-zinc-800/80 rounded-lg p-2 bg-black/40 overflow-auto">
                  <div className="text-[11px] font-bold text-emerald-400 mb-2 border-b border-zinc-800 pb-1">Proposed (AI Modified)</div>
                  <pre className="text-zinc-200 whitespace-pre font-mono leading-relaxed">
                    {diffProposal?.modified || activeFile.content}
                  </pre>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Code Editor (Gutter + Textarea) */
          <div className="flex-1 flex min-h-0 relative select-text">
            {/* Line Numbers Gutter */}
            <div
              ref={gutterRef}
              className="w-12 py-3 bg-[#0a0b0e] border-r border-zinc-800/60 overflow-hidden select-none text-right pr-3 font-mono text-xs text-zinc-600 leading-6 shrink-0"
            >
              {Array.from({ length: Math.max(linesCount, 1) }).map((_, idx) => (
                <div key={idx} className={cursorPos.line === idx + 1 ? 'text-emerald-400 font-semibold' : ''}>
                  {idx + 1}
                </div>
              ))}
            </div>

            {/* Editable Monospace Textarea */}
            <textarea
              ref={textareaRef}
              value={activeFile.content || ''}
              onChange={(e) => onContentChange(activeFile.path, e.target.value)}
              onScroll={handleScroll}
              onKeyUp={handleCursorMove}
              onClick={handleCursorMove}
              onKeyDown={handleKeyDown}
              spellCheck={false}
              autoCapitalize="off"
              autoComplete="off"
              autoCorrect="off"
              className="flex-1 h-full py-3 px-4 bg-transparent text-zinc-100 font-mono text-xs sm:text-sm leading-6 resize-none focus:outline-none custom-scrollbar whitespace-pre tab-size-2"
              style={{ tabSize: 2 }}
              placeholder="// Write or edit code here..."
            />
          </div>
        )}
      </div>

      {/* Editor Status Bar */}
      <footer className="h-6 px-3 bg-[#090a0d] border-t border-zinc-800/70 flex items-center justify-between text-[11px] font-mono text-zinc-500 shrink-0 select-none">
        <div className="flex items-center space-x-3">
          <span className="text-emerald-400 font-semibold">{detectLanguage(activeFile.path)}</span>
          <span>•</span>
          <span>Ln {cursorPos.line}, Col {cursorPos.col}</span>
          <span>•</span>
          <span>{linesCount} lines</span>
        </div>

        <div className="flex items-center space-x-3">
          <span>UTF-8</span>
          <span>•</span>
          <span>Spaces: 2</span>
          <span>•</span>
          <span className="text-zinc-400">{activeFile.path}</span>
        </div>
      </footer>
    </div>
  );
}
