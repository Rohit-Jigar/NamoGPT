# Namo Coder — End-to-End Implementation & Deployment Guide
## Local AI + OmniRouter Cloud AI Architecture

**Document version:** 2.0  
**Project:** Namo Coder  
**Goal:** Build a production-ready Cursor-style desktop AI IDE from scratch, supporting free/local AI through Ollama and optional hosted AI through OmniRouter.

---

## 1. Executive Summary

Namo Coder is a desktop AI coding environment inspired by the workflow of modern AI IDEs.

The product will provide:

- Monaco code editor
- Project/file explorer
- Tabs
- Integrated terminal
- Git integration
- AI chat
- Inline AI editing
- Multi-file AI editing
- Diff review
- Codebase indexing
- Symbol search
- Semantic search
- Project rules
- Agent/tool execution
- Test execution
- Checkpoints
- Local AI through Ollama
- Hosted AI through OmniRouter
- Provider-independent model architecture
- Windows/Linux/macOS packaging
- GitHub-based CI/CD and releases

### Core strategy

Namo Coder must **not depend on a paid cloud service to function**.

There are two AI paths:

```text
                     Namo Coder
                         |
                    Namo AI Core
                         |
                  Provider Router
                   /            \
                  /              \
                 v                v
             Ollama           OmniRouter
                |                |
          Local models      Hosted models
          No API bill       Pay per usage
```

Ollama is the local/offline path.

OmniRouter is an optional hosted-model gateway. Its current API is OpenAI-compatible, uses `https://omnirouter.li/v1` for compatible clients, supports streaming, tool calls and model discovery, and uses prepaid per-request billing rather than a subscription. An account can be created for free, but requests require prepaid credit; there is currently no trial credit. Always verify current model IDs and pricing in the live OmniRouter catalog before shipping defaults. 

---

# 2. What "Free" Means

There are three different cost categories.

## 2.1 Free software

These can be used without paying a software license fee for the basic stack:

```text
TypeScript
React
Electron
Vite
Monaco
Tailwind
Zustand
xterm.js
SQLite
tree-sitter
Vitest
Playwright
Git
Ollama
GitHub repository
```

## 2.2 Free/local AI

With Ollama:

```text
Namo Coder
   |
   v
Ollama
   |
   v
Local model
```

No hosted inference charge is required.

The user's computer supplies the CPU/GPU/RAM.

## 2.3 Hosted AI

With OmniRouter:

```text
Namo Coder
   |
   v
OmniRouter API
   |
   v
Selected hosted model
```

This is **not unlimited free AI**. OmniRouter currently uses prepaid credit and charges according to the selected model/request usage. Failed requests are not charged according to its current pricing documentation. 

Therefore the correct product promise is:

> **Namo Coder can be used with no mandatory AI API bill through local models. OmniRouter is an optional paid hosted-model provider.**

---

# 3. OmniRouter's Role

OmniRouter should be implemented as a provider, not as the core of Namo Coder.

## Provider architecture

```text
packages/ai-core/

src/
├── providers/
│   ├── ollama/
│   │   └── OllamaProvider.ts
│   │
│   ├── omnirouter/
│   │   └── OmniRouterProvider.ts
│   │
│   └── openai-compatible/
│       └── OpenAICompatibleProvider.ts
│
├── models/
├── router/
├── agent/
├── context/
├── tools/
└── permissions/
```

This allows Namo Coder to support:

```text
Ollama
OmniRouter
Other OpenAI-compatible endpoints
Future providers
```

without changing the agent implementation.

---

# 4. OmniRouter API Facts

At the time of writing, OmniRouter documents:

```text
OpenAI-compatible base URL:
https://omnirouter.li/v1
```

Important endpoints include:

```text
GET  /v1/models
POST /v1/chat/completions
POST /v1/responses
```

Streaming is supported through server-sent events.

OmniRouter also documents tool-call support and usage reporting. Exact feature compatibility depends on the selected model. 

The current integration documentation recommends Node.js 18+ for its helper tooling and provides:

```bash
npx omnirouter-helper
```

for supported editor/coding-tool configuration. Namo Coder does not need this helper in production because Namo Coder will implement its own provider integration. 

---

# 5. Namo Coder Final Architecture

```text
┌───────────────────────────────────────────────────────────┐
│                      NAMO CODER                           │
│                                                           │
│  Explorer │ Monaco Editor │ AI │ Terminal │ Git │ Diff   │
└─────────────────────────┬─────────────────────────────────┘
                          │
                         IPC
                          │
┌─────────────────────────▼─────────────────────────────────┐
│                    NAMO AI CORE                           │
│                                                           │
│ Agent │ Context │ Model Router │ Tools │ Permissions      │
└─────────────────────────┬─────────────────────────────────┘
                          │
              ┌───────────┴───────────┐
              │                       │
              v                       v
       ┌───────────────┐       ┌────────────────┐
       │ Local Provider│       │ Cloud Provider │
       │               │       │                │
       │ Ollama        │       │ OmniRouter     │
       └───────┬───────┘       └────────┬───────┘
               │                        │
               v                        v
        Local Models              Hosted Models


                    Code Intelligence
                          │
             ┌────────────┼────────────┐
             v            v            v
          Parser       Search       Embeddings
             │            │            │
             └────────────┼────────────┘
                          v
                       SQLite
```

---

# 6. Technology Stack

