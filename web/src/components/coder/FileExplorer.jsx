import React, { useState, useMemo } from 'react';
import {
  Folder,
  FolderOpen,
  File,
  FileCode,
  FileCode2,
  FileText,
  Braces,
  Image as ImageIcon,
  ChevronRight,
  ChevronDown,
  Plus,
  FolderPlus,
  RefreshCw,
  Search,
  X,
  Trash2,
  Terminal,
  FolderTree
} from 'lucide-react';

/**
 * Returns tailored Lucide icon for file types based on extension
 */
function getFileIcon(filename) {
  const ext = (filename || '').split('.').pop().toLowerCase();
  switch (ext) {
    case 'js':
    case 'jsx':
    case 'mjs':
      return <FileCode className="w-4 h-4 text-amber-400 shrink-0" />;
    case 'ts':
    case 'tsx':
      return <FileCode2 className="w-4 h-4 text-sky-400 shrink-0" />;
    case 'json':
      return <Braces className="w-4 h-4 text-emerald-400 shrink-0" />;
    case 'css':
    case 'scss':
    case 'html':
      return <FileCode className="w-4 h-4 text-cyan-400 shrink-0" />;
    case 'md':
    case 'markdown':
    case 'txt':
      return <FileText className="w-4 h-4 text-purple-400 shrink-0" />;
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'svg':
    case 'ico':
      return <ImageIcon className="w-4 h-4 text-pink-400 shrink-0" />;
    default:
      return <File className="w-4 h-4 text-zinc-400 shrink-0" />;
  }
}

/**
 * Recursive Tree Node component
 */
