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
 * 1. Live RSS News (Google News RSS + BBC World News RSS fallback)
 * 2. Tavily API (if TAVILY_API_KEY is configured)
 * 3. Serper Google Search (if SERPER_API_KEY is configured)
 * 4. Free DuckDuckGo HTML search
 * 5. Free Wikipedia OpenSearch API
 */
export async function searchWeb(query, maxResults = 5) {
  if (!query || typeof query !== 'string' || !query.trim()) {
    return [];
  }

  const cleanQuery = query.trim();
  let limit = Math.max(1, Math.min(Number(maxResults) || 5, 20));

  // Extract explicit count if mentioned in query (e.g. "top 5 news", "top 10 news")
  const requestedCountMatch = cleanQuery.match(/\b(?:top|latest)?\s*(\d+)\s*(?:top|latest)?\s*news\b/i) || cleanQuery.match(/\btop\s*(\d+)\b/i);
  if (requestedCountMatch && requestedCountMatch[1]) {
    const parsedCount = parseInt(requestedCountMatch[1], 10);
    if (parsedCount >= 1 && parsedCount <= 20) {
      limit = Math.max(limit, parsedCount);
    }
  }

  // Check if query is seeking breaking or top news headlines
  const isNewsQuery = /(\b(top|latest|breaking|daily|current|world|national|local)? ?\d* ?news\b|\bheadlines?\b|\bwhat happened today\b|\btodays news\b|\btoday's news\b)/i.test(cleanQuery);
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
 * Strip CDATA markers and decode HTML entities safely
 */
export function stripCdataAndDecode(str) {
  if (!str || typeof str !== 'string') return '';
  const withoutCdata = str.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, '$1').trim();
  return decodeHtmlEntities(withoutCdata);
}

/**
 * Robust RSS XML parser for Google News and BBC feeds
 * Extracts headlines (without trailing outlet suffix), direct URLs, pubDates, and clean snippets.
 */
export function parseRssXml(xml, defaultSource = 'google-news', defaultOutlet = '') {
  if (!xml || typeof xml !== 'string') return [];

  const itemBlocks = xml.match(/<item[\s\S]*?<\/item>/gi) || [];
  const results = [];

  for (const block of itemBlocks) {
    const rawTitleMatch = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(block);
    const rawLinkMatch = /<link[^>]*>([\s\S]*?)<\/link>/i.exec(block);
    const rawPubDateMatch = /<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i.exec(block);
    const rawSourceMatch = /<source[^>]*>([\s\S]*?)<\/source>/i.exec(block);
    const rawDescMatch = /<description[^>]*>([\s\S]*?)<\/description>/i.exec(block);

    let title = rawTitleMatch ? stripCdataAndDecode(rawTitleMatch[1]) : '';
    let url = rawLinkMatch ? stripCdataAndDecode(rawLinkMatch[1]) : '';
    const pubDate = rawPubDateMatch ? stripCdataAndDecode(rawPubDateMatch[1]) : '';
    let outlet = rawSourceMatch ? stripCdataAndDecode(rawSourceMatch[1]) : defaultOutlet;
    const rawDesc = rawDescMatch ? rawDescMatch[1] : '';

    if (!title || !url) continue;

    // Clean trailing outlet from headline if present (e.g. "Headline - Source Name")
    if (title.includes(' - ')) {
      const parts = title.split(' - ');
      const trailingOutlet = parts[parts.length - 1].trim();
      if (!outlet) {
        outlet = trailingOutlet;
        parts.pop();
        title = parts.join(' - ').trim();
      } else if (
        outlet.toLowerCase() === trailingOutlet.toLowerCase() ||
        outlet.toLowerCase().includes(trailingOutlet.toLowerCase()) ||
        trailingOutlet.toLowerCase().includes(outlet.toLowerCase())
      ) {
        parts.pop();
        title = parts.join(' - ').trim();
      }
    }

    const isHtmlList = /&lt;ol|&lt;li|<ol|<li|target="_blank"/i.test(rawDesc);
    let cleanDesc = '';
    if (!isHtmlList) {
      cleanDesc = stripCdataAndDecode(rawDesc).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    }

    let snippet = '';
    if (cleanDesc && cleanDesc.length > 15) {
      snippet = `${cleanDesc} (Published: ${pubDate || 'Recently'}${outlet ? ` • Source: ${outlet}` : ''})`;
    } else {
      snippet = `Published: ${pubDate || 'Recently'}${outlet ? ` • Source: ${outlet}` : ''}`;
    }

    results.push({
      title,
      url,
      snippet,
      source: defaultSource
    });
  }

  return results;
}

/**
 * Deduplicate news items by normalized URL and title token overlap
 */
function isDuplicateNews(item, existingItems) {
  const normUrl = item.url.toLowerCase().split('?')[0];
  const cleanTitleWords = item.title.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 3);

  for (const existing of existingItems) {
    const existingNormUrl = existing.url.toLowerCase().split('?')[0];
    if (normUrl && existingNormUrl && normUrl === existingNormUrl) return true;

    const existingWords = existing.title.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 3);
    if (cleanTitleWords.length > 0 && existingWords.length > 0) {
      const matchCount = cleanTitleWords.filter(w => existingWords.includes(w)).length;
      const minLen = Math.min(cleanTitleWords.length, existingWords.length);
      if (minLen >= 3 && matchCount / minLen >= 0.7) {
        return true;
      }
    }
  }
  return false;
}

