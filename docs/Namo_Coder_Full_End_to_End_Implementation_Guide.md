# Namo Coder — Full End-to-End Implementation Guide

## From Empty Repository to Production Desktop AI IDE

**Project:** Namo Coder  
**Product type:** Local-first AI coding IDE  
**Primary runtime:** Electron  
**Frontend:** React + TypeScript  
**Editor:** Monaco  
**Local AI:** Ollama  
**Cloud AI:** OmniRouter  
**Database:** SQLite  
**Code intelligence:** tree-sitter + search + optional local embeddings  
**Distribution:** GitHub Releases  
**CI/CD:** GitHub Actions

---

# 1. What We Are Building

Namo Coder is a desktop development environment that combines:

```text
Code Editor
+
File Explorer
+
Terminal
+
Git
+
Code Intelligence
+
AI Chat
+
AI Editing
+
Agent Runtime
+
Permissions
+
Testing
+
Checkpoints
```

The key architectural rule is:

> Namo Coder owns the IDE, context, agent, tools, security, edits and verification. AI model providers are replaceable infrastructure.

The application must work without a Namo cloud backend.

AI can run through:

```text
Local:
Namo Coder -> Ollama -> local model

Cloud:
Namo Coder -> OmniRouter -> hosted model
```

The user chooses the privacy/cost/performance trade-off.

---

# 2. Product Goal

A developer should be able to:

```text
Install Namo Coder
      ↓
Open a repository
      ↓
Read/edit code
      ↓
Use terminal
      ↓
Use Git
      ↓
Ask AI about the repository
      ↓
Ask AI to modify code
      ↓
Review a diff
      ↓
Run tests
      ↓
Let an agent fix failures
      ↓
Review final changes
      ↓
Commit with Git
```

The complete workflow should happen inside one application.

---

# 3. Architecture at a Glance

```text
+----------------------------------------------------------------+
|                         NAMO CODER                             |
|                                                                |
|  +----------+ +-----------+ +---------+ +-------+ +---------+ |
|  | Explorer | | Monaco    | | Chat    | | Diff  | |Terminal | |
|  +----------+ +-----------+ +---------+ +-------+ +---------+ |
|         \          |            |          /           /       |
|          +---------+------------+---------+-----------+        |
|                            React UI                         |
|                              |                                |
|                        Typed IPC                              |
|                              |                                |
|                     Electron Main Process                     |
|                              |                                |
|       +----------------------+-----------------------+         |
|       |                      |                       |         |
|       v                      v                       v         |
|  Workspace/Git          AI Core               Database       |
|       |                      |                       |         |
|       |               +------+------+               |         |
|       |               |             |               |         |
|       |            Ollama       OmniRouter           |         |
|       |                                             |         |
|       +---------------- Code Intelligence ----------+         |
|                                                                |
+----------------------------------------------------------------+
```

---

# 4. Technology Stack

| Area | Technology |
|---|---|
| Desktop | Electron |
| UI | React |
| Language | TypeScript |
| Build | Vite |
| Editor | Monaco Editor |
| State | Zustand |
| Styling | Tailwind CSS |
| Components | Radix UI |
| Terminal | xterm.js + node-pty |
| Database | SQLite |
| Database access | Drizzle ORM or typed SQL |
| Parser | tree-sitter |
| File watcher | chokidar |
| Search | SQLite FTS / ripgrep integration |
| Local AI | Ollama |
| Cloud AI | OmniRouter |
| AI protocol | OpenAI-compatible HTTP |
| Git | Git CLI |
| Unit tests | Vitest |
| E2E | Playwright |
| Packaging | electron-builder |
| CI/CD | GitHub Actions |
| Releases | GitHub Releases |
| Documentation | Markdown/static site |

---

# 5. Development Environment

Install:

```text
Node.js LTS
pnpm
Git
Python if required by native dependencies
Ollama
```

Verify:

```bash
node --version
pnpm --version
git --version
ollama --version
```

Recommended development platforms:

```text
Windows
macOS
Linux
```

Build and test each platform separately where possible.

---

# 6. Create the Repository

```bash
mkdir namo-coder
cd namo-coder

git init

pnpm init
```

Create the root workspace:

```text
namo-coder/
├── apps/
├── packages/
├── tests/
├── scripts/
├── docs/
├── website/
├── .github/
├── package.json
├── pnpm-workspace.yaml
├── tsconfig.json
├── .gitignore
└── README.md
```

---

# 7. Monorepo Configuration

`pnpm-workspace.yaml`:

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

Recommended package names:

```text
@namo/desktop
@namo/ai-core
@namo/code-intelligence
@namo/workspace
@namo/terminal
@namo/database
@namo/shared
@namo/ui
```

---

