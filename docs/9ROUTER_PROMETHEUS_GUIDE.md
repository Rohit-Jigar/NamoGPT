# 🚀 9Router & Prometheus Integration Guide for NamoGPT

This guide explains how **9Router** (local AI router for coding agents & multi-provider fallback) and **Prometheus** (systems metrics & observability) are integrated into NamoGPT, and how you can run and use them.

---

## Part 1: 9Router Integration (`decolua/9router`)

### 1. What is 9Router?
**[9Router](https://github.com/decolua/9router)** is an open-source local proxy built for AI coding assistants and power users. It sits between AI clients (Cursor, Claude Code, Cline, NamoGPT) and AI model providers.

Key capabilities:
* **40+ AI Providers**: Access Claude 3.5 Sonnet, GPT-4o, DeepSeek, and more through a unified local endpoint (`http://localhost:20128/v1`).
* **3-Tier Intelligent Fallback**: Automatically cascades requests: **Subscription $\rightarrow$ Cheap Pay-as-you-go $\rightarrow$ Free Tier** to eliminate downtime.
* **Token Optimization (RTK)**: Compresses prompts to save tokens and inference costs.

---

### 2. How 9Router Connects to NamoGPT
NamoGPT treats 9Router as a local upstream bridge in its model pool:

```
[ NamoGPT Web UI / Mobile App ]
              │
              ▼
    [ NamoGPT LiteLLM Proxy (Port 3001) ]
       │                         │
       ├─► Google Gemini         ├─► Groq Cloud
       ├─► OpenRouter            ├─► NVIDIA NIM
       └─► 9Router Bridge (Port 20128)
                 │
                 ▼
           [ 9Router Engine ]
           ├── Claude 3.5 Sonnet
           ├── OpenAI GPT-4o
           └── 40+ Configured Providers
```

---

### 3. Setting Up 9Router Locally

1. **Install 9Router globally via npm**:
   ```bash
   npm install -g 9router
   ```

2. **Start the 9Router daemon**:
   ```bash
   9router start
   ```
   * By default, 9Router listens on `http://localhost:20128`.
   * Open the 9Router Web Dashboard at `http://localhost:20128` to link your provider accounts or API keys.

---

### 4. Using 9Router in NamoGPT

1. Open the NamoGPT Web UI at `http://localhost:3001`.
2. Click **⚙️ Settings** in the bottom-left sidebar.
3. Switch to the **9Router Bridge** tab:
   * **Enable 9Router Bridge**: Toggle ON.
   * **Base URL**: Defaults to `http://localhost:20128/v1`.
   * **API Key**: Enter your 9Router access key if authentication is enabled in your 9Router config (or leave blank for open local mode).
   * **Test Connection**: Click **"Test Connection"** to verify live communication with 9Router.
4. In the top model dropdown in NamoGPT, select:
   * **`Claude 3.5 Sonnet (via 9Router)`** (Badge: `9Router Local`).
5. Send your message—NamoGPT will route it through your local 9Router daemon with 3-tier fallback!

---

## Part 2: Prometheus Metrics & Monitoring (`prometheus/prometheus`)

### 1. What is Prometheus?
**[Prometheus](https://github.com/prometheus/prometheus)** is the industry-standard cloud-native time-series database and metrics engine.

NamoGPT instruments all proxy traffic with Prometheus metrics, giving you real-time visibility into:
* Request rates and HTTP status codes
* P50, P90, and P99 latency histograms per model
* Token usage counters (prompt vs completion vs total)
* Provider failovers and rate-limit recovery
* Active concurrent stream connections
* Node.js runtime health (CPU, RSS memory, heap allocation, event loop lag)

---

### 2. Built-in Metrics Endpoint
NamoGPT exports standard Prometheus metrics out-of-the-box at:

```
GET http://localhost:3001/metrics
```

#### Sample Metrics Output:
```text
# HELP namogpt_http_requests_total Total number of HTTP requests processed by NamoGPT
# TYPE namogpt_http_requests_total counter
namogpt_http_requests_total{method="POST",route="/v1/chat/completions",status_code="200",model="gemini"} 14

# HELP namogpt_http_request_duration_seconds HTTP request duration in seconds
# TYPE namogpt_http_request_duration_seconds histogram
namogpt_http_request_duration_seconds_bucket{le="0.5",model="gemini",route="/v1/chat/completions"} 8
namogpt_http_request_duration_seconds_bucket{le="2",model="gemini",route="/v1/chat/completions"} 14

# HELP namogpt_tokens_total Total number of tokens processed (prompt, completion, total)
# TYPE namogpt_tokens_total counter
namogpt_tokens_total{model="gemini",type="prompt"} 320
namogpt_tokens_total{model="gemini",type="completion"} 890
namogpt_tokens_total{model="gemini",type="total"} 1210

# HELP namogpt_failovers_total Total number of provider failover events
# TYPE namogpt_failovers_total counter
namogpt_failovers_total{model="gemini",from_idx="0",to_idx="1",reason="upstream_503"} 1

# HELP namogpt_active_connections Current number of active connections to NamoGPT
# TYPE namogpt_active_connections gauge
namogpt_active_connections 0
```

---

### 3. Running Prometheus & Grafana (1-Command Docker Setup)

The repository includes a ready-to-run monitoring stack in the [`monitoring/`](file:///D:/NamoGPT/monitoring) directory:

1. **Navigate to the monitoring folder**:
   ```bash
   cd monitoring
   ```

2. **Launch Prometheus & Grafana**:
   ```bash
   docker compose -f docker-compose.monitoring.yml up -d
   ```

3. **Access Dashboards**:
   * **Prometheus Targets & Query UI**: `http://localhost:9090`
   * **Grafana Dashboard**: `http://localhost:3000` (User: `admin`, Password: `admin`)

4. **Import the Pre-Built Dashboard**:
   * In Grafana, click **Dashboards $\rightarrow$ New $\rightarrow$ Import**.
   * Upload or paste the contents of [`monitoring/grafana-dashboard.json`](file:///D:/NamoGPT/monitoring/grafana-dashboard.json).
   * Click **Import**! You now have a real-time command center showing:
     * 📈 Requests per Second (RPS)
     * ⚡ P90 & P99 Latency by Model
     * 🪙 Token Consumption Throughput
     * ⚠️ Failovers & Upstream Errors
     * 💻 CPU & Memory Utilization

---

## 4. Key Files Reference

| File | Purpose |
| :--- | :--- |
| [`server/metrics.js`](file:///D:/NamoGPT/server/metrics.js) | Prometheus registry, metrics instrumentation, and helper collectors. |
| [`server/server.js`](file:///D:/NamoGPT/server/server.js) | Exposes `GET /metrics` and `/api/9router/ping` diagnostic endpoint. |
| [`config.yaml`](file:///D:/NamoGPT/config.yaml) | Configures the `9router` pool pointing to `http://localhost:20128/v1`. |
| [`server/models-metadata.js`](file:///D:/NamoGPT/server/models-metadata.js) | Model definition for `9router` (Claude 3.5 Sonnet). |
| [`web/src/components/SettingsModal.jsx`](file:///D:/NamoGPT/web/src/components/SettingsModal.jsx) | UI tab for 9Router configuration, toggles, and live connectivity ping. |
| [`monitoring/prometheus.yml`](file:///D:/NamoGPT/monitoring/prometheus.yml) | Prometheus scrape job configuration for NamoGPT. |
| [`monitoring/docker-compose.monitoring.yml`](file:///D:/NamoGPT/monitoring/docker-compose.monitoring.yml) | Multi-container Docker compose for Prometheus + Grafana. |
| [`monitoring/grafana-dashboard.json`](file:///D:/NamoGPT/monitoring/grafana-dashboard.json) | Ready-to-import Grafana dashboard with 5 visual telemetry panels. |
