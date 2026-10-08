/**
 * Namo Coder - Comprehensive End-to-End Test Suite
 * 
 * Tests all core backend engine modules and HTTP API endpoints:
 * 1. workspace.js (sandbox traversal prevention, file operations, tree, ignores)
 * 2. intelligence.js (AST/regex symbol extraction for 8 languages, lexical grep)
 * 3. checkpoints.js (snapshot creation, listing, atomic rollback, deletion)
 * 4. diff.js (LCS unified diff, structured hunks, patch application)
 * 5. terminal.js (command runner, output capture, guardrails, timeout safety)
 * 6. agent.js (autonomous coder agent loop, tool dispatch, diff proposals)
 * 7. Express HTTP endpoints on /api/coder/*
 */

import express from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import {
  getWorkspaceRoot,
  setWorkspaceRoot,
  resolveSafePath,
  writeFileContent,
  readFileContent,
  listFiles,
  getFileTree,
  deleteFile,
  createDirectory
} from './coder/workspace.js';
import { extractSymbols, grepSearch } from './coder/intelligence.js';
import { computeDiff, applyPatch, parseUnifiedDiff } from './coder/diff.js';
import { executeCommand, validateCommandSafety } from './coder/terminal.js';
import {
  createCheckpoint,
  listCheckpoints,
  rollbackCheckpoint,
  deleteCheckpoint
} from './coder/checkpoints.js';
import {
  CODER_AGENT_TOOLS,
  executeAgentTool,
  runCoderAgent
} from './coder/agent.js';
import coderRouter from './coder/router.js';

let passedTests = 0;
let failedTests = 0;
const testResults = [];

function assert(condition, testName, details = '') {
  if (condition) {
    passedTests++;
    testResults.push({ name: testName, status: 'PASS', details });
    console.log(`  \x1b[32m✔ PASS\x1b[0m: ${testName}`);
  } else {
    failedTests++;
    testResults.push({ name: testName, status: 'FAIL', details });
    console.error(`  \x1b[31m✖ FAIL\x1b[0m: ${testName} ${details ? `(${details})` : ''}`);
  }
}

