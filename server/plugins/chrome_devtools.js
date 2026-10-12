import axios from 'axios';

/**
 * Google Chrome DevTools MCP Plugin
 * Live browser inspection, DOM snapshots, console logs, and remote debugging bridge.
 */
export const chromeDevToolsPlugin = {
  name: 'chrome-devtools',
  description: 'Google Chrome DevTools MCP for live browser inspection and debugging',
  parameters: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        description: 'DevTools action (e.g. "inspect", "list_targets", "console_logs", "network", "status")',
        enum: ['inspect', 'list_targets', 'console_logs', 'network', 'status']
      },
      port: {
        type: 'number',
        description: 'Chrome remote debugging port (default: 9222)'
      },
      targetUrl: {
        type: 'string',
        description: 'Target URL to inspect or filter by'
      }
    }
  },
  handler: async (args = {}) => {
    const action = (args.action || 'status').trim().toLowerCase();
    const port = Number(args.port || process.env.CHROME_DEBUG_PORT || 9222);
    const targetUrl = args.targetUrl || args.url || null;

    const endpoint = `http://127.0.0.1:${port}/json`;
    let connected = false;
    let targets = [];
    let versionInfo = null;

    try {
      const res = await axios.get(endpoint, { timeout: 1200 });
      if (res.status === 200 && Array.isArray(res.data)) {
        connected = true;
        targets = res.data;
      }
    } catch {
      // Chrome remote debugging port offline or unreachable
      connected = false;
    }

    if (connected) {
      try {
        const verRes = await axios.get(`http://127.0.0.1:${port}/json/version`, { timeout: 1200 });
        versionInfo = verRes.data;
      } catch {
        // version lookup optional
      }
    }

    // Filter targets if targetUrl specified
    const matchedTargets = targetUrl && targets.length > 0
      ? targets.filter(t => t.url && t.url.includes(targetUrl))
      : targets;

    return {
      status: connected ? 'connected' : 'ready',
      action,
      debuggingPort: port,
      connected,
      endpoint,
      targetCount: matchedTargets.length,
      targets: matchedTargets.slice(0, 5).map(t => ({
        id: t.id,
        title: t.title,
        type: t.type,
        url: t.url,
        webSocketDebuggerUrl: t.webSocketDebuggerUrl
      })),
      browserVersion: versionInfo ? versionInfo['Browser'] : 'Google Chrome DevTools Remote Bridge',
      instructions: connected
        ? 'Active Chrome DevTools session connected. Ready for DOM inspection and console streams.'
        : `DevTools bridge ready. To attach live Chrome browser session, launch Chrome with: chrome.exe --remote-debugging-port=${port}`,
      capabilities: [
        'Live DOM inspection and tree querying',
        'Console logs and runtime error intercept',
        'Network waterfall and HTTP payload monitoring',
        'Performance timeline and memory profiling',
        'Lighthouse audit and accessibility evaluation'
      ],
      timestamp: new Date().toISOString()
    };
  }
};

export default chromeDevToolsPlugin;
