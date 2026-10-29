import http from 'http';
import express from 'express';

// Setup mock upstream server
const receivedUpstreamRequests = [];
let mockUpstreamConfig = {
  status: 200,
  delayMs: 10,
  body: {
    id: 'chatcmpl-mock-123',
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model: 'mock-model',
    choices: [{ index: 0, message: { role: 'assistant', content: 'Mock response' }, finish_reason: 'stop' }],
    usage: { prompt_tokens: 15, completion_tokens: 25, total_tokens: 40 }
  },
  streamChunks: [
    'data: {"id":"chatcmpl-stream-1","choices":[{"delta":{"content":"Hello"}}]}\n\n',
    'data: {"id":"chatcmpl-stream-1","choices":[{"delta":{"content":" world!"}}]}\n\n',
    'data: [DONE]\n\n'
  ]
};

const mockUpstreamServer = http.createServer((req, res) => {
  let reqBody = '';
  req.on('data', chunk => { reqBody += chunk.toString(); });
  req.on('end', () => {
    let parsedBody = null;
    try { parsedBody = JSON.parse(reqBody); } catch (_) {}
    
    const record = {
      method: req.method,
      url: req.url,
      headers: req.headers,
      authorization: req.headers['authorization'],
      body: parsedBody || reqBody,
      timestamp: Date.now()
    };
    receivedUpstreamRequests.push(record);

    setTimeout(() => {
      if (mockUpstreamConfig.isStream && parsedBody?.stream) {
        res.writeHead(mockUpstreamConfig.status || 200, {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive'
        });
        
        let chunkIndex = 0;
        const interval = setInterval(() => {
          if (chunkIndex < mockUpstreamConfig.streamChunks.length) {
            res.write(mockUpstreamConfig.streamChunks[chunkIndex]);
            chunkIndex++;
          } else {
            clearInterval(interval);
            res.end();
          }
        }, 30);

        res.on('close', () => {
          clearInterval(interval);
          record.aborted = true;
        });
        req.on('close', () => {
          clearInterval(interval);
          record.aborted = true;
        });
      } else {
        const status = mockUpstreamConfig.statusHandler 
          ? mockUpstreamConfig.statusHandler(record)
          : mockUpstreamConfig.status;
        const body = mockUpstreamConfig.bodyHandler
          ? mockUpstreamConfig.bodyHandler(record)
          : mockUpstreamConfig.body;
        
        res.writeHead(status, { 'Content-Type': 'application/json' });
        res.end(typeof body === 'string' ? body : JSON.stringify(body));
      }
    }, mockUpstreamConfig.delayMs);
  });
});

await new Promise(resolve => mockUpstreamServer.listen(29999, '127.0.0.1', resolve));
console.log('Mock upstream server listening on http://127.0.0.1:29999');

// Now import the NamoGPT server modules
process.env.TEST_MODE = 'true';
process.env.PROXY_PORT = '29998';
// Override provider keys to point to our mock upstream server
process.env.GROQ_API_KEY_1 = 'gsk_mock_groq_key_1';
process.env.GROQ_API_KEY_2 = 'gsk_mock_groq_key_2';
process.env.GEMINI_API_KEY_1 = 'gemini_mock_key_1';
process.env.GEMINI_API_KEY_2 = 'gemini_mock_key_2';

// Create a custom config for testing
process.env.LITELLM_CONFIG_JSON = JSON.stringify({
  model_list: [
    {
      model_name: 'groq',
      litellm_params: {
        model: 'groq/openai/gpt-oss-120b',
        api_base: 'http://127.0.0.1:29999',
        api_key: 'os.environ/GROQ_API_KEY_1',
        rpm: 30
      }
    },
    {
      model_name: 'groq',
      litellm_params: {
        model: 'groq/openai/gpt-oss-120b',
        api_base: 'http://127.0.0.1:29999',
        api_key: 'os.environ/GROQ_API_KEY_2',
        rpm: 30
      }
    },
    {
      model_name: 'gemini',
      litellm_params: {
        model: 'gemini/gemini-2.5-flash',
        api_base: 'http://127.0.0.1:29999',
        api_key: 'os.environ/GEMINI_API_KEY_1',
        rpm: 30
      }
    },
    {
      model_name: 'gemini',
      litellm_params: {
        model: 'gemini/gemini-2.5-flash',
        api_base: 'http://127.0.0.1:29999',
        api_key: 'os.environ/GEMINI_API_KEY_2',
        rpm: 30
      }
    }
  ]
});

