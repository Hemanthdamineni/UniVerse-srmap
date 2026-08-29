#!/usr/bin/env bash
# -----------------------------------------------------------
# start.sh — boot a fixture-seeded backend instance for e2e tests
# -----------------------------------------------------------
# Launches a real backend on a unique port and data dir, seeds it
# with the e2e fixture set, and writes its pid + URL to env files
# the test runner reads.
#
# Usage:
#   bash Backend/scripts/e2e-stack/start.sh up    # start
#   bash Backend/scripts/e2e-stack/start.sh down  # stop
#
# Output (when up):
#   /tmp/erp-e2e.pid      — pid of the backend process
#   /tmp/erp-e2e.url       — base URL (http://127.0.0.1:5500)
#   /tmp/erp-e2e.data      — path to the data dir
#
# The test runner reads these files before invoking
# `npx playwright test --config=playwright.config.realstack.ts`.
# The runner must call `down` after the suite completes (CI does
# this in the e2e-realstack job's post step).
# -----------------------------------------------------------

set -euo pipefail

PORT="${E2E_BACKEND_PORT:-5500}"
DATA="${E2E_DATA_DIR:-/tmp/university-erp-e2e-data-$$}"
PID_FILE="${E2E_PID_FILE:-/tmp/erp-e2e.pid}"
URL_FILE="${E2E_URL_FILE:-/tmp/erp-e2e.url}"
DATA_FILE="${E2E_DATA_FILE:-/tmp/erp-e2e.data}"

mkdir -p "$DATA"

start() {
  # In-memory Redis substitute: let the backend run without Redis.
  # The fixture-mock store (started in dev) handles sessions.
  export PORT
  export CONTENT_DB_PATH="$DATA/content.sqlite"
  export EXTERNAL_DB_PATH="$DATA/external-pages.sqlite"
  export EVENTS_DB_PATH="$DATA/events.sqlite"
  export EVENTS_DATA_DIR="$DATA/events"
  export SESSION_STORE_DRIVER=memory
  export ERP_CACHE_DRIVER=memory
  export NODE_ENV=development
  export REDIS_URL=""
  export ADMIN_CONTENT_PASSWORD=e2e-admin
  export LOG_DIR="$DATA/logs"
  export ERP_DUMP_BASE_DIR="$DATA/dump"
  # The frontend dev server's vite proxy reads
  # VITE_API_PROXY_TARGET to know where to forward /api/* requests.
  # We export it on the host so the CI "Start frontend dev server"
  # step can pick it up. The default in vite.config.ts is
  # http://localhost:5000, but we run the backend on E2E_BACKEND_PORT
  # (default 5500) so we need to override.
  export VITE_API_PROXY_TARGET="http://localhost:${PORT}"
  mkdir -p "$LOG_DIR" "$ERP_DUMP_BASE_DIR"

  cd "$(dirname "$0")/../../.."
  node Backend/src/server.js >"$DATA/server.log" 2>&1 &
  local pid=$!
  echo "$pid" >"$PID_FILE"
  echo "http://127.0.0.1:$PORT" >"$URL_FILE"
  echo "$DATA" >"$DATA_FILE"

  # Wait for /api/live
  for _ in $(seq 1 30); do
    if curl -fsS "http://127.0.0.1:$PORT/api/live" >/dev/null 2>&1; then
      echo "==> backend up (pid=$pid, port=$PORT, data=$DATA)"
      return 0
    fi
    sleep 0.5
  done
  echo "==> ERROR: backend did not become ready within 15s"
  cat "$DATA/server.log"
  return 1
}

down() {
  if [[ -f "$PID_FILE" ]]; then
    local pid
    pid=$(cat "$PID_FILE")
    kill "$pid" 2>/dev/null || true
    sleep 0.5
    kill -9 "$pid" 2>/dev/null || true
    rm -f "$PID_FILE"
    echo "==> backend stopped (pid=$pid)"
  fi
}

case "${1:-up}" in
  up) start ;;
  down) down ;;
  *) echo "Usage: $0 {up|down}"; exit 1 ;;
esac
