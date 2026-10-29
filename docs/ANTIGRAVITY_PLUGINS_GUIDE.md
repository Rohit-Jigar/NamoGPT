# Antigravity & NamoGPT Plugin & MCP Integration Guide

A complete reference and operational runbook for integrating, configuring, and leveraging Model Context Protocol (MCP) servers and workspace plugins across the **Google Antigravity CLI (`agy`)** and the **NamoGPT Full-Stack Platform**.

---

## 1. Executive Overview

Modern agentic AI coding assistants rely on **Model Context Protocol (MCP)** to break out of the static training boundary and securely interface with live developer tools, real-time documentation, databases, telemetry, and browsers. 

This guide details the **4 enterprise-grade plugins and MCP servers** integrated into the Antigravity developer environment and NamoGPT platform:

| Plugin / MCP Server | Provider / Core Engine | Transport | Primary Purpose |
| :--- | :--- | :--- | :--- |
| **`context7`** | Upstash Context7 | Streamable HTTP | Up-to-date, version-specific framework & library documentation, eliminating API hallucinations. |
| **`chrome-devtools`** | Google Chrome DevTools Team | Stdio (`npx`) | Live browser runtime inspection, console logs, network tracing, and UI automated verification. |
| **`sentry`** | Sentry (Functional Software Inc.) | Streamable HTTP | Real-time production error triage, stacktrace inspection, and Sentry Seer AI root-cause diagnostics. |
| **`supabase`** | Supabase PBC | Streamable HTTP | Full backend management: PostgreSQL schema introspection, migrations, RLS policies, Auth & Edge Functions. |
| **`omniroute`** *(Base)* | OmniRoute AI Gateway | Stdio (`node`) | Local multi-provider AI gateway, intelligent cascade failover, and prompt token compression. |

---

## 2. Discovery & Architecture in Antigravity

Antigravity employs a dual-scope architecture for discovering and executing MCP servers and plugins:

```mermaid
flowchart TD
    subgraph Antigravity Engine
        A[User Input / Prompt] --> B{Discovery Engine}
        B --> C[Workspace Scope: .agents/plugins/]
        B --> D[Explicit Registration: .agents/plugins.json]
        B --> E[Global Scope: ~/.gemini/config/mcp_config.json]
        B --> F[Built-in Bundled Customizations]
    end

    subgraph MCP Transports
        C & E --> G[Stdio Transport: Local Process]
        C & E --> H[Streamable HTTP Transport: Remote Endpoint]
    end

    G --> I[chrome-devtools / omniroute]
    H --> J[context7 / sentry / supabase]
```

### 2.1 Discovery Hierarchy & Precedence
When resolving tools and rules, Antigravity traverses the filesystem with strict precedence (highest to lowest):
1. **Workspace Plugins & Customizations (`.agents/plugins/<name>/`)**: Project-specific bundles checked into Git. Overrides global configurations for team consistency.
2. **Declared Project Registrations (`.agents/plugins.json`)**: Explicit workspace-level manifests that declare plugin inclusion and external paths.
3. **Global Machine Configuration (`~/.gemini/config/mcp_config.json`)**: Applies globally to all repositories and developer sessions on the local machine.
4. **Built-in System Plugins**: Default core capabilities packaged directly with Antigravity.

---

### 2.2 Global MCP Configuration (`mcp_config.json`)
The global configuration file resides at:
- **Windows**: `C:\Users\<USER>\.gemini\config\mcp_config.json`
- **Linux/macOS**: `~/.gemini/config/mcp_config.json`

#### Schema & Configured Servers
```json
{
  "mcpServers": {
    "omniroute": {
      "command": "node",
      "args": [
        "C:\\Users\\245413\\AppData\\Roaming\\npm\\node_modules\\omniroute\\bin\\mcp-server.mjs"
      ],
      "disabled": false
    },
    "context7": {
      "serverUrl": "https://mcp.context7.com/mcp",
      "disabled": false
    },
    "chrome-devtools": {
      "command": "npx",
      "args": [
        "-y",
        "chrome-devtools-mcp@latest"
      ],
      "disabled": false
    },
    "sentry": {
      "serverUrl": "https://mcp.sentry.dev/mcp",
      "disabled": false
    },
    "supabase": {
      "serverUrl": "https://mcp.supabase.com/mcp?features=docs%2Caccount%2Cdatabase%2Cdebugging%2Cdevelopment%2Cfunctions%2Cbranching",
      "disabled": false
    }
  }
}
```

