# Sentry Error Triage & Root Cause Analysis Rules

These rules govern the retrieval, investigation, and resolution of application exceptions and crash reports using Sentry MCP.

## Triage Guidelines

1. **Systematic Search & Filtering**:
   - Query Sentry issues using structured search syntax (`is:unresolved`, `level:error`, `environment:production`, `environment:staging`).
   - Prioritize high-frequency regressions and errors impacting large numbers of distinct users (`users_affected`).
   - Inspect release tags (`release:<version>`) to correlate error spikes with specific deployments.

2. **Root Cause Depth**:
   - Always trace stack traces to root source lines rather than wrapping calls in blunt `try/catch` statements without addressing the cause.
   - Analyze breadcrumbs chronologically: review prior network calls, UI interactions, database transactions, and navigation events leading up to the crash.
   - Inspect error context tags (browser, OS, device, Python/Node runtime version).

3. **Seer AI Analysis Verification**:
   - Use Sentry Seer AI insights and suggested root-cause summaries as investigative starting points.
   - Rigorously cross-examine Seer recommendations against the actual workspace repository source code and commit history before adopting any solution.

4. **Security & Privacy Guardrails**:
   - Never log, copy, or expose Personally Identifiable Information (PII), authentication tokens, passwords, or secret keys found within error payloads or breadcrumbs into git or commit messages.
