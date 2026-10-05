import express from 'express';
import cors from 'cors';
import handler from './api/index.js';
import {
  registerUser,
  loginUser,
  seedSuperAdmin,
  SUPER_ADMIN_CREDENTIALS
} from './auth.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Auth endpoints for CI test
app.post('/api/auth/login', (req, res) => {
  try {
    const { email, password } = req.body || {};
    const result = loginUser({ email, password });
    return res.status(200).json({ success: true, ...result });
  } catch (err) {
    return res.status(401).json({ success: false, error: err.message });
  }
});

app.post('/api/auth/register', (req, res) => {
  try {
    const { name, email, password } = req.body || {};
    const result = registerUser({ name, email, password });
    return res.status(201).json({ success: true, ...result });
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

app.get('/api/auth/superadmin-credentials', (_req, res) => {
  return res.status(200).json({
    email: SUPER_ADMIN_CREDENTIALS.email,
    password: SUPER_ADMIN_CREDENTIALS.password,
    role: SUPER_ADMIN_CREDENTIALS.role
  });
});

app.all('*', handler);

const TEST_PORT = 3099;
const server = app.listen(TEST_PORT, async () => {
  console.log(`[CI TEST] Server started on port ${TEST_PORT}`);

  try {
    // Seed Super Admin
    seedSuperAdmin();

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

    // Test 4: Super Admin Login & JWT Generation
    console.log('[CI TEST] 4. Testing Super Admin Auth Login...');
    const loginRes = await fetch(`http://localhost:${TEST_PORT}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: SUPER_ADMIN_CREDENTIALS.email,
        password: SUPER_ADMIN_CREDENTIALS.password
      })
    });
    if (!loginRes.ok) throw new Error(`/api/auth/login returned status ${loginRes.status}`);
    const loginData = await loginRes.json();
    if (!loginData.token || loginData.user?.role !== 'superadmin') {
      throw new Error('Super Admin login verification failed');
    }
    console.log('  ✅ Super Admin Authentication verified (JWT token created)');

    // Test 5: Anthropic endpoint
    console.log('[CI TEST] 5. Testing /anthropic/models...');
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
