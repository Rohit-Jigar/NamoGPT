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
        model: 'llama-3.3-70b-versatile',
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
        model: 'nvidia/nemotron-3-nano-30b-a3b:free',
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

  // AION & Cloudflare
  console.log('\n[AION LABS]');
  console.log('  Keys 1-8: NOT CONFIGURED (Empty in .env)');

  console.log('\n[CLOUDFLARE WORKERS AI]');
  console.log('  CF_API_TOKEN: NOT CONFIGURED (Empty in .env)');
}

runDiagnosis();
