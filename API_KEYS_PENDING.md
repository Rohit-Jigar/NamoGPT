# 🔑 NamoGPT — API Keys & Status Guide

---

### ⚡ 3-Line Setup Guide
1. Open or create the [`.env`](file:///D:/NamoGPT/.env) file located in the project root directory.
2. Paste your API key right after the `=` sign (e.g., `GEMINI_API_KEY_1=your_key_here`).
3. Save the file and restart the server (`npm start`) — all keys load automatically!

---

## ✅ 1. Working & Configured Keys

These providers are already configured in `.env` or connected via local routing bridges:

| Provider / Engine | Primary Model(s) | Status | Key Variable in `.env` | Access / Console |
| :--- | :--- | :---: | :--- | :--- |
| **Gemini** | Gemini 2.5 Flash / Pro | ✅ Active (Pool of 6) | `GEMINI_API_KEY_1`..`6` | [Google AI Studio](https://aistudio.google.com/) |
| **Groq** | Llama 3.3 70B, GPT-OSS 120B | ✅ Active (Pool of 3) | `GROQ_API_KEY_1`..`3` | [Groq Cloud Console](https://console.groq.com/keys) |
| **OpenRouter** | 200+ Multi-Provider Models | ✅ Active | `OPEN_ROUTER_API_KEY_1` | [OpenRouter Dashboard](https://openrouter.ai/keys) |
| **NVIDIA NIM** | Nemotron-3 Super 120B | ✅ Active | `NVIDIA_NIM_API_KEY_1` | [NVIDIA Build NIM](https://build.nvidia.com) |
| **9Router / OmniRouter** | Universal Local Bridge | ✅ Active (Port 20128) | `OMNIROUTER_API_KEY` *(Optional)* | [OmniRoute GitHub](https://github.com/diegosouzapw/OmniRoute) |

---

## ⏳ 2. Pending Keys (Free Setup)

Add these free keys to unlock full fallback redundancy across all fallback pools:

| Provider | Environment Variable | Free Quota | Direct Portal Link | Quick Action |
| :--- | :--- | :--- | :--- | :--- |
| **AION Labs 2.0** | `AION_API_KEY_1` (up to `_8`) | Free Developer Tier | [AION Labs Portal](https://aionlabs.ai) | Sign up, generate an API token, and paste into `AION_API_KEY_1`. |
| **Cloudflare Workers AI** | `CF_ACCOUNT_ID`<br/>`CF_API_TOKEN` | 10,000 Neurons/Day Free | [Cloudflare Dashboard](https://dash.cloudflare.com/)<br/>[Create API Token](https://dash.cloudflare.com/profile/api-tokens) | 1. Copy **Account ID** from Workers overview.<br/>2. Create token with **Workers AI: Read/Edit** permissions. |

---

## 🔍 3. Optional Dedicated Search Keys

> **💡 Zero Key Needed by Default**: NamoGPT includes real-time web retrieval via **DuckDuckGo** and **Wikipedia** right out of the box with **zero API keys required**.
> 
> If you want dedicated structured search, you can add any of the following providers (recommended: **Tavily** for AI agents):

| Search Provider | Free Allowance | Direct Signup Link | Best For |
| :--- | :--- | :--- | :--- |
| **Tavily AI** *(Recommended)* | **1,000 queries / month free** | [tavily.com](https://tavily.com) | Clean, LLM-optimized structured search results |
| **Serper.dev** | **2,500 Google queries free** | [serper.dev](https://serper.dev) | High-speed Google search JSON API |
| **Google Custom Search** | **100 queries / day free** | [Programmable Search Engine](https://programmablesearchengine.google.com/) & [GCP Console](https://console.cloud.google.com/) | Native Google web search |
| **Bing Web Search** | **1,000 queries / month free** | [Azure Portal](https://portal.azure.com/) / [Bing API](https://www.microsoft.com/en-us/bing/apis/bing-web-search-api) | Microsoft Bing search index |

---

### 📋 Example `.env` Snippet

```env
# Configured LLM Providers
GEMINI_API_KEY_1=AIzaSy...
GROQ_API_KEY_1=gsk_...
OPEN_ROUTER_API_KEY_1=sk-or-v1-...
NVIDIA_NIM_API_KEY_1=nvapi-...

# Pending Providers
AION_API_KEY_1=your_aion_key_here
CF_ACCOUNT_ID=your_cloudflare_account_id
CF_API_TOKEN=your_cloudflare_api_token

# Optional Dedicated Search
TAVILY_API_KEY=tvly-...

# Supabase Cloud Database (Primary DB)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...

# Gmail Automated Email Dispatch
GMAIL_USER=rohitjigarmaheshbhai@gmail.com
GMAIL_APP_PASSWORD=your_16_char_app_password
```

---

## 🗄️ 4. Supabase Database Configuration

NamoGPT natively uses **Supabase** (Postgres + Row-Level Security) to persist registered users and ChatGPT-style multi-turn conversation history.

| Service | Environment Variable | Free Quota | Direct Portal Link | Quick Setup Action |
| :--- | :--- | :--- | :--- | :--- |
| **Supabase** | `SUPABASE_URL`<br/>`SUPABASE_SERVICE_ROLE_KEY` *(or `SUPABASE_KEY`)* | 500 MB DB + 50,000 MAU Free | [supabase.com](https://supabase.com/dashboard) | 1. Create a free project at [supabase.com](https://supabase.com).<br/>2. In **Project Settings ➔ API**, copy `Project URL` and `service_role secret` (or `anon public`).<br/>3. Run the SQL migration from [`supabase/migrations/20261012180000_create_users_and_chats.sql`](file:///D:/NamoGPT/supabase/migrations/20261012180000_create_users_and_chats.sql) in your Supabase SQL Editor.<br/>4. Paste into `.env`! |

> **💡 Zero Downtime Fallback**: If `SUPABASE_URL` is omitted, NamoGPT operates seamlessly on atomic local JSON storage without any interruption.

---

## 📧 5. Gmail App Password Configuration

NamoGPT automatically creates usernames and passwords upon user registration and delivers credentials via email.

| Service | Environment Variable | Purpose | Setup Link | Quick Setup Action |
| :--- | :--- | :--- | :--- | :--- |
| **Google Gmail** | `GMAIL_USER`<br/>`GMAIL_APP_PASSWORD` | Sends login credentials to new users and alerts to `rohitjigarmaheshbhai@gmail.com` | [Google App Passwords](https://myaccount.google.com/apppasswords) | 1. Enable 2-Step Verification on your Google Account.<br/>2. Go to **App Passwords**, type "NamoGPT", click Create.<br/>3. Copy the 16-character password into `GMAIL_APP_PASSWORD` in your `.env`. |

> **💡 Space Handling**: You can paste your App Password with or without spaces (e.g., `abcd efgh ijkl mnop` or `abcdefghijklmnop`) — NamoGPT automatically cleans and strips whitespace!

