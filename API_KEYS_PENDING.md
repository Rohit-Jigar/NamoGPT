# 🔑 NamoGPT — Complete API Keys, Credentials & Production Deployment Guide

---

## ⚡ Quick Status Overview

| Service / Provider | Status in Backend | Purpose & Capabilities | Key Variable(s) |
| :--- | :---: | :--- | :--- |
| **AION Labs 2.0** | ✅ **Active & Verified** | Specialized Deep Reasoning (`aion-labs/aion-2.0`) | `AION_API_KEY_1` .. `8` |
| **Tavily AI Search** | ✅ **Active & Verified** | High-precision agent web search & deep research extraction | `TAVILY_API_KEY` |
| **Groq Cloud** | ✅ **Active & Verified** | GPT-OSS 120B & Qwen 27B (~300 tokens/sec LPU inference) | `GROQ_API_KEY_1` .. `3` |
| **OpenRouter** | ✅ **Active & Configured** | 200+ Free Models (Qwen, DeepSeek R1, Nemotron) | `OPEN_ROUTER_API_KEY_1` |
| **NVIDIA NIM** | ✅ **Active & Configured** | Enterprise STEM reasoning (Nemotron 3 Super 120B) | `NVIDIA_NIM_API_KEY_1` |
| **9Router & OmniRouter** | ✅ **Production Cloud Bridge** | Universal multi-provider gateway on Render + local fallback | `NINEROUTER_BASE_URL`, `OMNIROUTER_BASE_URL` |
| **Cloudflare AI** | ✅ **Configured** | Serverless edge inference with 10k free daily neurons | `CF_API_TOKEN`, `CF_ACCOUNT_ID` |
| **Production Mailer** | ✅ **Dual-Engine Active** | Gmail IPv4 SSL (465/587) + Resend HTTPS zero-blocked-port API | `GMAIL_APP_PASSWORD`, `RESEND_API_KEY` |
| **Supabase PostgreSQL**| ✅ **Active** | Cloud user auth, chat persistence, and telemetry storage | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |

---

## 🔀 Why 9Router & OmniRouter Were Running on Local & How We Made Them Production-Grade

### 1. The Root Cause
- **Original Local Architecture**: 9Router and OmniRoute were open-source desktop sidecar proxies that developers run on their local computers at `http://localhost:20128`.
- **The Cloud Problem**: When your NamoGPT backend was deployed to a cloud server like Render or Vercel, `localhost:20128` did not exist inside that cloud container. Calling `http://localhost:20128` from Render threw `connect ECONNREFUSED 127.0.0.1:20128`.

### 2. The Production-Grade Solution Implemented
1. **NamoGPT Native Production Cloud Bridge**:
   - The NamoGPT backend itself now serves as the **Production AI Bridge**.
   - If port 20128 is offline or running in cloud production on Render, NamoGPT's in-process bridge seamlessly activates.
   - Pings to `/api/9router/ping` and `/api/omnirouter/ping` automatically return `mode: 'production-cloud-bridge'` with HTTP 200 and all 60+ upstream models available.
   - Chat completions sent to `9router` or `omnirouter` automatically route across your active multi-provider cloud pool (Groq, Gemini, OpenRouter, NVIDIA, AION Labs 2.0, Cloudflare).
2. **Custom Remote Bridge Support**:
   - If you deploy an external OmniRoute instance anywhere in the cloud, you can optionally set `OMNIROUTER_BASE_URL=https://your-omnirouter-domain.com/v1` and `NINEROUTER_BASE_URL=...` in Render.

---

## 🚀 How to Add & Update Environment Keys on Render

Render provides a dedicated dashboard for managing production environment variables without modifying source code.

