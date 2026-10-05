# NamoGPT Threat Model

**Target Application:** NamoGPT (LiteLLM Proxy Server, React Web Client/PWA, React Native Mobile App)  
**Evaluation Scope:** Entire fullstack codebase, architecture, authentication system, proxy routing, client storage, third-party integrations, and deployment configurations.  
**Assessment Date:** 2026-10-05  

---

## 1. System Assets

| Asset ID | Asset Description | Sensitivity | Impact of Compromise |
| :--- | :--- | :--- | :--- |
| **A-01** | **Provider AI API Keys** (Google Gemini, Groq, OpenRouter, NVIDIA NIM, Cloudflare AI, AION Labs) | Critical | Unmetered financial cost, quota exhaustion, third-party account suspension, model abuse. |
| **A-02** | **LiteLLM Master Key** (`LITELLM_MASTER_KEY`) | Critical | Complete administrative control over proxy, ability to inspect status and execute requests. |
| **A-03** | **JWT Signing Secret** (`JWT_SECRET`) | Critical | Forgery of arbitrary authentication tokens, administrative role spoofing. |
| **A-04** | **Super Admin Account & Credentials** (`ADMIN_EMAIL`, `ADMIN_PASSWORD`) | Critical | Unauthorized access to user directories, environment telemetry, and proxy orchestration. |
| **A-05** | **User Database** (`server/data/users.json`) | High | Data breach of user emails, PBKDF2 password hashes, activity timestamps, and roles. |
| **A-06** | **User Chat History & Prompts** (Stored in client `localStorage` & in-flight) | High | Exposure of private conversations, confidential business context, proprietary code, or PII. |
| **A-07** | **Client-Provided Bring-Your-Own-Key (BYOK)** (Stored in client `localStorage` & request headers) | High | Interception or client-side theft of personal user API keys. |
| **A-08** | **Proxy Availability & Server Compute Resources** (Node.js runtime, port 3001) | Medium | Denial of Service (DoS), service disruption, system starvation via unbounded payloads. |

---

## 2. Trust Boundaries

```
[ Public Internet / Untrusted Network ]
               │
               ▼  (Trust Boundary 1: External Client to Express Server)
┌──────────────────────────────────────────────────────────┐
│  NamoGPT Express Backend (Port 3001)                     │
│  - Middleware: CORS (*), express.json (100MB), authMW    │
│  - Public Endpoints: /health, /api/models, /api/auth/*   │
│  - Admin Endpoints: /api/admin/status, /api/auth/users   │
│  - Proxy Handler: /v1/chat/completions, /v1/messages     │
└──────────────┬────────────────────────────┬──────────────┘
               │                            │
               ▼ (Trust Boundary 2)         ▼ (Trust Boundary 3)
┌───────────────────────────────┐  ┌────────────────────────────────────┐
│  Local Filesystem Storage     │  │  Upstream AI Providers             │
│  - server/data/users.json     │  │  - Google AI, Groq, OpenRouter,   │
│  - config.yaml / .env         │  │    NVIDIA NIM, Cloudflare Workers   │
└───────────────────────────────┘  └────────────────────────────────────┘
               ▲
               │ (Trust Boundary 4: Browser Sandbox & Local Storage)
┌──────────────────────────────────────────────────────────┐
│  Client Tier (Browser Web/PWA & Mobile App)              │
│  - LocalStorage: Auth tokens, chats, BYOK API keys       │
│  - Web Speech API, DOM rendering (ReactMarkdown)         │
└──────────────────────────────────────────────────────────┘
```

* **Trust Boundary 1 (Client $\rightarrow$ Server):** Any network client connecting to port 3001. Untrusted input passes through HTTP headers and JSON bodies.
* **Trust Boundary 2 (Server $\rightarrow$ Local Storage):** Express process read/write access to `server/data/users.json`, `config.yaml`, and environment files.
* **Trust Boundary 3 (Server $\rightarrow$ Upstream Providers):** Outbound HTTPS calls forward client prompts and upstream API credentials.
* **Trust Boundary 4 (Browser $\rightarrow$ Storage):** Client-side scripts access `localStorage` storing plaintext tokens and conversations.

---

## 3. Threat Actors

| Actor | Profile | Capabilities | Motivation |
| :--- | :--- | :--- | :--- |
| **Anonymous External Attacker** | Unauthenticated remote user on the public internet. | Can issue arbitrary HTTP requests to all exposed endpoints (`/v1/*`, `/api/*`). | Resource hijacking (stealing free/paid LLM tokens), data exfiltration, service disruption. |
| **Malicious Authenticated User** | Registered standard account (`role: 'user'`). | Possesses a valid JWT token. Can submit prompts and attempt privilege escalation to `admin`. | Access other users' data, extract provider secrets, access administrative endpoints. |
| **Cross-Site Adversary (XSS / Web)** | Malicious third party injecting scripts or exploiting client browser. | Can execute JavaScript in the victim's session context if XSS exists. | Stealing JWT tokens from `localStorage`, exfiltrating BYOK API keys, reading chat logs. |
| **Man-in-the-Middle (MitM)** | Attacker on untrusted network path (e.g. public Wi-Fi). | Can intercept or alter plaintext HTTP traffic if HTTPS is not enforced. | Eavesdropping on prompts, session hijacking, stealing bearer tokens. |

