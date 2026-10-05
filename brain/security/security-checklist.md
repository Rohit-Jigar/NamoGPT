# NamoGPT Comprehensive Security Checklist & Audit Roadmap

**Target Application:** NamoGPT  
**Version:** 1.0.0  
**Audit Date:** 2026-10-05  
**Compliance Standard:** OWASP Top 10 (2021), OWASP Top 10 for LLM Applications (2025)  

---

## 1. Domain-by-Domain Security Checklist

| Domain | Status | Key Mechanism / Implementation State | Notes |
| :--- | :---: | :--- | :--- |
| **1. Authentication** | ❌ **FAIL** | PBKDF2 (100k iter, SHA-512) is strong, but `/api/auth/superadmin-credentials` exposes plaintext admin credentials publicly. | `[VULN-01]` Critical |
| **2. Authorization / RBAC** | ⚠️ **PARTIAL** | Coarse roles (`user`, `admin`, `superadmin`). `requireAdmin` protects `/api/admin/status` and `/api/auth/users`. No model-level access control. | `[WEAK-01]` |
| **3. Session / Token Security** | ⚠️ **PARTIAL** | Custom HMAC-SHA256 JWT tokens. 7-day expiration. Stored in client `localStorage`. No token revocation/blacklist mechanism. | `[WEAK-02]` |
| **4. Input Validation** | ⚠️ **PARTIAL** | Basic string length checks (`password.length >= 6`). No email regex validation. No strict schema validation on proxy JSON payloads. | `[CTRL-01]` |
| **5. Injection (SQL / NoSQL / Command)** | 🟢 **PASS** | No SQL database or OS command execution in request path. JSON writes use atomic `.tmp` file renames. | Low Risk |
| **6. XSS / CSRF** | ⚠️ **PARTIAL** | `ReactMarkdown` runs without `rehype-raw` (mitigating basic HTML injection). Missing `rehype-sanitize`. Stateless JWT bearer tokens mitigate classic CSRF. | `[RISK-01]` |
| **7. API Security** | ❌ **FAIL** | `/v1/chat/completions` bypasses authentication when `Authorization` header is omitted because master key check only triggers if key is provided. | `[WEAK-03]` High |
| **8. Rate Limiting / Abuse** | ❌ **FAIL** | No IP or account-level rate limiting on login or chat completions. Upstream RPM token bucket is in-memory only. | `[CTRL-02]` Medium |
| **9. File Uploads** | ⚠️ **PARTIAL** | Ingestion via client-side `FileReader.readAsDataURL`. No server-side upload storage. Missing client-side file size constraint. | `[RISK-02]` |
| **10. Database Security** | ⚠️ **PARTIAL** | `users.json` stored on local disk. Protected by OS filesystem permissions. Unencrypted at rest. Single point of failure. | Medium Risk |
| **11. Secrets Management** | ⚠️ **PARTIAL** | `.env` properly ignored in Git. Dynamic resolution via `resolveApiKey`. In-code fallback secrets present in `auth.js`. | `[WEAK-04]` High |
| **12. Encryption (In Transit & At Rest)** | ⚠️ **PARTIAL** | Transit encryption depends on deployment reverse proxy (HTTPS on Render/Vercel). Data at rest in `users.json` is unencrypted. | Environment Dependent |
| **13. CORS Configuration** | ⚠️ **PARTIAL** | Global `origin: '*'` with permissive headers. Enables open cross-origin requests. | `[WEAK-05]` Medium |
| **14. Dependency Security** | ⚠️ **PARTIAL** | `npm audit` reports 6 vulnerabilities (Axios prototype pollution/SSRF, JS-YAML CPU DoS, Morgan log injection). | `[WEAK-06]` High |
| **15. Logging & Monitoring** | ⚠️ **PARTIAL** | Morgan logs HTTP requests to stdout. No audit log for administrative privilege events or failed authentication attempts. | `[CTRL-03]` Low |
| **16. Admin Security** | ❌ **FAIL** | Default hardcoded admin password and public credential disclosure endpoint completely undermine admin tier. | `[VULN-01]` Critical |
| **17. Deployment / Infrastructure** | 🟢 **PASS** | Automated CI/CD via GitHub Actions (`ci.yml`, `deploy.yml`). Secret scanning step included in CI. | Well Architected |
| **18. Data Privacy** | 🟢 **PASS** | Conversations stored strictly in user's browser `localStorage`. No server-side conversation logging or tracking. | Strong Privacy |
| **19. Error Handling** | 🟢 **PASS** | Server catches exceptions and avoids returning internal stack traces to clients. | Clean |
| **20. Backup & Recovery** | ⚠️ **PARTIAL** | No automated snapshot or backup for `server/data/users.json`. Loss of host disk results in account directory loss. | Operational Risk |

