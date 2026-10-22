/**
 * NamoGPT Model Usage Meter & Telemetry Service
 *
 * Tracks tokens, generation speed, duration, and model usage per user/session.
 * Calculates real-world cost savings compared to OpenAI GPT-4o pricing.
 * Computes live quota utilization against free tiers (Groq, Gemini, OpenRouter, NVIDIA NIM).
 */

import { saveUsageRecord, getUserUsageRecords, clearUserUsage } from './db.js';

// OpenAI GPT-4o standard reference pricing (per 1,000,000 tokens)
export const GPT4O_PRICING = {
  promptCostPerMillion: 2.50,       // $2.50 / 1M prompt tokens
  completionCostPerMillion: 10.00    // $10.00 / 1M completion tokens
};

// Provider Free Tier Quota Limits
export const QUOTA_LIMITS = {
  groq: {
    name: 'Groq Free Tier',
    requestsPerDay: 14400,
    requestsPerMinute: 30
  },
  geminiFlash: {
    name: 'Google Gemini 2.5 Flash Free Tier',
    requestsPerMinute: 15,
    tokensPerMinute: 1000000
  },
  openRouterFree: {
    name: 'OpenRouter Free Tier',
    requestsPerDay: 200
  },
  nvidiaNim: {
    name: 'NVIDIA NIM Free Tier',
    totalCredits: 1000
  }
};

/**
 * Calculate cost savings compared to OpenAI GPT-4o
 *
 * @param {number} promptTokens
 * @param {number} completionTokens
 * @returns {number} Cost savings in USD
 */
export function calculateCostSavings(promptTokens = 0, completionTokens = 0) {
  const pTokens = Math.max(0, Number(promptTokens) || 0);
  const cTokens = Math.max(0, Number(completionTokens) || 0);
  const promptSavings = (pTokens / 1_000_000) * GPT4O_PRICING.promptCostPerMillion;
  const completionSavings = (cTokens / 1_000_000) * GPT4O_PRICING.completionCostPerMillion;
  const total = promptSavings + completionSavings;
  return Number(total.toFixed(6));
}

/**
 * Model categorization helpers
 */
export function isGroqModel(model) {
  const m = String(model || '').toLowerCase();
  return m.includes('groq') || m.includes('llama') || m.includes('mixtral') || m.includes('gemma');
}

export function isGeminiModel(model) {
  const m = String(model || '').toLowerCase();
  return m.includes('gemini');
}

export function isOpenRouterModel(model) {
  const m = String(model || '').toLowerCase();
  return m.includes('openrouter');
}

export function isNvidiaModel(model) {
  const m = String(model || '').toLowerCase();
  return m.includes('nvidia') || m.includes('nim') || m.includes('nemotron');
}

/**
 * Calculate provider quota utilization from records
 *
 * @param {Array} records
 * @returns {Object} Quota breakdown for Groq, Gemini Flash, OpenRouter, and NVIDIA NIM
 */
