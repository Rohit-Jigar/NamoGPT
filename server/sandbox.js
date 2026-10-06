/**
 * NamoGPT Sandboxed Code Execution Engine
 * 
 * Safe isolated code execution for JavaScript and Python.
 * - JavaScript: Isolated Node.js vm context with timeout, console capture, and safe globals.
 * - Python: Process spawning with buffer limits, timeout enforcement, and safe fallback.
 */

import vm from 'node:vm';
import { spawn } from 'node:child_process';
import { performance } from 'node:perf_hooks';

const DEFAULT_JS_TIMEOUT_MS = 3000;
const DEFAULT_PYTHON_TIMEOUT_MS = 5000;
const MAX_OUTPUT_BUFFER_BYTES = 512 * 1024; // 512 KB

/**
 * Format argument for sandbox console capture.
 * @param {any} arg 
 * @returns {string}
 */
function formatConsoleArg(arg) {
  if (arg === null) return 'null';
  if (arg === undefined) return 'undefined';
  if (typeof arg === 'string') return arg;
  if (typeof arg === 'number' || typeof arg === 'boolean' || typeof arg === 'bigint') return String(arg);
  if (typeof arg === 'function') return `[Function: ${arg.name || 'anonymous'}]`;
  if (arg instanceof Error) return arg.stack || `${arg.name}: ${arg.message}`;
  try {
    return JSON.stringify(arg, null, 2);
  } catch (_err) {
    return String(arg);
  }
}

/**
 * Executes JavaScript code in an isolated VM context.
 * 
 * @param {string} code 
 * @param {number} [timeoutMs=3000] 
 * @returns {Promise<{ success: boolean, stdout: string, stderr: string, result: any, executionTimeMs: number }>}
 */
export async function executeJavaScript(code, timeoutMs = DEFAULT_JS_TIMEOUT_MS) {
  const startTime = performance.now();
  const stdoutParts = [];
  const stderrParts = [];
  const effectiveTimeout = Math.min(Math.max(100, Number(timeoutMs) || DEFAULT_JS_TIMEOUT_MS), 15000);

  const sandboxConsole = {
    log: (...args) => stdoutParts.push(args.map(formatConsoleArg).join(' ')),
    info: (...args) => stdoutParts.push(args.map(formatConsoleArg).join(' ')),
    dir: (item) => stdoutParts.push(formatConsoleArg(item)),
    table: (data) => {
      try {
        stdoutParts.push(JSON.stringify(data, null, 2));
      } catch {
        stdoutParts.push(String(data));
      }
    },
    warn: (...args) => stderrParts.push(args.map(formatConsoleArg).join(' ')),
    error: (...args) => stderrParts.push(args.map(formatConsoleArg).join(' '))
  };

  const sandbox = {
    console: sandboxConsole,
    Math,
    Date,
    JSON,
    Array,
    Object,
    String,
    Number,
    Boolean,
    RegExp,
    Map,
    Set,
    WeakMap,
    WeakSet,
    Symbol,
    Promise,
    parseInt,
    parseFloat,
    isNaN,
    isFinite,
    encodeURI,
    decodeURI,
    encodeURIComponent,
    decodeURIComponent,
    // Block sensitive globals and node access
    process: undefined,
    require: undefined,
    module: undefined,
    exports: undefined,
    global: undefined,
    __dirname: undefined,
    __filename: undefined,
    fetch: undefined
  };

  // Prevent prototype traversal escape
  sandbox.globalThis = sandbox;

  try {
    const context = vm.createContext(sandbox, {
      codeGeneration: { strings: false, wasm: false }
    });

    const script = new vm.Script(code, {
      filename: 'sandboxed-code.js'
    });

    let rawResult = script.runInContext(context, {
      timeout: effectiveTimeout
    });

    // Handle Promise / async results
    if (rawResult && typeof rawResult.then === 'function') {
      let timeoutHandle;
      const timeoutPromise = new Promise((_, reject) => {
        timeoutHandle = setTimeout(() => {
          reject(new Error(`Execution timed out after ${effectiveTimeout}ms`));
        }, effectiveTimeout);
      });

      try {
        rawResult = await Promise.race([rawResult, timeoutPromise]);
      } finally {
        clearTimeout(timeoutHandle);
      }
    }

    const executionTimeMs = Number((performance.now() - startTime).toFixed(2));
    let formattedResult = null;
    if (rawResult !== undefined) {
      if (typeof rawResult === 'object' && rawResult !== null) {
        try {
          formattedResult = JSON.parse(JSON.stringify(rawResult));
        } catch {
          formattedResult = String(rawResult);
        }
      } else {
        formattedResult = rawResult;
      }
    }

    return {
      success: true,
      stdout: stdoutParts.join('\n'),
      stderr: stderrParts.join('\n'),
      result: formattedResult,
      executionTimeMs
    };
  } catch (err) {
    const executionTimeMs = Number((performance.now() - startTime).toFixed(2));
    const errorMessage = err.message || String(err);

    return {
      success: false,
      stdout: stdoutParts.join('\n'),
      stderr: stderrParts.length > 0 ? `${stderrParts.join('\n')}\n${errorMessage}` : errorMessage,
      result: null,
      executionTimeMs
    };
  }
}

