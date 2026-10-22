import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

console.log('='.repeat(70));
console.log('🕵️ WORKER 1: SECRET & CREDENTIAL FORENSIC AUDIT');
console.log('='.repeat(70));

const findings = [];

// 1. Git Tracked Files Inspection
try {
  const trackedEnv = execSync('git ls-files .env server/.env web/.env', { encoding: 'utf-8' }).trim();
  if (trackedEnv) {
    findings.push({
      id: 'SEC-01',
      severity: 'CRITICAL',
      title: 'Secret Environment File Tracked in Git',
      detail: `Git tracked: ${trackedEnv}`
    });
  } else {
    console.log('✅ PASS: No .env files are tracked in git index.');
  }
} catch (e) {
  console.log('Git check notice:', e.message);
}

// 2. Scan Git Commit History for Credential Leaks
const sensitivePatterns = [
  { name: 'Google API Key', prefix: 'AIzaSy' },
  { name: 'Groq API Key', prefix: 'gsk_' },
  { name: 'OpenRouter Key', prefix: 'sk-or-v1-' },
  { name: 'NVIDIA NIM Key', prefix: 'nvapi-' },
  { name: 'Supabase JWT Secret / Service Role Key', prefix: 'eyJhbGciOi' },
  { name: 'Cloudflare Token prefix', prefix: 'v4.0.0-' }
];

console.log('\n[2] Scanning Git commit history for secret patterns...');
for (const p of sensitivePatterns) {
  try {
    const cmd = `git log -S "${p.prefix}" --oneline`;
    const res = execSync(cmd, { encoding: 'utf-8' }).trim();
    if (res) {
      findings.push({
        id: 'SEC-02',
        severity: 'CRITICAL',
        title: `Possible ${p.name} found in Git commit history`,
        detail: `Commits: \n${res}`
      });
      console.log(`🚨 ALERT: ${p.name} pattern ("${p.prefix}") detected in git commit history!`);
      console.log(res);
    } else {
      console.log(`✅ PASS: ${p.name} pattern not found in git commit log.`);
    }
  } catch (err) {
    console.log(`Check error for ${p.name}:`, err.message);
  }
}

// 3. Scan Web Distribution Bundles
console.log('\n[3] Scanning frontend production bundle (web/dist)...');
const distPath = path.resolve('web/dist/assets');
if (fs.existsSync(distPath)) {
  const jsFiles = fs.readdirSync(distPath).filter(f => f.endsWith('.js'));
  for (const jsFile of jsFiles) {
    const filePath = path.join(distPath, jsFile);
    const content = fs.readFileSync(filePath, 'utf-8');
    console.log(`Scanning bundle: ${jsFile} (${(content.length / 1024).toFixed(1)} KB)`);

    for (const p of sensitivePatterns) {
      if (content.includes(p.prefix)) {
        // Check if it's the anon key (which is expected to be public) or service_role
        if (p.prefix === 'eyJhbGciOi') {
          // Check if service_role is present
          if (content.includes('service_role') || (process.env.SUPABASE_SERVICE_ROLE_KEY && content.includes(process.env.SUPABASE_SERVICE_ROLE_KEY))) {
            findings.push({
              id: 'SEC-03',
              severity: 'CRITICAL',
              title: 'Supabase Service Role Key Bundled into Public Frontend Client',
              detail: `Bundle file: web/dist/assets/${jsFile}`
            });
            console.log(`🚨 CRITICAL: Supabase SERVICE ROLE key bundled into ${jsFile}!`);
          } else {
            console.log(`ℹ️ Notice: JWT header detected in frontend bundle (Expected for Supabase Anon Key).`);
          }
        } else {
          findings.push({
            id: 'SEC-04',
            severity: 'CRITICAL',
            title: `Backend Secret Pattern (${p.name}) Leaked in Frontend Bundle`,
            detail: `Bundle file: web/dist/assets/${jsFile}`
          });
          console.log(`🚨 CRITICAL: ${p.name} leaked into frontend client bundle ${jsFile}!`);
        }
      }
    }

    if (content.includes('LITELLM_MASTER_KEY') || (process.env.LITELLM_MASTER_KEY && content.includes(process.env.LITELLM_MASTER_KEY))) {
      findings.push({
        id: 'SEC-05',
        severity: 'CRITICAL',
        title: 'LiteLLM Master Key Bundled into Frontend',
        detail: `Bundle file: web/dist/assets/${jsFile}`
      });
      console.log(`🚨 CRITICAL: LiteLLM Master Key bundled into ${jsFile}!`);
    }

    if (content.includes('CF_API_TOKEN') || (process.env.CF_API_TOKEN && content.includes(process.env.CF_API_TOKEN))) {
      findings.push({
        id: 'SEC-06',
        severity: 'CRITICAL',
        title: 'Cloudflare API Token Bundled into Frontend',
        detail: `Bundle file: web/dist/assets/${jsFile}`
      });
      console.log(`🚨 CRITICAL: Cloudflare API Token bundled into ${jsFile}!`);
    }

    if (content.includes('GMAIL_APP_PASSWORD') || (process.env.GMAIL_APP_PASSWORD && content.includes(process.env.GMAIL_APP_PASSWORD))) {
      findings.push({
        id: 'SEC-07',
        severity: 'CRITICAL',
        title: 'Gmail App Password Bundled into Frontend',
        detail: `Bundle file: web/dist/assets/${jsFile}`
      });
      console.log(`🚨 CRITICAL: Gmail App Password bundled into ${jsFile}!`);
    }
  }
} else {
  console.log('web/dist/assets not found, skipping bundle check.');
}

// 4. Hardcoded Secret Defaults in Source Files
console.log('\n[4] Scanning source code for hardcoded secrets / insecure defaults...');
const sourceFiles = [
  'server/auth.js',
  'server/server.js',
  'server/mailer.js',
  'server/db.js',
  'web/src/components/auth/AuthModal3D.jsx',
  'web/src/context/AuthContext.jsx',
  'web/src/services/supabase.js'
];

for (const sf of sourceFiles) {
  if (fs.existsSync(sf)) {
    const content = fs.readFileSync(sf, 'utf-8');
    // Check hardcoded superadmin passwords
    if (content.includes('Admin@NamoGPT2026!')) {
      findings.push({
        id: 'SEC-08',
        severity: 'MEDIUM',
        title: 'Hardcoded Default Super Admin Password in Source',
        detail: `Found in ${sf}: "Admin@NamoGPT2026!"`
      });
      console.log(`⚠️ MEDIUM: Hardcoded default super admin password in ${sf}`);
    }
    // Check hardcoded JWT secret
    if (content.includes('namogpt-super-secret-jwt-key-2026')) {
      findings.push({
        id: 'SEC-09',
        severity: 'HIGH',
        title: 'Hardcoded Fallback JWT Secret in Source',
        detail: `Found in ${sf}: "namogpt-super-secret-jwt-key-2026"`
      });
      console.log(`⚠️ HIGH: Hardcoded fallback JWT secret in ${sf}`);
    }
  }
}

console.log('\n' + '='.repeat(70));
console.log(`Worker 1 Audit Complete: ${findings.length} finding(s) detected.`);
console.log('='.repeat(70));