function TreeNode({
  node,
  depth = 0,
  activeFilePath,
  onSelectFile,
  onDeletePath,
  onCreateFileInFolder,
  onCreateFolderInFolder,
  filterQuery
}) {
  const [isOpen, setIsOpen] = useState(true);
  const [isHovered, setIsHovered] = useState(false);
  const isDirectory = node.type === 'directory';
  const isSelected = !isDirectory && activeFilePath === node.path;

  // Filter visibility: check if node matches or any child matches
  const isVisible = useMemo(() => {
    if (!filterQuery) return true;
    const q = filterQuery.toLowerCase();
    if (node.name.toLowerCase().includes(q)) return true;
    if (isDirectory && Array.isArray(node.children)) {
      const matchChild = (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.type === 'directory' && Array.isArray(c.children) && c.children.some(matchChild));
      return node.children.some(matchChild);
    }
    return false;
  }, [node, filterQuery, isDirectory]);

  if (!isVisible) return null;

  return (
    <div className="select-none text-xs font-mono">
      <div
        style={{ paddingLeft: `${Math.max(4, depth * 14 + 6)}px` }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={() => {
          if (isDirectory) {
            setIsOpen(!isOpen);
          } else {
            onSelectFile(node.path);
          }
        }}
        className={`group flex items-center justify-between py-1.5 pr-2 rounded-lg cursor-pointer transition-colors relative ${
          isSelected
            ? 'bg-emerald-500/15 text-emerald-300 font-semibold border-l-2 border-emerald-400 pl-[10px]'
            : isHovered
            ? 'bg-zinc-800/60 text-zinc-200'
            : 'text-zinc-400 hover:text-zinc-200'
        }`}
      >
        <div className="flex items-center space-x-1.5 min-w-0 flex-1 truncate">
          {isDirectory ? (
            <>
              {isOpen ? (
                <ChevronDown className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
              )}
              {isOpen ? (
                <FolderOpen className="w-4 h-4 text-amber-400 shrink-0" />
              ) : (
                <Folder className="w-4 h-4 text-amber-400/80 shrink-0" />
              )}
            </>
          ) : (
            <>
              <span className="w-3.5 shrink-0" />
              {getFileIcon(node.name)}
            </>
          )}

          <span className="truncate">{node.name}</span>
        </div>

        {/* Node Hover Actions */}
        {isHovered && (
          <div
            className="flex items-center space-x-1 shrink-0 ml-1"
            onClick={(e) => e.stopPropagation()}
          >
            {isDirectory && (
              <>
                <button
                  onClick={() => onCreateFileInFolder(node.path)}
                  className="p-1 rounded hover:bg-zinc-700 text-zinc-400 hover:text-emerald-400 transition-colors"
                  title="New File inside folder"
                >
                  <Plus className="w-3 h-3" />
                </button>
                <button
                  onClick={() => onCreateFolderInFolder(node.path)}
                  className="p-1 rounded hover:bg-zinc-700 text-zinc-400 hover:text-amber-400 transition-colors"
                  title="New Folder inside folder"
                >
                  <FolderPlus className="w-3 h-3" />
                </button>
              </>
            )}
            {node.path !== '.' && node.path !== '/' && (
              <button
                onClick={() => {
                  if (window.confirm(`Delete "${node.name}"?`)) {
                    onDeletePath(node.path);
                  }
                }}
                className="p-1 rounded hover:bg-rose-500/20 text-zinc-400 hover:text-rose-400 transition-colors"
                title={`Delete ${isDirectory ? 'folder' : 'file'}`}
              >
                <Trash2 className="w-3 h-3" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Children */}
      {isDirectory && isOpen && Array.isArray(node.children) && (
        <div className="flex flex-col">
          {node.children.map((child) => (
            <TreeNode
              key={child.path || child.name}
              node={child}
              depth={depth + 1}
              activeFilePath={activeFilePath}
              onSelectFile={onSelectFile}
              onDeletePath={onDeletePath}
              onCreateFileInFolder={onCreateFileInFolder}
              onCreateFolderInFolder={onCreateFolderInFolder}
              filterQuery={filterQuery}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function FileExplorer({
  tree,
  activeFilePath,
  onSelectFile,
  onReloadTree,
  onCreateFile,
  onCreateFolder,
  onDeletePath,
  isLoading = false
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [inlineCreateType, setInlineCreateType] = useState(null); // 'file' | 'folder' | null
  const [targetParentDir, setTargetParentDir] = useState('');
  const [newItemName, setNewItemName] = useState('');

  const handleStartCreate = (type, parentDir = '') => {
    setInlineCreateType(type);
    setTargetParentDir(parentDir);
    setNewItemName('');
  };

  const handleConfirmCreate = (e) => {
    e?.preventDefault();
    const cleanName = newItemName.trim();
    if (!cleanName) {
      setInlineCreateType(null);
      return;
    }

    const fullPath = targetParentDir
      ? `${targetParentDir.replace(/\/$/, '')}/${cleanName}`
      : cleanName;

    if (inlineCreateType === 'file') {
      onCreateFile(fullPath);
    } else if (inlineCreateType === 'folder') {
      onCreateFolder(fullPath);
    }

    setInlineCreateType(null);
    setNewItemName('');
  };

  return (
    <aside className="w-full h-full flex flex-col bg-[#0c0d10] border-r border-zinc-800/80 select-none">
      {/* Top Header & Toolbar */}
      <div className="h-10 px-3 border-b border-zinc-800/80 flex items-center justify-between shrink-0 bg-[#0c0d10]/90">
        <div className="flex items-center space-x-1.5 text-xs font-semibold text-zinc-300 uppercase tracking-wider">
          <FolderTree className="w-3.5 h-3.5 text-emerald-400" />
          <span>Explorer</span>
        </div>

        <div className="flex items-center space-x-1">
          <button
            onClick={() => handleStartCreate('file')}
            className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-emerald-400 transition-colors"
            title="New File in Root"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => handleStartCreate('folder')}
            className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-amber-400 transition-colors"
            title="New Folder in Root"
          >
            <FolderPlus className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onReloadTree}
            disabled={isLoading}
            className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
            title="Reload Workspace Tree"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-emerald-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div className="p-2 border-b border-zinc-800/60 shrink-0">
        <div className="relative flex items-center">
          <Search className="w-3.5 h-3.5 absolute left-2.5 text-zinc-500 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search files..."
            className="w-full bg-zinc-900/90 text-xs text-zinc-200 placeholder-zinc-500 pl-8 pr-7 py-1.5 rounded-lg border border-zinc-800 focus:outline-none focus:border-emerald-500/60 font-mono transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 text-zinc-500 hover:text-zinc-300"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Inline Item Creation Prompt */}
      {inlineCreateType && (
        <form onSubmit={handleConfirmCreate} className="p-2 bg-zinc-900/80 border-b border-zinc-800 shrink-0">
          <div className="text-[10px] text-zinc-400 font-mono mb-1 flex items-center gap-1">
            {inlineCreateType === 'file' ? <File className="w-3 h-3 text-emerald-400" /> : <Folder className="w-3 h-3 text-amber-400" />}
            <span>New {inlineCreateType} {targetParentDir ? `in ${targetParentDir}` : 'in root'}:</span>
          </div>
          <div className="flex items-center space-x-1">
            <input
              type="text"
              autoFocus
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              placeholder={inlineCreateType === 'file' ? 'example.js' : 'folder-name'}
              className="flex-1 bg-black/60 text-xs text-zinc-100 px-2 py-1 rounded border border-emerald-500/50 font-mono focus:outline-none"
              onKeyDown={(e) => {
                if (e.key === 'Escape') setInlineCreateType(null);
              }}
            />
            <button
              type="submit"
              className="px-2 py-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/40 rounded text-xs font-mono"
            >
              Add
            </button>
            <button
              type="button"
              onClick={() => setInlineCreateType(null)}
              className="p-1 text-zinc-500 hover:text-zinc-300"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </form>
      )}

      {/* Directory Tree View */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-1.5 space-y-0.5 custom-scrollbar">
        {isLoading && !tree ? (
          <div className="p-4 text-center text-zinc-500 text-xs font-mono flex flex-col items-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-emerald-400" />
            <span>Scanning workspace...</span>
          </div>
        ) : tree ? (
          <TreeNode
            node={tree}
            depth={0}
            activeFilePath={activeFilePath}
            onSelectFile={onSelectFile}
            onDeletePath={onDeletePath}
            onCreateFileInFolder={(dir) => handleStartCreate('file', dir)}
            onCreateFolderInFolder={(dir) => handleStartCreate('folder', dir)}
            filterQuery={searchQuery}
          />
        ) : (
          <div className="p-4 text-center text-zinc-500 text-xs font-mono">
            No files found in workspace
          </div>
        )}
      </div>

      {/* Bottom Workspace Status */}
      <div className="h-7 px-3 border-t border-zinc-800/60 bg-[#0a0a0c] flex items-center justify-between text-[11px] font-mono text-zinc-500 shrink-0">
        <span className="truncate">Workspace: {tree?.name || 'Local'}</span>
        <span className="text-[10px] text-emerald-400/80">Local-First</span>
      </div>
    </aside>
  );
}
