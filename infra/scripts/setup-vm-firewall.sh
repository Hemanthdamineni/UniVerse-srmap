#!/usr/bin/env bash
set -euo pipefail

# -----------------------------------------------------------
# setup-vm-firewall.sh
# Locks the VM down to the "zero public-facing ports" design:
#   - Cloudflare Tunnel carries all inbound HTTP(S) traffic out
#     to the internet, over an outbound-only connection from the
#     cloudflared container — no port 80/443 is ever opened here.
#   - Tailscale carries operator SSH, over an outbound-only
#     WireGuard connection — port 22 is closed on the public
#     interface and only reachable over tailscale0.
# Run this AFTER infra/scripts/setup-tailscale.sh, so the
# tailscale0 interface already exists when the SSH rule is added.
#
# Usage: sudo ./setup-vm-firewall.sh
# -----------------------------------------------------------

announce() { echo "==> $*"; }
err()      { echo "==> ERROR: $*" >&2; }

if [[ "${EUID}" -ne 0 ]]; then
  err "This script must be run as root (it edits firewall rules). Try: sudo $0"
  exit 1
fi

if ! command -v ufw &>/dev/null; then
  announce "Installing ufw ..."
  apt-get update -y && apt-get install -y ufw
fi

if ! ip link show tailscale0 &>/dev/null; then
  err "No tailscale0 interface found. Run infra/scripts/setup-tailscale.sh first."
  exit 1
fi

announce "Setting default policy: deny incoming, allow outgoing ..."
ufw default deny incoming
ufw default allow outgoing

announce "Allowing SSH only over the tailscale0 interface ..."
ufw allow in on tailscale0 to any port 22 proto tcp

announce "Allowing Tailscale's own UDP handshake port (needed before tailscale0 exists on reboot) ..."
ufw allow 41641/udp

# Deliberately NOT opening 80/443: cloudflared makes an outbound-only
# connection to Cloudflare's edge and needs no inbound rule at all.

announce "Enabling ufw ..."
ufw --force enable

echo ""
announce "Firewall status:"
ufw status verbose

cat <<'EOF'

Oracle Cloud also enforces its own security list / network security
group at the VCN level, in addition to this host firewall. Make sure
the VCN's ingress rules are equally locked down (no public 22/80/443),
since either layer alone is enough to expose the box if misconfigured.
EOF