# 8. Complete Folder Structure

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
│       │   │   ├── security/
│       │   │   └── lifecycle/
│       │   │
│       │   ├── preload/
│       │   │   └── index.ts
│       │   │
│       │   └── renderer/
│       │       ├── App.tsx
│       │       ├── components/
│       │       ├── editor/
│       │       ├── explorer/
│       │       ├── terminal/
│       │       ├── chat/
│       │       ├── diff/
│       │       ├── git/
│       │       ├── settings/
│       │       ├── stores/
│       │       └── hooks/
│       │
│       └── package.json
│
├── packages/
│   ├── ai-core/
│   │   └── src/
│   │       ├── agent/
│   │       ├── context/
│   │       ├── providers/
│   │       │   ├── ollama/
│   │       │   ├── omnirouter/
│   │       │   └── openai-compatible/
│   │       ├── router/
│   │       ├── tools/
│   │       ├── permissions/
│   │       └── prompts/
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
│   │       ├── files/
│   │       ├── git/
│   │       ├── checkpoints/
│   │       └── rules/
│   │
│   ├── terminal/
│   │   └── src/
│   │
│   ├── database/
│   │   └── src/
│   │       ├── schema/
│   │       ├── migrations/
│   │       └── repositories/
│   │
│   ├── shared/
│   │   └── src/
│   │
│   └── ui/
│       └── src/
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
└── README.md
```

---

# 9. Build Order

Do not implement everything simultaneously.

Use this order:

```text
Phase 1  -> Repository
Phase 2  -> Electron shell
Phase 3  -> React UI
Phase 4  -> Monaco
Phase 5  -> Filesystem
Phase 6  -> Terminal
Phase 7  -> Git
Phase 8  -> SQLite
Phase 9  -> AI abstraction
Phase 10 -> Ollama
Phase 11 -> OmniRouter
Phase 12 -> Chat
Phase 13 -> Context engine
Phase 14 -> AI edits
Phase 15 -> Diff
Phase 16 -> Code index
Phase 17 -> Agent
Phase 18 -> Permissions
Phase 19 -> Verification
Phase 20 -> Checkpoints
Phase 21 -> Testing
Phase 22 -> Packaging
Phase 23 -> CI/CD
Phase 24 -> Beta release
```

This sequence keeps the project continuously runnable.

---

# 10. Phase 1 — Electron Shell

Create the Electron application.

Requirements:

```text
main process
preload
renderer
window lifecycle
development reload
production build
```

The first milestone is simply:

```text
pnpm dev
```

and a desktop window appears.

---

# 11. Electron Security

Configure:

```text
contextIsolation = true
nodeIntegration = false
```

Do not expose Node APIs to React.

Renderer:

```text
React
  ↓
window.namo
  ↓
preload
  ↓
IPC
  ↓
main
```

Only expose explicit APIs.

---

# 12. Typed IPC

Define request/response contracts.

Example:

```ts
type ReadFileRequest = {
  path: string;
};

type ReadFileResponse = {
  content: string;
};
```

Expose:

```ts
window.namo.files.read(request)
window.namo.files.write(request)
window.namo.ai.chat(request)
window.namo.git.status()
window.namo.terminal.create()
```

Do not allow arbitrary IPC channel invocation from the renderer.

---

# 13. Phase 2 — UI Shell

Build the basic IDE layout:

```text
+-------------------------------------------------------+
| Menu / Toolbar                                        |
+------+----------------------------------+-------------+
|      |                                  |             |
| File |            Editor                | AI          |
| Tree |                                  | Chat        |
|      |                                  |             |
|      |                                  |             |
+------+----------------------------------+-------------+
|                 Terminal / Output                    |
+-------------------------------------------------------+
```

Main panels:

```text
Explorer
Editor
Chat
Terminal
Git
Settings
```

---

# 14. Phase 3 — Monaco

Add Monaco.

Implement:

```text
open file
edit
dirty state
save
save as
close tab
multiple tabs
language detection
cursor
selection
```

Document state:

```ts
type DocumentState = {
  path: string;
  content: string;
  language: string;
  dirty: boolean;
};
```

---

# 15. Phase 4 — Filesystem

Create a workspace service.

Responsibilities:

```text
open workspace
read file
write file
list directory
create file
create directory
rename
delete
```

Critical security requirement:

> Workspace tools must not escape the selected workspace root unless an explicit user action permits it.

Normalize and validate all paths.

---

# 16. Ignore Rules

Do not index or display massive generated directories unnecessarily.

Default ignores:

```text
.git
node_modules
dist
build
coverage
target
out
vendor
```

Support:

```text
.namoignore
```

---

# 17. Phase 5 — Terminal

Use:

```text
xterm.js
node-pty
```

Architecture:

```text
xterm.js
   ↓
React
   ↓
IPC
   ↓
Main
   ↓
PTY
   ↓
Shell
```

Support:

```text
stdin
stdout
stderr
resize
exit
kill
```

Terminal commands must run with the correct workspace directory.

---

# 18. Terminal Security

The normal terminal is user-controlled.

The AI agent is different.

Never let the agent directly invoke the same unrestricted terminal interface.

Instead:

```text
Agent
 ↓
run_command tool
 ↓
permission policy
 ↓
command validation
 ↓
user approval if required
 ↓
isolated execution
```

---

# 19. Phase 6 — Git

Use Git CLI first.

Implement:

```text
status
diff
branches
log
show
add
restore
commit
```

UI:

```text
Source Control
  |
  +-- Changes
  +-- Staged
  +-- Branch
  +-- Commit message