| Area | Technology |
|---|---|
| Language | TypeScript |
| Desktop | Electron |
| Frontend | React |
| Bundler | Vite |
| CSS | Tailwind CSS |
| State | Zustand |
| UI primitives | Radix UI |
| Editor | Monaco Editor |
| Terminal | xterm.js |
| Package manager | pnpm |
| Local database | SQLite |
| Parser | tree-sitter |
| File watcher | chokidar |
| Git | Git CLI |
| Local AI | Ollama |
| Hosted AI | OmniRouter |
| Vector/search | Local vector index / LanceDB |
| Unit tests | Vitest |
| E2E | Playwright |
| Packaging | electron-builder |
| CI | GitHub Actions |
| Source/release | GitHub |

---

# 7. Repository Structure

```text
namo-coder/
│
├── apps/
│   └── desktop/
│       ├── src/
│       │   ├── main/
│       │   │   ├── index.ts
│       │   │   ├── window.ts
│       │   │   ├── ipc/
│       │   │   ├── services/
│       │   │   └── security/
│       │   │
│       │   ├── preload/
│       │   │   └── index.ts
│       │   │
│       │   └── renderer/
│       │       ├── App.tsx
│       │       ├── main.tsx
│       │       ├── components/
│       │       ├── editor/
│       │       ├── explorer/
│       │       ├── terminal/
│       │       ├── chat/
│       │       ├── diff/
│       │       ├── settings/
│       │       ├── panels/
│       │       ├── hooks/
│       │       └── stores/
│       │
│       └── package.json
│
├── packages/
│   ├── ai-core/
│   │   └── src/
│   │       ├── agent/
│   │       ├── context/
│   │       ├── models/
│   │       ├── providers/
│   │       │   ├── ollama/
│   │       │   ├── omnirouter/
│   │       │   └── openai-compatible/
│   │       ├── prompts/
│   │       ├── tools/
│   │       ├── permissions/
│   │       └── router/
│   │
│   ├── code-intelligence/
│   │   └── src/
│   │       ├── parser/
│   │       ├── indexer/
│   │       ├── symbols/
│   │       ├── search/
│   │       ├── embeddings/
│   │       └── watcher/
│   │
│   ├── workspace/
│   │   └── src/
│   │       ├── filesystem/
│   │       ├── git/
│   │       ├── projects/
│   │       └── checkpoints/
│   │
│   ├── terminal/
│   │   └── src/
│   │       ├── shell/
│   │       ├── process/
│   │       └── tasks/
│   │
│   ├── database/
│   │   └── src/
│   │       ├── sqlite/
│   │       ├── migrations/
│   │       └── repositories/
│   │
│   ├── shared/
│   │   └── src/
│   │       ├── types/
│   │       ├── constants/
│   │       └── utils/
│   │
│   └── ui/
│       └── src/
│           ├── components/
│           ├── theme/
│           └── icons/
│
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
│
├── scripts/
├── docs/
├── website/
│
├── .github/
│   └── workflows/
│
├── package.json
├── pnpm-workspace.yaml
├── tsconfig.json
├── .gitignore
├── .editorconfig
├── LICENSE
└── README.md
```

---

# 8. Development Machine Requirements

Install:

```text
Node.js LTS
pnpm
Git
Ollama
```

Optional:

```text
Python
C/C++ build tools
```

Native packages may require platform-specific build tools.

Verify:

```bash
node --version
pnpm --version
git --version
ollama --version
```

---

# 9. Bootstrap the Repository

```bash
mkdir namo-coder
cd namo-coder

git init
pnpm init
```

Create:

```yaml
# pnpm-workspace.yaml

packages:
  - "apps/*"
  - "packages/*"
```

Create packages:

```bash
mkdir -p apps/desktop
mkdir -p packages/ai-core
mkdir -p packages/code-intelligence
mkdir -p packages/workspace
mkdir -p packages/terminal
mkdir -p packages/database
mkdir -p packages/shared
mkdir -p packages/ui

mkdir -p tests/unit
mkdir -p tests/integration
mkdir -p tests/e2e
mkdir -p docs
mkdir -p scripts
mkdir -p website
```

---

# 10. Root Scripts

Use root scripts similar to:

```json
{
  "scripts": {
    "dev": "pnpm --filter @namo/desktop dev",
    "build": "pnpm -r build",
    "test": "pnpm -r test",
    "test:e2e": "pnpm --filter @namo/desktop test:e2e",
    "typecheck": "pnpm -r typecheck",
    "lint": "pnpm -r lint",
    "format": "prettier --write .",
    "check": "pnpm typecheck && pnpm lint && pnpm test"
  }
}
```

Pin dependencies after the first successful setup and commit the lockfile.

---

# 11. Electron Security

Use Electron with:

```text
contextIsolation = true
nodeIntegration = false
sandbox = true where compatible
```

Never expose Node.js directly to React.

Correct:

```text
React
  |
  v
Preload API
  |
  v
IPC
  |
  v
Electron main
  |
  v
Filesystem / terminal / AI
```

Incorrect:

```text
React
  |
  v
require("fs")
```

The renderer must not receive unrestricted filesystem or shell access.

---

# 12. Phase 1 — Build the IDE

Implement:

- Electron window
- React shell
- Explorer
- Monaco
- tabs
- save
- settings
- command palette

Milestone:

```text
Open project
  ↓
Browse files
  ↓
Open file
  ↓
Edit
  ↓
Save
```

Do not add the AI agent yet.

---

# 13. File System Layer

Implement:

```ts
listDirectory(path)
readFile(path)
writeFile(path, content)
createFile(path)
createDirectory(path)
rename(path)
delete(path)
```

All workspace operations must validate paths.

Protect against:

```text
../
absolute path escape
symbolic-link escape where relevant
unexpected filesystem locations
```

Workspace-scoped AI tools must not silently operate outside the workspace.

---

# 14. Monaco

Support:

- language detection
- tabs
- selections
- editor commands
- diagnostics
- diff editor

Document state:

