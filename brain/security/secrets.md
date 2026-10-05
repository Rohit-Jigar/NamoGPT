# NamoGPT Secrets & Credential Security Analysis

**Target Application:** NamoGPT  
**Scope:** Server environment variables, configuration schemas, client local storage, transit headers, Git repository history, and secret rotation procedures.  
**Assessment Date:** 2026-10-05  

---

## 1. Secrets Inventory & Expected Locations

| Secret Identifier | Expected Source | Description & Sensitivity | Consumed In Code |
| :--- | :--- | :--- | :--- |
| **`GEMINI_API_KEY_1..6`** | Server `.env` | Google AI Studio API Keys (Critical) | `config.yaml`, `server/api/index.js` |
| **`GROQ_API_KEY_1..7`** | Server `.env` | Groq Cloud LPU Inference Keys (Critical) | `config.yaml`, `server/api/index.js` |
| **`OPEN_ROUTER_API_KEY_1..7`** | Server `.env` | OpenRouter Router API Keys (Critical) | `config.yaml`, `server/api/index.js` |
| **`NVIDIA_NIM_API_KEY_1..5`** | Server `.env` | NVIDIA NIM Cloud API Keys (Critical) | `config.yaml`, `server/api/index.js` |
| **`CF_API_TOKEN` & `CF_ACCOUNT_ID`** | Server `.env` | Cloudflare Workers AI Token & Account ID (Critical) | `config.yaml`, `server/api/index.js` |
| **`AION_API_KEY_1..8`** | Server `.env` | AION Labs Engine API Keys (High) | `config.yaml`, `server/api/index.js` |
| **`LITELLM_MASTER_KEY`** | Server `.env` | Proxy Admin Master Key (Critical) | `config.yaml`, `server/auth.js`, `server/api/index.js` |
| **`JWT_SECRET`** | Server `.env` | HMAC-SHA256 Token Signing Secret (Critical) | `server/auth.js` |
| **`ADMIN_PASSWORD`** | Server `.env` | Super Admin initial password (Critical) | `server/auth.js` |
| **Client BYOK Keys** | Browser `localStorage` | User-provided personal provider keys (High) | `web/src/context/ChatContext.jsx`, `web/src/components/SettingsModal.jsx` |
| **Client JWT Token** | Browser `localStorage` | User authentication bearer token (High) | `web/src/context/AuthContext.jsx`, `mobile/App.js` |

---

## 2. Environment & Configuration Handling

