#!/usr/bin/env bash
set -euo pipefail

# -----------------------------------------------------------
# setup-tls.sh
# Provision Let's Encrypt TLS certificates via certbot + nginx.
# Usage: sudo ./setup-tls.sh [--dry-run] your-domain.example.com
# -----------------------------------------------------------

DOMAIN="${DOMAIN:-}"
DRY_RUN=false
for arg in "$@"; do
  case "$arg" in
    --dry-run)
      DRY_RUN=true
      ;;
    *)
      DOMAIN="$arg"
      ;;
  esac
done

DOMAIN="${DOMAIN:-university-erp.example.com}"
EMAIL="${EMAIL:-admin@${DOMAIN}}"

announce() { echo "==> $*"; }
warn()    { echo "==> WARNING: $*" >&2; }
dry()     { echo "[DRY-RUN] $*"; }

# -----------------------------------------------------------
# 1. Ensure certbot is installed
# -----------------------------------------------------------
if ! command -v certbot &>/dev/null; then
  announce "certbot not found — installing..."

  if [[ "$DRY_RUN" == true ]]; then
    dry "Would run: apt-get update && apt-get install -y certbot python3-certbot-nginx"
  else
    if command -v apt-get &>/dev/null; then
      apt-get update
      apt-get install -y certbot python3-certbot-nginx
    elif command -v dnf &>/dev/null; then
      dnf install -y certbot python3-certbot-nginx
    elif command -v yum &>/dev/null; then
      yum install -y certbot python3-certbot-nginx
    else
      warn "Unsupported package manager. Please install certbot manually."
      exit 1
    fi
  fi
else
  announce "certbot is already installed."
fi

# -----------------------------------------------------------
# 2. Print DNS setup instructions
# -----------------------------------------------------------
echo ""
announce "DNS Setup Instructions"
echo "========================="
echo "Before proceeding, ensure the following DNS record exists:"
echo ""
echo "  Type: A"
echo "  Name: ${DOMAIN}"
echo "  Value: <server-public-ip>"
echo ""
echo "Verify with: dig +short ${DOMAIN}"
echo ""

if [[ "$DRY_RUN" == true ]]; then
  dry "Skipping DNS check (--dry-run)."
else
  read -r -p "Have you configured the DNS record and it has propagated? (yes/no): " ANSWER
  if [[ "$ANSWER" != "yes" ]]; then
    echo "Please configure the DNS record and re-run this script."
    exit 1
  fi
fi

# -----------------------------------------------------------
# 3. Run certbot
# -----------------------------------------------------------
echo ""
announce "Obtaining TLS certificate for ${DOMAIN} ..."

CERTBOT_ARGS=(
  --nginx
  --non-interactive
  --agree-tos
  --email "${EMAIL}"
  --domains "${DOMAIN}"
)

if [[ "$DRY_RUN" == true ]]; then
  dry "Would run: certbot ${CERTBOT_ARGS[*]}"
else
  certbot "${CERTBOT_ARGS[@]}"
  announce "Certificate obtained successfully."
fi

# -----------------------------------------------------------
# 4. Configure HTTP -> HTTPS redirect
# -----------------------------------------------------------
echo ""
announce "Configuring HTTP -> HTTPS redirect ..."

NGINX_SITE="/etc/nginx/sites-available/${DOMAIN}"
if [[ ! -f "$NGINX_SITE" ]]; then
  NGINX_SITE="/etc/nginx/conf.d/${DOMAIN}.conf"
fi

if [[ "$DRY_RUN" == true ]]; then
  dry "Would ensure the nginx server block for ${DOMAIN} has:"
  dry "  return 301 https://\$host\$request_uri;"
  dry "  (or certbot's managed redirect)"
else
  announce "certbot typically adds the redirect automatically."
  announce "Verify it is in place: curl -I http://${DOMAIN}"
fi

# -----------------------------------------------------------
# 5. Add HSTS header to nginx config
# -----------------------------------------------------------
echo ""
announce "Adding HSTS header to nginx config ..."

if [[ "$DRY_RUN" == true ]]; then
  dry "Would add the following line inside the HTTPS server block of ${NGINX_SITE}:"
  dry "  add_header Strict-Transport-Security 'max-age=63072000; includeSubDomains; preload' always;"
  dry "Would run: nginx -t && systemctl reload nginx"
else
  if [[ ! -f "$NGINX_SITE" ]]; then
    warn "Could not find nginx config at ${NGINX_SITE}. Add HSTS manually after certbot creates the HTTPS server block."
    exit 1
  fi

  if grep -q "Strict-Transport-Security" "$NGINX_SITE" 2>/dev/null; then
    announce "HSTS header already present in ${NGINX_SITE}."
  else
    # Insert HSTS before the closing server block
    sed -i '/^server {/,$ {/^}/i\    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;' "$NGINX_SITE"
    announce "HSTS header added to ${NGINX_SITE}."
  fi

  announce "Testing nginx configuration ..."
  nginx -t

  announce "Reloading nginx ..."
  systemctl reload nginx

  announce "All done! TLS is active and HSTS is enabled for ${DOMAIN}."
fi

echo ""
echo "================================"
echo "  TLS Setup Complete (${DOMAIN})"
echo "================================"
