# Namo Coder — Problem Statement, Solution & End-to-End Product Flow
## Product Definition and Operational Flow

---

# 1. Executive Problem Statement

Modern software development requires developers to continuously switch between:

```text
code editor
file explorer
terminal
Git
documentation
search
AI chat
debugger
tests
browser
```

AI coding assistants improve productivity, but many existing workflows still separate the AI from the actual development environment.

The result is a fragmented loop:

```text
Developer
   ↓
asks AI
   ↓
copies code
   ↓
opens files
   ↓
edits
   ↓
runs tests
   ↓
copies errors back to AI
   ↓
repeats
```

This creates several problems:

1. AI lacks reliable project context.
2. Developers manually move information between tools.
3. AI-generated changes can be difficult to review.
4. Autonomous agents can perform risky actions.
5. Cloud AI creates privacy and cost concerns.
6. Local AI can be difficult to configure.
7. Different model providers create integration complexity.
8. Large repositories exceed naive context windows.
9. AI often proposes code without verifying it.
10. Developers need a recovery path when AI makes mistakes.

Namo Coder solves this by making the AI a controlled part of the development environment rather than an external chat box.

---

# 2. Core Product Vision

> **Namo Coder is a local-first AI development environment where the editor, code intelligence, AI models, agents, terminal, Git and verification system operate as one controlled workflow.**

The product has two AI choices:

```text
Local AI
   |
 Ollama
   |
No hosted inference dependency

Cloud AI
   |
OmniRouter
   |
Hosted model access
```

The IDE remains functional without either provider.

---

# 3. Target User

Primary:

```text
software developers
students
indie hackers
startup engineers
open-source contributors
technical founders
```

Secondary:

```text
coding educators
development teams
power users
AI-assisted developers
```

---

# 4. Main User Problems

## Problem 1 — Fragmented workflow

Developers jump between:

```text
IDE
AI chat
terminal
browser
Git
documentation
```

### Solution

Integrate:

```text
editor
AI
terminal
Git
search
agent
testing
```

into one workspace.

---

# 5. Problem 2 — Poor project context

A generic chatbot may only see:

```text
one pasted file
```

while the actual task depends on:

```text
10 files
imports
interfaces
database schema
tests
configuration
Git state
project conventions
```

### Solution

Build a context engine:

```text
Question
  ↓
current file
  ↓
symbols
  ↓
search
  ↓
dependencies
  ↓
semantic retrieval
  ↓
project rules
  ↓
bounded context
  ↓
model
```

---

# 6. Problem 3 — AI changes are risky

An AI can generate a correct-looking change that breaks:

```text
API behavior
tests
security
types
other files
```

### Solution

Use:

```text
AI proposal
 ↓
structured edit
 ↓
diff
 ↓
human review
 ↓
apply
 ↓
test
```

Never hide important changes.

---

# 7. Problem 4 — Agent safety

An autonomous agent can potentially:

```text
delete files
run commands
install packages
change Git state
access secrets
send network requests
```

### Solution

Create a permission system.

```text
Agent
  ↓
Tool request
  ↓
Risk evaluation
  ↓
Allow / Ask / Deny
  ↓
Execute
```

---

# 8. Problem 5 — Cloud privacy

Developers may not want source code sent to a hosted model.

### Solution

Local-first mode:

```text
Project
 ↓
Namo Coder
 ↓
Ollama
 ↓
Local model
```

No cloud inference is required.

When OmniRouter is enabled, Namo explicitly indicates that selected context is being sent through the cloud path.

---

# 9. Problem 6 — Cloud cost

Developers may accidentally generate large agent workloads.

### Solution

Cloud controls:

```text
model selection
max context
max output
max agent steps
tool-call limits
cloud confirmation
optional spending guardrails
```

Ollama remains the zero-hosted-inference-cost path.

---

# 10. Problem 7 — Local AI hardware

Not every machine can run a strong local model.

### Solution

Optional OmniRouter path:

```text
Weak local hardware
       ↓
OmniRouter
       ↓
Hosted model
```

The application does not need a second architecture for cloud AI.

---

# 11. Problem 8 — Vendor lock-in

Hard-coding one AI vendor makes the application fragile.

### Solution

Provider abstraction:

```text
ModelProvider
   |
   +-- Ollama
   +-- OmniRouter
   +-- OpenAI-compatible
   +-- Future providers
```

The agent uses the interface, not the provider.

---

# 12. Problem 9 — Large repositories

A repository may contain:

```text
1000s of files
millions of lines
generated code
dependencies
tests
configuration
```

Sending everything to a model is:

```text
slow
expensive
inaccurate
```

### Solution

Local code intelligence:

