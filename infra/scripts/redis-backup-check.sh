#!/usr/bin/env bash
set -euo pipefail

: "${REDIS_HOST:=127.0.0.1}"
: "${REDIS_PORT:=6379}"

redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" INFO persistence | egrep "aof_enabled|aof_last_bgrewrite_status|rdb_last_bgsave_status"

redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" BGSAVE
sleep 2
redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" LASTSAVE

echo "Redis persistence checks completed"