// Import server app
const { default: app } = await import('./server.js');
const server = http.createServer(app);
await new Promise(resolve => server.listen(29998, '127.0.0.1', resolve));
console.log('NamoGPT test server listening on http://127.0.0.1:29998');

const auditResults = {
  healthProbeStorm: {},
  upstreamErrors: {},
  streamingSSE: {},
  parameterNormalization: {}
};

async function testFetch(path, options = {}) {
  const url = `http://127.0.0.1:29998${path}`;
  const resp = await fetch(url, options);
  const text = await resp.text();
  let json = null;
  try { json = JSON.parse(text); } catch (_) {}
  return {
    status: resp.status,
    headers: Object.fromEntries(resp.headers.entries()),
    text,
    json
  };
}

console.log('\n========================================');
console.log('STAGE 1: HEALTH CHECK & PROBE STORM AUDIT');
console.log('========================================');

// Test 1.1: HEAD /
receivedUpstreamRequests.length = 0;
const headRootRes = await testFetch('/', { method: 'HEAD' });
auditResults.healthProbeStorm.headRoot = {
  status: headRootRes.status,
  upstreamCallsCount: receivedUpstreamRequests.length,
  passed: headRootRes.status === 200 && receivedUpstreamRequests.length === 0
};
console.log(`HEAD / -> status: ${headRootRes.status}, upstream requests triggered: ${receivedUpstreamRequests.length}`);

// Test 1.2: GET /health
receivedUpstreamRequests.length = 0;
const getHealthRes = await testFetch('/health', { method: 'GET' });
auditResults.healthProbeStorm.getHealth = {
  status: getHealthRes.status,
  upstreamCallsCount: receivedUpstreamRequests.length,
  passed: getHealthRes.status === 200 && receivedUpstreamRequests.length === 0
};
console.log(`GET /health -> status: ${getHealthRes.status}, upstream requests triggered: ${receivedUpstreamRequests.length}`);

// Test 1.3: GET /healthz (Kubernetes/Cloud probe)
receivedUpstreamRequests.length = 0;
const getHealthzRes = await testFetch('/healthz', { method: 'GET' });
auditResults.healthProbeStorm.getHealthz = {
  status: getHealthzRes.status,
  upstreamCallsCount: receivedUpstreamRequests.length,
  passed: receivedUpstreamRequests.length === 0
};
console.log(`GET /healthz -> status: ${getHealthzRes.status}, upstream requests triggered: ${receivedUpstreamRequests.length}`);

// Test 1.4: HEAD /health
receivedUpstreamRequests.length = 0;
const headHealthRes = await testFetch('/health', { method: 'HEAD' });
auditResults.healthProbeStorm.headHealth = {
  status: headHealthRes.status,
  upstreamCallsCount: receivedUpstreamRequests.length,
  passed: headHealthRes.status === 200 && receivedUpstreamRequests.length === 0
};
console.log(`HEAD /health -> status: ${headHealthRes.status}, upstream requests triggered: ${receivedUpstreamRequests.length}`);

// Test 1.5: GET /v1/chat/completions (Method Not Allowed probe)
receivedUpstreamRequests.length = 0;
const getCompletionsRes = await testFetch('/v1/chat/completions', { method: 'GET' });
auditResults.healthProbeStorm.getCompletionsProbe = {
  status: getCompletionsRes.status,
  upstreamCallsCount: receivedUpstreamRequests.length,
  passed: receivedUpstreamRequests.length === 0
};
console.log(`GET /v1/chat/completions -> status: ${getCompletionsRes.status}, upstream requests triggered: ${receivedUpstreamRequests.length}`);

