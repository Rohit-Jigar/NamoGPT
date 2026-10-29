/**
 * NamoGPT Free & Multi-Provider Web Search & Fetcher Service
 * Real-time web retrieval via Live Crypto (Binance), Live Weather (Open-Meteo),
 * Live Google News Topic RSS, Live Bing News RSS, Tavily, Serper, DuckDuckGo, and Wikipedia.
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
 * Strip CDATA markers and decode HTML entities safely
 */
export function stripCdataAndDecode(str) {
  if (!str || typeof str !== 'string') return '';
  const withoutCdata = str.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, '$1').trim();
  return decodeHtmlEntities(withoutCdata);
}

/**
 * Validates that a string is a well-formed HTTP or HTTPS URL (rejects javascript:, data:, file:)
 */
export function isValidHttpUrl(urlStr) {
  if (!urlStr || typeof urlStr !== 'string') return false;
  try {
    const parsed = new URL(urlStr);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * SSRF Guard: Checks if a hostname resolves to private, loopback, or cloud metadata IP
 */
export function isPrivateOrLoopbackHost(hostname) {
  if (!hostname || typeof hostname !== 'string') return true;
  const clean = hostname.toLowerCase().trim();
  if (clean === 'localhost' || clean === '127.0.0.1' || clean === '::1' || clean === '0.0.0.0') return true;
  if (clean === '169.254.169.254' || clean === 'metadata.google.internal' || clean === 'instance-data') return true;
  // RFC 1918 & link-local address validation
  if (/^10\.\d+\.\d+\.\d+$/.test(clean)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/.test(clean)) return true;
  if (/^192\.168\.\d+\.\d+$/.test(clean)) return true;
  if (/^169\.254\.\d+\.\d+$/.test(clean)) return true;
  return false;
}

/**
 * Robust RSS XML parser for Google News, Bing News, and BBC feeds
 * Extracts headlines, clean target URLs, pubDates, outlets, and descriptions.
 */
export function parseRssXml(xml, defaultSource = 'google-news', defaultOutlet = '') {
  if (!xml || typeof xml !== 'string') return [];

  const itemBlocks = xml.match(/<item[\s\S]*?<\/item>/gi) || [];
  const results = [];

  for (const block of itemBlocks) {
    const rawTitleMatch = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(block);
    const rawLinkMatch = /<link[^>]*>([\s\S]*?)<\/link>/i.exec(block);
    const rawPubDateMatch = /<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i.exec(block);
    const rawSourceMatch = /<(?:News:Source|source)[^>]*>([\s\S]*?)<\/(?:News:Source|source)>/i.exec(block);
    const rawDescMatch = /<description[^>]*>([\s\S]*?)<\/description>/i.exec(block);

    let title = rawTitleMatch ? stripCdataAndDecode(rawTitleMatch[1]) : '';
    let url = rawLinkMatch ? stripCdataAndDecode(rawLinkMatch[1]) : '';
    const pubDate = rawPubDateMatch ? stripCdataAndDecode(rawPubDateMatch[1]) : '';
    let outlet = rawSourceMatch ? stripCdataAndDecode(rawSourceMatch[1]) : defaultOutlet;
    const rawDesc = rawDescMatch ? rawDescMatch[1] : '';

    if (!title || !url || !isValidHttpUrl(url)) continue;

    // Extract direct target URL from Bing redirect or tracking URLs if present
    if (url.includes('url=')) {
      try {
        const decodedUrl = url.replace(/&amp;/g, '&');
        const parsedUrl = new URL(decodedUrl);
        const direct = parsedUrl.searchParams.get('url');
        if (direct && direct.startsWith('http')) {
          url = direct;
        }
      } catch {
        // keep original url
      }
    }

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
 * Deduplicate items by normalized URL and title token overlap
 */
export function isDuplicateItem(item, existingItems) {
  if (!item || !item.url) return true;
  const normUrl = item.url.toLowerCase().split('?')[0].replace(/\/+$/, '');
  const cleanTitleWords = (item.title || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 3);

  for (const existing of existingItems) {
    if (!existing || !existing.url) continue;
    const existingNormUrl = existing.url.toLowerCase().split('?')[0].replace(/\/+$/, '');
    if (normUrl && existingNormUrl && normUrl === existingNormUrl) return true;

    const existingWords = (existing.title || '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 3);

    if (cleanTitleWords.length > 0 && existingWords.length > 0) {
      const matchCount = cleanTitleWords.filter(w => existingWords.includes(w)).length;
      const minLen = Math.min(cleanTitleWords.length, existingWords.length);
      if (minLen >= 3 && matchCount / minLen >= 0.75) {
        return true;
      }
    }
  }
  return false;
}

// Backward-compatible alias
export const isDuplicateNews = isDuplicateItem;

/* =====================================================================
 * SPECIALIZED PROVIDER 1: LIVE CRYPTO (BINANCE TICKER API)
 * ===================================================================== */

const CRYPTO_COIN_MAP = [
  { pattern: /\b(?:bitcoin|btc)\b/i, symbol: 'BTC', name: 'Bitcoin' },
  { pattern: /\b(?:ethereum|eth|ether)\b/i, symbol: 'ETH', name: 'Ethereum' },
  { pattern: /\b(?:solana|\bsol\b)\b/i, symbol: 'SOL', name: 'Solana' },
  { pattern: /\b(?:dogecoin|doge)\b/i, symbol: 'DOGE', name: 'Dogecoin' },
  { pattern: /\b(?:cardano|\bada\b)\b/i, symbol: 'ADA', name: 'Cardano' },
  { pattern: /\b(?:ripple|xrp)\b/i, symbol: 'XRP', name: 'Ripple' },
  { pattern: /\b(?:binance coin|\bbnb\b)\b/i, symbol: 'BNB', name: 'BNB' },
  { pattern: /\b(?:shiba(?: inu)?|\bshib\b)\b/i, symbol: 'SHIB', name: 'Shiba Inu' },
  { pattern: /\b(?:avalanche|\bavax\b)\b/i, symbol: 'AVAX', name: 'Avalanche' },
  { pattern: /\b(?:polygon|\bmatic\b|\bpol\b)\b/i, symbol: 'MATIC', name: 'Polygon' }
];

export function detectCryptoQuery(query) {
  if (!query || typeof query !== 'string') return null;
  const clean = query.trim();

  // Check specific coins
  for (const coin of CRYPTO_COIN_MAP) {
    if (coin.pattern.test(clean)) {
      return { isCrypto: true, symbol: coin.symbol, name: coin.name };
    }
  }

  // Check generic crypto queries
  if (/\b(?:crypto(?:currency)?|crypto price|crypto market|crypto ticker)\b/i.test(clean)) {
    return { isCrypto: true, symbol: 'BTC', name: 'Bitcoin' };
  }

  return null;
}

export async function fetchLiveCryptoPrice(symbol, name = 'Crypto') {
  const cleanSymbol = (symbol || 'BTC').toUpperCase().trim();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    // 1. Try Binance 24hr ticker (provides rich stats: last price, 24h change %, high, low, volume)
    const ticker24Url = `https://api.binance.com/api/v3/ticker/24hr?symbol=${encodeURIComponent(cleanSymbol)}USDT`;
    const res = await fetch(ticker24Url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      const lastPrice = parseFloat(data.lastPrice);
      const priceChangePercent = parseFloat(data.priceChangePercent);
      const highPrice = parseFloat(data.highPrice);
      const lowPrice = parseFloat(data.lowPrice);
      const volume = parseFloat(data.volume);

      const sign = priceChangePercent >= 0 ? '+' : '';
      const priceFormatted = lastPrice >= 1
        ? lastPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        : lastPrice.toPrecision(4);
      const highFormatted = highPrice >= 1 ? highPrice.toLocaleString('en-US') : highPrice.toPrecision(4);
      const lowFormatted = lowPrice >= 1 ? lowPrice.toLocaleString('en-US') : lowPrice.toPrecision(4);
      const volumeFormatted = volume >= 1 ? volume.toLocaleString('en-US', { maximumFractionDigits: 2 }) : volume.toPrecision(4);

      return {
        title: `${name} (${cleanSymbol}) Live Price: $${priceFormatted} USDT (${sign}${priceChangePercent.toFixed(2)}%)`,
        url: `https://www.binance.com/en/trade/${cleanSymbol}_USDT`,
        snippet: `Current ${name} (${cleanSymbol}) Real-Time Price: $${priceFormatted} USDT (${sign}${priceChangePercent.toFixed(2)}% in 24h). 24h High: $${highFormatted} | 24h Low: $${lowFormatted} | 24h Volume: ${volumeFormatted} ${cleanSymbol}. Live verified cryptocurrency market data via Binance Ticker API.`,
        source: 'binance-crypto'
      };
    }
  } catch (err) {
    clearTimeout(timeoutId);
    console.warn(`[WebSearch] Binance 24hr ticker failed for ${cleanSymbol}:`, err.message);
  }

  // Fallback: Try Binance simple price ticker
  const fallbackController = new AbortController();
  const fallbackTimeout = setTimeout(() => fallbackController.abort(), 4000);
  try {
    const priceUrl = `https://api.binance.com/api/v3/ticker/price?symbol=${encodeURIComponent(cleanSymbol)}USDT`;
    const res = await fetch(priceUrl, { signal: fallbackController.signal });
    clearTimeout(fallbackTimeout);

    if (res.ok) {
      const data = await res.json();
      const price = parseFloat(data.price);
      const priceFormatted = price >= 1
        ? price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        : price.toPrecision(4);

      return {
        title: `${name} (${cleanSymbol}) Live Price: $${priceFormatted} USDT`,
        url: `https://www.binance.com/en/trade/${cleanSymbol}_USDT`,
        snippet: `Current ${name} (${cleanSymbol}) Real-Time Price: $${priceFormatted} USDT. Live market data verified via Binance Price API.`,
        source: 'binance-crypto'
      };
    }
  } catch (err) {
    clearTimeout(fallbackTimeout);
    console.warn(`[WebSearch] Binance price ticker failed for ${cleanSymbol}:`, err.message);
  }

  return null;
}

/* =====================================================================
 * SPECIALIZED PROVIDER 2: LIVE GLOBAL WEATHER (OPEN-METEO API)
 * ===================================================================== */

export const WMO_WEATHER_CODES = {
  0: 'Clear sky',
  1: 'Mainly clear',
  2: 'Partly cloudy',
  3: 'Overcast',
  45: 'Fog',
  48: 'Depositing rime fog',
  51: 'Light drizzle',
  53: 'Moderate drizzle',
  55: 'Dense drizzle',
  56: 'Light freezing drizzle',
  57: 'Dense freezing drizzle',
  61: 'Slight rain',
  62: 'Moderate rain',
  63: 'Heavy rain',
  65: 'Very heavy rain',
  66: 'Light freezing rain',
  67: 'Heavy freezing rain',
  71: 'Slight snow fall',
  73: 'Moderate snow fall',
  75: 'Heavy snow fall',
  77: 'Snow grains',
  80: 'Slight rain showers',
  81: 'Moderate rain showers',
  82: 'Violent rain showers',
  85: 'Slight snow showers',
  86: 'Heavy snow showers',
  95: 'Thunderstorm',
  96: 'Thunderstorm with slight hail',
  99: 'Thunderstorm with heavy hail'
};

export function extractWeatherLocation(query) {
  const clean = query.trim();
  // Pattern: "weather in/for/at <city>", "temperature in/for/at <city>", "forecast in/for/at <city>"
  const matchInFor = clean.match(/(?:weather|temperature|temp|forecast|climate)\s+(?:in|for|at|around|of)\s+([a-zA-Z\s,.-]+?)(?:\s+(?:today|tomorrow|now|currently|this week|next week))?$/i);
  if (matchInFor && matchInFor[1].trim()) {
    return matchInFor[1].trim();
  }
  // Pattern: "<city> weather" or "<city> forecast"
  const matchCityFirst = clean.match(/^([a-zA-Z\s,.-]+?)\s+(?:weather|forecast|temperature|temp)(?:\s+(?:today|tomorrow|now|currently))?$/i);
  if (matchCityFirst && matchCityFirst[1].trim()) {
    return matchCityFirst[1].trim();
  }
  // Strip conversational wrappers
  const stripped = clean
    .replace(/^(what is the|what's the|tell me the|how is the|give me the|check|current)\s+/i, '')
    .replace(/\b(weather|temperature|temp|forecast|climate|today|tomorrow|now|currently|this week)\b/gi, '')
    .replace(/\b(in|for|at|of)\b/gi, '')
    .trim();
  return stripped || '';
}

export function detectWeatherQuery(query) {
  if (!query || typeof query !== 'string') return null;
  const clean = query.trim();
  const weatherRegex = /\b(?:weather|temperature|temp|forecast|climate|rain|humidity|wind)\b/i;
  if (!weatherRegex.test(clean)) return null;

  const city = extractWeatherLocation(clean);
  return { isWeather: true, city: city || 'New York' };
}

export async function fetchLiveWeather(city) {
  if (!city || typeof city !== 'string' || !city.trim()) return null;
  const cleanCity = city.trim();

  const geoController = new AbortController();
  const geoTimeout = setTimeout(() => geoController.abort(), 5000);

  try {
    // 1. Geocode city via Open-Meteo Geocoding API
    const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cleanCity)}&count=1&language=en&format=json`;
    const geoRes = await fetch(geoUrl, {
      headers: { 'Accept': 'application/json' },
      signal: geoController.signal
    });
    clearTimeout(geoTimeout);

    if (!geoRes.ok) {
      console.warn(`[WebSearch] Open-Meteo geocoding HTTP ${geoRes.status}`);
      return null;
    }

    const geoData = await geoRes.json();
    if (!geoData.results || geoData.results.length === 0) {
      return null;
    }

    const loc = geoData.results[0];
    const { latitude, longitude, name, admin1, country } = loc;
    const placeName = [name, admin1, country].filter(Boolean).join(', ');

    // 2. Fetch current weather and daily forecast via Open-Meteo Forecast API
    const forecastController = new AbortController();
    const forecastTimeout = setTimeout(() => forecastController.abort(), 5000);

    const forecastUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto`;
    const forecastRes = await fetch(forecastUrl, {
      headers: { 'Accept': 'application/json' },
      signal: forecastController.signal
    });
    clearTimeout(forecastTimeout);

    if (!forecastRes.ok) {
      console.warn(`[WebSearch] Open-Meteo forecast HTTP ${forecastRes.status}`);
      return null;
    }

    const weatherData = await forecastRes.json();
    const cur = weatherData.current || {};
    const daily = weatherData.daily || {};

    const tempC = typeof cur.temperature_2m === 'number' ? cur.temperature_2m : null;
    if (tempC === null) return null;

    const tempF = (tempC * 9 / 5 + 32).toFixed(1);
    const condition = WMO_WEATHER_CODES[cur.weather_code] || 'Fair';
    const humidity = cur.relative_humidity_2m ?? 'N/A';
    const windSpeed = cur.wind_speed_10m ?? 'N/A';

    const maxC = daily.temperature_2m_max?.[0];
    const minC = daily.temperature_2m_min?.[0];
    const maxF = maxC != null ? (maxC * 9 / 5 + 32).toFixed(1) : null;
    const minF = minC != null ? (minC * 9 / 5 + 32).toFixed(1) : null;

    const forecastSnippet = maxC != null && minC != null
      ? ` Today's Forecast: High ${maxC}°C (${maxF}°F), Low ${minC}°C (${minF}°F).`
      : '';

    return {
      title: `Live Weather in ${placeName}: ${tempC}°C (${tempF}°F), ${condition}`,
      url: `https://open-meteo.com/en/docs#latitude=${latitude}&longitude=${longitude}`,
      snippet: `Current conditions in ${placeName}: ${tempC}°C (${tempF}°F), ${condition}. Humidity: ${humidity}%, Wind Speed: ${windSpeed} km/h.${forecastSnippet} Live meteorological observations verified via Open-Meteo.`,
      source: 'open-meteo'
    };
  } catch (err) {
    clearTimeout(geoTimeout);
    console.warn(`[WebSearch] Live weather fetch failed for "${cleanCity}":`, err.message);
    return null;
  }
}

/* =====================================================================
 * SPECIALIZED PROVIDER 3: LIVE GOOGLE NEWS TOPIC RSS (ZERO-KEY, ALL QUERIES)
 * ===================================================================== */

export async function fetchGoogleNewsTopicRss(query, maxResults = 5) {
  if (!query || typeof query !== 'string' || !query.trim()) return [];
  const limit = Math.max(1, Math.min(Number(maxResults) || 5, 20));
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 6000);

  try {
    const cleanTopic = query
      .replace(/^(give me |what is |what are |tell me |show me )/i, '')
      .replace(/\b(todays|today's|today|top \d+|top|news headlines|news)\b/gi, '')
      .trim();
    const searchTerm = cleanTopic || query.trim();
    const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(searchTerm)}&hl=en-US&gl=US&ceid=US:en`;

    const res = await fetch(rssUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 NamoGPT/1.0',
        'Accept': 'application/rss+xml,application/xml,text/xml;q=0.9,*/*;q=0.8'
      },
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      console.warn(`[WebSearch] Google News Topic RSS HTTP ${res.status}`);
      return [];
    }

    const xml = await res.text();
    const items = parseRssXml(xml, 'google-news');
    return items.slice(0, limit);
  } catch (err) {
    clearTimeout(timeoutId);
    console.warn('[WebSearch] Google News Topic RSS fetch failed:', err.message);
    return [];
  }
}

/* =====================================================================
 * SPECIALIZED PROVIDER 4: LIVE BING NEWS RSS (REDUNDANT FALLBACK)
 * ===================================================================== */

export async function fetchBingNewsRss(query, maxResults = 5) {
  if (!query || typeof query !== 'string' || !query.trim()) return [];
  const limit = Math.max(1, Math.min(Number(maxResults) || 5, 20));
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 6000);

  try {
    const rssUrl = `https://www.bing.com/news/search?q=${encodeURIComponent(query.trim())}&format=rss`;
    const res = await fetch(rssUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 NamoGPT/1.0',
        'Accept': 'application/rss+xml,application/xml,text/xml;q=0.9,*/*;q=0.8'
      },
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      console.warn(`[WebSearch] Bing News RSS HTTP ${res.status}`);
      return [];
    }

    const xml = await res.text();
    const items = parseRssXml(xml, 'bing-news', 'Bing News');
    return items.slice(0, limit);
  } catch (err) {
    clearTimeout(timeoutId);
    console.warn('[WebSearch] Bing News RSS fetch failed:', err.message);
    return [];
  }
}

/* =====================================================================
 * SPECIALIZED PROVIDER 5: BBC WORLD NEWS RSS (HIGH-RELIABILITY FALLBACK)
 * ===================================================================== */

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

/* =====================================================================
 * SPECIALIZED PROVIDER 6: GOOGLE NEWS GENERAL RSS (BREAKING & HEADLINES)
 * ===================================================================== */

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
        if (!isDuplicateItem(bbcItem, results)) {
          results.push(bbcItem);
        }
      }
    } catch (bbcErr) {
      console.warn('[WebSearch] BBC World News fallback notice:', bbcErr.message);
    }
  }

  return results.slice(0, limit);
}

