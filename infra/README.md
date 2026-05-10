# University ERP Infrastructure Bundle

This directory contains deployment artifacts aligned to the current architecture:
- Nginx reverse proxy
- Express backend
- Redis operational cache/session store
- SQLite + filesystem persistence inside backend data volume

## Layout
- `docker/`: compose bundles (`app`, `data`, `ingress`, optional `monitoring`)
- `nginx/`: reverse proxy config
- `monitoring/`: Prometheus, Grafana, Loki, Promtail configs (optional)
- `runbooks/`: operations runbooks
- `scripts/`: operational helper scripts

## Start Order
1. `docker compose -f infra/docker/compose.data.yml up -d`
2. `docker compose -f infra/docker/compose.app.yml up -d`
3. Build frontend dist: `cd Frontend && npm run build`
4. `docker compose -f infra/docker/compose.ingress.yml up -d`
5. Optional: `docker compose -f infra/docker/compose.monitoring.yml up -d`

## Notes
- No PostgreSQL dependency is required by the current backend.
- Persistent application data is stored in `Backend/data` (SQLite + filesystem).
- `erp_app` and `erp_data` networks are used to keep bundles loosely coupled.
- Nginx serves filesystem-backed files from `/files/*` via `Backend/data`.
