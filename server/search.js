/**
 * NamoGPT Free & Multi-Provider Web Search & Fetcher Service
 * Real-time web retrieval via Tavily, Serper, DuckDuckGo, and Wikipedia.
 * Includes URL content scraper (mcp_web_fetcher) with robust HTML sanitization.
 */

export function decodeHtmlEntities(str) {
  if (!str || typeof str !== 'string') return '';
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&copy;/g, '©')
    .replace(/&reg;/g, '®')
    .replace(/&trade;/g, '™')
    .replace(/&ndash;/g, '–')
    .replace(/&mdash;/g, '—')
    .replace(/&hellip;/g, '…')
    .replace(/&lsquo;/g, '‘')
    .replace(/&rsquo;/g, '’')
    .replace(/&ldquo;/g, '“')
    .replace(/&rdquo;/g, '”')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

/**
 * Real-time multi-provider search waterfall:
 * 1. Tavily API (if TAVILY_API_KEY is configured)
 * 2. Serper Google Search (if SERPER_API_KEY is configured)
 * 3. Free DuckDuckGo HTML search
 * 4. Free Wikipedia OpenSearch API
 */
export async function searchWeb(query, maxResults = 5) {
  if (!query || typeof query !== 'string' || !query.trim()) {
    return [];
  }

  const cleanQuery = query.trim();
  const limit = Math.max(1, Math.min(Number(maxResults) || 5, 20));

  // Check if query is seeking breaking or top news headlines
  const isNewsQuery = /\b(news|headline|headlines|breaking|todays news|today's news|top 5 news|top 10 news|top news|daily news|current events)\b/i.test(cleanQuery);
  if (isNewsQuery) {
    try {
      const newsResults = await fetchGoogleNewsRss(cleanQuery, limit);
      if (newsResults && newsResults.length > 0) {
        return newsResults;
      }
    } catch (err) {
      console.warn('[WebSearch] Google News RSS fetch failed, falling back:', err.message);
    }
  }

  // 1. Tavily API (if key available)
  if (process.env.TAVILY_API_KEY && process.env.TAVILY_API_KEY.trim()) {
    try {
      const tavilyResults = await fetchTavily(cleanQuery, limit);
      if (tavilyResults && tavilyResults.length > 0) {
        return tavilyResults;
      }
    } catch (err) {
      console.warn('[WebSearch] Tavily search failed, falling back:', err.message);
    }
  }

  // 2. Serper Google Search (if key available)
  if (process.env.SERPER_API_KEY && process.env.SERPER_API_KEY.trim()) {
    try {
      const serperResults = await fetchSerper(cleanQuery, limit);
      if (serperResults && serperResults.length > 0) {
        return serperResults;
      }
    } catch (err) {
      console.warn('[WebSearch] Serper search failed, falling back:', err.message);
    }
  }

  // 3. Free DuckDuckGo HTML Search
  try {
    const ddgResults = await fetchDuckDuckGo(cleanQuery, limit);
    if (ddgResults && ddgResults.length > 0) {
      return ddgResults;
    }
  } catch (err) {
    console.warn('[WebSearch] DuckDuckGo search failed, falling back:', err.message);
  }

  // 4. Free Wikipedia OpenSearch API
  try {
    const wikiResults = await fetchWikipedia(cleanQuery, limit);
    if (wikiResults && wikiResults.length > 0) {
      return wikiResults;
    }
  } catch (err) {
    console.warn('[WebSearch] Wikipedia search failed:', err.message);
  }

  return [];
}

/**
 * Real-Time Google News RSS Provider (100% Free, Zero-Key Required)
 * Captures live breaking news headlines, publishers, and publication timestamps.
 */
async function fetchGoogleNewsRss(query, maxResults = 5) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 6000);

  try {
    const isGeneralTopNews = /^(give me )?(today('?s)? )?(top|latest|breaking|daily)? ?(\d+)? ?news( headlines?)?$/i.test(query.trim());
    let rssUrl;
    if (isGeneralTopNews) {
      rssUrl = 'https://news.google.com/rss?hl=en-US&gl=US&ceid=US:en';
    } else {
      const cleanTopic = query
        .replace(/^(give me |what is |what are |tell me |show me )/i, '')
        .replace(/\b(todays|today's|today|top 5|top 10|top|news headlines|news)\b/gi, '')
        .trim();
      const searchTerm = cleanTopic || query;
      rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(searchTerm)}&hl=en-US&gl=US&ceid=US:en`;
    }

    const res = await fetch(rssUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 NamoGPT/1.0',
        'Accept': 'application/rss+xml,application/xml,text/xml;q=0.9,*/*;q=0.8'
      },
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const xml = await res.text();
    const itemRegex = /<item>[\s\S]*?<title>(.*?)<\/title>[\s\S]*?<link>(.*?)<\/link>[\s\S]*?<pubDate>(.*?)<\/pubDate>(?:[\s\S]*?<source[^>]*url="([^"]*)"[^>]*>(.*?)<\/source>)?/g;
    const matches = [...xml.matchAll(itemRegex)];

    const results = [];
    for (let i = 0; i < matches.length && results.length < maxResults; i++) {
      const match = matches[i];
      let rawTitle = decodeHtmlEntities(match[1].replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1').trim());
      const rawLink = match[2].trim();
      const pubDate = match[3] ? match[3].trim() : '';
      const sourceName = match[5] ? decodeHtmlEntities(match[5].trim()) : '';

      let outlet = sourceName;
      if (!outlet && rawTitle.includes(' - ')) {
        const parts = rawTitle.split(' - ');
        outlet = parts.pop().trim();
        rawTitle = parts.join(' - ').trim();
      }

      if (rawTitle && rawLink) {
        results.push({
          title: rawTitle,
          url: rawLink,
          snippet: `Published: ${pubDate}${outlet ? ` • Source: ${outlet}` : ''}`,
          source: 'google-news'
        });
      }
    }

    return results;
  } catch (err) {
    clearTimeout(timeoutId);
    console.warn('[WebSearch] Google News RSS fetch failed:', err.message);
    return [];
  }
}

/**
 * Tavily AI Search API Provider
 */
async function fetchTavily(query, maxResults = 5) {
  const apiKey = process.env.TAVILY_API_KEY.trim();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 6000);

  try {
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        max_results: maxResults,
        search_depth: 'basic'
      }),
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const data = await res.json();
    const results = (data.results || []).slice(0, maxResults).map(r => ({
      title: r.title || 'Untitled',
      url: r.url || '',
      snippet: r.content || r.snippet || '',
      source: 'tavily'
    }));

    return results;
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

/**
 * Serper Google Search API Provider
 */
async function fetchSerper(query, maxResults = 5) {
  const apiKey = process.env.SERPER_API_KEY.trim();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 6000);

  try {
    const res = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: {
        'X-API-KEY': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        q: query,
        num: maxResults
      }),
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const data = await res.json();
    const rawItems = data.organic || [];
    const results = rawItems.slice(0, maxResults).map(r => ({
      title: r.title || 'Untitled',
      url: r.link || '',
      snippet: r.snippet || '',
      source: 'serper'
    }));

    return results;
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

/**
 * DuckDuckGo HTML Search Provider
 */
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

      const title = decodeHtmlEntities(linkMatch[2].replace(/<[^>]+>/g, '').trim());
      const snippet = snippetMatch ? decodeHtmlEntities(snippetMatch[1].replace(/<[^>]+>/g, '').trim()) : '';

      if (title && rawUrl.startsWith('http')) {
        results.push({
          title,
          url: rawUrl,
          snippet,
          source: 'duckduckgo'
        });
      }
    }
  }

  return results;
}

/**
 * Wikipedia OpenSearch Provider
 */
async function fetchWikipedia(query, maxResults = 5) {
  const url = `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(query)}&limit=${maxResults}&namespace=0&format=json`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 6000);

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'NamoGPT/1.0 (https://github.com/Rohit-Jigar/NamoGPT)' },
      signal: controller.signal
    });
    clearTimeout(timeoutId);

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
          url: urls[i],
          source: 'wikipedia'
        });
      }
    }
    return results;
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

/**
 * Formats search results into context prompt
 */
export function formatSearchContext(results) {
  if (!results || results.length === 0) return '';

  let context = '=== REAL-TIME WEB SEARCH RESULTS ===\n';
  results.forEach((item, index) => {
    context += `[${index + 1}] ${item.title}\n`;
    context += `URL: ${item.url}\n`;
    if (item.snippet) context += `Summary: ${item.snippet}\n`;
    context += '\n';
  });

  context += 'Instructions: You are equipped with the live verified real-time web search results above. Synthesize these current findings into a clear, direct, comprehensive answer. Present the requested top news stories with clear headlines, brief summaries, and Markdown citation links [Source Name](URL). DO NOT state that you do not have real-time information or that your cutoff is limited, because verified live search findings are explicitly provided above.\n====================================';
  return context;
}

/**
 * Fetch URL Content & Clean HTML (mcp_web_fetcher)
 * Fetches any URL via fetch with 6s timeout and proper User-Agent.
 * Strips <script>, <style>, <nav>, <footer>, <svg>, <header>,
 * decodes HTML entities, collapses whitespace, returns clean text snippet with title and status.
 */
export async function fetchUrlContent(url) {
  if (!url || typeof url !== 'string' || !url.trim()) {
    throw new Error('Valid URL parameter is required.');
  }

  let cleanUrl = url.trim();
  if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
    cleanUrl = `https://${cleanUrl}`;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 6000);

  try {
    const res = await fetch(cleanUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 NamoGPT/1.0',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9'
      },
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    const html = await res.text();

    // Extract title
    const titleMatch = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
    const title = titleMatch ? decodeHtmlEntities(titleMatch[1].replace(/<[^>]+>/g, '').trim()) : '';

    // Robust cleaning: strip unwanted tags and structural elements
    let text = html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<nav[\s\S]*?<\/nav>/gi, ' ')
      .replace(/<footer[\s\S]*?<\/footer>/gi, ' ')
      .replace(/<header[\s\S]*?<\/header>/gi, ' ')
      .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
      .replace(/<iframe[\s\S]*?<\/iframe>/gi, ' ')
      .replace(/<aside[\s\S]*?<\/aside>/gi, ' ')
      .replace(/<template[\s\S]*?<\/template>/gi, ' ')
      .replace(/<[^>]+>/g, ' ');

    text = decodeHtmlEntities(text);
    text = text.replace(/\s+/g, ' ').trim();

    return {
      url: cleanUrl,
      status: res.status,
      title: title || 'Untitled',
      snippet: text.slice(0, 500),
      content: text.slice(0, 8000),
      extractedText: text.slice(0, 8000),
      text: text.slice(0, 8000),
      length: text.length
    };
  } catch (err) {
    clearTimeout(timeoutId);
    return {
      url: cleanUrl,
      status: 500,
      title: 'Fetch Error',
      snippet: '',
      content: '',
      error: err.message
    };
  }
}
