import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Load .env
if (fs.existsSync(path.resolve(process.cwd(), '.env'))) {
  dotenv.config({ path: path.resolve(process.cwd(), '.env') });
} else if (fs.existsSync(path.resolve(process.cwd(), '..', '.env'))) {
  dotenv.config({ path: path.resolve(process.cwd(), '..', '.env') });
} else {
  dotenv.config();
}

async function testGroq(key, index) {
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`
      },
      body: JSON.stringify({
        model: 'openai/gpt-oss-120b',
        messages: [{ role: 'user', content: 'Say "OK"' }],
        max_tokens: 5
      })
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      return { status: 'WORKING', detail: data.choices?.[0]?.message?.content?.trim() };
    }
    return { status: 'FAILED', code: res.status, error: data.error?.message || 'HTTP ' + res.status };
  } catch (err) {
    return { status: 'ERROR', error: err.message };
  }
}

async function testGemini(key, index) {
  try {
    const res = await fetch('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`
      },
      body: JSON.stringify({
        model: 'gemini-2.0-flash',
        messages: [{ role: 'user', content: 'Say "OK"' }],
        max_tokens: 5
      })
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      return { status: 'WORKING', detail: data.choices?.[0]?.message?.content?.trim() };
    }
    return { status: 'FAILED', code: res.status, error: data.error?.message || 'HTTP ' + res.status };
  } catch (err) {
    return { status: 'ERROR', error: err.message };
  }
}

async function testOpenRouter(key) {
  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`
      },
      body: JSON.stringify({
        model: 'qwen/qwen3.8-27b:free',
        messages: [{ role: 'user', content: 'Say "OK"' }],
        max_tokens: 5
      })
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      return { status: 'WORKING', detail: data.choices?.[0]?.message?.content?.trim() };
    }
    return { status: 'FAILED', code: res.status, error: data.error?.message || 'HTTP ' + res.status };
  } catch (err) {
    return { status: 'ERROR', error: err.message };
  }
}

async function testNvidia(key) {
  try {
    const res = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`
      },
      body: JSON.stringify({
        model: 'nvidia/nemotron-4-340b-instruct',
        messages: [{ role: 'user', content: 'Say "OK"' }],
        max_tokens: 5
      })
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      return { status: 'WORKING', detail: data.choices?.[0]?.message?.content?.trim() };
    }
    return { status: 'FAILED', code: res.status, error: data.error?.message || 'HTTP ' + res.status };
  } catch (err) {
    return { status: 'ERROR', error: err.message };
  }
}

async function testAion(key) {
  try {
    const res = await fetch('https://api.aionlabs.ai/v1/models', {
      headers: { 'Authorization': `Bearer ${key}` }
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      const count = Array.isArray(data?.data) ? data.data.length : 1;
      return { status: 'WORKING', detail: `${count} model(s) verified (aion-labs/aion-2.0)` };
    }
    return { status: 'FAILED', code: res.status, error: data.error?.message || 'HTTP ' + res.status };
  } catch (err) {
    return { status: 'ERROR', error: err.message };
  }
}

async function testTavily(key) {
  try {
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: key, query: 'ping' })
    });
    if (res.ok) {
      return { status: 'WORKING', detail: 'Tavily Search Engine operational' };
    }
    return { status: 'FAILED', code: res.status, error: 'HTTP ' + res.status };
  } catch (err) {
    return { status: 'ERROR', error: err.message };
  }
}

async function runDiagnosis() {
  console.log('=== NamoGPT Live API Key Diagnosis ===\n');

  // Test Groq Keys
  console.log('[GROQ CLOUD]');
  for (let i = 1; i <= 3; i++) {
    const key = process.env[`GROQ_API_KEY_${i}`];
    if (key) {
      const res = await testGroq(key, i);
      console.log(`  Key ${i} (${key.slice(0, 10)}...): ${res.status}`, res.status === 'WORKING' ? `-> "${res.detail}"` : `-> [${res.code}] ${res.error}`);
    } else {
      console.log(`  Key ${i}: NOT CONFIGURED`);
    }
  }

  // Test Gemini Keys
  console.log('\n[GOOGLE GEMINI]');
  for (let i = 1; i <= 6; i++) {
    const key = process.env[`GEMINI_API_KEY_${i}`];
    if (key) {
      const res = await testGemini(key, i);
      console.log(`  Key ${i} (${key.slice(0, 10)}...): ${res.status}`, res.status === 'WORKING' ? `-> "${res.detail}"` : `-> [${res.code}] ${res.error}`);
    } else {
      console.log(`  Key ${i}: NOT CONFIGURED`);
    }
  }

  // Test OpenRouter
  console.log('\n[OPENROUTER]');
  const orKey = process.env.OPEN_ROUTER_API_KEY_1;
  if (orKey) {
    const res = await testOpenRouter(orKey);
    console.log(`  Key 1 (${orKey.slice(0, 12)}...): ${res.status}`, res.status === 'WORKING' ? `-> "${res.detail}"` : `-> [${res.code}] ${res.error}`);
  } else {
    console.log('  Key 1: NOT CONFIGURED');
  }

  // Test NVIDIA
  console.log('\n[NVIDIA NIM]');
  const nvKey = process.env.NVIDIA_NIM_API_KEY_1;
  if (nvKey) {
    const res = await testNvidia(nvKey);
    console.log(`  Key 1 (${nvKey.slice(0, 12)}...): ${res.status}`, res.status === 'WORKING' ? `-> "${res.detail}"` : `-> [${res.code}] ${res.error}`);
  } else {
    console.log('  Key 1: NOT CONFIGURED');
  }

  // AION Labs
  console.log('\n[AION LABS]');
  let aionFound = false;
  for (let i = 1; i <= 8; i++) {
    const key = process.env[`AION_API_KEY_${i}`];
    if (key) {
      aionFound = true;
      const res = await testAion(key);
      console.log(`  Key ${i} (${key.slice(0, 8)}...): ${res.status}`, res.status === 'WORKING' ? `-> "${res.detail}"` : `-> [${res.code}] ${res.error}`);
    }
  }
  if (!aionFound) {
    console.log('  Keys 1-8: NOT CONFIGURED');
  }

  // Tavily Real-Time Search
  console.log('\n[TAVILY SEARCH]');
  const tavilyKey = process.env.TAVILY_API_KEY;
  if (tavilyKey) {
    const res = await testTavily(tavilyKey);
    console.log(`  Key (${tavilyKey.slice(0, 8)}...): ${res.status}`, res.status === 'WORKING' ? `-> "${res.detail}"` : `-> [${res.code}] ${res.error}`);
  } else {
    console.log('  Tavily Key: NOT CONFIGURED (Using DuckDuckGo/Wikipedia)');
  }

  console.log('\n[CLOUDFLARE WORKERS AI]');
  console.log(process.env.CF_API_TOKEN ? '  CF_API_TOKEN: CONFIGURED' : '  CF_API_TOKEN: NOT CONFIGURED (Empty in .env)');
}

runDiagnosis();