```text
filesystem
 ↓
tree-sitter
 ↓
symbols
 ↓
search
 ↓
embeddings
 ↓
ranking
 ↓
relevant context
```

---

# 13. Problem 10 — AI does not verify enough

Generating code is not the same as proving it works.

### Solution

The agent should have a verification loop:

```text
Plan
 ↓
Edit
 ↓
Test
 ↓
Read failure
 ↓
Diagnose
 ↓
Fix
 ↓
Test again
```

The task should not be considered complete merely because the model says it is complete.

---

# 14. Problem 11 — Mistakes need recovery

AI can make a bad multi-file change.

### Solution

Checkpoint before significant work.

```text
checkpoint
 ↓
AI changes
 ↓
tests
 ↓
review
```

If necessary:

```text
restore checkpoint
```

---

# 15. Product Solution

Namo Coder combines six systems:

```text
1. Professional IDE
2. Code intelligence
3. AI provider layer
4. Agent runtime
5. Security/permission layer
6. Verification/recovery system
```

Together:

```text
                 NAMO CODER
                      |
       +--------------+--------------+
       |              |              |
      IDE        Intelligence       AI
       |              |              |
    Monaco         Index          Ollama
    Terminal       Search        OmniRouter
    Git            Symbols
       |              |
       +--------------+--------------+
                      |
                    Agent
                      |
              Permissions
                      |
                 Verification
                      |
                 Checkpoint
```

---

# 16. End-to-End User Flow

## Step 1 — Install

User installs Namo Coder.

```text
Namo Coder
```

No AI provider is mandatory.

---

# 17. Step 2 — First Launch

Welcome screen:

```text
Welcome to Namo Coder

Choose AI:

[ Local AI ]
[ OmniRouter ]
[ Skip ]
```

Local AI is the privacy-first path.

---

# 18. Step 3 — Local Setup

If user selects Ollama:

```text
Detect Ollama
   ↓
Find installed models
   ↓
Choose model
   ↓
Test
   ↓
Ready
```

---

# 19. Step 4 — OmniRouter Setup

If user selects OmniRouter:

```text
Enter API key
   ↓
Store securely
   ↓
Fetch model catalog
   ↓
Choose model
   ↓
Small connection test
   ↓
Ready
```

The current OmniRouter integration uses an OpenAI-compatible endpoint, currently documented as:

```text
https://omnirouter.li/v1
```

The live catalog should determine model IDs.

---

# 20. Step 5 — Open Project

```text
User selects folder
       ↓
Workspace created
       ↓
Explorer loads
       ↓
Git detected
       ↓
Indexer starts
```

Indexing happens in the background.

The editor remains responsive.

---

# 21. Step 6 — Project Indexing

```text
Files
 ↓
filter ignored/generated files
 ↓
parse
 ↓
extract symbols
 ↓
extract imports
 ↓
chunk code
 ↓
generate local embeddings
 ↓
store index
```

Future edits update only affected files.

---

# 22. Step 7 — Developer Asks AI

Example:

```text
"Why is login failing after token refresh?"
```

Namo does not immediately send the entire repository.

---

# 23. Step 8 — Context Retrieval

The context engine searches:

```text
current file
authentication symbols
token refresh
login
tests
imports
related services
project rules
```

Then ranks results.

---

# 24. Step 9 — Model Request

Depending on user settings:

### Local

```text
Context
 ↓
Ollama
 ↓
local model
```

### Cloud

```text
Context
 ↓
secret check
 ↓
OmniRouter
 ↓
selected model
```

---

# 25. Step 10 — AI Explanation

The AI returns:

```text
Likely cause:
refresh token state is not persisted...

Relevant files:
auth/session.ts
auth/refresh.ts
tests/auth.test.ts
```

The response includes clickable source locations.

---

# 26. Step 11 — User Requests Fix

User:

```text
"Fix it and add a regression test."
```

Now the agent activates.

---

# 27. Step 12 — Agent Planning

The agent creates an internal plan:

```text
1. Inspect token refresh flow
2. Modify state persistence
3. Add regression test
4. Run auth tests
5. Fix failures if necessary
```

---

# 28. Step 13 — Agent Tool Calls

```text
read_file
search_code
read_file
edit_file
write_file
run_tests
```

Every operation goes through the tool registry.

---

# 29. Step 14 — Permission Check

For example:

```text
Agent wants to edit:

src/auth/session.ts

[Allow] [Deny]
```

If the user has enabled trusted workspace policies, low-risk edits may be automatically allowed.

---

# 30. Step 15 — Checkpoint

Before multiple edits:

```text
Checkpoint created:
auth-fix-2026-10-05
```

