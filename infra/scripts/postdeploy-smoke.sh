#!/usr/bin/env bash
# -----------------------------------------------------------
# postdeploy-smoke.sh — Gate 10 P0 + Critical Failure Sweep
# -----------------------------------------------------------
# Runs at T+0 and again at T+24h. Verifies that a freshly deployed
# instance is healthy and the production bundle has no static-
# prototype artifacts in it. Intended to be run after a fresh
# image deploy on staging or production.
#
# Usage:
#   BASE_URL=https://staging.example.com bash postdeploy-smoke.sh
#   BASE_URL=http://localhost:5000   bash postdeploy-smoke.sh
#
# The script is intentionally non-destructive: it makes GET requests
# to /api/* and HEAD/grep checks against the published SPA bundle.
# No writes to the database, no upload, no login. Login + writes
# are tested by the Playwright e2e suite (PR 7) once the
# real-stack profile is verified in CI.
# -----------------------------------------------------------

set -uo pipefail

BASE_URL="${BASE_URL:-http://localhost:5000}"
FRONTEND_BUNDLE_DIR="${FRONTEND_BUNDLE_DIR:-Frontend/dist}"
EXPECTED_VERSION="${EXPECTED_VERSION:-}"

pass=0
fail=0
results=()

probe() {
  local name="$1" expected="$2" actual="$3"
  if [[ "$expected" == "$actual" ]]; then
    pass=$((pass + 1))
    results+=("PASS  $name  expected=$expected  actual=$actual")
  else
    fail=$((fail + 1))
    results+=("FAIL  $name  expected=$expected  actual=$actual")
  fi
}

# T+0 health: /api/health returns 200 with a known component
# (the audit requires /api/ready to discriminate; for smoke we
# just want green.)
HEALTH=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/health" 2>/dev/null || echo "000")
probe "GET /api/health" "200" "$HEALTH"

LIVE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/live" 2>/dev/null || echo "000")
probe "GET /api/live" "200" "$LIVE"

READY_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/ready" 2>/dev/null || echo "000")
probe "GET /api/ready" "200" "$READY_CODE"

# T+24h backups: confirm the timer fired (or a fresh backup exists).
# Falls back to "not-set" when BACKUP_DIR is not exported in the
# smoke env.
if [[ -d "${BACKUP_DIR:-}" ]]; then
  RECENT=$(find "$BACKUP_DIR" -name "*.sqlite" -mmin -1500 2>/dev/null | head -1)
  if [[ -n "$RECENT" ]]; then
    probe "BACKUP_DIR has <24h-old snapshot" "yes" "yes"
  else
    probe "BACKUP_DIR has <24h-old snapshot" "yes" "no"
  fi
else
  probe "BACKUP_DIR has <24h-old snapshot" "yes" "not-set"
fi

# CFS: no static-prototype artifacts in the published bundle. The
# audit prohibits `VITE_STATIC_PROTOTYPE=true` in production builds
# and any reach to `isStaticPrototype()` at runtime.
if [[ -d "$FRONTEND_BUNDLE_DIR" ]]; then
  STATIC_FLAG_HITS=$(grep -rE "VITE_STATIC_PROTOTYPE" "$FRONTEND_BUNDLE_DIR" 2>/dev/null | wc -l)
  if [[ "$STATIC_FLAG_HITS" -eq 0 ]]; then
    probe "production bundle free of VITE_STATIC_PROTOTYPE" "0" "0"
  else
    probe "production bundle free of VITE_STATIC_PROTOTYPE" "0" "$STATIC_FLAG_HITS"
  fi
  PROTOTYPE_BRANCH_HITS=$(grep -rE "isStaticPrototype" "$FRONTEND_BUNDLE_DIR" 2>/dev/null | wc -l)
  if [[ "$PROTOTYPE_BRANCH_HITS" -eq 0 ]]; then
    probe "production bundle has no isStaticPrototype branch" "0" "0"
  else
    probe "production bundle has no isStaticPrototype branch" "0" "$PROTOTYPE_BRANCH_HITS"
  fi
else
  echo "WARN  FRONTEND_BUNDLE_DIR=$FRONTEND_BUNDLE_DIR not found; skipping bundle checks"
fi

# Optional: version header check, if EXPECTED_VERSION is provided.
if [[ -n "$EXPECTED_VERSION" ]]; then
  RESP_VERSION=$(curl -s "$BASE_URL/api/health" | grep -oE '"version"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed -E 's/.*"([^"]+)"$/\1/')
  probe "GET /api/health reports EXPECTED_VERSION" "$EXPECTED_VERSION" "${RESP_VERSION:-missing}"
fi

# Summary
echo "==> Post-deploy smoke against $BASE_URL"
for r in "${results[@]}"; do
  echo "    $r"
done
echo "    pass=$pass  fail=$fail"

if [[ "$fail" -gt 0 ]]; then
  exit 1
fi
exit 0
