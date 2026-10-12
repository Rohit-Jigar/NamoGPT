---
name: sentry-debug
description: Procedures for querying Sentry issues, inspecting stack traces and breadcrumbs, and leveraging Seer AI analysis to troubleshoot production errors. Use when diagnosing production crashes, triaging unresolved exceptions, or analyzing incident regressions.
---

# Sentry Production Error Triage Workflow

Follow this procedure to locate, triage, and diagnose production issues and unhandled exceptions using Sentry MCP.

## Workflow Steps

### Step 1: Discover and Filter Issues
1. Execute Sentry search queries for active issues:
   - Filter by status (`is:unresolved`), severity level (`level:error` or `level:fatal`), and project.
   - Restrict environment as appropriate (`environment:production`).
2. Sort issues by event frequency and unique user impact count.
3. Identify the target issue ID and retrieve summary metadata.

### Step 2: Fetch Event Details and Stack Trace
1. Query the latest event for the target issue ID.
2. Inspect the exception type, error value, and full stack trace.
3. Locate the in-app stack frames, noting the specific filename, method name, and line number where the failure occurred.

### Step 3: Analyze Chronological Breadcrumbs
1. Examine the sequence of breadcrumbs preceding the error event:
   - Check outgoing HTTP requests and returned status codes.
   - Check console logs, navigation changes, and user clicks.
   - Identify edge-case inputs or network timeouts that triggered the crash.

### Step 4: Evaluate Seer AI Diagnosis
1. Request Sentry Seer analysis on the issue:
   - Review the root-cause summary, suspected culprit commits, and suggested fixes.
   - Cross-reference suspected commits against local git repository history.

### Step 5: Locate Local Source and Remediate
1. Navigate to the affected source code files in the repository.
2. Implement robust error handling, null guards, schema validation, or logic corrections.
3. Create automated regression tests reproducing the failure scenario.
