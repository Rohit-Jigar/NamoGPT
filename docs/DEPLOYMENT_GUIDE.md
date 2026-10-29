# 🚀 100% Free Deployment Guide for NamoGPT

> **Complete step-by-step guide to deploying NamoGPT (Web, Mobile PWA, React Native App, and LiteLLM Proxy) with $0.00/month hosting, free SSL certificates, and free AI model APIs.**

---

## 📋 Table of Contents
1. [Zero-Cost Architecture](#-zero-cost-architecture)
2. [Step 1: Collect Your 100% Free AI API Keys](#-step-1-collect-your-100-free-ai-api-keys)
3. [Step 2: Deploy the LiteLLM Backend Proxy](#-step-2-deploy-the-litellm-backend-proxy)
   - [Option A: Vercel (Recommended - Serverless)](#option-a-vercel-recommended)
   - [Option B: Render (Full Node.js Express Instance)](#option-b-render-free-web-service)
4. [Step 3: Deploy the Web & PWA Client](#-step-3-deploy-the-web--pwa-client)
   - [Option A: Vercel](#option-a-vercel-web-deployment)
   - [Option B: Netlify](#option-b-netlify-web-deployment)
5. [Step 4: Deploy & Install on Mobile (Android & iPhone)](#-step-4-deploy--install-on-mobile-android--iphone)
   - [Option A: Zero-Install PWA (Instant)](#option-a-progressive-web-app-pwa---instant)
   - [Option B: Native Mobile App via Expo & EAS](#option-b-native-mobile-app-via-expo--eas)
6. [Step 5: Verification & Health Checks](#-step-5-verification--health-checks)
7. [Troubleshooting & FAQs](#-troubleshooting--faqs)

---

## 💰 Zero-Cost Architecture

Every single component in this stack runs within generous permanent free tiers:

| Component | Platform | Free Tier Quota | Cost |
| :--- | :--- | :--- | :--- |
| **Backend Proxy** | Vercel Serverless / Render | 100,000 req/mo (Vercel) / 750 free hrs/mo (Render) | **$0.00** |
| **Web Frontend & PWA** | Vercel / Netlify | 100 GB bandwidth/mo, unlimited deployments | **$0.00** |
| **Google Gemini API** | Google AI Studio | 15 RPM, 1M context window | **$0.00** |
| **Groq Cloud API** | Groq Console | 30 RPM, 14,400 req/day (~300 tokens/s) | **$0.00** |
| **OpenRouter Free Tier** | OpenRouter.ai | Free access to Nemotron 550B & DeepSeek R1 | **$0.00** |
| **NVIDIA NIM** | NVIDIA Build | 1,000 free GPU credits on registration | **$0.00** |
| **Mobile App (PWA)** | Web App Manifest | Unlimited installs via Chrome / Safari | **$0.00** |
| **Mobile Native Build** | Expo Application Services | 30 free cloud builds per month | **$0.00** |
| **Total Monthly Cost** | | | **$0.00 / month** |

---

## 🔑 Step 1: Collect Your 100% Free AI API Keys

Get your free keys in less than 5 minutes:

### 1. Google Gemini (1M Context + Multimodal)
1. Go to [Google AI Studio](https://aistudio.google.com/apikey).
2. Sign in with any Google account.
3. Click **"Create API key"** and copy your key.
*(Save as `GEMINI_API_KEY_1`)*.

### 2. Groq Cloud (Ultra-Fast 300 tokens/s Llama 3.3 & DeepSeek R1)
1. Go to [Groq Cloud Console](https://console.groq.com/keys).
2. Sign up with Google or GitHub.
3. Click **"Create API Key"**, give it a name (e.g. `NamoGPT`), and copy your key.
*(Save as `GROQ_API_KEY_1`)*.

### 3. OpenRouter (Free Nemotron 550B & DeepSeek R1)
1. Go to [OpenRouter Keys](https://openrouter.ai/keys).
2. Sign in with Google or GitHub.
3. Click **"Create Key"** and copy your key.
*(Save as `OPEN_ROUTER_API_KEY_1`)*.

### 4. NVIDIA NIM (Nemotron 3 Super 120B)
1. Go to [NVIDIA Build](https://build.nvidia.com).
2. Sign up for a free developer account (includes 1,000 free inference credits).
3. Select any model (e.g. `nemotron-3-super-120b-a12b`), click **"Get API Key"**, and copy it.
*(Save as `NVIDIA_NIM_API_KEY_1`)*.

---

## ⚡ Step 2: Deploy the LiteLLM Backend Proxy

### Option A: Vercel (Recommended)

Because the proxy includes a pre-configured [`server/vercel.json`](file:///D:/NamoGPT/server/vercel.json) and [`server/api/index.js`](file:///D:/NamoGPT/server/api/index.js), it deploys to Vercel in 1 click:

1. **Push your code to GitHub**: (Already completed at `https://github.com/Rohit-Jigar/NamoGPT`).
2. Go to [Vercel.com](https://vercel.com) and log in with GitHub.
3. Click **"Add New..."** → **"Project"**.
4. Import the **`NamoGPT`** repository.
5. In the configuration screen:
   - **Root Directory**: Click *Edit* and select **`server`**.
   - **Framework Preset**: Leave as *Other*.
6. Expand **Environment Variables** and add your keys:
   ```env
   GEMINI_API_KEY_1=AIzaSy...
   GROQ_API_KEY_1=gsk_...
   OPEN_ROUTER_API_KEY_1=sk-or-...
   NVIDIA_NIM_API_KEY_1=nvapi-...
   ```
7. Click **"Deploy"**.
8. In ~30 seconds, Vercel will give you a public URL:
   `https://namogpt-proxy.vercel.app`

Test your live proxy health check:
```bash
curl https://namogpt-proxy.vercel.app/health
# Output: {"ok":true,"name":"NamoGPT LiteLLM Proxy","status":"operational"}
```

---

### Option B: Render (Free Web Service)

Render runs a continuous Node.js process that can serve **both** the backend API and the compiled Web UI from a single URL:

1. Go to [Render.com](https://render.com) and sign in.
2. Click **"New +"** → **"Web Service"**.
3. Connect your GitHub repository: `Rohit-Jigar/NamoGPT`.
4. Configure the service:
   - **Name**: `namogpt`
   - **Language**: `Node`
   - **Branch**: `main`
   - **Build Command**:
     ```bash
     npm install && npm --prefix server install && npm --prefix web install && npm --prefix web run build
     ```
   - **Start Command**:
     ```bash
     node server/server.js
     ```
   - **Instance Type**: Select **Free** ($0/month).
5. Add your Environment Variables:
   - `PORT`: `3001`
   - `GEMINI_API_KEY_1`: `AIzaSy...`
   - `GROQ_API_KEY_1`: `gsk_...`
6. Click **"Create Web Service"**.
7. Render will build both the frontend and backend, giving you a live URL:
   `https://namogpt.onrender.com`

---

## 💻 Step 3: Deploy the Web & PWA Client

If you used Vercel for your backend in Step 2, deploy the frontend separately on Vercel:

### Option A: Vercel (Web Deployment)

1. Open [Vercel Dashboard](https://vercel.com).
2. Click **"Add New..."** → **"Project"**.
3. Select `NamoGPT` again.
4. Set:
   - **Project Name**: `namogpt-web`
   - **Root Directory**: Select **`web`**.
   - **Framework Preset**: **Vite** (auto-detected).
5. Under **Environment Variables**, add:
   ```env
   VITE_SERVER_URL=https://namogpt-proxy.vercel.app
   ```
   *(Replace with your live backend proxy URL from Step 2)*.
6. Click **"Deploy"**.
7. You now have a blazing fast, globally distributed web app:
   `https://namogpt-web.vercel.app`

---

### Option B: Netlify (Web Deployment)

1. Go to [Netlify.com](https://netlify.com) and log in.
2. Click **"Add new site"** → **"Import an existing project"** → **GitHub**.
3. Select `Rohit-Jigar/NamoGPT`.
4. Configure build settings:
   - **Base directory**: `web`
   - **Build command**: `npm run build`
   - **Publish directory**: `web/dist`
5. Click **"Deploy site"**.

---

## 📱 Step 4: Deploy & Install on Mobile (Android & iPhone)

### Option A: Progressive Web App (PWA) - Instant

NamoGPT includes a fully configured PWA manifest and service worker. You do not need to submit to App Stores to install it!

#### On Android (Chrome / Brave / Edge):
1. Open your live web URL (e.g. `https://namogpt-web.vercel.app`) in Chrome.
2. Chrome will automatically show an **"Add NamoGPT to Home screen"** banner at the bottom.
3. If not shown, tap the **⋮ (three dots)** menu in the top-right corner.
4. Tap **"Install app"** or **"Add to Home screen"**.
5. NamoGPT will be installed as a standalone app with its own app icon, splash screen, and offline support.

#### On iPhone / iPad (Safari):
1. Open your live web URL in **Safari**.
2. Tap the **Share icon** (square with an upward arrow) in the bottom navigation bar.
3. Scroll down and tap **"Add to Home Screen"**.
4. Tap **"Add"** in the top right.
5. The NamoGPT icon will appear on your iOS home screen and open without the Safari URL bar.

---

### Option B: Native Mobile App via Expo & EAS

To build native `.apk` (Android) or `.ipa` (iOS) binaries:

1. Navigate to the mobile folder:
   ```bash
   cd mobile
   npm install
   ```

2. Test locally on your phone using **Expo Go**:
   ```bash
   npx expo start
   ```
   - Download the free **Expo Go** app from Google Play Store or Apple App Store.
   - Scan the terminal QR code with your phone camera to run NamoGPT immediately.

3. Build a standalone Android APK (100% Free via EAS):
   ```bash
   npm install -g eas-cli
   eas login
   eas build:configure
   eas build -p android --profile preview
   ```
   Expo will compile your APK in the cloud for free and provide a direct download link.

---

## 🩺 Step 5: Verification & Health Checks

Once deployed, verify your setup:

1. **Proxy Health Check**:
   ```bash
   curl -I https://<your-backend-url>/health
   # Expected: HTTP 200 OK
   ```

2. **Model Catalog Check**:
   ```bash
   curl https://<your-backend-url>/api/models
   # Expected: JSON list of all 8 free models
   ```

3. **Live Chat Completion Test**:
   ```bash
   curl -X POST https://<your-backend-url>/v1/chat/completions \
     -H "Content-Type: application/json" \
     -H "X-Model-Name: gemini" \
     -d '{
       "model": "gemini",
       "messages": [{"role": "user", "content": "Ping!"}]
     }'
   ```

---

## ❓ Troubleshooting & FAQs

### Q1: I see `"No healthy upstreams for pool"`
- **Cause**: You haven't added an API key for that specific model pool yet.
- **Fix**: Open the NamoGPT web UI, click **Settings ⚙️** in the bottom-left sidebar, paste your free API key, and click **Save**. Alternatively, add the key to your Vercel/Render environment variables.

### Q2: How do I change the backend URL in the web app?
- In the web app, click **Settings ⚙️** → **LiteLLM Server** tab → update the URL to your live backend endpoint.

### Q3: How do multiple API keys work in the pool?
- In [`config.yaml`](file:///D:/NamoGPT/config.yaml), you can list multiple keys for the same provider (e.g. `GEMINI_API_KEY_1`, `GEMINI_API_KEY_2`, etc.).
- When requests come in, LiteLLM rotates through the keys using round-robin and automatically tracks RPM limits. If one key hits a rate limit, it fails over to the next key or provider seamlessly.

### Q4: Is my conversation history stored on a server?
- **No.** All conversations and settings are stored locally in your browser's `localStorage`. Your chats remain private to your device.
