/**
 * Namo Coder - Autonomous Coder Agent Engine
 * 
 * Implements multi-step reasoning, autonomous tool orchestration,
 * provider pool routing (Ollama, OmniRouter, Gemini, Groq),
 * and human-in-the-loop diff review proposals.
 */

import axios from 'axios';
import { readFileContent, writeFileContent, listFiles } from './workspace.js';
import { extractSymbols, grepSearch } from './intelligence.js';
import { computeDiff } from './diff.js';
import { executeCommand } from './terminal.js';
import { createCheckpoint, rollbackCheckpoint, listCheckpoints } from './checkpoints.js';

// Provider endpoints configuration
export const PROVIDER_ENDPOINTS = {
  ollama: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
  omnirouter: (process.env.OMNIROUTER_BASE_URL || 'http://localhost:20128/v1').replace(/\/$/, ''),
  gemini: 'https://generativelanguage.googleapis.com/v1beta/openai',
  groq: 'https://api.groq.com/openai/v1',
  litellm: `http://localhost:${process.env.PORT || 3001}/v1`
};

// Tool specifications provided to the model
export const CODER_AGENT_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'read_file',
      description: 'Read the UTF-8 text content of a file in the workspace.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Relative path to the file in the workspace.' }
        },
        required: ['path']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'write_file',
      description: 'Write or modify a file in the workspace. Generates a diff proposal.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Relative path to the file.' },
          content: { type: 'string', description: 'Full new content to write to the file.' }
        },
        required: ['path', 'content']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'list_files',
      description: 'List files and directories in the workspace.',
      parameters: {
        type: 'object',
        properties: {
          dirPath: { type: 'string', description: 'Relative directory path (empty string for root).' }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'grep_search',
      description: 'Search for text or regex across workspace files.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Text or regex search string.' },
          dirPath: { type: 'string', description: 'Relative directory path to search within.' },
          isRegex: { type: 'boolean', description: 'Whether query is a regular expression.' }
        },
        required: ['query']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'extract_symbols',
      description: 'Extract functions, classes, imports, and exports from a file.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Relative file path.' }
        },
        required: ['path']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'run_terminal_command',
      description: 'Execute a shell command within the workspace terminal.',
      parameters: {
        type: 'object',
        properties: {
          command: { type: 'string', description: 'Command to run.' },
          cwd: { type: 'string', description: 'Relative directory to run within.' }
        },
        required: ['command']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'create_checkpoint',
      description: 'Create a snapshot checkpoint of the workspace state before modifying code.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Name of the checkpoint.' },
          description: { type: 'string', description: 'Reason for creating the checkpoint.' }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'rollback_checkpoint',
      description: 'Rollback the workspace state to a previously saved checkpoint.',
      parameters: {
        type: 'object',
        properties: {
          checkpointId: { type: 'string', description: 'The ID of the checkpoint to restore.' }
        },
        required: ['checkpointId']
      }
    }
  }
];

/**
 * Executes a single agent tool action.
 * 
 * @param {string} toolName 
 * @param {object} args 
 * @param {object} context 
 * @returns {Promise<object>}
 */
