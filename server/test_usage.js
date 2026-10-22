/**
 * Model Usage Meter & Telemetry Verification Test Suite
 * Tests unit functions in usage.js & db.js and live Express API endpoints.
 */

import assert from 'assert';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import {
  recordUsage,
  getUsageStats,
  resetUsage,
  calculateCostSavings,
  calculateQuotaStatus,
  GPT4O_PRICING,
  QUOTA_LIMITS,
  isGroqModel,
  isGeminiModel,
  isOpenRouterModel,
  isNvidiaModel
} from './usage.js';
import { saveUsageRecord, getUserUsageRecords, clearUserUsage } from './db.js';
import { app } from './server.js';

const TEST_PORT = 3198;
const BASE_URL = `http://localhost:${TEST_PORT}`;

async function runTestSuite() {
  console.log('====================================================');
  console.log('🧪 Starting NamoGPT Model Usage Meter Verification');
  console.log('====================================================\n');

  let serverInstance = null;

  try {
    // ----------------------------------------------------
    // TEST 1: Pricing & Cost Savings Calculation
    // ----------------------------------------------------
    console.log('[TEST 1] Verifying Cost Savings Formula vs OpenAI GPT-4o Pricing...');
    assert.strictEqual(GPT4O_PRICING.promptCostPerMillion, 2.50, 'GPT-4o prompt cost should be $2.50 / 1M');
    assert.strictEqual(GPT4O_PRICING.completionCostPerMillion, 10.00, 'GPT-4o completion cost should be $10.00 / 1M');

    // 1M prompt tokens => $2.50
    const savings1M = calculateCostSavings(1000000, 0);
    assert.strictEqual(savings1M, 2.5, '1M prompt tokens should yield $2.50 savings');

    // 1M completion tokens => $10.00
    const savings1MComp = calculateCostSavings(0, 1000000);
    assert.strictEqual(savings1MComp, 10, '1M completion tokens should yield $10.00 savings');

    // 10,000 prompt tokens + 2,000 completion tokens:
    // (10,000 * 2.50 / 1M) = $0.025
    // (2,000 * 10.00 / 1M) = $0.020
    // Total = $0.045
    const savingsMixed = calculateCostSavings(10000, 2000);
    assert.strictEqual(savingsMixed, 0.045, '10k prompt + 2k completion should yield $0.045 savings');

    console.log('  ✅ Cost savings calculation matches GPT-4o reference pricing perfectly.\n');

    // ----------------------------------------------------
    // TEST 2: Provider Quota Calculation Logic
    // ----------------------------------------------------
    console.log('[TEST 2] Verifying Provider Quota Calculations...');
    assert.strictEqual(QUOTA_LIMITS.groq.requestsPerDay, 14400);
    assert.strictEqual(QUOTA_LIMITS.groq.requestsPerMinute, 30);
    assert.strictEqual(QUOTA_LIMITS.geminiFlash.requestsPerMinute, 15);
    assert.strictEqual(QUOTA_LIMITS.geminiFlash.tokensPerMinute, 1000000);
    assert.strictEqual(QUOTA_LIMITS.openRouterFree.requestsPerDay, 200);
    assert.strictEqual(QUOTA_LIMITS.nvidiaNim.totalCredits, 1000);

    const mockRecords = [
      { model: 'groq/llama-3.3-70b-versatile', totalTokens: 500, createdAt: new Date().toISOString() },
      { model: 'groq/llama-3.3-70b-versatile', totalTokens: 300, createdAt: new Date().toISOString() },
      { model: 'gemini/gemini-2.5-flash', totalTokens: 2500, createdAt: new Date().toISOString() },
      { model: 'openrouter/free', totalTokens: 100, createdAt: new Date().toISOString() },
      { model: 'nvidia/nemotron-super-70b', totalTokens: 400, createdAt: new Date().toISOString() }
    ];

    const quota = calculateQuotaStatus(mockRecords);
    assert.strictEqual(quota.groq.usedRequestsDay, 2);
    assert.strictEqual(quota.groq.remainingRequestsDay, 14398);
    assert.strictEqual(quota.geminiFlash.usedRpm, 1);
    assert.strictEqual(quota.geminiFlash.usedTpm, 2500);
    assert.strictEqual(quota.openRouterFree.usedRequestsDay, 1);
    assert.strictEqual(quota.openRouterFree.remainingRequestsDay, 199);
    assert.strictEqual(quota.nvidiaNim.usedCredits, 1);
    assert.strictEqual(quota.nvidiaNim.remainingCredits, 999);

    console.log('  ✅ Quota calculation verified across Groq, Gemini, OpenRouter, and NVIDIA NIM.\n');

    // ----------------------------------------------------
    // TEST 3: Database & Local JSON Fallback Persistence
    // ----------------------------------------------------
    console.log('[TEST 3] Testing Database Persistence & Local Storage Fallback...');
    const testUserId = `test-user-${Date.now()}`;

    // Clean any prior state for test user
    await clearUserUsage(testUserId);

    const savedRecord = await saveUsageRecord({
      userId: testUserId,
      model: 'groq',
      promptTokens: 150,
      completionTokens: 350,
      totalTokens: 500,
      durationSec: 1.25
    });

    assert(savedRecord.id, 'Saved record must have an ID');
    assert.strictEqual(savedRecord.userId, testUserId);
    assert.strictEqual(savedRecord.model, 'groq');
    assert.strictEqual(savedRecord.promptTokens, 150);
    assert.strictEqual(savedRecord.completionTokens, 350);
    assert.strictEqual(savedRecord.totalTokens, 500);
    assert.strictEqual(savedRecord.durationSec, 1.25);

    const userRecords = await getUserUsageRecords(testUserId);
    assert(userRecords.length >= 1, 'Should find at least 1 record for test user');
    assert.strictEqual(userRecords[0].userId, testUserId);

    console.log('  ✅ saveUsageRecord and getUserUsageRecords successfully verified.\n');

    // ----------------------------------------------------
    // TEST 4: recordUsage, getUsageStats, and resetUsage
    // ----------------------------------------------------
    console.log('[TEST 4] Testing Core Telemetry Functions (recordUsage, getUsageStats, resetUsage)...');
    const unitUserId = `test-unit-${Date.now()}`;

    // 1. Record first usage
    const rec1 = await recordUsage({
      userId: unitUserId,
      model: 'groq/llama-3.3-70b',
      promptTokens: 200,
      completionTokens: 800,
      durationSec: 2.0
    });

    assert.strictEqual(rec1.speed, 400, 'Speed should be 800 tokens / 2 sec = 400 tokens/sec');
    assert.strictEqual(rec1.totalTokens, 1000);
    // Cost savings: (200 * 2.50 / 1M) + (800 * 10.00 / 1M) = 0.0005 + 0.008 = 0.0085
    assert.strictEqual(rec1.costSavingsUSD, 0.0085);

    // 2. Record second usage for different model
    await recordUsage({
      userId: unitUserId,
      model: 'gemini/gemini-2.5-flash',
      promptTokens: 500,
      completionTokens: 1500,
      durationSec: 1.0
    });

    // 3. Aggregate stats
    const stats = await getUsageStats({ userId: unitUserId });
    assert.strictEqual(stats.totalRequests, 2);
    assert.strictEqual(stats.promptTokens, 700);
    assert.strictEqual(stats.completionTokens, 2300);
    assert.strictEqual(stats.totalTokens, 3000);
    assert(stats.costSavingsUSD > 0, 'Cost savings should be positive');
    assert(stats.averageSpeed > 0, 'Average speed should be positive');
    assert(stats.modelBreakdown['groq/llama-3.3-70b'], 'Model breakdown must include groq');
    assert(stats.modelBreakdown['gemini/gemini-2.5-flash'], 'Model breakdown must include gemini');
    assert(Array.isArray(stats.dailyStats), 'dailyStats must be an array');
    assert(stats.quotaStatus.groq, 'quotaStatus must contain groq metrics');

    // 4. Reset stats
    const resetResult = await resetUsage({ userId: unitUserId });
    assert.strictEqual(resetResult.success, true);

    const postResetStats = await getUsageStats({ userId: unitUserId });
    assert.strictEqual(postResetStats.totalRequests, 0, 'Total requests must be 0 after reset');
    assert.strictEqual(postResetStats.totalTokens, 0, 'Total tokens must be 0 after reset');

    console.log('  ✅ recordUsage, getUsageStats, and resetUsage passed with 100% precision.\n');

    // ----------------------------------------------------
    // TEST 5: Anonymous and Session Fallback
    // ----------------------------------------------------
    console.log('[TEST 5] Testing Session & Anonymous Fallback Behavior...');
    const anonRecord = await recordUsage({
      model: 'groq-instant',
      promptTokens: 50,
      completionTokens: 100,
      durationSec: 0.5
    });
    assert.strictEqual(anonRecord.userId, 'anonymous');

    const anonStats = await getUsageStats();
    assert(anonStats.totalRequests >= 1);
    assert(anonStats.totalTokens >= 150);
    console.log('  ✅ Anonymous fallback confirmed.\n');

    // ----------------------------------------------------
    // TEST 6: Live HTTP API Endpoints
    // ----------------------------------------------------
    console.log('[TEST 6] Starting test server on port ' + TEST_PORT + ' and validating API routes...');
    serverInstance = app.listen(TEST_PORT);

    // Give server a short tick to bind
    await new Promise(r => setTimeout(r, 200));

    // A. POST /api/usage/record
    console.log('  Testing POST /api/usage/record...');
    const apiUserId = `api-user-${Date.now()}`;
    const recordRes = await axios.post(`${BASE_URL}/api/usage/record`, {
      userId: apiUserId,
      model: 'groq/llama-3.3-70b-versatile',
      promptTokens: 120,
      completionTokens: 480,
      durationSec: 1.5
    });

    assert.strictEqual(recordRes.status, 200);
    assert.strictEqual(recordRes.data.success, true);
    assert.strictEqual(recordRes.data.record.totalTokens, 600);
    assert.strictEqual(recordRes.data.record.speed, 320); // 480 / 1.5 = 320
    console.log('    ✅ POST /api/usage/record passed.');

    // B. GET /api/usage/stats
    console.log('  Testing GET /api/usage/stats...');
    const statsRes = await axios.get(`${BASE_URL}/api/usage/stats?userId=${apiUserId}`);
    assert.strictEqual(statsRes.status, 200);
    assert.strictEqual(statsRes.data.success, true);
    assert.strictEqual(statsRes.data.totalRequests, 1);
    assert.strictEqual(statsRes.data.totalTokens, 600);
    assert.strictEqual(statsRes.data.promptTokens, 120);
    assert.strictEqual(statsRes.data.completionTokens, 480);
    assert(statsRes.data.costSavingsUSD > 0);
    assert(statsRes.data.quotaStatus);
    assert(statsRes.data.quotaStatus.groq);
    assert(statsRes.data.quotaStatus.geminiFlash);
    assert(statsRes.data.modelBreakdown);
    assert(Array.isArray(statsRes.data.dailyStats));
    console.log('    ✅ GET /api/usage/stats passed.');

    // C. POST /api/usage/reset
    console.log('  Testing POST /api/usage/reset...');
    const resetRes = await axios.post(`${BASE_URL}/api/usage/reset`, {
      userId: apiUserId
    });
    assert.strictEqual(resetRes.status, 200);
    assert.strictEqual(resetRes.data.success, true);

    const afterResetRes = await axios.get(`${BASE_URL}/api/usage/stats?userId=${apiUserId}`);
    assert.strictEqual(afterResetRes.data.totalRequests, 0);
    assert.strictEqual(afterResetRes.data.totalTokens, 0);
    console.log('    ✅ POST /api/usage/reset passed.');

    // D. End-to-End Chat Completion Telemetry Verification
    console.log('  Testing Chat Completion Telemetry Integration via /v1/chat/completions...');
    const chatUserId = `chat-telemetry-user-${Date.now()}`;
    const chatRes = await axios.post(`${BASE_URL}/v1/chat/completions`, {
      model: 'auto',
      messages: [{ role: 'user', content: 'Testing model telemetry tracker.' }]
    }, {
      headers: {
        'x-session-id': chatUserId
      }
    });

    assert.strictEqual(chatRes.status, 200);
    assert(chatRes.data.choices && chatRes.data.choices.length > 0);

    // Verify usage was automatically recorded for this session ID
    const chatUsageStats = await getUsageStats({ userId: chatUserId });
    assert(chatUsageStats.totalRequests >= 1, 'Chat request should be recorded in telemetry');
    assert(chatUsageStats.totalTokens > 0, 'Tokens must be recorded');
    console.log(`    ✅ Chat completion telemetry auto-recorded: ${chatUsageStats.totalTokens} tokens processed.`);

    console.log('\n====================================================');
    console.log('🎉 ALL USAGE METER & TELEMETRY TESTS PASSED 100%!');
    console.log('====================================================');
  } finally {
    if (serverInstance) {
      serverInstance.close();
    }
  }
}

runTestSuite().catch(err => {
  console.error('\n❌ TEST SUITE FAILED:', err);
  process.exit(1);
});