> [!NOTE]
> Antigravity supports both `serverUrl` and `url` keys for Streamable HTTP remote servers. When added via the CLI (`agy mcp add`), `serverUrl` is populated automatically.

---

### 2.3 Workspace Plugin Directory Structure (`.agents/plugins/`)
Workspace plugins package **MCP server configs**, **system instructions (rules)**, and **procedural runbooks (skills)** into a single portable directory:

```text
D:\NamoGPT\.agents/
├── plugins.json                       # Central workspace registration manifest
└── plugins/
    ├── context7/
    │   ├── plugin.json                # Plugin metadata & display identity
    │   ├── mcp_config.json            # Streamable HTTP MCP config for context7
    │   ├── rules/
    │   │   └── AGENTS.md              # Always-on rules for version-pinned documentation queries
    │   └── skills/
    │       └── context7-docs/
    │           └── SKILL.md           # Procedure for resolving library IDs and extracting code
    ├── chrome-devtools/
    │   ├── plugin.json
    │   ├── mcp_config.json            # Stdio MCP config for Puppeteer / Chrome DevTools
    │   ├── rules/
    │   │   └── AGENTS.md              # Rules for DOM debugging, console logging, network checks
    │   └── skills/
    │       └── browser-debug/
    │           └── SKILL.md           # Step-by-step browser tracing & UI verification guide
    ├── sentry/
    │   ├── plugin.json
    │   ├── mcp_config.json            # Streamable HTTP config for Sentry
    │   ├── rules/
    │   │   └── AGENTS.md              # Rules for error triage and stacktrace verification
    │   └── skills/
    │       └── sentry-debug/
    │           └── SKILL.md           # Procedures for issue lookup & root cause analysis
    └── supabase/
        ├── plugin.json
        ├── mcp_config.json            # Streamable HTTP config for Supabase
        ├── rules/
        │   └── AGENTS.md              # Rules for database safety, idempotent DDL & RLS policies
        └── skills/
            └── supabase-manage/
                └── SKILL.md           # Schema introspection, SQL authoring & Auth management
```

---

## 3. Detailed Tool Capabilities

### 3.1 Context7 (`context7`)
Context7 dynamically resolves package names and injects official, version-accurate documentation into prompt context.

* **Primary Capabilities**:
  - `resolve-library-id`: Maps human-readable package or framework names (e.g., `nextjs`, `tailwindcss`, `hono`, `drizzle-orm`) to the canonical library identifier recognized by the Context7 vector index.
  - `query-docs`: Retrieves version-pinned syntax, API references, parameter specifications, and code recipes directly from upstream maintainer documentation.
* **Why It Matters**: Prevents LLMs from writing deprecated lifecycle hooks (e.g., Next.js Pages router vs App Router Server Actions) or hallucinated Tailwind v4 utility classes.

---

### 3.2 Google Chrome DevTools (`chrome-devtools`)
Maintained by the Google Chrome team, this MCP server attaches directly to a local or headless Chrome instance via Puppeteer.

* **Primary Capabilities**:
  - **Console & Error Inspection**: Reads uncaught JavaScript exceptions, console warnings, and formatted stack traces.
  - **Network Traffic Analysis**: Inspects HTTP requests/responses, payload headers, status codes, and timing waterfall.
  - **DOM & Visual Inspection**: Evaluates page layout, extracts element selectors, verifies computed CSS styles, and captures full-page or element screenshots.
  - **Performance Profiling**: Records runtime traces, extracts Core Web Vitals (LCP, CLS, INP), and identifies main-thread bottlenecks.
  - **Automated Interaction**: Clicks buttons, fills forms, navigates workflows, and evaluates client-side JavaScript in real-time.

---

### 3.3 Sentry (`sentry`)
Connects the AI agent directly to Sentry’s cloud error tracking and observability platform.

* **Primary Capabilities**:
  - `get_sentry_issue`: Fetches high-level incident summaries, event counts, first/last seen timestamps, and impacted users.
  - `get_stacktrace`: Inspects in-depth source-mapped stack traces, breadcrumbs, OS/browser environments, and local variable context.
  - `search_errors`: Filters issues across environments (`production`, `staging`), tags (`release`, `transaction`), and severity levels.
  - `analyze_issue_with_seer`: Invokes Sentry Seer AI for automated root-cause diagnostics, correlating code changes with crash spikes.

---

### 3.4 Supabase (`supabase`)
Provides comprehensive access to Supabase infrastructure via the hosted Streamable HTTP MCP server.

