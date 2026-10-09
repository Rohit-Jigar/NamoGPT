/**
 * NamoGPT Model Context Protocol (MCP) Engine
 * Manages built-in and user-defined MCP servers, tools, and execution pipelines.
 */

const STORAGE_KEY_MCP = 'namogpt_mcp_servers_v1';

export const BUILT_IN_MCP_TOOLS = [
  {
    id: 'builtin-web-fetcher',
    name: 'mcp_web_fetcher',
    displayName: 'Web & Documentation Extractor',
    description: 'Fetches raw HTML/Markdown from any public webpage or API and extracts clean content.',
    version: '1.0.0',
    category: 'Information Retrieval',
    isBuiltin: true,
    enabled: true,
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'The absolute URL to fetch content from' },
        maxLength: { type: 'number', description: 'Maximum characters to return (default 4000)' }
      },
      required: ['url']
    },
    execute: async ({ url, maxLength = 4000 }) => {
      try {
        const cleanUrl = url.trim();
        // Use Wikipedia or proxy fetch
        const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(cleanUrl)}`;
        const res = await fetch(proxyUrl, { signal: AbortSignal.timeout(6000) });
        if (!res.ok) throw new Error(`HTTP error ${res.status}`);
        const text = await res.text();
        const stripped = text.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
                             .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
                             .replace(/<[^>]+>/g, ' ')
                             .replace(/\s+/g, ' ')
                             .trim();
        return {
          url: cleanUrl,
          contentLength: stripped.length,
          content: stripped.slice(0, maxLength) + (stripped.length > maxLength ? '... [truncated]' : '')
        };
      } catch (err) {
        return { error: `Failed to fetch URL: ${err.message}` };
      }
    }
  },
  {
    id: 'builtin-math-eval',
    name: 'mcp_math_evaluator',
    displayName: 'Mathematical & Financial Calculus',
    description: 'Evaluates complex arithmetic, statistical, trigonometric, and financial formulas safely.',
    version: '1.0.0',
    category: 'Computation',
    isBuiltin: true,
    enabled: true,
    inputSchema: {
      type: 'object',
      properties: {
        expression: { type: 'string', description: 'Mathematical expression (e.g., "Math.sqrt(144) * Math.sin(Math.PI/2) + 25")' }
      },
      required: ['expression']
    },
    execute: async ({ expression }) => {
      try {
        // Safe math evaluator using Function with sanitized Math scope
        const sanitized = expression.replace(/[^0-9+\-*/().Math, %^eEPIabscloqrtn]/g, '');
        const fn = new Function('Math', `return (${sanitized});`);
        const result = fn(Math);
        return {
          expression,
          result: Number(result),
          isFinite: Number.isFinite(result)
        };
      } catch (err) {
        return { error: `Calculation failed: ${err.message}` };
      }
    }
  },
  {
    id: 'builtin-temporal-clock',
    name: 'mcp_system_clock',
    displayName: 'Universal Precision Clock & Timezone Sync',
    description: 'Retrieves current microsecond epoch, formatted UTC time, user local time, and timezone offsets.',
    version: '1.0.0',
    category: 'System Telemetry',
    isBuiltin: true,
    enabled: true,
    inputSchema: {
      type: 'object',
      properties: {
        targetTimezone: { type: 'string', description: 'Optional timezone (e.g. "America/New_York", "Asia/Tokyo")' }
      }
    },
    execute: async ({ targetTimezone }) => {
      const now = new Date();
      const userTz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
      const effectiveTz = targetTimezone || userTz;
      try {
        const formatted = now.toLocaleString('en-US', {
          dateStyle: 'full',
          timeStyle: 'long',
          timeZone: effectiveTz
        });
        return {
          timestampMs: now.getTime(),
          isoUTC: now.toISOString(),
          timezone: effectiveTz,
          formattedLocalTime: formatted,
          dayOfWeek: now.toLocaleDateString('en-US', { weekday: 'long', timeZone: effectiveTz })
        };
      } catch (err) {
        return { error: err.message, fallbackIso: now.toISOString() };
      }
    }
  }
];

export function getMcpServers() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_MCP);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveMcpServers(servers) {
  try {
    localStorage.setItem(STORAGE_KEY_MCP, JSON.stringify(servers));
  } catch (err) {
    console.error('Failed to save MCP servers:', err);
  }
}

export function getAllMcpTools() {
  const custom = getMcpServers();
  return [...BUILT_IN_MCP_TOOLS, ...custom];
}

export function addCustomMcpTool({ name, displayName, description, endpoint, transport = 'http', inputSchema, authToken }) {
  const custom = getMcpServers();
  const newTool = {
    id: `mcp-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    name: name.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_'),
    displayName: displayName.trim(),
    description: description.trim(),
    endpoint: (endpoint || '').trim(),
    transport, // 'http' | 'sse' | 'local'
    authToken: (authToken || '').trim(),
    version: '1.0.0',
    category: 'Custom MCP',
    isBuiltin: false,
    enabled: true,
    inputSchema: typeof inputSchema === 'string' ? JSON.parse(inputSchema || '{}') : inputSchema || {
      type: 'object',
      properties: {}
    },
    createdAt: Date.now()
  };

  const updated = [newTool, ...custom];
  saveMcpServers(updated);
  return newTool;
}