```ts
type OpenDocument = {
  path: string;
  language: string;
  content: string;
  dirty: boolean;
};
```

---

# 15. Terminal

Use xterm.js plus a controlled process/PTY implementation.

User terminal:

```text
User -> terminal -> local shell
```

Agent terminal:

```text
Agent -> permission manager -> command runner
```

These must be treated as different security contexts.

---

# 16. Git

Use Git CLI initially.

Implement:

```text
status
diff
branch
log
show
add
restore
commit
```

AI must not automatically push.

Default:

```text
git push -> explicit approval
```

---

# 17. SQLite

Store local application state:

```text
projects
workspaces
files
symbols
embeddings
conversations
messages
agent_runs
tool_calls
checkpoints
settings
```

Database belongs in the OS application-data directory.

Never store the production database beside the executable.

---

# 18. AI Provider Interface

Create a provider-neutral interface.

```ts
export interface ChatModel {
  chat(request: ChatRequest): Promise<ChatResponse>;

  stream(
    request: ChatRequest
  ): AsyncIterable<ChatChunk>;
}
```

Embedding:

```ts
export interface EmbeddingModel {
  embed(input: string): Promise<number[]>;
}
```

Provider metadata:

```ts
type ModelInfo = {
  id: string;
  name?: string;
  provider: string;
  contextWindow?: number;
  supportsTools?: boolean;
  supportsVision?: boolean;
  supportsStreaming?: boolean;
};
```

---

# 19. Ollama Provider

The Ollama provider handles:

```text
model discovery
chat
streaming
local inference
```

Configuration:

```text
Provider: Ollama
Base URL: local Ollama endpoint
Model: user-selected installed model
```

The model name should be configurable.

Do not assume every computer can run the same model.

---

# 20. OmniRouter Provider

Implement OmniRouter using its OpenAI-compatible API.

Configuration:

```text
Provider:
    OmniRouter

Base URL:
    https://omnirouter.li/v1

API key:
    user-provided

Model:
    exact model ID from OmniRouter catalog
```

The provider should implement:

```text
listModels()
chat()
stream()
toolCalls()
```

where supported by the selected model.

Use the model ID returned by the live `/v1/models` endpoint or copied from the OmniRouter catalog. Do not hard-code a model ID based only on an old documentation example.

---

# 21. OmniRouter API Integration

Conceptually:

```ts
const client = new OpenAI({
  baseURL: "https://omnirouter.li/v1",
  apiKey
});

const response = await client.chat.completions.create({
  model,
  messages
});
```

Streaming:

```ts
const stream = await client.chat.completions.create({
  model,
  messages,
  stream: true
});
```

Namo Coder should wrap this behind:

```ts
OmniRouterProvider
```

rather than calling the API throughout the codebase.

---

# 22. API Key Security

Never:

```text
commit API key
bundle API key
hard-code API key
send API key to renderer unnecessarily
```

The user's OmniRouter key should be stored locally using the OS credential store where practical.

Architecture:

```text
React settings
      |
      v
IPC
      |
      v
secure local credential storage
      |
      v
OmniRouter provider
```

The renderer should receive only masked key information such as:

```text
sk_live_••••••••1234
```

OmniRouter's documentation states that created API keys are shown once and are stored as hashes on its side, so Namo Coder should also make it clear that the user must protect the key locally. 

---

# 23. AI Provider Settings UI

Build:

```text
Settings
  └── AI

Provider
  ├── Ollama
  ├── OmniRouter
  └── Custom OpenAI-compatible

Model
  └── [Select]

API key
  └── [••••••••]

Context mode
  ├── Automatic
  └── Manual

Agent permissions
  ├── Ask
  └── Automatic for safe operations
```

---

# 24. Model Router

The model router chooses the active provider.

```ts
type ModelRoute = {
  provider: "ollama" | "omnirouter" | "custom";
  model: string;
};
```

Initial strategy:

```text
User chooses provider
        ↓
Model Router
        ↓
Selected provider
```

Later:

```text
task classifier
      ↓
cost / capability policy
      ↓
model selection
```

---

# 25. Recommended AI Modes

Provide three user-facing modes.

## Local

```text
Ollama
```

Best for:

- privacy
- offline work
- no API cost
- routine coding

## OmniRouter

Best for:

- stronger hosted models
- weak local hardware
- model choice
- fast experimentation

## Hybrid

```text
Autocomplete -> local
Embeddings -> local
Simple chat -> local
Complex agent -> OmniRouter
```

The hybrid mode is optional and should not be enabled silently.

---

# 26. First AI Feature — Chat

Context:

```text
current file
selection
conversation history
project rules
```

Do not send the whole repository.

UI:

```text
┌───────────────────────────┐
│ Namo AI                   │
├───────────────────────────┤
│ Explain this function     │
│                           │
│ Assistant response...     │
│                           │
│ [ Ask Namo... ]           │
└───────────────────────────┘
```

---

# 27. Context Engine

The context engine decides what the model receives.

Pipeline:

```text
User query
    |
    +--> current file
    |
    +--> selection
    |
    +--> keyword search
    |
    +--> symbol search
    |
    +--> semantic search
    |
    +--> imports/dependencies
    |
    +--> project rules
    |
    v
Candidate context
    |
    v
Ranking
    |
    v
Token budget
    |
    v
Prompt
```

---

# 28. Codebase Indexer

Index:

```text
source files
symbols
functions
classes
imports
exports
code chunks
embeddings
```

Ignore:

```text
node_modules
.git
dist
build
coverage
large binaries
temporary files
```

Respect `.gitignore` where practical.

Add:

```text
.namoignore
```

for Namo-specific exclusions.

---

# 29. Parsing

Use tree-sitter to extract structure.