* **Primary Capabilities**:
  - **Database Schema Introspection**: Inspects tables, columns, foreign keys, data types, indexes, and ENUM definitions.
  - **Safe SQL & Migration Execution**: Authors, validates, and runs idempotent SQL queries and schema migrations.
  - **Row Level Security (RLS)**: Audits existing security policies, checks table RLS status, and drafts granular access rules (`USING`, `WITH CHECK`).
  - **Authentication Management**: Queries auth users, inspects JWT claims, audits auth provider configurations, and verifies triggers.
  - **Edge Functions & Branching**: Manages database branching for isolated pull-request testing and inspects Deno Edge Function logs.

---

## 4. Credentials & Setup Guide

All 4 plugins can be used in public/read-only mode or elevated with project authentication tokens for private repository and organization access.

### 4.1 Token Summary & Environment Variables

| Variable | Associated Plugin | Required For | Where to Obtain |
| :--- | :--- | :--- | :--- |
| `SENTRY_AUTH_TOKEN` | `sentry` | Reading private Sentry projects, issues, and traces | Sentry Dashboard → **User Settings** → **Auth Tokens** (Scopes: `org:read`, `project:read`, `event:read`, `issue:read`) |
| `SUPABASE_ACCESS_TOKEN` | `supabase` | Accessing private Supabase schemas, tables, and auth | Supabase Dashboard → **Account** → **Access Tokens** → Generate Token |
| `CONTEXT7_API_KEY` | `context7` | High-rate limit tier or private documentation indexes | Upstash / Context7 developer portal |

---

### 4.2 How to Configure Credentials

#### Method A: Project `.env` File (Recommended for Local Dev)
Add credentials to `D:\NamoGPT\.env`:
```env
# Sentry API Access
SENTRY_AUTH_TOKEN=sntrys_0123456789abcdef...

# Supabase Personal Access Token
SUPABASE_ACCESS_TOKEN=sbp_9876543210fedcba...

# Context7 Optional Token
CONTEXT7_API_KEY=ctx7_secret_token...
```

#### Method B: Global Antigravity MCP Config (`mcp_config.json`)
You can inject environment variables or HTTP Authorization headers directly into the server definitions:

```json
{
  "mcpServers": {
    "sentry": {
      "serverUrl": "https://mcp.sentry.dev/mcp",
      "headers": {
        "Authorization": "Bearer sntrys_your_token_here"
      }
    },
    "supabase": {
      "serverUrl": "https://mcp.supabase.com/mcp?features=docs%2Caccount%2Cdatabase%2Cdebugging%2Cdevelopment%2Cfunctions%2Cbranching",
      "headers": {
        "Authorization": "Bearer sbp_your_token_here"
      }
    }
  }
}
```

#### Method C: System Environment Variables (PowerShell)
To set user-wide environment variables without modifying project files:
```powershell
[System.Environment]::SetEnvironmentVariable("SENTRY_AUTH_TOKEN", "sntrys_your_token", "User")
[System.Environment]::SetEnvironmentVariable("SUPABASE_ACCESS_TOKEN", "sbp_your_token", "User")
```

---

## 5. Workflows & Example Prompts

### 5.1 Antigravity CLI (`agy`) Workflows

When working in the terminal via `agy`:

#### Workflow 1: Building with Modern Libraries via Context7
```text
User: "Use context7 to fetch the latest Supabase Auth SSR setup for Next.js 15 App Router. Show me how createServerClient is initialized with cookies."
```
* **Agent Action**: Calls `context7` to fetch version-pinned documentation for `@supabase/ssr`, extracting accurate cookie handling code without hallucinating deprecated helper methods.

#### Workflow 2: Automated Frontend Debugging via Chrome DevTools
```text
User: "Run chrome-devtools to navigate to http://localhost:5173, inspect the console for React hydration errors, and verify if the login button triggers the auth modal."
```
* **Agent Action**: Spawns Chrome via `chrome-devtools-mcp`, visits the URL, captures console error logs, simulates a click event on the login button, and reports DOM state changes.

#### Workflow 3: Triaging Production Outages via Sentry
```text
User: "Query sentry for unresolved issues in the 'production' environment from the last 24 hours. Extract the stack trace for the top recurring 500 error and diagnose the root cause."
```
* **Agent Action**: Queries Sentry MCP for recent issue groups, retrieves stack traces and breadcrumbs, analyzes the failure pattern, and identifies the exact source code line causing the failure.