// Test 1.6: Empty POST /v1/chat/completions
receivedUpstreamRequests.length = 0;
const postEmptyRes = await testFetch('/v1/chat/completions', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({})
});
auditResults.healthProbeStorm.postEmptyMessages = {
  status: postEmptyRes.status,
  upstreamCallsCount: receivedUpstreamRequests.length,
  passed: postEmptyRes.status === 400 && receivedUpstreamRequests.length === 0
};
console.log(`POST /v1/chat/completions ({}) -> status: ${postEmptyRes.status}, upstream requests triggered: ${receivedUpstreamRequests.length}`);

console.log('\n========================================');
console.log('STAGE 2: MULTI-MODEL CASCADE & UPSTREAM ERROR HANDLING');
console.log('========================================');

// Test 2.1: Upstream 400 Bad Request
// When upstream returns 400 (e.g. invalid parameter), how many keys are rotated?
receivedUpstreamRequests.length = 0;
mockUpstreamConfig.status = 400;
mockUpstreamConfig.body = { error: { message: 'Invalid parameter max_completion_tokens', type: 'invalid_request_error' } };
const post400Res = await testFetch('/v1/chat/completions', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    model: 'groq',
    messages: [{ role: 'user', content: 'test 400 bad request' }]
  })
});
auditResults.upstreamErrors.upstream400 = {
  clientStatus: post400Res.status,
  upstreamCallsCount: receivedUpstreamRequests.length,
  keysAttempted: receivedUpstreamRequests.map(r => r.authorization),
  returnedFallbackDemo: post400Res.json?.choices?.[0]?.message?.content?.includes('Welcome to NamoGPT') || false
};
console.log(`Upstream 400 -> client status: ${post400Res.status}, upstream calls count: ${receivedUpstreamRequests.length}`);
console.log(`Keys attempted:`, receivedUpstreamRequests.map(r => r.authorization));
console.log(`Returned demo fallback: ${auditResults.upstreamErrors.upstream400.returnedFallbackDemo}`);

// Test 2.2: Upstream 401 Unauthorized / Invalid Key
// Reset pools round-robin to ensure key 1 is tried first
const { loadConfig, buildPools, quarantineKey } = await import('./api/index.js');
const testCfg = loadConfig();
const testPools = buildPools(testCfg);
if (testPools['groq']) testPools['groq'].rr = 0;

receivedUpstreamRequests.length = 0;
mockUpstreamConfig.statusHandler = (reqRecord) => {
  if (reqRecord.authorization?.includes('mock_groq_key_1')) return 401; // key 1 invalid
  return 200; // key 2 valid
};
mockUpstreamConfig.bodyHandler = (reqRecord) => {
  if (reqRecord.authorization?.includes('mock_groq_key_1')) {
    return { error: { message: 'Invalid API Key', type: 'authentication_error' } };
  }
  return {
    id: 'chatcmpl-key2-success',
    object: 'chat.completion',
    created: Date.now(),
    model: 'mock-model',
    choices: [{ index: 0, message: { role: 'assistant', content: 'Key 2 succeeded!' }, finish_reason: 'stop' }]
  };
};
const post401Res = await testFetch('/v1/chat/completions', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    model: 'groq',
    messages: [{ role: 'user', content: 'test 401 rotation' }]
  })
});
auditResults.upstreamErrors.upstream401Rotation = {
  clientStatus: post401Res.status,
  upstreamCallsCount: receivedUpstreamRequests.length,
  keysAttempted: receivedUpstreamRequests.map(r => r.authorization),
  passed: post401Res.status === 200 && receivedUpstreamRequests.length === 2
};
console.log(`Upstream 401 rotation -> client status: ${post401Res.status}, upstream calls count: ${receivedUpstreamRequests.length}`);
console.log(`Keys attempted:`, receivedUpstreamRequests.map(r => r.authorization));