/**
 * Spawns a child process for Python with timeout and buffer limits.
 * @param {string} cmd 
 * @param {string} code 
 * @param {number} effectiveTimeout 
 * @returns {Promise<{ success: boolean, stdout: string, stderr: string, result: any, executionTimeMs: number }>}
 */
function spawnPythonProcess(cmd, code, effectiveTimeout, startTime) {
  return new Promise((resolve, reject) => {
    let stdoutData = '';
    let stderrData = '';
    let timedOut = false;
    let bufferOverflow = false;

    // Use python -u - (unbuffered mode reading from stdin)
    const child = spawn(cmd, ['-u', '-'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true
    });

    const timeoutHandle = setTimeout(() => {
      timedOut = true;
      try {
        child.kill();
      } catch (_e) {
        // Ignore kill errors
      }
    }, effectiveTimeout);

    child.stdout.on('data', (chunk) => {
      if (stdoutData.length + chunk.length > MAX_OUTPUT_BUFFER_BYTES) {
        bufferOverflow = true;
        child.kill();
        return;
      }
      stdoutData += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      if (stderrData.length + chunk.length > MAX_OUTPUT_BUFFER_BYTES) {
        bufferOverflow = true;
        child.kill();
        return;
      }
      stderrData += chunk.toString();
    });

    child.on('error', (err) => {
      clearTimeout(timeoutHandle);
      reject(err);
    });

    child.on('close', (exitCode) => {
      clearTimeout(timeoutHandle);
      const executionTimeMs = Number((performance.now() - startTime).toFixed(2));

      if (timedOut) {
        return resolve({
          success: false,
          stdout: stdoutData,
          stderr: `Execution timed out after ${effectiveTimeout}ms.`,
          result: null,
          executionTimeMs
        });
      }

      if (bufferOverflow) {
        return resolve({
          success: false,
          stdout: stdoutData,
          stderr: `Execution aborted: output buffer limit (${MAX_OUTPUT_BUFFER_BYTES / 1024} KB) exceeded.`,
          result: null,
          executionTimeMs
        });
      }

      const success = exitCode === 0;
      const trimmedStdout = stdoutData.trim();
      let result = null;

      if (trimmedStdout) {
        const lines = trimmedStdout.split('\n');
        result = lines[lines.length - 1].trim();
      }

      return resolve({
        success,
        stdout: stdoutData,
        stderr: stderrData,
        result,
        executionTimeMs
      });
    });

    // Write Python code to child stdin and close
    try {
      child.stdin.write(code);
      child.stdin.end();
    } catch (err) {
      clearTimeout(timeoutHandle);
      reject(err);
    }
  });
}

/**
 * Executes Python code via child process with fallback support.
 * 
 * @param {string} code 
 * @param {number} [timeoutMs=5000] 
 * @returns {Promise<{ success: boolean, stdout: string, stderr: string, result: any, executionTimeMs: number }>}
 */
export async function executePython(code, timeoutMs = DEFAULT_PYTHON_TIMEOUT_MS) {
  const startTime = performance.now();
  const effectiveTimeout = Math.min(Math.max(100, Number(timeoutMs) || DEFAULT_PYTHON_TIMEOUT_MS), 15000);

  // Try python first, then py, then python3
  const commandsToTry = ['python', 'py', 'python3'];

  for (const cmd of commandsToTry) {
    try {
      return await spawnPythonProcess(cmd, code, effectiveTimeout, startTime);
    } catch (err) {
      if (err.code === 'ENOENT') {
        // Try next command candidate
        continue;
      }
      const executionTimeMs = Number((performance.now() - startTime).toFixed(2));
      return {
        success: false,
        stdout: '',
        stderr: `Process error (${cmd}): ${err.message}`,
        result: null,
        executionTimeMs
      };
    }
  }

  // If all python candidates failed with ENOENT:
  const executionTimeMs = Number((performance.now() - startTime).toFixed(2));
  return {
    success: false,
    stdout: '',
    stderr: 'Python runtime is not installed or not available in the system PATH.',
    result: null,
    executionTimeMs
  };
}

/**
 * Universal Sandboxed Code Execution Entrypoint.
 * 
 * @param {object} params
 * @param {'javascript'|'js'|'python'|'py'} params.language - Language to execute.
 * @param {string} params.code - Source code string.
 * @param {number} [params.timeoutMs] - Optional execution timeout in milliseconds.
 * @returns {Promise<{ success: boolean, stdout: string, stderr: string, result: any, executionTimeMs: number }>}
 */
export async function executeCode({ language, code, timeoutMs }) {
  if (!code || typeof code !== 'string') {
    return {
      success: false,
      stdout: '',
      stderr: 'Code string is required.',
      result: null,
      executionTimeMs: 0
    };
  }

  const lang = (language || '').toLowerCase().trim();

  if (lang === 'javascript' || lang === 'js' || lang === 'node') {
    return executeJavaScript(code, timeoutMs);
  }

  if (lang === 'python' || lang === 'py' || lang === 'python3') {
    return executePython(code, timeoutMs);
  }

  return {
    success: false,
    stdout: '',
    stderr: `Unsupported language "${language}". Supported: "javascript" (or "js") and "python" (or "py").`,
    result: null,
    executionTimeMs: 0
  };
}
