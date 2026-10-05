# NamoGPT Attack Surface Analysis

**Target Application:** NamoGPT Fullstack Architecture  
**Evaluation Scope:** All public and internal routes, authentication and authorization handlers, user input ingestion points, storage mediums, network bindings, and upstream integrations.  
**Assessment Date:** 2026-10-05  

---

## 1. Network & HTTP Endpoint Surface

The backend runs on Express.js (default port `3001` or `process.env.PORT`).

### A. Public Unauthenticated Endpoints

| Method | Endpoint | Handler | Purpose | Authentication |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/health`, `/api/hello` | `server/api/index.js` | Service health status check | None (Public) |
| `GET` | `/api/models`, `/v1/models` | `server/api/index.js` | Model catalog & key readiness | None (Public) |
| `GET` | `/docs`, `/docs/` | `server/server.js` | Swagger UI documentation | None (Public) |
| `GET` | `/openapi.json` | `server/server.js` | OpenAPI specification schema | None (Public) |
| `POST`| `/api/auth/register` | `server/server.js` | Create new user account | None (Public) |
| `POST`| `/api/auth/login` | `server/server.js` | Authenticate user & issue JWT | None (Public) |
| `GET` | `/api/auth/superadmin-credentials` | `server/server.js` | ⚠️ **Returns admin credentials** | **None (CRITICAL)** |
| `POST`| `/v1/chat/completions` | `server/api/index.js` | OpenAI-compatible chat proxy | Conditional (Bypassed if key absent) |
| `POST`| `/v1/messages` | `server/api/anthropic_adaptions.js` | Anthropic-compatible chat proxy | Conditional (Bypassed if key absent) |

### B. Authenticated & Administrative Endpoints

| Method | Endpoint | Required Role | Handler | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/auth/me` | Logged In User (`req.user`) | `server/server.js` | Returns active user profile |
| `GET` | `/api/auth/users` | `admin` / `superadmin` | `server/server.js` | Lists all registered accounts |
| `GET` | `/api/admin/status`| `admin` / `superadmin` | `server/server.js` | Telemetry & masked env keys |

---

## 2. Authentication & Authorization Attack Surface