Now the agent can proceed.

---

# 31. Step 16 — AI Editing

Agent proposes:

```text
session.ts
refresh.ts
auth.test.ts
```

Namo generates diffs.

---

# 32. Step 17 — Diff Review

User sees:

```text
3 files changed
+42
-17

[Accept All]
[Review]
[Reject All]
```

Each file can be reviewed individually.

---

# 33. Step 18 — Tests

After approval:

```text
npm test
```

or the detected project test command.

Output:

```text
2 failed
```

The agent receives the structured failure.

---

# 34. Step 19 — Agent Recovery Loop

```text
test failure
   ↓
analyze
   ↓
search
   ↓
edit
   ↓
test
```

Repeat until:

```text
success
```

or:

```text
maximum steps reached
```

---

# 35. Step 20 — Completion

Agent reports:

```text
Completed

Changed:
- src/auth/session.ts
- src/auth/refresh.ts
- tests/auth.test.ts

Verification:
✓ 48 tests passed

Checkpoint:
auth-fix-2026-10-05
```

---

# 36. Full Operational Flow

```text
                         USER
                           |
                           v
                      Namo Coder
                           |
             +-------------+-------------+
             |                           |
             v                           v
          Workspace                    AI
             |                           |
       +-----+-----+              +------+------+
       |     |     |              |             |
     Files  Git  Terminal       Local         Cloud
       |           |            Ollama      OmniRouter
       |           |              |             |
       +-----------+--------------+-------------+
                           |
                           v
                    Context Engine
                           |
                           v
                     Model Router
                           |
                           v
                        Agent
                           |
                     Tool Registry
                           |
                    Permission Layer
                           |
                           v
                      File / Git /
                       Terminal
                           |
                           v
                         Diff
                           |
                           v
                      User Review
                           |
                           v
                        Tests
                           |
                    +------+------+
                    |             |
                  pass          fail
                    |             |
                    v             v
                  Done        Agent Fix
                                  |
                                  +----> Tests
```

---

# 37. Local AI Flow

```text
Developer
   ↓
Namo Coder
   ↓
Context Engine
   ↓
Ollama
   ↓
Local model
   ↓
Namo Agent
   ↓
Tools
   ↓
Workspace
```

Benefits:

```text
privacy
offline operation
no hosted inference bill
local control
```

Trade-off:

```text
depends on local hardware
model quality varies
```

---

# 38. OmniRouter Flow

```text
Developer
   ↓
Namo Coder
   ↓
Context Engine
   ↓
Secret/Privacy Check
   ↓
OmniRouter Provider
   ↓
OmniRouter
   ↓
selected upstream model
   ↓
Namo Agent
```

Benefits:

```text
hosted model access
model choice
works on weaker hardware
one integration boundary
```

Trade-offs:

```text
requires network
usage costs
cloud privacy considerations
provider/model availability can change
```

---

# 39. Hybrid Flow

Hybrid mode can use:

```text
Autocomplete       -> local
Indexing           -> local
Embeddings         -> local
Simple questions   -> local
Complex agent      -> OmniRouter
```

But automatic cloud escalation must be transparent.

Recommended:

```text
Settings
  -> Hybrid AI
  -> Cloud escalation: ON/OFF
```

---

# 40. Security Flow

For local:

```text
AI request
 ↓
local context
 ↓
Ollama
```

For cloud:

```text
AI request
 ↓
context selection
 ↓
secret detection
 ↓
privacy policy
 ↓
cloud permission
 ↓
OmniRouter
```

For tools:

```text
AI
 ↓
tool request
 ↓
risk
 ↓
permission
 ↓
execution
```

---

# 41. Failure Flow

## Ollama unavailable

```text
Ollama health check
 ↓
failure
 ↓
show setup
 ↓
optionally switch to OmniRouter
```

## OmniRouter unavailable

```text
request
 ↓
gateway failure
 ↓
retry
 ↓
switch local if available
 ↓
notify user
```

## Agent failure

```text
tool failure
 ↓
structured result
 ↓
agent retry
 ↓
if repeated
 ↓
ask user
```

## Test failure

```text
test
 ↓
failure
 ↓
agent diagnosis
 ↓
fix
 ↓
test again
```

---

# 42. User Value Proposition

Namo Coder should communicate four simple benefits:

### 1. Code where you work

AI lives inside the IDE.

### 2. Understand the whole project

The context engine retrieves relevant code.

### 3. Stay in control

Every meaningful AI action can be reviewed.

### 4. Choose your AI

```text
Local Ollama
or
Cloud OmniRouter
```

---

# 43. Competitive Differentiation

The product should not compete only on:

```text
"which model is better?"
```

