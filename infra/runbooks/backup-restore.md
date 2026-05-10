# Backup and Restore Runbook

## Redis
- AOF enabled + snapshot verification.
- Weekly restore drill from persisted data.

## SQLite + Filesystem
- Back up `Backend/data/*.sqlite` files daily.
- Back up `Backend/data/events` and content upload directories daily.
- Validate backups with a periodic restore drill in staging.

## Restore Drill Procedure
1. Stop writes.
2. Restore latest SQLite database files and filesystem backup.
3. Restore Redis AOF/RDB data if needed.
4. Validate API readiness and data integrity.
5. Resume writes after validation.
