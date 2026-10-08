# Namo Coder — Professional System Architecture & Design
## Principal-Architect-Level System Design

**Document:** Project Architecture  
**Audience:** Founders, principal engineers, senior engineers, security reviewers, DevOps, future contributors  
**Architecture goal:** Build a production-grade desktop AI IDE with local-first AI, optional OmniRouter cloud AI, deterministic code intelligence, secure agent execution, and zero mandatory backend dependency.

---

## 1. Executive Architecture Summary

Namo Coder is a desktop-first AI development environment.

The architecture is deliberately split into five major domains:

1. **Presentation Layer** — editor, explorer, terminal, AI UI, diff UI.
2. **Desktop Runtime Layer** — Electron main process, IPC, OS integration, process execution, secure storage.
3. **AI Platform Layer** — provider abstraction, context engine, model routing, agent orchestration, tool registry, permissions.
4. **Code Intelligence Layer** — parsing, indexing, symbols, lexical search, semantic retrieval, dependency analysis.
5. **Persistence & Workspace Layer** — SQLite, checkpoints, project metadata, Git, filesystem.

The most important architectural principle is:

> **Namo Coder owns the IDE, agent, context, tools, security and orchestration. Model providers are replaceable infrastructure.**

Therefore:

```text
                         NAMO CODER
                              |
        +---------------------+---------------------+
        |                     |                     |
   Presentation         Desktop Runtime       Core Services
        |                     |                     |
        v                     v                     v
   React/Monaco           Electron/IPC       AI + Code Intelligence
                              |                     |
                              +----------+----------+
                                         |
                              +----------+----------+
                              |                     |
                           Local AI              Cloud AI
                              |                     |
                           Ollama               OmniRouter
```

---

# 2. Architectural Principles

## 2.1 Local-first

The application must work without a Namo-operated backend.

Local resources:

```text
Workspace
SQLite
Index
Embeddings
Git
Terminal
Ollama
```

## 2.2 Provider independence

No application component outside `ai-core` should know how OmniRouter or Ollama works.

Bad:

```ts
if (provider === "omnirouter") {
   // API implementation in UI
}
```

Good:

```ts
const model = modelRouter.resolve(task);
await model.chat(request);
```

## 2.3 Secure by default

The AI agent is treated as an untrusted decision-maker.

It cannot directly:

```text
execute arbitrary shell commands
write arbitrary paths
delete arbitrary data
push Git changes
send network requests
```

without passing policy controls.

## 2.4 Human-in-the-loop

AI proposes.

Namo validates.

The user approves sensitive operations.

## 2.5 Deterministic code intelligence

The LLM should not be the only source of truth.

Use:

```text
filesystem
tree-sitter
LSP where useful
Git
symbol index
search
dependency graph
```

to establish reliable context.

## 2.6 Progressive complexity

The system should start with:

```text
Editor -> Chat -> Edit -> Diff
```

and grow into:

```text
Editor -> Context -> Tools -> Agent -> Verification -> Recovery
```

---

# 3. System Context

```text
+--------------------------------------------------------------+
|                         Developer                            |
+-----------------------------+--------------------------------+
                              |
                              v
+--------------------------------------------------------------+
|                         Namo Coder                           |
|                                                              |
| Editor | Explorer | Terminal | Git | Chat | Diff | Agent     |
+-----------------------------+--------------------------------+
                              |
              +---------------+----------------+
              |                                |
              v                                v
       Local machine                     External AI
              |                                |
       +------+-------+                   OmniRouter
       |              |
    Workspace       Ollama
       |
 SQLite / Index / Git
```

External dependencies are optional.

---

# 4. Container Architecture

## 4.1 Electron Renderer

Responsibilities:

- React UI
- Monaco editor
- UI state
- view state
- user interaction
- streaming display

Must not have unrestricted Node.js access.

## 4.2 Electron Main

Responsibilities:

- application lifecycle
- windows
- IPC handlers
- filesystem services
- process execution
- Git integration
- secure credential access
- database access
- AI provider invocation
- background workers

## 4.3 Preload

The preload layer exposes a narrow, typed API.

```text
Renderer
   |
   v
window.namo
   |
   v
Preload
   |
   v
IPC
   |
   v
Main
```