* **Resolution Mechanism:** In [server/api/index.js](file:///D:/NamoGPT/server/api/index.js#L47-L84), `resolveApiKey(maybeEnv)` parses values prefixed with `os.environ/` and maps them dynamically to `process.env`. It supports indexed fallbacks (e.g. `GEMINI_API_KEY_1` falling back to `GEMINI_API_KEY`) and naming variations (`OPEN_ROUTER_API_KEY` vs `OPENROUTER_API_KEY`).
* **Environment File Loading:** In [server/server.js](file:///D:/NamoGPT/server/server.js#L21-L28), `dotenv` automatically discovers `.env` in the current working directory or the parent directory.
* **Storage on Disk:** The active `.env` file resides on the host filesystem with standard OS permissions. No secrets encryption at rest is applied to `.env`.

---

## 3. Categorized Secrets Findings

### Confirmed Vulnerabilities

#### [SEC-VULN-01] Administrative Credential Leakage via Dedicated Public JSON API
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
* **Risk:** The server directly serializes the Super Admin email and plaintext password in a public JSON HTTP response accessible without authentication to any client on the network.
* **Affected Location:** `server/server.js` lines 116–124; invoked on client boot by `web/src/context/AuthContext.jsx` and `mobile/App.js`.
* **Why it matters:** Direct exposure of administrative credentials completely invalidates system authentication boundaries.
* **Recommended Fix:** Delete this endpoint for production deployments. If needed in local test harnesses, restrict strictly to `process.env.NODE_ENV === 'test'` on `localhost` only.

---

### Security Weaknesses

#### [SEC-WEAK-01] Known In-Code Default Credentials & JWT Secret Fallbacks
* **Severity:** High (CVSS: 7.5)
* **Evidence:** [server/auth.js](file:///D:/NamoGPT/server/auth.js#L13-L18):
  ```javascript
  const JWT_SECRET = process.env.JWT_SECRET || 'namogpt-super-secret-production-jwt-key-2026';
  const DEFAULT_ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'admin@namogpt.com').toLowerCase().trim();
  const DEFAULT_ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin@NamoGPT2026!';
  ```
* **Risk:** In any deployment where `JWT_SECRET` or `ADMIN_PASSWORD` is not explicitly set in `.env`, the system defaults to publicly known static credentials.
* **Affected Location:** `server/auth.js` lines 13, 17.
* **Why it matters:** Attackers scanning NamoGPT instances can automatically authenticate as Super Admin using the hardcoded default password.
* **Recommended Fix:** Enforce mandatory environment variable verification on server boot; fail fast if `JWT_SECRET` or `ADMIN_PASSWORD` are missing or match defaults.

#### [SEC-WEAK-02] Unencrypted Storage of Bring-Your-Own-Keys (BYOK) in Browser LocalStorage
* **Severity:** Medium (CVSS: 5.8)
* **Evidence:** [web/src/context/ChatContext.jsx](file:///D:/NamoGPT/web/src/context/ChatContext.jsx#L36-L73):
  ```javascript
  localStorage.setItem('namogpt_settings_v1', JSON.stringify(settings));
  // settings.apiKeys contains { gemini: '...', groq: '...', openrouter: '...', nvidia: '...' }
  ```
* **Risk:** API keys provided by users in the Settings modal are stored in unencrypted browser `localStorage`. Any script running on the origin (via XSS or malicious browser extension) can extract these keys.
* **Affected Location:** `web/src/context/ChatContext.jsx` line 69; `web/src/components/SettingsModal.jsx`.
* **Why it matters:** Breaches user confidentiality and compromises personal provider accounts.
* **Recommended Fix:** Use Web Crypto API with user-passphrase derived key, or keep BYOK keys purely in volatile in-memory state during active sessions.

#### [SEC-WEAK-03] Partial Key Exposure via Admin Telemetry Endpoint
* **Severity:** Low (CVSS: 3.5)
* **Evidence:** [server/server.js](file:///D:/NamoGPT/server/server.js#L128-L148):
  ```javascript
  function maskKey(key) {
    if (!key || typeof key !== 'string') return null;
    if (key.length <= 8) return '••••••••';
    return `${key.slice(0, 4)}...${key.slice(-4)}`;
  }
  ```
* **Risk:** Exposing 8 characters (4 prefix + 4 suffix) reduces the entropy space needed to brute-force short or patterned keys.
* **Affected Location:** `server/server.js` line 131.
* **Why it matters:** Telemetry should only confirm the presence or fingerprint of a key, not reveal key fragments.
* **Recommended Fix:** Replace partial substrings with one-way SHA-256 fingerprint hashes (e.g. `sha256(key).slice(0, 8)`).

---

### Missing Controls

#### [SEC-CTRL-01] Absence of Automated Secret Rotation & Revocation
* **Severity:** Medium (CVSS: 4.8)
* **Evidence:** Secrets in `.env` and `config.yaml` are loaded statically into memory. No rotation API, key health monitoring, or automated secret expiration exists.
* **Risk:** Compromised keys remain active indefinitely until manual intervention occurs.
* **Affected Location:** `server/api/index.js`.
* **Why it matters:** Standard compliance requires programmatic key lifecycle management.
* **Recommended Fix:** Implement scheduled key validation and hot-reloading of `.env` configurations without server restart.

---

## 4. Git & History Exposure Audit

* **Repository Scanned:** `Rohit-Jigar/NamoGPT` (branch `main`).
* **Ignore Configuration:** `.gitignore` and `server/.gitignore` ignore `.env`, `.env.*` (with exception for `.env.example`).
* **Commit History Search:** A complete git log diff audit was executed searching for key prefixes (`AIzaSy`, `gsk_`, `nvapi-`, `sk-or-`).
* **Finding:** No live production secrets exist in the git history. Documentation files contain only truncated syntax examples (e.g. `AIzaSy...`, `gsk_...`).

---

## 5. Secret Rotation Guidelines

If any key is suspected of compromise:
1. **Google Gemini:** Revoke immediately at [aistudio.google.com/apikey](https://aistudio.google.com/apikey). Generate new key and update `GEMINI_API_KEY_1..6`.
2. **Groq Cloud:** Delete key in [console.groq.com/keys](https://console.groq.com/keys) and replace `GROQ_API_KEY_1..7`.
3. **OpenRouter:** Revoke in [openrouter.ai/keys](https://openrouter.ai/keys) and update `OPEN_ROUTER_API_KEY_1..7`.
4. **NVIDIA NIM:** Generate new credential on [build.nvidia.com](https://build.nvidia.com) and replace `NVIDIA_NIM_API_KEY_1..5`.
5. **JWT Secret:** Update `JWT_SECRET` in `.env` and restart the server daemon (`pm2 restart` / `systemctl restart`). All active JWT sessions will immediately be invalidated.
