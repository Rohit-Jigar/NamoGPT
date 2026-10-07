/**
 * NamoGPT Modular Plugin Registry & Dispatcher
 */

import { webSearchPlugin } from './web_search.js';
import { mcpWebFetcherPlugin } from './mcp_web_fetcher.js';
import { weatherPlugin } from './weather.js';
import { mathEvalPlugin } from './math_eval.js';

const registry = new Map();

/**
 * Register a plugin into the central catalog
 */
export function registerPlugin(plugin) {
  if (!plugin || !plugin.name || typeof plugin.name !== 'string') {
    throw new Error('Plugin must specify a valid "name".');
  }
  if (typeof plugin.handler !== 'function') {
    throw new Error(`Plugin "${plugin.name}" must provide an async handler function.`);
  }

  registry.set(plugin.name, {
    name: plugin.name,
    description: plugin.description || '',
    parameters: plugin.parameters || { type: 'object', properties: {} },
    handler: plugin.handler
  });
}

/**
 * Retrieve a registered plugin by name
 */
export function getPlugin(name) {
  if (!name || typeof name !== 'string') return null;
  return registry.get(name.trim()) || null;
}

/**
 * List all available registered plugins and their parameter schemas
 */
export function listPlugins() {
  const list = [];
  for (const [name, plugin] of registry.entries()) {
    list.push({
      name,
      description: plugin.description,
      parameters: plugin.parameters
    });
  }
  return list;
}

/**
 * Invoke a plugin by name with supplied arguments
 */
export async function invokePlugin(name, args = {}) {
  if (!name || typeof name !== 'string') {
    throw new Error('Plugin name must be a non-empty string.');
  }

  const cleanName = name.trim();
  const plugin = getPlugin(cleanName);

  if (!plugin) {
    const available = Array.from(registry.keys()).join(', ');
    throw new Error(`Plugin "${cleanName}" not found. Available plugins: ${available}`);
  }

  return await plugin.handler(args);
}

// Pre-register default core plugins
registerPlugin(webSearchPlugin);
registerPlugin(mcpWebFetcherPlugin);
registerPlugin(weatherPlugin);
registerPlugin(mathEvalPlugin);

export default {
  registerPlugin,
  getPlugin,
  listPlugins,
  invokePlugin
};
