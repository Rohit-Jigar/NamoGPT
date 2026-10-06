import React, { useState, useEffect } from 'react';
import {
  Cpu,
  Plus,
  Play,
  Trash2,
  X,
  Check,
  Globe,
  Calculator,
  Clock,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  ExternalLink,
  Code2,
  Terminal,
  HelpCircle,
  Layers,
  CheckCircle2,
  AlertCircle,
  Loader2
} from 'lucide-react';
import {
  getAllMcpTools,
  addCustomMcpTool,
  deleteMcpTool,
  toggleMcpTool,
  executeMcpTool
} from '../services/mcp';

export default function McpModal({ isOpen, onClose }) {
  const [tools, setTools] = useState([]);
  const [activeTab, setActiveTab] = useState('directory'); // 'directory' | 'create' | 'playground'

  // Creation form state
  const [name, setName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [description, setDescription] = useState('');
  const [endpoint, setEndpoint] = useState('');
  const [transport, setTransport] = useState('http');
  const [schemaText, setSchemaText] = useState('{\n  "type": "object",\n  "properties": {\n    "query": { "type": "string" }\n  },\n  "required": ["query"]\n}');
  const [authToken, setAuthToken] = useState('');
  const [createError, setCreateError] = useState('');

  // Playground state
  const [selectedToolId, setSelectedToolId] = useState('');
  const [playgroundArgs, setPlaygroundArgs] = useState('{}');
  const [playgroundOutput, setPlaygroundOutput] = useState(null);
  const [isRunning, setIsRunning] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const all = getAllMcpTools();
      setTools(all);
      if (all.length > 0 && !selectedToolId) {
        setSelectedToolId(all[0].id);
        if (all[0].id === 'builtin-math-eval') {
          setPlaygroundArgs('{\n  "expression": "Math.sqrt(256) * 10 + 42"\n}');
        } else if (all[0].id === 'builtin-web-fetcher') {
          setPlaygroundArgs('{\n  "url": "https://en.wikipedia.org/wiki/Artificial_intelligence",\n  "maxLength": 500\n}');
        } else {
          setPlaygroundArgs('{}');
        }
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  function refreshTools() {
    setTools(getAllMcpTools());
  }

  function handleToggle(id, currentEnabled) {
    toggleMcpTool(id, !currentEnabled);
    refreshTools();
  }

  function handleDelete(id) {
    if (window.confirm('Delete this custom MCP tool?')) {
      deleteMcpTool(id);
      refreshTools();
    }
  }

  function handleCreateTool() {
    setCreateError('');
    if (!name.trim() || !displayName.trim()) {
      setCreateError('Tool Name and Display Name are required.');
      return;
    }

    let parsedSchema = {};
    try {
      parsedSchema = JSON.parse(schemaText);
    } catch (e) {
      setCreateError('Invalid JSON format for Input Schema.');
      return;
    }

    try {
      addCustomMcpTool({
        name,
        displayName,
        description,
        endpoint,
        transport,
        inputSchema: parsedSchema,
        authToken
      });
      refreshTools();
      setName('');
      setDisplayName('');
      setDescription('');
      setEndpoint('');
      setAuthToken('');
      setActiveTab('directory');
    } catch (err) {
      setCreateError(err.message);
    }
  }

  async function handleExecutePlayground() {
    setIsRunning(true);
    setPlaygroundOutput(null);
    const startTime = performance.now();

    let args = {};
    try {
      args = JSON.parse(playgroundArgs);
    } catch (err) {
      setPlaygroundOutput({ error: `Arguments JSON syntax error: ${err.message}` });
      setIsRunning(false);
      return;
    }

    try {
      const res = await executeMcpTool(selectedToolId, args);
      const elapsed = Math.round(performance.now() - startTime);
      setPlaygroundOutput({ success: true, executionTimeMs: elapsed, result: res });
    } catch (err) {
      const elapsed = Math.round(performance.now() - startTime);
      setPlaygroundOutput({ success: false, executionTimeMs: elapsed, error: err.message });
    } finally {
      setIsRunning(false);
    }
  }

  const getToolIcon = (tool) => {
    if (tool.id === 'builtin-web-fetcher') return <Globe className="w-4 h-4 text-blue-400" />;
    if (tool.id === 'builtin-math-eval') return <Calculator className="w-4 h-4 text-emerald-400" />;
    if (tool.id === 'builtin-temporal-clock') return <Clock className="w-4 h-4 text-purple-400" />;
    return <Cpu className="w-4 h-4 text-amber-400" />;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#1e1e1e] border border-zinc-700/80 rounded-2xl w-full max-w-4xl max-h-[88vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between bg-[#181818]">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
              <Cpu className="w-4 h-4 text-indigo-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-white">Model Context Protocol (MCP)</h2>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  {tools.length} Tools
                </span>
              </div>
              <p className="text-xs text-zinc-400">
                Connect external MCP servers, build custom tools, and extend AI capabilities
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-zinc-800 bg-[#161616] px-5">
          <button
            onClick={() => setActiveTab('directory')}
            className={`py-2.5 px-4 text-xs font-semibold border-b-2 transition-all ${
              activeTab === 'directory'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-zinc-400 hover:text-white'
            }`}
          >
            Tool Directory ({tools.length})
          </button>
          <button
            onClick={() => setActiveTab('create')}
            className={`py-2.5 px-4 text-xs font-semibold border-b-2 flex items-center gap-1.5 transition-all ${
              activeTab === 'create'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-zinc-400 hover:text-white'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            Create / Connect MCP Tool
          </button>
          <button
            onClick={() => setActiveTab('playground')}
            className={`py-2.5 px-4 text-xs font-semibold border-b-2 flex items-center gap-1.5 transition-all ${
              activeTab === 'playground'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-zinc-400 hover:text-white'
            }`}
          >
            <Play className="w-3.5 h-3.5" />
            Live Playground
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {/* TAB 1: Directory */}
          {activeTab === 'directory' && (
            <div className="space-y-4">
              <div className="text-xs text-zinc-400 flex items-center justify-between">
                <span>Active & Configured MCP Tools</span>
                <span className="text-zinc-500 text-[11px]">Enabled tools are automatically injected into AI context</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {tools.map((t) => (
                  <div
                    key={t.id}
                    className="p-4 rounded-xl bg-[#151515] hover:bg-[#1a1a1a] border border-zinc-800 transition-all flex flex-col justify-between group"
                  >
                    <div>
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center space-x-2.5">
                          <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center">
                            {getToolIcon(t)}
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-white flex items-center gap-1.5">
                              <span>{t.displayName || t.name}</span>
                              {t.isBuiltin && (
                                <span className="text-[9px] uppercase font-bold px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                                  Built-in
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-zinc-500 font-mono">
                              {t.name} • {t.category || 'MCP Tool'}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center space-x-1">
                          <button
                            onClick={() => handleToggle(t.id, t.enabled !== false)}
                            className={`p-1 rounded-lg transition-colors ${
                              t.enabled !== false ? 'text-emerald-400' : 'text-zinc-600'
                            }`}
                            title={t.enabled !== false ? 'Tool active (click to disable)' : 'Tool disabled (click to enable)'}
                          >
                            {t.enabled !== false ? (
                              <ToggleRight className="w-5 h-5 fill-emerald-500/20" />
                            ) : (
                              <ToggleLeft className="w-5 h-5" />
                            )}
                          </button>
                          {!t.isBuiltin && (
                            <button
                              onClick={() => handleDelete(t.id)}
                              className="p-1 text-zinc-500 hover:text-rose-400 rounded-lg hover:bg-zinc-800 transition-colors"
                              title="Delete MCP tool"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      <p className="text-xs text-zinc-400 line-clamp-2 leading-relaxed mb-3">
                        {t.description}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-zinc-800/80 flex items-center justify-between text-[11px]">
                      <span className="text-zinc-500 font-mono">
                        {t.endpoint ? t.endpoint.slice(0, 28) + '...' : 'Local Sandbox Engine'}
                      </span>
                      <button
                        onClick={() => {
                          setSelectedToolId(t.id);
                          if (t.id === 'builtin-math-eval') {
                            setPlaygroundArgs('{\n  "expression": "Math.sqrt(256) * 10 + 42"\n}');
                          } else if (t.id === 'builtin-web-fetcher') {
                            setPlaygroundArgs('{\n  "url": "https://en.wikipedia.org/wiki/Artificial_intelligence",\n  "maxLength": 500\n}');
                          } else {
                            setPlaygroundArgs('{}');
                          }
                          setActiveTab('playground');
                        }}
                        className="text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1"
                      >
                        <Play className="w-3 h-3 fill-current" /> Test Tool
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 2: Create Custom Tool */}
          {activeTab === 'create' && (
            <div className="space-y-4 max-w-xl mx-auto py-2">
              {createError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{createError}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">
                    Tool Identifier (Identifier) *
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. sql_query_runner"
                    className="w-full bg-[#141414] border border-zinc-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 outline-none focus:border-indigo-500 font-mono transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">
                    Display Name *
                  </label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="e.g. Postgres DB Query Runner"
                    className="w-full bg-[#141414] border border-zinc-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 outline-none focus:border-indigo-500 transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  Tool Description
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Explains to the AI when and how to call this tool"
                  className="w-full bg-[#141414] border border-zinc-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 outline-none focus:border-indigo-500 transition-colors"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">
                    MCP Server Endpoint (URL)
                  </label>
                  <input
                    type="text"
                    value={endpoint}
                    onChange={(e) => setEndpoint(e.target.value)}
                    placeholder="e.g. http://localhost:8080/mcp or https://api.myserver.com/rpc"
                    className="w-full bg-[#141414] border border-zinc-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 outline-none focus:border-indigo-500 font-mono transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">
                    Transport
                  </label>
                  <select
                    value={transport}
                    onChange={(e) => setTransport(e.target.value)}
                    className="w-full bg-[#141414] border border-zinc-700 rounded-xl px-3 py-2.5 text-xs text-white outline-none focus:border-indigo-500 transition-colors"
                  >
                    <option value="http">HTTP JSON-RPC</option>
                    <option value="sse">SSE Stream</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  Auth Bearer Token (Optional)
                </label>
                <input
                  type="password"
                  value={authToken}
                  onChange={(e) => setAuthToken(e.target.value)}
                  placeholder="Bearer token if remote MCP requires authentication"
                  className="w-full bg-[#141414] border border-zinc-700 rounded-xl px-3.5 py-2 text-xs text-white placeholder-zinc-500 outline-none focus:border-indigo-500 font-mono transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  Input Parameter Schema (JSON Schema)
                </label>
                <textarea
                  rows={4}
                  value={schemaText}
                  onChange={(e) => setSchemaText(e.target.value)}
                  className="w-full bg-[#141414] border border-zinc-700 rounded-xl p-3 text-xs text-emerald-300 placeholder-zinc-500 outline-none focus:border-indigo-500 font-mono transition-colors"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  onClick={() => setActiveTab('directory')}
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold text-zinc-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateTool}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/20 flex items-center gap-1.5 transition-all"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Register MCP Tool</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: Playground */}
          {activeTab === 'playground' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Left: Tool Selection & Input Parameters */}
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-300 mb-1">
                      Select Target MCP Tool
                    </label>
                    <select
                      value={selectedToolId}
                      onChange={(e) => {
                        setSelectedToolId(e.target.value);
                        if (e.target.value === 'builtin-math-eval') {
                          setPlaygroundArgs('{\n  \"expression\": \"Math.sqrt(256) * 10 + 42\"\n}');
                        } else if (e.target.value === 'builtin-web-fetcher') {
                          setPlaygroundArgs('{\n  \"url\": \"https://en.wikipedia.org/wiki/Artificial_intelligence\",\n  \"maxLength\": 500\n}');
                        } else {
                          setPlaygroundArgs('{}');
                        }
                      }}
                      className="w-full bg-[#141414] border border-zinc-700 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none focus:border-indigo-500 transition-colors"
                    >
                      {tools.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.displayName || t.name} ({t.name})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-300 mb-1">
                      JSON Input Arguments
                    </label>
                    <textarea
                      rows={9}
                      value={playgroundArgs}
                      onChange={(e) => setPlaygroundArgs(e.target.value)}
                      className="w-full bg-[#141414] border border-zinc-700 rounded-xl p-3 text-xs text-emerald-300 font-mono outline-none focus:border-indigo-500 transition-colors"
                    />
                  </div>

                  <button
                    onClick={handleExecutePlayground}
                    disabled={isRunning}
                    className={`w-full py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                      isRunning
                        ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                        : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/20'
                    }`}
                  >
                    {isRunning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                    <span>{isRunning ? 'Executing MCP Tool...' : 'Execute Tool Payload'}</span>
                  </button>
                </div>

                {/* Right: Output Console */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-semibold text-zinc-300">
                      Execution Result (Live Output)
                    </label>
                    {playgroundOutput?.executionTimeMs !== undefined && (
                      <span className="text-[10px] text-zinc-500 font-mono">
                        Latency: {playgroundOutput.executionTimeMs}ms
                      </span>
                    )}
                  </div>

                  <div className="p-4 rounded-xl bg-[#121212] border border-zinc-800 h-[260px] overflow-y-auto font-mono text-xs select-text">
                    {playgroundOutput ? (
                      <pre className={`whitespace-pre-wrap ${playgroundOutput.error ? 'text-rose-400' : 'text-zinc-200'}`}>
                        {JSON.stringify(playgroundOutput, null, 2)}
                      </pre>
                    ) : (
                      <div className="h-full flex items-center justify-center text-zinc-600 text-xs">
                        Output payload will appear here after execution...
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-zinc-800 flex items-center justify-between bg-[#181818]">
          <div className="text-[11px] text-zinc-500">
            Compliant with Anthropic & Open Source Model Context Protocol Specification
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-white transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
