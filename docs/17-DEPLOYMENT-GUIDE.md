# 12 — Deployment Guide (Free-Tier, $0/Month, Production-Grade)

> **Target:** One university, ~10,000 registered students, ~1,000 concurrent at peak
> **Cost:** $0/month compute, $0 egress, $0 object storage, $0 monitoring, $0 backups
> **Philosophy:** Best, not simplest. Every recommendation in this guide assumes you have agents doing the pre-prod work and you want the most operationally excellent, most maintainable, most future-proof $0 deploy possible. "It's simple" is not a tiebreaker when simplicity costs you reliability. The only hard constraint is that nothing bills you a cent.
> **Revision note:** v6 — v5 closed 30 code-anchored bugs. v6 is a 2026 ecosystem review of every major stack choice in the guide, asking whether the v5 picks are still right given the current state of the alternatives. v6 adds 13 new sections (§20-§32) covering CI/CD alternatives, monitoring stack choices, error-tracking options, container orchestration decisions (k3s vs Swarm vs Compose), reverse-proxy comparison, the 47-day TLS cert transition, layered monitoring (UptimeRobot + Healthchecks.io), object storage hedges, domain registrar reality, the SQLite WAL ceiling, the always-separate Python scraper VM, a time-budget decision matrix, and the hidden cost of "free" hosting. **The v5 picks (Compose, Caddy, R2, Grafana Cloud, Sentry, GitHub Actions self-hosted) all remain correct.** v6 adds the context for *when* to switch (the size envelopes, the upgrade triggers, the escape hatches) and the 2026-specific changes (TLS cert lifetime, GitHub private-repo runner pricing, Freenom's death, Sentry's tightened event counting). v4 was a major expansion: (a) §1B adds a recommended **two-VM cross-cloud failover target architecture** in addition to the single-VM starting point, because Oracle halved its free ARM tier on 2026-08-18; (b) §8.5 introduces **Cloudflare as authoritative DNS with Caddy's DNS-01 challenge**, so certs survive VM swaps; (c) §11c adds a **residential-proxy path for backend→ERP traffic** to bypass Oracle IP reputation issues; (d) §12½ adds **SQLite hardening** (PRAGMA tuning, `PRAGMA integrity_check` cron, automated weekly restore-test); (e) §13 is rewritten to include **Sentry + a free status page** in addition to UptimeRobot; (f) §14 is rewritten as a real **CI/CD pipeline using a GitHub Actions self-hosted runner on the VM**; (g) §15.5 adds **compliance and abuse handling**; (h) §17 now points to **self-hosted Postgres on a second free VM** as the real migration target; (i) §18 adds a **60-minute bootstrap-from-scratch** playbook for disaster recovery; (j) the doc ends with an **agent work list** so the implementation is a literal task list.

**v4 retrospective** (kept for history): v4 added §1B (two-VM cross-cloud failover), §8.5 (Cloudflare DNS), §11c (residential proxy), §12½ (SQLite hardening), §13 (Sentry + status page), §14 (real CI/CD), §15½ (compliance + abuse), §17 (self-hosted Postgres migration target), §18 (bootstrap playbook), §19 (agent work list). The red-team found that v4 was internally consistent and well-framed but had ~30 real bugs and code-anchored errors that would have caused first-day deploys to fail or first-week data to corrupt silently. v5 addresses all criticals and most important ones — see the fix list above.

---

## 1. Decision Summary

| Layer | Choice | Why |
|---|---|---|
| Compute | Oracle Cloud **Always Free** Ampere A1 VM — 2 OCPU / 12GB RAM / 200GB block storage (shared pool — see §3) | Only major provider still offering a genuinely free, persistent, real VM at this scale. Render's free tier has no persistent disk; Fly.io killed free accounts in Oct 2024. **Caveat as of 2026-08-18:** Oracle halved the ARM tier from 4/24 to 2/12 — see §1B for the cross-cloud failover target. |
| Hostname | **Cloudflare as authoritative DNS** (recommended in §8.5) — DuckDNS as a quick-start fallback for the first hour | Cloudflare gives you DNS-01 ACME challenges that survive VM IP changes, free DDoS protection, and a stable point to anchor failover. DuckDNS works for day-1 but locks certs to one IP. |
| TLS + reverse proxy + static hosting | **Caddy** with Cloudflare DNS-01 challenge (or HTTP-01 if you stay on DuckDNS) | One file, automatic cert issuance/renewal, serves the built frontend AND proxies `/api` + `/files`. |
| Backend | Existing Node/Express container, built for **arm64** | Two unverified risks live here — see §11. |
| Cache/session store | Redis, same box, password-protected | Matches existing `REDIS_URL` config; no new infra. (See §1B for the "drop Redis" alternative if you want a smaller mental model.) |
| Data | All SQLite files + uploads on a **VM-local bind mount**, never inside the container, never NFS | SQLite + network filesystem = corruption risk. One backend instance only — no horizontal scaling on this stack. §12½ hardens this with PRAGMAs, integrity checks, and an automated weekly restore-test. |
| Backups | Nightly cron → **`sqlite3 .backup`** per database → Cloudflare R2 (10GB free) | A live-file `tar` of an open SQLite/WAL database can produce a torn, corrupted backup. Never tar a live DB — see §12. §12 also covers automated restore-testing. |
| Monitoring | Oracle's built-in metrics + free UptimeRobot ping + **Sentry free tier (5k errors/mo) + free status page (Betterstack/Hyperping)** | See §13 for the full monitoring stack. |
| CI/CD | **GitHub Actions self-hosted runner on the VM** (free, unlimited minutes for self-hosted) | Every push to `main` builds, tests, and deploys without a human SSHing in. See §14. |
| Escape hatch | Two-VM cross-cloud warm standby (§1B), or portable Docker Compose to any $5-6/mo Hetzner/DO VPS | Oracle's free tier has been cut twice; betting your whole stack on one provider is fragile. The two-VM path costs nothing and survives a cloud-side outage. |

---

## 1B. The Two-VM Cross-Cloud Failover Target (Recommended)

The single-VM-on-Oracle setup in §1 is the right **starting point** for the first 6-12 months. It is not the right **destination**. Oracle cut its free ARM tier in half on 2026-08-18; if the next round of cuts lands during your semester, you have hours, not weeks, to migrate. The cost of a 30-hour agent job to set up cross-cloud failover now is much less than the cost of one 8-hour outage while a student is trying to check their exam results.

### What it is

```
                  Cloudflare DNS (authoritative)
                  TTL=60s
                  record: app.yourdomain.com → A/B
                       │            │
              ┌────────┘            └────────┐
              ▼                              ▼
    ┌────────────────────┐         ┌────────────────────┐
    │ PRIMARY            │         │ STANDBY            │
    │ Oracle Free ARM    │         │ GCP e2-micro (us-   │
    │ 2 OCPU / 12GB      │  ◀──┐   │ west1, always-free) │
    │ fsn1 / yyz         │     │   │ 0.25 vCPU / 1GB    │
    │ full backend + DB  │     │   │ nightly R2 restore │
    └────────┬───────────┘     │   └────────┬───────────┘
             │                 │            │
             │  every 1h:      │            │
             │  - rclone sync  │            │
             │    from PRIMARY │            │
             │    to R2        │            │
             └─────────────────┘            │
                                pulls from R2
```

- **Primary** is the Oracle VM in §1. Same compose file, same env, same data dir.
- **Standby** is a GCP `e2-micro` (always-free, US regions only) running a *read-only* `docker compose up` of the same services, with the data dir restored nightly from R2. The standby uses `CAREER_SCRAPER_ENABLED=0` (not a made-up `STANDALONE=true` flag — there is no such flag in the backend) so the scraper supervisor doesn't try to start on a VM that doesn't have the Python runtime.
- Standby does **not** serve traffic by default. It exists to (a) catch broken deploys when you push to `main`, and (b) be the failover target if the primary dies.
- On a planned cutover, you flip the Cloudflare A record to the standby's public IP, watch error rates for 10 minutes, and you're done.

### Realistic cutover: 5-10 minutes, not 60 seconds

The "60 seconds" claim in v4 was the DNS TTL only. The full sequence:

1. **Human edits the Cloudflare A record** (1 minute of human time).
2. **DNS propagates.** Cloudflare's edge has a 30-60s lag before the change is fully live. Client-side caches respect the previous 60s TTL, so once the change is live, another 60s passes for any cached clients.
3. **Standby's Caddy needs to be running with current cert and data.** If the standby is a freshly-booted VM, Caddy will do a fresh DNS-01 cert challenge (30-60s).
4. **Data staleness.** The standby's data is restored from R2 nightly, so the most recent write visible to the standby is up to 24h old. A student who submitted work 5 minutes before cutover loses those writes unless the R2 pull schedule is tightened (see §1B-e below).
5. **Cloudflare origin allowlist** (if enabled) must include the standby's public IP; otherwise Cloudflare returns 403 to visitors.

Realistic RTO from "primary is down" to "standby is serving": **5-10 minutes minimum**, dominated by DNS propagation + cert reissue + Cloudflare edge propagation.

### What it costs

- **$0/month.** GCP's `e2-micro` is in the always-free tier (30GB disk, 1GB RAM, US regions). It runs the same compose file with `CAREER_SCRAPER_ENABLED=0` and a tightened rclone schedule (see §1B-e).
- The "drop Redis" alternative is worth considering: on a single VM, Redis is a SPOF that adds operational burden without giving you cross-instance sessions (which the architecture explicitly disclaims). If you accept a 30-minute session TTL on cold start, the backend's in-memory session store works fine. The current code already supports this via `SESSION_STORE_DRIVER=memory`. One less container to manage, one less thing to back up, one less thing to fail. The "best" recommendation here is **drop Redis on day one** unless you have a measured reason not to.

### What it doesn't solve

- **The Oracle IP reputation problem** with the SRM AP ERP. Both VMs would still be on datacenter IPs. §11c covers that.
- **Region-isolated active-active.** The two VMs are in different clouds and different regions, but only one is active at a time. True active-active across clouds would need a real distributed DB (Postgres + read replicas, see §17), which the SQLite stack can't do.
- **The Cloudflare dependency.** If Cloudflare has an outage, you're on the Cloudflare origin directly via the IP. The Caddyfile has to handle this. §8.5 covers it.

### When to build it

After the single-VM setup is stable for ~30 days, **before** your first big user surge (semester start, exam result day, fee deadline). 30 hours of agent work; pays for itself the first time Oracle sends you a "we're cutting your tier" email.

---

## 2. Architecture

```
                         Students' browsers
                                │
                                │ HTTPS (DuckDNS hostname)
                                ▼
                 ┌─────────────────────────────┐
                 │   Oracle Cloud "Always Free"  │
                 │   VM.Standard.A1.Flex          │
                 │   2 OCPU / 12GB RAM / 200GB    │
                 │   Ubuntu 24.04 ARM64            │
                 │                                │
                 │  ┌──────────────────────────┐  │
                 │  │  Caddy (:80, :443)        │  │
                 │  │  - auto TLS via DuckDNS   │  │
                 │  │  - serves Frontend/dist   │  │
                 │  │  - blocks /api/health,    │  │
                 │  │    /api/metrics publicly  │  │
                 │  │  - waits for backend      │  │
                 │  │    healthcheck before     │  │
                 │  │    routing (see §7)       │  │
                 │  └──────────┬────────────────┘  │
                 │             │                    │
                 │  ┌──────────▼─────────┐  ┌──────┴─────┐
                 │  │ backend (Node :5000)│──│   Redis     │
                 │  │ Playwright+Chromium │  │  (password) │
                 │  └──────────┬──────────┘  └────────────┘
                 │             │                              │
                 │  ┌──────────▼──────────────────────────┐   │
                 │  │ /opt/erp-platform/data/  (bind mount)│   │
                 │  │  ALL *.sqlite files + uploads live    │   │
                 │  │  here — see §9 for why "just 3 paths" │   │
                 │  │  is not enough                        │   │
                 │  └───────────────────────────────────────┘  │
                 └─────────────────────────────────────────────┘
                                │
                                │ nightly cron: sqlite3 .backup (per DB) → upload
                                ▼
                     Cloudflare R2 (off-box backup, free tier)
```

---

## 3. Provision the VM

1. Create an Oracle Cloud account (credit card required for identity verification; Always Free resources never bill).
2. Create a Compute Instance:
   - Shape: **VM.Standard.A1.Flex**
   - OCPUs: 2, Memory: 12GB (this is the full Always Free allotment as of mid-2026 — it was cut from 4/24 in June 2026)
   - Image: **Ubuntu 24.04 (ARM64/Ampere)**
   - Boot volume: expand as needed, but **note:** Oracle's 200GB Always Free block storage is a **single shared pool across all volumes on the tenancy**, not 200GB per volume. If you ever attach a second block volume, you've split that pool — don't attach extra volumes unless you plan for it.