---

# 5. Domain Architecture

```text
apps/desktop
    |
    +-- UI
    +-- IPC
    +-- OS integration

packages/ai-core
    |
    +-- Agent
    +-- Context
    +-- Providers
    +-- Router
    +-- Tools
    +-- Permissions

packages/code-intelligence
    |
    +-- Parser
    +-- Indexer
    +-- Symbols
    +-- Search
    +-- Embeddings

packages/workspace
    |
    +-- Files
    +-- Git
    +-- Checkpoints

packages/database
    |
    +-- SQLite
    +-- Repositories
    +-- Migrations
```

---

# 6. AI Platform Architecture

The AI platform is the most strategically important subsystem.

```text
                    AI Request
                        |
                        v
                Task Classifier
                        |
                        v
                 Model Router
                        |
             +----------+----------+
             |                     |
             v                     v
          Ollama               OmniRouter
             |                     |
             v                     v
       Local model            Cloud model
             |                     |
             +----------+----------+
                        |
                        v
                  AI Response
```

The router should eventually consider:

```text
task type
model capabilities
context size
latency
user policy
cloud permission
estimated cost
local availability
```

---

# 7. Provider Boundary

Define a stable interface.

```ts
interface ModelProvider {
  listModels(): Promise<ModelInfo[]>;

  chat(request: ChatRequest): Promise<ChatResponse>;

  stream(request: ChatRequest): AsyncIterable<ChatChunk>;
}
```

Provider-specific logic stays behind the interface.

```text
AI Core
 |
 +-- OllamaProvider
 |
 +-- OmniRouterProvider
 |
 +-- OpenAICompatibleProvider
```

---

# 8. OmniRouter Boundary

OmniRouter is a cloud gateway, not the application architecture.

```text
Namo AI Core
      |
      v
OmniRouterProvider
      |
      v
OpenAI-compatible API
      |
      v
OmniRouter
      |
      v
Selected upstream model
```

Current documented base URL:

```text
https://omnirouter.li/v1
```

The implementation should query the live model catalog rather than permanently assuming a particular model ID.

---

# 9. Code Intelligence Architecture

LLMs are poor substitutes for deterministic repository analysis.

Namo should build a local intelligence layer:

```text
Files
  |
  v
Watcher
  |
  v
Parser
  |
  +--> AST
  +--> Symbols
  +--> Imports
  +--> Exports
  |
  v
Indexer
  |
  +--> SQLite metadata
  +--> Search index
  +--> Vector index
```

---

# 10. Context Engine

The context engine converts a user request into a bounded, relevant context package.

```text
User request
     |
     v
Intent extraction
     |
     +--> current selection
     +--> current file
     +--> symbols
     +--> lexical search
     +--> semantic search
     +--> dependencies
     +--> project rules
     |
     v
Ranking
     |
     v
Deduplication
     |
     v
Token budget
     |
     v
Prompt context
```

This is more important than simply sending more files.

---

# 11. Agent Architecture

The agent is a controlled state machine.

```text
                     +------------+
                     | User Task  |
                     +-----+------+
                           |
                           v
                    +------+------+
                    |   Planner   |
                    +------+------+
                           |
                           v
                    +------+------+
                    | Model Call  |
                    +------+------+
                           |
                    Tool requested?
                       /       \
                     yes        no
                     |           |
                     v           v
               Permission      Done
                     |
                approved?
                  /     \
                yes      no
                |         |
                v         v
              Tool      Stop/ask
                |
                v
             Result
                |
                +------> Model
```

---

# 12. Tool Architecture

Every tool has:

```ts
type ToolDefinition = {
  name: string;
  description: string;
  risk: ToolRisk;
  inputSchema: unknown;
  execute: (input: unknown) => Promise<unknown>;
};
```

Core tools:

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

Future tools:

```text
create_branch
apply_patch
inspect_logs
query_database
browser
MCP tools
```

---

# 13. Permission Architecture

```text
                    Tool Call
                       |
                       v
               Permission Policy
                       |
        +--------------+--------------+
        |              |              |
        v              v              v
       Allow          Ask            Deny
        |              |              |
        v              v              v
     Execute        User UI         Block
```

