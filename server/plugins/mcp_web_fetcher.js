import { fetchUrlContent } from '../search.js';

/**
 * MCP Web Fetcher Plugin
 * Real-time webpage content scraper & text cleaner with entity decoding.
 */
export const mcpWebFetcherPlugin = {
  name: 'mcp_web_fetcher',
  description: 'Real-time webpage content scraper & text cleaner with HTML entity decoding',
  parameters: {
    type: 'object',
    properties: {
      url: {
        type: 'string',
        description: 'The target webpage URL to fetch and clean'
      }
    },
    required: ['url']
  },
  handler: async (args = {}) => {
    const rawUrl = typeof args === 'string' ? args : (args.url || args.targetUrl);
    if (!rawUrl || typeof rawUrl !== 'string' || !rawUrl.trim()) {
      throw new Error('Valid URL parameter is required.');
    }

    return await fetchUrlContent(rawUrl.trim());
  }
};

export default mcpWebFetcherPlugin;