```

Git push should require explicit approval.

---

# 20. Phase 7 — SQLite

Create local database.

Suggested tables:

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

Example:

```sql
CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  path TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
```

Use migrations from the beginning.

---

# 21. Database Rules

SQLite stores metadata, not the authoritative source code.

Source of truth:

```text
filesystem -> code
Git        -> version history
SQLite     -> Namo metadata/index
```

If SQLite is deleted, Namo should be able to rebuild its index.

---

# 22. Phase 8 — AI Provider Abstraction

This is a critical architectural milestone.

Create:

```ts
export interface ChatProvider {
  listModels(): Promise<ModelInfo[]>;

  chat(
    request: ChatRequest
  ): Promise<ChatResponse>;

  stream(
    request: ChatRequest
  ): AsyncIterable<ChatChunk>;

  health(): Promise<ProviderHealth>;
}
```

The agent must depend only on this interface.

---

# 23. Model Types

```ts
export type ModelInfo = {
  id: string;
  provider: string;
  contextWindow?: number;
  supportsTools?: boolean;
  supportsStreaming?: boolean;
  supportsVision?: boolean;
};
```

Do not make UI components depend on provider-specific response objects.

---

# 24. Phase 9 — Ollama

Implement:

```text
health check
model discovery
chat
streaming
```

Flow:

```text
Namo
 ↓
Ollama provider
 ↓
Ollama
 ↓
local model
```

The application should detect whether Ollama is installed/running.

If unavailable, show:

```text
Ollama is not available.

[Open Setup Guide]
[Use OmniRouter]
[Continue Without AI]
```

---

# 25. Choosing Local Models

Do not permanently hard-code one model.

Allow:

```text
installed model list
```

The user chooses a model appropriate for their machine.

Namo should expose basic metadata when available.

---

# 26. Phase 10 — OmniRouter

Create:

```text
packages/ai-core/src/providers/omnirouter/
```

Use an OpenAI-compatible client abstraction.

Current documented base URL:

```text
https://omnirouter.li/v1
```

The implementation should be checked against the current OmniRouter API documentation during development because provider APIs and model catalogs can change.

---

# 27. OmniRouter Provider

Responsibilities:

```text
store provider configuration reference
health check
list models
stream chat
normal chat
map errors
```

Conceptually:

```ts
const provider = new OmniRouterProvider({
  apiKey,
  baseURL
});
```

Do not let the renderer construct the provider.

---

# 28. OmniRouter Model Discovery

Retrieve the live catalog where supported.

Conceptually:

```text
GET /v1/models
```

Map provider data into:

```ts
ModelInfo
```

The UI then displays:

```text
OmniRouter
  └── available models
```

Do not ship a permanently stale model list.

---

# 29. API Key Security

Never store the key in:

```text
React state persisted to localStorage
plain settings JSON
Git
logs
source code
```

Use OS secure credential storage where practical.

Flow:

```text
Settings
 ↓
Preload
 ↓
Main
 ↓
OS credential store
```

The provider reads the credential only inside the trusted main process.

---

# 30. Provider Settings

Create a Settings screen:

```text
AI Provider

[ Ollama ]
[ OmniRouter ]
[ Custom OpenAI-Compatible ]

Model
[ dynamic list ]

API Key
[ ******** ]

Cloud AI
[ Enabled / Disabled ]

[ Test Connection ]
```

---

# 31. Phase 11 — Chat

Build the basic chat interface.

Features:

```text
conversation
message input
streaming
stop generation
retry
copy
code blocks
file references
```

MVP context:

```text
current file
current selection
conversation
user prompt
```

Do not immediately implement full repository context.

---

# 32. Streaming

The user should see model output as it arrives.

Flow:

```text
Provider
 ↓
Async stream
 ↓
AI core
 ↓
IPC events
 ↓
React
 ↓
Chat UI
```

Support cancellation.

---

# 33. Cancellation

Every AI request should have an abort mechanism.

States:

```text
idle
running
cancelling
cancelled
completed
failed
```

Never leave the UI indefinitely stuck in `running`.

---

# 34. Phase 12 — Code Intelligence

Implement:

```text
file watcher
parser
symbol extractor
search
index database
```

Architecture:

```text
Filesystem
 ↓
Watcher
 ↓
Parser
 ↓
Symbols
 ↓
Index
```

---

# 35. tree-sitter

Use tree-sitter for supported languages.

Extract:

```text
functions
classes
methods
interfaces
types
imports
exports
```

Store:

```text
file path
symbol name
symbol type
line range
signature
language
```

---

# 36. Incremental Indexing

When:

```text
file created
file changed
file renamed
file deleted
```

only update affected records.

Use content hashes:

```text
old hash == new hash
     ↓
skip parsing
```

This matters for large repositories.

---

# 37. Search

Implement:

```text
filename search
exact text search
regex search
symbol search
```

A fast implementation can call a local search engine such as ripgrep and use SQLite for metadata/symbol lookup.

---

# 38. Semantic Search

Optional second stage:

```text
source code
 ↓
chunking
 ↓
local embeddings
 ↓
vector index
```

Do not make cloud embeddings mandatory.

The first release can ship with strong lexical + symbol search and add semantic retrieval incrementally.

---

# 39. Phase 13 — Context Engine

The context engine is responsible for deciding what the model sees.

Inputs:

```text
user question
current file
selection
open tabs
symbols
search results
Git diff
project rules
dependencies
```

Pipeline:

```text
Retrieve
 ↓
Rank
 ↓