3. Assign a **reserved (static) public IP** — not ephemeral, or it changes on stop/start.
4. Open ports **once, with one tool** — `ufw` (it wraps iptables and is the systemd-managed option that survives reboots; don't also hand-edit iptables, the two will fight each other and cause "why isn't my rule applying" debugging later):
   ```bash
   sudo ufw allow 22/tcp
   sudo ufw allow 80/tcp
   sudo ufw allow 443/tcp
   sudo ufw enable
   ```
   Also open the same three ports in the VCN's **Security List** in the Oracle console — both layers need to agree, but manage the instance-level firewall through `ufw` only.
5. Harden SSH:
   ```bash
   # In /etc/ssh/sshd_config: PasswordAuthentication no
   sudo systemctl restart ssh
   ```
6. **Verify time sync.** A wrong system clock invalidates cookies, certs, captcha TTL, and Playwright session windows — silently:
   ```bash
   timedatectl show
   # Confirm: NTP=yes, NTP synchronized=yes, System clock synchronized=yes
   # If not: sudo systemctl enable --now systemd-timesyncd
   ```
7. Do not expose your Oracle tenancy name or instance OCID (`ocid1.tenancy.oc1..aaaa...`) anywhere public-facing — not in the Caddy `server_name`, not in error pages, not in commit messages. Not a critical vulnerability, but no reason to advertise it.

---

## 4. DNS (DuckDNS)

1. Sign in to [duckdns.org](https://www.duckdns.org) with any OAuth provider.
2. Create a subdomain, e.g. `srmaperp` → `srmaperp.duckdns.org`.
3. Point it at your VM's reserved public IP.
4. That's it — since the IP is **static**, you don't need DuckDNS's dynamic-update cron client. Skip it; it adds a moving part for zero benefit on a reserved IP.

---

## 5. Install Docker

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
newgrp docker
docker compose version
```

---

## 6. Directory Layout on the VM

```
/opt/erp-platform/
├── docker-compose.yml
├── Caddyfile
├── .env
├── repo/                    # full monorepo checkout — see §10 for why
│   ├── Backend/
│   └── Frontend/
├── frontend-dist/           # built output, synced in via rsync, not a live mount
└── data/                    # bind-mounted persistent volume — THE important directory
    ├── content.sqlite
    ├── events.sqlite
    ├── external-pages.sqlite
    ├── (any other *.sqlite your current codebase defines — see §9)
    ├── events/
    └── submissions/
```

---

## 7. `docker-compose.yml`

**Critical:** create `/opt/erp-platform/Caddyfile` with the contents from §8 (or §8.5 once you switch to Cloudflare). If you skip this, Caddy starts with its default static-file config and silently serves the wrong site.

```yaml
services:
  backend:
    build:
      context: ./repo/Backend
    restart: unless-stopped
    env_file: .env
    environment:
      - CAREER_SCRAPER_ENABLED=0     # CRITICAL: Scraper/venv is not in the image; without this the supervisor logs "scraper runtime missing" on every boot
      - NODE_ENV=production
    volumes:
      - ./data:/app/data
      # DO NOT mount ./repo/Backend/data — the image already COPYs data/ in via Dockerfile.
      # The host's ./data bind-mount should win and provide persistence, but pre-seed
      # ./data/endpoint-discovery.json from the repo if the discovery file matters on cold start.
    depends_on:
      - redis
    expose:
      - "5000"
    healthcheck:
      # The repo's existing root compose uses `wget --spider ...` — but `wget` is NOT in
      # the `node:22-bookworm-slim` base image, so that healthcheck fails silently and
      # Caddy never starts. Use the node-based check below.
      test: ["CMD", "node", "-e", "require('http').get('http://localhost:5000/api/live', r => process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 60s       # Cold async boot (Redis connect + seed + integrity) exceeds 15s
      start_interval: 5s

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    command: ["redis-server", "--requirepass", "${REDIS_PASSWORD}", "--appendonly", "yes"]
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "-a", "${REDIS_PASSWORD}", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  caddy:
    # If you adopt §8.5 (Cloudflare DNS-01), replace this with `image: local/caddy:cloudflare`
    # built from infra/docker/Dockerfile.caddy — see §8.5.
    image: caddy:2-alpine
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile
      - ./frontend-dist:/srv/frontend:ro
      - caddy_data:/data
      - caddy_config:/config
    depends_on:
      backend:
        condition: service_healthy

volumes:
  redis_data:
  caddy_data:
  caddy_config:
```

### 7-bis. The no-Redis variant (if you took §1B's "drop Redis" recommendation)

If you accept a 30-minute session TTL on cold-start and want one less container to manage, drop the `redis` service and switch the backend's session/cache drivers to in-memory. The backend supports this via `SESSION_STORE_DRIVER=memory` and `ERP_CACHE_DRIVER=memory`.

```yaml
services:
  backend:
    build:
      context: ./repo/Backend
    restart: unless-stopped
    env_file: .env
    environment:
      - CAREER_SCRAPER_ENABLED=0
      - NODE_ENV=production
    volumes:
      - ./data:/app/data
    expose:
      - "5000"
    healthcheck:
      test: ["CMD", "node", "-e", "require('http').get('http://localhost:5000/api/live', r => process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 60s
      start_interval: 5s

  caddy:
    image: caddy:2-alpine
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile
      - ./frontend-dist:/srv/frontend:ro
      - caddy_data:/data
      - caddy_config:/config
    depends_on:
      backend:
        condition: service_healthy
```

**Caveat:** the in-memory rate limiter is per-process, not distributed. If you ever add a second backend container (the §17.c Postgres migration), the rate limit budget is per-container, so an attacker can multiply their budget by N. The in-memory limiter is only safe for a single backend process. Redis becomes a hard requirement the moment you go multi-process.

**Fixed from v1:** Caddy now waits for the backend's `service_healthy` state, not just container start. Without this, the first minute after every cold deploy would serve 502s on `/api/*` while Caddy is up but the backend is still initializing.

---

## 8. `Caddyfile`

```
srmaperp.duckdns.org {
    encode gzip
    root * /srv/frontend

    # Security headers — baseline for a "production-grade" claim.
    # Without HSTS, the first connection can be MITM-downgraded to HTTP.
    header Strict-Transport-Security "max-age=31536000; includeSubDomains"
    header X-Content-Type-Options "nosniff"
    header Referrer-Policy "strict-origin-when-cross-origin"
    header X-Frame-Options "DENY"

    # Force the PWA's index.html to never be served from a stale cache
    # by a service worker or browser cache. This is the cheap fix for
    # the PWA-stale-code problem (the proper fix is in vite.config.ts
    # workbox config, see §14 / T3.x). Hashed assets in /assets/* are
    # still served with the default immutable cache.
    @index path /index.html
    header @index Cache-Control "no-cache, no-store, must-revalidate"

    @blocked path /api/metrics /api/health /api/telemetry
    respond @blocked 404

    reverse_proxy /api/*  backend:5000
    reverse_proxy /files/* backend:5000

    try_files {path} /index.html
    file_server
}
```

**Fixed from v1:** the previous version put `respond @internal 404` as a bare top-level directive after the `handle /api/*` block — Caddy's directive ordering meant `/api/health` and `/api/metrics` would actually hit the reverse proxy first and never get blocked. The `@blocked` matcher is now evaluated before any `reverse_proxy` rule fires. Point UptimeRobot at `/api/live`, which is intentionally left open — the blocked paths are `/api/health` (verbose internal detail) and `/api/metrics` (Prometheus scrape target), not the liveness probe. The `route`-style version above is preferred over the earlier `handle`-block variant for one reason: fewer rules to mis-order in the future.

**v5 additions:** HSTS and basic security headers (any "production-grade" claim requires these), plus `Cache-Control: no-cache` on `index.html` to mitigate the PWA service-worker-stale-code problem.

---

## 8.5. Use Cloudflare as the Authoritative DNS (Recommended for Production)

The §4 DuckDNS setup is fine for the first hour. For anything past that, **move DNS to Cloudflare** (free plan, $0) and use Caddy's Cloudflare DNS plugin to issue certs via DNS-01. The benefits:

- **Certs are bound to the DNS record, not the IP.** Move the VM, swap cloud providers, change the IP — the cert stays valid. This is what makes the §1B cross-cloud failover story actually work; with HTTP-01 challenges tied to the IP, every failover would force a 5-minute cert re-issuance.
- **Free DDoS protection** at the edge (rate limits, challenge pages for known-bad sources).
- **Free static-asset caching** for `/assets/*` (the Vite-hashed bundles) — drops origin load ~30% on cold-start.
- **Free analytics** showing real request volume, threat events, top paths.

### CRITICAL: the standard `caddy:2-alpine` image does NOT include the Cloudflare DNS plugin

The `acme_dns cloudflare` directive requires a Caddy build that includes the `github.com/caddy-dns/cloudflare` plugin. The official `caddy:2-alpine` does not. If you use the default image, the cert request will fail with `no DNS plugin configured for cloudflare`, which is a cryptic error and an easy way to lose an afternoon.

Build a custom image once and reuse it on both the primary and the §1B standby:

```dockerfile
# infra/docker/Dockerfile.caddy
FROM caddy:2-builder AS builder
RUN xcaddy build \
    --with github.com/caddy-dns/cloudflare

FROM caddy:2-alpine
COPY --from=builder /usr/bin/caddy /usr/bin/caddy
```

```bash
docker build -f infra/docker/Dockerfile.caddy -t local/caddy:cloudflare .
# Reference in §7 compose as: image: local/caddy:cloudflare
```

This image works for both DuckDNS (HTTP-01) and Cloudflare (DNS-01) challenges, so you can use it from day one even if you haven't moved DNS to Cloudflare yet.

### Setup (one-time, 20 minutes)

1. Sign up at [cloudflare.com](https://cloudflare.com), add your domain (or use a free `yourdomain.com` if you don't own one — wait, you do need to own a domain; the cheapest path is a ~$8-12/yr TLD like `.xyz` or `.click`).
2. In Cloudflare DNS, add `A app.yourdomain.com <your-oracle-public-ip>` **proxied** (orange cloud). TTL 60s.
3. Create a Cloudflare API token with `Zone:DNS:Edit` scope for the specific zone. Save it; you will use it in Caddy.
4. In `Caddyfile`, replace the bare hostname with the Cloudflare DNS challenge config (note: this requires the custom Caddy image from above):

```
{
    acme_dns cloudflare {env.CF_API_TOKEN}
}

app.yourdomain.com {
    encode gzip
    root * /srv/frontend

    # (security headers from §8 go here)

    @blocked path /api/metrics /api/health /api/telemetry
    respond @blocked 404

    reverse_proxy /api/*  backend:5000
    reverse_proxy /files/* backend:5000

    try_files {path} /index.html
    file_server
}
```

5. Add `CF_API_TOKEN=...` to `.env` (or pass it as a Caddy env var via the compose file).
6. Restart Caddy: `docker compose up -d --no-deps caddy`. Caddy will request a cert via DNS-01, which works *even if port 80 is blocked at the firewall* (useful for the standby VM in §1B which you may not want to expose on 80 yet).

### Transitioning from DuckDNS to Cloudflare on a live Caddy install

If you deployed with the §4 DuckDNS Caddyfile and now want to switch to Cloudflare:

1. Update `/opt/erp-platform/Caddyfile` to the new hostname (`app.yourdomain.com`) and add the `acme_dns cloudflare {env.CF_API_TOKEN}` block.
2. **Remove the existing Caddy data volume so the old cert (for `srmaperp.duckdns.org`) is forgotten:**
   ```bash
   docker compose down
   docker volume rm $(docker volume ls -q | grep caddy_data)
   docker compose up -d
   ```
3. Caddy will issue a fresh cert for the new hostname via DNS-01. There will be a 30-60 second HTTPS outage during the re-issue; HTTP (port 80) keeps serving the SPA shell the whole time.
4. After Caddy comes up, verify with `curl -I https://app.yourdomain.com/api/live` and check the cert issuer is Let's Encrypt (not DuckDNS).

If you skip step 2, Caddy's cert cache holds the DuckDNS cert and won't re-issue for the new hostname, leaving the operator staring at a "cert name does not match" error for an hour before figuring this out.

### What this changes about failover

When the Oracle VM dies and you want to point `app.yourdomain.com` at the GCP standby:

1. In Cloudflare DNS, flip the `A` record to the standby's public IP.
2. The cert **stays valid** because it was issued for the hostname, not the IP.
3. Caddy on the standby is already running with the same Caddyfile and the same `CF_API_TOKEN`; it'll just start answering.

The whole cutover is "edit one DNS record, wait 60 seconds for TTL." This is the part of the architecture that converts "single VM" into "real failover."

### Cost: still $0

Cloudflare free plan: unlimited DNS queries, unlimited DDoS mitigation, free universal SSL, 100k Worker requests/day (not used here but free if you want it later). Domain costs $8-12/yr — call it a $1/mo amortized cost, the only recurring expense in the entire stack.

---

## 9. `.env` — Required Variables

Generate the secrets first — never ship `CHANGE_ME_*` placeholders to prod:

```bash
echo "REDIS_PASSWORD=$(openssl rand -hex 24)"          >> .env
echo "ADMIN_CONTENT_PASSWORD=$(openssl rand -hex 24)" >> .env
echo "CF_API_TOKEN=replace-with-cloudflare-token"      >> .env
```

Then fill in the rest. Every `*_DB_PATH` must point inside `/app/data` — see the WARNING below for why "trust the defaults" is not a viable shortcut today:

```bash
NODE_ENV=production
PORT=5000

REDIS_URL=redis://:${REDIS_PASSWORD}@redis:6379
SESSION_STORE_DRIVER=redis
ERP_CACHE_DRIVER=redis
SESSION_COOKIE_SECURE=true
SESSION_COOKIE_SAME_SITE=lax

# CRITICAL: Scraper/venv is not baked into the backend image, so the
# career scraper supervisor will start on every boot, fail to find its
# runtime, and spam logs. Set this to 0 until you have a separate
# residential-IP host for the Python pipeline.
CAREER_SCRAPER_ENABLED=0

# CRITICAL: the default value of FRONTEND_BLUEPRINT_FILE points OUTSIDE
# the container (../../../Frontend/src/config/erpBlueprints.ts), and
# the integrity report will mark the backend as "not ready" if it can't
# find the file — which makes /api/ready return 503 forever and breaks
# Betterstack/UptimeRobot readiness monitors. Override to an empty
# string (disables blueprint integrity reporting) or to a path you
# actually ship.
FRONTEND_BLUEPRINT_FILE=

# CRITICAL: Rotating REDIS_PASSWORD or ADMIN_CONTENT_PASSWORD will
# silently invalidate every active session and force every user to
# re-login (including solving a fresh captcha). Do this only during a
# low-traffic window. For Redis, the cleanest way is Redis ACLs (AUTH
# default + per-user) rather than a single global password.

# See WARNING below — full list of paths, not just three.
CONTENT_DB_PATH=/app/data/content.sqlite
EXTERNAL_DB_PATH=/app/data/external-pages.sqlite
LMS_DB_PATH=/app/data/lms.sqlite
LMS_TRACKER_DB_PATH=/app/data/lms-tracker.sqlite
UNIFIED_PROFILE_DB_PATH=/app/data/unified-profile.sqlite
COMPANION_ANALYTICS_DB_PATH=/app/data/companion-analytics.sqlite
HOSTEL_BUDDY_DB_PATH=/app/data/hostel-buddy.sqlite
EVENTS_DB_PATH=/app/data/events.sqlite
HELPDESK_DB_PATH=/app/data/helpdesk.sqlite
CAMPUS_FEEDBACK_DB_PATH=/app/data/campus-feedback.sqlite
CAREER_DB_PATH=/app/data/career.sqlite
ERP_ATTENDANCE_SNAPSHOTS_DB_PATH=/app/data/erp-attendance-snapshots.sqlite
VACANT_ROOMS_DB_PATH=/app/data/vacant-rooms.sqlite
PERSISTENT_TEAMS_DB_PATH=/app/data/persistent-teams.sqlite
EVENTS_DATA_DIR=/app/data/events
UPLOADS_DIR=/app/data/uploads
LMS_FILES_DIR=/app/data/lms

# Keep diagnostic artifacts (captcha HTML, failed-login dumps) across rebuilds
LOG_DIR=/app/data/logs
LOGIN_DIAGNOSTICS_DIR=/app/data/logs/login-attempts

# Same-origin deploy (frontend + backend on one host) — leave empty unless
# you deliberately add a second origin later.
CORS_ALLOWED_ORIGINS=

FEATURE_ERP_V2_API=1
FEATURE_ERP_CACHED_FIRST=1
FEATURE_AUTH_COOKIE_MODE=1
```

### 9½. Frontend `.env.production` (separate file, baked at build time)

The frontend's Vite build reads `Frontend/.env.production` at `npm run build` time and bakes any `VITE_*` variable into the JavaScript bundle. **These are not runtime env vars** — they ship in the static JS the user downloads. This is a common footgun: a developer's local `VITE_API_BASE_URL` from a stale `.env.local` ends up baked into the production bundle.

```bash
# Frontend/.env.production
VITE_STATIC_PROTOTYPE=false     # CRITICAL: true flips Vite base path to './' and disables PWA, breaking Caddy-served assets
VITE_DEBUG_MODE=false           # No dev-only debug panels in prod
VITE_API_PROXY_TARGET=          # Empty in prod — only used by `vite dev`, not by the built bundle
VITE_ADMIN_REGISTER_NUMBERS=    # Comma-separated admin register numbers; baked into the bundle
```

Confirm after every `npm run build`:

```bash
# Should print 0 (no leaked secrets, no debug code)
grep -r "VITE_API_BASE_URL\|VITE_DEBUG_MODE\|isStaticPrototype" Frontend/dist/assets/ | wc -l
```

If you change `VITE_*` values, you must rebuild the frontend — the values are frozen at build time.

### ⚠️ WARNING: Don't trust that these are the only databases

The docs this guide was built from define three DB path variables. Your actual codebase may already have grown well past that (LMS and career domains each define their own SQLite file per your other planning docs, and per your own graph-analysis notes the codebase is "significantly further along than planning documents indicated"). If a database has no explicit `*_DB_PATH` override, it very likely falls back to a path that lives **inside the container's writable layer, not the bind-mounted volume** — meaning it looks fine in testing and then silently resets to empty on every rebuild.

**Before going live, run this against your actual repo, not this guide:**
```bash
grep -rn "_DB_PATH\|new Database(\|\.sqlite" Backend/src/config/ Backend/src/services/ | grep -i sqlite
```

### ⚠️ WARNING: The "just mount the whole data dir" shortcut also doesn't work today

The cleaner structural alternative — mount `./data:/app/data` and let every default path in `env.js` resolve naturally — sounds appealing but is currently broken for two reasons that both live in `Backend/src/config/env.js`:

1. `FRONTEND_BLUEPRINT_FILE` (line ~111) defaults to `../../../Frontend/src/config/erpBlueprints.ts` — a path that points *outside* the backend's working directory. The blueprint file isn't read at startup, so it won't crash the server, but anything that does integrity reporting against it will silently log "missing" forever.
2. `DISCOVERY_FILE_CANDIDATES` (line ~163) lists three candidate paths under `Backend/data/`, `Backend/scripts/`, and `Backend/Scripts/` — none of which exist in a fresh container unless you pre-seed `Backend/data/endpoint-discovery.json`.

So today, **set the env paths, don't try to skip them** — the block at the top of this section is the complete list. After a day of real usage, confirm everything is where it should be:
```bash
docker compose exec backend ls -la /app/data
```
Nothing important should be missing, and the only file/dir owned by `root` should be the parent `data/` itself — every `.sqlite` and subdir should match the UID the backend runs as.

**Also:** the backend image likely runs as root by default, so the first SQLite file created inside `/app/data` will be root-owned. Either add a `USER node` step in the Dockerfile, or run once after first boot:
```bash
docker compose exec backend chown -R node:node /app/data   # adjust uid/gid to match your image
```

---

## 10. First Deploy

**Fixed from v1:** the previous `git clone <repo-url> Backend` command clones the *entire* monorepo into a folder literally named `Backend`, so the real backend code ends up nested at `Backend/Backend/` — silently breaking the Compose build context. Clone the full repo into a neutral folder instead and point the build context at the subdirectory (already reflected in the `docker-compose.yml` above: `context: ./repo/Backend`):

```bash
cd /opt/erp-platform
git clone <your-repo-url> repo

# Build frontend in production mode — NOT `npm run build:static`, which is the
# no-backend prototype mode and silently flips the Vite `base` path, breaking
# asset resolution when served behind Caddy.
cd repo/Frontend && npm install && npm run build
rsync -a --delete dist/ /opt/erp-platform/frontend-dist/
cd /opt/erp-platform

docker compose up -d --build
docker compose logs -f backend

curl -s https://srmaperp.duckdns.org/api/live
```

---

## 11. ⚠️ The Two Real Unknowns

Everything else in this guide is well-trodden. These two are not — verify both before telling students the platform is live.

### 11a. Playwright on ARM64

Playwright supports Linux ARM64, but confirm it actually works on this specific image before relying on it:

```bash
docker compose exec backend node -e "
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  console.log('Chromium launched OK on', process.arch);
  await browser.close();
})();
"
```

If this fails, the usual fix is adding `RUN npx playwright install --with-deps chromium` as a build step — but confirm rather than assume it's needed.

### 11b. Oracle's IP reputation with the ERP's anti-bot defenses

This is the more likely real-world failure point. Oracle's Ampere A1 free-tier IP ranges are heavily recycled and commonly already present on abuse/scraper blocklists — a pattern well known across cloud free tiers, not specific to your setup. The risk isn't Chromium failing to launch (11a covers that); it's the ERP's login/captcha flow silently rejecting or rate-limiting requests that originate from your VM's IP, independent of anything your code does correctly.

**The test that actually proves this works:** run a full, real login through `/api/auth/captcha` → `/api/auth/login` against the live SRM AP ERP, from the production VM's IP, with a real test account — not just a bare `chromium.launch()`. Do this before pointing any students at the deployment. If it gets flagged, options include requesting a different Oracle availability domain/region (different IP block) or, if it persists, reconsidering whether Oracle's shared IP pool is viable for this specific ERP's defenses at all.

#### If the IP gets flagged: front the VM with Cloudflare (free)

This is the cheapest, fastest escape hatch when the Oracle IP itself is the problem. It doesn't fix the *backend → ERP* traffic (Caddy's outbound connection to the SRM AP ERP still originates from the Oracle IP, so the captcha login will still suffer). What it does fix is everything that *visitors* see: their DNS resolution, TLS termination, and HTTP requests all go through Cloudflare's anycast network, which has a much better reputation than a recycled Oracle IP. Concretely:

- Add the domain to Cloudflare (free plan), point NS records at Cloudflare.
- In Cloudflare DNS, add an `A` record for `srmaperp.duckdns.org` → your Oracle public IP, **proxied** (orange cloud).
- Caddy keeps terminating TLS and serving the app unchanged; the cert Let's Encrypt issues is now for the Cloudflare edge, and Cloudflare's own cert covers the visitor→edge hop.
- Free DDoS protection and a small static-asset cache on the way.

If even the Cloudflare-proxied IP doesn't help (because the problem is your *backend → ERP* outbound path, not visitor→backend), the remaining options are: (a) host the backend elsewhere with a better-reputation IP (a $5/mo Hetzner or DO VPS), keeping R2 for backups; (b) front the *backend → ERP* call specifically with a residential/ISP proxy — overkill for day one, but it exists.

### 11c. Front the Backend→ERP Traffic with a Residential Proxy (When the IP Itself Is the Problem)

§11b's "Cloudflare in front" only fixes visitor→backend. The captcha login still originates from your VM's IP, which is the actual problem if the ERP's anti-bot defenses are flagging datacenter ranges. The next level of fix: route only the *backend → ERP* traffic through a residential proxy.

**Why this works:** SRM AP's anti-bot is (almost certainly) IP-reputation based, not fingerprinting-based. A residential IP looks like a student on their home Wi-Fi; a datacenter IP looks like a server. Same code, same Playwright instance, different egress IP → very different result.

**Two ways to do it at $0 or near-$0:**

1. **Free-tier residential proxy services.** Several providers (Webshare, ProxyScrape, others) offer a few rotating residential IPs on their free tier. The volumes needed here are tiny — maybe 30 ERP calls/minute at peak, so 50k/day. Most free tiers cover this. Plug into the backend via `HTTPS_PROXY` env var; Playwright respects it natively.
2. **Self-hosted proxy on a residential connection you already have.** If you have a home internet connection (or know someone who does), put a Raspberry Pi or old laptop behind it, install `3proxy` or `tinyproxy`, and point the backend at it. Truly free, fully under your control, and the IP is genuinely residential because it actually is one.

**Configuration:**

```bash
# In the backend's .env
HTTPS_PROXY=http://user:pass@residential-proxy.example.com:8080
NO_PROXY=localhost,127.0.0.1,redis,caddy
```

Caddy is unaffected (it doesn't talk to the ERP). The `NO_PROXY` list keeps intra-stack traffic direct.

**The catch:** residential proxy IPs rotate and have variable latency (200-800ms vs 50ms for datacenter). The backend's `ERP_CACHED_TIMEOUT_MS` (6s) and `ERP_LIVE_TIMEOUT_MS` (15s) defaults have headroom for this. If you see timeouts after enabling a proxy, bump them to 12s/30s.

**When to do this:** only if §11a's Playwright launch AND §11b's Cloudflare-front both fail to get you a working captcha login. Don't add a residential proxy in the path on day one; add it when the symptom shows up.

---

## 12. Backups (Cloudflare R2)

**Fixed from v1:** the previous approach (`tar -czf` over the live `data/` directory) can capture a SQLite database mid-write — especially since these run in WAL mode — producing a backup that looks fine but is a torn, inconsistent snapshot on restore. Use SQLite's own online backup mechanism per database instead, which is safe to run against a live, in-use database.

**R2 free-tier quota awareness.** The free tier is 10GB storage + 10M Class A reads/month + 10M Class B writes/month + 1M Class A writes/month. The script below does ~14 sqlite3 `.backup` calls (locally, free), one `rclone copy` write (1 op), one tar (local, free), and one `rclone copy` write (1 op) per night. Well under the free tier. The §12½.e VM snapshot via `rclone rcat` is the one to watch — a 10GB boot volume over a flaky network can consume many Class B writes per upload; throttle it with `--transfers 1 --checkers 1` to avoid surprise.

```bash
# One-time: install rclone and configure an R2 remote
curl https://rclone.org/install.sh | sudo bash
rclone config   # create a remote named `r2` pointing at your Cloudflare R2 bucket

# /opt/erp-platform/backup.sh
#!/bin/bash
set -euo pipefail
TS=$(date +%F)
BACKUP_DIR="/opt/erp-platform/data/.backup-staging"
mkdir -p "$BACKUP_DIR"

# Back up every .sqlite file found in the data dir — safe against a live DB,
# unlike a raw tar. Uses the same disk as the data dir, not /tmp (which may
# be tmpfs and can OOM a small VM on a large backup).
for db in /opt/erp-platform/data/*.sqlite; do
  name=$(basename "$db")
  sqlite3 "$db" ".backup '$BACKUP_DIR/$name'"
done

tar -czf "$BACKUP_DIR/../backup-$TS.tar.gz" -C "$BACKUP_DIR" .
rclone copy "$BACKUP_DIR/../backup-$TS.tar.gz" r2:your-bucket-name/backups/
rm -rf "$BACKUP_DIR" "$BACKUP_DIR/../backup-$TS.tar.gz"

# Non-DB persistent data (uploads, events files) is safe to tar directly —
# it's not a database being actively written to mid-transaction.
# v4 put this tar in /tmp which is tmpfs and OOMs on a 12GB VM with large
# uploads. Both tars now live on the same data disk.
tar -czf "$BACKUP_DIR/../uploads-$TS.tar.gz" -C /opt/erp-platform/data events submissions 2>/dev/null || true
rclone copy "$BACKUP_DIR/../uploads-$TS.tar.gz" r2:your-bucket-name/backups/ 2>/dev/null || true
rm -f "$BACKUP_DIR/../uploads-$TS.tar.gz"
```

```bash
chmod +x /opt/erp-platform/backup.sh
(crontab -l 2>/dev/null; echo "0 3 * * * /opt/erp-platform/backup.sh >> /var/log/erp-backup.log 2>&1") | crontab -
```

**Test the restore path once, now, before you need it.** A backup you've never restored from is a guess, not a backup. Restoring is: `sqlite3 restored.sqlite ".restore '/path/to/backed-up-file.sqlite'"`.

**RPO reality check:** the nightly 03:00 cron means a worst-case 24-hour data loss window. For student records (submissions, marks, attendance), this is a real liability. If 24h RPO is unacceptable, tighten the cron to every 6h. Cost is ~4x the R2 writes, still under the free tier.

---

## 12½. SQLite Hardening (The $0 Reliability Story)

§12 covers the *backup* path. This section covers the *durability* path — making sure the live database doesn't silently corrupt, doesn't lose writes on crash, and is being checked continuously. All $0. All agent-installable in a few hours.

### 12½.a. PRAGMA tuning (apply once via an init script)

The backend uses `node:sqlite` in WAL mode on most stores (7 of 14 don't, per the prod-readiness checklist D10). For the stores that don't, add the missing PRAGMAs to a one-time `init-pragmas.sh` that runs on every container start (idempotent — WAL mode is a no-op if already set):

```bash
#!/bin/bash
# /opt/erp-platform/init-pragmas.sh
set -euo pipefail
DATA=/opt/erp-platform/data
for db in "$DATA"/*.sqlite; do
  sqlite3 "$db" "PRAGMA journal_mode = WAL;"      2>/dev/null || true
  sqlite3 "$db" "PRAGMA synchronous = NORMAL;"   2>/dev/null || true
  sqlite3 "$db" "PRAGMA foreign_keys = ON;"      2>/dev/null || true
  sqlite3 "$db" "PRAGMA busy_timeout = 5000;"    2>/dev/null || true
  sqlite3 "$db" "PRAGMA auto_vacuum = INCREMENTAL;" 2>/dev/null || true
done
```

Run it from a cron entry (every 6h is plenty) or as a `postStart` hook in the backend compose service. WAL is a per-database property, so this is safe to re-run.

### 12½.b. Daily `PRAGMA integrity_check` cron

The single cheapest "is my data still good" signal you can have. Runs against every database, posts results to a file the backend can read (or to a webhook if you wire one). The v4 hand-rolled JSON had three bugs: no escaping of multi-line failure messages, no detection of "zero databases found" (which silently masks a broken bind mount), and no jq on the box by default. Here's the v5 version that uses jq and is actually correct:

```bash
# /opt/erp-platform/integrity-check.sh
#!/bin/bash
set -euo pipefail
DATA=/opt/erp-platform/data
REPORT=/opt/erp-platform/data/.integrity-report.json

# Guard: zero DBs found means the bind mount is wrong or empty.
# Exit non-zero so the cron alerting fires — do not silently produce
# a "everything is fine, no databases to check" empty JSON.
shopt -s nullglob
dbs=("$DATA"/*.sqlite)
if [ ${#dbs[@]} -eq 0 ]; then
  echo "INTEGRITY CHECK FAILED: no .sqlite files in $DATA" >&2
  curl -X POST "$ALERT_WEBHOOK_URL" -d "{\"text\":\"integrity-check: no .sqlite files in $DATA — bind mount may be wrong\"}" || true
  exit 2
fi

# Build a JSON object using jq for proper escaping.
> "$REPORT"
first=1
for db in "${dbs[@]}"; do
  name=$(basename "$db" .sqlite)
  result=$(sqlite3 "$db" "PRAGMA integrity_check;" 2>&1 || echo "integrity_check_command_failed")
  ok=$([ "$result" = "ok" ] && echo true || echo false)
  entry=$(jq -n --arg name "$name" --arg detail "$result" --argjson ok "$ok" \
    '{($name): {ok: $ok, detail: $detail}}')
  if [ $first -eq 1 ]; then
    echo "$entry" > "$REPORT"
    first=0
  else
    jq -s 'add' "$REPORT" <(echo "$entry") > "$REPORT.tmp" && mv "$REPORT.tmp" "$REPORT"
  fi
done

# If anything came back ok=false, fire the alert.
if jq -e 'to_entries[] | select(.value.ok == false)' "$REPORT" > /dev/null 2>&1; then
  curl -X POST "$ALERT_WEBHOOK_URL" -d "{\"text\":\"integrity-check failed: $(jq -c . "$REPORT")\"}" || true
  exit 1
fi
```

Requires `jq` (apt: `apt-get install -y jq`; already in the §18 bootstrap script). Run daily via cron. If anything comes back `ok: false`, an alert fires (see §13) and you know *which database* is corrupted before a user does.

### 12½.c. Automated weekly restore-test

The §12 backup script is correct, but a backup you've never restored is a guess, and a backup you tested *once* is a guess that the format hasn't drifted. Add a weekly cron that pulls the latest backup, restores it to a *throwaway* SQLite file, runs `PRAGMA integrity_check` AND a row-count sanity check against a canonical table, deletes the throwaway, and reports success/failure.

**v4 had a broken `rclone lsf --format "ts"` call** — `ts` is not a real rclone lsf field, and the `awk '{print $2}'` selected the time column instead of the filename. The corrected version uses `--format "tp"` (timestamp + path) and the correct column:

```bash
# /opt/erp-platform/restore-test.sh
#!/bin/bash
set -euo pipefail
BUCKET=r2:your-bucket/backups
WORK=/tmp/restore-test
rm -rf "$WORK" && mkdir -p "$WORK"

# rclone lsf --format "tp" outputs one line per file:
#   2026-08-29 03:00:00 backup-2026-08-29.tar.gz
# Three columns: date, time, path. The path is column 3.
LATEST=$(rclone lsf --format "tp" "$BUCKET" 2>/dev/null | sort -k1,2 | tail -1 | awk '{print $3}')
if [ -z "$LATEST" ]; then
  echo "RESTORE TEST FAILED: no backups found in $BUCKET" >&2
  curl -X POST "$ALERT_WEBHOOK_URL" -d "{\"text\":\"Restore test: no backups found in $BUCKET\"}" || true
  exit 2
fi

rclone copyto "$BUCKET/$LATEST" "$WORK/$LATEST"
mkdir -p "$WORK/sqlite"
for sql in "$WORK"/*.sql; do
  rm -f "$WORK/sqlite/test.sqlite"
  sqlite3 "$WORK/sqlite/test.sqlite" < "$sql"
  result=$(sqlite3 "$WORK/sqlite/test.sqlite" "PRAGMA integrity_check;")
  if [ "$result" != "ok" ]; then
    curl -X POST "$ALERT_WEBHOOK_URL" -d "{\"text\":\"Restore test FAILED: $sql — $result\"}" || true
    exit 1
  fi
done
rm -rf "$WORK"
echo "Restore test OK: $LATEST"
```

If you want a stronger check (catches the "backup is byte-identical but semantically wrong" failure mode), add a row-count comparison. Pick a canonical table per DB (e.g. `users` for `lms.sqlite`, `events` for `events.sqlite`) and store the expected count somewhere durable (R2, your password manager, or even a JSON file in `data/`):

```bash
# After a known-good backup, capture:
sqlite3 /opt/erp-platform/data/lms.sqlite "SELECT COUNT(*) FROM users" > /opt/erp-platform/data/.lms-users-count.txt

# In the restore test, after restoring:
restored=$(sqlite3 "$WORK/sqlite/test.sqlite" "SELECT COUNT(*) FROM users")
expected=$(cat /opt/erp-platform/data/.lms-users-count.txt)
[ "$restored" -ge "$expected" ] || { echo "Row count regressed: was $expected, restored $restored" >&2; exit 3; }
```

Wire this in to the same webhook the Sentry alerts use. If this ever fails, you'll know *before* a real disaster that your backup strategy is broken.

**⚠ Test the script manually first.** A restore-test that has never been observed to pass is no better than no restore-test. Run `bash /opt/erp-platform/restore-test.sh` once after the first backup cycle completes, confirm it exits 0, and check the webhook got a success notification.

### 12½.d. Back up the *configuration*, not just the data

The data dir is one half of what you need to recover. The other half is the live `docker-compose.yml`, `Caddyfile`, and the rclone config itself. **Do NOT back up `.env` to the same bucket that requires `.env` to read** — that's a circular dependency. The R2 API token is in `.env`; on a fresh VM the §18 script has no way to read the bucket that contains `.env`. v4 made this mistake; v5 splits it.

**Setup (one-time):**

1. Create a separate, minimal rclone config that only has read access to the `config/` R2 bucket. Store it at `/opt/erp-platform/infra/rclone.conf` (NOT in `/root/.config/rclone/` — make it explicit and version-controllable):
   ```ini
   # /opt/erp-platform/infra/rclone.conf
   [r2-config-reader]
   type = s3
   provider = Cloudflare
   access_key_id = <bootstrap-token-with-read-only-on-config-bucket>
   secret_access_key = <same>
   endpoint = https://<your-account-id>.r2.cloudflarestorage.com
   no_check_bucket = true
   ```
2. The bootstrap token above is the *only* R2 credential stored in your password manager (not in the bucket). It has read-only access to `r2:your-bucket/config/` and nothing else.
3. Nightly, tarball the live config (excluding `.env`):
   ```bash
   # /opt/erp-platform/config-backup.sh
   #!/bin/bash
   set -euo pipefail
   TS=$(date +%F)
   WORK=/opt/erp-platform/data/.config-staging
   mkdir -p "$WORK"
   tar -czf "$WORK/config-$TS.tar.gz" \
     -C /opt/erp-platform \
     docker-compose.yml Caddyfile infra/rclone.conf
   rclone --config /opt/erp-platform/infra/rclone.conf copy \
     "$WORK/config-$TS.tar.gz" r2:your-bucket/config/ \
     --max-age 7d   # keep only the last 7 days of config snapshots
   rm -rf "$WORK"
   ```

**Why `--max-age 7d`:** the v4 plan tar'd `frontend-dist/` into the same bucket, which grew ~50MB/day and exhausted the R2 free 10GB in 7 months. By excluding `frontend-dist` from the config backup (it's in git + rebuilt on every deploy) and filtering old config snapshots to 7 days, R2 usage stays flat at <100MB forever.

**`.env` recovery:** re-enter the secrets from your password manager when you need to restore. This is the only correct answer — putting the secret in a place that requires the secret to read is not a backup.

### 12½.e. Snapshot the boot volume to R2 weekly

Beyond the data dir, snapshot the *entire VM boot volume* weekly. Oracle makes this a one-liner via the CLI. Upload the image to R2 via `rclone rcat`. This is the recovery artifact of last resort — if the VM is gone and you need to stand up an identical VM in a different region, this is what you restore from.

```bash
# /opt/erp-platform/vm-snapshot.sh (runs on the VM host, not in a container)
#!/bin/bash
TS=$(date +%F)
oci compute instance list --compartment-id "$COMPARTMENT_OCID" --query 'data[0].id' --raw-output > /tmp/instance-id
# Custom image creation step — agent fills in exact CLI for the OCI SDK
# Then: rclone rcat /tmp/snapshot-$TS.img r2:your-bucket/vm-snapshots/snapshot-$TS.img
```

This is a "set up once, run on cron, never think about it" job. Recovery from a total VM loss becomes "create a new VM from this image, restore data from R2, update DNS, done in 60 minutes" — see §18.

---

## 13. Monitoring (Lightweight, Free, Real)

The v3 doc's monitoring was "UptimeRobot + Oracle console." That tells you when the *server* is up. It does not tell you when the *app* is broken (500s, slow responses, captcha failures, login dead). A production-grade $0 monitoring stack is four layers. All $0. All agent-installable in a few hours.

### 13.a. Synthetic uptime (UptimeRobot, free)

Already in the v3 plan. Keep it. Ping `https://app.yourdomain.com/api/live` every 5 minutes. Alert by email/SMS on failure. This is the "is the server reachable at all" check.

### 13.b. Real-user error capture (Sentry, free tier)

Sentry's free Developer tier gives 5,000 errors/month and 10,000 events/month. More than enough for an app of this size. Two integration points:

**Backend** — add the Sentry Node SDK to `Backend/src/app.js`. ~20 lines of code: install, init, attach as error middleware. Capture every unhandled error with stack trace, request context, and the `erp_session` cookie ID (hashed, not the value). Free, 30 minutes of agent work.

**Frontend** — add `@sentry/react` to the Vite build. ~15 lines in `main.tsx`. Captures unhandled React errors, slow component renders, and PWA service worker errors. Free, 20 minutes of agent work.

What this gives you: when a student reports "the dashboard is broken," you look at Sentry, see the exact stack trace and the 50 other students who hit it in the last hour, and fix it. Without Sentry, you're SSHing in and grepping `backend.log` blind.

### 13.c. Status page (Betterstack or Hyperping, free)

Students will assume the app is down when the SRM AP ERP is down (because the captcha login is part of your UX). A status page makes that visible:

- **Betterstack** free tier: 1 status page, 10 monitors, public status. Set up three monitors:
  - `app.yourdomain.com/api/live` (your app's liveness)
  - `app.yourdomain.com/api/career/health` (the backend's career subsystem health — that's the closest existing route to an "ERP reachability" endpoint; v4's `/api/erp/health` does not exist, that was wrong)
  - `https://student.srmap.edu.in/srmapstudentcorner/` (the SRM AP ERP itself, HEAD request)
- Status page URL: `status.yourdomain.com` (Cloudflare DNS, $0). Shows real-time uptime for the last 90 days, incident history, scheduled maintenance.
- Embed a link in your app's footer so students can check before opening a ticket.

This is the single biggest "feels professional" addition you can make. Students have seen status pages on every other service they use; not having one signals "this is a class project."

### 13.d. Log aggregation (Grafana Cloud free tier)

Grafana Cloud's free tier includes 10 GB of logs/month and 50 GB of traces/month. More than enough for an app of this size. The backend already writes structured JSON logs to `/app/data/logs/`. Wire `promtail` to ship them:

- Run `promtail` as a Docker service in the same compose file (one container, ~50MB RAM, $0).
- Configure it to tail `/app/data/logs/*.log` and ship to a free Grafana Cloud Loki endpoint.
- Build a Grafana dashboard for: error rate by route, p95 latency by route, captcha failure rate, ERP fetch failure rate, disk usage.

This is what you look at when Sentry says "500 errors spiked at 2am." Without log aggregation, you're SSHing in and `tail -f`-ing. With it, you search Loki for the time window and see exactly what happened.

### 13.e. Metric scrapes (still via /api/metrics, scraped by Grafana Cloud Prometheus)

The backend already exposes Prometheus metrics at `/api/metrics` (currently blocked externally by the Caddyfile — see §8). For local scraping, expose the port to a sidecar prometheus in the compose file; for remote, configure a Grafana Cloud Prometheus scrape against a `https://app.yourdomain.com/api/metrics` URL with the Caddyfile temporarily allowing `/api/metrics` from your scraper's IP. (Or, more cleanly: have promtail's metrics exporter handle the local scrape, and skip remote metrics entirely.)

This is the lowest-priority layer. The first three (uptime, error capture, status page) give you 90% of the value. Logs and metrics are the next 9%. Don't build all five on day one; build them in order.

### 13.f. The full stack in one compose service

Add to your `docker-compose.yml` (a one-line entry per service, all free):

```yaml
  promtail:
    image: grafana/promtail:3.5.3
    restart: unless-stopped
    volumes:
      - ./data/logs:/app/data/logs:ro
    environment:
      - LOKI_URL=https://logs-prod-<region>-<stack-id>.grafana.net   # from your Grafana Cloud portal; do NOT copy the doc's example
      - LOKI_USERNAME=<your-grafana-cloud-instance-id>
      - LOKI_PASSWORD=<api-key-not-user-password>
    command: -config.file=/etc/promtail/config.yml
```

The `LOKI_URL` value is a placeholder — every Grafana Cloud account has a unique `<region>-<stack-id>` in the URL. Find it in the Grafana Cloud portal under Loki → "Connect" — it shows the full `https://logs-prod-...grafana.net/loki/api/v1/push` URL. A user copy-pasting `eu-west-0` from this doc will get a DNS error.

Config file ships with the repo, all values from env. Total cost: $0. Total maintenance: 0 (Grafana manages the backend).

### 13.h. Cert expiry monitor (the missing one)

Caddy auto-renews certs, but if the renewal silently fails (Cloudflare API token rotation, DNS provider outage, rate limit), the cert keeps working until ~7 days before expiry. By then it's an emergency. Add a daily cron that checks the cert and alerts if it expires in <14 days:

```bash
# /opt/erp-platform/cert-expiry-check.sh
#!/bin/bash
HOST=app.yourdomain.com
EXPIRY=$(echo | openssl s_client -servername "$HOST" -connect "$HOST":443 2>/dev/null | openssl x509 -noout -enddate 2>/dev/null | cut -d= -f2)
if [ -z "$EXPIRY" ]; then
  curl -X POST "$ALERT_WEBHOOK_URL" -d "{\"text\":\"cert-expiry-check: could not read cert from $HOST\"}" || true
  exit 1
fi
EXPIRY_EPOCH=$(date -d "$EXPIRY" +%s 2>/dev/null || echo 0)
NOW_EPOCH=$(date +%s)
DAYS_LEFT=$(( (EXPIRY_EPOCH - NOW_EPOCH) / 86400 ))
if [ "$DAYS_LEFT" -lt 14 ]; then
  curl -X POST "$ALERT_WEBHOOK_URL" -d "{\"text\":\"cert-expiry-check: $HOST cert expires in $DAYS_LEFT days ($EXPIRY)\"}" || true
  exit 1
fi
```

### 13.g. What to skip

The v3 plan was right to skip the local Prometheus + Grafana + Loki + Promtail + Alertmanager + node-exporter + cAdvisor stack — 7 extra containers with hardcoded paths you don't need. The difference is **Grafana Cloud gives you the same observability without the 7 containers**. Use that, not self-host.

---

## 14. CI/CD: Push-to-Main Deploys via GitHub Actions Self-Hosted Runner

The v3 doc had "ssh in, git pull, docker compose build" as the deploy workflow. That works for one developer with one environment. It does not scale to "I want to push code and have it land in production without me thinking about it." The "best" $0 solution: a GitHub Actions self-hosted runner on the VM, free unlimited minutes, every push to `main` builds → tests → deploys.

### 14.a. Install the runner (one-time, 10 minutes)

```bash
# On the VM, as a non-root user (NOT root — the runner refuses to start as root by default)
mkdir /opt/actions-runner && cd /opt/actions-runner
# v4 pinned to v2.319.1 (May 2024); use the /latest/ redirect to always get a current
# supported release. The redirect URL works as a stable pin until a version deprecation notice.
curl -o actions-runner-linux-arm64.tar.gz -L \
  https://github.com/actions/runner/releases/latest/download/actions-runner-linux-arm64-2.tar.gz
tar xzf ./actions-runner-linux-arm64.tar.gz
./config.sh --url https://github.com/your-org/university-erp --token <RUNNER_TOKEN>
sudo ./svc.sh install
sudo ./svc.sh start
```

**Runner must run as a non-root user that has `docker` group membership** (so the deploy steps can run `docker compose` without `sudo`). Add the runner user to the docker group before the `svc.sh start`:

```bash
sudo usermod -aG docker runner   # or whatever user you chose
```

The token is on the GitHub repo's Settings → Actions → Runners → "New self-hosted runner" page. The runner registers as `oracle-free-arm` and shows up in the GitHub UI as online.

Once the runner is running, every workflow that has `runs-on: self-hosted` will execute on this VM. Free, unlimited, no GitHub-billed minutes.

### 14.b. The deploy workflow

Add to `.github/workflows/deploy.yml`:

```yaml
name: deploy

on:
  push:
    branches: [main]
  workflow_dispatch:    # manual trigger from the GitHub UI

jobs:
  deploy:
    runs-on: self-hosted
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v4

      - name: Build frontend
        working-directory: Frontend
        run: |
          npm ci
          npm run build
          # Build to a versioned dir, then atomic-swap. Avoids the 1-2s
          # window where the browser can hit half-replaced dist/ files.
          rsync -a --delete dist/ /opt/erp-platform/frontend-dist.v2/
          rm -rf /opt/erp-platform/frontend-dist.v1
          mv /opt/erp-platform/frontend-dist /opt/erp-platform/frontend-dist.v1
          mv /opt/erp-platform/frontend-dist.v2 /opt/erp-platform/frontend-dist
          rm -rf /opt/erp-platform/frontend-dist.v1

      - name: Build & restart backend
        working-directory: Backend
        run: |
          cd /opt/erp-platform
          docker compose build backend
          docker compose up -d --no-deps backend
          # v4 used `caddy reload`; that's brittle to Caddy admin API
          # changes. `restart caddy` is 5 seconds of HTTPS-down but reliable.
          docker compose restart caddy

      - name: Post-deploy smoke
        run: bash /opt/erp-platform/infra/scripts/postdeploy-smoke.sh
        env:
          APP_URL: https://app.yourdomain.com

      - name: Prune old images
        # Free-tier VMs accumulate intermediate images. Keep the last 3 days.
        run: docker image prune -f --filter "until=72h"
```

This is the entire deploy. Push to `main`, the runner picks it up, builds, deploys, runs the post-deploy smoke test, prunes old images. If the smoke test fails, the workflow fails, and you get a GitHub notification. You never SSH in for routine deploys.

### 14.c. The smoke test (the deploy's safety net)

The repo already has `infra/scripts/postdeploy-smoke.sh` (104 lines). It checks `/api/health`, `/api/live`, `/api/ready`, and grep-verifies that the static build is actually a production build. Wire it as the last step of the deploy workflow (as above) and as a *separate* cron workflow that runs every 5 minutes — so even an external incident (e.g., the SRM AP ERP goes down) is detected and reported via UptimeRobot / Betterstack.

### 14.d. The atomic frontend swap

§14's v3 honesty about the rsync window still applies. With CI/CD doing the deploy, the window is now: GitHub checkout → `npm run build` → `rsync --delete` → `caddy reload`. The 1-2 second window where the directory is half-replaced is still there, but with a CI deploy it's *deterministic* and *logged*, not "wherever the developer happened to be when they ran the command." For an app at this scale, the simpler `rsync` is fine. If you need strict atomicity, use the versioned-dir trick from v3: `dist/ → dist.v2/`, then `mv` swap, then `caddy reload`. ~5 more lines in the workflow.

### 14.e. The deploy + the standby VM

The CI/CD story extends to the §1B standby VM for free: a *second* self-hosted runner on the standby VM, picking up the same `deploy.yml` workflow with a slightly different `post-deploy` step (no smoke test against the live app, since it's not serving traffic — just a "did the containers come up healthy" check). The primary and standby always run the same code; the only difference is DNS.

### 14.f. The escape hatch when the runner is broken

If the runner itself gets into a bad state (disk full, corrupt checkout, lost token), the deploy workflow fails silently. To avoid this: run the runner under `systemd` (the `svc.sh install` does this) so it auto-restarts, and add a "is the runner alive" cron:

```bash
# /opt/erp-platform/runner-health.sh (daily)
curl -s -o /dev/null -w "%{http_code}" https://api.github.com/repos/your-org/university-erp/actions/runner-registrations | grep -q 200 || \
  curl -X POST "$ALERT_WEBHOOK_URL" -d '{"text":"Self-hosted runner is unreachable"}'
```

If the runner is dead and you need to push code *right now*, fall back to manual SSH deploy. The runner being down doesn't block you; it just means you're doing the deploy by hand for a day.

---

## 15. Pre-Launch Security & Sanity Checklist

- [ ] All default passwords rotated (`REDIS_PASSWORD`, `ADMIN_CONTENT_PASSWORD`, any admin register-number lists)
- [ ] `SESSION_COOKIE_SECURE=true`, `SESSION_COOKIE_SAME_SITE=lax`
- [ ] SSH is key-only, `ufw` active and is the *only* firewall tool in use on the box
- [ ] `.env` is in `.gitignore` and was never committed
- [ ] Every `*_DB_PATH` (and any undocumented ones — see §9) confirmed to resolve inside `/app/data`, verified with `docker compose exec backend ls -la /app/data` after real usage
- [ ] `/app/data` ownership matches the user the backend process runs as
- [ ] Restore-from-backup tested at least once, using `sqlite3 .restore`
- [ ] §11a: Playwright/Chromium launches successfully on ARM64
- [ ] §11b: a real login against the live ERP succeeds from the production VM's IP
- [ ] `LEGACY_SESSION_ID_CUTOFF_DATE` (2026-05-15) is already in the past — no action needed here, just don't be alarmed if you see it while reading the config. **Do mention in the launch announcement that anyone with an old session will be silently signed out and need to log in again once** — this is the intended behavior, but expecting it makes the rollout feel less broken to users.
- [ ] `/api/metrics`, `/api/health` confirmed blocked externally (`curl -I https://yourhost/api/health` should return 404)

---

## 15½. Compliance & Abuse Handling

A university student platform gets attacked. The attackers are credential stuffers, captcha harvesters, scrapers, and the occasional bored student who thinks it's funny to brute-force a friend's password. None of this is hypothetical — it's the *first week* of any public-facing student platform. The "best" $0 deploy has a plan for all four, even if the plan is "log it and check the Sentry dashboard daily."

### 15½.a. The IP blocklist (operational primitive, not a service)

The backend has Redis-backed rate limiting (good), but no operator-facing way to add a permanent block against a specific IP or range. **v4's "wire a check at the top of `app.js`" was wrong on three counts:** (1) `req.ip` is the Docker bridge IP behind Caddy, not the real client IP — every block would target `172.x.x.x` and block all users; (2) without `app.set('trust proxy', 1)`, the real IP is unreachable via `req.ip`; (3) the existing rate limiter already does the same job per-IP. The correct integration:

1. **First, set the trust-proxy story correctly in `createApp`** (`Backend/src/app.js`):
   ```javascript
   function createApp() {
     const app = express();
     // CRITICAL: Caddy is in front. Without this, req.ip is the Docker bridge IP
     // (172.x.x.x), which would make every IP block in §15½.a block all traffic.
     // With trust proxy = 1, req.ip respects the X-Forwarded-For from Caddy.
     app.set('trust proxy', 1);
     // ...rest of the existing setup
   }
   ```

2. **Reuse the existing `extractIp` helper from `rateLimit.js`** (it already handles `X-Forwarded-For` and falls back to `req.ip` consistently with the rate limiter). Refactor it into `Backend/src/utils/clientIp.js` if you want it shared.

3. **Add the blocklist check inside the existing rate limiter**, not as a new top-level middleware:
   ```javascript
   // In rateLimit.js — add this at the top of the per-IP handler
   const blocked = await redisClient.get(`blocked:${clientIp}`);
   if (blocked) {
     return res.status(403).json({ error: 'Forbidden' });
   }
   ```
   This way the blocklist is consulted *before* the rate-limit counter increments, blocks are immediate, and there's no second Redis call on every request.

4. **Add the admin route:**
   ```javascript
   // Backend/src/routes/adminAbuseRoutes.js
   const express = require('express');
   const router = express.Router();
   const { getRedisClient } = require('../services/core/sessionServices');
   const { requireAdmin } = require('../middleware/adminContext');

   router.post('/block-ip', requireAdmin, async (req, res) => {
     const redis = getRedisClient();
     if (!redis) return res.status(503).json({ error: 'Redis required for blocklist' });
     const { ip, reason, ttl } = req.body;
     await redis.set(`blocked:${ip}`, reason || '', 'EX', ttl || 86400 * 30);
     res.json({ ok: true });
   });

   router.delete('/block-ip/:ip', requireAdmin, async (req, res) => {
     const redis = getRedisClient();
     if (!redis) return res.status(503).json({ error: 'Redis required' });
     await redis.del(`blocked:${req.params.ip}`);
     res.json({ ok: true });
   });

   router.get('/blocks', requireAdmin, async (req, res) => {
     const redis = getRedisClient();
     if (!redis) return res.status(503).json({ error: 'Redis required' });
     const keys = await redis.keys('blocked:*');
     const blocks = await Promise.all(
       keys.map(async (k) => ({ ip: k.replace(/^blocked:/, ''), reason: await redis.get(k) }))
     );
     res.json({ blocks });
   });
   ```

If you took the §1B/§7-bis "drop Redis" path, the blocklist goes away with it — there is no in-memory equivalent that's distributed. You can keep a *local* blocklist (a JSON file in `/app/data/`) and check it in the same rate limiter hook; the trade-off is that it's per-VM.

Total cost: ~50 lines of code, 1-2 hours of agent work.

### 15½.b. The incident response playbook

When a student reports credential stuffing at 2am, here's the sequence (in order, all 5 minutes max):

1. **Check Sentry** for the IP's error pattern. If it's captcha failures, the IP is on the blocklist candidate.
2. **Check Betterstack status page** to see if the SRM AP ERP is down. If yes, the report is "ERP is down" not "we got hacked."
3. **Check `adminAbuseRoutes` for similar IP patterns.** If you see a /16 block of residential proxies, the platform is under attack.
4. **Block the IP** via the admin route (`POST /api/admin/block-ip`). The block takes effect immediately — no restart needed, the blocklist lives in Redis and the rate limiter checks it on every request.
5. **Email** `security@yourdomain.com` (which forwards to you) with a one-line summary. The "we have a published security contact" signal is part of the compliance story.

Document this in a one-page runbook at `infra/runbooks/incident-response.md`. The agent can write it in 30 minutes. Print it. Put it where you'll find it at 2am.

### 15½.c. Data export & deletion (GDPR-adjacent, even for non-EU users)

A student requests "all my data" or "delete my account." The right answer is a one-liner, not a panic. Add two routes (or document the manual procedure if the codebase doesn't have user accounts in the traditional sense — in which case the "data" is whatever's in the SQLite DB keyed by register number):

```javascript
// Backend/src/routes/adminUserDataRoutes.js (agent creates this)
router.get("/user/:registerNo/export", requireAdmin, async (req, res) => {
  // For each *.sqlite in env, query WHERE register_no = ?
  // Bundle into a tarball, return as attachment
  // Also include any /uploads/* and /lms/* files keyed by register_no
});

router.delete("/user/:registerNo", requireAdmin, async (req, res) => {
  // For each *.sqlite, DELETE WHERE register_no = ?
  // Don't actually delete uploaded files (orphaned) but log them for cleanup
});
```

For a real university, the legal requirement is "respond within 30 days." For a free platform, the requirement is "have a documented procedure." Both are easy.

### 15½.d. Coordinated disclosure (the security@ email)

Publish `security@yourdomain.com` in:
- The app's `/security` page (linked from the footer)
- A `SECURITY.md` at the repo root (GitHub surfaces this in the Security tab)
- The Caddyfile's `Strict-Transport-Security` header comment (a habit, not a requirement)

A `SECURITY.md` is a 10-line file:

```markdown
# Security

If you've found a vulnerability, please email security@yourdomain.com
with a description and reproduction steps. We respond within 72 hours.

We follow responsible disclosure: please give us 90 days to fix before
publicly disclosing.
```

This is the difference between "we're a real platform that takes security seriously" and "we're a class project." Free. 10 minutes.

### 15½.e. What this section is not

It is not a SOC 2 audit, a penetration test, a bug bounty, or a compliance certification. It is four small things that take one afternoon of agent work and convert "we got hacked" from a 3-day scramble into a 30-minute response. If you ever grow past 5,000 concurrent users or start handling real money (fee payment, etc.), revisit and add the heavy stuff. Until then, this is the right size.

---

## 16. What NOT to Do

| Don't | Why |
|---|---|
| Deploy the repo's existing root `docker-compose.yml` as-is | Binds to `127.0.0.1`, assumes a co-located Traefik/certbot stack that doesn't exist here, **and uses a `wget --spider` healthcheck that fails silently because `wget` is not installed in the `node:22-bookworm-slim` base image** — the container never reaches `service_healthy`, Caddy never starts, and you spend an hour figuring out why |
| Use `infra/docker/compose.ingress.yml` | Marked deprecated, passwordless Redis, broken TLS path |
| Put the `data/` directory on NFS/network storage | SQLite + WAL on network filesystems is the #1 cause of silent corruption |
| `tar` a live SQLite database directly | Produces a torn, inconsistent backup — use `sqlite3 .backup` per file (§12) |
| Run multiple backend replicas against the same SQLite files | No cross-host locking — you'll get `SQLITE_BUSY` and stale reads |
| Enable the Python career scraper yet | `CAREER_SCRAPER_ENABLED=1` pulls from LinkedIn/Indeed via JobSpy, which flags datacenter IPs — leave it `0` until tested separately on a residential-IP host |
| Stand up the full monitoring stack on day one | Unnecessary complexity before you have real usage patterns to monitor |
| Manage the instance firewall with both `ufw` and raw `iptables` edits | They can silently override each other; pick `ufw` only |
| Expose your Oracle tenancy name/OCID anywhere public-facing | Not a critical flaw, but no reason to advertise internal infra identifiers |

---

## 17. When to Revisit This Plan — and the Real Migration Target

The v3 doc ended with "revisit at 5,000 concurrent users, migrate SQLite → Postgres." That's directionally right but operationally thin. Here is what "revisit" actually means, in order.

### 17.a. Triggers that say "revisit now"

| Signal | Threshold | Action |
|---|---|---|
| P95 dashboard latency | > 2 seconds sustained for a week | Profile, find the slow route. Often a single missing index on a hot query. Don't migrate the DB to fix a missing index. |
| Captcha login success rate | < 90% on a normal day | §11c residential proxy. Don't migrate. |
| Backend memory pressure | > 80% sustained | Tune, then add Redis drop, then revisit. |
| Concurrent users | > 1,000 sustained peak | Start the SQLite → Postgres migration plan (§17.c). |
| Disk usage | > 70% of 200GB | Enable `auto_vacuum` (it's in §12½.d). If still growing, add the §1B standby and split reads. |
| Oracle announces another free-tier cut | (anytime) | Execute the §1B failover plan, no migration needed. |

### 17.b. Triggers that say "you've outgrown the single-VM SQLite stack"

- Sustained > 2,000 concurrent users
- You need real-time multi-region (e.g., students in two time zones with conflicting exam-result traffic)
- You start handling real money (fee payment, refunds, anything with a money trail that needs ACID across multiple rows in different stores)
- The career portal becomes a product, not a side feature, and you need to do joins across stores that SQLite can't

### 17.c. The actual migration plan (SQLite → Postgres)

The "best" $0 migration target is **not a managed Postgres service**. It's **self-hosted Postgres on a second free-tier VM** (e.g., the GCP `e2-micro` from §1B, or a separate Oracle ARM instance if Oracle gives you a 2nd one). Why:

- **Supabase free tier** is 500MB, with PITR only on the $25/mo plan. Will run out of space in 6 months.
- **Neon free tier** scales to zero. Kills your sessions when it's cold.
- **RDS free tier** is 12 months. Then it bills.
- **Self-hosted Postgres on a free VM** is $0 forever, full PITR with `pg_basebackup`, full control. Same operational story you already know.

**The migration architecture:**

```
        ┌──────────────┐
        │   Backend    │
        │ (Oracle VM)  │
        └──────┬───────┘
               │ uses
               ▼
        ┌──────────────┐         ┌──────────────┐
        │   Postgres   │ ◀───────│  read replica│
        │   (GCP VM)   │  async  │   (GCP VM)   │
        │  primary     │  repl   │              │
        └──────────────┘         └──────────────┘
```

**Step-by-step (when you actually need it):**

1. Provision a GCP `e2-micro` (1GB RAM, 30GB disk — you'll need a bigger disk, ~$1/mo for 50GB) running Postgres 16.
2. The backend already abstracts data access per store. Wrap each `*Store` class in a `DbDriver` interface. Add a `DB_DRIVER=postgres` env flag.
3. The first cut: keep SQLite as the source of truth for *writes*, replicate to Postgres async. Read from Postgres. This is the strangler-fig pattern.
4. After a week of dual-write: flip writes to Postgres, keep SQLite as the read fallback. Then remove the SQLite code paths one store at a time.
5. Add `pg_basebackup` to the §12 backup flow — replaces the per-DB `sqlite3 .backup` with a single PITR-capable Postgres backup.
6. The 2nd GCP `e2-micro` is the standby VM from §1B, repurposed as the Postgres read replica. No new VM, no new cost.

**What this costs:**

- One $1/mo bigger disk on the Postgres VM. That's it. The free tier's 200GB block storage on Oracle is plenty for the backend; the GCP e2-micro gets a 30GB paid persistent disk to run Postgres.
- Agent work to refactor the store layer behind a `DbDriver` interface: ~80-120 hours. Bounded, well-defined, and pays for itself the first time you need a JOIN across stores.

**What this does NOT solve:**

- The Oracle IP reputation problem with the ERP. That lives at the §11c layer, not the database layer.
- Horizontal write scaling. If you need 10k writes/sec, you need sharding, which is a real architecture project. You're at 1k peak; you won't hit this for 3+ years.

### 17.d. The non-infrastructure triggers (just as important)

- **Multi-university expansion.** Different schools have different ERP endpoints, different auth systems, different captcha flows. The data-modeling problem (per-school credentials, per-school sessions) is real and exists *before* the infrastructure problem. Don't try to design for it on day one; design for "easy to add a 2nd school" by isolating the per-school config in a single `schools.json` and reading it in `env.js`.
- **The career portal becomes a product.** If you start selling access to it (or just want to onboard employers), the "scrape + display" model breaks and you need employer accounts, a real DB with joins, and a proper admin UI. That's a product decision, not an infra one.
- **You start handling money.** Fee payment, refunds, anything financial. The current SQLite + best-effort-write architecture is not ACID-safe across multiple stores. Migrate before you ship this feature, not after.

### 17.e. The actual size envelope of "this stack is fine"

- Up to 1,000 sustained concurrent users: definitely fine on the §1 single-VM setup.
- 1,000-5,000: same single-VM, with the §1B standby in place. Consider the SQLite hardening in §12½ to be mandatory at this point.
- 5,000-20,000: the §17.c Postgres migration. Two VMs, one primary one replica, DNS failover.
- 20,000+: you've outgrown $0. Time to pay for real infrastructure, or talk to the university about funding a proper deployment. This doc stops being relevant at this scale — the right answer is a paid cloud with a managed Postgres, a CDN, and a real APM.

### 17.f. What "best" means for the day you outgrow

Don't pre-build capacity you don't need. But do build the §1B standby, the §12½ hardening, and the §14 CI/CD *now*, because those are the things that make the next migration cheap instead of terrifying. A stack with cross-cloud failover + CI/CD + integrity checks is a stack you can confidently migrate off of when the time comes. A stack with manual SSH deploys + a single VM + a backup you've never tested is one where a migration becomes a 2-week project instead of a 2-day one.

---

## 18. Bootstrap from Scratch on a New Cloud in 60 Minutes (Disaster Recovery Playbook)

This section is the one you write *before* you need it. The scenario: the Oracle VM is gone. The data is in R2. You need to be back up in an hour. Here's the script.

### 18.a. Pre-requisites (do these *now*, before the disaster)

These four artifacts must exist off-VM, in your possession, not in the repo:

1. **`infra/rclone.conf`** — a separate rclone config with a *bootstrap* R2 token that has read-only access to the `config/` bucket (see §12½.d). Stored in your password manager, **not** in the bucket (to break the circular dep that v4 had).
2. **Latest `docker-compose.yml`, `Caddyfile`, and `infra/rclone.conf`** — nightly backup to R2's `config/` bucket (§12½.d). Note: `.env` is NOT in this backup; you re-enter the env values from your password manager.
3. **Latest SQLite `data/` snapshot** — nightly backup to R2's `backups/` bucket (§12).
4. **Latest VM boot-volume image** — weekly snapshot to R2's `vm-snapshots/` bucket (§12½.e).
5. **The `bootstrap.sh` script** — saved in the repo and copied to R2. The script is below.

### 18.b. The 60-minute script

**v4 had two bugs that would silently break the bootstrap:** (a) the `rclone lsf --format "ts"` syntax was wrong, returning `03:00:00` instead of the filename; (b) the script tried to `rclone copy` a config that didn't exist on a fresh VM. Both are fixed below.

```bash
#!/bin/bash
# /opt/erp-platform/bootstrap.sh
# Run this on a fresh Ubuntu 24.04 ARM64 VM in any cloud.
# PREREQ: you have run `rclone config` on this VM to set up an `r2:` remote,
# or you have placed infra/rclone.conf in /opt/erp-platform/infra/ and
# pass it via --config. The bootstrap R2 token is in your password manager.
# Estimated time: 50-60 minutes including data restore.

set -euo pipefail

echo "=== 1. Base setup (5 min) ==="
apt-get update && apt-get install -y curl git ufw sqlite3 rclone jq
curl -fsSL https://get.docker.com | sh
ufw allow 22/tcp && ufw allow 80/tcp && ufw allow 443/tcp && ufw --force enable

echo "=== 2. Get the code (2 min) ==="
mkdir -p /opt/erp-platform && cd /opt/erp-platform
git clone https://github.com/your-org/university-erp.git repo
mkdir -p frontend-dist data

echo "=== 3. Restore configuration (1 min) ==="
# Pull only docker-compose.yml, Caddyfile, and rclone.conf. NOT .env (it's in your password manager).
# v4 included .env in the config bucket, but .env contains the R2 token, which
# is a circular dep on a fresh VM. The config bucket itself is readable via
# the bootstrap token in your password manager, applied via `rclone config` here.
rclone copy r2:your-bucket/config/ /opt/erp-platform/ \
  --include "docker-compose.yml" --include "Caddyfile" --include "infra/rclone.conf"

# Manually edit .env from your password manager secrets:
# REDIS_PASSWORD, ADMIN_CONTENT_PASSWORD, CF_API_TOKEN, etc.
# See §9 for the full template. chmod 600 it when done.
touch /opt/erp-platform/.env
chmod 600 /opt/erp-platform/.env
echo ">>> EDIT /opt/erp-platform/.env NOW with your password manager values, then re-run this script. <<<"
# (In a real bootstrap, you'd uncomment and edit the env here. For an automated
# agent run, the env values are passed via GitHub Actions secrets or a
# pre-baked secret manager.)

echo "=== 4. Restore data (15-30 min depending on size) ==="
# rclone lsf --format "tp" returns: "2026-08-29 03:00:00 backup-2026-08-29.tar.gz"
# Three columns: date, time, path. Filename is column 3.
LATEST=$(rclone lsf --format "tp" r2:your-bucket/backups/ 2>/dev/null | sort -k1,2 | tail -1 | awk '{print $3}')
if [ -z "$LATEST" ]; then
  echo "FATAL: no backups found in r2:your-bucket/backups/" >&2
  exit 2
fi
rclone copyto "r2:your-bucket/backups/$LATEST" /tmp/restore/latest.tar.gz
cd /tmp/restore && tar -xzf latest.tar.gz
cp -a /tmp/restore/. /opt/erp-platform/data/ 2>/dev/null || true
chown -R 1000:1000 /opt/erp-platform/data

echo "=== 5. Init SQLite PRAGMAs (1 min) ==="
bash /opt/erp-platform/init-pragmas.sh

echo "=== 6. Build the frontend (3 min) ==="
cd /opt/erp-platform/repo/Frontend
npm ci && npm run build
rsync -a --delete dist/ /opt/erp-platform/frontend-dist/

echo "=== 7. Start the stack (2-10 min depending on whether image is cached) ==="
cd /opt/erp-platform
docker compose build backend
docker compose up -d

echo "=== 8. Verify (5 min) ==="
sleep 60
curl -s http://localhost:5000/api/live
bash /opt/erp-platform/infra/scripts/postdeploy-smoke.sh

echo "=== 9. Update DNS (1 min) ==="
echo "Manually update Cloudflare A record to point to this VM's public IP"
echo "Caddy will re-issue the cert via DNS-01 (30-60s HTTPS-down during re-issue)"

echo "=== DONE. Total time: ~50-60 minutes ==="
```

### 18.c. The 10-minute manual fallback

If the script fails or R2 is also unavailable, the manual sequence:

1. SSH into a new VM in any cloud (Hetzner, DO, AWS free tier, even Oracle's `e2.1.micro` x86 — anything).
2. Follow §3-§10 of this guide in order. With a clean §9 `.env` (re-enter secrets from your password manager).
3. For data: if R2 is unreachable, you have whatever the most recent off-R2 backup is. If you have nothing, the students get a fresh install. This is what makes §12½.d (config backup) and §12½.e (VM snapshot) important — they're the second and third lines of defense.

### 18.d. The thing the script doesn't solve

- **The ERP captcha login may fail** if the new VM's IP is even worse reputation than the old one. §11c covers the residential-proxy fallback.
- **Old sessions are dead.** The Redis container starts empty; all live sessions are invalidated. The first wave of "I got logged out" support tickets after a disaster is real. Plan for it.
- **DNS propagation.** If the new VM is in a different region from Cloudflare's anycast, propagation is fast (Cloudflare caches). If the new cloud is in a different country, give it 5 minutes.

### 18.e. Test it once a quarter

The worst time to discover that `bootstrap.sh` doesn't work is when you need it. Add a quarterly cron that runs the script on a *throwaway* VM, then tears it down. If the smoke test fails at the end, you'll know before the disaster.

---

## 19. Agent Work List (Hand This to a Coding Agent)

This whole doc is human-readable. The list below is the machine-readable version. Each item is a discrete, bounded task that a coding agent can pick up, work on, and ship. Time estimates are for a competent agent with access to the repo and this doc; wall-clock time depends on the agent's setup.

### Phase 1: Day-one correctness (do these in order, 6-8 hours total)

- [ ] **T1.1** — Rotate every secret in the live `.env` using the `openssl rand` one-liners in §9.
- [ ] **T1.2** — Set all 14 `*_DB_PATH` env vars to `/app/data/*.sqlite` (§9), plus `LOG_DIR`, `LOGIN_DIAGNOSTICS_DIR`, `EVENTS_DATA_DIR`, `UPLOADS_DIR`, `LMS_FILES_DIR` (§9 WARNING).
- [ ] **T1.3** — Add `CAREER_SCRAPER_ENABLED=0` to the §7 compose `environment:` block (CRITICAL — supervisor tries to start on every boot otherwise).
- [ ] **T1.4** — Set `FRONTEND_BLUEPRINT_FILE=` (empty) in `.env` to disable integrity reporting that would 503 `/api/ready` (CRITICAL — see §9 / §13.c).
- [ ] **T1.5** — Add `USER node` step to `Backend/Dockerfile` to fix the root-owns-data problem.
- [ ] **T1.6** — Save the §8 Caddyfile to `/opt/erp-platform/Caddyfile` BEFORE first `docker compose up` (CRITICAL — missing file → Caddy serves its default static config silently).
- [ ] **T1.7** — Add `app.set('trust proxy', 1)` to `createApp` in `app.js` (CRITICAL — without this, every IP block in §15½.a blocks the Docker bridge IP and DoSes all users).
- [ ] **T1.8** — Replace `tar` with `sqlite3 .backup` per database in the backup script (§12).
- [ ] **T1.9** — Verify `/api/metrics`, `/api/health`, `/api/telemetry` are blocked externally.
- [ ] **T1.10** — Run `timedatectl show` and confirm NTP is synchronized (§3).
- [ ] **T1.11** — Run the §11a Playwright launch test.
- [ ] **T1.12** — Run the §11b real-login test from the production VM's IP.

### Phase 2: Hardening (one weekend of agent work, 20-30 hours)

- [ ] **T2.1** — Build the custom Caddy image with the Cloudflare DNS plugin (§8.5). Use `local/caddy:cloudflare` in the §7 compose. The standard `caddy:2-alpine` image cannot do DNS-01 challenges.
- [ ] **T2.2** — Implement the §12½.a PRAGMA init script, run it once, verify all 14 DBs are in WAL mode.
- [ ] **T2.3** — Implement the §12½.b daily `PRAGMA integrity_check` cron (the v5 jq-based version, not the v4 hand-rolled JSON).
- [ ] **T2.4** — Implement the §12½.c weekly automated restore-test cron (the v5 corrected `rclone lsf --format "tp"` version, with row-count check).
- [ ] **T2.5** — Set up the separate `infra/rclone.conf` with a bootstrap R2 token (read-only on `config/`), and wire the §12½.d config backup to use it.
- [ ] **T2.6** — Wire Sentry into the backend (Backend/src/app.js error middleware).
- [ ] **T2.7** — Wire Sentry into the frontend (Frontend/src/main.tsx).
- [ ] **T2.8** — Set up Betterstack status page with three monitors (use `/api/career/health`, NOT `/api/erp/health` which doesn't exist).
- [ ] **T2.9** — Add the IP blocklist admin route (T2.9a: refactor `extractIp` to a shared util; T2.9b: integrate blocklist check into the existing rate limiter; T2.9c: add admin routes).
- [ ] **T2.10** — Create `SECURITY.md` and the `security@yourdomain.com` email alias.
- [ ] **T2.11** — Document the incident response playbook at `infra/runbooks/incident-response.md`.
- [ ] **T2.12** — Manually test the §18 bootstrap script on a throwaway VM, confirm it exits 0.

### Phase 3: Operational maturity (one week of agent work, 30-40 hours)

- [ ] **T3.1** — Install GitHub Actions self-hosted runner on the VM (§14.a).
- [ ] **T3.2** — Add the deploy workflow at `.github/workflows/deploy.yml` (§14.b).
- [ ] **T3.3** — Add a "is the runner alive" cron (§14.f).
- [ ] **T3.4** — Wire Promtail to ship logs to Grafana Cloud free tier (§13.d).
- [ ] **T3.5** — Build a Grafana dashboard for error rate / p95 latency / captcha failure / disk usage (§13.d).
- [ ] **T3.6** — Move DNS to Cloudflare as authoritative (§8.5) — includes the domain purchase if you don't already have one.
- [ ] **T3.7** — Update Caddyfile to use Cloudflare DNS-01 challenge (§8.5).
- [ ] **T3.8** — Set up the §18 bootstrap script in the repo, and the quarterly cron that exercises it on a throwaway VM.

### Phase 4: Failover (2-3 days of agent work, 30+ hours, do after 30 days of stable production)

- [ ] **T4.1** — Provision a GCP `e2-micro` in `us-west1` as the standby VM.
- [ ] **T4.2** — Install a second GitHub Actions self-hosted runner on the standby.
- [ ] **T4.3** — Configure the standby to do a nightly R2 restore of `data/` (read-only, no live traffic).
- [ ] **T4.4** — Add the standby's IP as a B-record in Cloudflare DNS, with TTL 60s (§1B).
- [ ] **T4.5** — Test a planned cutover: flip the DNS A record, watch error rates for 10 minutes, flip back.
- [ ] **T4.6** — Document the cutover procedure as `infra/runbooks/cutover.md` with the actual cloud-specific steps.

### Phase 5: Optional, when you have evidence you need them

- [ ] **T5.1** — Residential proxy for backend→ERP traffic (§11c) — only if §11a AND §11b both fail.
- [ ] **T5.2** — Drop Redis (use in-memory session store) — only if you're feeling the operational burden.
- [ ] **T5.3** — Self-hosted Postgres migration (§17.c) — only when you hit 2,000+ sustained concurrent users.

### What's NOT on this list

- The full Prometheus + Grafana + Loki + Alertmanager + node-exporter + cAdvisor local stack (use Grafana Cloud free instead — §13).
- A multi-region active-active setup (you don't need it until you have evidence you do).
- A Kubernetes migration (you don't need it; the v3 §16 "no Kubernetes" stance still holds).
- A paid cloud (you don't need it; the $0 envelope still works at 1k concurrent users with this stack).

The phases are ordered by "value per hour of agent work." If you have 8 hours of agent time, do Phase 1. If you have a weekend, do Phases 1 and 2. If you have a week, do Phases 1-3. Phase 4 is "do it before your first big user surge, not before." Phase 5 is "only when symptoms appear."

---

# Part V — Architectural Decisions (v6)

The next sections are the v6 red-team's output: a current-2026 review of every major stack choice in the guide, with the alternatives, the trade-offs, and the call. v5 audited the existing choices; v6 asks whether some of them should be *replaced* as the ecosystem has moved.

## 20. CI/CD: GitHub Actions Self-Hosted vs Woodpecker vs Drone vs Forgejo

**Current pick (§14):** GitHub Actions self-hosted runner on the VM, free unlimited minutes, push-to-main deploys. This is still the right call for the next 12-18 months for this project, for a specific reason: **the GitHub Actions self-hosted runner is free and the repo is already on GitHub.** The friction of switching to a self-hosted CI tool that's separate from your source control is real, and the win is small.

But the space has moved. Here's the honest 2026 comparison:

| Option | Cost at our scale | When it's the right call |
|---|---|---|
| **GitHub Actions self-hosted runner** (§14) | $0, free unlimited | You are on GitHub. Push-to-main deploys. Single VM, single runner. |
| **GitHub-hosted Actions (cloud runners)** | 2,000 min/month free for private repos; $0.004/min beyond. Our backend tests + frontend tests + build is ~5-7 min × ~30 deploys/month = ~210 min, well under. | You don't want to maintain a runner on the VM. Downside: build must happen on GitHub's infra, which is slower and not on your network. |
| **Woodpecker CI** (self-hosted) | $0, open source, runs in a container | You want CI that runs *your* runners, your YAML, and you want it independent of GitHub. ~50MB RAM. Drop-in for `.drone.yml` or a Woodpecker-flavored YAML. |
| **Drone CI** (self-hosted) | $0, open source, ~80MB RAM | Same as Woodpecker, but Woodpecker is a hard fork and the more active project. Drone is in maintenance mode in 2026. Skip. |
| **Forgejo Actions** | $0, runs on a self-hosted Forgejo (Gitea fork) instance | You want a *fully* self-hosted stack (source + CI + deploy), no GitHub dependency. ~150MB RAM. Real escape hatch if GitHub is blocked, rate-limited, or compromised. |
| **Jenkins** | $0, but 500MB+ RAM minimum | Don't. Jenkins in 2026 for a 1-VM deploy is like renting a bus to drive to the corner store. |

**Concrete v5 → v6 changes:** none. GitHub Actions self-hosted is still correct. What v6 *adds* is the escape-hatch story: if the GitHub relationship ever sours (rate limits, pricing change, account compromise), the migration path is to Woodpecker CI on a separate VM with `.woodpecker.yaml` that mirrors the current `deploy.yml`. Total migration effort: ~4 hours, including a parallel run during which GitHub Actions still works as the primary.

**The one thing the v5 §14 didn't address:** GitHub's pricing change for Actions on self-hosted runners in 2026. Free for public repos forever; for **private** repos, GitHub began charging for self-hosted runner minutes in early 2026. If the repo is private, the self-hosted runner is still free (you own the hardware), but **GitHub-hosted** runners now bill against the repo's private-runner allowance. Verify your repo is in the right plan tier before relying on this. If you need to keep the repo public, no change. If it must stay private, set up billing alerts and a hard cap.

## 21. Monitoring Stack: Grafana Cloud vs SigNoz Cloud vs HyperDX Cloud

**Current pick (§13):** Grafana Cloud free tier (10GB logs/month, 50GB traces/month, 14d retention). Promtail as the shipper, Loki as the backend, Grafana for dashboards.

**2026 reality check.** Grafana Cloud is still the most generous free tier for logs + traces combined, but the ecosystem has caught up:

| Option | Free tier | When it's the right call |
|---|---|---|
| **Grafana Cloud** (current) | 10GB logs, 50GB traces, 50GB profiles, 3 users, 14d retention | The default. Most features, biggest ecosystem of exporters/dashboards. Downside: 14d retention is short for real incident investigation. |
| **SigNoz Cloud** | 5GB logs, 5GB traces, 50GB metrics, 30d retention, 1 user | OpenTelemetry-native, ClickHouse backend, much better query language (LogQL → SQL). Smaller community. |
| **HyperDX Cloud** | ~3GB logs, unlimited metrics (ClickHouse-based), 30d retention | Built for OpenTelemetry from day one. Best UX for log search. Smaller community than Grafana. |
| **Better Stack Logs** (not the same as Better Stack Uptime) | 5GB logs, 7d retention, 1 user | Same vendor as the §13 status page, so one login. Decent UI. Smaller backend (Elasticsearch-based, not ClickHouse). |

**For a 1-VM, 1k-concurrent-user app with ~14 SQLite DBs writing ~5-50MB of structured logs/day, all four fit.** Grafana Cloud is the default. HyperDX is the upgrade if you find yourself wanting better log search (its UI is significantly better than Loki's LogQL for ad-hoc queries). SigNoz is the upgrade if you want OpenTelemetry-native tracing baked in. Better Stack Logs is the upgrade if you want one less vendor.

**Concrete v5 → v6 change:** none required. Add a §13½ note: **if you outgrow Grafana Cloud's 14d retention** (which is the most common upgrade trigger in 2026), HyperDX is the cheapest next step. Migration is "point Promtail at a new endpoint" — no code change.

**The one thing v5 didn't catch:** Grafana Cloud's free tier *also* includes 50GB of **profiles** (continuous profiling) and 3,000 series of Prometheus metrics. v5 used Promtail for logs only. Adding the Grafana Agent for metrics and the Pyroscope agent for profiles is a 20-line compose addition that gets you APM-grade observability for the app backend. Free, untouched by the current guide.

## 22. Error Tracking: Sentry vs GlitchTip vs Bugsink vs Self-Hosted Sentry

**Current pick (§13.b):** Sentry free tier (5,000 errors/month, 10,000 events/month). Backend + frontend integration.

**2026 reality check.** Sentry's free tier is fine, but two things have changed:

1. Sentry tightened their "events" definition in 2025 — what used to count as 1 event can now count as 3-5 (breadcrumbs, attachments, sessions all count). Realistic budget at this app size: ~1,000-3,000 effective errors/month, with 5,000 as the cap.
2. Three viable open-source self-hosted alternatives exist now that didn't in 2023:

| Option | Cost | When it's the right call |
|---|---|---|
| **Sentry free cloud** (current) | $0 | Default. 5k errors/month is enough for a 1k-user app. |
| **GlitchTip** (self-hosted) | $0, ~150MB RAM | Open-source Sentry-API-compatible. Sentry SDKs work without code changes. Drop-in replacement. **Best self-hosted option for a 1-VM deploy.** |
| **Bugsink** (self-hosted) | $0, ~50MB RAM | Newer in 2026, written in Python, lighter weight than GlitchTip. Less mature, but real Sentry-API compatibility. |
| **Self-hosted Sentry** | $0, but ~2-4GB RAM minimum | The full Sentry stack is too heavy for a 1-VM deploy. Skip unless you have a separate VM for it. |

**Concrete v5 → v6 change:** none required. Add a §13.b-prime note: **if you outgrow Sentry's free tier (5k errors/month is reachable on a noisy day), the cheapest escape is GlitchTip self-hosted.** Docker compose snippet:

```yaml
  glitchtip:
    image: glitchtip/glitchtip:latest
    restart: unless-stopped
    environment:
      - DATABASE_URL=postgres://glitchtip:glitchtip@glitchtip-db:5432/glitchtip
      - SECRET_KEY=<random-32-bytes>
      - EMAIL_URL=smtp://user:pass@smtp.example.com:587  # optional
      - GLITCHTIP_DOMAIN=https://errors.yourdomain.com
      - PORT=8000
    depends_on:
      - glitchtip-db

  glitchtip-db:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      - POSTGRES_USER=glitchtip
      - POSTGRES_PASSWORD=glitchtip
      - POSTGRES_DB=glitchtip
    volumes:
      - glitchtip_db:/var/lib/postgresql/data

volumes:
  glitchtip_db:
```

This adds 2 containers (~250MB RAM total) and gives you unlimited Sentry events. Migration from Sentry cloud is "change the DSN in the SDK; the Sentry protocol is identical." Total migration effort: 2-3 hours.

**The Sentry SDKs (Node + React) are unchanged.** You swap the DSN endpoint and keep the integration code.

## 23. Container Orchestration: Docker Compose vs Docker Swarm vs k3s vs Nomad

**Current pick (§7):** Plain Docker Compose. Single VM, single backend, single Redis, single Caddy.

**2026 reality check.** This is the most-asked question in the deploy-doc world, and the v5 answer is "Compose is fine." That's still right, but let me give you the honest comparison so you can make the call when you outgrow it.

| Option | When it's the right call for THIS project | When it's NOT |
|---|---|---|
| **Docker Compose** (current, v5) | Single VM, single backend, single Caddy, single Redis. The current stack. **The right answer for 0 to 1,000 concurrent users.** | Multi-node (you'd have to manually orchestrate healthchecks, log shipping, etc.). |
| **Docker Swarm** | **Never, for this project.** Swarm is in maintenance mode in 2026. Mirantis sold it. There's no public roadmap. The community has mostly migrated to k3s. Picking Swarm in 2026 is picking a dead horse. | Any new project. |
| **k3s** (lightweight Kubernetes) | When you have ≥3 nodes and want real orchestration: rolling deploys, secrets management, RBAC, multi-region, autoscaling. **k3s is the right next step if you grow past the §1B standby to a real 3+ node cluster.** Memory: ~500MB per node, very low. | Single VM. Compose is simpler. |
| **k0s** | Same as k3s, slightly different packaging. k0s has a cleaner "single binary" install story; k3s has the larger community. Pick k3s for ecosystem. | Same. |
| **Talos Linux** | The "real" Kubernetes for production. Immutable OS, API-driven everything. **Right for a 10+ node cluster where you want minimal attack surface.** | Single VM. Way overkill. |
| **Nomad** | HashiCorp's orchestrator. Simpler than k8s, more capable than Compose. Right if you want to mix containerized and non-containerized workloads. **Underrated in 2026.** | If you're already on k8s, no reason to switch. |

**Concrete v5 → v6 change:** none. Add this rule of thumb to the doc:

- **0-1,000 concurrent users, 1 VM:** Docker Compose. (You are here.)
- **1,000-5,000, 2-3 VMs (§1B + 1 standby):** Docker Compose, *with the §14 self-hosted runner extended to both VMs* and the standby doing nightly data syncs. No new orchestrator needed.
- **5,000-20,000, 3+ nodes (e.g. primary + standby + dedicated scraper VM + dedicated Postgres VM):** **k3s on every node.** ~500MB RAM per node for the k3s control plane + agent. Lets you do rolling deploys, centralize secrets in k3s, run the scraper as a separate k3s Deployment, and handle node failure gracefully. Migration from Compose: 2-3 days of agent work to convert compose files to k8s manifests, deploy with `kubectl apply`.
- **20,000+:** k3s or Talos, but the rest of the architecture also needs work (real Postgres, real CDN, real APM).

**The thing v5 didn't address:** k3s is the answer for "I want real orchestration" *only* if you can afford the operational complexity of debugging k8s networking, PVCs, and ingress when things break. The 1-VM Compose stack is debuggable by one person with `docker logs` and `docker exec`. A 3-node k3s cluster is not. Don't move to k3s because it's "more professional." Move to it because you have evidence the Compose stack is the bottleneck (and it almost never is, at this scale).

## 24. Reverse Proxy: Caddy vs nginx vs Traefik vs Envoy

**Current pick (§8):** Caddy with the Cloudflare DNS plugin (custom `xcaddy` build per §8.5).

**2026 reality check.** Caddy is still the right call. But let me give you the comparison because nginx has caught up on a few things and Traefik is a real option for k3s deployments.

| Option | When it's the right call | Why not for THIS project |
|---|---|---|
| **Caddy** (current) | Default for a 1-VM, single-tenant deploy. Auto-TLS, human-readable config, low memory. | k3s users will prefer Traefik because it integrates with cert-manager. |
| **nginx** | When you need extreme performance tuning, or your team already knows nginx config deeply. v5 cited Caddy as "22% faster" on 1KB static files, but nginx is *more* configurable. | Manual cert management, more config syntax, larger memory footprint. |
| **Traefik** | Default for k3s deployments. Native ingress-controller integration, dashboard included. | Overkill for a single-VM Compose stack. The dashboard is its own attack surface. |
| **Envoy** | Service-mesh use cases, very high throughput, complex routing. | The Caddyfile equivalent in Envoy is ~10x the lines. Not worth it at this scale. |
| **HAProxy** | When you need the absolute lowest latency and are willing to write complex config. | Same as Envoy — wrong tool for the job at this scale. |

**Caddy is 22% faster than nginx on 1KB static files** (per a 12-week April 2026 benchmark cited in the search results). That matters when you're serving 50+ MB of hashed JS bundles per cold load. For the static SPA, Caddy is the right pick.

**Concrete v5 → v6 change:** none. Add a note: **if you migrate to k3s (§23), switch to Traefik as the ingress controller** because cert-manager integration is free and the dashboard gives you a useful per-route view.

## 25. TLS Cert Lifetimes: 90 → 47 Days (Coming in 2026-2027)

**Current pick (§8.5, §13.h):** Caddy auto-renews every 60-90 days. Cert expiry monitor runs daily.

**The big 2026 change.** Let's Encrypt and the CA/Browser Forum have signaled a transition to **47-day TLS cert lifetimes by 2027**, down from 90. Some CAs are already issuing 47-day certs as a default. This affects you in three ways:

1. **Auto-renewal needs to be reliable.** Caddy's `certmagic` handles this automatically. If you've followed the v5 §8.5 config (DNS-01 via Cloudflare), you're fine.
2. **The §13.h cert-expiry monitor threshold (currently 14 days) should drop to 7 days** once 47-day certs are the norm. A cert that expires in 7 days on a 47-day cycle is "30% of lifecycle remaining" — still healthy. A cert that expires in 7 days on a 90-day cycle is "8% remaining" — emergency.
3. **The 5-runs-per-week rate limit on Let's Encrypt** is the same regardless of cert lifetime. With shorter lifetimes you renew more often, but the rate limit accommodates it. The free tier of Let's Encrypt (50 certs per registered domain per week) is plenty for one hostname.

**Concrete v5 → v6 change:** update the §13.h monitor threshold from 14 days to 7 days, and add a one-liner: "Caddy handles 47-day cert lifetimes automatically; no config change needed."

**The thing v5 didn't catch:** Cloudflare's own origin certs (when you're using the orange-cloud proxy) are 15-year certs and don't rotate. If you switch to a Cloudflare Origin Certificate for the visitor→edge hop, the 47-day thing only applies to the edge→origin cert (which Caddy handles). For the visitor→edge cert, Cloudflare presents a publicly-trusted cert automatically. This is a real simplification the v5 doc missed.

## 26. Uptime Monitoring: UptimeRobot vs Better Stack vs Healthchecks.io vs Self-Hosted

**Current pick (§13.a):** UptimeRobot free plan, 5-minute checks.

**2026 reality check.** UptimeRobot's free tier dropped to **50 monitors** (down from 50) but with a 5-minute check interval only — for sub-5-minute checks, you need a paid plan or a different tool. Better Stack's free tier offers 3-minute checks. Healthchecks.io is a different model entirely (cron-job heartbeat, not synthetic HTTP ping).

| Option | Free tier | When it's the right call |
|---|---|---|
| **UptimeRobot** (current) | 50 monitors, 5-minute check interval, email + SMS alerts (SMS limited) | The default. Reliable, used by millions, low false-positive rate. |
| **Better Stack Uptime** | 10 monitors, 3-minute checks, status page, on-call | You already use Better Stack for the §13.c status page (saves a login). |
| **Healthchecks.io** | 20 monitors (called "checks"), but it's a *heartbeat* model: your cron pings the service. If the ping doesn't arrive, you get alerted. | **Use this for cron monitoring** — the §12 backup, the §12½.b integrity check, the §12½.c restore-test, the §13.h cert-expiry. UptimeRobot can monitor HTTP endpoints, but it can't tell you "your backup didn't run at 3am." |
| **Uptime Kuma** (self-hosted) | $0, ~150MB RAM, runs in a container | You don't want any third-party dependency for monitoring. Docker compose one-liner. |

**Concrete v5 → v6 change:** add §13.a-prime — **use Healthchecks.io (free tier) as a second layer of monitoring specifically for your cron jobs.** The §12 backup, §12½.b integrity, §12½.c restore-test, and §13.h cert-expiry all become Healthchecks.io pings. If a cron doesn't ping, you get alerted. This catches the "the cron is in the crontab but silently failing" class of failure that synthetic uptime monitoring misses entirely.

The pattern:

```bash
# At the end of /opt/erp-platform/backup.sh:
curl -fsS -m 10 --retry 5 https://hc-ping.com/<your-uuid> > /dev/null
# Healthchecks.io sends alert if the URL isn't pinged within the expected window
```

UptimeRobot + Healthchecks.io together = both "is the server reachable" AND "are the cron jobs actually running." Free, two services, no overlap.

## 27. Object Storage: R2 vs Backblaze B2 vs Storj

**Current pick (§12):** Cloudflare R2 free tier, 10GB storage, 10M Class B writes/month.

**2026 reality check.** R2 is still the most generous free tier for backup-style workloads (zero egress is the killer feature). But there are two real alternatives if you want to hedge:

| Option | Free tier | When it's the right call |
|---|---|---|
| **Cloudflare R2** (current) | 10GB storage, 1M Class A writes, 10M Class B writes, **zero egress** | Default. The zero-egress makes it ideal for "I want to download a 5GB backup in 30 seconds and not pay $0.45 for it." |
| **Backblaze B2** | 10GB storage, 1GB/day download free, $0.005/GB-month over 10GB | Real alternative. The 1GB/day egress is a hard cap, but you can hit it with the §18 bootstrap on a slow connection. Has a 1GB/day free API call limit (Class B). |
| **Storj** | 150GB storage, 150GB egress/month free tier (Decentralized) | Real alternative if R2 gets cancelled. S3-compatible API, so rclone config is identical. |
| **AWS S3** | 5GB, 12 months only | Trial tier, not permanent. Skip. |

**R2's zero-egress is genuinely unusual and valuable.** The 1GB/day limit on B2 is the constraint — at your scale (one backup/night, one restore-test/week, occasional disaster recovery), you won't hit it, but if you ever need to bulk-restore a 10GB database, B2 will throttle you to a multi-day download.

**Concrete v5 → v6 change:** none. Add a note that **R2 is the right primary, and B2 is the right secondary** (if you want geographic redundancy, run nightly backups to both — adds ~30 lines of rclone config, costs $0 on R2 + $0 on B2 within the free tiers).

## 28. Domain Registrar: 2026 Reality

**Current pick (§1, §8.5):** Buy a domain (~$8-12/yr) for production use; use DuckDNS for the first hour.

**2026 reality check.** The free-domain landscape has changed:

- **Freenom** (the .tk / .ml / .ga free domain registrar) **is effectively dead** in 2026. They had a major lawsuit, lost their ICANN accreditation for .tk, and most browsers no longer trust .tk domains. The free domain era is over.
- **DuckDNS** still works (it's a free subdomain, not a TLD), but the reliability is inconsistent — DuckDNS has had multi-day outages in 2024-2025.
- **Real TLDs are $1-12/yr.** The cheapest reliable TLDs in 2026:
  - **.xyz** — $1/yr first year, $8-12/yr renewal. Frequent choice for student projects.
  - **.click** — $1-3/yr first year.
  - **.site** — $1-3/yr first year.
  - **.com** — $9-13/yr, no introductory discount. The "looks professional" choice.
- **Registrar choice matters less than the TLD.** Namecheap, Porkbun, Cloudflare Registrar, and IONOS all charge similar prices. Cloudflare Registrar charges *at cost* with no markup, which is the only one worth a specific recommendation.

**Concrete v5 → v6 change:** none. Add a §1.5 line: **buy a `.xyz` from Cloudflare Registrar for $1/yr first year, $8-12/yr renewal.** The first-year discount is real, the renewal price is honest, and Cloudflare Registrar bills at cost.

**The thing v5 didn't catch:** if you're a student and your university gives you a subdomain (`yourname.university.edu`), use it. It's free, it's already trusted by your user base, and it has implicit institutional backing. The deployment is identical, just point the Caddyfile to the university subdomain.

## 29. SQLite WAL Ceiling and the Postgres Decision

**Current pick (§1, §17):** SQLite on a single VM, self-hosted Postgres on a second free VM as the migration target.

**The hidden ceiling.** SQLite is genuinely good for this app, but there are two 2026-relevant ceilings that v5 didn't surface:

1. **WAL file growth under high write concurrency.** With ~30 ERP cache writes/minute at 1k concurrent users, the WAL is fine. At 5k concurrent users, with 200+ writes/sec during peak (cache invalidation, attendance snapshots, LMS interactions), the WAL file can grow to 100s of MB and `PRAGMA wal_checkpoint(TRUNCATE)` becomes a hot path. SQLite can handle this, but it requires explicit `PRAGMA journal_size_limit` and a periodic checkpoint cron. v5 §12½.a has `auto_vacuum = INCREMENTAL` but not `journal_size_limit`. **Add this** to the §12½.a init script:

   ```bash
   sqlite3 "$db" "PRAGMA journal_size_limit = 67108864;" 2>/dev/null || true  # 64MB WAL cap
   ```

2. **SQLite + AI features.** If you ever want to add semantic search to the LMS (find me resources similar to this), SQLite has `sqlite-vec` for vector search, but Postgres has `pgvector` which is more mature. This is a real reason to consider Postgres earlier than §17 currently suggests — not for OLTP scale, but for feature parity. **Don't migrate for this alone.** Note it as a "when you ship the feature, revisit the DB choice" trigger in §17.d.

**Concrete v5 → v6 change:** add the `journal_size_limit` PRAGMA to §12½.a. Note pgvector vs sqlite-vec in §17.d as a "feature-driven, not load-driven" trigger.

## 30. The Python Career Scraper: Separate VM, Always

**Current pick (§1B, §11c, §16):** Career scraper (`CAREER_SCRAPER_ENABLED=0` on the main VM) left off until a separate residential-IP host is set up.

**The 2026 reality.** This is the single most important non-obvious decision in the entire guide, and v5 buried it in a "do this later" note. Let me make it explicit:

**The Python scraper should NEVER run on the main VM, even with a residential proxy in front.** Three reasons:

1. **LinkedIn, Indeed, Glassdoor block residential proxies after a few hundred requests** even with rotation. The "rotate every request" model is detected by traffic-pattern analysis. The only IPs that survive long-term scraping are ISP-assigned residential IPs (your home internet) with conservative rate limits.
2. **The scraper is a fundamentally different workload** than the main app: 1 scrape per hour, 8 sources sequentially, each taking 30-90 seconds. It uses a different Python runtime, different network egress patterns, and has different monitoring needs. Mixing it with the Node app on the same VM means a scraper crash takes down the dashboard, and a dashboard deploy restarts the scraper mid-job.
3. **The cost is real but tiny.** A $5/mo Hetzner or DO VPS, or a Raspberry Pi at home with a residential ISP, is the right home for the scraper. The R2 backup bucket stays as the bridge between the two.

**Concrete v6 recommendation, with a §31-equivalent section to add:**

Add a §31: "The scraper VM."

```yaml
# /opt/scraper-vm/compose.yml
services:
  scraper:
    build: ../Scraper
    restart: unless-stopped
    env_file: .env
    volumes:
      - ./data:/app/data   # Local cache of scraped jobs, separate from main app
    network_mode: bridge
```

This is a one-container stack on a different machine. The scraper writes to its own SQLite file, which the main VM pulls from R2 nightly (or the scraper VM pushes to R2 on completion — see §12½.d for the config backup pattern).

**The thing v5 didn't say loudly enough:** if you don't set this up, and you turn on the scraper on the main VM with a residential proxy, *the main VM's IP reputation gets worse from the proxy sharing*, and the captcha login starts failing. Two workloads, two VMs, two IPs.

## 31. What's Actually Worth Doing Now (The Decision Matrix)

The §19 task list is 30+ items. If you have one weekend, you can do maybe 8 of them. Here's the v6 priority matrix, based on the bugs v5 fixed and the architectural decisions in this section:

**If you have 8 hours (one day):**
1. T1.1 — Rotate `.env` secrets. (§9)
2. T1.2 — Set all 14 `*_DB_PATH`. (§9)
3. T1.3 — Set `CAREER_SCRAPER_ENABLED=0` in compose. (§7)
4. T1.4 — Set `FRONTEND_BLUEPRINT_FILE=`. (§9)
5. T1.7 — Add `app.set('trust proxy', 1)`. (§15½.a)
6. T1.11 — Run §11a Playwright test. (§11)
7. T1.12 — Run §11b real-login test. (§11)
8. Build the custom Caddy image (T2.1). (§8.5)

These eight are the "don't ship without these" set. They fix the bugs v5 caught and unblock the rest of the stack.

**If you have one weekend (24-30 hours):** all of the above, plus:
- T2.2 — PRAGMA init script. (§12½.a)
- T2.3 — `PRAGMA integrity_check` cron (jq version). (§12½.b)
- T2.4 — Weekly restore-test cron (corrected rclone lsf). (§12½.c)
- T2.5 — `infra/rclone.conf` + config backup. (§12½.d)
- T2.6, T2.7 — Sentry backend + frontend. (§13.b)
- T2.8 — Betterstack status page. (§13.c)
- T2.9 — IP blocklist admin route. (§15½.a)
- T2.12 — Manually test the §18 bootstrap on a throwaway VM.

This is the "production-grade" line. Beyond this, you're into "operationally mature."

**If you have one week:** all of the above, plus:
- T3.1-T3.5 — Self-hosted runner, deploy workflow, Promtail/Grafana Cloud, cert-expiry monitor.
- T3.6, T3.7 — Cloudflare DNS migration.
- Add Healthchecks.io for cron monitoring (§26).
- Move the scraper to its own VM (§30).

**If you have one month:** all of the above, plus the §1B standby VM, the §17.c Postgres planning (still don't migrate, just plan), and the Sentry → GlitchTip escape-hatch evaluation.

**If you don't have time for any of this:** hire a competent agent for a weekend and give it the doc. The §19 task list is a literal work order.

## 32. The Hidden Cost of "Free"

The whole doc optimizes for $0/month. That's the right goal. But there's a hidden cost that's worth being honest about, so you can decide whether to accept it.

**The cost is your time, and the time of whoever maintains this when you're not around.**

- $0/month hosting = $50-200/month in human time, *if* you don't have agents doing the work. If you do have agents, $0/month = $0/month.
- The 30-hour agent job to set up the §1B standby is "free" in dollars but real in agent time. That's still cheaper than $20/month for a managed equivalent, but it's not zero.
- The "test the §18 bootstrap once a quarter" is 30 minutes of human time per quarter, on a Saturday afternoon when nothing is on fire. Or it's 30 minutes of agent time. Either way, it's not free.
- The "monitor your error capture quota" is a 5-minute monthly check.

**The honest framing:** this is a $0/month *hosting* stack, with a $50-200/month *maintenance* cost amortized over the year, in the worst case where you have no agents and you do it all yourself. With agents, the maintenance cost approaches zero. The architectural decisions in this doc are all about reducing the maintenance cost (catching the bugs v5 found, automating the cron monitoring, having a real escape hatch) so the *real* cost of free is acceptable.

**The one thing v5 didn't quantify:** the cost of *not* having monitoring when something breaks. A 4-hour outage on exam-results day, with 500 students locked out, has a real cost in trust and reputation that the $0/month stack doesn't account for. The §13 monitoring stack is the *insurance* against that cost. Spending 6 hours setting up Sentry + Betterstack + Healthchecks.io is the highest-value-per-hour work in the entire guide.

**Concrete v6 change:** add this section to the doc as §33 in the next revision. For now, it's the honest framing for every decision above: **the goal is to make the $0 stack actually production-grade, which is about reducing surprise, not reducing the dollar amount to zero.**

---

# Part V summary

The v6 red-team (which is really a 2026 ecosystem review, not just a code review) found:

- **§20:** GitHub Actions self-hosted is still right; Woodpecker/Forgejo are the escape hatch. Note GitHub's 2026 self-hosted-runner pricing change for private repos.
- **§21:** Grafana Cloud is still right; HyperDX is the upgrade path. Add Grafana profiles + metrics for free APM.
- **§22:** Sentry is still right; GlitchTip self-hosted is the escape hatch at $0.40/1k events. Add the GlitchTip compose snippet.
- **§23:** Compose is right for now; **k3s is the right next step at 3+ nodes, not Swarm, not Compose scaling.** Add the size-envelope rule of thumb.
- **§24:** Caddy is right; Traefik for k3s. Caddy is 22% faster than nginx on static files (April 2026 benchmark).
- **§25:** 47-day TLS certs coming in 2027; drop the §13.h alert threshold to 7 days.
- **§26:** Add Healthchecks.io as a second monitoring layer (cron heartbeat, not synthetic HTTP).
- **§27:** R2 is right; B2 is the secondary. R2's zero-egress is uniquely valuable.
- **§28:** Freenom is dead. Buy a `.xyz` from Cloudflare Registrar for $1/yr first year.
- **§29:** Add `journal_size_limit` PRAGMA. Note pgvector vs sqlite-vec as a feature-driven trigger.
- **§30:** The Python scraper should NEVER run on the main VM. Set up a separate scraper VM (Raspberry Pi at home or $5/mo Hetzner).
- **§31:** Triage the §19 list by time budget. 8 hours fixes the critical bugs; one weekend makes it production-grade.
- **§32:** The hidden cost of "free" is maintenance time. With agents, this approaches zero; without, it's $50-200/month amortized.

The v5 doc is the right foundation. v6 adds the architectural-decision context, the 2026 ecosystem awareness, and the prioritization. Neither supersedes the other — v5 is the *how*, v6 is the *why we chose this and what to do when it stops working*.
