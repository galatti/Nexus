/*
 * Cross-platform utility to free a TCP port before starting the dev server.
 *
 * Usage: node kill-port.js [port]
 * If no port is supplied, the script will attempt to read the DEV_PORT environment
 * variable, falling back to 5173 (the default Vite port).
 */

const { execSync } = require('child_process');

function freePort(rawPort) {
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

      // Wait until the port is fully released (handles TIME_WAIT state)
      waitUntilPortIsFree(port);
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

      waitUntilPortIsFree(port);
    }
  } catch {
    // Port likely already free – no action needed
  }
}

function waitUntilPortIsFree(port, attempts = 20, delayMs = 250) {
  const net = require('net');
  const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

  for (let i = 0; i < attempts; i++) {
    try {
      // Try to create a server on the same port. If it succeeds, the port is free.
      const server = net.createServer();
      server.unref();
      server.listen({ port: Number(port), host: '127.0.0.1' });
      server.close();
      return; // Port is free
    } catch {
      // Still in use – wait and retry
      sleep(delayMs);
    }
  }
  console.warn(`⚠️  Port ${port} still appears busy after ${attempts * delayMs}ms, continuing anyway.`);
}

if (require.main === module) {
  freePort(process.argv[2]);
}

module.exports = { freePort }; 