/**
 * Namo Coder - Terminal Execution & Command Runner Engine
 * 
 * Provides safe execution of build, test, and shell commands within the workspace,
 * capturing stdout/stderr, execution time, and enforcing strict timeouts and guardrails.
 */

import { spawn } from 'child_process';
import { performance } from 'perf_hooks';
import path from 'path';
import { getWorkspaceRoot, resolveSafePath } from './workspace.js';

const DEFAULT_TIMEOUT_MS = 30000;
const MAX_TIMEOUT_MS = 180000;
const MAX_OUTPUT_BUFFER_BYTES = 2 * 1024 * 1024; // 2MB

// Hazardous command patterns blocked by policy
const BLOCKED_COMMAND_PATTERNS = [
  /rm\s+-rf\s+\/(?:\s|$)/i,
  /rmdir\s+\/s\s+\/q\s+[c-z]:\\(?:\s|$)/i,
  /format\s+[a-z]:/i,
  /:(){ :\|:& };:/, // bash fork bomb
  /mkfs(?:\.[a-z0-9]+)?\s+/i,
  /dd\s+if=.*of=\/dev\/(?:sd|hd|nvme)/i
];

/**
 * Validates whether a command passes baseline safety policies.
 * @param {string} command 
 * @returns {{ safe: boolean, reason?: string }}
 */
export function validateCommandSafety(command) {
  if (!command || typeof command !== 'string') {
    return { safe: false, reason: 'Command must be a non-empty string.' };
  }

  const trimmed = command.trim();
  for (const pattern of BLOCKED_COMMAND_PATTERNS) {
    if (pattern.test(trimmed)) {
      return { safe: false, reason: `Blocked potentially destructive command pattern: ${trimmed}` };
    }
  }

  return { safe: true };
}

/**
 * Executes a terminal command within the workspace directory.
 * 
 * @param {string} command - Shell command to execute.
 * @param {string} [cwd] - Working directory (defaults to workspace root).
 * @param {number} [timeoutMs=30000] - Timeout in milliseconds.
 * @returns {Promise<{ command: string, cwd: string, stdout: string, stderr: string, exitCode: number, executionTimeMs: number, timedOut: boolean, killed: boolean, success: boolean }>}
 */
export async function executeCommand(command, cwd = null, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const safetyCheck = validateCommandSafety(command);
  if (!safetyCheck.safe) {
    throw new Error(`Security Policy Violation: ${safetyCheck.reason}`);
  }

  // Resolve working directory safely within workspace
  let targetCwd = getWorkspaceRoot();
  if (cwd) {
    const { resolvedPath } = resolveSafePath(cwd);
    targetCwd = resolvedPath;
  }

  const effectiveTimeout = Math.min(Math.max(500, Number(timeoutMs) || DEFAULT_TIMEOUT_MS), MAX_TIMEOUT_MS);
  const startTime = performance.now();

  return new Promise((resolve) => {
    let stdoutData = '';
    let stderrData = '';
    let timedOut = false;
    let killed = false;
    let timer = null;

    const isWindows = process.platform === 'win32';
    const shell = isWindows ? (process.env.ComSpec || 'cmd.exe') : (process.env.SHELL || '/bin/sh');
    const shellArgs = isWindows ? ['/d', '/s', '/c', command] : ['-c', command];

    const child = spawn(shell, shellArgs, {
      cwd: targetCwd,
      env: {
        ...process.env,
        NAMO_CODER: 'true'
      },
      windowsVerbatimArguments: isWindows
    });

    timer = setTimeout(() => {
      timedOut = true;
      killed = true;
      try {
        if (isWindows && child.pid) {
          spawn('taskkill', ['/pid', String(child.pid), '/T', '/F']);
        } else {
          child.kill('SIGKILL');
        }
      } catch (_err) {
        // Child might have already exited
      }
    }, effectiveTimeout);

    child.stdout.on('data', (chunk) => {
      if (stdoutData.length < MAX_OUTPUT_BUFFER_BYTES) {
        stdoutData += chunk.toString('utf8');
      }
    });

    child.stderr.on('data', (chunk) => {
      if (stderrData.length < MAX_OUTPUT_BUFFER_BYTES) {
        stderrData += chunk.toString('utf8');
      }
    });

    child.on('error', (err) => {
      clearTimeout(timer);
      const executionTimeMs = Math.round(performance.now() - startTime);
      resolve({
        command,
        cwd: targetCwd,
        stdout: stdoutData,
        stderr: (stderrData ? stderrData + '\n' : '') + `Execution error: ${err.message}`,
        exitCode: 1,
        executionTimeMs,
        timedOut: false,
        killed: true,
        success: false
      });
    });

    child.on('close', (code) => {
      clearTimeout(timer);
      const executionTimeMs = Math.round(performance.now() - startTime);
      const exitCode = code !== null ? code : (timedOut ? 124 : 1);

      resolve({
        command,
        cwd: targetCwd,
        stdout: stdoutData,
        stderr: stderrData,
        exitCode,
        executionTimeMs,
        timedOut,
        killed,
        success: exitCode === 0
      });
    });
  });
}