/* =====================================================================
 * SPECIALIZED PROVIDER 7: TAVILY AI SEARCH API
 * ===================================================================== */

export async function fetchTavily(query, maxResults = 5) {
  const apiKey = (process.env.TAVILY_API_KEY || '').trim();
  if (!apiKey) {
    throw new Error('TAVILY_API_KEY is not configured.');
  }
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
    const results = (data.results || [])
      .filter(r => r && isValidHttpUrl(r.url))
      .slice(0, maxResults)
      .map(r => ({
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

/* =====================================================================
 * SPECIALIZED PROVIDER 8: SERPER GOOGLE SEARCH API
 * ===================================================================== */

export async function fetchSerper(query, maxResults = 5) {
  const apiKey = (process.env.SERPER_API_KEY || '').trim();
  if (!apiKey) {
    throw new Error('SERPER_API_KEY is not configured.');
  }
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
    const results = rawItems
      .filter(r => r && isValidHttpUrl(r.link))
      .slice(0, maxResults)
      .map(r => ({
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

/* =====================================================================
 * SPECIALIZED PROVIDER 9: DUCKDUCKGO HTML SEARCH
 * ===================================================================== */

export async function fetchDuckDuckGo(query, maxResults = 5) {
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

/* =====================================================================
 * SPECIALIZED PROVIDER 10: WIKIPEDIA OPENSEARCH API
 * ===================================================================== */

export async function fetchWikipedia(query, maxResults = 5) {
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
        const snippet = snippets[i] && snippets[i].trim()
          ? snippets[i].trim()
          : `Encyclopedia article covering ${titles[i]} on Wikipedia.`;
        results.push({
          title: titles[i],
          snippet,
          url: urls[i],
          source: 'wikipedia'
        });
      }
    }
    return results;
  } catch (err) {
    clearTimeout(timeoutId);
    console.warn('[WebSearch] Wikipedia search failed:', err.message);
    return [];
  }
}

/* =====================================================================
 * UNIFIED SEARCH WATERFALL (searchWeb) WITH IN-MEMORY TTL CACHE
 * ===================================================================== */

const searchCache = new Map();
const SEARCH_CACHE_TTL_MS = 8 * 60 * 1000; // 8 minutes TTL for real-time web grounding

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

  // Fast In-Memory TTL Cache Check
  const cacheKey = `${cleanQuery.toLowerCase()}_${limit}`;
  const cachedEntry = searchCache.get(cacheKey);
  if (cachedEntry && (Date.now() - cachedEntry.timestamp < SEARCH_CACHE_TTL_MS)) {
    return cachedEntry.results;
  }

  // 1. Live Crypto Provider (Binance Ticker API)
  const cryptoInfo = detectCryptoQuery(cleanQuery);
  if (cryptoInfo) {
    try {
      const [cryptoItemResult, topicNewsResult] = await Promise.allSettled([
        fetchLiveCryptoPrice(cryptoInfo.symbol, cryptoInfo.name),
        fetchGoogleNewsTopicRss(cleanQuery, limit)
      ]);
      const cryptoItem = cryptoItemResult.status === 'fulfilled' ? cryptoItemResult.value : null;
      const topicNews = topicNewsResult.status === 'fulfilled' && Array.isArray(topicNewsResult.value) ? topicNewsResult.value : [];
      const results = cryptoItem ? [cryptoItem] : [];
      for (const item of topicNews) {
        if (results.length >= limit) break;
        if (!isDuplicateItem(item, results)) {
          results.push(item);
        }
      }
      if (results.length > 0) {
        return results.slice(0, limit);
      }
    } catch (err) {
      console.warn('[WebSearch] Crypto provider error, falling back:', err.message);
    }
  }

  // 2. Live Global Weather Provider (Open-Meteo Geocoding + Forecast API)
  const weatherInfo = detectWeatherQuery(cleanQuery);
  if (weatherInfo) {
    try {
      const [weatherItemResult, topicNewsResult] = await Promise.allSettled([
        fetchLiveWeather(weatherInfo.city),
        fetchGoogleNewsTopicRss(cleanQuery, limit)
      ]);
      const weatherItem = weatherItemResult.status === 'fulfilled' ? weatherItemResult.value : null;
      const topicNews = topicNewsResult.status === 'fulfilled' && Array.isArray(topicNewsResult.value) ? topicNewsResult.value : [];
      const results = weatherItem ? [weatherItem] : [];
      for (const item of topicNews) {
        if (results.length >= limit) break;
        if (!isDuplicateItem(item, results)) {
          results.push(item);
        }
      }
      if (results.length > 0) {
        return results.slice(0, limit);
      }
    } catch (err) {
      console.warn('[WebSearch] Weather provider error, falling back:', err.message);
    }
  }

  // 3. General Breaking / Top News queries (Google News RSS + BBC World News RSS fallback)
  const isGeneralTopNews = /(\b(top|latest|breaking|daily|current|world|national|local)? ?\d* ?news\b|\bheadlines?\b|\bwhat happened today\b|\btodays news\b|\btoday's news\b)/i.test(cleanQuery);
  if (isGeneralTopNews) {
    try {
      const newsResults = await fetchGoogleNewsRss(cleanQuery, limit);
      if (newsResults && newsResults.length > 0) {
        return newsResults.slice(0, limit);
      }
    } catch (err) {
      console.warn('[WebSearch] General news fetch failed, falling through:', err.message);
    }
  }

  // 4. Unified Waterfall for ALL other queries (Sports, SpaceX, Politics, Tech, Finance, General)
  const accumulated = [];

  // 4a. Tavily API (if configured)
  if (process.env.TAVILY_API_KEY && process.env.TAVILY_API_KEY.trim()) {
    try {
      const tavilyResults = await fetchTavily(cleanQuery, limit);
      for (const item of (tavilyResults || [])) {
        if (accumulated.length >= limit) break;
        if (!isDuplicateItem(item, accumulated)) {
          accumulated.push(item);
        }
      }
      if (accumulated.length >= limit) {
        return accumulated.slice(0, limit);
      }
    } catch (err) {
      console.warn('[WebSearch] Tavily search failed, falling back:', err.message);
    }
  }

  // 4b. Serper Google Search (if configured)
  if (process.env.SERPER_API_KEY && process.env.SERPER_API_KEY.trim()) {
    try {
      const serperResults = await fetchSerper(cleanQuery, limit);
      for (const item of (serperResults || [])) {
        if (accumulated.length >= limit) break;
        if (!isDuplicateItem(item, accumulated)) {
          accumulated.push(item);
        }
      }
      if (accumulated.length >= limit) {
        return accumulated.slice(0, limit);
      }
    } catch (err) {
      console.warn('[WebSearch] Serper search failed, falling back:', err.message);
    }
  }

  // 4c. Live Google News Topic RSS (zero-key, works for ANY search query)
  try {
    const topicResults = await fetchGoogleNewsTopicRss(cleanQuery, limit);
    for (const item of (topicResults || [])) {
      if (accumulated.length >= limit) break;
      if (!isDuplicateItem(item, accumulated)) {
        accumulated.push(item);
      }
    }
    if (accumulated.length >= limit) {
      return accumulated.slice(0, limit);
    }
  } catch (err) {
    console.warn('[WebSearch] Google News Topic RSS failed, falling back:', err.message);
  }

  // 4d. Live Bing News RSS (redundant fallback)
  if (accumulated.length < limit) {
    try {
      const bingResults = await fetchBingNewsRss(cleanQuery, limit - accumulated.length);
      for (const item of (bingResults || [])) {
        if (accumulated.length >= limit) break;
        if (!isDuplicateItem(item, accumulated)) {
          accumulated.push(item);
        }
      }
      if (accumulated.length >= limit) {
        return accumulated.slice(0, limit);
      }
    } catch (err) {
      console.warn('[WebSearch] Bing News RSS fallback failed:', err.message);
    }
  }

  // 4e. Free DuckDuckGo HTML Search
  if (accumulated.length < limit) {
    try {
      const ddgResults = await fetchDuckDuckGo(cleanQuery, limit - accumulated.length);
      for (const item of (ddgResults || [])) {
        if (accumulated.length >= limit) break;
        if (!isDuplicateItem(item, accumulated)) {
          accumulated.push(item);
        }
      }
      if (accumulated.length >= limit) {
        return accumulated.slice(0, limit);
      }
    } catch (err) {
      console.warn('[WebSearch] DuckDuckGo search failed, falling back:', err.message);
    }
  }

  // 4f. Free Wikipedia OpenSearch API
  if (accumulated.length < limit) {
    try {
      const wikiResults = await fetchWikipedia(cleanQuery, limit - accumulated.length);
      for (const item of (wikiResults || [])) {
        if (accumulated.length >= limit) break;
        if (!isDuplicateItem(item, accumulated)) {
          accumulated.push(item);
        }
      }
    } catch (err) {
      console.warn('[WebSearch] Wikipedia search failed:', err.message);
    }
  }

  const finalResults = accumulated.slice(0, limit);
  searchCache.set(cacheKey, { timestamp: Date.now(), results: finalResults });
  if (searchCache.size > 250) {
    const oldestKey = searchCache.keys().next().value;
    searchCache.delete(oldestKey);
  }
  return finalResults;
}

/* =====================================================================
 * CONTEXT FORMATTER & WEB FETCHER
 * ===================================================================== */

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

  context += 'Instructions: You are equipped with the live verified real-time web search results above. Synthesize these verified real-time findings to directly answer the query. Cite sources using Markdown links [Source](URL). Never claim to lack real-time access when search findings are provided. Never generate unsolicited code. Present the requested news stories directly with headlines, summaries, and Markdown citation links. DO NOT include disclaimers about cutoffs.\n====================================';
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

  if (!isValidHttpUrl(cleanUrl)) {
    return {
      url: cleanUrl,
      status: 400,
      title: 'Invalid URL',
      snippet: '',
      content: '',
      error: 'Invalid URL protocol. Only HTTP and HTTPS protocols are permitted.'
    };
  }

  const parsedUrl = new URL(cleanUrl);
  if (isPrivateOrLoopbackHost(parsedUrl.hostname)) {
    return {
      url: cleanUrl,
      status: 403,
      title: 'Access Restricted',
      snippet: '',
      content: '',
      error: 'SSRF Protection: Requests to loopback, link-local, and private addresses are restricted.'
    };
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