---

## 4. Entry Points & Attack Vectors

1. **`GET /api/auth/superadmin-credentials`**: Unauthenticated endpoint directly returning administrative credentials.
2. **`POST /api/auth/login` & `POST /api/auth/register`**: Authentication entry points vulnerable to brute-force and resource flooding due to lack of rate limiting.
3. **`POST /v1/chat/completions` & `/v1/messages`**: Proxy inference entry point reachable without authentication when master key is unconfigured or null.
4. **`GET /api/admin/status` & `GET /api/auth/users`**: Administrative diagnostic and user enumeration endpoints.
5. **Client Headers (`X-Gemini-Key`, `X-Groq-Key`, `X-OpenRouter-Key`, etc.)**: Custom key injection surface forwarded upstream.
6. **File Attachment Parser (`ChatInput.jsx`)**: Client-side FileReader loading arbitrary file contents into base64 Data URLs.

---

## 5. Threat Identification & Attack Scenarios

### Scenario 1: Immediate Super Admin Compromise via Public Credential Disclosure
* **Attack Path:** Attacker issues `GET /api/auth/superadmin-credentials` $\rightarrow$ Server responds with plaintext email and password $\rightarrow$ Attacker submits credentials to `POST /api/auth/login` $\rightarrow$ Receives JWT token with `role: 'superadmin'` $\rightarrow$ Calls `GET /api/auth/users` and `GET /api/admin/status` $\rightarrow$ Complete administrative takeover.
* **Likelihood:** High | **Impact:** Critical | **Risk Severity:** Critical

### Scenario 2: Unauthenticated Upstream API Quota Drain (Proxy Abuse)
* **Attack Path:** Anonymous user sends `POST /v1/chat/completions` with no `Authorization` header. Server check `if (providedKey && providedKey !== masterKey)` evaluates to `false` because `providedKey` is `null`. Request is forwarded to upstream providers using the server's pooled API keys. Attacker runs automated script consuming all rate limits and credits.
* **Likelihood:** High | **Impact:** High | **Risk Severity:** High

### Scenario 3: Denial of Service via 100MB Unbounded JSON Payload
* **Attack Path:** Attacker sends repeated POST requests containing 100MB JSON strings to `/v1/chat/completions` or `/api/auth/login`. Node.js process spends CPU parsing huge JSON structures and runs out of heap memory, crashing the service.
* **Likelihood:** Medium | **Impact:** High | **Risk Severity:** High

### Scenario 4: Token & BYOK Theft via LocalStorage Access
* **Attack Path:** Malicious script running in browser context (e.g., via compromised npm dependency or physical access) reads `window.localStorage.getItem('namogpt_auth_token_v1')` and `window.localStorage.getItem('namogpt_settings_v1')`. All personal API keys and bearer tokens are exfiltrated.
* **Likelihood:** Medium | **Impact:** High | **Risk Severity:** Medium

---

## 6. Existing Security Mitigations

* **Password Hashing:** Passwords are hashed using PBKDF2 (`crypto.pbkdf2Sync`, 100,000 iterations, 64-byte key, SHA-512) with a cryptographically secure 16-byte random salt per user. Timing attack mitigation is implemented via `crypto.timingSafeEqual`.
* **Atomic File Writes:** User database mutations use a temporary file write (`.tmp`) followed by `fs.renameSync` to avoid file corruption during concurrent operations.
* **Git Hygiene:** Root and server `.gitignore` explicitly exclude `.env`, `.env.local`, and virtual environments. Git history audit confirmed no active live API keys were committed.
* **Key Masking on Admin Readout:** The `/api/admin/status` telemetry endpoint masks API keys showing only the first and last 4 characters.
* **React Markdown Escaping:** `ReactMarkdown` is used without `rehype-raw`, meaning arbitrary HTML tags injected into LLM markdown output are treated as plain text rather than executed DOM nodes.

---

## 7. Categorized Security Findings

### Confirmed Vulnerabilities

