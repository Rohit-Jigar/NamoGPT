import express from 'express';
import morgan from 'morgan';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import handler from './api/index.js';
import openapi from './openapi.js';

// Load .env from server dir or root
if (fs.existsSync(path.resolve(process.cwd(), '.env'))) {
  dotenv.config({ path: path.resolve(process.cwd(), '.env') });
} else if (fs.existsSync(path.resolve(process.cwd(), '..', '.env'))) {
  dotenv.config({ path: path.resolve(process.cwd(), '..', '.env') });
} else {
  dotenv.config();
}

const app = express();
const port = Number(process.env.PROXY_PORT || process.env.PORT || 3001);

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Model-Name', 'X-Gemini-Key', 'X-Groq-Key', 'X-OpenRouter-Key', 'X-Nvidia-Key', 'X-Aion-Key']
}));

app.use(morgan('dev'));
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// Swagger & OpenAPI
app.get('/openapi.json', (_req, res) => res.json(openapi));
app.get(['/docs', '/docs/'], (_req, res) => {
  res.type('html').send(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>NamoGPT LiteLLM Proxy API Docs</title>
    <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css">
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
    <script>SwaggerUIBundle({ url: '/openapi.json', dom_id: '#swagger-ui', deepLinking: true, persistAuthorization: true });</script>
  </body>
</html>`);
});

// Serve frontend web dist if available
const webDistCandidates = [
  path.resolve(process.cwd(), '..', 'web', 'dist'),
  path.resolve(process.cwd(), 'web', 'dist'),
  path.resolve(process.cwd(), 'dist')
];

let activeWebDist = null;
for (const cand of webDistCandidates) {
  if (fs.existsSync(cand) && fs.existsSync(path.join(cand, 'index.html'))) {
    activeWebDist = cand;
    break;
  }
}

if (activeWebDist) {
  console.log(`Serving NamoGPT Web UI from: ${activeWebDist}`);
  app.use(express.static(activeWebDist));

  // Single page app fallback for GET requests that are not API paths
  app.get('*', (req, res, next) => {
    const p = req.path;
    if (p.startsWith('/v1') || p.startsWith('/api') || p === '/health' || p.startsWith('/docs') || p.startsWith('/openapi')) {
      return next();
    }
    res.sendFile(path.join(activeWebDist, 'index.html'));
  });
}

// All remaining requests routed to LiteLLM handler
app.all('*', handler);

app.listen(port, () => {
  console.log(`
  ╔═══════════════════════════════════════════════════════════════╗
  ║                 ✨ NamoGPT LiteLLM Server ✨                  ║
  ║                                                               ║
  ║  📡 Status: Operational on port ${port}                          ║
  ║  💻 Web UI: http://localhost:${port}                             ║
  ║  ⚡ OpenAI API: http://localhost:${port}/v1/chat/completions     ║
  ║  📋 Model Catalog: http://localhost:${port}/api/models            ║
  ║  📖 API Docs: http://localhost:${port}/docs                       ║
  ╚═══════════════════════════════════════════════════════════════╝
  `);
});