/**
 * BBC World News RSS Provider (High-Reliability Fallback)
 * https://feeds.bbci.co.uk/news/world/rss.xml
 */
export async function fetchBbcNewsRss(query = '', maxResults = 5) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 6000);

  try {
    const res = await fetch('https://feeds.bbci.co.uk/news/world/rss.xml', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 NamoGPT/1.0',
        'Accept': 'application/rss+xml,application/xml,text/xml;q=0.9,*/*;q=0.8'
      },
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      throw new Error(`BBC RSS HTTP ${res.status}`);
    }

    const xml = await res.text();
    const items = parseRssXml(xml, 'bbc-news', 'BBC News');

    if (!query || !query.trim()) {
      return items.slice(0, maxResults);
    }

    const cleanTopic = query
      .replace(/^(give me |what is |what are |tell me |show me )/i, '')
      .replace(/\b(todays|today's|today|top \d+|top|news headlines|news)\b/gi, '')
      .trim()
      .toLowerCase();

    if (cleanTopic && cleanTopic.length > 2) {
      const topicWords = cleanTopic.split(/\s+/).filter(w => w.length > 2);
      const matched = items.filter(it => {
        const fullText = `${it.title} ${it.snippet}`.toLowerCase();
        return topicWords.some(w => fullText.includes(w));
      });
      if (matched.length > 0) {
        const combined = [...matched];
        for (const it of items) {
          if (combined.length >= maxResults) break;
          if (!combined.some(c => c.url === it.url)) {
            combined.push(it);
          }
        }
        return combined.slice(0, maxResults);
      }
    }

    return items.slice(0, maxResults);
  } catch (err) {
    clearTimeout(timeoutId);
    console.warn('[WebSearch] BBC News RSS fetch failed:', err.message);
    return [];
  }
}

/**
 * Real-Time Google News RSS Provider with Multi-Feed Redundancy (100% Free, Zero-Key Required)
 * Captures live breaking news headlines, publishers, and publication timestamps.
 * Redundantly falls back to BBC World News RSS to ensure a minimum of 5 verified stories.
 */
export async function fetchGoogleNewsRss(query, maxResults = 5) {
  const limit = Math.max(1, Math.min(Number(maxResults) || 5, 20));
  let results = [];

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 6000);

  try {
    const isGeneralTopNews = /^(give me )?(today('?s)? )?(top|latest|breaking|daily|current|world|national|local)? ?(\d+)? ?(news|headlines)( today)?$/i.test(query.trim())
      || /\bwhat happened today\b/i.test(query)
      || /^(headlines|news|top news|latest news|world news|breaking news)$/i.test(query.trim());

    let rssUrl;
    if (isGeneralTopNews) {
      rssUrl = 'https://news.google.com/rss?hl=en-US&gl=US&ceid=US:en';
    } else {
      const cleanTopic = query
        .replace(/^(give me |what is |what are |tell me |show me )/i, '')
        .replace(/\b(todays|today's|today|top \d+|top|news headlines|news)\b/gi, '')
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

    if (res.ok) {
      const xml = await res.text();
      results = parseRssXml(xml, 'google-news');
    } else {
      console.warn(`[WebSearch] Google News RSS HTTP ${res.status}, activating BBC World News fallback`);
    }
  } catch (err) {
    clearTimeout(timeoutId);
    console.warn('[WebSearch] Google News RSS fetch failed, activating BBC World News fallback:', err.message);
  }

  // Multi-feed redundancy: if Google News returned fewer than desired results or failed, supplement from BBC World News RSS fallback
  if (results.length < limit) {
    try {
      const bbcResults = await fetchBbcNewsRss(query, limit);
      for (const bbcItem of bbcResults) {
        if (results.length >= limit) break;
        if (!isDuplicateNews(bbcItem, results)) {
          results.push(bbcItem);
        }
      }
    } catch (bbcErr) {
      console.warn('[WebSearch] BBC World News fallback notice:', bbcErr.message);
    }
  }

  return results.slice(0, limit);
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

  context += 'Instructions: You are equipped with the live verified real-time web search results above. Synthesize these current findings into a clear, direct, comprehensive answer. Present the requested news stories directly with headlines, summaries, and Markdown citation links. DO NOT include disclaimers about cutoffs.\n====================================';
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
