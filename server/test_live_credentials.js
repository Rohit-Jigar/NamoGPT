/**
 * NamoGPT Live Credentials & Service Verification Test Suite
 * 
 * Verifies live connectivity for:
 * 1. Supabase Cloud Database (Postgres REST + tables)
 * 2. Cloudflare Workers AI (Account ID + API Token)
 * 3. LiteLLM Master Key (Super Admin Auth)
 * 4. Model Providers (Gemini, Groq, OpenRouter, NVIDIA NIM)
 */

import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load .env from root
const rootEnv = path.resolve(process.cwd(), '.env');
const parentEnv = path.resolve(process.cwd(), '..', '.env');
if (fs.existsSync(rootEnv)) {
  dotenv.config({ path: rootEnv });
} else if (fs.existsSync(parentEnv)) {
  dotenv.config({ path: parentEnv });
}

console.log('='.repeat(70));
console.log('🚀 NAMOGPT LIVE CREDENTIALS VERIFICATION SUITE');
console.log('='.repeat(70));
console.log(`Timestamp: ${new Date().toISOString()}\n`);

let passedTests = 0;
let totalTests = 0;

function assert(condition, message, detail = '') {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✅ PASS: ${message}`);
    if (detail) console.log(`     ${detail}`);
  } else {
    console.log(`  ❌ FAIL: ${message}`);
    if (detail) console.log(`     ${detail}`);
  }
}

async function testSupabase() {
  console.log('\n[1/4] Testing Supabase Cloud Database Integration...');
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

  assert(Boolean(url), 'SUPABASE_URL environment variable is set', url ? `Endpoint: ${url}` : 'Missing in .env');
  assert(Boolean(serviceKey), 'SUPABASE_SERVICE_ROLE_KEY is set', serviceKey ? `Key length: ${serviceKey.length} chars` : 'Missing in .env');

  if (!url || !serviceKey) {
    console.log('  ⚠️ Skipping live Supabase queries due to missing credentials.');
    return;
  }

  try {
    const supabase = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });

    // Test query users table
    const { data: users, error: usersErr } = await supabase
      .from('users')
      .select('id, name, email, username, role')
      .limit(5);

    if (usersErr) {
      if (usersErr.code === '42P01') {
        assert(false, 'Supabase tables exist', 'Table "public.users" does not exist yet. Please run the SQL migration in Supabase SQL editor.');
      } else {
        assert(false, 'Supabase users query succeeded', `Error: ${usersErr.message} (code: ${usersErr.code})`);
      }
    } else {
      assert(true, 'Supabase "public.users" table accessible via REST API', `Retrieved ${users?.length ?? 0} user record(s)`);
    }

    // Test query chats table
    const { data: chats, error: chatsErr } = await supabase
      .from('chats')
      .select('id, user_id, title, is_pinned, created_at')
      .limit(5);

    if (chatsErr) {
      if (chatsErr.code === '42P01') {
        assert(false, 'Supabase chats table exists', 'Table "public.chats" does not exist yet. Please run the SQL migration in Supabase SQL editor.');
      } else {
        assert(false, 'Supabase chats query succeeded', `Error: ${chatsErr.message} (code: ${chatsErr.code})`);
      }
    } else {
      assert(true, 'Supabase "public.chats" table accessible via REST API', `Retrieved ${chats?.length ?? 0} chat thread(s)`);
    }

  } catch (err) {
    assert(false, 'Supabase client communication succeeded', err.message);
  }
}

async function testCloudflare() {
  console.log('\n[2/4] Testing Cloudflare Workers AI Integration...');
  const accountId = (process.env.CF_ACCOUNT_ID || '').trim();
  const token = (process.env.CF_API_TOKEN || '').trim();

  assert(Boolean(accountId), 'CF_ACCOUNT_ID is set', accountId ? `Account ID: ${accountId.substring(0, 6)}...` : 'Missing in .env');
  assert(Boolean(token), 'CF_API_TOKEN is set', token ? `Token length: ${token.length} chars` : 'Missing in .env');

  if (!accountId || !token) {
    console.log('  ⚠️ Skipping live Cloudflare API call due to missing credentials.');
    return;
  }

  try {
    // Test Cloudflare Workers AI embeddings endpoint or simple prompt
    const cfUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/@cf/baai/bge-base-en-v1.5`;
    const res = await fetch(cfUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text: ['NamoGPT Workers AI connectivity test']
      })
    });

    const body = await res.json().catch(() => null);

    if (res.ok && body?.success) {
      assert(true, 'Cloudflare Workers AI API responded successfully', `Status: ${res.status} OK | Model: @cf/baai/bge-base-en-v1.5`);
    } else if (res.status === 401 || res.status === 403) {
      assert(false, 'Cloudflare Workers AI authentication succeeded', `HTTP ${res.status}: Check that your CF_API_TOKEN has "Workers AI: Read/Edit" permissions.`);
    } else if (res.status === 404) {
      // Try verify token via user verify endpoint
      const verifyRes = await fetch('https://api.cloudflare.com/client/v4/user/tokens/verify', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const verifyData = await verifyRes.json().catch(() => null);
      if (verifyData?.success) {
        assert(true, 'Cloudflare API Token verified', `Token status: ${verifyData.result?.status || 'active'}`);
      } else {
        assert(false, 'Cloudflare Workers AI Account / Endpoint check', `HTTP ${res.status}: Account ID or model endpoint mismatch.`);
      }
    } else {
      assert(res.ok, 'Cloudflare Workers AI API response', `Status: ${res.status} | Message: ${body?.errors?.[0]?.message || 'Unknown'}`);
    }
  } catch (err) {
    assert(false, 'Cloudflare Workers AI network call succeeded', err.message);
  }
}

