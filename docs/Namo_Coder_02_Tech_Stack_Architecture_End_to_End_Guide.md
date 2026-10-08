# Namo Coder — Technology Stack Architecture & End-to-End Implementation Guide
## Production Build Plan from Empty Repository to Deployable Application

**Document:** Technology Stack + Implementation Guide  
**Primary AI:** Ollama + optional OmniRouter  
**Application model:** Desktop-first, local-first, provider-independent

---

# 1. Technology Stack at a Glance

| Layer | Technology | Purpose |
|---|---|---|
| Desktop runtime | Electron | Native desktop shell |
| UI | React + TypeScript | Application interface |
| Build | Vite | Fast renderer build |
| Editor | Monaco Editor | Code editing + diff |
| Styling | Tailwind CSS | UI styling |
| Components | Radix UI | Accessible primitives |
| State | Zustand | Client state |
| Terminal | xterm.js + PTY | Integrated terminal |
| Package manager | pnpm | Monorepo dependency management |
| Database | SQLite | Local persistence |
| ORM/query layer | Drizzle or typed SQL | Database access |
| Parsing | tree-sitter | AST/symbol extraction |
| Search | SQLite FTS / local index | Lexical search |
| Vector index | LanceDB or equivalent local vector store | Semantic search |
| File watcher | chokidar | Incremental indexing |
| Git | Git CLI | Version control |
| Local AI | Ollama | Free/local inference |
| Cloud AI | OmniRouter | Hosted model gateway |
| AI protocol | OpenAI-compatible HTTP | Cloud provider integration |
| Tests | Vitest | Unit/integration |
| E2E | Playwright | End-to-end |
| Packaging | electron-builder | Installers |
| CI/CD | GitHub Actions | Build/test/release |
| Hosting | GitHub Releases + static site | Free distribution |

---

# 2. Repository Layout

```text
namo-coder/
├── apps/
│   └── desktop/
│       ├── src/
│       │   ├── main/
│       │   ├── preload/
│       │   └── renderer/
│       └── package.json
│
├── packages/
│   ├── ai-core/
│   ├── code-intelligence/
│   ├── workspace/
│   ├── terminal/
│   ├── database/
│   ├── shared/
│   └── ui/
│
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
│
├── scripts/
├── docs/
├── website/
├── .github/workflows/
├── package.json
├── pnpm-workspace.yaml
├── tsconfig.json
└── README.md
```

---

# 3. Bootstrap

Install Node.js LTS, pnpm, Git and Ollama.

Verify:

```bash
node --version
pnpm --version
git --version
ollama --version
```

Initialize:

```bash
mkdir namo-coder
cd namo-coder
git init
pnpm init
```

Workspace:

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

---

# 4. Desktop Application

The desktop package contains:

```text
apps/desktop/
├── src/
│   ├── main/
│   │   ├── index.ts
│   │   ├── window.ts
│   │   ├── ipc/
│   │   ├── services/
│   │   └── security/
│   ├── preload/
│   │   └── index.ts
│   └── renderer/
│       ├── App.tsx
│       ├── components/
│       ├── editor/
│       ├── explorer/
│       ├── terminal/
│       ├── chat/
│       ├── diff/
│       ├── settings/
│       └── stores/
```

---

# 5. Electron Security Configuration

Use:

```text
contextIsolation: true
nodeIntegration: false
```

Expose only explicit APIs through preload.

Example:

```ts
window.namo.files.read(path)
window.namo.files.write(path, content)
window.namo.ai.chat(request)
window.namo.terminal.run(request)
```

Never expose:

```ts
window.require
window.fs
window.childProcess
```

directly to the renderer.

---

# 6. React Application

Recommended renderer structure:

```text
renderer/
├── components/
│   ├── layout/
│   ├── buttons/
│   ├── dialogs/
│   └── status/
├── editor/
├── explorer/
├── chat/
├── terminal/
├── diff/
├── settings/
├── panels/
├── hooks/
├── stores/
└── App.tsx
```

Global state:

```text
workspace
editor
tabs
terminal
AI
agent
settings
notifications
```

Zustand is suitable for the client state layer.

---

# 7. Monaco Integration

Required features:

```text
open document
save document
language detection
selection
cursor position
diagnostics
diff editor
```

Document model:

```ts
type DocumentState = {
  path: string;
  language: string;
  content: string;
  dirty: boolean;
};
```

---

# 8. Explorer

Implement:

```text
open workspace
list directory
expand directory
open file
create file
create folder
rename
delete
refresh
```

Protect path boundaries.

A workspace path is the security root for workspace-scoped tools.

