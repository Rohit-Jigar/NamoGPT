/**
 * NamoGPT Real-Time Search & Retrieval End-to-End QA Automation Suite
 * Tests GET /api/search and POST /v1/chat/completions across all domains.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BASE_URL = process.env.NAMOGPT_URL || 'http://localhost:3001';
const REPORT_PATH = path.resolve(__dirname, '..', 'server', 'realtime_search_qa_report.json');

console.log('='.repeat(80));
console.log('🌐 NAMOGPT WORKER D: REAL-TIME SEARCH END-TO-END AUTOMATION QA');
console.log(`Backend Server Target: ${BASE_URL}`);
console.log(`Report Output Target:  ${REPORT_PATH}`);
console.log(`Timestamp:             ${new Date().toISOString()}`);
console.log('='.repeat(80) + '\n');

const testCases = [];

function recordTest({ id, category, query, passed, latencyMs, details, error = null }) {
  const icon = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`${icon} [TC-${id}] ${category.padEnd(20)} | "${query}" (${latencyMs}ms)`);
  if (!passed && error) {
    console.error(`   Error details: ${error}`);
  }
  if (details && Object.keys(details).length > 0) {
    console.log(`   Evidence: ${JSON.stringify(details)}`);
  }

  testCases.push({
    id,
    category,
    query,
    passed,
    latencyMs,
    details,
    error: error ? String(error) : null
  });
}

async function testApiSearch(id, query, validator) {
  const t0 = Date.now();
  try {
    const url = `${BASE_URL}/api/search?q=${encodeURIComponent(query)}`;
    const res = await fetch(url);
    const latencyMs = Date.now() - t0;

    if (!res.ok) {
      const errText = await res.text();
      recordTest({
        id,
        category: 'GET /api/search',
        query,
        passed: false,
        latencyMs,
        details: { status: res.status, statusText: res.statusText },
        error: `HTTP ${res.status}: ${errText}`
      });
      return false;
    }

    const data = await res.json();
    const { passed, details, error } = validator(data);

    recordTest({
      id,
      category: 'GET /api/search',
      query,
      passed,
      latencyMs,
      details: { count: data.count || 0, ...details },
      error
    });
    return passed;
  } catch (err) {
    const latencyMs = Date.now() - t0;
    recordTest({
      id,
      category: 'GET /api/search',
      query,
      passed: false,
      latencyMs,
      details: {},
      error: err.message
    });
    return false;
  }
}

async function testChatCompletion(id, query, validator) {
  const t0 = Date.now();
  try {
    const url = `${BASE_URL}/v1/chat/completions`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Model-Name': 'auto'
      },
      body: JSON.stringify({
        model: 'auto',
        messages: [{ role: 'user', content: query }],
        temperature: 0.2
      })
    });
    const latencyMs = Date.now() - t0;

    if (!res.ok) {
      const errText = await res.text();
      recordTest({
        id,
        category: 'POST /v1/chat/completions',
        query,
        passed: false,
        latencyMs,
        details: { status: res.status, statusText: res.statusText },
        error: `HTTP ${res.status}: ${errText}`
      });
      return false;
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content || '';
    const { passed, details, error } = validator(content, data);

    recordTest({
      id,
      category: 'POST /v1/chat/completions',
      query,
      passed,
      latencyMs,
      details: { model: data.model, length: content.length, ...details },
      error
    });
    return passed;
  } catch (err) {
    const latencyMs = Date.now() - t0;
    recordTest({
      id,
      category: 'POST /v1/chat/completions',
      query,
      passed: false,
      latencyMs,
      details: {},
      error: err.message
    });
    return false;
  }
}

async function runTestSuite() {
  console.log('--- 1. Testing GET /api/search Endpoints ---\n');

  // 1. 'what is the current price of bitcoin' -> must return >= 1 result with price/crypto data
  await testApiSearch(1, 'what is the current price of bitcoin', (data) => {
    const results = data.results || [];
    if (results.length < 1) {
      return { passed: false, error: `Expected >= 1 result, got ${results.length}` };
    }
    const hasPriceCryptoData = results.some(r => {
      const fullText = `${r.title} ${r.snippet}`.toLowerCase();
      return (fullText.includes('bitcoin') || fullText.includes('btc')) &&
             (fullText.includes('price') || fullText.includes('$') || fullText.includes('usd') || fullText.includes('usdt'));
    });
    if (!hasPriceCryptoData) {
      return { passed: false, error: 'Results missing bitcoin/price data' };
    }
    return {
      passed: true,
      details: { firstTitle: results[0]?.title, sampleSnippet: results[0]?.snippet?.slice(0, 80) }
    };
  });

  // 2. 'weather in new york' -> must return >= 1 result with weather info
  await testApiSearch(2, 'weather in new york', (data) => {
    const results = data.results || [];
    if (results.length < 1) {
      return { passed: false, error: `Expected >= 1 result, got ${results.length}` };
    }
    const hasWeatherInfo = results.some(r => {
      const fullText = `${r.title} ${r.snippet}`.toLowerCase();
      return fullText.includes('weather') || fullText.includes('temperature') ||
             fullText.includes('°f') || fullText.includes('°c') || fullText.includes('forecast') ||
             fullText.includes('humidity') || fullText.includes('wind');
    });
    if (!hasWeatherInfo) {
      return { passed: false, error: 'Results missing weather information' };
    }
    return {
      passed: true,
      details: { firstTitle: results[0]?.title, sampleSnippet: results[0]?.snippet?.slice(0, 80) }
    };
  });

  // 3. 'who won the super bowl in 2024' -> must return >= 1 result
  await testApiSearch(3, 'who won the super bowl in 2024', (data) => {
    const results = data.results || [];
    if (results.length < 1) {
      return { passed: false, error: `Expected >= 1 result, got ${results.length}` };
    }
    return {
      passed: true,
      details: { firstTitle: results[0]?.title, resultCount: results.length }
    };
  });

  // 4. 'who won the cricket match yesterday' -> must return >= 1 result
  await testApiSearch(4, 'who won the cricket match yesterday', (data) => {
    const results = data.results || [];
    if (results.length < 1) {
      return { passed: false, error: `Expected >= 1 result, got ${results.length}` };
    }
    return {
      passed: true,
      details: { firstTitle: results[0]?.title, resultCount: results.length }
    };
  });

  // 5. 'latest update on spaceX starship' -> must return >= 1 result
  await testApiSearch(5, 'latest update on spaceX starship', (data) => {
    const results = data.results || [];
    if (results.length < 1) {
      return { passed: false, error: `Expected >= 1 result, got ${results.length}` };
    }
    return {
      passed: true,
      details: { firstTitle: results[0]?.title, resultCount: results.length }
    };
  });

  // 6. 'who is the prime minister of UK' -> must return >= 1 result
  await testApiSearch(6, 'who is the prime minister of UK', (data) => {
    const results = data.results || [];
    if (results.length < 1) {
      return { passed: false, error: `Expected >= 1 result, got ${results.length}` };
    }
    return {
      passed: true,
      details: { firstTitle: results[0]?.title, resultCount: results.length }
    };
  });

  // 7. 'Give me todays top 5 news' -> must return >= 5 news results
  await testApiSearch(7, 'Give me todays top 5 news', (data) => {
    const results = data.results || [];
    if (results.length < 5) {
      return { passed: false, error: `Expected >= 5 news results, got ${results.length}` };
    }
    return {
      passed: true,
      details: { resultCount: results.length, firstTitle: results[0]?.title }
    };
  });

  console.log('\n--- 2. Testing POST /v1/chat/completions (model: "auto") ---\n');

  // 8. Query: 'what is the current price of bitcoin' -> answer must contain real-time price info and NO refusal
  await testChatCompletion(8, 'what is the current price of bitcoin', (content) => {
    const hasRefusal = /as an ai.*(?:do not have|don't have).*real-time/i.test(content) ||
                       /i do not have access to real-time/i.test(content) ||
                       /cannot provide.*real-time/i.test(content) ||
                       /knowledge cutoff/i.test(content);

    const hasPriceInfo = (/\$[\d,]+(\.\d+)?/.test(content) || /[\d,]+\s*(?:usdt?|usd)/i.test(content)) &&
                         /\b(?:bitcoin|btc)\b/i.test(content);

    if (hasRefusal) {
      return { passed: false, error: 'Model generated a refusal disclaimer claiming no real-time access.' };
    }
    if (!hasPriceInfo) {
      return { passed: false, error: 'Model response missing real-time Bitcoin price digits/currency.' };
    }
    const matchedPrice = content.match(/\$[\d,]+(?:\.\d+)?/) || content.match(/[\d,]+\s*(?:usdt?|usd)/i);
    return {
      passed: true,
      details: {
        detectedPrice: matchedPrice ? matchedPrice[0] : 'detected',
        excerpt: content.slice(0, 150)
      }
    };
  });

  // 9. Query: 'weather in new york' -> answer must contain current weather / temperature
  await testChatCompletion(9, 'weather in new york', (content) => {
    const hasTemperature = /\d+(?:\.\d+)?\s*(?:°|deg|degrees)?\s*[fc]\b/i.test(content) ||
                           /\d+(?:\.\d+)?\s*°/i.test(content);
    const hasWeatherCondition = /\b(weather|temperature|forecast|conditions?|overcast|sunny|rain|cloudy|clear|humidity|wind)\b/i.test(content);

    if (!hasTemperature) {
      return { passed: false, error: 'Model response missing numerical temperature value.' };
    }
    if (!hasWeatherCondition) {
      return { passed: false, error: 'Model response missing weather conditions/summary.' };
    }
    const tempMatch = content.match(/\d+(?:\.\d+)?\s*(?:°|deg|degrees)?\s*[fc]\b/i) || content.match(/\d+(?:\.\d+)?\s*°/i);
    return {
      passed: true,
      details: {
        detectedTemp: tempMatch ? tempMatch[0] : 'detected',
        excerpt: content.slice(0, 150)
      }
    };
  });

  // 10. Query: 'Give me todays top 5 news' -> answer must contain 5 headlines with source links and NO unsolicited code
  await testChatCompletion(10, 'Give me todays top 5 news', (content) => {
    // Check for 5 headlines (numbered items 1-5 or table rows)
    const numberedMatches = content.match(/(?:^|\n)\s*(?:\d+[\.\)]|\*\*?\d+[\.\)]?\*\*?|\|\s*\d+\s*\|)/g) || [];
    const markdownLinks = content.match(/\[([^\]]+)\]\((https?:\/\/[^\s\)]+)\)/g) || [];

    const hasFiveHeadlines = numberedMatches.length >= 5 || markdownLinks.length >= 5;

    // Check for source links
    const hasSourceLinks = markdownLinks.length >= 3 || /https?:\/\//i.test(content);

    // Check for NO unsolicited code
    const hasUnsolicitedCode = /```(?:js|javascript|python|html|ts|bash|sh|cpp|c|java)\b/i.test(content) ||
                               /build a (?:javascript|python|node).*(?:news|aggregator|scraper)/i.test(content) ||
                               /help you build/i.test(content);

    if (!hasFiveHeadlines) {
      return {
        passed: false,
        error: `Expected 5 distinct headlines, detected ${numberedMatches.length} numbered points and ${markdownLinks.length} links.`
      };
    }
    if (!hasSourceLinks) {
      return { passed: false, error: 'Missing source links or markdown citations.' };
    }
    if (hasUnsolicitedCode) {
      return { passed: false, error: 'Detected unsolicited code block or aggregator generator script.' };
    }

    return {
      passed: true,
      details: {
        numberedItemsDetected: numberedMatches.length,
        linksDetected: markdownLinks.length,
        hasUnsolicitedCode: false
      }
    };
  });

  // Calculate summary metrics
  const total = testCases.length;
  const passed = testCases.filter(t => t.passed).length;
  const failed = total - passed;
  const passRate = (passed / total) * 100;
  const avgLatency = Math.round(testCases.reduce((acc, t) => acc + t.latencyMs, 0) / total);

  console.log('\n' + '='.repeat(80));
  console.log('📊 TEST SUMMARY & METRICS:');
  console.log(`Total Test Cases:  ${total}`);
  console.log(`Passed:            ${passed}`);
  console.log(`Failed:            ${failed}`);
  console.log(`Pass Rate:         ${passRate.toFixed(1)}%`);
  console.log(`Average Latency:   ${avgLatency}ms`);
  console.log('='.repeat(80));

  const report = {
    testSuite: 'NamoGPT Real-Time Search & Retrieval E2E QA Suite',
    timestamp: new Date().toISOString(),
    targetUrl: BASE_URL,
    totalTests: total,
    passed,
    failed,
    passRate: `${passRate.toFixed(1)}%`,
    averageLatencyMs: avgLatency,
    allPassed: failed === 0,
    testCases
  };

  // Ensure output directory exists and save report
  const reportDir = path.dirname(REPORT_PATH);
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }
  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2), 'utf-8');
  console.log(`\n💾 Saved detailed report to: ${REPORT_PATH}\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTestSuite().catch(err => {
  console.error('Test Suite Fatal Error:', err);
  process.exit(1);
});
