import { searchWeb } from '../search.js';

/**
 * Web Search Plugin
 * Real-time multi-provider search across Tavily, Serper, DuckDuckGo, and Wikipedia.
 */
export const webSearchPlugin = {
  name: 'web_search',
  description: 'Real-time multi-provider internet search across Tavily, Serper, DuckDuckGo, and Wikipedia',
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'The search query to look up on the web'
      },
      limit: {
        type: 'number',
        description: 'Maximum number of search results to return (default: 5, max: 10)'
      }
    },
    required: ['query']
  },
  handler: async (args = {}) => {
    const rawQuery = typeof args === 'string' ? args : (args.query || args.q);
    if (!rawQuery || typeof rawQuery !== 'string' || !rawQuery.trim()) {
      throw new Error('Search query is required.');
    }

    const limit = Math.max(1, Math.min(Number(args.limit) || 5, 10));
    const cleanQuery = rawQuery.trim();
    const results = await searchWeb(cleanQuery, limit);

    return {
      query: cleanQuery,
      count: results.length,
      results
    };
  }
};

export default webSearchPlugin;