// Test 2.3: Subsequent request after 401: Does it remember that key 1 was invalid or hit it again?
// Reset rr to 0 to test if quarantine skips key 1 even when starting from index 0
if (testPools['groq']) testPools['groq'].rr = 0;
receivedUpstreamRequests.length = 0;
const post401NextRes = await testFetch('/v1/chat/completions', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    model: 'groq',
    messages: [{ role: 'user', content: 'test subsequent request after 401' }]
  })
});
const firstKeyInSecondRequest = receivedUpstreamRequests[0]?.authorization;
auditResults.upstreamErrors.keyBlacklistState = {
  subsequentRequestFirstKey: firstKeyInSecondRequest,
  didHitDeadKeyAgain: firstKeyInSecondRequest?.includes('mock_groq_key_1') || false,
  quarantineWorked: firstKeyInSecondRequest?.includes('mock_groq_key_2')
};
console.log(`Subsequent request first key tried: ${firstKeyInSecondRequest} (Quarantine skipped dead key: ${auditResults.upstreamErrors.keyBlacklistState.quarantineWorked})`);

// Test 2.4: Upstream 404 Model Not Found
receivedUpstreamRequests.length = 0;
mockUpstreamConfig.statusHandler = null;
mockUpstreamConfig.bodyHandler = null;
mockUpstreamConfig.status = 404;
mockUpstreamConfig.body = { error: { message: 'Model not found or deprecated', type: 'invalid_request_error' } };
const post404Res = await testFetch('/v1/chat/completions', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    model: 'groq',
    messages: [{ role: 'user', content: 'test 404 model not found' }]
  })
});
auditResults.upstreamErrors.upstream404 = {
  clientStatus: post404Res.status,
  upstreamCallsCount: receivedUpstreamRequests.length,
  keysAttempted: receivedUpstreamRequests.map(r => r.authorization)
};
console.log(`Upstream 404 -> client status: ${post404Res.status}, upstream calls count: ${receivedUpstreamRequests.length}`);
console.log(`Keys attempted for 404:`, receivedUpstreamRequests.map(r => r.authorization));

// Test 2.5: Upstream 429 Rate Limit
receivedUpstreamRequests.length = 0;
mockUpstreamConfig.status = 429;
mockUpstreamConfig.body = { error: { message: 'Rate limit exceeded', type: 'rate_limit_error' } };
const post429Res = await testFetch('/v1/chat/completions', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    model: 'groq',
    messages: [{ role: 'user', content: 'test 429 rate limit' }]
  })
});
auditResults.upstreamErrors.upstream429 = {
  clientStatus: post429Res.status,
  upstreamCallsCount: receivedUpstreamRequests.length,
  keysAttempted: receivedUpstreamRequests.map(r => r.authorization)
};
console.log(`Upstream 429 -> client status: ${post429Res.status}, upstream calls count: ${receivedUpstreamRequests.length}`);

console.log('\n========================================');
console.log('STAGE 3: STREAMING PROTOCOL & SSE INTEGRITY AUDIT');
console.log('========================================');

// Test 3.1: SSE Headers and Protocol
mockUpstreamConfig.status = 200;
mockUpstreamConfig.isStream = true;
receivedUpstreamRequests.length = 0;

const streamFetchRes = await fetch('http://127.0.0.1:29998/v1/chat/completions', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    model: 'groq',
    messages: [{ role: 'user', content: 'test stream' }],
    stream: true
  })
});

const sseContentType = streamFetchRes.headers.get('content-type');
const sseCacheControl = streamFetchRes.headers.get('cache-control');
const sseConnection = streamFetchRes.headers.get('connection');
const sseAccelBuffering = streamFetchRes.headers.get('x-accel-buffering');

console.log(`SSE Content-Type: ${sseContentType}`);
console.log(`SSE Cache-Control: ${sseCacheControl}`);
console.log(`SSE Connection: ${sseConnection}`);
console.log(`SSE X-Accel-Buffering: ${sseAccelBuffering}`);

