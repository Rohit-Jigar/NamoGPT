import client from 'prom-client';

/**
 * Prometheus Registry for NamoGPT metrics
 */
export const register = new client.Registry();
export const registry = register;

// Configure default Node.js / process metrics with 'namogpt_' prefix
client.collectDefaultMetrics({
  prefix: 'namogpt_',
  register
});

/**
 * Counter: Total HTTP requests processed by NamoGPT
 * Labels: method, route, status_code, model
 */
export const httpRequestsTotal = new client.Counter({
  name: 'namogpt_http_requests_total',
  help: 'Total number of HTTP requests processed by NamoGPT',
  labelNames: ['method', 'route', 'status_code', 'model'],
  registers: [register]
});

/**
 * Histogram: HTTP request duration in seconds
 * Buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60]
 * Labels: model, route
 */
export const httpRequestDuration = new client.Histogram({
  name: 'namogpt_http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['model', 'route'],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60],
  registers: [register]
});

/**
 * Counter: Total AI tokens consumed
 * Labels: model, type ('prompt' | 'completion' | 'total')
 */
export const tokensTotal = new client.Counter({
  name: 'namogpt_tokens_total',
  help: 'Total number of tokens processed (prompt, completion, total)',
  labelNames: ['model', 'type'],
  registers: [register]
});

/**
 * Counter: Total provider failovers
 * Labels: model, from_idx, to_idx, reason
 */
export const failoversTotal = new client.Counter({
  name: 'namogpt_failovers_total',
  help: 'Total number of provider failover events',
  labelNames: ['model', 'from_idx', 'to_idx', 'reason'],
  registers: [register]
});

/**
 * Gauge: Currently active HTTP connections
 */
export const activeConnections = new client.Gauge({
  name: 'namogpt_active_connections',
  help: 'Current number of active connections to NamoGPT',
  registers: [register]
});

/**
 * Record the start of a request. Increments active connections gauge
 * and captures high-resolution start time and request metadata.
 *
 * @param {import('express').Request} [req]
 * @returns {{ startTime: [number, number], timestamp: number, method: string, route: string, req?: any }}
 */
export function recordRequestStart(req) {
  activeConnections.inc();
  const startTime = process.hrtime();
  const method = req?.method || 'POST';
  const route = req?.baseUrl || req?.route?.path || req?.path || req?.originalUrl || req?.url || 'unknown';
  return {
    startTime,
    timestamp: Date.now(),
    method,
    route,
    req
  };
}

/**
 * Record the completion of an HTTP request. Decrements active connections,
 * observes duration in histogram, and increments requests counter.
 *
 * @param {any} startTime - Object returned by recordRequestStart, hrtime array, or epoch ms
 * @param {string} [model='unknown'] - Model identifier
 * @param {number|string} [statusCode=200] - HTTP status code
 * @param {string} [route='unknown'] - API route path
 */
export function recordRequestEnd(startTime, model = 'unknown', statusCode = 200, route = 'unknown') {
  activeConnections.dec();

  let durationInSeconds = 0;
  let reqMethod = 'POST';
  let reqRoute = route || 'unknown';

  if (startTime) {
    if (typeof startTime === 'object' && startTime.startTime && Array.isArray(startTime.startTime)) {
      const diff = process.hrtime(startTime.startTime);
      durationInSeconds = diff[0] + diff[1] / 1e9;
      if (startTime.method) reqMethod = startTime.method;
      if ((!route || route === 'unknown') && startTime.route) reqRoute = startTime.route;
    } else if (Array.isArray(startTime)) {
      const diff = process.hrtime(startTime);
      durationInSeconds = diff[0] + diff[1] / 1e9;
    } else if (typeof startTime === 'bigint') {
      durationInSeconds = Number(process.hrtime.bigint() - startTime) / 1e9;
    } else if (typeof startTime === 'number') {
      durationInSeconds = Math.max(0, (Date.now() - startTime) / 1000);
    }
  }

  const modelLabel = String(model || 'unknown');
  const routeLabel = String(reqRoute || 'unknown');
  const methodLabel = String(reqMethod || 'POST');
  const statusLabel = String(statusCode || 200);

  httpRequestDuration.observe({ model: modelLabel, route: routeLabel }, durationInSeconds);
  httpRequestsTotal.inc({ method: methodLabel, route: routeLabel, status_code: statusLabel, model: modelLabel });
}

/**
 * Record prompt, completion, and total tokens for a model call.
 *
 * @param {string} [model='unknown'] - Model identifier
 * @param {number} [promptTokens=0] - Number of prompt tokens
 * @param {number} [completionTokens=0] - Number of completion tokens
 */
export function recordTokens(model = 'unknown', promptTokens = 0, completionTokens = 0) {
  const modelLabel = String(model || 'unknown');
  const pTokens = Math.max(0, Number(promptTokens) || 0);
  const cTokens = Math.max(0, Number(completionTokens) || 0);
  const totalTokens = pTokens + cTokens;

  if (pTokens > 0) {
    tokensTotal.inc({ model: modelLabel, type: 'prompt' }, pTokens);
  }
  if (cTokens > 0) {
    tokensTotal.inc({ model: modelLabel, type: 'completion' }, cTokens);
  }
  if (totalTokens > 0) {
    tokensTotal.inc({ model: modelLabel, type: 'total' }, totalTokens);
  }
}

/**
 * Record a provider failover occurrence.
 *
 * @param {string} [model='unknown'] - Model identifier
 * @param {string|number} [fromIdx='unknown'] - Failed index or provider
 * @param {string|number} [toIdx='unknown'] - Fallback index or provider
 * @param {string} [reason='unknown'] - Reason for failover
 */
export function recordFailover(model = 'unknown', fromIdx = 'unknown', toIdx = 'unknown', reason = 'unknown') {
  failoversTotal.inc({
    model: String(model || 'unknown'),
    from_idx: String(fromIdx !== undefined && fromIdx !== null ? fromIdx : 'unknown'),
    to_idx: String(toIdx !== undefined && toIdx !== null ? toIdx : 'unknown'),
    reason: String(reason || 'unknown')
  });
}

/**
 * Returns Prometheus formatted metrics with Content-Type header.
 * Can be used as a standalone helper or directly as an Express request handler.
 *
 * @param {import('express').Request} [req]
 * @param {import('express').Response} [res]
 * @returns {Promise<{ metrics: string, contentType: string, headers: { 'Content-Type': string }, toString: () => string }>}
 */
export async function getMetrics(req, res) {
  const metrics = await register.metrics();
  const contentType = register.contentType;

  // Support Express middleware usage: app.get('/metrics', getMetrics)
  if (res && typeof res.set === 'function') {
    res.set('Content-Type', contentType);
    return res.end(metrics);
  }
  if (req && typeof req.set === 'function') {
    req.set('Content-Type', contentType);
    return req.end(metrics);
  }

  return {
    metrics,
    contentType,
    headers: {
      'Content-Type': contentType
    },
    toString() {
      return metrics;
    },
    [Symbol.toPrimitive]() {
      return metrics;
    }
  };
}

getMetrics.contentType = register.contentType;

export const contentType = register.contentType;

export default {
  register,
  registry: register,
  httpRequestsTotal,
  httpRequestDuration,
  tokensTotal,
  failoversTotal,
  activeConnections,
  recordRequestStart,
  recordRequestEnd,
  recordTokens,
  recordFailover,
  getMetrics,
  contentType
};