Store:

```text
file path
symbol
symbol type
start line
end line
language
signature
```

Eventually combine:

```text
tree-sitter
+
LSP
+
text search
+
semantic search
```

---

# 30. Semantic Search

Create code chunks:

```ts
type CodeChunk = {
  filePath: string;
  startLine: number;
  endLine: number;
  symbol?: string;
  content: string;
};
```

Search result:

```ts
type SearchResult = {
  filePath: string;
  startLine: number;
  endLine: number;
  score: number;
  content: string;
};
```

The UI must be able to jump directly to the returned source location.

---

# 31. Embedding Strategy

Default:

```text
source code
   ↓
local embedding model
   ↓
local vector index
```

Do not automatically send an entire repository to a cloud embedding provider.

If a future OmniRouter embedding route is used, make it an explicit user setting and verify the exact model/endpoint capability first.

---

# 32. AI Editing

AI should produce structured edits.

Example:

```json
{
  "file": "src/auth/login.ts",
  "edits": [
    {
      "startLine": 20,
      "endLine": 25,
      "replacement": "..."
    }
  ]
}
```

Workflow:

```text
AI proposal
    ↓
validate
    ↓
calculate diff
    ↓
show diff
    ↓
permission check
    ↓
apply
    ↓
checkpoint
```

---

# 33. Diff UI

Use Monaco Diff Editor.

Actions:

```text
Accept
Reject
Accept file
Reject file
Accept all
Reject all
```

Never hide multi-file changes from the user.

---

# 34. Agent

The agent is a controlled loop.

```text
User request
     |
     v
Context Engine
     |
     v
Model
     |
     v
Tool call?
  /      \
yes      no
 |        |
 v        v
Tool     Done
 |
 v
Result
 |
 +------> Model
```

Tools:

```text
list_files
read_file
search_code
search_symbols
read_project_rules
write_file
edit_file
get_git_diff
run_tests
run_command
```

---

# 35. Agent Permissions

Levels:

```text
READ
WRITE
EXECUTE
DESTRUCTIVE
NETWORK
GIT_WRITE
```

Default:

```text
Read             AUTO
Search           AUTO
Run tests        AUTO
Edit file        REVIEW
Create file      REVIEW
Delete file      ASK
Run command      ASK
Git commit       ASK
Git push         ALWAYS ASK
Network          ASK
Destructive      BLOCK/ASK
```

The user must be able to stop the agent at any time.

---

# 36. Agent Limits

Implement:

```text
maximum iterations
maximum tool calls
maximum execution time
maximum output
token budget
cancellation
loop detection
```

Example:

```ts
const MAX_AGENT_STEPS = 30;
const MAX_TOOL_CALLS = 100;
const AGENT_TIMEOUT_MS = 10 * 60 * 1000;
```

These are starting values, not universal requirements.

---

# 37. Agent Activity UI

Show:

```text
Namo Agent

✓ Analyzed project
✓ Found auth middleware
✓ Read User model
→ Editing src/auth/login.ts
→ Running tests
✗ 2 tests failed
→ Fixing failures
✓ Tests passed
```

Every tool call should be inspectable.

---

# 38. Terminal Agent Safety

Before execution:

```text
Agent wants to run:

npm install package-name

[Allow] [Deny]
```

Dangerous example:

```text
rm -rf ...
```

must never be silently auto-approved.

Protect commands involving:

```text
recursive deletion
disk operations
credentials
system directories
Git push
remote deployment
package installation
network services
```

---

# 39. Project Rules

Support:

```text
.namo/rules.md
```

Example:

```md
# Namo Coder Rules

- Use TypeScript.
- Do not introduce `any`.
- Follow the existing API architecture.
- Do not edit generated files.
- Run tests after backend changes.
- Do not change database schema without a migration.
```

Load rules before agent execution.

---

# 40. Checkpoints

Before a substantial AI edit:

```text
Create checkpoint
      ↓
Agent modifies files
      ↓
Tests
      ↓
User reviews
```

Allow:

```text
Restore checkpoint
```

Git can provide the first implementation.

Later build a native snapshot/patch system.

---

# 41. Database Schema

Suggested tables:

```sql
projects
workspaces
files
symbols
embeddings
conversations
messages
agent_runs
tool_calls
checkpoints
settings
```

Agent run:

```sql
CREATE TABLE agent_runs (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  conversation_id TEXT,
  started_at INTEGER NOT NULL,
  finished_at INTEGER,
  status TEXT NOT NULL,
  provider TEXT,
  model TEXT
);
```

Tool call:

```sql
CREATE TABLE tool_calls (
  id TEXT PRIMARY KEY,
  agent_run_id TEXT NOT NULL,
  tool TEXT NOT NULL,
  arguments TEXT NOT NULL,
  result TEXT,
  status TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
```

---

# 42. Error Model

Use structured errors:

```ts
type NamoError = {
  code: string;
  message: string;
  details?: unknown;
  recoverable: boolean;
};
```

Important codes:

```text
MODEL_NOT_RUNNING
MODEL_NOT_FOUND
OMNIROUTER_AUTH_FAILED
OMNIROUTER_INSUFFICIENT_CREDIT
OMNIROUTER_MODEL_NOT_ENABLED
FILE_NOT_FOUND
WORKSPACE_ACCESS_DENIED
TOOL_PERMISSION_DENIED
COMMAND_FAILED
INDEX_FAILED
DATABASE_ERROR
AGENT_TIMEOUT
AGENT_CANCELLED
```

---

# 43. OmniRouter Error Handling

Map common gateway responses:

```text
401 -> invalid API key
402 -> insufficient prepaid credit
404 -> model not found / not enabled
503 -> gateway unavailable
```