export function calculateQuotaStatus(records = []) {
  const now = Date.now();
  const oneMinuteAgo = now - 60 * 1000;
  
  // Start of current UTC day for daily quota resets
  const nowDate = new Date();
  const startOfDay = new Date(Date.UTC(nowDate.getUTCFullYear(), nowDate.getUTCMonth(), nowDate.getUTCDate())).getTime();

  let groqRequestsDay = 0;
  let groqRequestsMin = 0;

  let geminiRequestsMin = 0;
  let geminiTokensMin = 0;

  let openRouterRequestsDay = 0;
  let nvidiaCreditsUsed = 0;

  for (const r of records) {
    const rTime = r.createdAt ? new Date(r.createdAt).getTime() : now;
    const m = r.model || '';
    const tokens = Number(r.totalTokens || 0);

    // Groq calculations
    if (isGroqModel(m)) {
      if (rTime >= startOfDay) groqRequestsDay++;
      if (rTime >= oneMinuteAgo) groqRequestsMin++;
    }

    // Gemini Flash calculations
    if (isGeminiModel(m)) {
      if (rTime >= oneMinuteAgo) {
        geminiRequestsMin++;
        geminiTokensMin += tokens;
      }
    }

    // OpenRouter Free calculations
    if (isOpenRouterModel(m)) {
      if (rTime >= startOfDay) openRouterRequestsDay++;
    }

    // NVIDIA NIM calculations (1 credit per inference request)
    if (isNvidiaModel(m)) {
      nvidiaCreditsUsed++;
    }
  }

  return {
    groq: {
      provider: 'Groq',
      tier: 'Free',
      limitRequestsDay: QUOTA_LIMITS.groq.requestsPerDay,
      limitRpm: QUOTA_LIMITS.groq.requestsPerMinute,
      usedRequestsDay: groqRequestsDay,
      usedRpm: groqRequestsMin,
      remainingRequestsDay: Math.max(0, QUOTA_LIMITS.groq.requestsPerDay - groqRequestsDay),
      remainingRpm: Math.max(0, QUOTA_LIMITS.groq.requestsPerMinute - groqRequestsMin),
      percentUsedDay: Number(((groqRequestsDay / QUOTA_LIMITS.groq.requestsPerDay) * 100).toFixed(2))
    },
    geminiFlash: {
      provider: 'Google Gemini',
      model: 'Gemini 2.5 Flash',
      tier: 'Free',
      limitRpm: QUOTA_LIMITS.geminiFlash.requestsPerMinute,
      limitTpm: QUOTA_LIMITS.geminiFlash.tokensPerMinute,
      usedRpm: geminiRequestsMin,
      usedTpm: geminiTokensMin,
      remainingRpm: Math.max(0, QUOTA_LIMITS.geminiFlash.requestsPerMinute - geminiRequestsMin),
      remainingTpm: Math.max(0, QUOTA_LIMITS.geminiFlash.tokensPerMinute - geminiTokensMin),
      percentUsedRpm: Number(((geminiRequestsMin / QUOTA_LIMITS.geminiFlash.requestsPerMinute) * 100).toFixed(2)),
      percentUsedTpm: Number(((geminiTokensMin / QUOTA_LIMITS.geminiFlash.tokensPerMinute) * 100).toFixed(2))
    },
    openRouterFree: {
      provider: 'OpenRouter',
      tier: 'Free',
      limitRequestsDay: QUOTA_LIMITS.openRouterFree.requestsPerDay,
      usedRequestsDay: openRouterRequestsDay,
      remainingRequestsDay: Math.max(0, QUOTA_LIMITS.openRouterFree.requestsPerDay - openRouterRequestsDay),
      percentUsedDay: Number(((openRouterRequestsDay / QUOTA_LIMITS.openRouterFree.requestsPerDay) * 100).toFixed(2))
    },
    nvidiaNim: {
      provider: 'NVIDIA NIM',
      tier: 'Free Credits',
      totalCredits: QUOTA_LIMITS.nvidiaNim.totalCredits,
      usedCredits: nvidiaCreditsUsed,
      remainingCredits: Math.max(0, QUOTA_LIMITS.nvidiaNim.totalCredits - nvidiaCreditsUsed),
      percentUsed: Number(((nvidiaCreditsUsed / QUOTA_LIMITS.nvidiaNim.totalCredits) * 100).toFixed(2))
    }
  };
}

/**
 * Record a single telemetry / token usage event
 *
 * @param {Object} options
 * @param {string} [options.userId='anonymous'] - User ID or guest session ID
 * @param {string} [options.model='unknown'] - Model identifier
 * @param {number} [options.promptTokens=0] - Prompt tokens consumed
 * @param {number} [options.completionTokens=0] - Completion tokens consumed
 * @param {number} [options.totalTokens] - Total tokens (computed if omitted)
 * @param {number} [options.durationSec=0] - Generation duration in seconds
 * @returns {Promise<Object>} Formatted record with computed speed and cost savings
 */
export async function recordUsage({
  userId = 'anonymous',
  model = 'unknown',
  promptTokens = 0,
  completionTokens = 0,
  totalTokens = null,
  cachedTokens = 0,
  durationSec = 0
} = {}) {
  const pTokens = Math.max(0, Math.round(Number(promptTokens) || 0));
  const cTokens = Math.max(0, Math.round(Number(completionTokens) || 0));
  const cacheTokens = Math.max(0, Math.round(Number(cachedTokens) || 0));
  const tTokens = totalTokens !== null && totalTokens !== undefined
    ? Math.max(0, Math.round(Number(totalTokens)))
    : (pTokens + cTokens);
  const durSec = Math.max(0, Number(durationSec) || 0);
  const cleanModel = String(model || 'unknown').trim();
  const resolvedUserId = String(userId || 'anonymous').trim();

  const record = {
    userId: resolvedUserId,
    model: cleanModel,
    promptTokens: pTokens,
    completionTokens: cTokens,
    totalTokens: tTokens,
    cachedTokens: cacheTokens,
    durationSec: durSec,
    createdAt: new Date().toISOString()
  };

  const saved = await saveUsageRecord(record);
  const speed = durSec > 0 ? Number((cTokens / durSec).toFixed(2)) : 0;
  const costSavingsUSD = calculateCostSavings(pTokens + cacheTokens, cTokens);

  return {
    ...saved,
    speed,
    costSavingsUSD,
    cachedTokens: cacheTokens
  };
}

/**
 * Aggregate telemetry and compute usage statistics
 *
 * @param {Object} [options]
 * @param {string} [options.userId='anonymous'] - Target user ID, session ID, or 'all'
 * @returns {Promise<Object>} Statistics object with totals, savings, daily, model, and quota breakdowns
 */