Deduplicate
 ↓
Budget
 ↓
Format
```

---

# 40. Context Ranking

A useful initial scoring strategy:

```text
current selection       highest
current file            high
exact symbol match      high
exact text match        high
import/dependency       medium-high
semantic similarity     medium
unrelated files         low
```

The goal is not maximum context.

The goal is:

> maximum relevant context within the model budget.

---

# 41. Token Budgeting

Before every model request:

```text
system instructions
+
project rules
+
conversation
+
retrieved code
+
current file
+
tool state
```

must fit within the selected model's usable context window.

When over budget:

```text
remove low-ranked chunks
compress repetitive context
preserve direct references
```

---

# 42. Project Rules

Support:

```text
.namo/rules.md
```

Example:

```md
# Namo Rules

- Use TypeScript.
- Do not modify generated files.
- Run tests after implementation changes.
- Do not introduce `any`.
- Ask before changing public APIs.
```

Rules become part of agent context.

---

# 43. Phase 14 — Structured AI Editing

Do not rely only on:

```text
"Here is the code..."
```

Create a structured edit protocol.

Example:

```json
{
  "file": "src/auth.ts",
  "edits": [
    {
      "startLine": 20,
      "endLine": 30,
      "replacement": "..."
    }
  ]
}
```

Validate:

```text
file exists
range is valid
content matches expected base
workspace boundary
```

---

# 44. Optimistic Concurrency

Before applying an AI edit, compare:

```text
file hash when AI read it
vs
current file hash
```

If different:

```text
Do not silently apply.

Show:
"The file changed since the AI generated this edit."
```

Then regenerate or rebase the patch.

---

# 45. Phase 15 — Monaco Diff

Every significant AI edit goes through a diff.

```text
Original
   |
   +------> Proposed
```

User actions:

```text
Accept
Reject
Review
Accept selected changes
```

---

# 46. Multi-File Changes

For multiple files:

```text
3 files changed

src/auth.ts
src/session.ts
tests/auth.test.ts
```

Show aggregate summary:

```text
+52
-18
```

Allow per-file review.

---

# 47. Phase 16 — Agent Runtime

The agent converts:

```text
user objective
```

into:

```text
plan
→ inspect
→ modify
→ verify
→ recover
```

State machine:

```text
IDLE
 ↓
PLANNING
 ↓
EXECUTING
 ↓
WAITING_FOR_PERMISSION
 ↓
VERIFYING
 ↓
COMPLETED
```

Failure:

```text
FAILED
CANCELLED
```

---

# 48. Agent Tool Registry

Initial tools:

```text
list_files
read_file
search_code
search_symbols
read_rules
write_file
edit_file
get_git_diff
run_tests
run_command
```

Each tool:

```ts
type ToolDefinition = {
  name: string;
  description: string;
  risk: ToolRisk;
  inputSchema: unknown;
  execute: (input: unknown) => Promise<unknown>;
};
```

---

# 49. Tool Risk Levels

```text
READ
WRITE
EXECUTE
DESTRUCTIVE
NETWORK
GIT_WRITE
```

Default policy:

| Tool | Default |
|---|---|
| read_file | Allow |
| search_code | Allow |
| search_symbols | Allow |
| get_git_diff | Allow |
| run_tests | Allow |
| write_file | Review |
| edit_file | Review |
| run_command | Ask |
| delete_file | Ask |
| git_commit | Ask |
| git_push | Always Ask |
| destructive operation | Deny/Ask |

---

# 50. Permission UI

When the agent requests a sensitive action:

```text
Agent wants to run:

npm install package-name

Reason:
Required dependency for the requested change.

[Allow Once]
[Allow for Workspace]
[Deny]
```

Never hide permission decisions inside logs.

---

# 51. Agent Limits

Implement:

```text
max steps
max tool calls
max runtime
max output size
max context size
loop detection
cancellation
```

Initial safe default:

```text
30 steps
```

Make it configurable.

---

# 52. Loop Detection

Detect patterns such as:

```text
same tool
same arguments
same failure
repeated test
```

If repeated too many times:

```text
Agent appears stuck.

[Continue]
[Stop]
[Reset]
```

---

# 53. Phase 17 — Verification

The agent must verify changes.

Typical project commands:

```text
typecheck
lint
unit tests
integration tests
build
```

Detect project tooling where possible.

For example:

```text
package.json scripts
Makefile
pyproject.toml
Cargo.toml
```

Never blindly execute unknown commands without policy approval.

---

# 54. Test Feedback Loop

```text
AI edit
 ↓
run tests
 ↓
success?
  ├── yes → complete
  └── no
        ↓
     parse error
        ↓
     context retrieval
        ↓
     model diagnosis
        ↓
     proposed fix
        ↓
     diff
        ↓
     tests
```

---

# 55. Phase 18 — Checkpoints

Before major agent work:

```text
checkpoint
```

A checkpoint can initially be Git-backed.

Example:

```text
create checkpoint metadata
capture Git diff/status
record agent run ID
```

Later add internal patch snapshots.

---

# 56. Restore

User must be able to:

```text
Restore checkpoint
```

Show:

```text
This will revert Namo Coder changes made after checkpoint X.

