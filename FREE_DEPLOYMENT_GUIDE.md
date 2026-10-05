# 🌐 100% Free Cloud Deployment Guide for NamoGPT

> **Zero-cost, step-by-step deployment manual for NamoGPT — covering LiteLLM Serverless Proxy, Web Client (PWA), Android & iOS Mobile deployment with $0.00/month hosting.**

---

## 📑 Contents
1. [Cost Breakdown ($0.00 / month)](#-cost-breakdown-000--month)
2. [Step 1: Collect Free AI Model Keys](#-step-1-collect-free-ai-model-keys)
3. [Step 2: Deploy LiteLLM Proxy on Vercel](#-step-2-deploy-litellm-proxy-on-vercel)
4. [Step 3: Deploy Fullstack App on Render](#-step-3-deploy-fullstack-app-on-render-alternative)
5. [Step 4: Deploy Web UI on Vercel / Netlify](#-step-4-deploy-web-ui-on-vercel--netlify)
6. [Step 5: Run on Android & iPhone (PWA & Native Expo)](#-step-5-run-on-android--iphone-pwa--native-expo)
7. [Environment Variables Reference](#-environment-variables-reference)
8. [Health Check Verification](#-health-check-verification)

---

## 💰 Cost Breakdown ($0.00 / month)

| Service | Provider | Free Quota | Monthly Cost |
| :--- | :--- | :--- | :--- |
| **Backend API** | Vercel Serverless | 100,000 invocations / month | **$0.00** |
| **Web Frontend** | Vercel / Netlify | 100 GB global bandwidth, free SSL | **$0.00** |
| **Google Gemini** | Google AI Studio | 15 RPM, 1,048,576 token context | **$0.00** |
| **Groq Llama 3.3 70B** | Groq Cloud | 30 RPM, ~300 tokens/sec LPU speed | **$0.00** |
| **OpenRouter Models** | OpenRouter Free Tier | Nemotron 550B & DeepSeek R1 free | **$0.00** |
| **NVIDIA Nemotron 120B** | NVIDIA NIM | 1,000 free GPU credits on signup | **$0.00** |
| **Mobile App (PWA)** | Chrome / Safari | Unlimited free installs to home screen | **$0.00** |
| **Mobile Cloud Build** | Expo EAS | 30 free native cloud builds / month | **$0.00** |

---

## 🔑 Step 1: Collect Free AI Model Keys

Get your free keys in 2 minutes:

1. **Google Gemini API Key**:
   - URL: [https://aistudio.google.com/apikey](https://aistudio.google.com/apikey)
   - Click **Create API key** → Copy key.
   - Env var: `GEMINI_API_KEY_1`

2. **Groq Cloud API Key**:
   - URL: [https://console.groq.com/keys](https://console.groq.com/keys)
   - Sign up with GitHub/Google → Click **Create API Key** → Copy key.
   - Env var: `GROQ_API_KEY_1`

3. **OpenRouter API Key**:
   - URL: [https://openrouter.ai/keys](https://openrouter.ai/keys)
   - Sign in → Click **Create Key** → Copy key.
   - Env var: `OPEN_ROUTER_API_KEY_1`

4. **NVIDIA NIM API Key**:
   - URL: [https://build.nvidia.com](https://build.nvidia.com)
   - Sign up for 1,000 free credits → Select `nemotron-3-super-120b-a12b` → Click **Get API Key**.
   - Env var: `NVIDIA_NIM_API_KEY_1`

---

## ⚡ Step 2: Deploy LiteLLM Proxy on Vercel

The backend includes a pre-configured `server/vercel.json` for instant serverless deployment:

1. Go to [https://vercel.com](https://vercel.com) and log in with GitHub.
2. Click **Add New...** → **Project**.
3. Import the repository: **`Rohit-Jigar/NamoGPT`**.
4. Configure Project:
   - **Root Directory**: Select **`server`**.
   - **Framework Preset**: **Other**.
5. Add **Environment Variables**:
   ```text
   GEMINI_API_KEY_1 = <your_gemini_key>
   GROQ_API_KEY_1 = <your_groq_key>
   OPEN_ROUTER_API_KEY_1 = <your_openrouter_key>
   NVIDIA_NIM_API_KEY_1 = <your_nvidia_key>
   ```
6. Click **Deploy**.
7. Your backend proxy will be live at:
   `https://namogpt-proxy.vercel.app`

Verify deployment:
```bash
curl https://namogpt-proxy.vercel.app/health
# {"ok":true,"name":"NamoGPT LiteLLM Proxy","status":"operational"}
```

---

## 🌐 Step 3: Deploy Fullstack App on Render (Alternative)

Render allows hosting the fullstack Node.js server (both API + Web UI together from a single domain):

1. Go to [https://render.com](https://render.com) and sign in.
2. Click **New +** → **Web Service** → Connect `Rohit-Jigar/NamoGPT`.
3. Configure settings:
   - **Name**: `namogpt`
   - **Environment**: `Node`
   - **Build Command**:
     ```bash
     npm install && npm --prefix server install && npm --prefix web install && npm --prefix web run build
     ```
   - **Start Command**:
     ```bash
     node server/server.js
     ```
   - **Instance Type**: **Free** ($0.00).
4. Add Environment Variables:
   - `PORT`: `3001`
   - `GEMINI_API_KEY_1`: `<your_key>`
   - `GROQ_API_KEY_1`: `<your_key>`
5. Click **Create Web Service**.
6. Access your app at: `https://namogpt.onrender.com`.

---

## 💻 Step 4: Deploy Web UI on Vercel / Netlify

If you deployed the proxy separately in Step 2, deploy the frontend:

### On Vercel:
1. In Vercel, click **Add New...** → **Project** → select `NamoGPT`.
2. Set **Root Directory** to **`web`** (Framework: **Vite** auto-detected).
3. Set **Environment Variable**:
   ```text
   VITE_SERVER_URL = https://namogpt-proxy.vercel.app
   ```
4. Click **Deploy**.
5. Your web app is live at: `https://namogpt-web.vercel.app`.

---

## 📱 Step 5: Run on Android & iPhone (PWA & Native Expo)

### Method A: Instant PWA (No App Store Needed)

NamoGPT has built-in PWA manifest and service worker:

1. Open your live URL (e.g. `https://namogpt-web.vercel.app`) on your mobile browser.
2. **Android (Chrome)**: Tap `⋮` → **Install app** / **Add to Home screen**.
3. **iPhone (Safari)**: Tap Share icon (square with arrow) → **Add to Home Screen** → **Add**.
4. The app opens in fullscreen mode without browser URL bars, complete with app icon and splash screen.

### Method B: Native React Native Mobile App (Expo)

```bash
cd mobile
npm install

# Test on your phone with Expo Go:
npx expo start

# Build standalone Android APK for free:
npm install -g eas-cli
eas login
eas build -p android --profile preview
```

---

## ⚙️ Environment Variables Reference

| Variable Name | Required | Description | Example |
| :--- | :--- | :--- | :--- |
| `GEMINI_API_KEY_1` | Recommended | Google Gemini API key | `AIzaSy...` |
| `GROQ_API_KEY_1` | Recommended | Groq Cloud API key | `gsk_...` |
| `OPEN_ROUTER_API_KEY_1` | Optional | OpenRouter Free models key | `sk-or-...` |
| `NVIDIA_NIM_API_KEY_1` | Optional | NVIDIA NIM 120B model key | `nvapi-...` |
| `AION_API_KEY_1` | Optional | AION Labs 2.0 key | `aion-...` |
| `LITELLM_MASTER_KEY` | Optional | Master authorization token | `sk-namogpt-master` |
| `PROXY_PORT` | Optional | Server port (default: 3001) | `3001` |

---

## 🩺 Health Check Verification

Once deployed, run these commands to verify your deployment:

```bash
# 1. Check Proxy Health
curl -I https://<your-backend-url>/health

# 2. Check Available Models
curl https://<your-backend-url>/api/models

# 3. Test Chat Completion
curl -X POST https://<your-backend-url>/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "X-Model-Name: gemini" \
  -d '{"model":"gemini","messages":[{"role":"user","content":"Hi NamoGPT"}]}'
```

---

*Repository: [https://github.com/Rohit-Jigar/NamoGPT](https://github.com/Rohit-Jigar/NamoGPT)*