#### Workflow 4: Database Schema Auditing via Supabase
```text
User: "Inspect the 'users' and 'subscriptions' tables in Supabase. Check if RLS is enabled and author a secure policy that allows users to only read their own subscription records."
```
* **Agent Action**: Performs schema introspection via `supabase`, checks `rowsecurity` status, and drafts an idempotent SQL migration with `CREATE POLICY ... USING (auth.uid() = user_id)`.

---

### 5.2 NamoGPT Web UI Workflows

In the NamoGPT Web Interface (`http://localhost:3001`):

#### 1. Invoking via Chat
- Natural language triggers automatically route to the appropriate plugin:
  - *"Check the database tables for our project using Supabase"*
  - *"Search Sentry for errors related to auth login timeout"*
  - *"Lookup Tailwind CSS v4 color theme configuration in Context7"*
  - *"Check browser rendering and console logs for the landing page"*

#### 2. Manual Invocation via REST API
The NamoGPT server exposes unified endpoints for direct testing and integration:

##### List all active plugins:
```bash
curl http://localhost:3001/api/plugins/list
```

##### Invoke a specific plugin:
```bash
# Example: Query documentation via Context7
curl -X POST http://localhost:3001/api/plugins/invoke \
  -H "Content-Type: application/json" \
  -d '{
    "name": "context7",
    "args": {
      "library": "nextjs",
      "query": "Server Actions mutation handling"
    }
  }'

# Example: Inspect browser via Chrome DevTools
curl -X POST http://localhost:3001/api/plugins/invoke \
  -H "Content-Type: application/json" \
  -d '{
    "name": "chrome-devtools",
    "args": {
      "url": "http://localhost:3001",
      "action": "inspect_console"
    }
  }'

# Example: Query errors via Sentry
curl -X POST http://localhost:3001/api/plugins/invoke \
  -H "Content-Type: application/json" \
  -d '{
    "name": "sentry",
    "args": {
      "environment": "production",
      "limit": 5
    }
  }'

# Example: Inspect tables via Supabase
curl -X POST http://localhost:3001/api/plugins/invoke \
  -H "Content-Type: application/json" \
  -d '{
    "name": "supabase",
    "args": {
      "action": "list_tables"
    }
  }'
```

---

## 6. Verification & Troubleshooting Runbook

### 6.1 CLI Verification Checklist

Execute the following commands in PowerShell to verify Antigravity CLI status:

```powershell
# 1. Check all registered MCP servers
agy mcp list

# Expected Output:
# NAME             TYPE   STATUS   COMMAND/URL
# omniroute        stdio  enabled  node C:\Users\245413\AppData\Roaming\npm\node_modules\omniroute\bin\mcp-server.mjs
# context7         http   enabled  https://mcp.context7.com/mcp
# chrome-devtools  stdio  enabled  npx -y chrome-devtools-mcp@latest
# sentry           http   enabled  https://mcp.sentry.dev/mcp
# supabase         http   enabled  https://mcp.supabase.com/mcp?features=docs...
```

### 6.2 Managing Servers via CLI
- **Add / Update a Server**:
  ```powershell
  agy mcp add context7 https://mcp.context7.com/mcp
  agy mcp add chrome-devtools npx -y chrome-devtools-mcp@latest
  ```
- **Enable / Disable a Server**:
  ```powershell
  agy mcp disable sentry
  agy mcp enable sentry
  ```
- **Remove a Server**:
  ```powershell
  agy mcp remove test
  ```

### 6.3 Common Troubleshooting Scenarios

| Issue | Root Cause | Resolution |
| :--- | :--- | :--- |
| **`chrome-devtools` fails to launch** | Node/npm or Chrome binary not in system `PATH` | Ensure Google Chrome is installed. Verify `npx --version` succeeds in terminal. |
| **`sentry` returns 401 Unauthorized** | Missing or expired auth token | Generate a new token in Sentry User Settings and set `SENTRY_AUTH_TOKEN` in `.env` or header. |
| **`supabase` returns 403 Forbidden** | User token lacks project permissions | Use an account-level Personal Access Token from `supabase.com/dashboard/account/tokens`. |
| **Streamable HTTP connection drops** | Corporate proxy or network timeout | Test connection directly via `curl -I https://mcp.context7.com/mcp`. Verify network allows outbound HTTPS. |

---

*Documentation maintained by Worker 4: E2E Verification & Documentation Specialist for NamoGPT.*
