#!/usr/bin/env bash
set -euo pipefail

# -----------------------------------------------------------
# setup-tailscale.sh
# Installs Tailscale on the VM and brings up the mesh interface.
# This is the only operator-facing (SSH) path onto the box — the
# public internet never sees an open port 22. Run once per VM.
#
# Usage: sudo ./setup-tailscale.sh
# -----------------------------------------------------------

announce() { echo "==> $*"; }
err()      { echo "==> ERROR: $*" >&2; }

if [[ "${EUID}" -ne 0 ]]; then
  err "This script must be run as root (it installs a system package and edits firewall/systemd state). Try: sudo $0"
  exit 1
fi

if command -v tailscale &>/dev/null; then
  announce "Tailscale is already installed ($(tailscale version | head -n1))."
else
  announce "Installing Tailscale ..."
  curl -fsSL https://tailscale.com/install.sh | sh
fi

announce "Enabling and starting tailscaled ..."
systemctl enable --now tailscaled

announce "Bringing up the Tailscale interface ..."
echo ""
echo "A login URL will be printed below. Open it in a browser signed"
echo "into the Tailscale account you created, and approve this device."
echo ""
tailscale up --ssh

echo ""
announce "Tailscale is up. Interface + assigned address:"
tailscale ip -4 || true

cat <<'EOF'

Next steps:
  1. In the Tailscale admin console (https://login.tailscale.com/admin/machines),
     confirm this machine appears and, optionally, disable key expiry for it
     (Always Free plans still support this per-device) so it never drops off
     the mesh unattended.
  2. Run infra/scripts/setup-vm-firewall.sh next to close every public port
     (including SSH/22) and allow SSH only over the tailscale0 interface.
  3. From here on, SSH to this box using its Tailscale IP or MagicDNS name,
     e.g.: ssh ubuntu@<tailscale-ip>
     (Oracle's Ubuntu 24.04 image creates the user "ubuntu", not "oracle".)
EOF