---

# 9. Terminal

Recommended architecture:

```text
React terminal
     |
     v
Preload
     |
     v
IPC
     |
     v
Main process
     |
     v
PTY/process
```

The terminal must support:

```text
stdin
stdout
stderr
resize
exit code
kill
```

Agent shell execution must go through a separate permission-controlled API.

---

# 10. Git Integration

Initially use the Git CLI.

Required commands:

```text
git status
git diff
git branch
git log
git show
git add
git restore
git commit
```

Later:

```text
branch creation
stash
merge
rebase
push/pull
```

Git push must require explicit user approval.

---

# 11. Database

Use SQLite.

Recommended package:

```text
better-sqlite3
```

or another maintained SQLite implementation compatible with Electron.

Schema:

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

Use migrations.

Never change production schemas without a migration.

---

# 12. AI Core Package

```text
packages/ai-core/src/
├── agent/
├── context/
├── models/
├── providers/
│   ├── ollama/
│   ├── omnirouter/
│   └── openai-compatible/
├── router/
├── tools/
├── permissions/
└── prompts/
```

---

# 13. Provider Interface

```ts
export interface ChatProvider {
  listModels(): Promise<ModelInfo[]>;

  chat(
    request: ChatRequest
  ): Promise<ChatResponse>;

  stream(
    request: ChatRequest
  ): AsyncIterable<ChatChunk>;
}
```

Model:

```ts
type ModelInfo = {
  id: string;
  provider: string;
  contextWindow?: number;
  supportsTools?: boolean;
  supportsStreaming?: boolean;
  supportsVision?: boolean;
};
```

---

# 14. Ollama Provider

Responsibilities:

```text
detect Ollama
list installed models
chat
stream
health check
```

The application should allow the user to select whichever compatible model is installed.

Do not assume a particular model exists.

---

# 15. OmniRouter Provider

Use its OpenAI-compatible endpoint.

Current documented base URL:

```text
https://omnirouter.li/v1
```

Implementation:

```ts
const client = new OpenAI({
  baseURL: "https://omnirouter.li/v1",
  apiKey
});
```

Then:

```ts
client.chat.completions.create({
  model,
  messages,
  stream: true
});
```

The exact API/client behavior should always be validated against the current OmniRouter documentation.

---

# 16. OmniRouter Model Discovery

Do not hard-code model lists.

Use:

```text
GET /v1/models
```

Then map:

```text
id
capabilities
context size if available
```

into Namo's internal `ModelInfo`.

The user sees:

```text
Provider: OmniRouter
Model:
  [live catalog]
```

---

# 17. API Key Handling

Flow:

```text
Settings UI
    |
    v
Preload
    |
    v
Secure credential storage
    |
    v
Main process
    |
    v
OmniRouter provider
```

Do not store API keys in:

```text
React state persisted to disk
plain JSON config
Git
logs
environment files shipped to users
```

Use OS credential storage where practical.

---

# 18. AI Settings

```text
Provider
  ○ Ollama
  ○ OmniRouter
  ○ Custom OpenAI-compatible

Model
  [dynamic list]

API key
  [secure field]

Cloud confirmation
  [ON]

Max agent steps
  [30]

Context
  [Automatic]
```

---

# 19. Model Router

Initial:

```text
user-selected provider
       |
       v
model router
       |
       v
provider
```

Future:

```text
task
 |
 +--> local/simple
 |
 +--> cloud/complex
 |
 +--> vision
 |
 +--> tool-capable
```

Selection should respect user privacy settings and cloud permission.

---

# 20. Code Intelligence Package

```text
packages/code-intelligence/src/
├── parser/
├── indexer/
├── symbols/
├── search/
├── embeddings/
└── watcher/
```

---

# 21. File Indexing

Watch:

```text
create
modify
delete
rename
```

Ignore:

```text
.git
node_modules
dist
build
coverage
binary files
large generated files
```

Support:

```text
.namoignore
```

Use content hashes to avoid unnecessary work.

---

# 22. Tree-sitter

Extract:

```text
function
class
method
variable
interface
type
import
export
```

Store:

```text
path
symbol
type
start line
end line
signature
language
```

---

# 23. Search

Use multiple retrieval methods:

```text
exact search
regex search
symbol search
filename search
semantic search
dependency search
```

Search result:

```ts
type SearchResult = {
  path: string;
  startLine: number;
  endLine: number;
  score: number;
  content: string;
};
```

---

# 24. Embeddings

Default architecture:

```text
source code
    |
    v
local embedding model
    |
    v
local vector store
```

Cloud embeddings should be opt-in only.

