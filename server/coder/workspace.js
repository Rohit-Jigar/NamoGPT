/**
 * Namo Coder - Workspace Sandbox & Filesystem Engine
 * 
 * Manages project workspace operations, directory trees, file read/write,
 * and enforces strict sandbox security preventing path traversal attacks.
 */

import path from 'path';
import fs from 'fs';
import { promises as fsp } from 'fs';

// Default workspace root configuration
let currentWorkspaceRoot = process.env.NAMO_WORKSPACE_ROOT
  ? path.resolve(process.env.NAMO_WORKSPACE_ROOT)
  : (process.cwd().endsWith('server') ? path.resolve(process.cwd(), '..') : path.resolve(process.cwd()));

// Default ignore patterns for indexing and directory traversal
export const DEFAULT_IGNORE_PATTERNS = [
  '.git',
  'node_modules',
  '.next',
  'dist',
  'build',
  'out',
  '.checkpoints',
  '.cache',
  'coverage',
  '.env',
  '.env.local',
  '.DS_Store',
  'Thumbs.db'
];

/**
 * Get the current active workspace root path.
 * @returns {string} Absolute normalized workspace path.
 */
export function getWorkspaceRoot() {
  return currentWorkspaceRoot;
}

/**
 * Set the current active workspace root path with validation.
 * @param {string} newRoot - New root directory.
 * @returns {string} Absolute normalized workspace path.
 */
export function setWorkspaceRoot(newRoot) {
  if (!newRoot || typeof newRoot !== 'string') {
    throw new Error('Workspace root must be a non-empty string.');
  }

  const resolved = path.resolve(newRoot);
  if (!fs.existsSync(resolved)) {
    fs.mkdirSync(resolved, { recursive: true });
  }

  const stat = fs.statSync(resolved);
  if (!stat.isDirectory()) {
    throw new Error(`Target workspace path "${resolved}" is not a directory.`);
  }

  currentWorkspaceRoot = resolved;
  return currentWorkspaceRoot;
}

/**
 * Resolves and validates a path safely against the workspace sandbox.
 * Throws an error if any path traversal attempt escapes the workspace root.
 * 
 * @param {string} targetPath - Relative or absolute target path.
 * @param {string} [baseDir] - Optional base directory inside workspace.
 * @returns {{ resolvedPath: string, relativePath: string }}
 */
export function resolveSafePath(targetPath = '', baseDir = null) {
  if (typeof targetPath !== 'string') {
    throw new Error('Target path must be a string.');
  }

  // Prevent null-byte injection
  if (targetPath.indexOf('\0') !== -1) {
    throw new Error('Access denied: Invalid path containing null bytes.');
  }

  const root = path.resolve(currentWorkspaceRoot);
  const base = baseDir ? path.resolve(baseDir) : root;

  // Resolve target against base or root
  const resolved = path.isAbsolute(targetPath)
    ? path.resolve(targetPath)
    : path.resolve(base, targetPath);

  // Cross-platform sandbox containment verification
  const isWindows = process.platform === 'win32';
  const rootComp = isWindows ? root.toLowerCase() : root;
  const targetComp = isWindows ? resolved.toLowerCase() : resolved;

  const isContained =
    targetComp === rootComp ||
    targetComp.startsWith(rootComp + path.sep.toLowerCase());

  if (!isContained) {
    throw new Error(`Access denied: Path "${targetPath}" escapes workspace root "${root}".`);
  }

  const rel = path.relative(root, resolved).replace(/\\/g, '/');
  return {
    resolvedPath: resolved,
    relativePath: rel === '' ? '.' : rel
  };
}

/**
 * Loads project-specific ignore patterns from .namoignore or .gitignore if available.
 * @returns {string[]}
 */
export function loadProjectIgnorePatterns() {
  const patterns = [...DEFAULT_IGNORE_PATTERNS];
  const ignoreFile = path.join(currentWorkspaceRoot, '.namoignore');

  if (fs.existsSync(ignoreFile)) {
    try {
      const content = fs.readFileSync(ignoreFile, 'utf8');
      const lines = content
        .split(/\r?\n/)
        .map(l => l.trim())
        .filter(l => l && !l.startsWith('#'));
      patterns.push(...lines);
    } catch (_err) {
      // Ignore read errors for ignore files
    }
  }

  return Array.from(new Set(patterns));
}

/**
 * Determines whether a given filename or relative path matches ignore patterns.
 * @param {string} relPath 
 * @param {string[]} ignorePatterns 
 * @returns {boolean}
 */