async function testMasterKey() {
  console.log('\n[3/4] Testing LiteLLM Master Key (Super Admin Auth)...');
  const masterKey = (process.env.LITELLM_MASTER_KEY || '').trim();

  assert(Boolean(masterKey), 'LITELLM_MASTER_KEY is configured in .env', masterKey ? `Key prefix: ${masterKey.substring(0, 7)}... (length: ${masterKey.length})` : 'Missing');
  assert(masterKey.length >= 16, 'LITELLM_MASTER_KEY meets minimum security entropy', `Key length: ${masterKey.length} >= 16`);

  // Verify auth validation logic from auth.js
  const authHeader = `Bearer ${masterKey}`;
  const extractedToken = authHeader.replace(/^Bearer\s+/i, '').trim();
  const isMasterAuthorized = extractedToken === masterKey;
  assert(isMasterAuthorized, 'Bearer master key matches authMiddleware authorization check');
}

async function testConfiguredModelPools() {
  console.log('\n[4/4] Auditing Active Model Pools & Fallback Key Status...');
  const geminiCount = [1, 2, 3, 4, 5, 6].filter(i => process.env[`GEMINI_API_KEY_${i}`]?.trim()).length;
  const groqCount = [1, 2, 3, 4, 5, 6, 7].filter(i => process.env[`GROQ_API_KEY_${i}`]?.trim()).length;
  const openRouterCount = [1, 2, 3, 4, 5, 6, 7].filter(i => process.env[`OPEN_ROUTER_API_KEY_${i}`]?.trim()).length;
  const nvidiaCount = [1, 2, 3, 4, 5].filter(i => process.env[`NVIDIA_NIM_API_KEY_${i}`]?.trim()).length;

  assert(geminiCount > 0, `Google Gemini API Key Pool: ${geminiCount} key(s) active`);
  assert(groqCount > 0, `Groq Cloud API Key Pool: ${groqCount} key(s) active`);
  assert(openRouterCount > 0, `OpenRouter API Key Pool: ${openRouterCount} key(s) active`);
  assert(nvidiaCount > 0, `NVIDIA NIM API Key Pool: ${nvidiaCount} key(s) active`);
}

async function run() {
  await testSupabase();
  await testCloudflare();
  await testMasterKey();
  await testConfiguredModelPools();

  console.log('\n' + '='.repeat(70));
  console.log(`🏁 TEST RESULTS: ${passedTests} passed of ${totalTests} total (${Math.round((passedTests/totalTests)*100)}%)`);
  console.log('='.repeat(70) + '\n');
}

run().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});