export function deleteMcpTool(id) {
  const custom = getMcpServers();
  const updated = custom.filter(t => t.id !== id);
  saveMcpServers(updated);
  return updated;
}

export function toggleMcpTool(id, enabled) {
  const custom = getMcpServers();
  const updated = custom.map(t => t.id === id ? { ...t, enabled } : t);
  saveMcpServers(updated);
  return updated;
}

/**
 * Execute any registered MCP tool (built-in or remote)
 */
export async function executeMcpTool(toolId, args = {}) {
  const allTools = getAllMcpTools();
  const tool = allTools.find(t => t.id === toolId || t.name === toolId);

  if (!tool) {
    throw new Error(`MCP Tool "${toolId}" not found in registry.`);
  }

  // Built-in tool execution
  if (tool.isBuiltin && typeof tool.execute === 'function') {
    return await tool.execute(args);
  }

  // Remote MCP Server execution (HTTP / JSON-RPC)
  if (tool.endpoint) {
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };
    if (tool.authToken) {
      headers['Authorization'] = `Bearer ${tool.authToken}`;
    }

    const payload = {
      jsonrpc: '2.0',
      id: `call-${Date.now()}`,
      method: 'tools/call',
      params: {
        name: tool.name,
        arguments: args
      }
    };

    const res = await fetch(tool.endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      throw new Error(`MCP remote server returned HTTP ${res.status}`);
    }

    const data = await res.json();
    return data.result || data;
  }

  throw new Error(`MCP Tool "${tool.name}" has no runnable handler or endpoint configured.`);
}

/**
 * Formats active MCP tools for inclusion in model context instructions.
 * ONLY provides structured machine definitions if tools are actively requested.
 * Does NOT inject conversational suggestions or tool chatter.
 */
export function formatMcpToolsPrompt(requested = false) {
  // Only inject if tools are explicitly requested
  const isActivelyRequested = typeof requested === 'boolean'
    ? requested
    : typeof requested === 'string'
      ? /\b(mcp|call tool|use tool|run tool|invoke tool|list tools)\b/i.test(requested)
      : Boolean(requested?.requested);

  if (!isActivelyRequested) {
    return '';
  }

  const activeTools = getAllMcpTools().filter(t => t.enabled !== false);
  if (activeTools.length === 0) return '';

  let prompt = '=== MODEL CONTEXT PROTOCOL (MCP) TOOL SPECIFICATIONS ===\n';
  prompt += 'CRITICAL: The following are strictly internal machine-executable tool specifications. Do NOT mention these tools, tool names (e.g. mcp_web_fetcher), or internal capabilities to the user in conversational responses unless explicitly asked about tools. Do NOT offer unsolicited code, tutorials, or scripts to the user.\n\n';

  activeTools.forEach(t => {
    prompt += `Tool: ${t.name}\n`;
    prompt += `Description: ${t.description}\n`;
    prompt += `Schema: ${JSON.stringify(t.inputSchema)}\n\n`;
  });

  prompt += '================================================';
  return prompt;
}
