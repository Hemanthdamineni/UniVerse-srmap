# Secret Rotation Runbook

> Gate 6 P1 / Gate 9 P1. Covers the operational procedure for
> rotating the secrets the platform depends on. Pair this with the
> `setup-backups.sh` runbook (`backup-restore.md`) — backups must
> succeed after a secret rotation for the system to be considered
> healthy.

## Inventory

| Secret | Source env var(s) | Consumer | Storage |
| --- | --- | --- | --- |
| Redis password | `REDIS_PASSWORD` | redis container + backend | docker-compose `secrets:` block (or `.env` for dev) |
| Redis URL | `REDIS_URL` | backend | `.env` |
| Admin content password | `ADMIN_CONTENT_PASSWORD` | backend admin elevation | `.env` |
| ERP scraper enabled | `CAREER_SCRAPER_ENABLED` | backend supervisor | `.env` |
| Test student register | `TEST_STUDENT_USER` / `_PASS` | authz probe + e2e | `.env` (dev only) |
| Test admin register | `TEST_ADMIN_USER` / `_PASS` | authz probe + e2e | `.env` (dev only) |

The list of secrets above is enforced by Gate 6 P1 — empty
`ADMIN_CONTENT_PASSWORD` must continue to fail-fast in compose
(see `docker-compose.yml`'s `ADMIN_CONTENT_PASSWORD:=
${ADMIN_CONTENT_PASSWORD:-}` lines).

## Pre-rotation checklist

1. **Take a backup** even if the rotation isn't expected to touch
   data. Run `bash infra/scripts/setup-backups.sh` and confirm
   the daily tar lands at `/var/backups/university-erp/daily/...`.
2. **Confirm two operators are online.** Rotation of `REDIS_PASSWORD`
   briefly restarts the backend; if a peer isn't around to spot a
   regression, wait.
3. **Pick an off-peak window** — the platform's traffic is heaviest
   18:00–22:00 IST; rotate between 02:00 and 06:00 IST.

## Rotation procedures

### Redis password (`REDIS_PASSWORD`)

1. Generate a replacement:
   ```bash
   NEW_REDIS_PASSWORD=$(openssl rand -base64 24 | tr -d '=/+' | head -c 32)
   ```
2. In `.env`, set `REDIS_PASSWORD=$NEW_REDIS_PASSWORD`.
3. In production, push the new value through your secrets manager
   (AWS Secrets Manager, Vault, etc.). Update the redis container's
   `command` (`--requirepass`) and the backend's `REDIS_URL`.
4. Restart the backend first:
   ```bash
   docker compose up -d --no-deps backend
   ```
5. Confirm `/api/ready` reports `redisReady: true`.
6. Restart redis so it picks up the new `requirepass`:
   ```bash
   docker compose up -d --no-deps redis
   ```
7. Re-run the authz probe (Gate 6): `BASE_URL=https://...
   bash Backend/scripts/authz-probe/run-all.sh` — should report
   `pass=9  fail=0`.

### Admin content password (`ADMIN_CONTENT_PASSWORD`)

1. Generate a replacement:
   ```bash
   NEW_ADMIN_PASSWORD=$(openssl rand -base64 24 | tr -d '=/+' | head -c 32)
   ```
2. Update `.env` (dev) or the secrets manager entry (prod).
3. Restart the backend. Empty values must still fail-fast
   (compose check) — confirm by setting `ADMIN_CONTENT_PASSWORD=`
   briefly and observing the container exits.
4. Verify the admin unlock path still works in the browser.

### Test credentials

These live in `.env` for dev/CI only. Rotate by:
1. Update `TEST_STUDENT_USER` / `TEST_STUDENT_PASS` and the admin
   counterpart in `.env`.
2. Re-run `Backend/scripts/authz-probe/run-all.sh` to confirm probes
   still resolve to the expected status codes.

## Post-rotation

1. Run the authz probe matrix: `bash Backend/scripts/authz-probe/run-all.sh`
2. Run the full backend suite: `cd Backend && node --test test/`
3. Run the prod-readiness smoke (Gate 10):
   `bash infra/scripts/postdeploy-smoke.sh` (added in PR 10)
4. **Never** commit a real secret. If a secret was committed, rotate
   it immediately and rewrite history with `git filter-repo`.

## Recovery

If rotation goes wrong:

1. **Restore the previous secret** from your secrets manager
   history or the backup taken at the start of this runbook.
2. Restart the affected containers: `docker compose up -d --no-deps <service>`
3. Verify `/api/ready` returns 200 and `redisReady` matches
   expectations.
4. If a secret leaked into the git history, follow the
   `git filter-repo` procedure in CONTRIBUTING.md (TODO if missing).

## Related runbooks
- `infra/runbooks/backup-restore.md` — restore drill; must be runnable
  with the rotated secrets.
- `infra/runbooks/rollback.md` — image-tag rollback; same restart
  discipline as a secret rotation.
- `infra/runbooks/upstream-erp-outage.md` — operational counterpart
  for the ERP integration, not for secrets.