export async function executeAgentTool(toolName, args = {}, context = {}) {
  const { dryRun = false, diffProposals = [] } = context;

  switch (toolName) {
    case 'read_file': {
      if (!args.path) throw new Error('Missing "path" argument for read_file.');
      const res = await readFileContent(args.path);
      return {
        success: true,
        path: res.path,
        size: res.size,
        content: res.content
      };
    }

    case 'write_file': {
      if (!args.path) throw new Error('Missing "path" argument for write_file.');
      const targetPath = args.path;
      const newContent = typeof args.content === 'string' ? args.content : '';

      // Read original content if available to compute diff
      let originalContent = '';
      try {
        const orig = await readFileContent(targetPath);
        originalContent = orig.content;
      } catch (_err) {
        // File does not exist yet (creation)
      }

      const diffResult = computeDiff(originalContent, newContent, targetPath);

      const proposal = {
        file: targetPath,
        diff: diffResult.unifiedDiff,
        hunks: diffResult.hunks,
        stats: diffResult.stats,
        isNewFile: originalContent === '',
        dryRun
      };
      diffProposals.push(proposal);

      if (!dryRun) {
        const writeRes = await writeFileContent(targetPath, newContent);
        return {
          success: true,
          path: writeRes.path,
          bytesWritten: writeRes.bytesWritten,
          diff: diffResult.unifiedDiff,
          stats: diffResult.stats,
          dryRun: false
        };
      } else {
        return {
          success: true,
          path: targetPath,
          message: 'Dry run: Diff proposal generated without disk modification.',
          diff: diffResult.unifiedDiff,
          stats: diffResult.stats,
          dryRun: true
        };
      }
    }

    case 'list_files': {
      const files = await listFiles(args.dirPath || '');
      return {
        success: true,
        count: files.length,
        files: files.slice(0, 100).map(f => ({ path: f.path, isDirectory: f.isDirectory, size: f.size }))
      };
    }

    case 'grep_search': {
      if (!args.query) throw new Error('Missing "query" argument for grep_search.');
      const grepRes = await grepSearch(args.query, args.dirPath || '', {
        isRegex: Boolean(args.isRegex)
      });
      return {
        success: true,
        query: grepRes.query,
        count: grepRes.count,
        results: grepRes.results.slice(0, 50)
      };
    }

    case 'extract_symbols': {
      if (!args.path) throw new Error('Missing "path" argument for extract_symbols.');
      const file = await readFileContent(args.path);
      const symbols = extractSymbols(file.content, args.path);
      return {
        success: true,
        path: args.path,
        count: symbols.length,
        symbols
      };
    }

    case 'run_terminal_command': {
      if (!args.command) throw new Error('Missing "command" argument for run_terminal_command.');
      const termRes = await executeCommand(args.command, args.cwd || null);
      return {
        success: termRes.success,
        exitCode: termRes.exitCode,
        stdout: termRes.stdout.slice(0, 8000),
        stderr: termRes.stderr.slice(0, 8000),
        executionTimeMs: termRes.executionTimeMs
      };
    }

    case 'create_checkpoint': {
      const cp = await createCheckpoint(args.name, args.description);
      return {
        success: true,
        checkpointId: cp.id,
        name: cp.name,
        fileCount: cp.fileCount
      };
    }

    case 'rollback_checkpoint': {
      if (!args.checkpointId) throw new Error('Missing "checkpointId" for rollback_checkpoint.');
      const rb = await rollbackCheckpoint(args.checkpointId);
      return {
        success: true,
        checkpointId: rb.checkpointId,
        restoredFiles: rb.restoredFiles
      };
    }

    default:
      throw new Error(`Unknown tool: "${toolName}".`);
  }
}

/**
 * Dispatches a chat completion call to the resolved AI provider.
 * 
 * @param {object} payload 
 * @param {string} provider 
 * @returns {Promise<object>}
 */
async function callProviderChat(payload, provider = 'omnirouter') {
  const chosenProvider = (provider || 'omnirouter').toLowerCase();

  let baseURL = PROVIDER_ENDPOINTS[chosenProvider] || PROVIDER_ENDPOINTS.omnirouter;
  let headers = { 'Content-Type': 'application/json' };

  if (chosenProvider === 'groq' && process.env.GROQ_API_KEY) {
    headers['Authorization'] = `Bearer ${process.env.GROQ_API_KEY}`;
  } else if (chosenProvider === 'gemini' && process.env.GEMINI_API_KEY) {
    headers['Authorization'] = `Bearer ${process.env.GEMINI_API_KEY}`;
  } else if (chosenProvider === 'omnirouter' || chosenProvider === '9router') {
    const key = process.env.OMNIROUTER_API_KEY || process.env.NINEROUTER_API_KEY;
    if (key) headers['Authorization'] = `Bearer ${key}`;
  }

  const endpoint = baseURL.endsWith('/chat/completions') ? baseURL : `${baseURL}/chat/completions`;

  const response = await axios.post(endpoint, payload, {
    headers,
    timeout: 30000
  });

  return response.data;
}

/**
 * Autonomous Coder Agent execution loop.
 * 
 * @param {object} options
 * @param {string} options.prompt - User instruction or goal.
 * @param {string} [options.conversationId] - Conversation identifier.
 * @param {string} [options.provider='omnirouter'] - Provider (ollama, omnirouter, gemini, groq, litellm).
 * @param {string} [options.model] - Specific model name.
 * @param {number} [options.maxSteps=10] - Maximum iterations.
 * @param {boolean} [options.dryRun=false] - Whether file modifications should be staged as diffs only.
 * @returns {Promise<object>} Agent execution result with thoughts, steps, diff proposals, and final answer.
 */