[Restore]
[Cancel]
```

Never make destructive restoration silent.

---

# 57. Cloud Privacy Architecture

Local:

```text
Workspace
 ↓
Context
 ↓
Ollama
 ↓
Local model
```

Cloud:

```text
Workspace
 ↓
Context selection
 ↓
Secret detection
 ↓
Cloud policy
 ↓
OmniRouter
 ↓
Hosted model
```

The application should clearly show:

```text
LOCAL AI
```

or:

```text
CLOUD AI
```

in the UI.

---

# 58. Secret Detection

Before cloud requests, inspect candidate context for:

```text
API keys
access tokens
private keys
passwords
.env files
database credentials
cloud credentials
```

Possible actions:

```text
safe
redact
exclude
ask user
```

The detector is a safety layer, not a guarantee.

---

# 59. Sensitive File Policy

Default cloud exclusion candidates:

```text
.env
.env.*
*.pem
*.key
credentials.*
secrets.*
```

Users may explicitly override this policy.

---

# 60. Error Handling

Provider errors should map into user-readable categories.

Examples:

```text
NETWORK_ERROR
AUTHENTICATION_ERROR
RATE_LIMIT
INSUFFICIENT_CREDIT
MODEL_NOT_FOUND
MODEL_UNAVAILABLE
CONTEXT_TOO_LARGE
TIMEOUT
UNKNOWN_PROVIDER_ERROR
```

Do not display raw provider stack traces as the primary UI.

---

# 61. Provider Fallback

If configured:

```text
OmniRouter fails
      ↓
retry
      ↓
local Ollama available?
      ↓
yes
      ↓
offer/perform fallback according to user policy
```

Automatic cloud/local switching should never violate the user's privacy setting.

---

# 62. Observability

Local logs:

```text
timestamp
component
event
duration
status
provider
model
run ID
tool name
```

Never log:

```text
API keys
passwords
private keys
raw credentials
```

For AI calls, prefer recording metadata over full source payloads.

---

# 63. Testing Strategy

Three levels:

```text
Unit
Integration
E2E
```

---

# 64. Unit Tests

Test:

```text
path validation
provider adapters
model routing
context ranking
token budgeting
secret detection
permission rules
diff validation
checkpoint logic
database repositories
```

Use Vitest.

---

# 65. Fake AI Provider

CI must not require:

```text
Ollama
OmniRouter
cloud credit
internet
```

Create:

```ts
FakeChatProvider
```

with deterministic responses.

This makes agent tests reproducible.

---

# 66. Integration Tests

Test:

```text
workspace
+
database
+
indexer
+
fake provider
+
agent
```

Example:

```text
Open fixture repository
 ↓
Ask agent to fix bug
 ↓
Agent reads files
 ↓
Agent edits
 ↓
Tests run
 ↓
Diff produced
```

---

# 67. E2E Tests

Use Playwright where practical.

Critical flows:

```text
launch app
open workspace
open file
edit/save
open terminal
Git status
configure local AI
chat
generate edit
review diff
run test
agent workflow
permission prompt
checkpoint restore
```

---

# 68. Fixture Repositories

Create small test repositories:

```text
fixtures/
├── typescript-basic/
├── react-project/
├── failing-tests/
├── multi-file-agent/
├── git-project/
└── secret-files/
```

These become regression assets.

---

# 69. Performance Targets

Initial goals:

```text
App launch:
fast enough to feel immediate

Editor typing:
no noticeable AI/indexing lag

Indexing:
background and cancellable

Chat:
first token displayed as soon as available

Diff:
instant for normal source files
```

Do not block the renderer on:

```text
indexing
Git scans
AI requests
terminal output
database migrations
```

---

# 70. Background Work

Use background tasks/workers for:

```text
indexing
embeddings
large Git scans
long AI operations
```

Communicate progress through typed events.

---

# 71. Caching

Cache:

```text
model list
file hashes
parsed symbols
embeddings
context retrieval
Git metadata
```

Invalidate caches using:

```text
content hash
mtime
provider configuration
model ID
```

---

# 72. Settings Architecture

Settings should be separated into:

```text
application
editor
AI
agent
privacy
terminal
Git
appearance
```

Example:

```text
AI:
provider
model
cloud enabled

Agent:
max steps
auto-run tests
permission mode

Privacy:
allow cloud
secret scanning
excluded paths
```

---

# 73. Workspace Configuration

Store project-specific settings under:

```text
.namo/
```

Example:

```text
.namo/
├── rules.md
├── settings.json
└── checkpoints/
```

Do not put secrets in workspace configuration.

---

# 74. Git Safety

Agent should not automatically:

```text
push
force push
reset --hard
delete branches
rewrite history
```

without explicit permission.

For destructive Git actions:

```text
show exact command
show expected effect
require approval
```

---

# 75. Build Configuration

Root scripts should provide:

```bash
pnpm dev
pnpm build
pnpm typecheck
pnpm lint
pnpm test
pnpm test:e2e
pnpm check
```

`check` should run the full non-E2E validation pipeline.

---

# 76. Development Loop

Every feature follows:

```text
Design
 ↓
Type definitions
 ↓
Implementation
 ↓
Unit test
 ↓
Integration test
 ↓
UI integration
 ↓
E2E test
 ↓