---

## 2. Detailed Findings Breakdown

### Confirmed Vulnerabilities

#### [FINDING-01] Public Disclosure of Super Admin Plaintext Password
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
* **Risk:** Anyone visiting the deployment can obtain the Super Admin email and plaintext password, authenticate via `/api/auth/login`, and gain full superadmin privileges over telemetry and users.
* **Affected Location:** `server/server.js` (lines 116–124).
* **Why it matters:** Defeats all authentication boundaries and role-based access control.
* **Recommended Fix:** Delete the endpoint entirely in production code. Never transmit plaintext passwords over HTTP.

---

### Security Weaknesses

#### [FINDING-02] Hardcoded Fallback Secrets for JWT Signing and Admin Credentials
* **Severity:** High (CVSS: 7.5)
* **Evidence:** [server/auth.js](file:///D:/NamoGPT/server/auth.js#L13-L17):
  ```javascript
  const JWT_SECRET = process.env.JWT_SECRET || 'namogpt-super-secret-production-jwt-key-2026';
  const DEFAULT_ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin@NamoGPT2026!';
  ```
* **Risk:** If an administrator deploys the application without defining `JWT_SECRET` or `ADMIN_PASSWORD` in `.env`, the server defaults to publicly known static secrets.
* **Affected Location:** `server/auth.js` (lines 13, 17).
* **Why it matters:** Attackers can forge valid JWT tokens for any user ID or use the default password to log in.
* **Recommended Fix:** Prevent server startup (`process.exit(1)`) if `JWT_SECRET` is unset in non-development environments.

#### [FINDING-03] Unauthenticated Access to LLM Proxy Inference Endpoints
* **Severity:** High (CVSS: 7.5)
* **Evidence:** [server/api/index.js](file:///D:/NamoGPT/server/api/index.js#L354-L356):
  ```javascript
  if (providedKey && providedKey !== masterKey) {
    return res.status(403).json({ error: 'forbidden: invalid master key' });
  }
  ```
* **Risk:** If an incoming request does not provide an `Authorization` header (`providedKey === null`), the check evaluates to `false` and the request proceeds to call upstream AI providers using server keys.
* **Affected Location:** `server/api/index.js` (lines 347–358).
* **Why it matters:** Anonymous actors can consume your paid or rate-limited API quotas without authorization.
* **Recommended Fix:** Enforce mandatory token verification:
  ```javascript
  if (!req.user && (!providedKey || providedKey !== masterKey)) {
    return res.status(401).json({ error: 'unauthorized: valid session or master key required' });
  }
  ```

#### [FINDING-04] Overly Permissive Global CORS Configuration
* **Severity:** Medium (CVSS: 5.3)
* **Evidence:** [server/server.js](file:///D:/NamoGPT/server/server.js#L36-L52):
  ```javascript
  app.use(cors({ origin: '*', ... }));
  ```
* **Risk:** Any arbitrary origin can make cross-origin requests to authentication, user directory, and inference endpoints.
* **Affected Location:** `server/server.js` (lines 36–52).
* **Why it matters:** Breaches origin isolation and enables cross-origin attacks from malicious websites.
* **Recommended Fix:** Restrict `origin` to a whitelist of trusted domains (e.g. `process.env.FRONTEND_URL` or `['https://rohit-jigar.github.io']`).

#### [FINDING-05] Known CVEs in Server Dependencies
* **Severity:** High (CVSS: 7.5)
* **Evidence:** `npm audit` reports vulnerabilities in `axios` (v1.0.0–1.19.0) and `js-yaml` (v4.0.0–4.3.1).
* **Risk:** Prototype pollution, SSRF through redirect following in Axios, and CPU resource exhaustion in JS-YAML.
* **Affected Location:** `server/package.json` (`axios`, `js-yaml`).
* **Why it matters:** Upstream security advisories (e.g. GHSA-vh66-26gq-q6x8, GHSA-2883-xcg3-v3hh) can be leveraged for denial of service.
* **Recommended Fix:** Run `npm --prefix server update axios js-yaml` to upgrade to patched minor releases.

---

### Missing Controls

#### [FINDING-06] Lack of Login Rate Limiting and Brute-Force Protection
* **Severity:** Medium (CVSS: 5.3)
* **Evidence:** `POST /api/auth/login` and `POST /api/auth/register` have no throttling or CAPTCHA middleware.
* **Risk:** Automated credential stuffing and dictionary attacks against user and admin accounts.
* **Affected Location:** `server/server.js`.
* **Why it matters:** Attackers can make thousands of password guesses per minute with no penalty.
* **Recommended Fix:** Add `express-rate-limit` (e.g. 10 attempts per 15-minute window per IP on `/api/auth/*`).

#### [FINDING-07] Unbounded 100MB JSON Body Limit
* **Severity:** Medium (CVSS: 5.3)
* **Evidence:** [server/server.js](file:///D:/NamoGPT/server/server.js#L55):
  ```javascript
  app.use(express.json({ limit: '100mb' }));
  ```
* **Risk:** Transmission of deeply nested or huge JSON strings causes excessive memory allocation in Node.js, triggering garbage collection spikes or crash.
* **Affected Location:** `server/server.js` (line 55).
* **Why it matters:** Standard chat completions require less than 2MB. A 100MB limit exposes the event loop to DoS.
* **Recommended Fix:** Reduce global limit to `2mb`.

#### [FINDING-08] Lack of HTTP Security Headers (Helmet)
* **Severity:** Medium (CVSS: 4.8)
* **Evidence:** Server responses omit `X-Frame-Options`, `Content-Security-Policy`, `X-Content-Type-Options`, and `Strict-Transport-Security`.
* **Risk:** UI redressing (clickjacking) and MIME sniffing attacks in vulnerable browsers.
* **Affected Location:** `server/server.js`.
* **Why it matters:** Standard baseline protection for all modern web applications.
* **Recommended Fix:** Install and register `helmet()` in `server/server.js`.

---

### Potential Risks Requiring Verification

#### [FINDING-09] Browser LocalStorage Plaintext Key Storage
* **Severity:** Low (CVSS: 3.8)
* **Evidence:** [web/src/context/ChatContext.jsx](file:///D:/NamoGPT/web/src/context/ChatContext.jsx#L37): User-configured BYOK keys are serialized into `localStorage.getItem('namogpt_settings_v1')`.
* **Risk:** If an XSS vulnerability exists on the origin, an injected script can read all stored API keys.
* **Affected Location:** `web/src/context/ChatContext.jsx`.
* **Why it matters:** User privacy and third-party API account security.
* **Recommended Fix:** Provide an option to keep keys in session memory only (cleared on tab close) or encrypt them using Web Crypto API.

---

## 3. Prioritized Remediation Roadmap

```
Immediate (Blockers before public deployment):
  ├── 1. Remove GET /api/auth/superadmin-credentials endpoint [FINDING-01]
  ├── 2. Fail server boot if JWT_SECRET is unset in production [FINDING-02]
  └── 3. Require authentication or valid master key on /v1/* routes [FINDING-03]

Short-Term (Within 1 week):
  ├── 4. Restrict CORS origin from '*' to trusted frontend domain [FINDING-04]
  ├── 5. Add express-rate-limit on /api/auth/login [FINDING-06]
  ├── 6. Lower express.json limit from 100MB to 2MB [FINDING-07]
  └── 7. Update axios and js-yaml via npm update [FINDING-05]

Medium-Term (Within 1 month):
  ├── 8. Integrate helmet() for security headers [FINDING-08]
  ├── 9. Add token versioning for session revocation
  └── 10. Implement automated backup for users.json
```