Do not assume OmniRouter supports every embedding workflow just because it provides OpenAI-compatible chat APIs; verify the live catalog/API before implementation.

---

# 25. Context Engine

Inputs:

```text
query
current file
selection
open tabs
symbols
search results
dependencies
project rules
Git state
```

Output:

```text
bounded context package
```

Pipeline:

```text
retrieve
  ↓
rank
  ↓
deduplicate
  ↓
truncate
  ↓
format
```

---

# 26. AI Chat

MVP context:

```text
current file
selection
user prompt
conversation
```

Then expand:

```text
repository retrieval
symbols
semantic search
rules
Git diff
```

Stream responses to the UI.

---

# 27. Structured Editing

Do not ask the model for arbitrary prose when an edit is required.

Use a structured edit protocol.

```json
{
  "file": "src/example.ts",
  "edits": [
    {
      "startLine": 10,
      "endLine": 20,
      "replacement": "..."
    }
  ]
}
```

Validate edits before applying them.

---

# 28. Diff

Workflow:

```text
AI
 ↓
proposed patch
 ↓
validate
 ↓
Monaco Diff
 ↓
user review
 ↓
apply/reject
```

Never silently overwrite many files.

---

# 29. Agent Runtime

Agent state:

```ts
type AgentState = {
  runId: string;
  status: "running" | "waiting" | "completed" | "failed" | "cancelled";
  steps: number;
  toolCalls: number;
};
```

Loop:

```text
request
 ↓
context
 ↓
model
 ↓
tool call?
 ↓
permission
 ↓
tool
 ↓
result
 ↓
model
```

---

# 30. Tool Registry

Tools:

```text
list_files
read_file
search_code
search_symbols
read_rules
write_file
edit_file
git_diff
run_tests
run_command
```

Each tool must have:

```text
name
description
schema
risk
executor
```

---

# 31. Permissions

Example:

```text
read_file       AUTO
search_code     AUTO
run_tests       AUTO
write_file      REVIEW
delete_file     ASK
run_command     ASK
git_commit      ASK
git_push        ALWAYS ASK
```

Users should be able to configure policies.

---

# 32. Agent Limits

Implement:

```text
max steps
max tool calls
timeout
max output
max context
cancellation
loop detection
```

Initial values can be conservative.

---

# 33. Project Rules

Support:

```text
.namo/rules.md
```

Rules are injected into the agent context.

Examples:

```text
Use TypeScript.
Do not modify generated files.
Run tests after changes.
Do not use any.
Do not change public APIs without asking.
```

---

# 34. Checkpoints

Before multi-file changes:

```text
create checkpoint
run agent
review diff
test
accept
```

Allow restoration.

---

# 35. Testing Stack

## Unit

Vitest.

Test:

```text
providers
router
context
permissions
tools
diffs
database
path validation
secret redaction
```

## Integration

Test:

```text
workspace + index + fake provider + agent
```

## E2E

Playwright.

Test:

```text
launch
open project
edit
save
chat
AI edit
diff
terminal
agent
checkpoint
```

---

# 36. Fake Provider

CI must not depend on:

```text
Ollama
OmniRouter
paid credits
```

Create:

```text
FakeChatProvider
```

with deterministic outputs.

This makes agent tests repeatable.

---

# 37. Build Scripts

Root:

```json
{
  "scripts": {
    "dev": "pnpm --filter @namo/desktop dev",
    "build": "pnpm -r build",
    "typecheck": "pnpm -r typecheck",
    "lint": "pnpm -r lint",
    "test": "pnpm -r test",
    "test:e2e": "pnpm --filter @namo/desktop test:e2e",
    "check": "pnpm typecheck && pnpm lint && pnpm test"
  }
}
```

---

# 38. Local Development

```bash
pnpm install
pnpm dev
```

Validation:

```bash
pnpm typecheck
pnpm lint
pnpm test
```

Build:

```bash
pnpm build
```

---

# 39. OmniRouter Manual Test

Before Namo integration:

```text
1. Create OmniRouter account.
2. Create API key.
3. Add prepaid credit if required.
4. Query model catalog.
5. Send a tiny chat request.
6. Test streaming.
7. Test tool-capable model if required.
```

Do not assume all models expose identical capabilities.

---

# 40. Ollama Manual Test

```text
1. Install Ollama.
2. Install a compatible coding model.
3. Verify the model is listed.
4. Send a short prompt.
5. Verify streaming.
```

Namo should provide setup guidance when Ollama is missing.

---

# 41. Packaging

Use electron-builder.

Targets:

