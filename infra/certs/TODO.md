# TLS certificate mount

For production, provision the certificate outside version control and place the
normal Let's Encrypt tree at `infra/certs/live/<TLS_SERVER_NAME>/`. The ingress
copies `fullchain.pem` and `privkey.pem` into its runtime TLS directory. A clean
checkout uses a short-lived self-signed certificate so `docker compose up`
remains runnable for local verification.
