#!/usr/bin/env bash
# =============================================================================
#  setup-exit-node-linux.sh - make a Linux box (Raspberry Pi, old laptop, any
#  Ubuntu/Debian machine) a Tailscale exit node = free VPN with that box's IP.
#
#  No port forwarding, no router settings, nothing to rent.
#
#      sudo bash setup-exit-node-linux.sh
#      sudo bash setup-exit-node-linux.sh tskey-auth-xxxxx   # optional auth key
#
#  Without an auth key it prints a login link: the VPN owner opens the link
#  and signs in, and the box joins the owner's Tailscale network.
# =============================================================================
set -euo pipefail
AUTH_KEY="${1:-}"
[ "$(id -u)" -eq 0 ] || { echo "run as root: sudo bash $0" >&2; exit 1; }

echo "==> Installing Tailscale"
command -v tailscale >/dev/null 2>&1 || curl -fsSL https://tailscale.com/install.sh | sh

echo "==> Enabling IP forwarding"
cat > /etc/sysctl.d/99-tailscale.conf <<EOF
net.ipv4.ip_forward = 1
net.ipv6.conf.all.forwarding = 1
EOF
sysctl -q -p /etc/sysctl.d/99-tailscale.conf

# Offload tweak recommended by Tailscale for exit nodes (better throughput)
if command -v ethtool >/dev/null 2>&1; then
  IFACE="$(ip -4 route show default | awk '/default/ {print $5; exit}')"
  [ -n "$IFACE" ] && ethtool -K "$IFACE" rx-udp-gro-forwarding on rx-gro-list off >/dev/null 2>&1 || true
fi

echo "==> Starting Tailscale as an exit node"
echo
echo "If a login link appears below, send it to the VPN owner. They open it and sign in."
echo
if [ -n "$AUTH_KEY" ]; then
  tailscale up --advertise-exit-node --reset --auth-key="$AUTH_KEY"
else
  tailscale up --advertise-exit-node --reset
fi

cat <<'EOF'

==> Done on this box.

  The VPN owner now does this once, from any browser:
    1. Open https://login.tailscale.com/admin/machines
    2. Click the "..." next to this machine -> Edit route settings -> tick "Use as exit node" -> Save

  Then on the owner's phone / laptop (Tailscale app, same login):
    Exit node -> pick this machine.   Everything now exits from this box's IP.

EOF
