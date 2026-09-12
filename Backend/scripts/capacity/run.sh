#!/usr/bin/env bash
# Capacity test: brings up the backend+redis stack constrained to
# (roughly) the resources one Oracle Always-Free VM gives them, ramps
# concurrent virtual users against it with k6 while sampling docker stats,
# then reports which VU count saturated the box.
#
# Usage (from repo root or Backend/):
#   bash Backend/scripts/capacity/run.sh
#   bash Backend/scripts/capacity/run.sh --keep-up   # leave the stack running after
#
# Requires: docker, k6 (https://k6.io/docs/get-started/installation/), .env
# with REDIS_PASSWORD set (see .env.example).
set -euo pipefail

KEEP_UP=0
for arg in "$@"; do
  case "$arg" in
    --keep-up) KEEP_UP=1 ;;
    *) echo "unknown arg: $arg" >&2; exit 1 ;;
  esac
done

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$ROOT_DIR"

command -v docker >/dev/null || { echo "docker not found" >&2; exit 1; }
command -v k6 >/dev/null || { echo "k6 not found — https://k6.io/docs/get-started/installation/" >&2; exit 1; }
[ -f .env ] || { echo ".env not found at repo root — copy .env.example and set REDIS_PASSWORD" >&2; exit 1; }

TS="$(date +%Y%m%d-%H%M%S)"
OUT_DIR="Backend/scripts/capacity/results/$TS"
mkdir -p "$OUT_DIR"
MONITOR_CSV="$OUT_DIR/monitor.csv"
K6_LOG="$OUT_DIR/k6.log"
REPORT_MD="$OUT_DIR/report.md"

echo "==> Building and starting capacity-constrained stack (backend: 1.6 OCPU/9GB, redis: 0.3 OCPU/512MB)"
docker compose -f docker-compose.yml -f docker-compose.capacity.yml up -d --build

echo "==> Waiting for backend to report ready..."
for i in $(seq 1 60); do
  if curl -fsS "http://localhost:15000/api/ready" >/dev/null 2>&1; then
    echo "==> Backend ready after ${i}s"
    break
  fi
  sleep 1
  if [ "$i" -eq 60 ]; then
    echo "backend never became ready — check: docker compose logs backend" >&2
    docker compose -f docker-compose.yml -f docker-compose.capacity.yml down
    exit 1
  fi
done

# Let CPU/mem settle post-boot before sampling starts.
sleep 3

echo "==> Starting resource monitor -> $MONITOR_CSV"
bash Backend/scripts/capacity/monitor.sh "$MONITOR_CSV" &
MONITOR_PID=$!

cleanup() {
  kill "$MONITOR_PID" 2>/dev/null || true
  wait "$MONITOR_PID" 2>/dev/null || true
  if [ "$KEEP_UP" -eq 0 ]; then
    echo "==> Tearing down stack"
    docker compose -f docker-compose.yml -f docker-compose.capacity.yml down
  else
    echo "==> Leaving stack up (--keep-up). Tear down with:"
    echo "    docker compose -f docker-compose.yml -f docker-compose.capacity.yml down"
  fi
}
trap cleanup EXIT

K6_START_EPOCH=$(date +%s)
echo "==> Running k6 ramp (this will take a few minutes, or abort early if the box saturates)"
BASE_URL="http://localhost:15000" k6 run Backend/load-tests/capacity/capacity-ramp.js 2>&1 | tee "$K6_LOG" || true

# Give the monitor one more sample after k6 stops so the last stage isn't cut short.
sleep 2
kill "$MONITOR_PID" 2>/dev/null || true
wait "$MONITOR_PID" 2>/dev/null || true

echo "==> Generating report -> $REPORT_MD"
node Backend/scripts/capacity/report.mjs "$MONITOR_CSV" "$K6_START_EPOCH" | tee "$REPORT_MD"

echo ""
echo "==> Raw data: $OUT_DIR (monitor.csv, k6.log, report.md)"
