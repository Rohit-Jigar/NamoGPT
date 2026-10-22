import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
const distPath = path.resolve('web/dist/assets/index-mV4zyN1x.js');
const dist = fs.readFileSync(distPath, 'utf-8');

const actualToken = process.env.CF_API_TOKEN;
const actualMaster = process.env.LITELLM_MASTER_KEY;
const actualServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
const actualGmailPass = process.env.GMAIL_APP_PASSWORD;

console.log('--- Checking if REAL Secret Values are bundled into web/dist ---');
console.log('Actual CF_API_TOKEN in bundle:', actualToken ? dist.includes(actualToken) : 'N/A');
console.log('Actual LITELLM_MASTER_KEY in bundle:', actualMaster ? dist.includes(actualMaster) : 'N/A');
console.log('Actual SUPABASE_SERVICE_ROLE_KEY in bundle:', actualServiceRole ? dist.includes(actualServiceRole) : 'N/A');
console.log('Actual GMAIL_APP_PASSWORD in bundle:', actualGmailPass ? dist.includes(actualGmailPass.trim().replace(/\s+/g, '')) : 'N/A');
console.log('Literal name "CF_API_TOKEN" in bundle:', dist.includes('CF_API_TOKEN'));
