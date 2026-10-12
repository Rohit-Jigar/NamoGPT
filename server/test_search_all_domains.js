import {
  searchWeb,
  formatSearchContext,
  detectCryptoQuery,
  fetchLiveCryptoPrice,
  detectWeatherQuery,
  fetchLiveWeather,
  fetchGoogleNewsTopicRss,
  fetchBingNewsRss,
  fetchGoogleNewsRss,
  fetchBbcNewsRss,
  decodeHtmlEntities,
  stripCdataAndDecode
} from './search.js';

async function runTestSuite() {
  console.log('======================================================================');
  console.log('🧪 NamoGPT Real-Time Multi-Source Engine Architect Verification Suite');
  console.log('======================================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition, message) {
    totalTests++;
    if (!condition) {
      console.error(`❌ [FAIL] ${message}`);
      throw new Error(message);
    }
    passedTests++;
    console.log(`✅ [PASS] ${message}`);
  }

  // --- PART 1: SPECIALIZED DETECTOR & DIRECT PROVIDER UNIT TESTS ---
  console.log('--- PART 1: Specialized Real-Time Detectors & Direct Providers ---');

  // Test 1.1: Crypto Query Detector
  const cryptoDetection = detectCryptoQuery('what is the current price of bitcoin');
  assert(
    cryptoDetection && cryptoDetection.isCrypto && cryptoDetection.symbol === 'BTC',
    `Crypto Detector identified Bitcoin query (symbol: ${cryptoDetection?.symbol})`
  );

  const ethDetection = detectCryptoQuery('how much is ethereum worth');
  assert(
    ethDetection && ethDetection.isCrypto && ethDetection.symbol === 'ETH',
    `Crypto Detector identified Ethereum query (symbol: ${ethDetection?.symbol})`
  );

  // Test 1.2: Direct Binance Crypto Provider
  console.log('Testing direct Binance Crypto Provider API...');
  const cryptoItem = await fetchLiveCryptoPrice('BTC', 'Bitcoin');
  assert(
    cryptoItem && cryptoItem.title && cryptoItem.url.startsWith('https://') && cryptoItem.snippet.includes('USDT'),
    `Binance Ticker Provider returned live BTC price: "${cryptoItem?.title}"`
  );
  console.log(`   Sample Crypto Snippet: ${cryptoItem?.snippet}\n`);

  // Test 1.3: Weather Query Detector
  const weatherDetection = detectWeatherQuery('weather in new york');
  assert(
    weatherDetection && weatherDetection.isWeather && /new york/i.test(weatherDetection.city),
    `Weather Detector identified location (city: "${weatherDetection?.city}")`
  );

  // Test 1.4: Direct Open-Meteo Weather Provider
  console.log('Testing direct Open-Meteo Weather Provider API...');
  const weatherItem = await fetchLiveWeather('new york');
  assert(
    weatherItem && weatherItem.title && weatherItem.url.startsWith('https://') && weatherItem.snippet.includes('°C'),
    `Open-Meteo Weather Provider returned live weather: "${weatherItem?.title}"`
  );
  console.log(`   Sample Weather Snippet: ${weatherItem?.snippet}\n`);

  // Test 1.5: Direct Google News Topic RSS Provider
  console.log('Testing direct Google News Topic RSS Provider...');
  const topicItems = await fetchGoogleNewsTopicRss('spaceX starship', 3);
  assert(
    topicItems && topicItems.length >= 1 && topicItems[0].title && topicItems[0].url.startsWith('http'),
    `Google News Topic RSS returned ${topicItems?.length} live articles for "spaceX starship"`
  );

  // Test 1.6: Direct Bing News RSS Provider
  console.log('Testing direct Bing News RSS Fallback Provider...');
  const bingItems = await fetchBingNewsRss('spaceX starship', 2);
  assert(
    bingItems && bingItems.length >= 1 && bingItems[0].title && bingItems[0].url.startsWith('http'),
    `Bing News RSS returned ${bingItems?.length} fallback articles for "spaceX starship"`
  );
  console.log('');

  // --- PART 2: UNIFIED SEARCH WATERFALL DOMAIN VERIFICATION (ALL 6 DOMAINS) ---
  console.log('--- PART 2: Unified Search Waterfall across All 6 Required Domains ---');

  const testQueries = [
    { query: 'what is the current price of bitcoin', domain: 'Live Crypto Price' },
    { query: 'weather in new york', domain: 'Live Global Weather' },
    { query: 'who won the cricket match yesterday', domain: 'Live Sports' },
    { query: 'latest update on spaceX starship', domain: 'Aerospace & Science' },
    { query: 'who won the super bowl in 2024', domain: 'Historical Sports Event' },
    { query: 'who is the prime minister of UK', domain: 'Current Affairs & Politics' }
  ];

  for (const { query, domain } of testQueries) {
    console.log(`\n🔍 Testing Domain: [${domain}] -> Query: "${query}"`);
    const startTime = Date.now();
    const results = await searchWeb(query, 3);
    const duration = Date.now() - startTime;

    assert(Array.isArray(results) && results.length >= 1, `Query "${query}" returned >= 1 result (received ${results.length} items in ${duration}ms)`);

    results.forEach((item, index) => {
      assert(
        typeof item.title === 'string' && item.title.trim().length > 0,
        `Result [${index + 1}] has non-empty title: "${item.title.slice(0, 50)}..."`
      );
      assert(
        !item.title.includes('<![CDATA[') && !item.title.includes(']]>'),
        `Result [${index + 1}] has stripped CDATA in title`
      );
      assert(
        typeof item.url === 'string' && item.url.startsWith('http'),
        `Result [${index + 1}] has valid HTTP/HTTPS URL: "${item.url.slice(0, 60)}..."`
      );
      assert(
        typeof item.snippet === 'string' && item.snippet.trim().length > 0,
        `Result [${index + 1}] has non-empty snippet (${item.snippet.length} chars)`
      );
    });

    console.log(`   Sample Item 1:`);
    console.log(`     Title:   ${results[0].title}`);
    console.log(`     URL:     ${results[0].url}`);
    console.log(`     Snippet: ${results[0].snippet.slice(0, 100)}...`);
    console.log(`     Source:  ${results[0].source}`);
  }

  // --- PART 3: FORMAT SEARCH CONTEXT VERIFICATION ---
  console.log('\n--- PART 3: formatSearchContext Synthesis Verification ---');
  const sampleResults = await searchWeb('what is the current price of bitcoin', 2);
  const formattedContext = formatSearchContext(sampleResults);
  assert(
    formattedContext.includes('=== REAL-TIME WEB SEARCH RESULTS ===') &&
    formattedContext.includes('Instructions:') &&
    formattedContext.includes('DO NOT include disclaimers about cutoffs.'),
    'formatSearchContext includes required structured header and instructions'
  );

  console.log('\n======================================================================');
  console.log(`🎉 ALL ${passedTests} OF ${totalTests} TESTS PASSED SUCCESSFULLY (100% PASS)!`);
  console.log('======================================================================');
}

runTestSuite().catch(err => {
  console.error('\n❌ Test suite failed with error:', err);
  process.exit(1);
});
