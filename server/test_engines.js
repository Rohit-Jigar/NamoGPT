import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEST_PORT = 3097;

async function waitForServer(port, maxRetries = 20) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const res = await fetch(`http://localhost:${port}/health`);
      if (res.ok) return true;
    } catch (_err) {
      await new Promise(r => setTimeout(r, 250));
    }
  }
  return false;
}

async function runTests() {
  console.log(`[TEST ENGINES] Starting server on port ${TEST_PORT}...`);
  const serverPath = path.resolve(__dirname, 'server.js');
  const serverProc = spawn('node', [serverPath], {
    cwd: __dirname,
    env: { ...process.env, PORT: String(TEST_PORT), PROXY_PORT: String(TEST_PORT) },
    stdio: 'inherit'
  });

  const ready = await waitForServer(TEST_PORT);
  if (!ready) {
    serverProc.kill();
    throw new Error('Server failed to start in time.');
  }
  console.log('[TEST ENGINES] Server is ready.');

  try {
    // ----------------------------------------------------
    // TEST 1: POST /api/rag/query
    // ----------------------------------------------------
    console.log('\n[TEST 1] Testing POST /api/rag/query (Text & CSV)...');
    const ragRes = await fetch(`http://localhost:${TEST_PORT}/api/rag/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        documents: [
          {
            name: 'architecture_doc.txt',
            content: 'NamoGPT features intelligent multi-provider routing across Gemini, Groq, OpenRouter, and Cloudflare. It includes autonomous Deep Research capabilities.'
          },
          {
            name: 'quarterly_metrics.csv',
            content: 'Quarter,Metric,Value,Status\nQ1,Latency,45ms,Healthy\nQ2,Throughput,1200rps,Optimal\nQ3,Reliability,99.99%,Excellent'
          }
        ],
        query: 'What is the Throughput metric in Q2?',
        topK: 3
      })
    });

    if (!ragRes.ok) throw new Error(`RAG query failed with status ${ragRes.status}`);
    const ragData = await ragRes.json();
    console.log('  RAG success:', ragData.success);
    console.log('  RAG results count:', ragData.count);
    console.log('  Top match score:', ragData.results[0]?.score);
    console.log('  Top match doc:', ragData.results[0]?.documentName);
    if (!ragData.formattedContext || !ragData.formattedContext.includes('quarterly_metrics.csv')) {
      throw new Error('RAG formatted context did not include expected document reference');
    }
    console.log('  ✅ POST /api/rag/query passed.');

    // ----------------------------------------------------
    // TEST 2: POST /api/code/execute (JavaScript)
    // ----------------------------------------------------
    console.log('\n[TEST 2] Testing POST /api/code/execute (JavaScript)...');
    const jsRes = await fetch(`http://localhost:${TEST_PORT}/api/code/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        language: 'javascript',
        code: `
          console.log("Executing in isolated VM...");
          const fib = [1, 1, 2, 3, 5, 8, 13];
          const sum = fib.reduce((acc, n) => acc + n, 0);
          console.log("Fibonacci sum:", sum);
          sum;
        `
      })
    });

    if (!jsRes.ok) throw new Error(`Code execute JS failed with status ${jsRes.status}`);
    const jsData = await jsRes.json();
    console.log('  JS execution success:', jsData.success);
    console.log('  JS stdout:', jsData.stdout.trim());
    console.log('  JS result:', jsData.result);
    console.log('  JS execution time:', jsData.executionTimeMs, 'ms');
    if (!jsData.success || jsData.result !== 33) {
      throw new Error(`Unexpected JS result: ${jsData.result}`);
    }
    console.log('  ✅ POST /api/code/execute (JS) passed.');

    // ----------------------------------------------------
    // TEST 3: POST /api/code/execute (Python)
    // ----------------------------------------------------
    console.log('\n[TEST 3] Testing POST /api/code/execute (Python)...');
    const pyRes = await fetch(`http://localhost:${TEST_PORT}/api/code/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        language: 'python',
        code: `
import json
data = {"status": "ok", "computed": 42 * 2}
print("Python stdout output:", json.dumps(data))
print("Finished successfully")
`
      })
    });

    if (!pyRes.ok) throw new Error(`Code execute Python failed with status ${pyRes.status}`);
    const pyData = await pyRes.json();
    console.log('  Python execution success:', pyData.success);
    console.log('  Python stdout:', pyData.stdout.trim());
    console.log('  Python result:', pyData.result);
    console.log('  Python execution time:', pyData.executionTimeMs, 'ms');
    if (!pyData.success || !pyData.stdout.includes('84')) {
      throw new Error(`Unexpected Python output: ${pyData.stdout}`);
    }
    console.log('  ✅ POST /api/code/execute (Python) passed.');

    // ----------------------------------------------------
    // TEST 4: POST /api/research
    // ----------------------------------------------------
    console.log('\n[TEST 4] Testing POST /api/research...');
    const researchRes = await fetch(`http://localhost:${TEST_PORT}/api/research`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        topic: 'AI Code Generation Benchmarks 2026'
      })
    });

    if (!researchRes.ok) throw new Error(`Research failed with status ${researchRes.status}`);
    const researchData = await researchRes.json();
    console.log('  Research success:', researchData.success);
    console.log('  Research topic:', researchData.topic);
    console.log('  Research plan queries count:', researchData.plan?.length);
    console.log('  Research sources count:', researchData.sources?.length);
    console.log('  Report length (chars):', researchData.report?.length);
    if (!researchData.report.includes('Executive Summary') || !researchData.report.includes('Comparative Matrix')) {
      throw new Error('Research report missing required section headers');
    }
    console.log('  ✅ POST /api/research passed.');

    console.log('\n========================================');
    console.log('🎉 ALL BACKEND ENGINE ENDPOINTS VERIFIED & PASSING!');
    console.log('========================================\n');
  } finally {
    serverProc.kill();
  }
}

runTests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