1. **JWT Verification Boundary ([server/auth.js](file:///D:/NamoGPT/server/auth.js#L73-L93)):**
   * Uses hand-rolled HMAC-SHA256 token verification instead of audited libraries (e.g. `jsonwebtoken`).
   * Evaluates `payload.exp` against `Date.now() / 1000`. Does not support token revocation or blacklist.
2. **Master Key Bypass in Inference Handler ([server/api/index.js](file:///D:/NamoGPT/server/api/index.js#L354)):**
   * `if (providedKey && providedKey !== masterKey)` allows callers omitting `Authorization` headers to bypass the check entirely.
3. **Client-Controlled Key Injection Surface:**
   * Handlers parse custom headers: `X-Gemini-Key`, `X-Groq-Key`, `X-OpenRouter-Key`, `X-Nvidia-Key`, `X-Aion-Key`, `X-Cf-Key`.
   * These keys override server-side pool configurations for that specific transaction.

---

## 3. User Input & Ingestion Surface

| Input Vector | Destination | Validation / Sanitization | Risks |
| :--- | :--- | :--- | :--- |
| **`messages` array** (`content`, `role`) | Upstream AI APIs | Forwarded as JSON. Max body limit 100MB. | Prompt injection, upstream API abuse, JSON memory exhaustion. |
| **`model_name` / `model`** | Model Router | String matching & alias normalizer. | Routing to unexpected pools. |
| **`temperature`, `max_tokens`** | Upstream AI APIs | Forwarded directly in JSON body. | Upstream argument manipulation. |
| **`email`, `password`, `name`** | `server/auth.js` | Checks `password.length >= 6`. No email regex validation. | Weak password registration, malformed data entries. |
| **File Attachments** | Web Client FileReader | Base64 encoded Data URLs. | Memory bloat in browser and Node.js process. |
| **`serverUrl` input (Settings)** | Web/Mobile Clients | Client state updates URL for subsequent fetches. | Client-side SSRF if user enters untrusted server URLs. |

---

## 4. Storage & Persistence Surface

* **User Data (`server/data/users.json`):**
  * Local filesystem JSON file containing: `id`, `name`, `email`, `passwordHash`, `role`, `createdAt`, `lastLoginAt`.
  * Permissions are standard process user permissions; unencrypted at rest.
* **Browser LocalStorage:**
  * `namogpt_auth_token_v1`: Bearer JWT token.
  * `namogpt_auth_user_v1`: User metadata JSON.
  * `namogpt_chats_v1`: All conversation transcripts and prompts.
  * `namogpt_settings_v1`: System prompt, temperature, and unencrypted BYOK API keys.

---

## 5. Third-Party Integration & Upstream Surface

The server makes outbound HTTPS requests to:
1. `https://generativelanguage.googleapis.com` (Google Gemini)
2. `https://api.groq.com` (Groq Cloud)
3. `https://openrouter.ai` (OpenRouter)
4. `https://integrate.api.nvidia.com` (NVIDIA NIM)
5. `https://api.cloudflare.com` (Cloudflare Workers AI)
6. `https://api.aionlabs.ai` (AION Labs)

**SSRF & Header Leakage Risk:**
* `forwardRequest` uses `axios` and copies client request headers to the third-party upstream.
* Redirect handling is enabled by default in Axios, meaning a compromised or malicious upstream redirecting to internal IP ranges could trigger SSRF.

---

## 6. Dependency & Supply Chain Surface

Direct dependencies audited via `npm audit`:
* **`axios` (1.0.0 - 1.19.0):** High severity advisory (Prototype pollution gadget, SSRF via redirect handling, DoS).
* **`js-yaml` (4.0.0 - 4.3.1):** High severity advisory (CPU resource consumption via merge keys).
* **`morgan` (<=1.12.0):** Moderate advisory (Log injection / forging via unescaped delimiters).
* **`qs` (via `body-parser` and `express`):** Moderate advisory (DoS via `isBuffer` parsing).

---

## 7. Categorized Findings & Recommendations

### Confirmed Vulnerabilities

#### [SURF-VULN-01] Public Credential Disclosure Surface
* **Severity:** Critical (CVSS: 9.8)
* **Evidence:** `server/server.js` lines 116–124 (`/api/auth/superadmin-credentials`).
* **Risk:** Exposes the Super Admin username and password directly on the public internet.
* **Affected Location:** `server/server.js`.
* **Why it matters:** Eliminates all authorization barriers for anyone discovering the endpoint.
* **Recommended Fix:** Remove the endpoint immediately from production code.

---

### Security Weaknesses

#### [SURF-WEAK-01] Unauthenticated LLM Proxy Gateway
* **Severity:** High (CVSS: 7.5)
* **Evidence:** `server/api/index.js` lines 347–358 (`/v1/chat/completions`).
* **Risk:** Anyone on the internet can call `/v1/chat/completions` and consume server-funded API keys without providing a token or password.
* **Affected Location:** `server/api/index.js`.
* **Why it matters:** Financial cost and service denial from third-party quota exhaustion.
* **Recommended Fix:** Require either a valid user JWT (`req.user`) or an explicit `Authorization: Bearer <LITELLM_MASTER_KEY>` on all `/v1/*` inference routes.

#### [SURF-WEAK-02] Unbounded Request Body Size (100MB)
* **Severity:** Medium (CVSS: 5.3)
* **Evidence:** [server/server.js](file:///D:/NamoGPT/server/server.js#L55-L56):
  `app.use(express.json({ limit: '100mb' }));`
* **Risk:** Memory exhaustion Denial of Service through oversized JSON transmissions.
* **Affected Location:** `server/server.js`.
* **Why it matters:** Text and chat completions rarely exceed 2MB. A 100MB body limit allows resource exhaustion attacks.
* **Recommended Fix:** Lower global body limit to `2mb`, allowing larger limits only on specific multi-part upload endpoints if needed.

---

### Missing Controls

#### [SURF-CTRL-01] Missing Web Application Security Headers
* **Severity:** Medium (CVSS: 4.8)
* **Evidence:** HTTP responses from `server/server.js` lack `Content-Security-Policy`, `X-Content-Type-Options`, `X-Frame-Options`, and `Strict-Transport-Security`.
* **Risk:** Susceptibility to clickjacking, MIME-sniffing, and inline script execution.
* **Affected Location:** `server/server.js`.
* **Why it matters:** Defense-in-depth against browser-based exploitation.
* **Recommended Fix:** Add `helmet()` middleware to the Express pipeline.
