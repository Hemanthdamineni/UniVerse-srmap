# University ERP Infrastructure Bundle

This directory contains deployment artifacts aligned to the current
architecture. The prod-readiness plan-of-record (PR 1) selected the
**ingress container** as the canonical TLS termination path; the older
host-nginx path (`infra/scripts/setup-tls.sh`) has been removed.

## Architecture (Gate 9 P1 decision)

- **Root compose** (`docker-compose.yml` at the repo root) is the
  single source of truth for the backend + Redis services.
- **Ingress override** (`infra/docker/compose.ingress.yml`) adds the
  nginx reverse proxy in front of the backend on the same network.
  It publishes no host ports — see "Network model" below.
- **Tunnel override** (`infra/docker/compose.tunnel.yml`) adds
  Cloudflare Tunnel (`cloudflared`) as the only path for public
  traffic to reach the ingress container.
- **Monitoring override** (`infra/docker/compose.monitoring.yml`)
  adds Prometheus, Grafana, Loki, Promtail, and Alertmanager.
- **Bundle ordering:** backend + Redis first, then ingress, then
  tunnel, then monitoring. The root compose uses
  `depends_on: service_healthy` to enforce the ordering on startup.

## Network model (zero public-facing ports)

The VM has no inbound ports open to the public internet at all, on
either the host firewall or the cloud VCN security list:

- **Cloudflare Tunnel** (`compose.tunnel.yml`) makes an outbound-only
  connection from `cloudflared` to Cloudflare's edge, and reaches the
  `ingress` service internally over the compose network. This is why
  `compose.ingress.yml` no longer publishes `80`/`443` on the host.
- **Tailscale** (`infra/scripts/setup-tailscale.sh`, host-level) is
  the only path for operator SSH. Host port 22 is closed publicly and
  reachable only on the `tailscale0` interface, enforced by
  `infra/scripts/setup-vm-firewall.sh`.

Full details, including quick-tunnel vs. named-tunnel mode and VM
provisioning order, are in
`infra/runbooks/cloudflare-tunnel-tailscale.md`.

## Layout

- `docker/`
  - `compose.ingress.yml` — nginx reverse proxy in front of the root
    compose's `backend` service
  - `compose.tunnel.yml` — Cloudflare Tunnel (`cloudflared`), the only
    path for public traffic into the ingress container
  - `compose.monitoring.yml` — Prometheus + Grafana + Loki + Promtail +
    Alertmanager stack
- `nginx/`
  - `nginx.conf` — top-level config
  - `conf.d/university-erp.conf` — vhost that fronts the backend
- `monitoring/`
  - `prometheus/prometheus.yml` — scrape config + alertmanager wiring
  - `prometheus/alerts.yml` — 9 alert rules
  - `alertmanager/alertmanager.yml` — single-webhook routing
  - `grafana/` — provisioned dashboards
  - `loki/`, `promtail/` — log aggregation
- `cron/`
  - `backup.cron` — 02:00 daily crontab entry
- `runbooks/`
  - `backup-restore.md` — restore procedure
  - `rollback.md` — image-tag rollback
  - `secret-rotation.md` — Redis + admin password rotation
  - `upstream-erp-outage.md` — ERP outage + escalation policy
  - `redis-failover.md` — Redis failover
  - `deploy-canary.md` — canary deployment
  - `companion-platform-production-readiness.md` — overall readiness
  - `cloudflare-tunnel-tailscale.md` — Cloudflare Tunnel + Tailscale
    network model, modes, and VM provisioning order
- `scripts/`
  - `setup-backups.sh` — daily backup cron
  - `postdeploy-smoke.sh` — T+0 / T+24h smoke
  - `redis-backup-check.sh` — Redis RDB snapshot helper
  - `setup-tailscale.sh` — installs Tailscale, brings up `tailscale0`
  - `setup-vm-firewall.sh` — locks the host firewall to the
    zero-public-port model (SSH only on `tailscale0`, no 80/443 rule)

## Start order (Gate 9 P1)

1. Root compose (backend + Redis):
   ```
   docker compose up -d --build
   ```
2. Ingress (nginx reverse proxy in front of backend):
   ```
   docker compose -f docker-compose.yml \
                  -f infra/docker/compose.ingress.yml up -d
   ```
3. Tunnel (Cloudflare Tunnel — the only path for public traffic in;
   see `infra/runbooks/cloudflare-tunnel-tailscale.md`):
   ```
   docker compose -f docker-compose.yml \
                  -f infra/docker/compose.ingress.yml \
                  -f infra/docker/compose.tunnel.yml up -d
   ```
4. Monitoring (Prometheus + Grafana + Loki + Promtail +
   Alertmanager):
   ```
   docker compose -f docker-compose.yml \
                  -f infra/docker/compose.monitoring.yml up -d
   ```
5. (optional) Frontend static build for the ingress to serve:
   ```
   cd Frontend && npm run build
   ```
   The nginx config (`infra/nginx/conf.d/university-erp.conf`)
   already mounts the `Frontend/dist` volume.

## Why ingress container (not host-nginx)

- **Reproducible:** `docker compose up -d` on a fresh host produces
  the same proxy layer every time. Host-nginx required apt/dnf
  installs, manual certbot setup, and per-host OS-version drift.
- **Single source of truth:** The same root compose that runs
  backend + Redis is the source for the ingress override. No
  out-of-band steps.
- **Same image in every env:** The same `nginx:1.27-alpine` image
  ships in dev, staging, and prod. Host-nginx depended on the host
  distro's `nginx` package version.
- **TLS via certbot in the container (future work):** When the
  ingress container grows a certbot sidecar, no host changes are
  required.

## Notes

- No PostgreSQL dependency is required by the current backend.
- Persistent application data is stored in `Backend/data` (SQLite
  + filesystem).
- The ingress and monitoring overrides use the same network as
  the root compose (`erp_app`, `erp_data`) so the nginx + Prometheus
  containers can reach the backend.
- Nginx serves filesystem-backed files from `/files/*` via
  `Backend/data`.
