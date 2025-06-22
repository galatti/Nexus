/*
 * Cross-platform orchestrator for running the NEXUS MVP dev environment with a single command.
 *
 * It picks an available port (prefers 5173), starts Vite there, waits for the dev server
 * to accept connections, then launches Electron pointing at the same port.
 *
 * Stop the whole stack with Ctrl-C – both child processes will be cleaned up.
 */

import { spawn, execSync } from 'child_process';
import net from 'net';
import path from 'path';
import sudo from '@expo/sudo-prompt';
import { fileURLToPath } from 'url';

import { freePort } from './kill-port.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function waitUntilPortIsFree(port, attempts = 20, delayMs = 250) {
  for (let i = 0; i < attempts; i++) {
    const inUse = await isPortInUse(port);
    if (!inUse) return true;
    await new Promise((res) => setTimeout(res, delayMs));
  }
  return false;
}

function isPortInUse(port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ port }, () => {
      socket.destroy();
      resolve(true);
    });
    socket.on('error', () => {
      resolve(false);
    });
  });
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

function killWithElevation(port) {
  return new Promise((resolve, reject) => {
    const cmd = `node \"${path.join(__dirname, 'kill-port.js')}\" ${port}`;
    sudo.exec(cmd, { name: 'Nexus Dev' }, (error) => {
      if (error) return reject(error);
      resolve();
    });
  });
}

(async () => {
  const preferredPort = 5173;

  console.log(`🛑 Attempting to free port ${preferredPort}...`);
  try {
    freePort(preferredPort);
  } catch {}

  const freed = await waitUntilPortIsFree(preferredPort);
  if (!freed) {
    console.log('⚠️  Port still busy – requesting administrator privileges to free it...');
    try {
      await killWithElevation(preferredPort);
      const freedElevated = await waitUntilPortIsFree(preferredPort);
      if (!freedElevated) {
        console.error(`❌ Even with elevation, port ${preferredPort} remains in use.`);
        process.exit(1);
      }
      console.log('✅ Port freed with elevated privileges.');
    } catch (e) {
      console.error('❌ Failed to obtain privileges or free the port:', e.message || e);
      process.exit(1);
    }
  }

  const port = preferredPort;
  const env = { ...process.env, NODE_ENV: 'development', DEV_SERVER_PORT: String(port) };

  // Ensure main process is compiled
  console.log('🔧 Compiling main process...');
  execSync('npm run build:main', { stdio: 'inherit', shell: true });

  console.log(`🚀 Starting Vite dev server on http://localhost:${port}`);
  const vite = spawn('npx', ['vite', '--port', String(port), '--strictPort', 'true'], {
    cwd: path.resolve(__dirname, '..'),
    shell: true,
    stdio: 'inherit',
    env,
  });

  // helper to wait dev server
  await waitUntilReachable(port);
  console.log('✅ Vite is ready – launching Electron');
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