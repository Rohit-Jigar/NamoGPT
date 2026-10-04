import { spawn } from 'child_process';
import path from 'path';

console.log(`
  🚀 Starting NamoGPT Fullstack Environment...
`);

const isWin = process.platform === 'win32';
const npmCmd = isWin ? 'npm.cmd' : 'npm';

// Start Server
const serverProcess = spawn(npmCmd, ['--prefix', 'server', 'run', 'start'], {
  stdio: 'inherit',
  shell: true
});

// Start Web Vite Dev Server
const webProcess = spawn(npmCmd, ['--prefix', 'web', 'run', 'dev'], {
  stdio: 'inherit',
  shell: true
});

function cleanup() {
  console.log('\n🛑 Shutting down NamoGPT...');
  try { serverProcess.kill(); } catch (e) {}
  try { webProcess.kill(); } catch (e) {}
  process.exit();
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
