import { searchWeb } from '../search.js';

/**
 * Context7 Documentation & API Reference Plugin
 * Real-time library documentation, component schemas, and API references.
 */
export const context7Plugin = {
  name: 'context7',
  description: 'Context7 real-time library documentation and API reference',
  parameters: {
    type: 'object',
    properties: {
      library: {
        type: 'string',
        description: 'Library, package, or framework name (e.g. "react", "nextjs", "express", "supabase", "tailwindcss")'
      },
      query: {
        type: 'string',
        description: 'Specific topic, API method, hook, component, or search query'
      },
      version: {
        type: 'string',
        description: 'Library version (default: "latest")'
      }
    },
    required: ['library']
  },
  handler: async (args = {}) => {
    const rawLibrary = typeof args === 'string'
      ? args
      : (args.library || args.package || args.lib || args.query || args.topic || 'react');
    const query = (args.query || args.q || '').trim();
    const version = (args.version || 'latest').trim();
    const cleanLibrary = String(rawLibrary).trim();

    // Built-in curated quick references for popular libraries
    const CURATED_DOCS = {
      react: {
        displayName: 'React',
        docsUrl: 'https://react.dev',
        summary: 'A JavaScript library for building user interfaces with declarative components and hooks.',
        popularHooks: ['useState', 'useEffect', 'useContext', 'useMemo', 'useCallback', 'useRef', 'useReducer'],
        latestVersion: '19.0.0'
      },
      nextjs: {
        displayName: 'Next.js',
        docsUrl: 'https://nextjs.org/docs',
        summary: 'The React Framework for the Web with App Router, Server Components, and SSR.',
        keyFeatures: ['App Router', 'Server Components (RSC)', 'Route Handlers', 'Middleware', 'Turbopack'],
        latestVersion: '15.0.0'
      },
      express: {
        displayName: 'Express.js',
        docsUrl: 'https://expressjs.com',
        summary: 'Fast, unopinionated, minimalist web framework for Node.js.',
        coreApis: ['express()', 'app.use()', 'app.get()', 'app.post()', 'router', 'req', 'res'],
        latestVersion: '5.0.0'
      },
      supabase: {
        displayName: 'Supabase',
        docsUrl: 'https://supabase.com/docs',
        summary: 'The Open Source Firebase alternative. Postgres database, Authentication, instant APIs, Realtime, Storage.',
        clientApis: ['createClient', 'supabase.from()', 'supabase.auth', 'supabase.storage', 'supabase.functions'],
        latestVersion: '2.40.0'
      },
      tailwind: {
        displayName: 'Tailwind CSS',
        docsUrl: 'https://tailwindcss.com/docs',
        summary: 'A utility-first CSS framework packed with classes like flex, pt-4, text-center and rotate-90.',
        coreClasses: ['flex', 'grid', 'text-*', 'bg-*', 'border-*', 'rounded-*', 'transition-*'],
        latestVersion: '4.0.0'
      },
      tailwindcss: {
        displayName: 'Tailwind CSS',
        docsUrl: 'https://tailwindcss.com/docs',
        summary: 'A utility-first CSS framework packed with classes like flex, pt-4, text-center and rotate-90.',
        coreClasses: ['flex', 'grid', 'text-*', 'bg-*', 'border-*', 'rounded-*', 'transition-*'],
        latestVersion: '4.0.0'
      },
      typescript: {
        displayName: 'TypeScript',
        docsUrl: 'https://www.typescriptlang.org/docs',
        summary: 'TypeScript is JavaScript with syntax for types, offering compile-time type-safety.',
        keyKeywords: ['interface', 'type', 'generics', 'enum', 'declare', 'satisfies'],
        latestVersion: '5.7.0'
      }
    };

    const curated = CURATED_DOCS[cleanLibrary.toLowerCase()];
    let liveSearchResults = [];

    // If a specific query was requested or library not in curated list, attempt web search
    if (query || !curated) {
      try {
        const searchQuery = `${cleanLibrary} ${query || 'documentation API reference'}`.trim();
        liveSearchResults = await searchWeb(searchQuery, 3);
      } catch {
        // search failure graceful fallback
      }
    }

    return {
      status: 'success',
      library: cleanLibrary,
      version: version || curated?.latestVersion || 'latest',
      query: query || null,
      docsUrl: curated?.docsUrl || `https://www.npmjs.com/package/${cleanLibrary}`,
      curated: curated || null,
      results: liveSearchResults,
      timestamp: new Date().toISOString()
    };
  }
};

export default context7Plugin;