```text
Windows -> NSIS
Linux   -> AppImage
macOS   -> DMG
```

Do not package large AI model files.

---

# 42. CI

GitHub Actions:

```text
checkout
 ↓
setup Node
 ↓
setup pnpm
 ↓
install frozen lockfile
 ↓
typecheck
 ↓
lint
 ↓
unit tests
 ↓
build
```

No cloud AI credentials should be required.

---

# 43. Release Pipeline

```text
git tag v0.1.0
       ↓
GitHub Actions
       ↓
tests
       ↓
build
       ↓
package
       ↓
GitHub Release
```

Artifacts:

```text
Windows installer
Linux AppImage
macOS DMG
```

---

# 44. Website

Use a static website.

Pages:

```text
Home
Download
Documentation
Privacy
Security
FAQ
```

Host using free static hosting.

Link desktop binaries to GitHub Releases.

---

# 45. Production Secrets

CI secrets may include:

```text
code-signing certificates
notarization credentials
release tokens
```

Never include:

```text
OmniRouter user's API key
```

in builds.

Users supply their own key.

---

# 46. Deployment Model

The core product can operate without a Namo backend:

```text
User
 |
 v
Namo Coder
 |
 +--> SQLite
 +--> Git
 +--> Ollama
 +--> optional OmniRouter
```

This minimizes operating cost.

---

# 47. Code Signing

For serious public distribution:

```text
Windows signing
macOS signing + notarization
```

Treat signing as a release infrastructure problem.

Keep certificates in CI secrets.

---

# 48. Release Channels

Use:

```text
nightly
beta
stable
```

Suggested Git tags:

```text
v0.1.0-beta.1
v0.1.0
v0.2.0
```

---

# 49. Implementation Milestones

## Milestone 1
Desktop shell.

## Milestone 2
Editor and filesystem.

## Milestone 3
Terminal and Git.

## Milestone 4
SQLite/settings.

## Milestone 5
AI provider abstraction.

## Milestone 6
Ollama.

## Milestone 7
OmniRouter.

## Milestone 8
Chat/context.

## Milestone 9
AI edits/diff.

## Milestone 10
Indexer/search.

## Milestone 11
Agent/tools.

## Milestone 12
Permissions/checkpoints.

## Milestone 13
Testing.

## Milestone 14
Packaging.

## Milestone 15
CI/CD.

## Milestone 16
Public beta.

---

# 50. End-to-End Developer Flow

```text
Clone repository
      ↓
pnpm install
      ↓
pnpm dev
      ↓
Build IDE shell
      ↓
Add filesystem
      ↓
Add Monaco
      ↓
Add terminal
      ↓
Add Git
      ↓
Add SQLite
      ↓
Add AI abstraction
      ↓
Add Ollama
      ↓
Add OmniRouter
      ↓
Add chat
      ↓
Add context
      ↓
Add diff
      ↓
Add code index
      ↓
Add agent
      ↓
Add permissions
      ↓
Add checkpoints
      ↓
Add tests
      ↓
Package
      ↓
CI
      ↓
GitHub Release
```

---

# 51. Production Readiness Checklist

```text
[ ] Fresh clone builds
[ ] Lockfile reproducible
[ ] Typecheck passes
[ ] Lint passes
[ ] Unit tests pass
[ ] Integration tests pass
[ ] E2E tests pass
[ ] Windows build tested
[ ] Linux build tested
[ ] macOS build tested where available
[ ] Ollama tested
[ ] OmniRouter tested
[ ] Dynamic models tested
[ ] Invalid API key handled
[ ] Insufficient cloud credit handled
[ ] Agent cancellation tested
[ ] Dangerous command approval tested
[ ] Secret redaction tested
[ ] Cloud privacy warning tested
[ ] No credentials committed
[ ] Release artifacts generated
[ ] Documentation complete
```

---

# 52. Recommended First Production Defaults

```text
AI provider:
Ollama

Cloud:
off until configured

Cloud confirmation:
on

Agent:
permission prompts on

Max agent steps:
30

Index:
local

Embeddings:
local

Git push:
always ask

Destructive tools:
blocked or ask
```

---

# 53. Definition of Done

The application is ready for beta when a new user can:

```text
install Namo Coder
      ↓
open a repository
      ↓
edit code
      ↓
run commands
      ↓
use local AI
      ↓
optionally configure OmniRouter
      ↓
ask questions
      ↓
generate edits
      ↓
review diffs
      ↓
run tests
      ↓
let the agent fix a problem
      ↓
approve/reject actions
      ↓
recover with checkpoint
```

That is the minimum credible end-to-end AI IDE.
