/**
 * Test Suite for NamoGPT Plugin Architecture & Endpoints
 * Verifies:
 * - GET /api/plugins/list
 * - POST /api/plugins/invoke (web_search)
 * - POST /api/plugins/invoke (mcp_web_fetcher)
 * - POST /api/plugins/invoke (weather)
 * - POST /api/plugins/invoke (math_eval)
 */

import { listPlugins, invokePlugin, getPlugin } from './plugins/index.js';

const BASE_URL = process.env.TEST_URL || 'http://localhost:3001';

let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
  if (!condition) {
    console.error(`  ❌ FAIL: ${message}`);
    failedTests++;
    throw new Error(message);
  } else {
    console.log(`  ✅ PASS: ${message}`);
    passedTests++;
  }
}

async function runTestSuite() {
  console.log(`\n========================================================`);
  console.log(`🧪 Running NamoGPT Plugin Architecture Test Suite`);
  console.log(`🌐 Target Server: ${BASE_URL}`);
  console.log(`========================================================\n`);

  // 1. Direct Module Unit Tests
  console.log(`[Suite 1] Direct Plugin Registry Unit Verification`);
  try {
    const localPlugins = listPlugins();
    assert(Array.isArray(localPlugins), 'listPlugins() returns an array');
    assert(localPlugins.length >= 4, `Plugin registry has ${localPlugins.length} registered plugins (>= 4)`);

    const names = localPlugins.map(p => p.name);
    assert(names.includes('web_search'), 'Registry contains "web_search" plugin');
    assert(names.includes('mcp_web_fetcher'), 'Registry contains "mcp_web_fetcher" plugin');
    assert(names.includes('weather'), 'Registry contains "weather" plugin');
    assert(names.includes('math_eval'), 'Registry contains "math_eval" plugin');

    const mathDirect = await invokePlugin('math_eval', { expression: '15 + 25 * 2' });
    assert(mathDirect.result === 65, 'Direct math_eval calculates 15 + 25 * 2 = 65');
  } catch (err) {
    console.error('Suite 1 failed:', err.message);
  }

  // 2. HTTP Endpoint: GET /api/plugins/list
  console.log(`\n[Suite 2] GET /api/plugins/list HTTP Endpoint`);
  try {
    const res = await fetch(`${BASE_URL}/api/plugins/list`);
    assert(res.status === 200, `GET /api/plugins/list returned HTTP 200 (actual: ${res.status})`);

    const data = await res.json();
    assert(data.success === true, 'Response JSON has success: true');
    assert(Array.isArray(data.plugins), 'Response JSON has plugins array');
    assert(data.plugins.length >= 4, `Found ${data.plugins.length} plugins in API list`);

    const pluginMap = new Map(data.plugins.map(p => [p.name, p]));
    assert(pluginMap.has('web_search'), 'API list includes "web_search"');
    assert(pluginMap.has('mcp_web_fetcher'), 'API list includes "mcp_web_fetcher"');
    assert(pluginMap.has('weather'), 'API list includes "weather"');
    assert(pluginMap.has('math_eval'), 'API list includes "math_eval"');

    assert(Boolean(pluginMap.get('web_search').parameters?.properties?.query), 'web_search has query parameter schema');
    assert(Boolean(pluginMap.get('mcp_web_fetcher').parameters?.properties?.url), 'mcp_web_fetcher has url parameter schema');
    assert(Boolean(pluginMap.get('weather').parameters?.properties?.location), 'weather has location parameter schema');
    assert(Boolean(pluginMap.get('math_eval').parameters?.properties?.expression), 'math_eval has expression parameter schema');
  } catch (err) {
    console.error('Suite 2 failed:', err.message);
  }

  // 3. HTTP Endpoint: POST /api/plugins/invoke -> web_search
  console.log(`\n[Suite 3] POST /api/plugins/invoke -> web_search`);
  try {
    const res = await fetch(`${BASE_URL}/api/plugins/invoke`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'web_search',
        args: { query: 'Node.js JavaScript runtime', limit: 3 }
      })
    });
    assert(res.status === 200, `POST /api/plugins/invoke (web_search) returned HTTP 200 (actual: ${res.status})`);

    const data = await res.json();
    assert(data.success === true, 'Response success is true');
    assert(data.plugin === 'web_search', 'Response plugin name is "web_search"');
    assert(Array.isArray(data.result?.results), 'Result contains results array');
    assert(data.result.results.length > 0, `Returned ${data.result.results.length} search results`);
    assert(Boolean(data.result.results[0].title), `First result has title: "${data.result.results[0].title}"`);
    assert(Boolean(data.result.results[0].url), `First result has URL: ${data.result.results[0].url}`);
  } catch (err) {
    console.error('Suite 3 failed:', err.message);
  }

  // 4. HTTP Endpoint: POST /api/plugins/invoke -> mcp_web_fetcher
  console.log(`\n[Suite 4] POST /api/plugins/invoke -> mcp_web_fetcher`);
  try {
    const res = await fetch(`${BASE_URL}/api/plugins/invoke`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'mcp_web_fetcher',
        args: { url: 'https://example.com' }
      })
    });
    assert(res.status === 200, `POST /api/plugins/invoke (mcp_web_fetcher) returned HTTP 200 (actual: ${res.status})`);

    const data = await res.json();
    assert(data.success === true, 'Response success is true');
    assert(data.plugin === 'mcp_web_fetcher', 'Response plugin name is "mcp_web_fetcher"');
    assert(data.result?.status === 200, `Fetched URL status is 200 (actual: ${data.result?.status})`);
    assert(data.result?.title.includes('Example'), `Extracted title: "${data.result?.title}"`);
    assert(data.result?.snippet && data.result.snippet.length > 0, `Extracted snippet length: ${data.result?.snippet?.length} chars`);
    assert(!data.result.snippet.includes('<script'), 'Cleaned text has no <script> tags');
  } catch (err) {
    console.error('Suite 4 failed:', err.message);
  }

  // 5. HTTP Endpoint: POST /api/plugins/invoke -> weather
  console.log(`\n[Suite 5] POST /api/plugins/invoke -> weather (Tokyo & London)`);
  try {
    const res = await fetch(`${BASE_URL}/api/plugins/invoke`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'weather',
        args: { location: 'Tokyo' }
      })
    });
    assert(res.status === 200, `POST /api/plugins/invoke (weather: Tokyo) returned HTTP 200 (actual: ${res.status})`);

    const data = await res.json();
    assert(data.success === true, 'Response success is true');
    assert(data.plugin === 'weather', 'Response plugin name is "weather"');
    assert(data.result?.location.includes('Tokyo'), `Resolved location: "${data.result?.location}"`);
    assert(typeof data.result?.temperature === 'number', `Temperature is numeric: ${data.result?.temperature}°C`);
    assert(Boolean(data.result?.condition), `Weather condition: "${data.result?.condition}"`);
    assert(Boolean(data.result?.summary), `Weather summary: "${data.result?.summary}"`);
  } catch (err) {
    console.error('Suite 5 failed:', err.message);
  }

  // 6. HTTP Endpoint: POST /api/plugins/invoke -> math_eval
  console.log(`\n[Suite 6] POST /api/plugins/invoke -> math_eval`);
  try {
    const res = await fetch(`${BASE_URL}/api/plugins/invoke`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'math_eval',
        args: { expression: '42 * 2 + sqrt(64)' }
      })
    });
    assert(res.status === 200, `POST /api/plugins/invoke (math_eval) returned HTTP 200 (actual: ${res.status})`);

    const data = await res.json();
    assert(data.success === true, 'Response success is true');
    assert(data.plugin === 'math_eval', 'Response plugin name is "math_eval"');
    assert(data.result?.result === 92, `Calculated 42 * 2 + sqrt(64) = ${data.result?.result} (expected 92)`);
    assert(data.result?.formatted === '92', 'Formatted value is "92"');

    // Security test: ensure arbitrary code injection is blocked
    const maliciousRes = await fetch(`${BASE_URL}/api/plugins/invoke`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'math_eval',
        args: { expression: 'process.exit(1)' }
      })
    });
    assert(maliciousRes.status === 400, `Malicious expression blocked with HTTP 400 (actual: ${maliciousRes.status})`);
    const malData = await maliciousRes.json();
    assert(malData.success === false, 'Malicious payload returned success: false');
  } catch (err) {
    console.error('Suite 6 failed:', err.message);
  }

  // Summary
  console.log(`\n========================================================`);
  console.log(`📊 Test Results: ${passedTests} Passed, ${failedTests} Failed`);
  console.log(`========================================================\n`);

  if (failedTests > 0) {
    process.exit(1);
  } else {
    console.log('🎉 All Plugin Architecture tests passed successfully!\n');
    process.exit(0);
  }
}

runTestSuite().catch(err => {
  console.error('Fatal error during test suite execution:', err);
  process.exit(1);
});