#### [VULN-01] Plaintext Super Admin Credentials Exposed via Unauthenticated Public Endpoint
* **Severity:** Critical (CVSS: 9.8)
* **Evidence:** [server/server.js](file:///D:/NamoGPT/server/server.js#L116-L124):
  ```javascript
  app.get('/api/auth/superadmin-credentials', (_req, res) => {
    return res.status(200).json({
      email: SUPER_ADMIN_CREDENTIALS.email,
      password: SUPER_ADMIN_CREDENTIALS.password,
      role: SUPER_ADMIN_CREDENTIALS.role,
      name: SUPER_ADMIN_CREDENTIALS.name,
      isDefault: SUPER_ADMIN_CREDENTIALS.email === 'admin@namogpt.com'
    });
  });
  ```
* **Risk:** Complete bypass of authentication; any remote user can obtain administrative login credentials and take over the system.
* **Affected Location:** `server/server.js` lines 116–124; consumed by `web/src/context/AuthContext.jsx` and `mobile/App.js`.
* **Why it matters:** Defeats all role-based access control and grants any visitor superadmin rights.
* **Recommended Fix:** Completely remove or strictly gate this endpoint behind `process.env.NODE_ENV !== 'production'`, and never return passwords over HTTP.

---

### Security Weaknesses

#### [WEAK-01] Hardcoded JWT Secret Fallback in Server Code
* **Severity:** High (CVSS: 7.5)
* **Evidence:** [server/auth.js](file:///D:/NamoGPT/server/auth.js#L13):
  ```javascript
  const JWT_SECRET = process.env.JWT_SECRET || 'namogpt-super-secret-production-jwt-key-2026';
  ```
* **Risk:** If `JWT_SECRET` is omitted from the deployment environment, an attacker knowing the open-source code can forge valid JWT tokens for any user or administrator ID.
* **Affected Location:** `server/auth.js` line 13.
* **Why it matters:** Breaches session integrity and enables horizontal and vertical privilege escalation.
* **Recommended Fix:** Terminate server startup with an explicit fatal error if `process.env.JWT_SECRET` is missing in production environments.

#### [WEAK-02] Permissive Master Key Validation Bypasses Proxy Authentication for Unauthenticated Requests
* **Severity:** High (CVSS: 7.5)
* **Evidence:** [server/api/index.js](file:///D:/NamoGPT/server/api/index.js#L354-L356):
  ```javascript
  if (providedKey && providedKey !== masterKey) {
    return res.status(403).json({ error: 'forbidden: invalid master key' });
  }
  ```
* **Risk:** When `providedKey` is `null` (no `Authorization` header), the condition evaluates to `false`. Unauthenticated callers bypass the check and consume server-funded API keys.
* **Affected Location:** `server/api/index.js` lines 347–358.
* **Why it matters:** Allows unauthorized anonymous parties to drain upstream LLM rate limits and API budgets.
* **Recommended Fix:** Invert check: `if (!providedKey || providedKey !== masterKey) return res.status(401)...` when proxy protection is enabled.

#### [WEAK-03] Overly Permissive CORS and Lack of HTTP Security Headers
* **Severity:** Medium (CVSS: 5.3)
* **Evidence:** [server/server.js](file:///D:/NamoGPT/server/server.js#L36-L52):
  `origin: '*'` applied globally to all endpoints including authentication and admin routes. No `helmet` or CSP configured.
* **Risk:** Enables cross-origin interaction from arbitrary websites and leaves the browser without defense-in-depth protections (X-Frame-Options, HSTS, CSP).
* **Affected Location:** `server/server.js` line 36.
* **Why it matters:** Increases exposure to cross-origin abuse and clickjacking.
* **Recommended Fix:** Restrict CORS origin to configured frontend domains and introduce `helmet` middleware.

---

### Missing Controls

#### [CTRL-01] Absence of Rate Limiting on Authentication and Inference Endpoints
* **Severity:** Medium (CVSS: 5.3)
* **Evidence:** `server/server.js` lacks `express-rate-limit` or similar throttling mechanisms on `/api/auth/login`, `/api/auth/register`, and `/v1/chat/completions`.
* **Risk:** Credential stuffing, brute-forcing weak user passwords, and rapid denial of service.
* **Affected Location:** `server/server.js` route registrations.
* **Why it matters:** Automated bots can flood login endpoints unimpeded.
* **Recommended Fix:** Implement IP and user-based sliding-window rate limiting (e.g. 5 failed logins per minute).

#### [CTRL-02] Absence of Token Revocation or Session Invalidation
* **Severity:** Low (CVSS: 3.7)
* **Evidence:** `server/auth.js` verifies tokens purely via stateless HMAC verification without checking against an active session registry or token version.
* **Risk:** Once issued, a stolen token remains valid for the full 7-day duration even after password change or logout.
* **Affected Location:** `server/auth.js` line 58.
* **Why it matters:** Users cannot invalidate compromised sessions remotely.
* **Recommended Fix:** Add a token generation counter (`tokenVersion`) in `users.json` and verify it during authentication.

---

### Potential Risks Requiring Verification

#### [RISK-01] Unrestricted Inbound File Size in Client Attachment Handler
* **Severity:** Low (CVSS: 3.1)
* **Evidence:** [web/src/components/ChatInput.jsx](file:///D:/NamoGPT/web/src/components/ChatInput.jsx#L76-L90): `handleFileSelect` executes `reader.readAsDataURL(file)` without inspecting `file.size` before reading into browser memory.
* **Risk:** Selecting a multi-gigabyte file could crash the client browser tab.
* **Affected Location:** `web/src/components/ChatInput.jsx`.
* **Why it matters:** Poor user experience and potential client-side freeze.
* **Recommended Fix:** Enforce a maximum file size check (e.g. 10MB) before triggering `FileReader`.