The current OmniRouter documentation explicitly documents these classes of errors. 

UI example:

```text
AI request failed

Your OmniRouter account does not have enough prepaid credit.

[Open AI Settings]
[Switch to Ollama]
```

Do not display a generic "AI failed" message when a useful recovery path is known.

---

# 44. OmniRouter Cost Controls

Namo Coder must prevent accidental spending.

Add:

```text
Per-request context limit
Maximum output
Maximum agent steps
Maximum tool calls
Model selection
Cloud confirmation
```

Optional:

```text
Session spending limit
Daily spending limit
```

The local application can enforce its own soft/hard budget by estimating usage, but the provider's dashboard remains the authoritative billing record.

OmniRouter currently provides per-request usage records and prepaid billing. 

---

# 45. Cloud Privacy

When OmniRouter is selected:

```text
Selected code context
       |
       v
Namo Coder
       |
       v
OmniRouter
       |
       v
upstream provider
```

Therefore cloud mode must be clearly labeled.

Do not advertise:

```text
"Your code never leaves your computer"
```

when OmniRouter is active.

OmniRouter's current privacy policy states that it processes submitted request content and operational/billing information and that requests are routed through external providers. 

Namo Coder should therefore provide:

```text
Privacy mode:
[ Local only ]
[ Allow cloud AI ]
```

with local-only as the privacy-maximizing option.

---

# 46. Secret Redaction

Before sending cloud context, scan for likely:

```text
API keys
tokens
passwords
private keys
.env values
database credentials
```

Default cloud policy:

```text
Detect
  ↓
Redact or ask
```

Do not claim perfect detection.

---

# 47. Settings

```text
Settings
├── General
├── Editor
├── Terminal
├── Git
├── AI
│   ├── Provider
│   ├── Model
│   ├── API Key
│   ├── Context
│   └── Agent
├── Privacy
├── Security
└── Indexing
```

AI:

```text
Provider:
  Local / Ollama
  OmniRouter
  Custom OpenAI-compatible

Model:
  [dynamic model list]

Cloud confirmation:
  Enabled

Maximum agent steps:
  30

Maximum context:
  Automatic
```

---

# 48. Dynamic Model Discovery

For OmniRouter:

```text
GET /v1/models
```

Use returned model IDs.

UI:

```text
Provider: OmniRouter

Refresh Models

Models:
  model-a
  model-b
  model-c
```

Do not hard-code old model names.

The catalog can change.

---

# 49. Model Capability Registry

Keep capability information:

```ts
type ModelCapabilities = {
  chat: boolean;
  streaming: boolean;
  tools: boolean;
  vision: boolean;
  structuredOutput: boolean;
  embeddings: boolean;
};
```

Use this to prevent invalid combinations.

Example:

```text
Agent requires tool support.

Selected model:
tool support unavailable

=> show:
"Choose a tool-capable model."
```

---

# 50. Hybrid Model Policy

Optional advanced routing:

```text
Task
 |
 +-- autocomplete
 |       -> Ollama
 |
 +-- explanation
 |       -> Ollama
 |
 +-- code search
 |       -> local
 |
 +-- simple edit
 |       -> Ollama
 |
 +-- complex agent
         -> OmniRouter
```

Do not make automatic cloud escalation the default.

Ask the user or make the policy explicit.

---

# 51. Fake AI Provider

CI must not require a live OmniRouter or Ollama model.

Create:

```text
FakeModelProvider
```

It returns deterministic outputs.

Use it for:

```text
agent tests
context tests
tool tests
edit tests
permission tests
```

This keeps GitHub Actions free and deterministic.

---

# 52. Test Strategy

## Unit

Test:

```text
path validation
context ranking
chunking
model routing
provider parsing
permission policy
diff generation
database repositories
secret redaction
```

## Integration

Test:

```text
workspace
+
indexer
+
search
+
fake AI
+
agent
```

## E2E

Test:

```text
Open project
Open file
Edit
Save
Terminal
Chat
Generate edit
Review diff
Accept
Run tests
Agent fix
Restore checkpoint
```

---

# 53. Local Development

Start the desktop application:

```bash
pnpm dev
```

Run checks:

```bash
pnpm typecheck
pnpm lint
pnpm test
```

Run E2E:

```bash
pnpm test:e2e
```

Build:

```bash
pnpm build
```

---

# 54. OmniRouter Development Test

First create an OmniRouter account and API key.

Add a small amount of prepaid credit before testing because current accounts start with zero balance and API requests without credit receive a 402 response. 

Then test outside Namo Coder first:

```text
OpenAI-compatible client
        |
        v
https://omnirouter.li/v1
        |
        v
exact model ID
        |
        v
short test prompt
```

Only after that works should the provider be integrated into the full agent.

---

# 55. Namo OmniRouter Connection Test

In Namo Coder:

```text
Settings
  ↓
AI
  ↓
Provider: OmniRouter
  ↓
API Key
  ↓
Refresh Models
  ↓
Select model
  ↓
Test Connection
```

The connection test should make a tiny request.

Show:

```text
✓ Connected

Provider:
OmniRouter

Model:
selected-model

Latency:
xxx ms
```

Do not use a large context for the connection test.

---

# 56. Free/Local Connection Test

```text
Settings
  ↓
AI
  ↓
Provider: Ollama
  ↓
Refresh Models
  ↓
Select local model
  ↓
Test
```

If successful:

```text
✓ Local AI ready
```

---

# 57. First Public MVP

Release only after this works:

