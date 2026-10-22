# 🔑 NamoGPT — Complete API Keys, Credentials & Deployment Guide

---

## ⚡ Quick Start: 3-Step Local Setup
1. Open or create the [`.env`](file:///D:/NamoGPT/.env) file located in the project root directory.
2. Paste your keys after the `=` sign (e.g., `GEMINI_API_KEY_1=your_key_here`).
3. Save the file and restart the server (`npm start` or `npm run dev`) — all keys and key pools load automatically!

---

## 📊 Current Status of Your Credentials

| Service / Provider | Status in `.env` | Purpose | Key Variable(s) |
| :--- | :---: | :--- | :--- |
| **Google Gemini** | ✅ **Active** (Pool of 6 keys) | Gemini 2.5 Flash / Pro (1M context + Vision) | `GEMINI_API_KEY_1` .. `6` |
| **Groq Cloud** | ✅ **Active** (Pool of 3 keys) | Llama 3.3 70B & DeepSeek R1 (~300 tokens/sec) | `GROQ_API_KEY_1` .. `3` |
| **OpenRouter** | ✅ **Active** | 200+ Multi-Provider Free Models | `OPEN_ROUTER_API_KEY_1` |
| **NVIDIA NIM** | ✅ **Active** | Nemotron-3 Super 120B STEM reasoning | `NVIDIA_NIM_API_KEY_1` |
| **Cloudflare AI** | ✅ **Configured** | Cloudflare Workers AI free neuron inference | `CF_API_TOKEN`, `CF_ACCOUNT_ID` |
| **Supabase DB** | ✅ **Active** | Cloud PostgreSQL user & chat persistence | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |
| **Production Mailer** | ✅ **Hardened & Active** | Welcome email & admin registration alerts | `GMAIL_USER`, `GMAIL_APP_PASSWORD`, `SMTP_PORT=465` |

---

## ⏳ Step-by-Step Guide for Pending & Additional Keys

### 1. Additional Free Groq Cloud Keys (Unlock 100,000+ Tokens/Minute)
You currently have 3 Groq keys configured (`GROQ_API_KEY_1` through `3`). You can add up to 7 keys in your rotation pool:
1. Visit: [console.groq.com/keys](https://console.groq.com/keys)
2. Sign in with a secondary GitHub or Google account.
3. Click **Create API Key**, copy the `gsk_...` key.
4. Add to `.env`:
   ```env
   GROQ_API_KEY_4=gsk_...
   GROQ_API_KEY_5=gsk_...
   ```

### 2. AION Labs 2.0 (Specialized Reasoning)
1. Sign up for the free developer preview at [aionlabs.ai](https://aionlabs.ai).
2. Generate your API token from the developer dashboard.
3. Add to `.env`:
   ```env
   AION_API_KEY_1=aion_...
   ```

### 3. Additional OpenRouter Free Tier Keys
1. Visit [openrouter.ai/keys](https://openrouter.ai/keys).
2. Click **Create Key** (Zero cost, no credit card required).
3. Add to `.env`:
   ```env
   OPEN_ROUTER_API_KEY_2=sk-or-v1-...
   OPEN_ROUTER_API_KEY_3=sk-or-v1-...
   ```

### 4. Optional Dedicated Agent Search: Tavily AI (1,000 Queries/Month Free)
> *Note: Real-time search via DuckDuckGo and Wikipedia is already 100% active with zero keys required.*
To unlock structured LLM web extraction:
1. Sign up at [tavily.com](https://tavily.com).
2. Copy your free API key.
3. Add to `.env`:
   ```env
   TAVILY_API_KEY=tvly-...
   ```

---

## 📧 Production SMTP Mailer: Why It Failed & How It Is Now Fixed

### 1. Why Did SMTP Work in Local but Fail in Production?
When deploying to cloud providers (e.g. Render, Vercel, Railway, Fly.io, AWS):
1. **Cloud IPv6 Route Deadlock**: Cloud Linux hosts often resolve `smtp.gmail.com` via IPv6 (`2607:f8b0:4004:...:465`). Many cloud VPCs have misconfigured or dropped outbound IPv6 routes to Google mail servers, causing connections to hang until an `ETIMEDOUT` occurs after 60-120 seconds.
2. **Outbound Port Blocking (Port 465 vs 587)**: Many cloud hosts (especially AWS Lambda / Vercel Serverless and Render free tiers) block or throttle outbound TCP traffic on port 25 and 465, while allowing port 587 (STARTTLS). If `service: 'gmail'` was hardcoded, Nodemailer defaulted to port 465 SSL and failed.
3. **Quoted Passwords in Cloud Dashboards**: Users often paste App Passwords with quotes like `"mwer hrxk woxc pahk"` or trailing spaces into Render/Vercel environment dashboards.

### 2. How the Mailer Engine Was Re-Engineered
The updated [`server/mailer.js`](file:///D:/NamoGPT/server/mailer.js) now incorporates:
- **`family: 4` (Strict IPv4 Routing)**: Completely bypasses broken cloud IPv6 routing tables.
- **Dual-Port Auto-Failover**:
  - Automatically attempts **Port 465 (SSL)** with strict 8s socket timeout.
  - If Port 465 is blocked by your cloud provider's firewall, it **instantly fails over to Port 587 (STARTTLS)** without dropping the email!
- **Zero-Port HTTPS Mail API Support (Resend & Brevo)**:
  - For serverless deployments (like Vercel where all SMTP ports are blocked by AWS Lambda), you can add a free [Resend](https://resend.com) key (`RESEND_API_KEY=re_...`). Resend delivers emails over standard HTTPS (Port 443), which is never blocked!
- **Live Diagnostic Endpoint**:
  - You can test live mailer status anytime by visiting:
    `http://localhost:3001/api/mailer/verify` (or `https://your-production-domain.com/api/mailer/verify`).

---

## 🌐 Production Cloud Deployment Variables Checklist

When deploying to **Vercel**, **Render**, or **Railway**, copy these variables into your cloud project dashboard:

```env
# Server Port & Mode
NODE_ENV=production
PORT=3001

# Primary LLM Pools
GEMINI_API_KEY_1=your_gemini_api_key_here
GROQ_API_KEY_1=your_groq_api_key_here
GROQ_API_KEY_2=your_secondary_groq_key_here
OPEN_ROUTER_API_KEY_1=your_openrouter_api_key_here
NVIDIA_NIM_API_KEY_1=your_nvidia_nim_key_here

# Cloudflare Workers AI
CF_API_TOKEN=your_cloudflare_api_token_here
CF_ACCOUNT_ID=your_cloudflare_account_id_here

# Supabase Production Database
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key_here

# Production SMTP Dispatch (Gmail App Password)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USERNAME=your_email@gmail.com
SMTP_PASSWORD=your_16_character_app_password
SMTP_FROM=NamoGPT <your_email@gmail.com>
GMAIL_USER=your_email@gmail.com
GMAIL_APP_PASSWORD=your_16_character_app_password
ADMIN_NOTIFICATION_EMAIL=your_admin_email@gmail.com

# Optional Serverless HTTPS Mail (For Vercel - zero blocked ports)
# RESEND_API_KEY=re_your_free_key_here
```
