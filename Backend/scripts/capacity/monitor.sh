#!/usr/bin/env bash
# Samples `docker stats` for the capacity-constrained containers every
# 2s and appends CSV rows until killed (SIGTERM/SIGINT).
#
# Usage: monitor.sh <output-csv-path>
# Started/stopped by run.sh — not meant to be run standalone, but safe to.
set -euo pipefail

OUT="${1:?usage: monitor.sh <output-csv-path>}"
CONTAINERS="universe-srmap-backend universe-srmap-redis"
INTERVAL="${MONITOR_INTERVAL:-2}"

echo "epoch,container,cpu_percent,mem_used_mb,mem_limit_mb,mem_percent" > "$OUT"

trap 'exit 0' TERM INT

while true; do
  epoch=$(date +%s)
  for c in $CONTAINERS; do
    line=$(docker stats "$c" --no-stream --format '{{.CPUPerc}}|{{.MemUsage}}|{{.MemPerc}}' 2>/dev/null || echo "")
    if [ -z "$line" ]; then
      continue
    fi
    cpu=$(echo "$line" | cut -d'|' -f1 | tr -d '%')
    mem_usage=$(echo "$line" | cut -d'|' -f2)
    mem_perc=$(echo "$line" | cut -d'|' -f3 | tr -d '%')
    mem_used=$(echo "$mem_usage" | awk -F' / ' '{print $1}')
    mem_limit=$(echo "$mem_usage" | awk -F' / ' '{print $2}')
    # Normalize MiB/GiB to MB (docker reports MiB or GiB depending on size).
    mem_used_mb=$(echo "$mem_used" | awk '
      /GiB/ { gsub("GiB",""); print $1*1024; next }
      /MiB/ { gsub("MiB",""); print $1; next }
      { print 0 }')
    mem_limit_mb=$(echo "$mem_limit" | awk '
      /GiB/ { gsub("GiB",""); print $1*1024; next }
      /MiB/ { gsub("MiB",""); print $1; next }
      { print 0 }')
    echo "${epoch},${c},${cpu},${mem_used_mb},${mem_limit_mb},${mem_perc}" >> "$OUT"
  done
  sleep "$INTERVAL"
done
