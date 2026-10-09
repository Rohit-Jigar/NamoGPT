import { searchWeb, formatSearchContext, fetchGoogleNewsRss, fetchBbcNewsRss, decodeHtmlEntities, stripCdataAndDecode } from './search.js';

async function runTests() {
  console.log('=== TEST SUITE: Live Search & News Intelligence Production Verification ===\n');

  // Test 1: isNewsQuery Regex Validation
  console.log('1. Testing isNewsQuery regex across query variations...');
  const newsRegex = /(\b(top|latest|breaking|daily|current|world|national|local)? ?\d* ?news\b|\bheadlines?\b|\bwhat happened today\b|\btodays news\b|\btoday's news\b)/i;
  const testQueries = [
    'Give me todays top 5 news',
    'today\'s news',
    'todays news',
    'what happened today',
    'top news',
    'latest news',
    'breaking news',
    'daily news',
    'current news',
    'world news',
    'national news',
    'local news',
    'headlines',
    'headline',
    'top 10 news'
  ];

  let allRegexPassed = true;
  for (const q of testQueries) {
    const matched = newsRegex.test(q);
    console.log(`   [${matched ? 'PASS' : 'FAIL'}] "${q}"`);
    if (!matched) allRegexPassed = false;
  }
  if (!allRegexPassed) throw new Error('Regex validation failed for some query variations');

  // Test 2: 'Give me todays top 5 news' via searchWeb
  console.log('\n2. Testing searchWeb("Give me todays top 5 news")...');
  const results = await searchWeb('Give me todays top 5 news', 5);
  console.log(`   Received ${results.length} items (expected at least 5):`);
  if (results.length < 5) {
    throw new Error(`Expected at least 5 items, got ${results.length}`);
  }

  results.forEach((item, idx) => {
    console.log(`\n   --- Item ${idx + 1} ---`);
    console.log(`   Title:   ${item.title}`);
    console.log(`   URL:     ${item.url}`);
    console.log(`   Snippet: ${item.snippet}`);
    console.log(`   Source:  ${item.source}`);

    // Assertions
    if (!item.title || item.title.includes('<![CDATA[') || item.title.includes(']]>')) {
      throw new Error(`Item ${idx + 1} has invalid title or unstripped CDATA: "${item.title}"`);
    }
    if (!item.url || !item.url.startsWith('http')) {
      throw new Error(`Item ${idx + 1} has invalid URL: "${item.url}"`);
    }
    if (!item.snippet) {
      throw new Error(`Item ${idx + 1} missing snippet`);
    }
  });

  // Test 3: formatSearchContext output and instructions
  console.log('\n3. Testing formatSearchContext generation...');
  const formatted = formatSearchContext(results);
  const requiredInstruction = 'Present the requested news stories directly with headlines, summaries, and Markdown citation links. DO NOT include disclaimers about cutoffs.';
  if (!formatted.includes(requiredInstruction)) {
    throw new Error('formatSearchContext is missing the required instruction phrasing');
  }
  console.log('   [PASS] formatSearchContext contains required instruction without disclaimers.');
  console.log('\n   Snippet of formatted context:');
  console.log(formatted.slice(0, 450) + '\n   ...\n' + formatted.slice(-260));

  // Test 4: Direct BBC World News RSS provider
  console.log('\n4. Testing direct fetchBbcNewsRss fallback provider...');
  const bbcResults = await fetchBbcNewsRss('Give me todays top 5 news', 5);
  console.log(`   BBC provider returned ${bbcResults.length} items.`);
  if (bbcResults.length < 5) {
    throw new Error(`BBC provider expected at least 5 items, got ${bbcResults.length}`);
  }
  console.log(`   [PASS] BBC item 1: "${bbcResults[0].title}" (${bbcResults[0].url})`);

  console.log('\n=== ALL TESTS PASSED SUCCESSFULLY! ===');
}

runTests().catch(err => {
  console.error('\n❌ Test execution failed:', err);
  process.exit(1);
});