let streamBodyText = '';
const reader = streamFetchRes.body.getReader();
const decoder = new TextDecoder();
while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  streamBodyText += decoder.decode(value);
}

const hasDone = streamBodyText.includes('data: [DONE]');
console.log(`SSE stream received data: [DONE]: ${hasDone}`);

auditResults.streamingSSE.headers = {
  contentType: sseContentType,
  cacheControl: sseCacheControl,
  connection: sseConnection,
  xAccelBuffering: sseAccelBuffering,
  hasDone
};

// Test 3.2: Client Disconnect Mid-Stream
receivedUpstreamRequests.length = 0;
mockUpstreamConfig.streamChunks = Array.from({ length: 50 }, (_, i) => `data: {"id":"s","choices":[{"delta":{"content":"chunk ${i} "}}]}\n\n`);

const abortController = new AbortController();
const clientAbortReq = fetch('http://127.0.0.1:29998/v1/chat/completions', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    model: 'groq',
    messages: [{ role: 'user', content: 'test client disconnect' }],
    stream: true
  }),
  signal: abortController.signal
});

// Wait 100ms, receive first chunk, then abort client
setTimeout(() => {
  abortController.abort();
}, 100);

try {
  await clientAbortReq;
} catch (e) {
  // Expected abort error
}

// Give 300ms for abort to propagate to upstream
await new Promise(r => setTimeout(r, 300));
const lastUpstreamRecord = receivedUpstreamRequests[receivedUpstreamRequests.length - 1];
const didAbortUpstream = Boolean(lastUpstreamRecord?.aborted);
console.log(`Client disconnect mid-stream -> Upstream request aborted by proxy: ${didAbortUpstream}`);
auditResults.streamingSSE.clientDisconnectAbortedUpstream = didAbortUpstream;

console.log('\n========================================');
console.log('STAGE 4: PARAMETER NORMALIZATION & VISION ROUTING AUDIT');
console.log('========================================');

// Test 4.1: max_completion_tokens normalization
receivedUpstreamRequests.length = 0;
mockUpstreamConfig.isStream = false;
mockUpstreamConfig.status = 200;
mockUpstreamConfig.body = { id: 'test', choices: [{ message: { role: 'assistant', content: 'done' } }] };

await testFetch('/v1/chat/completions', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    model: 'groq',
    messages: [{ role: 'user', content: 'test params' }],
    max_completion_tokens: 256,
    web_search: true,
    userId: 'user_123',
    sessionId: 'sess_456'
  })
});

const forwardedBody = receivedUpstreamRequests[0]?.body;
console.log('Forwarded body keys to upstream:', Object.keys(forwardedBody || {}));
console.log('forwardedBody.max_completion_tokens:', forwardedBody?.max_completion_tokens);
console.log('forwardedBody.max_tokens:', forwardedBody?.max_tokens);
console.log('forwardedBody.web_search:', forwardedBody?.web_search);
console.log('forwardedBody.userId:', forwardedBody?.userId);

auditResults.parameterNormalization.maxCompletionTokensNormalized = (forwardedBody?.max_tokens === 256 && !forwardedBody?.max_completion_tokens);
auditResults.parameterNormalization.webSearchStripped = (forwardedBody?.web_search === undefined);
auditResults.parameterNormalization.userIdStripped = (forwardedBody?.userId === undefined);

// Test 4.2: Vision request routing
receivedUpstreamRequests.length = 0;
await testFetch('/v1/chat/completions', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    model: 'auto',
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: 'What is this?' },
          { type: 'image_url', image_url: { url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=' } }
        ]
      }
    ]
  })
});

const visionForwardedModel = receivedUpstreamRequests[0]?.body?.model;
console.log('Vision request routed to model:', visionForwardedModel);
auditResults.parameterNormalization.visionRoutedModel = visionForwardedModel;

// Close servers
mockUpstreamServer.close();
server.close();

console.log('\n========================================');
console.log('AUDIT SUMMARY REPORT');
console.log('========================================');
console.log(JSON.stringify(auditResults, null, 2));

process.exit(0);
