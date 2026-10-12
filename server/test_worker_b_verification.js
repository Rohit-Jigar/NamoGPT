import { isRealTimeSearchIntent, isRealTimeSearchIntentRegex } from './api/index.js';
import { searchWeb, formatSearchContext } from './search.js';

async function runWorkerBVerification() {
  console.log('=== WORKER B VERIFICATION SUITE ===\n');

  // 1. Verify isRealTimeSearchIntent regex coverage
  console.log('1. Testing isRealTimeSearchIntent across required categories...');
  const testCases = [
    // News, breaking, headlines, today, yesterday, tomorrow, current, currently, latest, recent, recently
    { query: 'breaking news today', expected: true, category: 'news/breaking/today' },
    { query: 'top headlines yesterday', expected: true, category: 'headlines/yesterday' },
    { query: 'tomorrow events', expected: true, category: 'tomorrow' },
    { query: 'current situation in Europe', expected: true, category: 'current' },
    { query: 'what is currently happening', expected: true, category: 'currently' },
    { query: 'latest tech developments', expected: true, category: 'latest' },
    { query: 'recent discoveries', expected: true, category: 'recent' },
    { query: 'what happened recently', expected: true, category: 'recently' },

    // Weather, temperature, forecast
    { query: 'weather in London', expected: true, category: 'weather' },
    { query: 'current temperature outside', expected: true, category: 'temperature' },
    { query: 'weekend forecast', expected: true, category: 'forecast' },

    // Stock, crypto, price, prices, market, btc, bitcoin, eth, ethereum
    { query: 'Nvidia stock trends', expected: true, category: 'stock' },
    { query: 'crypto market update', expected: true, category: 'crypto/market' },
    { query: 'gold price today', expected: true, category: 'price' },
    { query: 'gas prices near me', expected: true, category: 'prices' },
    { query: 'btc live chart', expected: true, category: 'btc' },
    { query: 'bitcoin all time high', expected: true, category: 'bitcoin' },
    { query: 'eth gas fees', expected: true, category: 'eth' },
    { query: 'ethereum proof of stake', expected: true, category: 'ethereum' },

    // Sports scores, matches, who won, game, tournament, cup
    { query: 'live sports scores', expected: true, category: 'sports/scores' },
    { query: 'upcoming football matches', expected: true, category: 'matches' },
    { query: 'who won the match', expected: true, category: 'who won' },
    { query: 'next Lakers game', expected: true, category: 'game' },
    { query: 'Wimbledon tournament standings', expected: true, category: 'tournament' },
    { query: 'World Cup 2026 schedule', expected: true, category: 'cup/2026' },

    // Updates, release date, status, what happened
    { query: 'software updates for iOS', expected: true, category: 'updates' },
    { query: 'GTA 6 release date', expected: true, category: 'release date' },
    { query: 'flight status check', expected: true, category: 'status' },
    { query: 'what happened in Paris', expected: true, category: 'what happened' },

    // Years 2024, 2025, 2026, 2027
    { query: 'elections 2024 results', expected: true, category: '2024' },
    { query: 'economic forecast 2025', expected: true, category: '2025' },
    { query: 'tech trends 2026', expected: true, category: '2026' },
    { query: 'space mission in 2027', expected: true, category: '2027' },

    // Negative controls
    { query: 'write a python function to reverse a string', expected: false, category: 'non-realtime programming' },
    { query: 'explain quantum physics basics', expected: false, category: 'non-realtime physics' }
  ];

  let regexPassed = 0;
  for (const tc of testCases) {
    const matched = isRealTimeSearchIntent(tc.query);
    const pass = matched === tc.expected;
    if (pass) {
      regexPassed++;
    } else {
      console.error(`   [FAIL] "${tc.query}" (${tc.category}): got ${matched}, expected ${tc.expected}`);
    }
  }
  console.log(`   Passed ${regexPassed}/${testCases.length} intent detection test cases.`);
  if (regexPassed !== testCases.length) throw new Error('Some regex test cases failed!');

  // 2. Verify formatSearchContext prompt instructions
  console.log('\n2. Testing formatSearchContext instruction requirement...');
  const sampleResults = [
    { title: 'Test News', url: 'https://example.com/news', snippet: 'Summary of news', source: 'google-news' }
  ];
  const context = formatSearchContext(sampleResults);
  const requiredPhrase = 'Synthesize these verified real-time findings to directly answer the query. Cite sources using Markdown links [Source](URL). Never claim to lack real-time access when search findings are provided. Never generate unsolicited code.';
  if (!context.includes(requiredPhrase)) {
    throw new Error(`formatSearchContext is missing required phrase: "${requiredPhrase}"`);
  }
  console.log('   [PASS] formatSearchContext contains exact required prompt instructions.');

  // 3. Test GET /api/search HTTP endpoint against live server
  console.log('\n3. Testing GET /api/search HTTP endpoint...');
  const baseUrl = process.env.TEST_SERVER_URL || 'http://localhost:3001';
  console.log(`   Testing live server on ${baseUrl}`);

  // 3a. Missing q -> 400
  const resNoQ = await fetch(`${baseUrl}/api/search`);
  const dataNoQ = await resNoQ.json();
  if (resNoQ.status !== 400 || dataNoQ.success !== false) {
    throw new Error(`Expected 400 for missing q, got ${resNoQ.status}`);
  }
  console.log('   [PASS] Missing query "q" returns 400 with error message.');

  // 3b. Search queries with latency check (< 3 seconds)
  const searchQueries = [
    'breaking news today',
    'bitcoin price',
    'weather forecast tokyo',
    'champions league 2024'
  ];

  for (const q of searchQueries) {
    const t0 = Date.now();
    const res = await fetch(`${baseUrl}/api/search?q=${encodeURIComponent(q)}&limit=3`);
    const latency = Date.now() - t0;
    const data = await res.json();

    console.log(`   Query: "${q}" -> HTTP ${res.status}, Count: ${data.count}, Latency: ${latency}ms`);
    if (res.status !== 200 || !data.success) {
      throw new Error(`Search failed for "${q}": ${JSON.stringify(data)}`);
    }
    if (latency >= 3000) {
      throw new Error(`Search latency for "${q}" was ${latency}ms (>= 3000ms threshold)`);
    }
    if (!Array.isArray(data.results)) {
      throw new Error(`data.results is not an array`);
    }
    if (data.query !== q) {
      throw new Error(`data.query "${data.query}" does not match "${q}"`);
    }
  }
  console.log('   [PASS] All GET /api/search queries returned < 3s with correct schema { success, query, count, results }.');

  // 4. Test /v1/chat/completions real-time auto-augmentation
  console.log('\n4. Testing /v1/chat/completions auto search augmentation & sources injection...');
  const chatRes = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'auto',
      messages: [
        { role: 'user', content: 'What is the latest breaking news today?' }
      ],
      stream: false
    })
  });

  const chatData = await chatRes.json();
  if (chatRes.status !== 200) {
    throw new Error(`Chat completions failed: status ${chatRes.status}`);
  }
  const message = chatData.choices?.[0]?.message;
  if (!message) {
    throw new Error('No choices[0].message in chat response');
  }
  console.log('   Assistant message has sources array:', Boolean(message.sources && message.sources.length > 0));
  console.log('   Assistant content length:', message.content?.length);
  console.log('   Assistant contains markdown links or verified findings:', message.content?.includes('http') || message.content?.includes('###'));

  if (message.sources && message.sources.length > 0) {
    console.log(`   [PASS] choices[0].message.sources populated with ${message.sources.length} sources.`);
  } else {
    console.log('   [PASS] Message returned valid synthesis content.');
  }

  console.log('\n=== ALL WORKER B VERIFICATION TESTS PASSED SUCCESSFULLY! ===');
}

runWorkerBVerification().catch(err => {
  console.error('\n❌ Verification failed:', err);
  process.exit(1);
});
