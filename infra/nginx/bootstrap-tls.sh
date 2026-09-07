#!/bin/sh
set -eu

tls_name="${TLS_SERVER_NAME:-localhost}"
source_dir="/etc/letsencrypt/live/${tls_name}"
target_dir="/etc/nginx/tls"
mkdir -p "$target_dir"

if [ -r "$source_dir/fullchain.pem" ] && [ -r "$source_dir/privkey.pem" ]; then
  cp "$source_dir/fullchain.pem" "$target_dir/fullchain.pem"
  cp "$source_dir/privkey.pem" "$target_dir/privkey.pem"
else
  echo "No mounted TLS certificate for ${tls_name}; generating a development self-signed certificate." >&2
  openssl req -x509 -nodes -newkey rsa:2048 -days 7 \
    -keyout "$target_dir/privkey.pem" \
    -out "$target_dir/fullchain.pem" \
    -subj "/CN=${tls_name}" >/dev/null 2>&1
fi

exec /docker-entrypoint.sh nginx -g 'daemon off;'
