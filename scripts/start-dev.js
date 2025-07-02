/*
 * Cross-platform orchestrator for running the NEXUS dev environment with a single command.
 *
 * It picks an available port (prefers 5173), starts Vite there, waits for the dev server
 * to accept connections, then launches Electron pointing at the same port.
 *
 * Stop the whole stack with Ctrl-C – both child processes will be cleaned up.
 */

import { spawn, execSync } from 'child_process';
import net from 'net';
import path from 'path';
import { fileURLToPath } from 'url';

import { freePort } from './kill-port.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Fix encoding for Windows PowerShell
if (process.platform === 'win32') {
  try {
    // Set console output encoding to UTF-8
    execSync('chcp 65001 >nul 2>&1', { shell: true });
  } catch (e) {
    // Ignore errors, fallback to ASCII characters
  }
}

function waitUntilReachable(port, retries = 40, delay = 250) {
  return new Promise((resolve, reject) => {
    const attempt = (count) => {
      const sock = net.createConnection({ port }, () => {
        sock.destroy();
        return resolve();
      });
      sock.on('error', () => {
        sock.destroy();
        if (count > 0) {
          setTimeout(() => attempt(count - 1), delay);
        } else {
          reject(new Error(`Dev server not reachable on port ${port}`));
        }
      });
    };
    attempt(retries);
  });
}


(async () => {
  const preferredPort = 5173;

  console.log(`[!] Attempting to free port ${preferredPort}...`);
  await freePort(preferredPort);
  console.log(`[✓] Port ${preferredPort} freed successfully`);

  const port = preferredPort;
  const env = { ...process.env, NODE_ENV: 'development', DEV_SERVER_PORT: String(port) };

  // Ensure main process is compiled
  console.log('[*] Compiling main process...');
  execSync('npm run build:main', { stdio: 'inherit', shell: true });
  
  // Free port again after build in case build process interfered
  console.log(`[!] Re-freeing port ${port} after build...`);
  await freePort(port);
  
  // Give the system a moment to fully release the port
  await new Promise(resolve => setTimeout(resolve, 1000));

  console.log(`[>] Starting Vite dev server on http://localhost:${port}`);
  const vite = spawn('npx', ['vite', '--port', String(port), '--strictPort'], {
    cwd: path.resolve(__dirname, '..'),
    shell: true,
    stdio: 'inherit',
    env,
  });

  // helper to wait dev server
  await waitUntilReachable(port);
  console.log('[✓] Vite is ready – launching Electron');
  const electron = spawn('npx', ['electron', '.'], {
    cwd: path.resolve(__dirname, '..'),
    shell: true,
    stdio: 'inherit',
    env: { ...env, ELECTRON_IS_DEV: '1' },
  });

  const cleanExit = () => {
    if (!vite.killed) vite.kill('SIGTERM');
    if (electron && !electron.killed) electron.kill('SIGTERM');
  };

  process.on('SIGINT', cleanExit);
  process.on('SIGTERM', cleanExit);
})();