Documentation
```

Do not build large untested subsystems.

---

# 77. Git Branching

Recommended:

```text
main
develop (optional)
feature/*
fix/*
release/*
```

For a small team, simplify to:

```text
main
feature/*
fix/*
```

Pull requests should require:

```text
typecheck
lint
tests
build
```

---

# 78. Commit Convention

Use meaningful commits:

```text
feat: add Ollama provider
feat: add OmniRouter model discovery
feat: add Monaco diff workflow
fix: prevent workspace path escape
test: add agent permission coverage
build: add Windows packaging
```

---

# 79. CI/CD

GitHub Actions workflow:

```text
checkout
 ↓
Node setup
 ↓
pnpm setup
 ↓
install --frozen-lockfile
 ↓
typecheck
 ↓
lint
 ↓
unit tests
 ↓
build
```

No AI credentials should be needed.

---

# 80. CI Matrix

Where resources allow:

```text
Windows
Linux
macOS
```

At minimum, compile/test the target release platforms before publishing.

---

# 81. Packaging

Use electron-builder.

Targets:

```text
Windows -> NSIS
Linux   -> AppImage
macOS   -> DMG
```

Do not package AI model weights inside the installer.

---

# 82. Production Configuration

Production build must:

```text
disable devtools unless intentionally enabled
disable debug logs
use production IPC handlers
use secure credential storage
use signed builds where possible
```

Keep a developer diagnostic mode separately.

---

# 83. GitHub Release Process

Release:

```text
v0.1.0
```

Pipeline:

```text
tag
 ↓
CI
 ↓
tests
 ↓
package
 ↓
sign if configured
 ↓
publish artifacts
 ↓
GitHub Release
```

Artifacts:

```text
Namo-Coder-Setup.exe
Namo-Coder.AppImage
Namo-Coder.dmg
```

Exact filenames can be chosen during implementation.

---

# 84. Website Deployment

Create a simple static website:

```text
Home
Download
Docs
Privacy
Security
FAQ
```

Host it on free static hosting.

The website should link to GitHub Releases.

---

# 85. Documentation

Required documentation:

```text
README.md
CONTRIBUTING.md
SECURITY.md
PRIVACY.md
docs/architecture.md
docs/development.md
docs/ai-providers.md
docs/agent.md
docs/troubleshooting.md
```

---

# 86. Privacy Documentation

Explain clearly:

```text
Local AI:
source remains local for inference.

OmniRouter:
selected context is sent through the cloud provider.

Namo backend:
not required for the core product.
```

Do not make stronger privacy claims than the actual implementation supports.

---

# 87. Security Review Before Beta

Verify:

```text
[ ] renderer has no unrestricted Node
[ ] IPC channels are validated
[ ] paths are sandboxed
[ ] terminal agent is permission controlled
[ ] Git destructive operations are protected
[ ] API keys are secure
[ ] secrets are excluded/redacted
[ ] cloud status is visible
[ ] logs do not expose secrets
[ ] updates are trusted
```

---

# 88. Reliability Review

Verify:

```text
[ ] AI request can be cancelled
[ ] agent can be cancelled
[ ] terminal can be killed
[ ] indexer can recover
[ ] database migrations are safe
[ ] corrupted index can rebuild
[ ] provider failure is handled
[ ] invalid model is handled
[ ] network failure is handled
[ ] partial edits do not corrupt files
```

---

# 89. User Experience Review

Verify:

```text
[ ] first launch is understandable
[ ] AI setup is optional
[ ] Ollama setup is clear
[ ] OmniRouter setup is clear
[ ] model list is understandable
[ ] cloud usage is visible
[ ] agent permissions are understandable
[ ] diffs are easy to review
[ ] failures explain what happened
[ ] recovery is obvious
```

---

# 90. MVP Definition

The first credible beta should support:

```text
Monaco editor
File explorer
Tabs
Save
Terminal
Git
SQLite
Ollama
OmniRouter
Chat
Streaming
Current-file context
Code search
Symbol search
AI edits
Diff review
Agent tools
Permissions
Tests
Checkpoints
```

Avoid trying to ship:

```text
team collaboration
cloud sync
billing
remote workspaces
full browser automation
enterprise administration
```

in the first release.

---

# 91. Implementation Milestones

## Milestone 1 — Shell

Deliver:

```text
Electron
React
Vite
IPC
```

Definition of done:

```text
app launches
window works
renderer/main communicate
```

---

## Milestone 2 — Editor

Deliver:

```text
Monaco
tabs
open/save
```

Definition of done:

```text
user can edit real code
```

---

## Milestone 3 — Workspace

Deliver:

```text
explorer
filesystem
workspace root
```

Definition of done:

```text
user can open a repository and navigate it
```

---

## Milestone 4 — Terminal + Git

Deliver:

```text
terminal
Git status
Git diff
```

Definition of done:

```text
basic development workflow works
```

---

## Milestone 5 — Database

Deliver:

```text
SQLite
migrations
settings
workspace metadata
```

---

## Milestone 6 — AI Core

Deliver:

```text
provider interface
streaming
cancellation
fake provider
```

---

## Milestone 7 — Ollama

Deliver:

```text
health
models
chat
streaming
```

---

## Milestone 8 — OmniRouter

Deliver:

```text
secure API key
model discovery
chat
streaming
errors
```

---

## Milestone 9 — Chat

Deliver:

```text
conversation
current-file context
streaming
retry
cancel
```

---

## Milestone 10 — Code Intelligence

Deliver:

```text
index
symbols
search
watcher
```

---

## Milestone 11 — Context Engine

Deliver:

```text
retrieval
ranking
token budget
rules
```

---

## Milestone 12 — AI Editing

Deliver:

```text
structured edits
validation
diff
accept/reject
```

---

## Milestone 13 — Agent

Deliver:

```text
planning
tools
tool results
step limits
cancellation
```

---

## Milestone 14 — Permissions

Deliver:

```text
risk levels
approval UI
workspace policies
```

---

## Milestone 15 — Verification

Deliver:

```text
tests
failure parsing
retry loop
```

---

## Milestone 16 — Checkpoints

Deliver:

```text
checkpoint
restore
agent run association
```

---

## Milestone 17 — Hardening

Deliver:

```text
security tests
crash recovery
performance
large repository tests
```

---

## Milestone 18 — Packaging

Deliver:

```text
Windows
Linux
macOS
```

---

## Milestone 19 — CI/CD

Deliver:

```text
GitHub Actions
release pipeline
artifacts
```

---

# 92. First Complete User Scenario

User opens:

```text
my-project/
```

Namo detects:

```text
TypeScript
React
Git
package.json
```

It starts indexing.

User asks:

```text
Why does the dashboard sometimes show stale data?
```

Context engine finds:

```text
Dashboard.tsx
useData.ts
api/client.ts
cache.ts
tests/dashboard.test.ts
```

AI explains the likely cache invalidation issue.

User says:

```text
Fix it and add a regression test.
```

Agent:

```text
creates checkpoint
reads relevant files
proposes edits
asks permission where required
shows diff
runs tests
```

Tests fail.

Agent:

```text
reads failure
updates implementation
updates test
runs tests again
```

Tests pass.

Namo shows:

```text
3 files changed
52 additions
12 deletions

✓ Tests passed
✓ Checkpoint available
```

User accepts.

Then:

```text
git diff
git commit
```

The entire workflow remains inside Namo Coder.

---

# 93. Hybrid AI Strategy

A practical default:

```text
Task                         Provider

indexing                     Local
embeddings                   Local
simple explanation          Local
small edit                  Local
large repository analysis   Cloud optional
complex reasoning           Cloud optional
agent task                  User-selectable
```

Never silently send data to the cloud.

---

# 94. Cost Strategy

The application itself can be distributed without a mandatory Namo server.

Operating costs can remain low because:

```text
Desktop application -> GitHub Releases
Documentation       -> static hosting
Local AI            -> Ollama
Cloud AI            -> user-configured OmniRouter
```

Cloud inference cost belongs to the selected provider/user account.

---

# 95. Free Development Strategy

For development:

```text
GitHub
GitHub Actions
Ollama
open-source libraries
SQLite
static hosting
```

Use a fake provider in CI.

Do not make paid inference part of the test pipeline.

---

# 96. Production Upgrade Path

After beta, possible upgrades:

```text
semantic code search
LSP integration
MCP support
browser tool
debugger integration
AI autocomplete
multi-agent workflows
team policies
remote indexing
optional Namo account
analytics
enterprise deployment
```

These should not compromise the local-first foundation.

---

# 97. Architecture Rules That Must Not Be Broken

## Rule 1

The UI never talks directly to the filesystem or shell.

## Rule 2

The agent never bypasses the tool registry.

## Rule 3

The agent never bypasses permission checks.

## Rule 4

AI providers never own workspace state.

## Rule 5

The filesystem remains the source of truth for source code.

## Rule 6

Important AI edits are reviewable.

## Rule 7

Cloud inference is explicit.

## Rule 8

AI is never required for core editor functionality.

## Rule 9

The system must be testable without external AI.

## Rule 10

Every long-running operation must be cancellable.

---

# 98. Definition of Production Ready

Namo Coder is ready for public beta when:

```text
[ ] Fresh install works
[ ] Fresh project opens
[ ] Files can be edited/saved
[ ] Terminal works
[ ] Git works
[ ] Ollama works
[ ] OmniRouter works
[ ] Model discovery works
[ ] Chat streams
[ ] Chat cancels
[ ] Context retrieval works
[ ] AI edits generate valid diffs
[ ] Multi-file edits are reviewable
[ ] Agent permissions work
[ ] Agent can run tests
[ ] Agent handles failures
[ ] Checkpoints work
[ ] Restore works
[ ] Secrets are protected
[ ] Cloud mode is visible
[ ] No credentials are shipped
[ ] Unit tests pass
[ ] Integration tests pass
[ ] E2E tests pass
[ ] Installers build
[ ] Documentation is complete
```

---

# 99. Recommended Initial Repository State

After the first implementation phase:

```text
namo-coder/
├── apps/
│   └── desktop/
├── packages/
│   ├── ai-core/
│   ├── code-intelligence/
│   ├── database/
│   ├── shared/
│   ├── terminal/
│   └── workspace/
├── tests/
├── docs/
├── .github/workflows/
├── package.json
├── pnpm-workspace.yaml
├── tsconfig.json
├── README.md
└── LICENSE
```

---

# 100. Final End-to-End System Flow

```text
                         DEVELOPER
                             |
                             v
                       NAMO CODER UI
                             |
       +---------------------+----------------------+
       |                     |                      |
       v                     v                      v
    Monaco                Explorer               Terminal
       |                     |                      |
       +---------------------+----------------------+
                             |
                             v
                         Workspace
                             |
                  +----------+----------+
                  |                     |
                  v                     v
                 Git                Code Index
                                        |
                            +-----------+-----------+
                            |           |           |
                         Symbols      Search    Embeddings
                            |           |           |
                            +-----------+-----------+
                                        |
                                        v
                                  Context Engine
                                        |
                                        v
                                   Model Router
                                    /         \
                                   /           \
                                  v             v
                              Ollama        OmniRouter
                                |               |
                                v               v
                           Local Model      Hosted Model
                                \               /
                                 \             /
                                  v           v
                                     Agent
                                       |
                                 Tool Registry
                                       |
                                Permission Layer
                                       |
                     +-----------------+----------------+
                     |                 |                |
                     v                 v                v
                   Files              Git            Terminal
                     |                 |                |
                     +-----------------+----------------+
                                       |
                                       v
                                      Diff
                                       |
                                  User Review
                                       |
                                       v
                                  Verification
                                       |
                              +--------+--------+
                              |                 |
                             PASS              FAIL
                              |                 |
                              v                 v
                            Done            Diagnose
                                                |
                                                v
                                             Fix
                                                |
                                                +----> Verify
```

---

# 101. Final Engineering Philosophy

Namo Coder should not be built as:

```text
Electron
+
ChatGPT-style chat panel
```

That would be too shallow.

It should be built as:

```text
Professional IDE
+
Repository intelligence
+
Provider-independent AI platform
+
Controlled agent runtime
+
Security boundary
+
Diff system
+
Verification loop
+
Recovery system
```

The model is replaceable.

The Namo engineering platform is the product.

---

# 102. Final Build Sequence

The complete journey is:

```text
EMPTY REPOSITORY
      ↓
MONOREPO
      ↓
ELECTRON
      ↓
REACT
      ↓
MONACO
      ↓
FILESYSTEM
      ↓
TERMINAL
      ↓
GIT
      ↓
SQLITE
      ↓
AI PROVIDER INTERFACE
      ↓
OLLAMA
      ↓
OMNIROUTER
      ↓
CHAT
      ↓
CONTEXT ENGINE
      ↓
CODE INDEX
      ↓
AI EDITS
      ↓
MONACO DIFF
      ↓
AGENT
      ↓
TOOLS
      ↓
PERMISSIONS
      ↓
TEST LOOP
      ↓
CHECKPOINTS
      ↓
SECURITY HARDENING
      ↓
AUTOMATED TESTS
      ↓
PACKAGING
      ↓
GITHUB ACTIONS
      ↓
GITHUB RELEASE
      ↓
PUBLIC BETA
```

---

# 103. The Namo Coder MVP Contract

At the end of the first serious implementation, a developer should be able to truthfully say:

> "I can open my repository in Namo Coder, edit it, use the terminal and Git, ask a local Ollama model or an OmniRouter model questions about my code, have the AI propose changes, review those changes as diffs, allow an agent to work through controlled tools, run tests, recover from failures, and restore a checkpoint if something goes wrong."

If that statement works reliably, Namo Coder has crossed the line from prototype to a credible AI IDE foundation.

---

# 104. Next Engineering Step

Do not start by implementing the autonomous agent.

Start with this exact sequence:

```text
1. Create monorepo
2. Create Electron shell
3. Create React UI
4. Integrate Monaco
5. Implement workspace filesystem
6. Implement terminal
7. Implement Git
8. Add SQLite
9. Define shared TypeScript contracts
10. Define ChatProvider
11. Build FakeChatProvider
12. Build OllamaProvider
13. Build OmniRouterProvider
14. Build chat UI
15. Build context engine
16. Build code index
17. Build structured edits
18. Build diff review
19. Build tool registry
20. Build permission system
21. Build agent loop
22. Build verification loop
23. Build checkpoints
24. Add security tests
25. Add E2E tests
26. Package
27. CI
28. Release
```

This order minimizes architectural rework and keeps every milestone demonstrable.

---

# 105. End State

The final product is:

```text
NAMO CODER
│
├── IDE
│   ├── Monaco
│   ├── Explorer
│   ├── Terminal
│   └── Git
│
├── INTELLIGENCE
│   ├── Parser
│   ├── Symbols
│   ├── Search
│   ├── Embeddings
│   └── Context Engine
│
├── AI
│   ├── Ollama
│   ├── OmniRouter
│   ├── Model Router
│   └── Provider Abstraction
│
├── AGENT
│   ├── Planner
│   ├── Tools
│   ├── Permissions
│   ├── Verification
│   └── Recovery
│
├── SAFETY
│   ├── Secret Detection
│   ├── Path Validation
│   ├── Command Policy
│   ├── Cloud Policy
│   └── Checkpoints
│
└── DELIVERY
    ├── Tests
    ├── Packaging
    ├── GitHub Actions
    └── GitHub Releases
```

**This is the complete implementation blueprint from zero code to a deployable Namo Coder beta.**