```text
IDE
✓ Explorer
✓ Monaco
✓ Tabs
✓ Save
✓ Terminal
✓ Git

AI
✓ Ollama
✓ OmniRouter
✓ Chat
✓ Context
✓ AI edit
✓ Diff

Agent
✓ Tools
✓ Permissions
✓ Tests
✓ Checkpoints

Intelligence
✓ Search
✓ Index
✓ Semantic retrieval

Delivery
✓ CI
✓ Windows
✓ Linux
✓ macOS where supported
✓ Documentation
```

---

# 58. Build Pipeline

Local:

```bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

Package:

```bash
pnpm electron-builder
```

Expected release targets:

```text
Windows installer
Linux AppImage
macOS DMG
```

Exact artifact names depend on electron-builder configuration.

---

# 59. electron-builder

Configure:

```text
Windows:
  NSIS

Linux:
  AppImage

macOS:
  DMG
```

Do not package:

```text
Ollama
large AI models
user database
user API keys
development secrets
```

The application should download or detect models separately.

---

# 60. Model Installation UX

First launch:

```text
Welcome to Namo Coder

How do you want AI to work?

[ Local AI ]
[ OmniRouter ]
[ Skip AI setup ]
```

Local:

```text
Checking Ollama...
✓ Found

Installed models:
  ...

Choose model:
  ...

[ Continue ]
```

OmniRouter:

```text
Enter OmniRouter API key

[ Save securely ]

Fetching models...
✓ Models available
```

If neither is configured:

```text
Continue without AI
```

The editor must still work.

---

# 61. GitHub Repository

Create:

```text
namo-coder
```

Then:

```bash
git remote add origin <repository>
git branch -M main
git add .
git commit -m "chore: initialize Namo Coder"
git push -u origin main
```

Never commit:

```text
.env
API keys
private keys
database files
node_modules
build artifacts
AI model files
logs
```

---

# 62. GitHub Actions CI

Create:

```text
.github/workflows/ci.yml
```

Pipeline:

```text
Push / Pull Request
        |
        v
Install Node
        |
        v
Install pnpm
        |
        v
pnpm install --frozen-lockfile
        |
        +--> typecheck
        +--> lint
        +--> unit tests
        +--> build
```

Do not require:

```text
Ollama
OmniRouter
paid API keys
```

Use the fake model provider.

---

# 63. Release Workflow

Version:

```text
0.1.0
0.1.1
0.2.0
1.0.0
```

Create tag:

```bash
git tag v0.1.0
git push origin v0.1.0
```

Release CI:

```text
tag
 ↓
tests
 ↓
build
 ↓
package
 ↓
artifacts
 ↓
GitHub Release
```

---

# 64. Code Signing

This is the main part of desktop distribution that is not universally free.

Early beta:

```text
unsigned builds
```

Production:

```text
Windows code signing
macOS signing/notarization
```

Linux is generally easier to distribute as an AppImage, but users may still see trust/security warnings depending on their system.

Never put signing credentials in source control.

Store them as CI secrets.

---

# 65. Free Deployment Architecture

The recommended initial production architecture:

```text
                      GitHub
                         |
             +-----------+-----------+
             |                       |
          Source                  Releases
             |                       |
             v                       v
       GitHub Actions        Desktop installers
             |
             v
      Tests + Packaging


User computer
     |
     +--> Namo Coder
     |
     +--> Ollama
     |
     +--> Local model
     |
     +--> SQLite/index
     |
     +--> optional OmniRouter
```

There is no required Namo backend.

---

# 66. Website Deployment

Build a static website:

```text
website/
├── index.html
├── download.html
├── docs.html
└── privacy.html
```

Use free static hosting such as:

```text
GitHub Pages
or
another free static-hosting provider
```

Website links to GitHub Releases.

No database is needed.

---

# 67. Documentation

Create:

```text
docs/
├── getting-started.md
├── installation.md
├── local-ai.md
├── omnirouter.md
├── ai-models.md
├── agent.md
├── project-rules.md
├── terminal.md
├── git.md
├── privacy.md
├── security.md
├── troubleshooting.md
├── development.md
└── architecture.md
```

---

# 68. First-Run Privacy UX

Show:

```text
AI Privacy

Local AI:
Your prompts/context are processed by the local model.

OmniRouter:
Selected context is sent to OmniRouter and may be routed to
the upstream provider required to fulfill the request.

[ Continue with Local AI ]
[ Configure OmniRouter ]
```

Do not hide this behind technical documentation.

---

# 69. Cost-Safe OmniRouter Defaults

Recommended:

```text
Default provider:
Ollama

Cloud provider:
Disabled until configured

Cloud confirmation:
ON

Agent cloud mode:
Ask before starting

Maximum agent steps:
30

Maximum context:
Automatic

Maximum output:
configured per model

Session budget:
optional
```

This prevents accidental large cloud bills.

---

# 70. Production Logging

Log:

```text
provider
model
request ID if available
latency
tool name
agent step
success/failure
```

Never log:

```text
API keys
passwords
tokens
private keys
raw secrets
full sensitive prompts
```

For OmniRouter requests, retain the provider request ID when returned so support/debugging can reference it without exposing credentials.

---

# 71. User Data

Store:

```text
settings
conversation history
index
checkpoints
logs
```

in the user's OS application-data directory.

Allow:

```text
Clear conversation history
Clear project index
Clear logs
Reset settings
```

---

# 72. Offline Mode

When local-only is selected:

```text
Internet:
not required for AI

AI:
Ollama

Index:
local

Database:
local

Git:
local

Terminal:
local
```

Cloud provider calls must be disabled.

---

# 73. Hybrid Mode

Optional:

```text
                 Namo AI
                    |
          +---------+---------+
          |                   |
       Local               Cloud
          |                   |
       Ollama             OmniRouter
          |                   |
       cheap/free          usage cost
