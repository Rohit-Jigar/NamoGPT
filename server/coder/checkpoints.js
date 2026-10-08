/**
 * Namo Coder - Workspace Checkpoints & Snapshot Engine
 * 
 * Provides atomic snapshots and deterministic rollback functionality,
 * storing file state snapshots in the workspace `.checkpoints` directory.
 */

import path from 'path';
import fs from 'fs';
import { promises as fsp } from 'fs';
import crypto from 'crypto';
import { getWorkspaceRoot, resolveSafePath, readFileContent, writeFileContent, listFiles } from './workspace.js';

/**
 * Computes SHA-256 hash of a content string or buffer.
 * @param {string|Buffer} content 
 * @returns {string}
 */
function computeContentHash(content) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Returns the absolute directory path where checkpoints and indices are stored.
 * @returns {string}
 */
function getCheckpointsDir() {
  const root = getWorkspaceRoot();
  const dir = path.join(root, '.checkpoints');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

/**
 * Returns path to the checkpoints index manifest.
 * @returns {string}
 */
function getIndexPath() {
  return path.join(getCheckpointsDir(), 'manifest.json');
}

/**
 * Loads the checkpoint manifest.
 * @returns {Array<object>}
 */
function loadManifest() {
  const indexPath = getIndexPath();
  if (!fs.existsSync(indexPath)) {
    return [];
  }
  try {
    const raw = fs.readFileSync(indexPath, 'utf8');
    return JSON.parse(raw);
  } catch (_err) {
    return [];
  }
}

/**
 * Saves the checkpoint manifest.
 * @param {Array<object>} manifest 
 */
function saveManifest(manifest) {
  const indexPath = getIndexPath();
  fs.writeFileSync(indexPath, JSON.stringify(manifest, null, 2), 'utf8');
}

/**
 * Creates a file-state checkpoint snapshot of the workspace.
 * 
 * @param {string} [name] - Friendly name for the checkpoint.
 * @param {string} [description] - Description or reason for checkpoint.
 * @param {Array<string|{path: string, content: string}>} [files] - Optional list of files to snapshot. If omitted, snapshots all workspace files.
 * @returns {Promise<object>} Created checkpoint details.
 */
export async function createCheckpoint(name = '', description = '', files = null) {
  const checkpointId = `ckpt_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  const timestamp = Date.now();
  const checkpointsDir = getCheckpointsDir();
  const snapshotDataDir = path.join(checkpointsDir, checkpointId);

  await fsp.mkdir(snapshotDataDir, { recursive: true });

  const filesToProcess = [];

  if (Array.isArray(files) && files.length > 0) {
    for (const item of files) {
      if (typeof item === 'string') {
        try {
          const fileData = await readFileContent(item);
          filesToProcess.push({
            path: fileData.path,
            content: fileData.content,
            size: fileData.size
          });
        } catch (_err) {
          // Skip missing files
        }
      } else if (item && typeof item === 'object' && item.path) {
        filesToProcess.push({
          path: item.path.replace(/\\/g, '/'),
          content: typeof item.content === 'string' ? item.content : '',
          size: Buffer.byteLength(item.content || '', 'utf8')
        });
      }
    }
  } else {
    // Snapshot all tracked files in workspace
    const allFiles = await listFiles('');
    for (const f of allFiles) {
      if (f.isDirectory) continue;
      try {
        const fileData = await readFileContent(f.path);
        filesToProcess.push({
          path: fileData.path,
          content: fileData.content,
          size: fileData.size
        });
      } catch (_err) {
        // Skip unreadable files
      }
    }
  }

  const snapshottedFiles = [];
  let totalBytes = 0;

  for (const item of filesToProcess) {
    const hash = computeContentHash(item.content);
    const safeTarget = path.join(snapshotDataDir, encodeURIComponent(item.path));
    await fsp.writeFile(safeTarget, item.content, 'utf8');

    snapshottedFiles.push({
      path: item.path,
      size: item.size,
      hash
    });
    totalBytes += item.size;
  }

  const checkpoint = {
    id: checkpointId,
    name: name || `Checkpoint at ${new Date(timestamp).toLocaleTimeString()}`,
    description: description || 'Automatic workspace snapshot',
    timestamp,
    createdAt: new Date(timestamp).toISOString(),
    fileCount: snapshottedFiles.length,
    totalSize: totalBytes,
    files: snapshottedFiles
  };

  const manifest = loadManifest();
  manifest.unshift(checkpoint);
  saveManifest(manifest);

  return checkpoint;
}

/**
 * Lists all existing workspace checkpoints, sorted newest first.
 * @returns {Array<object>}
 */
export function listCheckpoints() {
  const manifest = loadManifest();
  return manifest.map(cp => ({
    id: cp.id,
    name: cp.name,
    description: cp.description,
    timestamp: cp.timestamp,
    createdAt: cp.createdAt,
    fileCount: cp.fileCount,
    totalSize: cp.totalSize,
    files: (cp.files || []).map(f => f.path)
  }));
}

/**
 * Retrieves a specific checkpoint by ID with its file records.
 * @param {string} checkpointId 
 * @returns {object|null}
 */
export function getCheckpoint(checkpointId) {
  const manifest = loadManifest();
  return manifest.find(cp => cp.id === checkpointId) || null;
}

/**
 * Restores file contents to the exact state saved in the checkpoint.
 * 
 * @param {string} checkpointId - The ID of the checkpoint to restore.
 * @returns {Promise<{ success: boolean, checkpointId: string, name: string, restoredFiles: string[], timestamp: number }>}
 */
export async function rollbackCheckpoint(checkpointId) {
  if (!checkpointId || typeof checkpointId !== 'string') {
    throw new Error('Checkpoint ID is required for rollback.');
  }

  const manifest = loadManifest();
  const checkpoint = manifest.find(cp => cp.id === checkpointId);

  if (!checkpoint) {
    throw new Error(`Checkpoint not found: "${checkpointId}".`);
  }

  const checkpointsDir = getCheckpointsDir();
  const snapshotDataDir = path.join(checkpointsDir, checkpointId);

  if (!fs.existsSync(snapshotDataDir)) {
    throw new Error(`Checkpoint data files missing for ID: "${checkpointId}".`);
  }

  const restoredFiles = [];

  for (const fileMeta of checkpoint.files) {
    const safeSource = path.join(snapshotDataDir, encodeURIComponent(fileMeta.path));
    if (fs.existsSync(safeSource)) {
      const content = await fsp.readFile(safeSource, 'utf8');
      await writeFileContent(fileMeta.path, content);
      restoredFiles.push(fileMeta.path);
    }
  }

  return {
    success: true,
    checkpointId,
    name: checkpoint.name,
    restoredFiles,
    timestamp: Date.now()
  };
}

/**
 * Deletes a checkpoint and its snapshot files.
 * @param {string} checkpointId 
 * @returns {Promise<{ success: boolean, checkpointId: string }>}
 */
export async function deleteCheckpoint(checkpointId) {
  const manifest = loadManifest();
  const updated = manifest.filter(cp => cp.id !== checkpointId);

  if (updated.length !== manifest.length) {
    saveManifest(updated);
    const dataDir = path.join(getCheckpointsDir(), checkpointId);
    if (fs.existsSync(dataDir)) {
      await fsp.rm(dataDir, { recursive: true, force: true });
    }
    return { success: true, checkpointId };
  }

  return { success: false, checkpointId, message: 'Checkpoint ID not found.' };
}