export function isPathIgnored(relPath, ignorePatterns = []) {
  const normalized = relPath.replace(/\\/g, '/');
  const baseName = path.basename(normalized);
  const segments = normalized.split('/');

  const allPatterns = [...DEFAULT_IGNORE_PATTERNS, ...ignorePatterns];

  for (const pattern of allPatterns) {
    const cleanPattern = pattern.replace(/^\/+|\/+$/g, '');
    if (!cleanPattern) continue;

    // Direct segment or filename match
    if (baseName === cleanPattern || segments.includes(cleanPattern)) {
      return true;
    }

    // Prefix or wildcard simple match
    if (cleanPattern.includes('*')) {
      const regexPattern = new RegExp('^' + cleanPattern.replace(/\./g, '\\.').replace(/\*/g, '.*') + '$');
      if (regexPattern.test(baseName) || regexPattern.test(normalized)) {
        return true;
      }
    } else if (normalized === cleanPattern || normalized.startsWith(cleanPattern + '/')) {
      return true;
    }
  }

  return false;
}

/**
 * Recursively lists all files in the target directory within workspace bounds.
 * 
 * @param {string} [dirPath=''] - Relative path from workspace root.
 * @param {string[]} [ignorePatterns=[]] - Additional patterns to ignore.
 * @returns {Promise<Array<{ path: string, name: string, size: number, isDirectory: boolean, modifiedAt: string, extension: string }>>}
 */
export async function listFiles(dirPath = '', ignorePatterns = []) {
  const { resolvedPath } = resolveSafePath(dirPath);
  const activeIgnores = Array.from(new Set([...loadProjectIgnorePatterns(), ...ignorePatterns]));
  const results = [];

  if (!fs.existsSync(resolvedPath)) {
    return results;
  }

  async function walk(currentDir) {
    let entries;
    try {
      entries = await fsp.readdir(currentDir, { withFileTypes: true });
    } catch (_err) {
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      const relPath = path.relative(currentWorkspaceRoot, fullPath).replace(/\\/g, '/');

      if (isPathIgnored(relPath, activeIgnores)) {
        continue;
      }

      if (entry.isDirectory()) {
        results.push({
          path: relPath,
          name: entry.name,
          size: 0,
          isDirectory: true,
          modifiedAt: new Date().toISOString(),
          extension: ''
        });
        await walk(fullPath);
      } else if (entry.isFile()) {
        try {
          const stat = await fsp.stat(fullPath);
          results.push({
            path: relPath,
            name: entry.name,
            size: stat.size,
            isDirectory: false,
            modifiedAt: stat.mtime.toISOString(),
            extension: path.extname(entry.name).toLowerCase()
          });
        } catch (_err) {
          // File might have been removed concurrently
        }
      }
    }
  }

  const stat = await fsp.stat(resolvedPath);
  if (stat.isDirectory()) {
    await walk(resolvedPath);
  } else {
    const relPath = path.relative(currentWorkspaceRoot, resolvedPath).replace(/\\/g, '/');
    results.push({
      path: relPath,
      name: path.basename(resolvedPath),
      size: stat.size,
      isDirectory: false,
      modifiedAt: stat.mtime.toISOString(),
      extension: path.extname(resolvedPath).toLowerCase()
    });
  }

  return results;
}

/**
 * Builds a hierarchical tree structure representing the workspace or subdirectory.
 * 
 * @param {string} [dirPath=''] - Relative path to start from.
 * @param {object} [options={}] - Options: maxDepth, includeFiles, ignorePatterns.
 * @returns {Promise<object>} Tree node object.
 */
