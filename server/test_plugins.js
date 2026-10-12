/**
 * Test Suite for NamoGPT Plugin Architecture & Endpoints
 * Verifies:
 * - GET /api/plugins/list (8 plugins)
 * - POST /api/plugins/invoke (web_search)
 * - POST /api/plugins/invoke (mcp_web_fetcher)
 * - POST /api/plugins/invoke (weather)
 * - POST /api/plugins/invoke (math_eval)
 * - POST /api/plugins/invoke (context7)
 * - POST /api/plugins/invoke (chrome-devtools)
 * - POST /api/plugins/invoke (sentry)
 * - POST /api/plugins/invoke (supabase)
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
    assert(localPlugins.length >= 8, `Plugin registry has ${localPlugins.length} registered plugins (>= 8)`);

    const names = localPlugins.map(p => p.name);
    assert(names.includes('web_search'), 'Registry contains "web_search" plugin');
    assert(names.includes('mcp_web_fetcher'), 'Registry contains "mcp_web_fetcher" plugin');
    assert(names.includes('weather'), 'Registry contains "weather" plugin');
    assert(names.includes('math_eval'), 'Registry contains "math_eval" plugin');
    assert(names.includes('context7'), 'Registry contains "context7" plugin');
    assert(names.includes('chrome-devtools'), 'Registry contains "chrome-devtools" plugin');
    assert(names.includes('sentry'), 'Registry contains "sentry" plugin');
    assert(names.includes('supabase'), 'Registry contains "supabase" plugin');

    const mathDirect = await invokePlugin('math_eval', { expression: '15 + 25 * 2' });
    assert(mathDirect.result === 65, 'Direct math_eval calculates 15 + 25 * 2 = 65');

    const c7Direct = await invokePlugin('context7', { library: 'react', query: 'useState' });
    assert(c7Direct.status === 'success', 'Direct context7 returns status success');
    assert(c7Direct.library === 'react', 'Direct context7 library is react');

    const dtDirect = await invokePlugin('chrome-devtools', { action: 'status' });
    assert(Boolean(dtDirect.status), 'Direct chrome-devtools returns status');

    const sentryDirect = await invokePlugin('sentry', { action: 'status' });
    assert(Boolean(sentryDirect.status), 'Direct sentry returns status');

    const sbDirect = await invokePlugin('supabase', { action: 'status' });
    assert(Boolean(sbDirect.status), 'Direct supabase returns status');
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
    assert(data.plugins.length >= 8, `Found ${data.plugins.length} plugins in API list (expected >= 8)`);

    const pluginMap = new Map(data.plugins.map(p => [p.name, p]));
    assert(pluginMap.has('web_search'), 'API list includes "web_search"');
    assert(pluginMap.has('mcp_web_fetcher'), 'API list includes "mcp_web_fetcher"');
    assert(pluginMap.has('weather'), 'API list includes "weather"');
    assert(pluginMap.has('math_eval'), 'API list includes "math_eval"');
    assert(pluginMap.has('context7'), 'API list includes "context7"');
    assert(pluginMap.has('chrome-devtools'), 'API list includes "chrome-devtools"');
    assert(pluginMap.has('sentry'), 'API list includes "sentry"');
    assert(pluginMap.has('supabase'), 'API list includes "supabase"');

    assert(Boolean(pluginMap.get('web_search').parameters?.properties?.query), 'web_search has query parameter schema');
    assert(Boolean(pluginMap.get('mcp_web_fetcher').parameters?.properties?.url), 'mcp_web_fetcher has url parameter schema');
    assert(Boolean(pluginMap.get('weather').parameters?.properties?.location), 'weather has location parameter schema');
    assert(Boolean(pluginMap.get('math_eval').parameters?.properties?.expression), 'math_eval has expression parameter schema');
    assert(Boolean(pluginMap.get('context7').parameters?.properties?.library), 'context7 has library parameter schema');
    assert(Boolean(pluginMap.get('chrome-devtools').parameters?.properties?.action), 'chrome-devtools has action parameter schema');
    assert(Boolean(pluginMap.get('sentry').parameters?.properties?.action), 'sentry has action parameter schema');
    assert(Boolean(pluginMap.get('supabase').parameters?.properties?.action), 'supabase has action parameter schema');
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
  } catch (err) {
    console.error('Suite 4 failed:', err.message);
  }

  // 5. HTTP Endpoint: POST /api/plugins/invoke -> weather
  console.log(`\n[Suite 5] POST /api/plugins/invoke -> weather`);
  try {
    const res = await fetch(`${BASE_URL}/api/plugins/invoke`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'weather',
        args: { location: 'Tokyo' }
      })
    });
    assert(res.status === 200, `POST /api/plugins/invoke (weather) returned HTTP 200 (actual: ${res.status})`);

    const data = await res.json();
    assert(data.success === true, 'Response success is true');
    assert(data.plugin === 'weather', 'Response plugin name is "weather"');
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
    assert(data.result?.result === 92, `Calculated 42 * 2 + sqrt(64) = ${data.result?.result}`);
  } catch (err) {
    console.error('Suite 6 failed:', err.message);
  }

  // 7. HTTP Endpoint: POST /api/plugins/invoke -> context7
  console.log(`\n[Suite 7] POST /api/plugins/invoke -> context7`);
  try {
    const res = await fetch(`${BASE_URL}/api/plugins/invoke`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'context7',
        args: { library: 'react', query: 'useEffect' }
      })
    });
    assert(res.status === 200, `POST /api/plugins/invoke (context7) returned HTTP 200 (actual: ${res.status})`);

    const data = await res.json();
    assert(data.success === true, 'Response success is true');
    assert(data.plugin === 'context7', 'Response plugin name is "context7"');
    assert(data.result?.status === 'success', 'Result status is "success"');
    assert(data.result?.library === 'react', 'Result library is "react"');
    assert(Boolean(data.result?.curated?.displayName), 'Curated docs retrieved for React');
  } catch (err) {
    console.error('Suite 7 failed:', err.message);
  }

  // 8. HTTP Endpoint: POST /api/plugins/invoke -> chrome-devtools
  console.log(`\n[Suite 8] POST /api/plugins/invoke -> chrome-devtools`);
  try {
    const res = await fetch(`${BASE_URL}/api/plugins/invoke`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'chrome-devtools',
        args: { action: 'status' }
      })
    });
    assert(res.status === 200, `POST /api/plugins/invoke (chrome-devtools) returned HTTP 200 (actual: ${res.status})`);

    const data = await res.json();
    assert(data.success === true, 'Response success is true');
    assert(data.plugin === 'chrome-devtools', 'Response plugin name is "chrome-devtools"');
    assert(data.result?.action === 'status', 'DevTools action is "status"');
    assert(Array.isArray(data.result?.capabilities), 'DevTools result contains capabilities array');
  } catch (err) {
    console.error('Suite 8 failed:', err.message);
  }

  // 9. HTTP Endpoint: POST /api/plugins/invoke -> sentry
  console.log(`\n[Suite 9] POST /api/plugins/invoke -> sentry`);
  try {
    const res = await fetch(`${BASE_URL}/api/plugins/invoke`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'sentry',
        args: {
          action: 'analyze_stacktrace',
          stacktrace: 'TypeError: Cannot read properties of undefined (reading "map")\n    at UserList (src/components/UserList.jsx:42:18)'
        }
      })
    });
    assert(res.status === 200, `POST /api/plugins/invoke (sentry) returned HTTP 200 (actual: ${res.status})`);

    const data = await res.json();
    assert(data.success === true, 'Response success is true');
    assert(data.plugin === 'sentry', 'Response plugin name is "sentry"');
    assert(data.result?.stackAnalysis?.errorType === 'TypeError', 'Sentry parsed TypeError');
    assert(data.result?.stackAnalysis?.culpritFrame?.fileName === 'UserList.jsx', 'Sentry pinpointed UserList.jsx culprit frame');
  } catch (err) {
    console.error('Suite 9 failed:', err.message);
  }

  // 10. HTTP Endpoint: POST /api/plugins/invoke -> supabase
  console.log(`\n[Suite 10] POST /api/plugins/invoke -> supabase`);
  try {
    const res = await fetch(`${BASE_URL}/api/plugins/invoke`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'supabase',
        args: { action: 'status' }
      })
    });
    assert(res.status === 200, `POST /api/plugins/invoke (supabase) returned HTTP 200 (actual: ${res.status})`);

    const data = await res.json();
    assert(data.success === true, 'Response success is true');
    assert(data.plugin === 'supabase', 'Response plugin name is "supabase"');
    assert(Array.isArray(data.result?.capabilities), 'Supabase result contains capabilities array');
  } catch (err) {
    console.error('Suite 10 failed:', err.message);
  }

  // Summary
  console.log(`\n========================================================`);
  console.log(`📊 Test Results: ${passedTests} Passed, ${failedTests} Failed`);
  console.log(`========================================================\n`);

  if (failedTests > 0) {
    process.exit(1);
  } else {
    console.log('🎉 All 8 Plugin Architecture tests passed successfully!\n');
    process.exit(0);
  }
}

runTestSuite().catch(err => {
  console.error('Fatal error during test suite execution:', err);
  process.exit(1);
});
