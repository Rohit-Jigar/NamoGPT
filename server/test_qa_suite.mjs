import fs from 'node:fs';
import path from 'node:path';

const BASE_URL = 'http://localhost:3001';

async function parseSSE(response, onDelta) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  let fullContent = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop(); // keep last incomplete line in buffer

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith('data:')) continue;
      const dataStr = trimmed.slice(5).trim();
      if (dataStr === '[DONE]') continue;

      try {
        const parsed = JSON.parse(dataStr);
        const delta = parsed.choices?.[0]?.delta?.content || '';
        if (delta) {
          fullContent += delta;
          if (onDelta) onDelta(delta);
        }
      } catch (_e) {
        // ignore parse errors for partial chunks
      }
    }
  }

  return fullContent;
}

async function runQASuite() {
  console.log('===============================================================');
  console.log('🚀 NAMOGPT AUTOMATION QA TEST SUITE');
  console.log('Target Server:', BASE_URL);
  console.log('Time:', new Date().toISOString());
  console.log('===============================================================\n');

  const report = {
    timestamp: new Date().toISOString(),
    tests: [],
    multiTurnDetails: [],
    modelVerification: {},
    keysStatus: {},
    performanceMetrics: {},
    allPassed: true
  };

  function recordTest(name, passed, details = {}, latencyMs = null) {
    report.tests.push({ name, passed, details, latencyMs });
    const statusIcon = passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${statusIcon} - ${name} (${latencyMs !== null ? `${latencyMs}ms` : 'N/A'})`);
    if (!passed) report.allPassed = false;
  }

  // -------------------------------------------------------------
  // SUITE 1: Active Models & Keys Verification
  // -------------------------------------------------------------
  console.log('\n--- SUITE 1: Active Models & Keys Verification ---');
  try {
    const t0 = Date.now();
    const modelsRes = await fetch(`${BASE_URL}/api/models`);
    const modelsLatency = Date.now() - t0;
    if (!modelsRes.ok) throw new Error(`HTTP ${modelsRes.status}`);
    const modelsData = await modelsRes.json();
    const modelsList = modelsData.data || [];

    const geminiModel = modelsList.find(m => m.id === 'gemini');
    const groqModel = modelsList.find(m => m.id === 'groq');
    const autoModel = modelsList.find(m => m.id === 'auto');

    const geminiActive = Boolean(
      geminiModel &&
      geminiModel.status === 'active' &&
      geminiModel.isWorking === true &&
      geminiModel.badge !== 'Coming Soon' &&
      !geminiModel.isComingSoon
    );

    const groqActive = Boolean(
      groqModel &&
      groqModel.status === 'active' &&
      groqModel.isWorking === true &&
      groqModel.badge !== 'Coming Soon' &&
      !groqModel.isComingSoon
    );

    const autoActive = Boolean(
      autoModel &&
      autoModel.status === 'active' &&
      autoModel.isWorking === true
    );

    report.modelVerification = {
      gemini: {
        id: geminiModel?.id,
        name: geminiModel?.name,
        status: geminiModel?.status,
        badge: geminiModel?.badge,
        isWorking: geminiModel?.isWorking,
        isConfigured: geminiModel?.isConfigured,
        activeKeys: geminiModel?.activeKeys
      },
      groq: {
        id: groqModel?.id,
        name: groqModel?.name,
        status: groqModel?.status,
        badge: groqModel?.badge,
        isWorking: groqModel?.isWorking,
        isConfigured: groqModel?.isConfigured,
        activeKeys: groqModel?.activeKeys
      },
      auto: {
        id: autoModel?.id,
        name: autoModel?.name,
        status: autoModel?.status,
        isWorking: autoModel?.isWorking
      }
    };

    recordTest('GET /api/models - Gemini 2.5 Flash active & working', geminiActive, report.modelVerification.gemini, modelsLatency);
    recordTest('GET /api/models - GPT-OSS 120B (Groq) active & working', groqActive, report.modelVerification.groq, modelsLatency);
    recordTest('GET /api/models - Auto (Smart Router) active & working', autoActive, report.modelVerification.auto, modelsLatency);
  } catch (err) {
    recordTest('GET /api/models verification', false, { error: err.message });
  }

  try {
    const t0 = Date.now();
    const keysRes = await fetch(`${BASE_URL}/api/keys/status`);
    const keysLatency = Date.now() - t0;
    if (!keysRes.ok) throw new Error(`HTTP ${keysRes.status}`);
    const keysData = await keysRes.json();
    report.keysStatus = keysData;

    const keysValid = keysData.gemini === 'active' && keysData.groq === 'active';
    recordTest('GET /api/keys/status - Provider keys verified', keysValid, keysData, keysLatency);
  } catch (err) {
    recordTest('GET /api/keys/status verification', false, { error: err.message });
  }

  // -------------------------------------------------------------
  // SUITE 2: Multi-turn Conversational Endurance in 'auto' Mode
  // -------------------------------------------------------------
  console.log('\n--- SUITE 2: Multi-turn Conversational Endurance (5 Turns in Auto Mode) ---');
  const turns = [
    {
      turn: 1,
      prompt: "Hello! My name is Dr. Aris Thorne. I am an astrophysicist studying gravitational lensing in the Coma Cluster. Keep your answer brief.",
      expectedTopic: "welcome / acknowledgement"
    },
    {
      turn: 2,
      prompt: "Can you recall my name and my field of research?",
      expectedTopic: "Dr. Aris Thorne / astrophysicist / gravitational lensing"
    },
    {
      turn: 3,
      prompt: "Which galaxy cluster did I specify I am studying?",
      expectedTopic: "Coma Cluster"
    },
    {
      turn: 4,
      prompt: "Calculate the Schwarzchild radius in kilometers for a black hole of 10 solar masses. Keep it concise.",
      expectedTopic: "roughly 30 km (2.95 * 10 km)"
    },
    {
      turn: 5,
      prompt: "Summarize our conversation so far in exactly two bullet points.",
      expectedTopic: "Summary of research focus and calculation"
    }
  ];

  const conversationHistory = [];

  for (const t of turns) {
    const tStart = Date.now();
    conversationHistory.push({ role: 'user', content: t.prompt });

    try {
      const res = await fetch(`${BASE_URL}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Model-Name': 'auto'
        },
        body: JSON.stringify({
          model: 'auto',
          messages: conversationHistory,
          temperature: 0.2,
          stream: false
        })
      });

      const latencyMs = Date.now() - tStart;
      if (!res.ok) {
        const errorBody = await res.text();
        throw new Error(`HTTP ${res.status}: ${errorBody}`);
      }

      const data = await res.json();
      const content = data.choices?.[0]?.message?.content || '';
      const finishReason = data.choices?.[0]?.finish_reason || 'stop';
      const modelUsed = data.model || 'auto';

      if (!content || content.length < 5) {
        throw new Error('Received empty or truncated completion response.');
      }

      conversationHistory.push({ role: 'assistant', content });

      const turnDetail = {
        turn: t.turn,
        prompt: t.prompt,
        responseExcerpt: content.slice(0, 150).replace(/\n/g, ' ') + '...',
        fullLength: content.length,
        modelUsed,
        finishReason,
        latencyMs,
        historyLength: conversationHistory.length
      };

      report.multiTurnDetails.push(turnDetail);
      recordTest(`Multi-turn Conversation - Turn ${t.turn} Completed`, true, turnDetail, latencyMs);
    } catch (err) {
      const turnDetail = {
        turn: t.turn,
        prompt: t.prompt,
        error: err.message,
        historyLength: conversationHistory.length
      };
      report.multiTurnDetails.push(turnDetail);
      recordTest(`Multi-turn Conversation - Turn ${t.turn} Completed`, false, turnDetail, Date.now() - tStart);
      break; // stop on failure
    }
  }

  // Also test 1 Streaming turn in Auto mode to verify SSE streaming pipeline
  console.log('\n--- SUITE 2B: Streaming Completion Endurance in Auto Mode ---');
  try {
    const t0 = Date.now();
    const streamRes = await fetch(`${BASE_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Model-Name': 'auto'
      },
      body: JSON.stringify({
        model: 'auto',
        messages: [
          { role: 'user', content: 'Count from 1 to 5 separated by hyphens (e.g. 1-2-3-4-5).' }
        ],
        stream: true
      })
    });

    if (!streamRes.ok) throw new Error(`HTTP ${streamRes.status}`);
    const streamedText = await parseSSE(streamRes);
    const streamLatency = Date.now() - t0;
    const streamPassed = streamedText.includes('1') && streamedText.includes('5');

    recordTest('Streaming SSE Chat Completion (Auto Mode)', streamPassed, { streamedText, length: streamedText.length }, streamLatency);
  } catch (err) {
    recordTest('Streaming SSE Chat Completion (Auto Mode)', false, { error: err.message });
  }

  // -------------------------------------------------------------
  // SUITE 3: Code Sandbox Execution (JS & Python)
  // -------------------------------------------------------------
  console.log('\n--- SUITE 3: Platform Sandbox Code Execution ---');
  try {
    const t0 = Date.now();
    const jsRes = await fetch(`${BASE_URL}/api/code/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        language: 'javascript',
        code: `
          const matrix = [[1, 2], [3, 4]];
          const det = (matrix[0][0] * matrix[1][1]) - (matrix[0][1] * matrix[1][0]);
          console.log("Determinant:", det);
          det;
        `
      })
    });
    const jsLatency = Date.now() - t0;
    const jsData = await jsRes.json();
    const jsPassed = jsData.success === true && jsData.result === -2 && jsData.stdout.includes('-2');
    recordTest('POST /api/code/execute (JavaScript VM)', jsPassed, jsData, jsLatency);
  } catch (err) {
    recordTest('POST /api/code/execute (JavaScript VM)', false, { error: err.message });
  }

  try {
    const t0 = Date.now();
    const pyRes = await fetch(`${BASE_URL}/api/code/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        language: 'python',
        code: `
import math
nums = [16, 25, 36, 49]
roots = [math.isqrt(n) for n in nums]
print("Square roots:", roots)
`
      })
    });
    const pyLatency = Date.now() - t0;
    const pyData = await pyRes.json();
    const pyPassed = pyData.success === true && pyData.stdout.includes('[4, 5, 6, 7]');
    recordTest('POST /api/code/execute (Python Subprocess)', pyPassed, pyData, pyLatency);
  } catch (err) {
    recordTest('POST /api/code/execute (Python Subprocess)', false, { error: err.message });
  }

  // -------------------------------------------------------------
  // SUITE 4: MCP Tool Execution
  // -------------------------------------------------------------
  console.log('\n--- SUITE 4: Model Context Protocol (MCP) Tools ---');
  try {
    const t0 = Date.now();
    const mcpMathRes = await fetch(`${BASE_URL}/api/mcp/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        toolName: 'ai_math_interpreter',
        arguments: { expression: 'Math.pow(2, 10) + Math.round(15.7)' }
      })
    });
    const mcpMathLatency = Date.now() - t0;
    const mcpMathData = await mcpMathRes.json();
    const mcpMathPassed = mcpMathData.success === true && mcpMathData.result?.computed === 1040;
    recordTest('POST /api/mcp/execute (ai_math_interpreter)', mcpMathPassed, mcpMathData, mcpMathLatency);
  } catch (err) {
    recordTest('POST /api/mcp/execute (ai_math_interpreter)', false, { error: err.message });
  }

  try {
    const t0 = Date.now();
    const mcpSysRes = await fetch(`${BASE_URL}/api/mcp/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        toolName: 'ai_system_info'
      })
    });
    const mcpSysLatency = Date.now() - t0;
    const mcpSysData = await mcpSysRes.json();
    const mcpSysPassed = mcpSysData.success === true && Boolean(mcpSysData.result?.platform) && Boolean(mcpSysData.result?.nodeVersion);
    recordTest('POST /api/mcp/execute (ai_system_info)', mcpSysPassed, mcpSysData, mcpSysLatency);
  } catch (err) {
    recordTest('POST /api/mcp/execute (ai_system_info)', false, { error: err.message });
  }

  // -------------------------------------------------------------
  // SUITE 5: RAG Document Retrieval
  // -------------------------------------------------------------
  console.log('\n--- SUITE 5: Retrieval-Augmented Generation (RAG) ---');
  try {
    const t0 = Date.now();
    const ragRes = await fetch(`${BASE_URL}/api/rag/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        documents: [
          { name: 'cloud_infra.txt', content: 'NamoGPT utilizes high-concurrency micro-workers for edge caching and load balancing.' },
          { name: 'quantum_gate.txt', content: 'Superconducting transmon qubits require dilution refrigerators operating at 15 millikelvin.' },
          { name: 'culinary_guide.txt', content: 'Neapolitan pizza crust requires San Marzano tomatoes and double-zero flour.' }
        ],
        query: 'What operating temperature is required for superconducting transmon qubits?',
        topK: 2
      })
    });
    const ragLatency = Date.now() - t0;
    const ragData = await ragRes.json();
    const topDoc = ragData.results?.[0];
    const ragPassed = ragData.success === true &&
      ragData.count >= 1 &&
      topDoc?.documentName === 'quantum_gate.txt' &&
      ragData.formattedContext?.includes('quantum_gate.txt');

    recordTest('POST /api/rag/query (Document Retrieval & Ranking)', ragPassed, { count: ragData.count, topDoc: topDoc?.documentName, score: topDoc?.score }, ragLatency);
  } catch (err) {
    recordTest('POST /api/rag/query (Document Retrieval & Ranking)', false, { error: err.message });
  }

  // -------------------------------------------------------------
  // SUITE 6: Autonomous Deep Research
  // -------------------------------------------------------------
  console.log('\n--- SUITE 6: Autonomous Deep Research ---');
  try {
    const t0 = Date.now();
    const resRes = await fetch(`${BASE_URL}/api/research`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        topic: 'Emerging Quantum Computing Frameworks in 2026'
      })
    });
    const resLatency = Date.now() - t0;
    const resData = await resRes.json();
    const resPassed = resData.success === true &&
      Array.isArray(resData.plan) &&
      resData.plan.length > 0 &&
      typeof resData.report === 'string' &&
      resData.report.length > 500;

    recordTest('POST /api/research (Autonomous Multi-Step Deep Research)', resPassed, {
      topic: resData.topic,
      planQueries: resData.plan?.length,
      sourcesCount: resData.sources?.length,
      reportLength: resData.report?.length
    }, resLatency);
  } catch (err) {
    recordTest('POST /api/research (Autonomous Multi-Step Deep Research)', false, { error: err.message });
  }

  // Write results to disk for reference
  const outputPath = path.resolve('server', 'qa_report.json');
  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));

  console.log('\n===============================================================');
  console.log(`QA SUITE RUN FINISHED. TOTAL TESTS: ${report.tests.length}`);
  const passCount = report.tests.filter(t => t.passed).length;
  const failCount = report.tests.length - passCount;
  console.log(`PASSED: ${passCount} | FAILED: ${failCount}`);
  console.log(`REPORT SAVED TO: ${outputPath}`);
  console.log('===============================================================\n');

  if (!report.allPassed) {
    process.exit(1);
  }
}

runQASuite().catch(err => {
  console.error('Fatal QA Suite Error:', err);
  process.exit(1);
});
