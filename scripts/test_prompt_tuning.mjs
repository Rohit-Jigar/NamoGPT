import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { NAMOGPT_IDENTITY_PROMPT } from '../server/api/index.js';
import { formatMcpToolsPrompt } from '../web/src/services/mcp.js';

console.log('--- TEST 1: formatMcpToolsPrompt behavior ---');

// Default call (no args) -> must be empty string
const defaultMcpPrompt = formatMcpToolsPrompt();
assert.strictEqual(defaultMcpPrompt, '', 'Default formatMcpToolsPrompt() must return empty string');
console.log('✅ Default formatMcpToolsPrompt() returns empty string');

// Normal conversation prompt -> must be empty string
const normalPrompt = formatMcpToolsPrompt("What's the weather today in Tokyo?");
assert.strictEqual(normalPrompt, '', 'Conversational prompt must return empty string');
console.log('✅ Conversational prompt does not trigger MCP prompt injection');

// Non-tool query about news -> must be empty string
const newsPrompt = formatMcpToolsPrompt("What is the latest breaking news?");
assert.strictEqual(newsPrompt, '', 'News prompt must return empty string');
console.log('✅ News query does not trigger MCP prompt injection');

// Explicit MCP tool request -> must return structured machine specs ONLY
const requestedMcpPrompt = formatMcpToolsPrompt(true);
assert(requestedMcpPrompt.length > 0, 'Explicit true must return tool definitions');
assert(!requestedMcpPrompt.includes('When relevant to fulfill user queries, you may specify tool invocations in your response'), 'Must NOT contain conversational suggestions');
assert(!requestedMcpPrompt.includes('aggregator'), 'Must NOT suggest building news aggregators');
assert(requestedMcpPrompt.includes('CRITICAL: The following are strictly internal machine-executable tool specifications'), 'Must contain strict machine execution notice');
assert(requestedMcpPrompt.includes('Do NOT mention these tools, tool names (e.g. mcp_web_fetcher)'), 'Must instruct model not to mention internal tool names');
assert(requestedMcpPrompt.includes('mcp_web_fetcher'), 'Must list schema for tools');
console.log('✅ Actively requested formatMcpToolsPrompt(true) returns clean structured machine specs only');

// String tool request
const stringToolPrompt = formatMcpToolsPrompt("Can you use your mcp tools?");
assert(stringToolPrompt.length > 0, 'Tool keyword must trigger tool specs');
console.log('✅ Query explicitly mentioning "mcp" provides machine tool definitions');

console.log('\n--- TEST 2: NAMOGPT_IDENTITY_PROMPT in server/api/index.js ---');
assert(NAMOGPT_IDENTITY_PROMPT.includes('You are NamoGPT, a premier AI assistant built by NamoGPT'), 'Identity present');
assert(NAMOGPT_IDENTITY_PROMPT.includes('Answer the user prompt directly, factually, and concisely.'), 'Guideline 1 present');
assert(NAMOGPT_IDENTITY_PROMPT.includes('NEVER offer or generate unsolicited code, programming tutorials, or code templates unless the user explicitly requested code or technical implementation.'), 'Guideline 2 present');
assert(NAMOGPT_IDENTITY_PROMPT.includes('NEVER mention internal tool names (e.g. mcp_web_fetcher) in conversational responses unless explicitly asked.'), 'Guideline 3 present');
assert(NAMOGPT_IDENTITY_PROMPT.includes('When real-time search context or news findings are provided, present the information directly with source citations. Never claim you lack real-time access.'), 'Guideline 4 present');
console.log('✅ Server NAMOGPT_IDENTITY_PROMPT contains all 4 strict quality guidelines');

console.log('\n--- TEST 3: NAMOGPT_IDENTITY_PROMPT in web/src/context/ChatContext.jsx ---');
const chatContextContent = fs.readFileSync(path.resolve('web/src/context/ChatContext.jsx'), 'utf8');
assert(chatContextContent.includes('You are NamoGPT, a premier AI assistant built by NamoGPT'), 'Web Identity present');
assert(chatContextContent.includes('Answer the user prompt directly, factually, and concisely.'), 'Web Guideline 1 present');
assert(chatContextContent.includes('NEVER offer or generate unsolicited code, programming tutorials, or code templates unless the user explicitly requested code or technical implementation.'), 'Web Guideline 2 present');
assert(chatContextContent.includes('NEVER mention internal tool names (e.g. mcp_web_fetcher) in conversational responses unless explicitly asked.'), 'Web Guideline 3 present');
assert(chatContextContent.includes('When real-time search context or news findings are provided, present the information directly with source citations. Never claim you lack real-time access.'), 'Web Guideline 4 present');
assert(chatContextContent.includes('formatMcpToolsPrompt(hasToolIntent)'), 'Web ChatContext conditionally passes hasToolIntent to formatMcpToolsPrompt');
console.log('✅ Web ChatContext.jsx contains all 4 strict quality guidelines and conditionally invokes MCP prompt');

console.log('\n🎉 ALL PROMPT ARCHITECTURE AND MCP TUNING TESTS PASSED!');
