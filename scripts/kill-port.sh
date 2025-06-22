#!/usr/bin/env bash
# A lightweight helper to free a TCP port before starting the dev server.
# Usage: ./kill-port.sh [PORT]
# If PORT is omitted, DEV_PORT env var or 5173 is used.

set -euo pipefail

PORT=${1:-${DEV_PORT:-5173}}

if command -v lsof >/dev/null 2>&1; then
  if lsof -ti tcp:"${PORT}" >/dev/null; then
    echo "🛑 Port ${PORT} is in use. Attempting to terminate the owning process(es)..."
    # shellcheck disable=SC2046
    kill -9 $(lsof -ti tcp:"${PORT}") || true
    echo "✅ Freed port ${PORT}."
  else
    echo "ℹ️  Port ${PORT} is already free."
  fi
else
  if command -v fuser >/dev/null 2>&1; then
    echo "🛑 Attempting to free port ${PORT} with fuser..."
    fuser -k "${PORT}"/tcp || true
    echo "✅ Freed port ${PORT}."
  else
    echo "⚠️  Neither lsof nor fuser is available. Cannot automatically free port ${PORT}." >&2
    exit 0
  fi
fi

# Wait until port is fully released (TIME_WAIT etc.)
for i in {1..20}; do
  if lsof -ti tcp:"${PORT}" >/dev/null 2>&1; then
    sleep 0.25
  else
    break
  fi
done 