export async function getUsageStats({ userId = 'anonymous' } = {}) {
  const resolvedUserId = String(userId || 'anonymous').trim();
  const records = await getUserUsageRecords(resolvedUserId);

  let totalPromptTokens = 0;
  let totalCompletionTokens = 0;
  let totalCachedTokens = 0;
  let totalTokens = 0;
  let totalDurationSec = 0;
  const totalRequests = records.length;

  const modelMap = {};
  const dailyMap = {};

  for (const r of records) {
    const pTokens = Number(r.promptTokens || 0);
    const cTokens = Number(r.completionTokens || 0);
    const cacheTokens = Number(r.cachedTokens || 0);
    const tTokens = Number(r.totalTokens || (pTokens + cTokens));
    const durSec = Number(r.durationSec || 0);
    const rDate = r.createdAt ? new Date(r.createdAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
    const mName = r.model || 'unknown';

    totalPromptTokens += pTokens;
    totalCompletionTokens += cTokens;
    totalCachedTokens += cacheTokens;
    totalTokens += tTokens;
    totalDurationSec += durSec;

    // Model breakdown
    if (!modelMap[mName]) {
      modelMap[mName] = {
        model: mName,
        totalTokens: 0,
        promptTokens: 0,
        completionTokens: 0,
        cachedTokens: 0,
        totalRequests: 0,
        totalDurationSec: 0
      };
    }
    modelMap[mName].totalTokens += tTokens;
    modelMap[mName].promptTokens += pTokens;
    modelMap[mName].completionTokens += cTokens;
    modelMap[mName].cachedTokens += cacheTokens;
    modelMap[mName].totalRequests += 1;
    modelMap[mName].totalDurationSec += durSec;

    // Daily breakdown
    if (!dailyMap[rDate]) {
      dailyMap[rDate] = {
        date: rDate,
        totalTokens: 0,
        promptTokens: 0,
        completionTokens: 0,
        cachedTokens: 0,
        requests: 0
      };
    }
    dailyMap[rDate].totalTokens += tTokens;
    dailyMap[rDate].promptTokens += pTokens;
    dailyMap[rDate].completionTokens += cTokens;
    dailyMap[rDate].cachedTokens += cacheTokens;
    dailyMap[rDate].requests += 1;
  }

  // Finalize model breakdown metrics
  const modelBreakdown = {};
  for (const [mName, mData] of Object.entries(modelMap)) {
    modelBreakdown[mName] = {
      model: mName,
      totalTokens: mData.totalTokens,
      promptTokens: mData.promptTokens,
      completionTokens: mData.completionTokens,
      cachedTokens: mData.cachedTokens,
      totalRequests: mData.totalRequests,
      costSavingsUSD: calculateCostSavings(mData.promptTokens + mData.cachedTokens, mData.completionTokens),
      averageSpeed: mData.totalDurationSec > 0 ? Number((mData.completionTokens / mData.totalDurationSec).toFixed(2)) : 0
    };
  }

  // Finalize daily stats
  const dailyStats = Object.values(dailyMap)
    .map(d => ({
      ...d,
      costSavingsUSD: calculateCostSavings(d.promptTokens + d.cachedTokens, d.completionTokens)
    }))
    .sort((a, b) => b.date.localeCompare(a.date));

  const costSavingsUSD = calculateCostSavings(totalPromptTokens + totalCachedTokens, totalCompletionTokens);
  const cacheSavingsUSD = calculateCostSavings(totalCachedTokens, 0);
  const averageSpeed = totalDurationSec > 0 ? Number((totalCompletionTokens / totalDurationSec).toFixed(2)) : 0;
  const quotaStatus = calculateQuotaStatus(records);

  return {
    totalTokens,
    promptTokens: totalPromptTokens,
    completionTokens: totalCompletionTokens,
    cachedTokens: totalCachedTokens,
    cacheSavingsUSD,
    totalRequests,
    costSavingsUSD,
    averageSpeed,
    dailyStats,
    modelBreakdown,
    quotaStatus
  };
}

/**
 * Reset usage statistics for a user or session
 *
 * @param {Object} [options]
 * @param {string} [options.userId='anonymous'] - Target user ID or session ID
 * @returns {Promise<Object>} Confirmation object
 */
export async function resetUsage({ userId = 'anonymous' } = {}) {
  const resolvedUserId = String(userId || 'anonymous').trim();
  await clearUserUsage(resolvedUserId);
  return {
    success: true,
    userId: resolvedUserId,
    message: `Usage stats for user '${resolvedUserId}' have been reset.`
  };
}

export default {
  GPT4O_PRICING,
  QUOTA_LIMITS,
  calculateCostSavings,
  calculateQuotaStatus,
  recordUsage,
  getUsageStats,
  resetUsage,
  isGroqModel,
  isGeminiModel,
  isOpenRouterModel,
  isNvidiaModel
};