Risk levels:

```text
READ
WRITE
EXECUTE
DESTRUCTIVE
NETWORK
GIT_WRITE
```

Recommended defaults:

```text
read             allow
search           allow
tests            allow
write            ask/review
delete            ask
shell            ask
git commit       ask
git push         always ask
destructive      deny/ask
network          ask
```

---

# 14. Diff Architecture

AI never directly overwrites important files.

Instead:

```text
Model output
   |
   v
Patch validator
   |
   v
Diff generator
   |
   v
Monaco Diff
   |
   v
User decision
   |
   +--> accept
   |
   +--> reject
```

This provides auditability and recoverability.

---

# 15. Checkpoint Architecture

Before major changes:

```text
Workspace
   |
   v
Checkpoint
   |
   v
Agent edits
   |
   v
Tests
   |
   v
Review
```

The first implementation may use Git-backed checkpoints.

A future implementation can use internal patch snapshots.

---

# 16. Data Architecture

SQLite stores local metadata.

Core entities:

```text
Project
Workspace
File
Symbol
Embedding
Conversation
Message
AgentRun
ToolCall
Checkpoint
Setting
```

Relationships:

```text
Project
  |
  +-- Workspace
       |
       +-- Files
       +-- Symbols
       +-- Embeddings
       +-- Conversations
       +-- AgentRuns
       +-- Checkpoints
```

---

# 17. Data Ownership

Namo Coder should follow this rule:

```text
Source code        -> user's filesystem
Git state          -> user's repository
Local metadata     -> SQLite
Local index        -> local storage
Local model        -> Ollama
Cloud inference    -> OmniRouter when explicitly enabled
```

No source code needs to be uploaded to a Namo backend for the base product.

---

# 18. Security Architecture

Security boundaries:

```text
Renderer
   |
IPC boundary
   |
Main process
   |
+-- filesystem boundary
+-- terminal boundary
+-- credential boundary
+-- network boundary
+-- database boundary
```

Electron security:

```text
contextIsolation = true
nodeIntegration = false
```

The exact sandbox configuration should be validated against the native modules used.

---

# 19. Cloud Privacy Boundary

When using local AI:

```text
Project -> Ollama -> Project
```

When using OmniRouter:

```text
Project context
      |
      v
Secret scanning
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

The UI must clearly communicate that cloud inference is active.

---

# 20. Secret Protection

Before cloud transmission:

```text
Context
  |
  v
Secret detector
  |
  +--> safe
  +--> redact
  +--> ask user
```

Candidate secrets:

```text
API keys
tokens
private keys
passwords
.env values
database URLs
cloud credentials
```

No secret detector is perfect; therefore users need explicit cloud controls.

---

# 21. Process Architecture

Separate:

```text
Renderer processes
AI requests
Indexing
terminal processes
Git operations
database operations
```

Long-running work should not freeze the UI.

Use:

```text
async operations
workers
queues
streaming
cancellation
```

---

# 22. Event Architecture

Use typed application events.

Examples:

```text
workspace.opened
file.changed
index.updated
ai.request.started
ai.chunk.received
ai.request.completed
agent.step.started
agent.tool.requested
agent.tool.completed
agent.failed
checkpoint.created
```

Events allow UI components to remain decoupled from services.

---

# 23. Observability

Local logs should record:

```text
timestamp
component
event
duration
status
provider
model
agent step
tool
```

Never log:

```text
API keys
passwords
private keys
raw credentials
```

Cloud provider request IDs should be retained where useful for troubleshooting.

---

# 24. Failure Architecture

Every external operation must have a failure path.

```text
AI unavailable
   |
   +--> retry
   +--> switch provider
   +--> local fallback
   +--> show error

Ollama unavailable
   |
   +--> setup guidance
   +--> OmniRouter option

OmniRouter unavailable
   |
   +--> retry
   +--> switch to Ollama
```

Agent failure:

```text
tool failed
   |
   v
return structured error
   |
   v
