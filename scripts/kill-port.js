/*
 * Cross-platform utility to free a TCP port before starting the dev server.
 *
 * Usage: node kill-port.js [port]
 * If no port is supplied, the script will attempt to read the DEV_PORT environment
 * variable, falling back to 5173 (the default Vite port).
 */

import { execSync } from 'child_process';
import net from 'net';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const isMainModule = process.argv[1] === __filename;

async function freePort(rawPort) {
  const port = String(rawPort || process.env.DEV_PORT || 5173);

  try {
    if (process.platform === 'win32') {
      // netstat output can contain multiple lines per port, gather all owning PIDs
      const output = execSync(`netstat -ano -p tcp | findstr :${port}`, {
        stdio: ['ignore', 'pipe', 'ignore'],
        windowsHide: true
      })
        .toString()
        .trim();

      if (!output) return;

      const pids = new Set();
      output.split(/\r?\n/).forEach((line) => {
        const parts = line.trim().split(/\s+/);
        const pid = parts[parts.length - 1];
        if (pid && /^\d+$/.test(pid)) pids.add(pid);
      });

      pids.forEach((pid) => {
        try {
          execSync(`taskkill /PID ${pid} /F`, { stdio: 'ignore', windowsHide: true });
          console.log(`✔ Freed port ${port} by killing PID ${pid}`);
        } catch (err) {
          // Ignore errors if the process disappears between listing and kill attempt
        }
      });
    } else {
      // macOS / Linux – use lsof if available; fallback to fuser otherwise
      try {
        execSync(`lsof -ti tcp:${port} | xargs -r kill -9`, {
          stdio: 'ignore',
          shell: '/bin/bash'
        });
        console.log(`✔ Freed port ${port}`);
      } catch {
        // lsof might not exist – try fuser
        try {
          execSync(`fuser -k ${port}/tcp`, { stdio: 'ignore' });
          console.log(`✔ Freed port ${port} using fuser`);
        } catch (innerErr) {
          // Port may already be free or tools missing – ignore
        }
      }
    }

    // Wait until the port is fully released
    await waitUntilPortIsFree(port);
  } catch {
    // Port likely already free – no action needed
  }
}

async function waitUntilPortIsFree(port, attempts = 20, delayMs = 250) {
  for (let i = 0; i < attempts; i++) {
    const isFree = await new Promise((resolve) => {
      const server = net.createServer();
      server.unref();
      
      server.listen({ port: Number(port), host: '127.0.0.1' }, () => {
        server.close(() => {
          resolve(true); // Port is free
        });
      });
      
      server.on('error', () => {
        resolve(false); // Port is in use
      });
    });
    
    if (isFree) {
      return; // Port is free
    }
    
    // Still in use – wait and retry
    await new Promise(resolve => setTimeout(resolve, delayMs));
  }
  console.warn(`⚠️  Port ${port} still appears busy after ${attempts * delayMs}ms, continuing anyway.`);
}

if (isMainModule) {
  freePort(process.argv[2]);
}

export { freePort }; 