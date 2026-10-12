# Chrome DevTools Debugging Rules

These rules dictate browser inspection, UI troubleshooting, and network diagnostics using Chrome DevTools MCP.

## Inspection Guidelines

1. **Live Console Inspection First**:
   - When encountering client-side bugs, rendering glitches, or unexpected blank pages, check the Chrome DevTools console before hypothesizing causes.
   - Categorize entries into fatal errors, warnings, deprecations, and info logs. Extract full stack traces and source file pointers.

2. **Network Error Tracing**:
   - For failing API requests or broken assets, inspect the network panel logs via DevTools.
   - Examine HTTP status codes, method types, response headers (e.g., CORS `Access-Control-Allow-Origin`), request payloads, and response bodies.
   - Correlate failed backend endpoints with client-side fetch/axios invocations.

3. **Frontend Rendering & Layout**:
   - Inspect DOM elements, box models, and computed CSS properties to resolve visual styling discrepancies, responsiveness issues, and hydration mismatches.
   - Check element bounding boxes and overflow behavior when UI clipping or unexpected scrollbars occur.

4. **Non-Destructive Execution**:
   - Do not inject scripts that alter persistent state (e.g., clearing `localStorage` or session cookies) without explicit necessity.
   - Maintain reproducible debugging flows by capturing screenshots or trace snapshots before and after modifications.