Models change.

The durable product value is:

```text
context quality
agent reliability
permission model
developer workflow
recovery
local-first operation
provider independence
```

---

# 44. MVP Scope

Must have:

```text
Monaco
Explorer
Tabs
Terminal
Git
SQLite
Ollama
OmniRouter
Chat
Context
AI edits
Diff
Indexer
Search
Agent
Permissions
Tests
Checkpoints
```

Not required for first release:

```text
team collaboration
remote workspaces
hosted accounts
billing
cloud sync
browser automation
complex enterprise policy
```

---

# 45. Version 0.1 User Journey

```text
Install
 ↓
Open project
 ↓
Choose local AI
 ↓
Index
 ↓
Ask question
 ↓
Ask for change
 ↓
Review diff
 ↓
Accept
 ↓
Run tests
```

Then:

```text
Settings
 ↓
Configure OmniRouter
 ↓
Select stronger hosted model
 ↓
Use same workflow
```

---

# 46. Version 0.2 Agent Journey

```text
Open issue
 ↓
Ask Namo to fix
 ↓
Agent investigates
 ↓
Agent reads code
 ↓
Agent plans
 ↓
Checkpoint
 ↓
Agent edits
 ↓
Tests
 ↓
Fix failures
 ↓
Final diff
 ↓
User accepts
```

---

# 47. Long-Term Product Flow

Eventually:

```text
Developer describes outcome
          ↓
Namo understands repository
          ↓
Namo creates plan
          ↓
Namo creates checkpoint
          ↓
Namo modifies code
          ↓
Namo runs tests
          ↓
Namo diagnoses failures
          ↓
Namo fixes
          ↓
Namo shows complete diff
          ↓
Developer approves
          ↓
Git commit
```

The developer moves from manually directing every edit to supervising a controlled engineering workflow.

---

# 48. Success Metrics

Track product quality rather than only AI usage.

## Developer efficiency

```text
time-to-fix
time-to-first-success
number of manual context switches
```

## AI quality

```text
accepted edit rate
test-passing edit rate
agent completion rate
retry rate
```

## Safety

```text
permission denial rate
unsafe command blocks
secret redaction events
rollback frequency
```

## Reliability

```text
crash rate
AI failure rate
index failure rate
agent timeout rate
```

---

# 49. Final Problem → Solution Map

| Problem | Namo Solution |
|---|---|
| Fragmented tools | Integrated IDE |
| Poor context | Code intelligence |
| Unsafe edits | Diff review |
| Dangerous agents | Permission layer |
| Cloud privacy | Local Ollama |
| Weak hardware | OmniRouter |
| Vendor lock-in | Provider abstraction |
| Large repos | Retrieval/indexing |
| AI hallucination | Tests + deterministic tools |
| Bad changes | Checkpoints |
| Model failure | Provider fallback |
| Repetitive debugging | Agent verification loop |

---

# 50. Final Product Architecture

```text
                         NAMO CODER
                              |
       +----------------------+----------------------+
       |                      |                      |
       v                      v                      v
     Editor                Terminal                 Git
       |                      |                      |
       +----------------------+----------------------+
                              |
                              v
                       Code Intelligence
                              |
                 +------------+------------+
                 |            |            |
              Symbols       Search      Embeddings
                 |            |            |
                 +------------+------------+
                              |
                              v
                        Context Engine
                              |
                              v
                         Model Router
                         /           \
                        /             \
                       v               v
                   Ollama         OmniRouter
                      |               |
                   Local AI        Cloud AI
                      \               /
                       \             /
                        v           v
                           Agent
                             |
                       Tool Registry
                             |
                       Permission Layer
                             |
                 +-----------+-----------+
                 |           |           |
              Files        Git       Terminal
                 |           |           |
                 +-----------+-----------+
                             |
                             v
                            Diff
                             |
                             v
                        Verification
                             |
                     +-------+-------+
                     |               |
                    Pass            Fail
                     |               |
                     v               v
                   Done          Agent retry
                                     |
                                     +----> Verify
```

---

# 51. Final Product Principle

Namo Coder should not be positioned as:

> "Another editor with a chatbot."

It should be positioned technically as:

> **A secure, local-first AI engineering environment that combines deterministic code intelligence with provider-independent AI agents and human-controlled software changes.**

That distinction should guide every architectural decision.

---

# 52. End State

A successful Namo Coder session should feel like:

```text
"I describe what I want.
Namo understands my repository.
Namo finds the relevant code.
Namo plans the work.
Namo proposes changes.
I review them.
Namo runs the tests.
Namo fixes failures.
I stay in control."
```

That is the complete problem-to-solution loop.
