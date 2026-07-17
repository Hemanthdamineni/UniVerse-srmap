#!/usr/bin/env bash
set -euo pipefail

# -----------------------------------------------------------
# setup-backups.sh
# Automated backup script for SQLite databases and Redis RDB.
# Intended to be run as a cron job.
# Usage: ./setup-backups.sh [--dry-run]
# -----------------------------------------------------------

# --- Configuration (customize these) ---
BACKUP_DIR="${BACKUP_DIR:-/var/backups/university-erp}"
DB_DIR="${DB_DIR:-Backend/data}"
BACKUP_DEST="${BACKUP_DEST:-}"
REDIS_RDB_PATH="${REDIS_RDB_PATH:-/var/lib/redis/dump.rdb}"
PROJECT_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

DRY_RUN=false
if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN=true
fi

announce() { echo "==> $*"; }
dry()     { echo "[DRY-RUN] $*"; }
warn()    { echo "==> WARNING: $*" >&2; }
err()     { echo "==> ERROR: $*" >&2; }

# Resolve DB_DIR relative to project root if it is not absolute
if [[ "$DB_DIR" != /* ]]; then
  DB_DIR="${PROJECT_ROOT}/${DB_DIR}"
fi

# -----------------------------------------------------------
# 1. Create backup directories
# -----------------------------------------------------------
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
DAILY_DIR="${BACKUP_DIR}/daily/${TIMESTAMP}"
WEEKLY_DIR="${BACKUP_DIR}/weekly"
WEEKLY_SNAPSHOT_DIR="${WEEKLY_DIR}/${TIMESTAMP}"

if [[ "$DRY_RUN" == true ]]; then
  dry "Would create directories: ${DAILY_DIR} ${WEEKLY_DIR}"
else
  mkdir -p "$DAILY_DIR" "$WEEKLY_DIR"
  announce "Backup directories created."
fi

# -----------------------------------------------------------
# 2. Back up SQLite databases
# -----------------------------------------------------------
echo ""
announce "Backing up SQLite databases from ${DB_DIR} ..."

if [[ "$DRY_RUN" == true ]]; then
  while IFS= read -r -d '' db; do
    rel="${db#$DB_DIR/}"
    dry "Would backup: ${db} -> ${DAILY_DIR}/${rel}"
  done < <(find "$DB_DIR" -name "*.sqlite" -type f -print0 2>/dev/null || true)
else
  count=0
  while IFS= read -r -d '' db; do
    rel="${db#$DB_DIR/}"
    dest="${DAILY_DIR}/${rel}"
    mkdir -p "$(dirname "$dest")"
    sqlite3 "$db" ".backup '$dest'"
    announce "Backed up: ${rel}"
    count=$((count + 1))
  done < <(find "$DB_DIR" -name "*.sqlite" -type f -print0 2>/dev/null || true)

  if [[ $count -eq 0 ]]; then
    warn "No SQLite databases found in ${DB_DIR}."
  else
    announce "Backed up ${count} SQLite database(s)."
  fi
fi

# -----------------------------------------------------------
# 3. Back up Redis RDB
# -----------------------------------------------------------
echo ""
announce "Backing up Redis RDB ..."

REDIS_DUMP="${DAILY_DIR}/redis.rdb"

if [[ "$DRY_RUN" == true ]]; then
  dry "Would run: redis-cli --rdb \"${REDIS_DUMP}\""
else
  if command -v redis-cli &>/dev/null; then
    redis-cli --rdb "$REDIS_DUMP"
    announce "Redis RDB saved to ${REDIS_DUMP}."
  else
    warn "redis-cli not found. Skipping Redis backup."
  fi
fi

# Create a weekly snapshot automatically when run on Sunday, or force it with
# FORCE_WEEKLY=1. Hard links keep the snapshot cheap on the same filesystem.
CREATE_WEEKLY=false
if [[ "${FORCE_WEEKLY:-}" == "1" || "$(date +%u)" == "7" ]]; then
  CREATE_WEEKLY=true
fi

if [[ "$CREATE_WEEKLY" == true ]]; then
  echo ""
  announce "Creating weekly snapshot ..."
  if [[ "$DRY_RUN" == true ]]; then
    dry "Would copy completed daily backup to weekly snapshot: ${WEEKLY_SNAPSHOT_DIR}"
  else
    cp -al "$DAILY_DIR" "$WEEKLY_SNAPSHOT_DIR"
    announce "Weekly snapshot created: ${WEEKLY_SNAPSHOT_DIR}"
  fi
fi

# -----------------------------------------------------------
# 4. Rsync to remote destination (if configured)
# -----------------------------------------------------------
if [[ -n "$BACKUP_DEST" ]]; then
  echo ""
  announce "Rsyncing backups to ${BACKUP_DEST} ..."

  if [[ "$DRY_RUN" == true ]]; then
    dry "Would run: rsync -avz --delete \"${BACKUP_DIR}/\" \"${BACKUP_DEST}/\""
  else
    rsync -avz --delete "${BACKUP_DIR}/" "${BACKUP_DEST}/"
    announce "Rsync complete."
  fi
else
  echo ""
  announce "BACKUP_DEST not set — skipping remote rsync."
fi

# -----------------------------------------------------------
# 5. Rotation: keep 7 daily backups, 4 weekly backups
# -----------------------------------------------------------
echo ""
announce "Rotating backups ..."

if [[ "$DRY_RUN" == true ]]; then
  dry "Would keep last 7 daily backups in ${BACKUP_DIR}/daily/"
  dry "Would keep last 4 weekly backups in ${BACKUP_DIR}/weekly/"
  # Simulate what would be deleted
  dailies=( "$BACKUP_DIR"/daily/*/ )
  if (( ${#dailies[@]} > 7 )); then
    dry "Would remove ${#dailies[@]} - 7 = $(( ${#dailies[@]} - 7 )) daily backup(s):"
    for old in "${dailies[@]:0:$(( ${#dailies[@]} - 7 ))}"; do
      dry "  rm -rf ${old}"
    done
  fi
  weeklies=( "$BACKUP_DIR"/weekly/*/ )
  if (( ${#weeklies[@]} > 4 )); then
    dry "Would remove ${#weeklies[@]} - 4 = $(( ${#weeklies[@]} - 4 )) weekly backup(s):"
    for old in "${weeklies[@]:0:$(( ${#weeklies[@]} - 4 ))}"; do
      dry "  rm -rf ${old}"
    done
  fi
else
  # Prune daily backups — keep newest 7
  dailies=( "$BACKUP_DIR"/daily/*/ )
  if (( ${#dailies[@]} > 7 )); then
    # Sort by name (timestamp) ascending, keep the last 7, remove the rest
    mapfile -t sorted < <(printf '%s\n' "${dailies[@]}" | sort)
    to_remove=$(( ${#sorted[@]} - 7 ))
    for ((i=0; i<to_remove; i++)); do
      rm -rf "${sorted[$i]}"
      announce "Removed old daily backup: ${sorted[$i]}"
    done
  fi

  # Prune weekly backups — keep newest 4
  weeklies=( "$BACKUP_DIR"/weekly/*/ )
  if (( ${#weeklies[@]} > 4 )); then
    mapfile -t sorted < <(printf '%s\n' "${weeklies[@]}" | sort)
    to_remove=$(( ${#sorted[@]} - 4 ))
    for ((i=0; i<to_remove; i++)); do
      rm -rf "${sorted[$i]}"
      announce "Removed old weekly backup: ${sorted[$i]}"
    done
  fi
fi

# -----------------------------------------------------------
# 6. Print cron instructions
# -----------------------------------------------------------
echo ""
echo "============================================================"
echo "  Backup Script Complete"
echo "============================================================"
echo ""
echo "To automate daily backups, add the following crontab entry:"
echo ""
echo "  0 2 * * *  ${PROJECT_ROOT}/infra/scripts/setup-backups.sh >> /var/log/university-erp-backup.log 2>&1"
echo ""
echo "Weekly snapshots are created automatically on Sundays. To force one during a manual run:"
echo ""
echo "  FORCE_WEEKLY=1 ${PROJECT_ROOT}/infra/scripts/setup-backups.sh"
echo ""
echo "Example weekly snapshot copy:"
echo "  cp -al \"${BACKUP_DIR}/daily/<timestamp>\" \"${BACKUP_DIR}/weekly/<timestamp>\""
echo ""
echo "Configuration:"
echo "  BACKUP_DIR=${BACKUP_DIR}"
echo "  DB_DIR=${DB_DIR}"
echo "  BACKUP_DEST=${BACKUP_DEST:-<not set>}"
echo "  Retention: 7 daily / 4 weekly"
echo "============================================================"