agent decides whether to retry
```

---

# 25. Cancellation

Cancellation is a first-class feature.

The user must be able to cancel:

```text
AI generation
agent loop
terminal command
indexing
Git operation where safely possible
```

The UI should immediately reflect:

```text
Cancelling...
Cancelled
```

---

# 26. Scalability Strategy

Namo Coder is desktop-first, so horizontal server scaling is not initially required.

Scale locally through:

```text
incremental indexing
content hashing
background workers
bounded caches
lazy loading
streaming
token budgeting
```

This avoids building unnecessary cloud infrastructure.

---

# 27. Future Cloud Architecture

Only introduce a Namo backend if a real product requirement appears.

Potential future services:

```text
Namo Account Service
Namo Sync
Team Workspace
Remote Index
Usage Analytics
Enterprise Policy
License Service
```

These should remain optional to the core IDE.

---

# 28. Architectural Decisions

## ADR-001 — Electron

Reason:

- cross-platform desktop
- native filesystem/process integration
- mature ecosystem

## ADR-002 — React

Reason:

- mature UI ecosystem
- component model
- strong TypeScript support

## ADR-003 — Monaco

Reason:

- editor experience close to modern developer tooling
- diff support
- language tooling ecosystem

## ADR-004 — SQLite

Reason:

- embedded
- reliable
- no server dependency

## ADR-005 — Ollama

Reason:

- local model execution
- user-controlled inference
- offline path

## ADR-006 — OmniRouter

Reason:

- hosted model gateway
- OpenAI-compatible integration
- multiple model options behind one provider boundary

## ADR-007 — Provider abstraction

Reason:

- prevents vendor lock-in
- simplifies testing
- allows future providers

---

# 29. Target Production Architecture

```text
+----------------------------------------------------------------+
|                         NAMO CODER                             |
|                                                                |
| +----------------+ +----------------+ +---------------------+ |
| | React UI       | | Monaco         | | Terminal / Git      | |
| +--------+-------+ +-------+--------+ +----------+----------+ |
|          |                 |                       |            |
|          +-----------------+-----------------------+            |
|                            |                                    |
|                       Typed IPC                                |
|                            |                                    |
| +--------------------------v--------------------------------+ |
| |                    Electron Main                          | |
| |                                                            | |
| | Workspace | DB | Process | Security | AI | Index          | |
| +--------------------------+--------------------------------+ |
|                            |                                  |
|              +-------------+-------------+                    |
|              |                           |                    |
|       +------v-------+             +-----v------+             |
|       | AI Core      |             | Intelligence|             |
|       | Agent        |             | Parser      |             |
|       | Context      |             | Indexer     |             |
|       | Router       |             | Search      |             |
|       | Tools        |             | Embeddings  |             |
|       +------+-------+             +-----+------+             |
|              |                           |                    |
|       +------+-------+                   |                    |
|       |              |                   |                    |
|       v              v                   v                    |
|    Ollama        OmniRouter           SQLite                  |
|       |              |                   |                    |
|    Local AI      Cloud AI          Local metadata             |
+----------------------------------------------------------------+
```

---

# 30. Principal-Architect Review Checklist

Before every major release, review:

### Architecture
- Are boundaries still clear?
- Is provider-specific logic isolated?
- Is the renderer trusted too much?
- Can a failed subsystem take down the editor?

### Security
- Can an agent escape the workspace?
- Can it execute a dangerous command without approval?
- Can secrets reach cloud providers unexpectedly?
- Are credentials stored securely?

### Reliability
- Can requests be cancelled?
- Can state be recovered?
- Are partial edits safe?
- Does the application remain usable when AI is offline?

### Product
- Is local mode still first-class?
- Is cloud usage explicit?
- Are costs understandable?
- Can a user recover from an AI mistake?

### Operations
- Can CI build without paid AI?
- Can a fresh machine install the app?
- Can releases be reproduced?
- Are logs useful without exposing secrets?

---

# 31. Final Architectural Position

Namo Coder should be thought of as:

> **A secure local developer operating system with AI orchestration, not simply a chat interface attached to an editor.**

The editor is only the visible layer.

The defensible engineering assets are:

```text
Context Engine
+
Code Intelligence
+
Agent Runtime
+
Permission System
+
Diff/Checkpoint System
+
Provider Abstraction
+
Local-first Architecture
```

That architecture allows Namo Coder to remain useful even when a particular AI provider changes, becomes unavailable, changes pricing, or is replaced.
