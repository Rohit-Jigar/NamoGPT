/**
 * NamoGPT Free Web Search Service
 * Real-time web retrieval via DuckDuckGo and Wikipedia without requiring API keys.
 */

export async function searchWeb(query, maxResults = 5) {
  if (!query || typeof query !== 'string' || !query.trim()) {
    return [];
  }

  const cleanQuery = query.trim();

  // 1. Primary: DuckDuckGo HTML Search
  try {
    const ddgResults = await fetchDuckDuckGo(cleanQuery, maxResults);
    if (ddgResults && ddgResults.length > 0) {
      return ddgResults;
    }
  } catch (err) {
    console.warn('[WebSearch] DuckDuckGo search failed, falling back:', err.message);
  }

  // 2. Fallback: Wikipedia OpenSearch API
  try {
    const wikiResults = await fetchWikipedia(cleanQuery, maxResults);
    if (wikiResults && wikiResults.length > 0) {
      return wikiResults;
    }
  } catch (err) {
    console.warn('[WebSearch] Wikipedia search failed:', err.message);
  }

  return [];
}

async function fetchDuckDuckGo(query, maxResults = 5) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 6000);

  const res = await fetch('https://html.duckduckgo.com/html/', {
    method: 'POST',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9'
    },
    body: new URLSearchParams({ q: query }),
    signal: controller.signal
  });
  clearTimeout(timeoutId);

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }

  const html = await res.text();
  const results = [];

  const resultBlocks = html.split('<div class="result ');
  for (let i = 1; i < resultBlocks.length && results.length < maxResults; i++) {
    const block = resultBlocks[i];
    const linkMatch = /<a[^>]*class="result__a"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/.exec(block);
    const snippetMatch = /<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/.exec(block);

    if (linkMatch) {
      let rawUrl = linkMatch[1];
      if (rawUrl.includes('uddg=')) {
        const m = /uddg=([^&]+)/.exec(rawUrl);
        if (m) rawUrl = decodeURIComponent(m[1]);
      } else if (rawUrl.startsWith('//duckduckgo.com/l/?u=')) {
        const m = /u=([^&]+)/.exec(rawUrl);
        if (m) rawUrl = decodeURIComponent(m[1]);
      }

      const title = linkMatch[2].replace(/<[^>]+>/g, '').trim();
      const snippet = snippetMatch ? snippetMatch[1].replace(/<[^>]+>/g, '').trim() : '';

      if (title && rawUrl.startsWith('http')) {
        results.push({
          title,
          url: rawUrl,
          snippet
        });
      }
    }
  }

  return results;
}

async function fetchWikipedia(query, maxResults = 5) {
  const url = `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(query)}&limit=${maxResults}&namespace=0&format=json`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'NamoGPT/1.0 (https://github.com/Rohit-Jigar/NamoGPT)' }
  });

  if (!res.ok) return [];
  const data = await res.json();
  // OpenSearch format: [query, [titles], [descriptions], [urls]]
  const titles = data[1] || [];
  const snippets = data[2] || [];
  const urls = data[3] || [];

  const results = [];
  for (let i = 0; i < titles.length && results.length < maxResults; i++) {
    if (urls[i]) {
      results.push({
        title: titles[i],
        snippet: snippets[i] || '',
        url: urls[i]
      });
    }
  }
  return results;
}

export function formatSearchContext(results) {
  if (!results || results.length === 0) return '';

  let context = '=== REAL-TIME WEB SEARCH RESULTS ===\n';
  results.forEach((item, index) => {
    context += `[${index + 1}] ${item.title}\n`;
    context += `URL: ${item.url}\n`;
    if (item.snippet) context += `Snippet: ${item.snippet}\n`;
    context += '\n';
  });

  context += 'Instructions: Synthesize the web search findings into a clear, cohesive answer. Cite relevant statements using Markdown links [Title](URL). Do not fabricate information.\n====================================';
  return context;
}