async function runTestSuite() {
  console.log('\n\x1b[1m\x1b[36m===============================================================');
  console.log('       🚀 NAMO CODER BACKEND CORE ENGINE E2E TEST SUITE        ');
  console.log('===============================================================\x1b[0m\n');

  const originalRoot = getWorkspaceRoot();
  const testWorkspaceDir = path.resolve(originalRoot, 'test_sandbox_workspace');

  try {
    // -------------------------------------------------------------
    // SECTION 1: WORKSPACE SANDBOX & FILESYSTEM ENGINE
    // -------------------------------------------------------------
    console.log('\x1b[1m\x1b[34m[1/7] Testing Workspace Sandbox & Filesystem Engine...\x1b[0m');

    setWorkspaceRoot(testWorkspaceDir);
    assert(getWorkspaceRoot() === testWorkspaceDir, 'setWorkspaceRoot updates current active root');

    // Security test: Path traversal prevention
    let traversalBlocked = false;
    try {
      resolveSafePath('../../escaped_secret.txt');
    } catch (err) {
      traversalBlocked = err.message.includes('escapes workspace root');
    }
    assert(traversalBlocked, 'Sandbox blocks directory traversal attacks (../../)');

    let absEscapeBlocked = false;
    try {
      const outsidePath = process.platform === 'win32' ? 'C:\\Windows\\System32\\calc.exe' : '/etc/shadow';
      resolveSafePath(outsidePath);
    } catch (err) {
      absEscapeBlocked = err.message.includes('escapes workspace root');
    }
    assert(absEscapeBlocked, 'Sandbox blocks absolute paths outside workspace root');

    // Create directory
    const dirRes = await createDirectory('nested/folder');
    assert(dirRes.success === true, 'createDirectory creates nested directories');

    // Write file
    const sampleContent = 'console.log("Hello from Namo Coder Sandbox");\nexport const VERSION = 1.0;\n';
    const writeRes = await writeFileContent('nested/folder/app.js', sampleContent);
    assert(writeRes.success === true && writeRes.bytesWritten > 0, 'writeFileContent writes file safely');

    // Read file
    const readRes = await readFileContent('nested/folder/app.js');
    assert(readRes.content === sampleContent, 'readFileContent reads back exact file content');

    // Write second file for listing
    await writeFileContent('README.md', '# Namo Coder Test Project\n\nLocal-first AI IDE\n');

    // List files
    const filesList = await listFiles('');
    const hasAppJs = filesList.some(f => f.path.includes('app.js'));
    const hasReadme = filesList.some(f => f.path.includes('README.md'));
    assert(hasAppJs && hasReadme, 'listFiles lists all tracked workspace files');

    // File tree
    const tree = await getFileTree('', { maxDepth: 4 });
    assert(tree.type === 'directory' && Array.isArray(tree.children), 'getFileTree returns valid hierarchical directory tree');

    // Delete file
    const delRes = await deleteFile('nested/folder/app.js');
    assert(delRes.success === true, 'deleteFile deletes file safely');

    // -------------------------------------------------------------
    // SECTION 2: DETERMINISTIC CODE INTELLIGENCE ENGINE
    // -------------------------------------------------------------
    console.log('\n\x1b[1m\x1b[34m[2/7] Testing Code Intelligence Engine (Symbols & Lexical Grep)...\x1b[0m');

    // JS/TS extraction
    const jsCode = `
      import express from 'express';
      export const PORT = 3000;
      export class WorkspaceService extends BaseService {
        constructor() {}
        async start() {}
      }
      export function initServer(options) {
        return true;
      }
      const helperUtil = (x) => x * 2;
    `;
    const jsSymbols = extractSymbols(jsCode, 'index.js');
    const hasJsFn = jsSymbols.some(s => s.name === 'initServer' && s.type === 'function');
    const hasJsClass = jsSymbols.some(s => s.name === 'WorkspaceService' && s.type === 'class');
    const hasJsVar = jsSymbols.some(s => s.name === 'PORT' && s.type === 'variable');
    assert(hasJsFn && hasJsClass && hasJsVar, 'extractSymbols detects JS functions, classes, and variables');

    // TypeScript extraction
    const tsCode = `
      export interface UserProfile { id: string; name: string; }
      export type CoderResponse = { status: string; };
    `;
    const tsSymbols = extractSymbols(tsCode, 'types.ts');
    const hasTsIface = tsSymbols.some(s => s.name === 'UserProfile' && s.type === 'interface');
    const hasTsType = tsSymbols.some(s => s.name === 'CoderResponse' && s.type === 'type');
    assert(hasTsIface && hasTsType, 'extractSymbols detects TypeScript interfaces and types');

    // Python extraction
    const pyCode = `
import os
import sys

CONFIG_KEY = "xyz"

class AgentRuntime:
    def execute_step(self, step):
        pass

def run_pipeline(data):
    return True
`;
    const pySymbols = extractSymbols(pyCode, 'agent.py');
    const hasPyFn = pySymbols.some(s => s.name === 'run_pipeline' && s.type === 'function');
    const hasPyClass = pySymbols.some(s => s.name === 'AgentRuntime' && s.type === 'class');
    assert(hasPyFn && hasPyClass, 'extractSymbols detects Python functions and classes');

    // Go extraction
    const goCode = `
package main
import "fmt"
type Config struct { Host string }
func StartServer(port int) { fmt.Println(port) }
`;
    const goSymbols = extractSymbols(goCode, 'main.go');
    const hasGoFn = goSymbols.some(s => s.name === 'StartServer' && s.type === 'function');
    const hasGoStruct = goSymbols.some(s => s.name === 'Config' && s.type === 'struct');
    assert(hasGoFn && hasGoStruct, 'extractSymbols detects Go functions and structs');

    // Rust extraction
    const rsCode = `
use std::collections::HashMap;
pub struct ContextSession { id: String }
pub fn process_event(event: String) -> bool { true }
`;
    const rsSymbols = extractSymbols(rsCode, 'lib.rs');
    const hasRsFn = rsSymbols.some(s => s.name === 'process_event' && s.type === 'function');
    const hasRsStruct = rsSymbols.some(s => s.name === 'ContextSession' && s.type === 'struct');
    assert(hasRsFn && hasRsStruct, 'extractSymbols detects Rust functions and structs');

    // JSON, HTML, CSS extraction
    const jsonCode = '{\n  "name": "namo-coder",\n  "version": "1.0.0"\n}';
    const jsonSymbols = extractSymbols(jsonCode, 'package.json');
    assert(jsonSymbols.some(s => s.name === 'name' && s.type === 'key'), 'extractSymbols detects JSON keys');

    const htmlCode = '<title>Namo Coder IDE</title><div id="main-editor"></div>';
    const htmlSymbols = extractSymbols(htmlCode, 'index.html');
    assert(htmlSymbols.some(s => s.type === 'tag'), 'extractSymbols detects HTML tags');

    const cssCode = '.coder-container { color: #fff; } --primary-color: #007acc;';
    const cssSymbols = extractSymbols(cssCode, 'styles.css');
    assert(cssSymbols.some(s => s.name === '.coder-container'), 'extractSymbols detects CSS selectors');

    // Lexical Grep search
    await writeFileContent('src/sample.js', 'function computeQuantumHash() {\n  return 42;\n}\n');
    const grepRes = await grepSearch('computeQuantumHash', '', { isRegex: false });
    assert(grepRes.count > 0 && grepRes.results[0].line === 1, 'grepSearch finds exact substring with line and column');

    const regexGrep = await grepSearch('return\\s+\\d+', '', { isRegex: true });
    assert(regexGrep.count > 0, 'grepSearch supports regular expressions');

    // -------------------------------------------------------------
    // SECTION 3: CHECKPOINTS & ROLLBACK ENGINE
    // -------------------------------------------------------------
    console.log('\n\x1b[1m\x1b[34m[3/7] Testing Checkpoints & Rollback Engine...\x1b[0m');

    const originalFileContent = 'const STATE = "initial_v1";\n';
    await writeFileContent('src/state.js', originalFileContent);

    // Create Checkpoint
    const cp = await createCheckpoint('Pre-Edit Checkpoint', 'Testing snapshot before modifications');
    assert(cp.id && cp.fileCount > 0, 'createCheckpoint captures snapshot with files and metadata');

    // List Checkpoints
    const allCps = listCheckpoints();
    assert(allCps.some(c => c.id === cp.id), 'listCheckpoints lists created snapshot');

    // Modify file
    await writeFileContent('src/state.js', 'const STATE = "modified_destructive_v2";\n');
    const modifiedCheck = await readFileContent('src/state.js');
    assert(modifiedCheck.content.includes('modified_destructive'), 'File was modified post-checkpoint');

    // Rollback Checkpoint
    const rb = await rollbackCheckpoint(cp.id);
    assert(rb.success === true && rb.restoredFiles.includes('src/state.js'), 'rollbackCheckpoint succeeds');

    // Verify file content restored
    const restoredFile = await readFileContent('src/state.js');
    assert(restoredFile.content === originalFileContent, 'rollbackCheckpoint accurately restored original file content');

    // Delete checkpoint
    const delCp = await deleteCheckpoint(cp.id);
    assert(delCp.success === true, 'deleteCheckpoint cleans up snapshot files');

    // -------------------------------------------------------------
    // SECTION 4: UNIFIED DIFF & PATCH ENGINE
    // -------------------------------------------------------------
    console.log('\n\x1b[1m\x1b[34m[4/7] Testing Unified Diff & Patch Engine...\x1b[0m');

    const originalText = 'line1\nline2\nline3\n';
    const modifiedText = 'line1\nline2_modified\nline3\nline4_added\n';

    const diff = computeDiff(originalText, modifiedText, 'test.txt');
    assert(diff.stats.additions === 2 && diff.stats.deletions === 1, 'computeDiff accurately calculates additions and deletions');
    assert(diff.unifiedDiff.includes('--- a/test.txt') && diff.unifiedDiff.includes('+line2_modified'), 'computeDiff formats standard Unified Diff header and hunks');

    const parsedHunks = parseUnifiedDiff(diff.unifiedDiff);
    assert(parsedHunks.length > 0, 'parseUnifiedDiff successfully parses unified diff string into hunks');

    const patchRes = applyPatch(originalText, diff.unifiedDiff);
    assert(patchRes.success === true && patchRes.patched === modifiedText, 'applyPatch safely applies unified diff to match modified text');

    // -------------------------------------------------------------
    // SECTION 5: TERMINAL EXECUTION ENGINE
    // -------------------------------------------------------------
    console.log('\n\x1b[1m\x1b[34m[5/7] Testing Terminal Execution Engine...\x1b[0m');

    // Safe command execution
    const termRes = await executeCommand('node -e "console.log(\'NamoCoderTerminalActive\')"');
    assert(termRes.success === true && termRes.stdout.includes('NamoCoderTerminalActive'), 'executeCommand runs shell commands and captures stdout');
    assert(termRes.exitCode === 0 && termRes.executionTimeMs >= 0, 'executeCommand returns exitCode and execution time');

    // Security policy guardrail: Destructive command blocked
    let blockedCommand = false;
    try {
      await executeCommand('rm -rf /');
    } catch (err) {
      blockedCommand = err.message.includes('Security Policy Violation');
    }
    assert(blockedCommand, 'validateCommandSafety blocks destructive command patterns (rm -rf /)');

    // Timeout safety
    const timeoutRes = await executeCommand('node -e "setTimeout(() => {}, 5000)"', null, 600);
    assert(timeoutRes.timedOut === true, 'executeCommand terminates and enforces timeout safety');

    // -------------------------------------------------------------
    // SECTION 6: AUTONOMOUS CODER AGENT ENGINE
    // -------------------------------------------------------------
    console.log('\n\x1b[1m\x1b[34m[6/7] Testing Autonomous Coder Agent Engine...\x1b[0m');

    assert(Array.isArray(CODER_AGENT_TOOLS) && CODER_AGENT_TOOLS.length >= 8, 'CODER_AGENT_TOOLS exports all 8 required tools');

    // Test tool execution directly
    const toolListRes = await executeAgentTool('list_files', { dirPath: '' });
    assert(toolListRes.success === true && Array.isArray(toolListRes.files), 'executeAgentTool executes list_files tool');

    const toolGrepRes = await executeAgentTool('grep_search', { query: 'NamoCoder' });
    assert(toolGrepRes.success === true, 'executeAgentTool executes grep_search tool');

    // Test write_file in dryRun mode with diff proposal
    const testDiffProposals = [];
    const dryRunRes = await executeAgentTool('write_file', {
      path: 'src/proposal.js',
      content: 'export const PROPOSED = true;\n'
    }, { dryRun: true, diffProposals: testDiffProposals });

    assert(dryRunRes.dryRun === true && testDiffProposals.length > 0, 'executeAgentTool generates diff review proposals in dryRun mode');

    // Test full runCoderAgent loop
    const agentRes = await runCoderAgent({
      prompt: 'List project files and inspect the workspace',
      maxSteps: 3,
      dryRun: true
    });
    assert(agentRes.status === 'completed' && agentRes.totalSteps > 0, 'runCoderAgent completes autonomous reasoning steps');
    assert(agentRes.steps.some(s => s.toolCalls.length > 0), 'runCoderAgent dispatches tool calls with thoughts');

    // -------------------------------------------------------------
    // SECTION 7: HTTP REST API ROUTER END-TO-END TESTS
    // -------------------------------------------------------------
    console.log('\n\x1b[1m\x1b[34m[7/7] Testing Express HTTP API Endpoints (/api/coder/*)...\x1b[0m');

    const app = express();
    app.use(express.json());
    app.use('/api/coder', coderRouter);

    const TEST_HTTP_PORT = 3198;
    const server = http.createServer(app);

    await new Promise((resolve) => server.listen(TEST_HTTP_PORT, resolve));
    const baseUrl = `http://localhost:${TEST_HTTP_PORT}/api/coder`;

    try {
      // 1. GET /api/coder/workspace
      const wsHttp = await fetch(`${baseUrl}/workspace`);
      const wsData = await wsHttp.json();
      assert(wsHttp.status === 200 && wsData.success === true, 'GET /api/coder/workspace returns 200 with workspace info');

      // 2. GET /api/coder/tree
      const treeHttp = await fetch(`${baseUrl}/tree?depth=3`);
      const treeData = await treeHttp.json();
      assert(treeHttp.status === 200 && treeData.tree !== undefined, 'GET /api/coder/tree returns 200 with file hierarchy');

      // 3. POST /api/coder/file (Write file)
      const postFileHttp = await fetch(`${baseUrl}/file`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: 'api_test.txt', content: 'Testing REST API endpoint\n' })
      });
      const postFileData = await postFileHttp.json();
      assert(postFileHttp.status === 200 && postFileData.success === true, 'POST /api/coder/file writes file via REST API');

      // 4. GET /api/coder/file (Read file)
      const getFileHttp = await fetch(`${baseUrl}/file?path=api_test.txt`);
      const getFileData = await getFileHttp.json();
      assert(getFileHttp.status === 200 && getFileData.content.includes('Testing REST API'), 'GET /api/coder/file reads file via REST API');

      // 5. POST /api/coder/symbols
      const symHttp = await fetch(`${baseUrl}/symbols`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: 'function runApiTest() { return 1; }', filename: 'api.js' })
      });
      const symData = await symHttp.json();
      assert(symHttp.status === 200 && symData.symbols.length > 0, 'POST /api/coder/symbols returns extracted symbols');

      // 6. POST /api/coder/grep
      const grepHttp = await fetch(`${baseUrl}/grep`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'Testing REST API' })
      });
      const grepData = await grepHttp.json();
      assert(grepHttp.status === 200 && grepData.results.length > 0, 'POST /api/coder/grep executes lexical search');

      // 7. POST /api/coder/diff
      const diffHttp = await fetch(`${baseUrl}/diff`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ original: 'old line\n', modified: 'new line\n', filename: 'diff.txt' })
      });
      const diffData = await diffHttp.json();
      assert(diffHttp.status === 200 && diffData.stats.changes > 0, 'POST /api/coder/diff computes unified diff');

      // 8. POST /api/coder/terminal/run
      const termHttp = await fetch(`${baseUrl}/terminal/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: 'node -e "console.log(\'HttpTerminalPassed\')"' })
      });
      const termData = await termHttp.json();
      assert(termHttp.status === 200 && termData.stdout.includes('HttpTerminalPassed'), 'POST /api/coder/terminal/run executes shell command');

      // 9. POST /api/coder/checkpoints & GET /api/coder/checkpoints
      const cpHttp = await fetch(`${baseUrl}/checkpoints`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'HTTP Checkpoint', description: 'API snapshot test' })
      });
      const cpData = await cpHttp.json();
      assert(cpHttp.status === 201 && cpData.checkpoint.id !== undefined, 'POST /api/coder/checkpoints creates snapshot');

      const listCpHttp = await fetch(`${baseUrl}/checkpoints`);
      const listCpData = await listCpHttp.json();
      assert(listCpHttp.status === 200 && listCpData.checkpoints.length > 0, 'GET /api/coder/checkpoints lists snapshots');

      // 10. POST /api/coder/checkpoints/rollback
      const rbHttp = await fetch(`${baseUrl}/checkpoints/rollback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checkpointId: cpData.checkpoint.id })
      });
      const rbData = await rbHttp.json();
      assert(rbHttp.status === 200 && rbData.success === true, 'POST /api/coder/checkpoints/rollback restores snapshot');

      // 11. POST /api/coder/agent/chat
      const agentHttp = await fetch(`${baseUrl}/agent/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: 'Inspect workspace files', maxSteps: 2, dryRun: true })
      });
      const agentData = await agentHttp.json();
      assert(agentHttp.status === 200 && agentData.success === true && agentData.steps.length > 0, 'POST /api/coder/agent/chat runs agent loop via HTTP');

      // 12. DELETE /api/coder/file
      const delHttp = await fetch(`${baseUrl}/file?path=api_test.txt`, { method: 'DELETE' });
      const delData = await delHttp.json();
      assert(delHttp.status === 200 && delData.success === true, 'DELETE /api/coder/file deletes file via REST API');

    } finally {
      await new Promise((resolve) => server.close(resolve));
    }

  } finally {
    // Reset workspace root and clean up test sandbox
    setWorkspaceRoot(originalRoot);
    if (fs.existsSync(testWorkspaceDir)) {
      try {
        fs.rmSync(testWorkspaceDir, { recursive: true, force: true });
      } catch (_err) {
        // cleanup best-effort
      }
    }
  }

  // -------------------------------------------------------------
  // TEST SUITE SUMMARY
  // -------------------------------------------------------------
  console.log('\n\x1b[1m\x1b[36m===============================================================');
  console.log('                    TEST SUMMARY RESULTS                       ');
  console.log('===============================================================\x1b[0m');
  console.log(`  Total Tests Run:  ${passedTests + failedTests}`);
  console.log(`  \x1b[32mTests Passed:     ${passedTests}\x1b[0m`);
  console.log(`  \x1b[31mTests Failed:     ${failedTests}\x1b[0m`);
  const passRate = Math.round((passedTests / (passedTests + failedTests)) * 100);
  console.log(`  Pass Rate:        ${passRate}%`);
  console.log('\x1b[1m\x1b[36m===============================================================\x1b[0m\n');

  if (failedTests > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTestSuite().catch((err) => {
  console.error('\x1b[31mFATAL UNCAUGHT TEST ERROR:\x1b[0m', err);
  process.exit(1);
});
