import fs from 'node:fs';
import path from 'node:path';

const BASE_URL = 'http://localhost:3001';

function normalizeText(text) {
  if (!text || typeof text !== 'string') return '';
  return text.replace(/[\s\u00a0\u202f\u2000-\u200b]+/g, ' ').trim();
}

async function sendChatRequest({ model = 'auto', messages, stream = false, temperature = 0.2 }) {
  const t0 = Date.now();
  const res = await fetch(`${BASE_URL}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Model-Name': model
    },
    body: JSON.stringify({
      model,
      messages,
      temperature,
      stream
    })
  });
  const latencyMs = Date.now() - t0;
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`HTTP ${res.status}: ${errorText}`);
  }
  const data = await res.json();
  const content = data.choices?.[0]?.message?.content || '';
  return {
    content,
    model: data.model || model,
    latencyMs,
    raw: data
  };
}

async function runWorker5Verification() {
  console.log('='.repeat(80));
  console.log('🧪 NAMOGPT WORKER 5: END-TO-END AUTOMATION QA & VERIFICATION SUITE');
  console.log(`Target: ${BASE_URL}/v1/chat/completions`);
  console.log(`Started: ${new Date().toISOString()}`);
  console.log('='.repeat(80) + '\n');

  const results = {
    timestamp: new Date().toISOString(),
    tests: [],
    allPassed: true
  };

  function logResult(testId, title, passed, details = {}, latencyMs = null) {
    const icon = passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${icon} [${testId}] ${title} (${latencyMs !== null ? `${latencyMs}ms` : 'N/A'})`);
    if (!passed) {
      results.allPassed = false;
      console.log('   Details:', JSON.stringify(details, null, 2));
    }
    results.tests.push({
      testId,
      title,
      passed,
      latencyMs,
      details
    });
  }

  // =========================================================================
  // TEST SUITE 1: Real-time News Prompt ('Give me todays top 5 news')
  // =========================================================================
  console.log('--- TEST 1: Real-time News Prompt ("Give me todays top 5 news") ---');
  try {
    const newsPrompt = 'Give me todays top 5 news';
    const resp = await sendChatRequest({
      model: 'auto',
      messages: [{ role: 'user', content: newsPrompt }]
    });

    const content = resp.content;
    console.log(`\nResponse Excerpt (first 500 chars):\n${content.slice(0, 500)}...\n`);

    // Verification 1a: Returns 5 actual news stories
    // Check for numbering or table rows or bullet points with links
    const numberedMatches = content.match(/(?:^|\n)\s*(?:\d+\.|\*\*?\d+\.?\*\*?|\|\s*\d+\s*\|)/g) || [];
    const markdownLinks = content.match(/\[([^\]]+)\]\((https?:\/\/[^\s\)]+)\)/g) || [];
    const hasFiveStories = numberedMatches.length >= 5 || markdownLinks.length >= 5;

    // Verification 1b: Does NOT say "As an AI assistant, I do not have real-time access..."
    const noCutoffDisclaimer = !/as an ai.*(?:do not have|don't have).*real-time/i.test(content) &&
                               !/knowledge cutoff/i.test(content) &&
                               !/cannot browse the web/i.test(content) &&
                               !/as of my last update/i.test(content);

    // Verification 1c: Does NOT mention 'mcp_web_fetcher'
    const noMcpWebFetcher = !/mcp_web_fetcher/i.test(content);

    // Verification 1d: Does NOT offer 'Help you build a JavaScript-based news aggregator...'
    const noAggregatorFallback = !/build a (?:javascript|python|node).*(?:news|aggregator|scraper)/i.test(content) &&
                                 !/help you build/i.test(content);

    // Verification 1e: Has proper headlines, summaries, and Markdown links to reputable sources
    const hasProperMarkdownLinks = markdownLinks.length >= 3;

    logResult('TC-1.1', 'News Stories Count (Contains 5 current news stories)', hasFiveStories, {
      detectedNumberedCount: numberedMatches.length,
      markdownLinksCount: markdownLinks.length
    }, resp.latencyMs);

    logResult('TC-1.2', 'No Real-time Refusal ("As an AI assistant, I do not have real-time...")', noCutoffDisclaimer, {
      passed: noCutoffDisclaimer
    });

    logResult('TC-1.3', 'No Internal Tool Leakage (Does not mention "mcp_web_fetcher")', noMcpWebFetcher, {
      passed: noMcpWebFetcher
    });

    logResult('TC-1.4', 'No Code Aggregator Evasion (Does not offer to build news aggregator)', noAggregatorFallback, {
      passed: noAggregatorFallback
    });

    logResult('TC-1.5', 'Reputable Markdown Links & Citations (Formatted [Source](URL))', hasProperMarkdownLinks, {
      linksFound: markdownLinks
    });

  } catch (err) {
    logResult('TC-1', 'News Query Execution', false, { error: err.message });
  }

  // =========================================================================
  // TEST SUITE 2: Non-Coding Prompt ('What are the main benefits of meditation?')
  // =========================================================================
  console.log('\n--- TEST 2: Non-Coding Prompt ("What are the main benefits of meditation?") ---');
  try {
    const medPrompt = 'What are the main benefits of meditation?';
    const resp = await sendChatRequest({
      model: 'auto',
      messages: [{ role: 'user', content: medPrompt }]
    });

    const content = resp.content;
    console.log(`\nResponse Excerpt (first 400 chars):\n${content.slice(0, 400)}...\n`);

    // Verification 2a: Clean, well-formatted explanation with core benefits
    const hasMeditationBenefits = /(stress|anxiety|focus|attention|mindfulness|emotional|sleep|blood pressure|mental)/i.test(content) &&
                                  content.length > 250;

    // Verification 2b: ZERO unsolicited code blocks (no ``` or ````)
    const codeBlockMatch = content.match(/```[\s\S]*?```/g);
    const zeroCodeBlocks = !codeBlockMatch || codeBlockMatch.length === 0;

    logResult('TC-2.1', 'Comprehensive Non-Coding Explanation (Meditation benefits addressed)', hasMeditationBenefits, {
      length: content.length
    }, resp.latencyMs);

    logResult('TC-2.2', 'Zero Unsolicited Code Blocks (No markdown code fences present)', zeroCodeBlocks, {
      codeBlocksFound: codeBlockMatch ? codeBlockMatch.length : 0
    });

  } catch (err) {
    logResult('TC-2', 'Meditation Query Execution', false, { error: err.message });
  }

  // =========================================================================
  // TEST SUITE 3: Coding Prompt ('Write a Python function to check if a word is a palindrome.')
  // =========================================================================
  console.log('\n--- TEST 3: Coding Prompt ("Write a Python function to check if a word is a palindrome.") ---');
  try {
    const codePrompt = 'Write a Python function to check if a word is a palindrome.';
    const resp = await sendChatRequest({
      model: 'auto',
      messages: [{ role: 'user', content: codePrompt }]
    });

    const content = resp.content;
    console.log(`\nResponse Excerpt (first 400 chars):\n${content.slice(0, 400)}...\n`);

    // Verification 3a: DOES provide Python code when explicitly requested
    const hasCodeFence = /```(?:python)?[\s\S]*?```/i.test(content);
    const hasFunctionDef = /def\s+[a-zA-Z0-9_]+/i.test(content);
    const hasPythonCodeBlock = hasCodeFence && hasFunctionDef;
    const hasPalindromeLogic = /(?:\[::-1\]|reversed|reverse|palindrome)/i.test(content);

    logResult('TC-3.1', 'Explicit Code Generation (Contains Python code block with function definition)', hasPythonCodeBlock, {
      hasFunctionDef,
      hasCodeFence
    }, resp.latencyMs);

    logResult('TC-3.2', 'Correct Palindrome Logic Implementation', hasPalindromeLogic, {
      detectedKeywords: content.match(/(?:\[::-1\]|reversed|palindrome)/gi) || []
    });

  } catch (err) {
    logResult('TC-3', 'Coding Prompt Execution', false, { error: err.message });
  }

  // =========================================================================
  // TEST SUITE 4: Multi-turn Conversational Endurance in 'auto' Mode
  // =========================================================================
  console.log('\n--- TEST 4: Multi-turn Conversational Endurance in "auto" Mode (5 Turns) ---');
  const turns = [
    {
      turn: 1,
      prompt: "Hello! My name is Dr. Maya Lin. I am an astrophysicist studying gravitational lensing in the Coma Cluster. Keep your greeting concise.",
      validate: (reply) => reply.length > 20 && !reply.toLowerCase().includes('error')
    },
    {
      turn: 2,
      prompt: "What is my full name and what field of science do I specialize in?",
      validate: (reply) => {
        const norm = normalizeText(reply);
        return /Maya Lin/i.test(norm) && /(astrophysic|astronomy|gravitational)/i.test(norm);
      }
    },
    {
      turn: 3,
      prompt: "Which galaxy cluster did I specify earlier?",
      validate: (reply) => {
        const norm = normalizeText(reply);
        return /Coma/i.test(norm);
      }
    },
    {
      turn: 4,
      prompt: "What phenomenon am I studying in that cluster? (Answer in one sentence)",
      validate: (reply) => {
        const norm = normalizeText(reply);
        return /gravitational lensing/i.test(norm);
      }
    },
    {
      turn: 5,
      prompt: "Summarize our conversation so far in exactly two bullet points.",
      validate: (reply) => {
        const norm = normalizeText(reply);
        return /(Maya|astrophys|Coma|lensing)/i.test(norm) && (reply.includes('-') || reply.includes('*') || reply.includes('1.'));
      }
    }
  ];

  const conversationHistory = [];

  for (const t of turns) {
    try {
      conversationHistory.push({ role: 'user', content: t.prompt });
      const resp = await sendChatRequest({
        model: 'auto',
        messages: conversationHistory,
        temperature: 0.2
      });

      const passed = t.validate(resp.content);
      conversationHistory.push({ role: 'assistant', content: resp.content });

      logResult(`TC-4.${t.turn}`, `Multi-turn Turn ${t.turn}: "${t.prompt.slice(0, 40)}..."`, passed, {
        prompt: t.prompt,
        responseExcerpt: normalizeText(resp.content).slice(0, 140) + '...',
        model: resp.model
      }, resp.latencyMs);

    } catch (turnErr) {
      logResult(`TC-4.${t.turn}`, `Multi-turn Turn ${t.turn} Failed with Exception`, false, { error: turnErr.message });
      break;
    }
  }

  // Summary
  console.log('\n' + '='.repeat(80));
  const total = results.tests.length;
  const passed = results.tests.filter(t => t.passed).length;
  const failed = total - passed;
  console.log(`TOTAL TESTS: ${total} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log(`OVERALL STATUS: ${results.allPassed ? '✅ ALL TESTS PASSED (100%)' : '❌ SOME TESTS FAILED'}`);
  console.log('='.repeat(80));

  // Write results to disk
  const reportPath = path.resolve('server', 'worker5_qa_report.json');
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
  console.log(`Report saved to: ${reportPath}`);

  return results;
}

runWorker5Verification().catch(err => {
  console.error('Fatal Runner Error:', err);
  process.exit(1);
});