```

Use local for:

```text
search
small questions
embeddings
autocomplete
```

Use cloud for:

```text
complex reasoning
large agent tasks
tasks where local model quality is insufficient
```

---

# 74. Performance

Do not block the renderer with:

```text
indexing
embeddings
Git operations
large file operations
model requests
terminal processes
```

Use:

```text
Electron main process
workers
background queues
streaming
incremental indexing
```

---

# 75. Large Repository Strategy

Priority:

```text
1. Open files
2. Recently used files
3. Relevant dependency tree
4. Source files
5. Remaining project files
```

Use hashes:

```text
file content hash
```

If unchanged:

```text
do not re-index
```

---

# 76. Large File Protection

Never automatically send enormous files to a hosted model.

Use:

```text
symbol extraction
relevant line ranges
search
summaries
dependency context
```

Allow explicit full-file inclusion when appropriate.

---

# 77. Security Architecture

Agent security:

```text
                 Agent
                   |
                   v
             Tool Registry
                   |
                   v
            Permission Layer
                   |
          +--------+--------+
          |                 |
       Allowed            Ask
          |                 |
          v                 v
       Execute          User approval
```

For cloud:

```text
Context
  |
  v
Secret scanner
  |
  +--> safe
  |
  +--> redact
  |
  +--> ask
  |
  v
OmniRouter
```

---

# 78. Deployment Checklist

Before release:

```text
[ ] Fresh clone works
[ ] pnpm install --frozen-lockfile works
[ ] TypeScript passes
[ ] Lint passes
[ ] Unit tests pass
[ ] Integration tests pass
[ ] E2E tests pass
[ ] Windows package tested
[ ] Linux package tested
[ ] macOS package tested where available
[ ] Fresh machine install tested
[ ] File permissions tested
[ ] Terminal tested
[ ] Git tested
[ ] Ollama tested
[ ] OmniRouter tested
[ ] Model discovery tested
[ ] API-key storage tested
[ ] Diff tested
[ ] Agent cancellation tested
[ ] Checkpoint restore tested
[ ] Secret redaction tested
[ ] Cloud privacy warning tested
[ ] No credentials in repository
[ ] No debug secrets in logs
[ ] README updated
[ ] Installation docs updated
[ ] OmniRouter docs updated
[ ] Privacy policy updated
[ ] Changelog written
[ ] Release tag created
```

---

# 79. Clean Machine Test

Use a fresh VM or machine.

Install:

```text
Git
Namo Coder
Ollama
local model
```

Test:

```text
1. Launch Namo Coder.
2. Open a project.
3. Open a source file.
4. Edit and save.
5. Open terminal.
6. Run project.
7. Use local AI.
8. Ask about current file.
9. Generate an edit.
10. Review diff.
11. Accept.
12. Run tests.
13. Configure OmniRouter.
14. Fetch models.
15. Run a short OmniRouter chat.
16. Ask the agent to perform a safe task.
17. Confirm permission prompts.
18. Restore checkpoint.
19. Restart Namo Coder.
20. Confirm settings and project state persist.
```

---

# 80. OmniRouter Production Test

Before releasing the OmniRouter integration:

```text
Test 1:
GET models

Test 2:
small chat completion

Test 3:
streaming

Test 4:
tool call with supported model

Test 5:
invalid key

Test 6:
invalid model

Test 7:
zero/insufficient credit

Test 8:
gateway failure

Test 9:
large context handling

Test 10:
agent cancellation
```

Do not assume that because normal chat works, every tool/vision/agent feature works. Model capabilities vary.

---

# 81. Release Strategy

## Version 0.1

```text
Editor
Explorer
Terminal
Git
Ollama
OmniRouter
AI chat
AI editing
Diff
```

## Version 0.2

```text
Indexer
Semantic search
Agent
Tools
Permissions
Checkpoints
```

## Version 0.3

```text
Autocomplete
Project rules
Improved retrieval
Model routing
MCP
Advanced agent
```

## Version 1.0

```text
Stable editor
Stable local AI
Stable cloud provider architecture
Reliable agent
Cross-platform packaging
Strong security
Documentation
Public release process
```

---

# 82. Implementation Order

Follow this order:

```text
1. Repository
2. pnpm monorepo
3. Electron
4. React
5. Monaco
6. Explorer
7. File read/write
8. Tabs
9. Save
10. Terminal
11. Git
12. SQLite
13. Settings
14. Provider interface
15. Ollama provider
16. OmniRouter provider
17. AI chat
18. Current-file context
19. Diff editor
20. Structured AI edits
21. File indexer
22. tree-sitter
23. Symbol search
24. Semantic search
25. Tool registry
26. Permissions
27. Agent loop
28. Test runner
29. Checkpoints
30. Project rules
31. Agent activity UI
32. Secret protection
33. Fake AI tests
34. E2E tests
35. Packaging
36. GitHub Actions
37. GitHub Releases
38. Website
39. Documentation
40. Public beta
```

---

# 83. Definition of Done

Namo Coder is ready for public beta when:

## IDE

```text
✓ Projects open
✓ Files edit/save
✓ Tabs work
✓ Explorer works
✓ Terminal works
✓ Git works
```

## AI

```text
✓ Ollama works
✓ OmniRouter works
✓ Models can be selected
✓ Chat streams
✓ Context works
✓ Edits produce diffs
```

## Agent

```text
✓ Tools work
✓ Permissions work
✓ Agent can be cancelled
✓ Tests can run
✓ Agent can iterate
✓ Checkpoints work
```

## Intelligence

```text
✓ Project indexing
✓ Symbol search
✓ Code search
✓ Semantic retrieval
```

## Security

```text
✓ Electron isolation
✓ Workspace boundaries
✓ Secret protection
✓ Cloud/local distinction
✓ API key protection
✓ Dangerous command approval
```

## Delivery

```text
✓ CI
✓ Windows build
✓ Linux build
✓ macOS build where supported
✓ Release artifacts
✓ Documentation
✓ Privacy policy
```

---

# 84. Final Production Architecture

```text
                         ┌──────────────────────────┐
                         │       Namo Coder         │
                         │                          │
                         │ Explorer                 │
                         │ Monaco                   │
                         │ Terminal                 │
                         │ Git                      │
                         │ AI Chat                  │
                         │ Diff                     │
                         │ Agent                    │
                         └────────────┬─────────────┘
                                      │
                                      v
                         ┌──────────────────────────┐
                         │       Namo AI Core       │
                         │                          │
                         │ Context Engine            │
                         │ Agent                     │
                         │ Tool Registry             │
                         │ Permission Manager        │
                         │ Model Router              │
                         └────────────┬─────────────┘
                                      │
                     ┌────────────────┼────────────────┐
                     │                │                │
                     v                v                v
                  Ollama         OmniRouter       Custom API
                     │                │
                     v                v
                 Local AI       Hosted AI
                     │                │
                     └───────┬────────┘
                             │
                             v
                     Code Intelligence
                             │
              ┌──────────────┼──────────────┐
              v              v              v
          tree-sitter      Search        Embeddings
              │              │              │
              └──────────────┼──────────────┘
                             v
                          SQLite
