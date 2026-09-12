# Cloudflare Tunnel + Tailscale Network Model

## Architecture

Two outbound-only connections replace every inbound port on the VM:

- **Cloudflare Tunnel** (`cloudflared` container, `infra/docker/compose.tunnel.yml`)
  carries all public HTTP(S) traffic. It dials out to Cloudflare's edge and
  forwards to the existing ingress container over the internal compose
  network (`https://ingress:443`, `--no-tls-verify` since the ingress
  container's certificate is self-signed unless a real one is mounted — see
  `infra/nginx/bootstrap-tls.sh`). No changes to nginx or the ingress
  Dockerfile are required.
- **Tailscale** (`infra/scripts/setup-tailscale.sh`, host-level, not a
  container) carries operator SSH over WireGuard. The VM's public port 22
  is closed; SSH is reachable only on the `tailscale0` interface.

`infra/scripts/setup-vm-firewall.sh` enforces this with `ufw`: default deny
incoming, SSH allowed only on `tailscale0`, and no rule at all for 80/443
since cloudflared needs none.

## Modes

- **Quick tunnel (default, no domain needed):** `compose.tunnel.yml` runs
  `cloudflared tunnel --url https://ingress:443`. Cloudflare mints a random
  `*.trycloudflare.com` hostname on every container start; read it from
  `docker compose logs -f cloudflared`. The hostname rotates on every
  restart — fine for early testing, not for anything that needs a stable
  URL (webhooks, bookmarks, monitoring targets).
- **Named tunnel (stable hostname, requires an owned domain in Cloudflare):**
  create a tunnel in the Cloudflare Zero Trust dashboard, add its
  `TUNNEL_TOKEN` to `.env`, and change the `command` in
  `compose.tunnel.yml` to `tunnel run --token ${TUNNEL_TOKEN}`.

## Startup order

```
docker compose -f docker-compose.yml \
               -f infra/docker/compose.ingress.yml \
               -f infra/docker/compose.tunnel.yml up -d
```

Bring up backend + Redis and the ingress override first (per
`infra/README.md`'s existing start order), then add the tunnel override.
Monitoring (`compose.monitoring.yml`) is independent of this and can be
layered in any order relative to the tunnel.

## VM provisioning (one-time, in order)

1. `sudo infra/scripts/setup-tailscale.sh` — installs Tailscale, brings up
   `tailscale0`, prints the login URL to approve the device.
2. `sudo infra/scripts/setup-vm-firewall.sh` — locks the host firewall down
   to the zero-public-port model. Requires `tailscale0` to already exist.
3. Also lock down the Oracle Cloud VCN's security list / network security
   group to match (no public ingress rules for 22/80/443) — the host
   firewall alone is not sufficient if the cloud-level ACL is left open.

## Rotating the tunnel hostname (quick-tunnel mode)

Any consumer of the current URL (browser bookmarks, external webhooks,
UptimeRobot/Better Stack checks) breaks on `docker compose restart
cloudflared` or a host reboot, since a new hostname is minted each time.
If a stable URL becomes necessary, move to named-tunnel mode above rather
than working around the rotation.

## Verifying

- `docker compose logs cloudflared` — confirms the tunnel connected and
  shows the current public hostname.
- From an external network (not on the Tailscale mesh), hit the printed
  hostname and confirm the app loads.
- From the Tailscale mesh, `ssh ubuntu@<tailscale-ip>` should succeed; from
  the public internet, the same host on port 22 should time out.
