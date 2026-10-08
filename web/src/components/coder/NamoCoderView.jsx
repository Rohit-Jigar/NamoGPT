import React, { useState, useEffect, useCallback } from 'react';
import {
  FolderTree,
  Terminal as TerminalIcon,
  Bot,
  Play,
  Save,
  RefreshCw,
  GitCompare,
  PanelLeft,
  PanelRight,
  Maximize2,
  CheckCircle,
  AlertTriangle,
  FolderOpen
} from 'lucide-react';

import FileExplorer from './FileExplorer';
import CodeEditor from './CodeEditor';
import TerminalPanel from './TerminalPanel';
import AiCoderPanel from './AiCoderPanel';

import {
  fetchCoderTree,
  readCoderFile,
  writeCoderFile,
  deleteCoderFile,
  runCoderTerminalCommand,
  fetchCoderCheckpoints,
  createCoderCheckpoint,
  rollbackCoderCheckpoint,
  deleteCoderCheckpoint,
  fetchCoderWorkspace
} from '../../services/api';

export default function NamoCoderView() {
  // Workspace and Tree State
  const [tree, setTree] = useState(null);
  const [workspaceRoot, setWorkspaceRoot] = useState('namo-project');
  const [isTreeLoading, setIsTreeLoading] = useState(true);

  // Editor State
  const [openFiles, setOpenFiles] = useState([]);
  const [activeFilePath, setActiveFilePath] = useState('');
  const [diffProposal, setDiffProposal] = useState(null);

  // Checkpoints State
  const [checkpoints, setCheckpoints] = useState([]);

  // Panel Collapsible State
  const [isExplorerOpen, setIsExplorerOpen] = useState(true);
  const [isTerminalOpen, setIsTerminalOpen] = useState(true);
  const [isAiPanelOpen, setIsAiPanelOpen] = useState(true);
  const [isTerminalMaximized, setIsTerminalMaximized] = useState(false);

  // Status Notification Banner
  const [statusMessage, setStatusMessage] = useState(null);

  const notify = (msg, type = 'success') => {
    setStatusMessage({ msg, type });
    setTimeout(() => setStatusMessage(null), 3500);
  };

  // Load Initial Workspace Data
  const loadWorkspace = useCallback(async () => {
    setIsTreeLoading(true);
    try {
      const [treeData, wsData, cpData] = await Promise.all([
        fetchCoderTree(),
        fetchCoderWorkspace(),
        fetchCoderCheckpoints()
      ]);

      if (treeData) setTree(treeData);
      if (wsData?.workspaceRoot) setWorkspaceRoot(wsData.workspaceRoot);
      if (Array.isArray(cpData)) setCheckpoints(cpData);

      // Open a default starter file if no file is open
      if (openFiles.length === 0) {
        const defaultPath = 'src/App.jsx';
        try {
          const fileRes = await readCoderFile(defaultPath);
          if (fileRes && fileRes.content !== undefined) {
            const initialFile = {
              path: fileRes.path || defaultPath,
              name: defaultPath.split('/').pop(),
              content: fileRes.content,
              originalContent: fileRes.content,
              isDirty: false
            };
            setOpenFiles([initialFile]);
            setActiveFilePath(initialFile.path);
          }
        } catch (_err) {
          // If default file doesn't exist, that's fine
        }
      }
    } catch (err) {
      console.warn('Failed to load workspace data:', err);
    } finally {
      setIsTreeLoading(false);
    }
  }, [openFiles.length]);

  useEffect(() => {
    loadWorkspace();
  }, [loadWorkspace]);

  // Handle File Selection from Explorer
  const handleSelectFile = async (filePath) => {
    // If file is already open, just switch active tab
    const existing = openFiles.find((f) => f.path === filePath);
    if (existing) {
      setActiveFilePath(filePath);
      return;
    }

    try {
      const fileData = await readCoderFile(filePath);
      const newFile = {
        path: fileData.path || filePath,
        name: filePath.split('/').pop(),
        content: fileData.content || '',
        originalContent: fileData.content || '',
        isDirty: false
      };
      setOpenFiles((prev) => [...prev, newFile]);
      setActiveFilePath(newFile.path);
    } catch (err) {
      notify(`Failed to read file: ${err.message}`, 'error');
    }
  };

  // Handle Tab Close
  const handleCloseTab = (filePath) => {
    const nextFiles = openFiles.filter((f) => f.path !== filePath);
    setOpenFiles(nextFiles);
    if (activeFilePath === filePath) {
      setActiveFilePath(nextFiles[nextFiles.length - 1]?.path || '');
    }
  };

  // Handle Code Content Changes in Editor
  const handleContentChange = (filePath, newContent) => {
    setOpenFiles((prev) =>
      prev.map((f) =>
        f.path === filePath
          ? {
              ...f,
              content: newContent,
              isDirty: newContent !== f.originalContent
            }
          : f
      )
    );
  };

  // Handle File Save
  const handleSaveFile = async (filePath) => {
    const fileToSave = openFiles.find((f) => f.path === filePath);
    if (!fileToSave) return;

    try {
      await writeCoderFile(filePath, fileToSave.content);
      setOpenFiles((prev) =>
        prev.map((f) =>
          f.path === filePath
            ? { ...f, originalContent: f.content, isDirty: false }
            : f
        )
      );
      notify(`Saved "${fileToSave.name}" successfully`);
    } catch (err) {
      notify(`Save failed: ${err.message}`, 'error');
    }
  };

  // Handle New File Creation
  const handleCreateFile = async (filePath) => {
    try {
      await writeCoderFile(filePath, '// New file\n');
      await loadWorkspace();
      await handleSelectFile(filePath);
      notify(`Created file "${filePath}"`);
    } catch (err) {
      notify(`Create file failed: ${err.message}`, 'error');
    }
  };

  // Handle New Folder Creation
  const handleCreateFolder = async (folderPath) => {
    try {
      // Create placeholder file inside folder to establish directory
      await writeCoderFile(`${folderPath}/.gitkeep`, '');
      await loadWorkspace();
      notify(`Created folder "${folderPath}"`);
    } catch (err) {
      notify(`Create folder failed: ${err.message}`, 'error');
    }
  };

  // Handle Delete File or Folder
  const handleDeletePath = async (filePath) => {
    try {
      await deleteCoderFile(filePath);
      handleCloseTab(filePath);
      await loadWorkspace();
      notify(`Deleted "${filePath}"`);
    } catch (err) {
      notify(`Delete failed: ${err.message}`, 'error');
    }
  };

  // Handle Terminal Execution
  const handleExecuteTerminalCommand = async (command) => {
    return await runCoderTerminalCommand(command, workspaceRoot);
  };

  // Checkpoints Handlers
  const handleCreateCheckpoint = async (name, description) => {
    try {
      const newCp = await createCoderCheckpoint({
        name,
        description,
        files: openFiles.map((f) => ({ path: f.path, content: f.content }))
      });
      setCheckpoints((prev) => [newCp, ...prev]);
      notify(`Checkpoint "${newCp.name}" created!`);
    } catch (err) {
      notify(`Failed to create checkpoint: ${err.message}`, 'error');
    }
  };

  const handleRollbackCheckpoint = async (checkpointId) => {
    try {
      await rollbackCoderCheckpoint(checkpointId);
      await loadWorkspace();
      // Reload open files
      if (activeFilePath) {
        const fileData = await readCoderFile(activeFilePath);
        handleContentChange(activeFilePath, fileData.content);
      }
      notify(`Restored workspace snapshot!`);
    } catch (err) {
      notify(`Rollback failed: ${err.message}`, 'error');
    }
  };

  const handleDeleteCheckpoint = async (checkpointId) => {
    try {
      await deleteCoderCheckpoint(checkpointId);
      setCheckpoints((prev) => prev.filter((cp) => cp.id !== checkpointId));
      notify('Snapshot deleted');
    } catch (err) {
      notify(`Delete failed: ${err.message}`, 'error');
    }
  };

  // Diff Handlers
  const handleProposeDiff = (proposal) => {
    setDiffProposal(proposal);
    notify(`AI proposed changes for "${proposal.filePath}". Click "Diff Review" to inspect.`);
  };

  const handleAcceptDiff = async (filePath, modified) => {
    handleContentChange(filePath, modified);
    await handleSaveFile(filePath);
    setDiffProposal(null);
    notify(`Applied and saved AI changes to "${filePath}"`);
  };

  const handleRejectDiff = (_filePath) => {
    setDiffProposal(null);
    notify('Discarded AI proposal');
  };

  // Active file content lookup
  const activeFileObj = openFiles.find((f) => f.path === activeFilePath);

  return (
    <div className="flex-1 flex flex-col h-full w-full bg-[#090a0d] overflow-hidden select-none">
      {/* IDE Sub-Header Action Bar */}
      <div className="h-11 px-3 bg-[#0d0e12] border-b border-zinc-800/80 flex items-center justify-between shrink-0 z-20">
        {/* Left: Brand & Workspace info */}
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-1.5 text-xs font-bold text-zinc-100 font-mono tracking-tight">
            <span className="p-1 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">⚡</span>
            <span className="hidden sm:inline">Namo Coder Studio</span>
          </div>

          <span className="text-zinc-600 hidden sm:inline">•</span>

          <div className="flex items-center space-x-1 text-xs text-zinc-400 font-mono">
            <FolderOpen className="w-3.5 h-3.5 text-amber-400" />
            <span className="truncate max-w-[120px] sm:max-w-[200px]">{workspaceRoot}</span>
          </div>

          <button
            onClick={loadWorkspace}
            disabled={isTreeLoading}
            className="p-1 rounded text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
            title="Reload Workspace"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isTreeLoading ? 'animate-spin text-emerald-400' : ''}`} />
          </button>
        </div>

        {/* Center: Save / Run Shortcuts */}
        <div className="flex items-center space-x-1.5">
          {activeFileObj && (
            <button
              onClick={() => handleSaveFile(activeFileObj.path)}
              disabled={!activeFileObj.isDirty}
              className={`flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs font-mono font-medium border transition-colors ${
                activeFileObj.isDirty
                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/25'
                  : 'bg-zinc-900/60 text-zinc-500 border-zinc-800 opacity-60'
              }`}
              title="Save File (Ctrl+S)"
            >
              <Save className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Save</span>
            </button>
          )}

          <button
            onClick={() => handleExecuteTerminalCommand('npm test')}
            className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-mono font-semibold transition-colors shadow-sm"
            title="Run Project Tests"
          >
            <Play className="w-3 h-3 fill-current" />
            <span>Run Tests</span>
          </button>
        </div>

        {/* Right: Panel Toggle Controls */}
        <div className="flex items-center space-x-1">
          {/* Toggle Explorer */}
          <button
            onClick={() => setIsExplorerOpen(!isExplorerOpen)}
            className={`p-1.5 rounded-lg border text-xs transition-colors ${
              isExplorerOpen
                ? 'bg-zinc-800 text-zinc-100 border-zinc-700'
                : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-zinc-200'
            }`}
            title="Toggle File Explorer"
          >
            <PanelLeft className="w-3.5 h-3.5" />
          </button>

          {/* Toggle Terminal */}
          <button
            onClick={() => setIsTerminalOpen(!isTerminalOpen)}
            className={`p-1.5 rounded-lg border text-xs transition-colors ${
              isTerminalOpen
                ? 'bg-zinc-800 text-zinc-100 border-zinc-700'
                : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-zinc-200'
            }`}
            title="Toggle Terminal"
          >
            <TerminalIcon className="w-3.5 h-3.5" />
          </button>

          {/* Toggle AI Sidecar */}
          <button
            onClick={() => setIsAiPanelOpen(!isAiPanelOpen)}
            className={`p-1.5 rounded-lg border text-xs transition-colors ${
              isAiPanelOpen
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-zinc-200'
            }`}
            title="Toggle AI Coder Sidecar"
          >
            <Bot className="w-3.5 h-3.5 text-emerald-400" />
          </button>
        </div>
      </div>

      {/* Floating Notification Toast */}
      {statusMessage && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
          <div
            className={`px-3 py-1.5 rounded-xl border text-xs font-mono shadow-2xl flex items-center space-x-2 ${
              statusMessage.type === 'error'
                ? 'bg-rose-950/90 text-rose-200 border-rose-500/40'
                : 'bg-emerald-950/90 text-emerald-200 border-emerald-500/40'
            }`}
          >
            {statusMessage.type === 'error' ? (
              <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
            ) : (
              <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
            )}
            <span>{statusMessage.msg}</span>
          </div>
        </div>
      )}

      {/* Main Workspace Layout (Left Explorer, Center Editor+Terminal, Right AI Panel) */}
      <div className="flex-1 flex min-h-0 w-full overflow-hidden relative">
        {/* 1. Left Panel: File Explorer */}
        {isExplorerOpen && (
          <div className="w-56 sm:w-64 h-full shrink-0 flex flex-col z-10 transition-all">
            <FileExplorer
              tree={tree}
              activeFilePath={activeFilePath}
              onSelectFile={handleSelectFile}
              onReloadTree={loadWorkspace}
              onCreateFile={handleCreateFile}
              onCreateFolder={handleCreateFolder}
              onDeletePath={handleDeletePath}
              isLoading={isTreeLoading}
            />
          </div>
        )}

        {/* 2. Center Panel: Code Editor + Terminal Panel */}
        <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
          {/* Top: Code Editor */}
          {!isTerminalMaximized && (
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
              <CodeEditor
                openFiles={openFiles}
                activeFilePath={activeFilePath}
                onSelectTab={setActiveFilePath}
                onCloseTab={handleCloseTab}
                onContentChange={handleContentChange}
                onSaveFile={handleSaveFile}
                diffProposal={diffProposal}
                onAcceptDiff={handleAcceptDiff}
                onRejectDiff={handleRejectDiff}
              />
            </div>
          )}

          {/* Bottom: Integrated Terminal */}
          <TerminalPanel
            cwd={workspaceRoot}
            onExecuteCommand={handleExecuteTerminalCommand}
            isOpen={isTerminalOpen}
            onToggleOpen={() => setIsTerminalOpen(!isTerminalOpen)}
            isMaximized={isTerminalMaximized}
            onToggleMaximize={() => setIsTerminalMaximized(!isTerminalMaximized)}
          />
        </div>

        {/* 3. Right Panel: AI Coder Agent Sidecar */}
        {isAiPanelOpen && (
          <div className="w-80 sm:w-96 h-full shrink-0 flex flex-col z-10 transition-all">
            <AiCoderPanel
              activeFilePath={activeFilePath}
              activeFileContent={activeFileObj?.content || ''}
              openFiles={openFiles}
              onProposeDiff={handleProposeDiff}
              checkpoints={checkpoints}
              onCreateCheckpoint={handleCreateCheckpoint}
              onRollbackCheckpoint={handleRollbackCheckpoint}
              onDeleteCheckpoint={handleDeleteCheckpoint}
              onClose={() => setIsAiPanelOpen(false)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
