---
name: browser-debug
description: Procedures for attaching to Chrome, capturing network traces, inspecting live console errors, and debugging web apps using Chrome DevTools MCP. Use when troubleshooting UI rendering, frontend runtime exceptions, or client-side API requests.
---

# Chrome DevTools Browser Debugging Workflow

Follow this runbook to inspect running web applications, debug frontend runtime exceptions, and trace network traffic using Chrome DevTools MCP.

## Workflow Steps

### Step 1: Attach to Browser Instance
1. Confirm the development server is running locally (e.g., Vite on port 5173, Next.js on port 3000).
2. Connect Chrome DevTools MCP to the target Chrome instance or launch a debugging session pointing to the application URL.
3. Verify that the target tab or page session is active.

### Step 2: Capture and Analyze Console Logs
1. Retrieve active console messages filtered by severity (`error`, `warn`).
2. Identify uncaught exceptions, React boundary errors, hydration warnings, or unhandled promise rejections.
3. Map error stack traces back to local source components and lines in `web/` or `src/`.

### Step 3: Trace Network Traffic
1. Enable network event monitoring on the active target page.
2. Trigger the problematic user interaction (form submission, navigation, auth flow).
3. Inspect captured requests:
   - Check status codes (e.g., 400 Bad Request, 401/403 Auth errors, 404 Not Found, 500 Server Error).
   - Review request headers, authorization tokens, payload formatting, and JSON responses.
   - Detect CORS preflight errors or blocked requests.

### Step 4: Inspect DOM Tree & Styles
1. Locate suspect elements via DOM queries or selector inspection.
2. Evaluate computed styles, flex/grid properties, and visibility flags (`display: none`, opacity, z-index).
3. Validate responsive viewport dimensions and media query triggers.

### Step 5: Verify Resolution
1. Apply necessary code adjustments in the workspace.
2. Trigger a page reload or hot-module reload (HMR).
3. Confirm that console errors are cleared and network requests complete with expected HTTP 200/201 responses.