### Step 1: Open Your Render Dashboard
1. Go to [dashboard.render.com](https://dashboard.render.com) and sign in.
2. Under the **Services** list, click on your NamoGPT backend web service (e.g., `namogpt-server` or `namogpt-api`).

### Step 2: Navigate to Environment Settings
1. In the left navigation menu, click **Environment**.
2. You will see a list of existing variables and a button labeled **Add Environment Variable**.

### Step 3: Add Variables (Individual or Bulk)

#### Option A: Quick Add (Single Variable)
1. Click **Add Environment Variable**.
2. Enter the variable name in the **Key** field (e.g. `AION_API_KEY_1`).
3. Enter your secret key in the **Value** field (e.g. `alv2_...`).
4. Click **Save Changes** at the bottom.

#### Option B: Bulk Add (Secret File or Multi-Line Paste)
1. On the Environment page, click **Add Secret File** or click the **Bulk Editor** button (if available on your plan).
2. Alternatively, add each key from the table below.

### Step 4: Trigger Deployment
- Render automatically detects changes to Environment Variables and starts a **zero-downtime rolling redeploy**.
- If a redeploy does not trigger automatically, click **Manual Deploy** in the top right ➔ **Clear build cache & deploy**.

---

## 📋 Complete Render Environment Variables Template

Copy and paste these exact key names into your Render Environment tab:

```env
# Server Runtime
NODE_ENV=production
PORT=3001

# AION Labs 2.0 (Deep Reasoning)
AION_API_KEY_1=your_aion_api_key_here

# Tavily Real-Time Search Engine
TAVILY_API_KEY=your_tavily_api_key_here

# Groq Cloud LPUs (~300 tokens/sec)
GROQ_API_KEY_1=your_groq_api_key_1_here
GROQ_API_KEY_2=your_groq_api_key_2_here
GROQ_API_KEY_3=your_groq_api_key_3_here

# OpenRouter Multi-Provider Free Models
OPEN_ROUTER_API_KEY_1=your_openrouter_api_key_here

# NVIDIA NIM Accelerated Inference
NVIDIA_NIM_API_KEY_1=your_nvidia_nim_api_key_here

# Cloudflare Workers AI
CF_API_TOKEN=your_cf_api_token_here
CF_ACCOUNT_ID=your_cf_account_id_here

# Supabase Production Database
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key_here

# Production SMTP Dispatch (Gmail IPv4 SSL)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USERNAME=your_email@gmail.com
SMTP_PASSWORD=your_16_character_app_password
SMTP_FROM=NamoGPT <your_email@gmail.com>
GMAIL_USER=your_email@gmail.com
GMAIL_APP_PASSWORD=your_16_character_app_password
ADMIN_NOTIFICATION_EMAIL=your_admin_email@gmail.com

# Serverless HTTPS Mail (Never blocked by firewalls)
RESEND_API_KEY=your_resend_api_key_here

# Optional: Remote OmniRouter / 9Router (Defaults to NamoGPT in-process cloud bridge if omitted)
# OMNIROUTER_BASE_URL=https://your-omnirouter-service.onrender.com/v1
# NINEROUTER_BASE_URL=https://your-ninerouter-service.onrender.com/v1
```

> [!IMPORTANT]
> **Do not enclose values in quotation marks** in the Render dashboard. Enter raw strings like `alv2_...` directly without quotes or extra spaces.

---

## ⏳ Optional Reserve Keys (For High-Traffic Load Balancing)

Your core providers (Groq, AION Labs, OpenRouter, NVIDIA, Tavily, Resend, Supabase, SMTP) are all active. If you want even higher rate-limit quotas, you can optionally configure these reserve pools:

### 1. Groq Reserve Keys 4 through 7 (100,000+ TPM)
- Get free keys from [console.groq.com/keys](https://console.groq.com/keys) using secondary accounts.
- Set `GROQ_API_KEY_4`, `GROQ_API_KEY_5`, `GROQ_API_KEY_6`, `GROQ_API_KEY_7`.

### 2. OpenRouter Reserve Keys 2 through 7
- Create free keys at [openrouter.ai/keys](https://openrouter.ai/keys).
- Set `OPEN_ROUTER_API_KEY_2` through `OPEN_ROUTER_API_KEY_7`.

### 3. NVIDIA NIM Reserve Keys 2 through 5
- Generate free credits at [build.nvidia.com](https://build.nvidia.com).
- Set `NVIDIA_NIM_API_KEY_2` through `NVIDIA_NIM_API_KEY_5`.

### 4. Direct Google AI Studio Gemini Keys
- If you wish to use standard Google AI Studio keys directly for Gemini Flash, create keys at [aistudio.google.com/apikey](https://aistudio.google.com/apikey) (formatted with the standard `AIzaSy...` prefix).
- Set `GEMINI_API_KEY_1` through `GEMINI_API_KEY_6`.
