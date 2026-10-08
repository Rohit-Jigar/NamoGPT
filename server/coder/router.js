/**
 * Namo Coder - Express Router
 * 
 * Exposes REST API endpoints for workspace navigation, files, symbols,
 * grep search, diffing, terminal commands, checkpoints, and coder agent.
 */

import express from 'express';
import {
  getWorkspaceRoot,
  setWorkspaceRoot,
  listFiles,
  getFileTree,
  readFileContent,
  writeFileContent,
  deleteFile,
  createDirectory
} from './workspace.js';
import { extractSymbols, grepSearch } from './intelligence.js';
import { computeDiff, applyPatch } from './diff.js';
import { executeCommand } from './terminal.js';
import {
  createCheckpoint,
  listCheckpoints,
  rollbackCheckpoint,
  getCheckpoint,
  deleteCheckpoint
} from './checkpoints.js';
import { runCoderAgent } from './agent.js';

const router = express.Router();

/**
 * GET /api/coder/workspace
 * Returns workspace configuration and tracked files overview.
 */
router.get('/workspace', async (req, res) => {
  try {
    const root = getWorkspaceRoot();
    const files = await listFiles(req.query.path || '');
    return res.status(200).json({
      success: true,
      workspaceRoot: root,
      filesCount: files.length,
      files: files.slice(0, 100)
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/coder/workspace/root
 * Updates the active workspace root.
 */
router.post('/workspace/root', (req, res) => {
  try {
    const { path: newRoot } = req.body || {};
    if (!newRoot) {
      return res.status(400).json({ success: false, error: 'Path is required.' });
    }
    const updated = setWorkspaceRoot(newRoot);
    return res.status(200).json({ success: true, workspaceRoot: updated });
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/coder/tree
 * Returns hierarchical file tree for IDE file explorer.
 */
router.get('/tree', async (req, res) => {
  try {
    const dirPath = req.query.path || '';
    const maxDepth = Number(req.query.depth) || 8;
    const tree = await getFileTree(dirPath, { maxDepth });
    return res.status(200).json({
      success: true,
      tree
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/coder/file
 * Reads file content.
 */
router.get('/file', async (req, res) => {
  try {
    const filePath = req.query.path;
    if (!filePath) {
      return res.status(400).json({ success: false, error: 'Query parameter "path" is required.' });
    }
    const file = await readFileContent(filePath);
    return res.status(200).json({
      success: true,
      ...file
    });
  } catch (err) {
    const status = err.message.includes('not found') ? 404 : 400;
    return res.status(status).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/coder/file
 * Writes, updates, or deletes a file.
 */
router.post('/file', async (req, res) => {
  try {
    const { path: filePath, content, action } = req.body || {};

    if (!filePath) {
      return res.status(400).json({ success: false, error: 'Body parameter "path" is required.' });
    }

    if (action === 'delete') {
      const delRes = await deleteFile(filePath);
      return res.status(200).json(delRes);
    }

    if (content === undefined || content === null) {
      return res.status(400).json({ success: false, error: 'Body parameter "content" is required for file write.' });
    }

    const writeRes = await writeFileContent(filePath, content);
    return res.status(200).json(writeRes);
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * DELETE /api/coder/file
 * Deletes a file.
 */
router.delete('/file', async (req, res) => {
  try {
    const filePath = req.query.path || req.body?.path;
    if (!filePath) {
      return res.status(400).json({ success: false, error: 'Parameter "path" is required.' });
    }
    const delRes = await deleteFile(filePath);
    return res.status(200).json(delRes);
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/coder/symbols
 * Extracts symbols (functions, classes, variables, imports, exports) from file or content.
 */
router.post('/symbols', async (req, res) => {
  try {
    const { path: filePath, content, filename } = req.body || {};

    let sourceContent = content;
    let targetFilename = filename || filePath || 'file.js';

    if (filePath && !sourceContent) {
      const file = await readFileContent(filePath);
      sourceContent = file.content;
      targetFilename = filePath;
    }

    if (typeof sourceContent !== 'string') {
      return res.status(400).json({ success: false, error: 'Either "path" or "content" must be provided.' });
    }

    const symbols = extractSymbols(sourceContent, targetFilename);
    return res.status(200).json({
      success: true,
      filename: targetFilename,
      count: symbols.length,
      symbols
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/coder/grep
 * Lexical code search across workspace files.
 */
router.post('/grep', async (req, res) => {
  try {
    const { query, path: dirPath, isRegex, caseSensitive, maxResults, fileExtensions } = req.body || {};

    if (!query) {
      return res.status(400).json({ success: false, error: 'Query parameter "query" is required.' });
    }

    const grepRes = await grepSearch(query, dirPath || '', {
      isRegex: Boolean(isRegex),
      caseSensitive: Boolean(caseSensitive),
      maxResults: Number(maxResults) || 200,
      fileExtensions: Array.isArray(fileExtensions) ? fileExtensions : []
    });

    return res.status(200).json({
      success: true,
      ...grepRes
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/coder/diff
 * Computes unified diff or applies patch.
 */
router.post('/diff', (req, res) => {
  try {
    const { original, modified, filename, patch } = req.body || {};

    if (patch !== undefined && patch !== null) {
      const patchRes = applyPatch(original || '', patch);
      return res.status(200).json(patchRes);
    }

    if (original === undefined || modified === undefined) {
      return res.status(400).json({ success: false, error: 'Both "original" and "modified" are required.' });
    }

    const diffRes = computeDiff(original, modified, filename || 'file');
    return res.status(200).json({
      success: true,
      ...diffRes
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/coder/terminal/run
 * Runs a command safely in workspace.
 */
router.post('/terminal/run', async (req, res) => {
  try {
    const { command, cwd, timeoutMs } = req.body || {};

    if (!command) {
      return res.status(400).json({ success: false, error: 'Body parameter "command" is required.' });
    }

    const result = await executeCommand(command, cwd, timeoutMs);
    return res.status(200).json(result);
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/coder/checkpoints
 * Lists all snapshots.
 */
router.get('/checkpoints', (_req, res) => {
  try {
    const checkpoints = listCheckpoints();
    return res.status(200).json({
      success: true,
      count: checkpoints.length,
      checkpoints
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/coder/checkpoints
 * Creates a new checkpoint snapshot.
 */
router.post('/checkpoints', async (req, res) => {
  try {
    const { name, description, files } = req.body || {};
    const checkpoint = await createCheckpoint(name, description, files);
    return res.status(201).json({
      success: true,
      checkpoint
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/coder/checkpoints/rollback
 * Restores workspace files to snapshot state.
 */
router.post('/checkpoints/rollback', async (req, res) => {
  try {
    const { checkpointId } = req.body || {};
    if (!checkpointId) {
      return res.status(400).json({ success: false, error: 'Body parameter "checkpointId" is required.' });
    }
    const result = await rollbackCheckpoint(checkpointId);
    return res.status(200).json(result);
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/coder/agent/chat
 * Runs autonomous Coder Agent loop.
 */
router.post('/agent/chat', async (req, res) => {
  try {
    const { prompt, conversationId, provider, model, maxSteps, dryRun } = req.body || {};

    if (!prompt) {
      return res.status(400).json({ success: false, error: 'Body parameter "prompt" is required.' });
    }

    const result = await runCoderAgent({
      prompt,
      conversationId,
      provider,
      model,
      maxSteps: Number(maxSteps) || 10,
      dryRun: Boolean(dryRun)
    });

    return res.status(200).json({
      success: true,
      ...result
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