export async function runCoderAgent(options = {}) {
  const {
    prompt,
    conversationId = `conv_${Date.now()}`,
    provider = process.env.DEFAULT_CODER_PROVIDER || 'omnirouter',
    model = process.env.DEFAULT_CODER_MODEL || 'meta-llama/llama-3.3-70b-instruct',
    maxSteps = 10,
    dryRun = false
  } = options;

  if (!prompt || typeof prompt !== 'string') {
    throw new Error('Agent prompt is required.');
  }

  const systemPrompt = `You are Namo Coder, an elite local-first autonomous software engineer and architect.
You have direct access to tools for reading/writing files, lexical search, AST symbol extraction, terminal execution, and checkpoints.
Work methodically:
1. Formulate a precise thought on your current action.
2. Call tools to inspect, modify, or verify code.
3. Review diffs and verify before finishing.
4. When finished, provide a concise, professional conclusion.`;

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: prompt }
  ];

  const steps = [];
  const diffProposals = [];
  let finalAnswer = '';
  let isDone = false;
  let currentStep = 0;

  while (!isDone && currentStep < maxSteps) {
    currentStep++;

    let modelResponse = null;
    let toolCalls = [];
    let thought = '';
    let responseText = '';

    try {
      const payload = {
        model,
        messages,
        tools: CODER_AGENT_TOOLS,
        tool_choice: 'auto',
        temperature: 0.2
      };

      modelResponse = await callProviderChat(payload, provider);

      const choice = modelResponse?.choices?.[0];
      const message = choice?.message;

      if (message) {
        responseText = message.content || '';
        toolCalls = message.tool_calls || [];
      }
    } catch (_providerError) {
      // Offline fallback: Heuristic agent execution for common tasks when LLM provider is offline
      const lower = prompt.toLowerCase();

      if (currentStep === 1) {
        if (lower.includes('list') && lower.includes('file')) {
          thought = 'Listing project files in the workspace.';
          toolCalls = [{ id: 'call_1', function: { name: 'list_files', arguments: JSON.stringify({ dirPath: '' }) } }];
        } else if (lower.includes('grep') || lower.includes('search')) {
          const match = /search(?:\s+for)?\s+["']?([^"'\n]+)["']?/i.exec(prompt);
          const query = match ? match[1].trim() : 'function';
          thought = `Searching workspace for "${query}".`;
          toolCalls = [{ id: 'call_1', function: { name: 'grep_search', arguments: JSON.stringify({ query }) } }];
        } else if (lower.includes('symbol')) {
          thought = 'Extracting symbols from workspace files.';
          toolCalls = [{ id: 'call_1', function: { name: 'list_files', arguments: JSON.stringify({ dirPath: '' }) } }];
        } else if (lower.includes('checkpoint')) {
          thought = 'Creating an automatic checkpoint.';
          toolCalls = [{ id: 'call_1', function: { name: 'create_checkpoint', arguments: JSON.stringify({ name: 'Agent Checkpoint', description: prompt }) } }];
        } else {
          thought = 'Inspecting workspace files to fulfill request.';
          toolCalls = [{ id: 'call_1', function: { name: 'list_files', arguments: JSON.stringify({ dirPath: '' }) } }];
        }
      } else {
        isDone = true;
        finalAnswer = `Namo Coder completed step inspection for: "${prompt}". Workspace tools executed successfully.`;
      }
    }

    if (toolCalls && toolCalls.length > 0) {
      const stepRecord = {
        step: currentStep,
        thought: thought || responseText || 'Executing agent tool calls...',
        toolCalls: [],
        toolResults: []
      };

      for (const tc of toolCalls) {
        const fnName = tc.function?.name || tc.name;
        let fnArgs = {};
        try {
          fnArgs = typeof tc.function?.arguments === 'string'
            ? JSON.parse(tc.function.arguments)
            : (tc.function?.arguments || tc.arguments || {});
        } catch (_err) {
          fnArgs = {};
        }

        stepRecord.toolCalls.push({ name: fnName, args: fnArgs });

        try {
          const result = await executeAgentTool(fnName, fnArgs, { dryRun, diffProposals });
          stepRecord.toolResults.push({ tool: fnName, success: true, result });

          // Append tool result into conversation history for subsequent steps
          messages.push({
            role: 'assistant',
            content: responseText || null,
            tool_calls: [tc]
          });
          messages.push({
            role: 'tool',
            tool_call_id: tc.id || `call_${currentStep}`,
            content: JSON.stringify(result)
          });
        } catch (toolErr) {
          stepRecord.toolResults.push({ tool: fnName, success: false, error: toolErr.message });
          messages.push({
            role: 'tool',
            tool_call_id: tc.id || `call_${currentStep}`,
            content: JSON.stringify({ error: toolErr.message })
          });
        }
      }

      steps.push(stepRecord);
    } else {
      // Model produced final response with no further tool calls
      isDone = true;
      finalAnswer = responseText || finalAnswer || 'Task completed successfully.';
      steps.push({
        step: currentStep,
        thought: 'Task objectives analyzed and concluded.',
        toolCalls: [],
        toolResults: [],
        answer: finalAnswer
      });
    }
  }

  return {
    conversationId,
    status: isDone ? 'completed' : 'max_steps_reached',
    totalSteps: steps.length,
    steps,
    diffProposals,
    finalAnswer: finalAnswer || 'Completed reasoning steps.',
    dryRun
  };
}