export async function getFileTree(dirPath = '', options = {}) {
  const { maxDepth = 8, includeFiles = true, ignorePatterns = [] } = options;
  const { resolvedPath, relativePath } = resolveSafePath(dirPath);
  const activeIgnores = Array.from(new Set([...loadProjectIgnorePatterns(), ...ignorePatterns]));

  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Directory does not exist: "${dirPath}".`);
  }

  async function buildNode(currentPath, currentDepth) {
    const stat = await fsp.stat(currentPath);
    const name = path.basename(currentPath) || 'root';
    const relFromRoot = path.relative(currentWorkspaceRoot, currentPath).replace(/\\/g, '/') || '.';

    if (!stat.isDirectory()) {
      return {
        name,
        path: relFromRoot,
        type: 'file',
        size: stat.size,
        extension: path.extname(name).toLowerCase(),
        modifiedAt: stat.mtime.toISOString()
      };
    }

    const node = {
      name,
      path: relFromRoot,
      type: 'directory',
      children: []
    };

    if (currentDepth >= maxDepth) {
      return node;
    }

    let entries = [];
    try {
      entries = await fsp.readdir(currentPath, { withFileTypes: true });
    } catch (_err) {
      return node;
    }

    // Sort: directories first, then alphabetical
    entries.sort((a, b) => {
      if (a.isDirectory() && !b.isDirectory()) return -1;
      if (!a.isDirectory() && b.isDirectory()) return 1;
      return a.name.localeCompare(b.name);
    });

    for (const entry of entries) {
      const childFullPath = path.join(currentPath, entry.name);
      const childRelPath = path.relative(currentWorkspaceRoot, childFullPath).replace(/\\/g, '/');

      if (isPathIgnored(childRelPath, activeIgnores)) {
        continue;
      }

      if (entry.isDirectory()) {
        const childNode = await buildNode(childFullPath, currentDepth + 1);
        node.children.push(childNode);
      } else if (includeFiles && entry.isFile()) {
        try {
          const childStat = await fsp.stat(childFullPath);
          node.children.push({
            name: entry.name,
            path: childRelPath,
            type: 'file',
            size: childStat.size,
            extension: path.extname(entry.name).toLowerCase(),
            modifiedAt: childStat.mtime.toISOString()
          });
        } catch (_err) {
          // ignore concurrent deletion
        }
      }
    }

    return node;
  }

  return await buildNode(resolvedPath, 0);
}

/**
 * Reads text content of a file within workspace sandbox.
 * 
 * @param {string} filePath - Relative or absolute path.
 * @param {object} [options={}] - Options (maxBytes).
 * @returns {Promise<{ path: string, absolutePath: string, content: string, size: number, modifiedAt: string }>}
 */
export async function readFileContent(filePath, options = {}) {
  const { maxBytes = 10 * 1024 * 1024 } = options; // 10MB default limit
  const { resolvedPath, relativePath } = resolveSafePath(filePath);

  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`File not found: "${filePath}".`);
  }

  const stat = await fsp.stat(resolvedPath);
  if (stat.isDirectory()) {
    throw new Error(`Cannot read content of directory: "${filePath}".`);
  }

  if (stat.size > maxBytes) {
    throw new Error(`File size (${stat.size} bytes) exceeds maximum limit (${maxBytes} bytes).`);
  }

  const content = await fsp.readFile(resolvedPath, 'utf8');
  return {
    path: relativePath,
    absolutePath: resolvedPath,
    content,
    size: stat.size,
    modifiedAt: stat.mtime.toISOString()
  };
}

/**
 * Writes text content to a file within workspace sandbox.
 * Automatically creates parent directories.
 * 
 * @param {string} filePath - Target file path.
 * @param {string} content - Text content.
 * @returns {Promise<{ success: boolean, path: string, absolutePath: string, bytesWritten: number, modifiedAt: string }>}
 */
export async function writeFileContent(filePath, content) {
  if (typeof content !== 'string') {
    throw new Error('File content must be a string.');
  }

  const { resolvedPath, relativePath } = resolveSafePath(filePath);
  const dir = path.dirname(resolvedPath);

  if (!fs.existsSync(dir)) {
    await fsp.mkdir(dir, { recursive: true });
  }

  await fsp.writeFile(resolvedPath, content, 'utf8');
  const stat = await fsp.stat(resolvedPath);

  return {
    success: true,
    path: relativePath,
    absolutePath: resolvedPath,
    bytesWritten: stat.size,
    modifiedAt: stat.mtime.toISOString()
  };
}

/**
 * Deletes a file or directory within workspace sandbox.
 * 
 * @param {string} targetPath - Relative or absolute path to delete.
 * @returns {Promise<{ success: boolean, path: string }>}
 */
export async function deleteFile(targetPath) {
  const { resolvedPath, relativePath } = resolveSafePath(targetPath);

  if (resolvedPath === path.resolve(currentWorkspaceRoot)) {
    throw new Error('Access denied: Cannot delete workspace root directory.');
  }

  if (!fs.existsSync(resolvedPath)) {
    return { success: true, path: relativePath, message: 'Path already does not exist.' };
  }

  await fsp.rm(resolvedPath, { recursive: true, force: true });
  return {
    success: true,
    path: relativePath
  };
}

/**
 * Creates a directory inside the workspace sandbox recursively.
 * 
 * @param {string} dirPath - Relative or absolute directory path.
 * @returns {Promise<{ success: boolean, path: string }>}
 */
export async function createDirectory(dirPath) {
  const { resolvedPath, relativePath } = resolveSafePath(dirPath);

  if (!fs.existsSync(resolvedPath)) {
    await fsp.mkdir(resolvedPath, { recursive: true });
  }

  return {
    success: true,
    path: relativePath
  };
}
