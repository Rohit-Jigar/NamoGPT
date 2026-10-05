import express from 'express';
import cors from 'cors';
import handler from './api/index.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.all('*', handler);

const TEST_PORT = 3099;
const server = app.listen(TEST_PORT, async () => {
  console.log(`[CI TEST] Server started on port ${TEST_PORT}`);

  try {
    // Test 1: Health check
    console.log('[CI TEST] 1. Testing /health...');
    const healthRes = await fetch(`http://localhost:${TEST_PORT}/health`);
    if (!healthRes.ok) throw new Error(`/health returned status ${healthRes.status}`);
    const healthData = await healthRes.json();
    if (!healthData.ok) throw new Error('/health response payload invalid');
    console.log('  ✅ /health passed');

    // Test 2: Models catalog
    console.log('[CI TEST] 2. Testing /api/models...');
    const modelsRes = await fetch(`http://localhost:${TEST_PORT}/api/models`);
    if (!modelsRes.ok) throw new Error(`/api/models returned status ${modelsRes.status}`);
    const modelsData = await modelsRes.json();
    if (!Array.isArray(modelsData.data) || modelsData.data.length === 0) {
      throw new Error('/api/models returned empty data array');
    }
    console.log(`  ✅ /api/models passed (${modelsData.data.length} models verified)`);

    // Test 3: Chat completion fallback/streaming
    console.log('[CI TEST] 3. Testing /v1/chat/completions...');
    const chatRes = await fetch(`http://localhost:${TEST_PORT}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Model-Name': 'gemini'
      },
      body: JSON.stringify({
        model: 'gemini',
        messages: [{ role: 'user', content: 'CI health check' }]
      })
    });
    if (!chatRes.ok) throw new Error(`/v1/chat/completions returned status ${chatRes.status}`);
    const chatData = await chatRes.json();
    if (!chatData.choices || chatData.choices.length === 0) {
      throw new Error('/v1/chat/completions choices payload missing');
    }
    console.log('  ✅ /v1/chat/completions passed');

    // Test 4: Anthropic endpoint
    console.log('[CI TEST] 4. Testing /anthropic/models...');
    const anthropicRes = await fetch(`http://localhost:${TEST_PORT}/anthropic/models`);
    if (!anthropicRes.ok) throw new Error(`/anthropic/models returned status ${anthropicRes.status}`);
    console.log('  ✅ /anthropic/models passed');

    console.log('\n🎉 ALL CI TESTS PASSED SUCCESSFULLY!\n');
    server.close();
  } catch (err) {
    console.error(`\n❌ CI TEST FAILED: ${err.message}\n`);
    server.close(() => process.exit(1));
  }
});