```

---

# 85. Recommended User Experience

The final user flow should be:

```text
Install Namo Coder
        |
        v
Open project
        |
        v
Choose AI:
  Local / OmniRouter
        |
        v
Index project
        |
        v
Start coding
        |
        +------------------------+
        |                        |
        v                        v
     Editor                   Namo AI
                                |
                                v
                         Understand project
                                |
                                v
                         Search relevant code
                                |
                                v
                           Plan change
                                |
                                v
                         Propose file edits
                                |
                                v
                            Show diff
                                |
                                v
                           User approves
                                |
                                v
                           Apply changes
                                |
                                v
                           Run tests
                                |
                       +--------+--------+
                       |                 |
                    success            fail
                       |                 |
                       v                 v
                    finish          diagnose/fix
```

---

# 86. Final Cost Architecture

For the initial public beta:

```text
Namo Coder software
    = open-source/free components

Desktop distribution
    = GitHub Releases

Website
    = free static hosting

CI
    = GitHub Actions within available free limits

Database
    = local SQLite

Vector index
    = local

AI without API cost
    = Ollama

Optional hosted AI
    = OmniRouter prepaid usage

Required Namo backend
    = none
```

This means the project can launch without operating a permanent model-serving backend.

The only variable AI expense for users who choose hosted inference is their OmniRouter usage.

---

# 87. Important Product Rules

1. **Ollama is the free/local default.**
2. **OmniRouter is optional.**
3. **Never require OmniRouter to launch Namo Coder.**
4. **Never hard-code an OmniRouter API key.**
5. **Fetch current model IDs instead of assuming old model names.**
6. **Keep the AI provider interface independent of OmniRouter.**
7. **Keep code indexing local by default.**
8. **Never silently send project code to a cloud provider.**
9. **Show cloud/privacy status clearly.**
10. **Require approval for dangerous agent actions.**
11. **Always show AI file changes as diffs.**
12. **Always provide cancellation.**
13. **Use fake providers in CI.**
14. **Do not bundle huge AI models into installers.**
15. **Do not build a cloud backend until there is a real requirement.**

---

# 88. The Actual First Implementation

The first development sprint should produce:

```text
namo-coder/
  apps/desktop
  packages/ai-core
  packages/code-intelligence
  packages/workspace
  packages/terminal
  packages/database
  packages/shared
  packages/ui
```

Then:

```text
Electron
   +
React
   +
Monaco
   +
Explorer
   +
Terminal
```

Once this is stable:

```text
AI Provider Interface
       |
       +--> Ollama
       |
       +--> OmniRouter
```

Then:

```text
AI Chat
   ↓
Context
   ↓
Structured edits
   ↓
Diff
   ↓
Tools
   ↓
Agent
```

Then:

```text
Indexing
   ↓
Semantic retrieval
   ↓
Better agent context
```

Finally:

```text
Testing
   ↓
Packaging
   ↓
GitHub Actions
   ↓
GitHub Releases
   ↓
Public beta
```

---

# 89. Reference Links

Official OmniRouter documentation:

- API documentation: https://omnirouter.li/docs
- Pricing: https://omnirouter.li/pricing
- Integration guides: https://omnirouter.li/use
- Privacy policy: https://omnirouter.li/privacy
- Terms: https://omnirouter.li/terms

Always use the current OmniRouter documentation and live model catalog when implementing the provider because model availability, IDs, capabilities and prices can change.

---

# 90. End State

Namo Coder should ultimately provide this experience:

```text
                    NAMO CODER
                         |
             +-----------+-----------+
             |                       |
          Local AI                Cloud AI
             |                       |
          Ollama                 OmniRouter
             |                       |
       No API billing          Prepaid usage
             |                       |
             +-----------+-----------+
                         |
                    Namo AI Core
                         |
        +----------------+----------------+
        |                |                |
      Context           Agent           Tools
        |                |                |
      Search          Planning        Files
      Symbols         Iteration       Terminal
      Embeddings      Tests           Git
        |                |                |
        +----------------+----------------+
                         |
                      Workspace
                         |
                    User's machine
```

The core product remains usable for free with local AI, while OmniRouter provides a clean path to stronger hosted models without coupling Namo Coder to one model vendor.

**This is the architecture to implement from an empty repository through public beta and deployment.**
