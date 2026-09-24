#!/usr/bin/env bash
# =============================================================================
#  wg-server.sh - self-hosted WireGuard VPN server, one file, no dependencies
#
#  Works on: Ubuntu 20.04+, Debian 11+, Raspberry Pi OS, Oracle Linux 8/9,
#            Rocky/Alma, Fedora. Tested target: Oracle Cloud "Always Free" VM
#            with the Ubuntu 24.04 image (a US region gives you a US IP).
#
#  Install (run as root):
#      sudo bash wg-server.sh install
#
#  After install the script copies itself to /usr/local/sbin/wg-server, so:
#      sudo wg-server add phone        # new client + QR code for the phone app
#      sudo wg-server add laptop       # new client, config file for PC/Mac
#      sudo wg-server qr phone         # show the QR again
#      sudo wg-server list             # clients, last handshake, traffic
#      sudo wg-server remove phone     # revoke a client
#      sudo wg-server status           # is the tunnel up
#
#  Tunables (env vars, all optional):
#      WG_PORT=51820        UDP port to listen on
#      WG_NET=10.66.66      /24 used inside the tunnel
#      WG_DNS="1.1.1.1, 1.0.0.1"
#      WG_ENDPOINT=1.2.3.4  public IP/hostname clients connect to (auto-detected)
#      WG_DIR=/etc/wireguard
#      WG_DRY_RUN=1         generate keys/configs only, touch nothing on the OS
# =============================================================================
set -euo pipefail

WG_PORT="${WG_PORT:-51820}"
WG_NET="${WG_NET:-10.66.66}"
WG_DNS="${WG_DNS:-1.1.1.1, 1.0.0.1}"
WG_ENDPOINT="${WG_ENDPOINT:-}"
WG_DIR="${WG_DIR:-/etc/wireguard}"
WG_DRY_RUN="${WG_DRY_RUN:-0}"
WG_IFACE="wg0"
WG_CONF="$WG_DIR/$WG_IFACE.conf"
WG_ENV="$WG_DIR/server.env"
CLIENTS_DIR="$WG_DIR/clients"
INSTALL_PATH="/usr/local/sbin/wg-server"

# ----------------------------------------------------------------------------- helpers
c_bold=$'\e[1m'; c_green=$'\e[32m'; c_yellow=$'\e[33m'; c_red=$'\e[31m'; c_off=$'\e[0m'
say()  { echo "${c_green}==>${c_off} $*"; }
warn() { echo "${c_yellow}warning:${c_off} $*" >&2; }
die()  { echo "${c_red}error:${c_off} $*" >&2; exit 1; }
dry()  { [ "$WG_DRY_RUN" = "1" ]; }

need_root() {
  if ! dry && [ "$(id -u)" -ne 0 ]; then
    die "run as root:  sudo bash $0 $*"
  fi
}

# Run a command unless in dry-run mode
run() {
  if dry; then echo "   (dry-run) $*"; else "$@"; fi
}

detect_pkg_manager() {
  if command -v apt-get >/dev/null 2>&1; then echo apt
  elif command -v dnf >/dev/null 2>&1; then echo dnf
  elif command -v yum >/dev/null 2>&1; then echo yum
  else echo none; fi
}

install_packages() {
  local pm; pm="$(detect_pkg_manager)"
  say "Installing WireGuard, iptables and qrencode ($pm)"
  case "$pm" in
    apt)
      run env DEBIAN_FRONTEND=noninteractive apt-get update -qq
      run env DEBIAN_FRONTEND=noninteractive apt-get install -y -qq wireguard wireguard-tools qrencode iptables curl
      ;;
    dnf|yum)
      # Oracle Linux / Rocky / Alma / Fedora. Kernel 5.6+ ships the module.
      run "$pm" install -y epel-release || true
      run "$pm" install -y wireguard-tools qrencode iptables curl
      ;;
    none)
      die "no apt/dnf/yum found. Install wireguard-tools, qrencode and iptables manually, then re-run."
      ;;
  esac
}

default_iface() {
  # The interface that carries the default route, e.g. eth0 / ens3 / enp0s6
  if command -v ip >/dev/null 2>&1; then
    ip -4 route show default 2>/dev/null | awk '/default/ {print $5; exit}'
  fi
}

public_ip() {
  local ip=""
  for url in https://api.ipify.org https://ifconfig.me/ip https://icanhazip.com; do
    ip="$(curl -4fsS --max-time 8 "$url" 2>/dev/null | tr -d '[:space:]' || true)"
    [[ "$ip" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]] && { echo "$ip"; return; }
  done
  echo ""
}

load_env() {
  [ -f "$WG_ENV" ] || die "server not installed yet ($WG_ENV missing). Run:  sudo bash $0 install"
  # shellcheck disable=SC1090
  . "$WG_ENV"
}

apply_live() {
  # Push config changes into the running interface without dropping other peers.
  dry && { echo "   (dry-run) wg syncconf $WG_IFACE"; return; }
  if wg show "$WG_IFACE" >/dev/null 2>&1; then
    wg syncconf "$WG_IFACE" <(wg-quick strip "$WG_IFACE")
  else
    systemctl restart "wg-quick@$WG_IFACE"
  fi
}

# ----------------------------------------------------------------------------- install
cmd_install() {
  need_root install
  command -v wg >/dev/null 2>&1 || install_packages
  command -v qrencode >/dev/null 2>&1 || install_packages

  if [ -f "$WG_CONF" ] && ! dry; then
    die "$WG_CONF already exists. Server is installed. Use 'wg-server add NAME' to add clients."
  fi

  local iface; iface="${WG_OUT_IFACE:-$(default_iface)}"
  [ -n "$iface" ] || { dry && iface="eth0"; }
  [ -n "$iface" ] || die "could not detect the internet-facing interface. Set WG_OUT_IFACE=eth0 and re-run."

  if [ -z "$WG_ENDPOINT" ]; then
    WG_ENDPOINT="$(public_ip)"
    [ -n "$WG_ENDPOINT" ] || { dry && WG_ENDPOINT="203.0.113.10"; }
    [ -n "$WG_ENDPOINT" ] || die "could not detect the public IP. Set WG_ENDPOINT=<your public ip> and re-run."
  fi

  say "Public endpoint: $WG_ENDPOINT:$WG_PORT (udp)   outbound interface: $iface   tunnel net: $WG_NET.0/24"

  mkdir -p "$WG_DIR" "$CLIENTS_DIR"
  chmod 700 "$WG_DIR" "$CLIENTS_DIR"

  local server_priv server_pub
  server_priv="$(wg genkey)"
  server_pub="$(printf '%s' "$server_priv" | wg pubkey)"

  # iptables rules are inserted at the top (-I) so they win over the
  # REJECT-everything rule Oracle Cloud images ship with.
  cat > "$WG_CONF" <<EOF
# WireGuard server - managed by wg-server. Client blocks are appended below.
[Interface]
Address = $WG_NET.1/24
ListenPort = $WG_PORT
PrivateKey = $server_priv
PostUp   = iptables -I INPUT -p udp --dport $WG_PORT -j ACCEPT; iptables -I FORWARD -i $WG_IFACE -j ACCEPT; iptables -I FORWARD -o $WG_IFACE -j ACCEPT; iptables -t nat -A POSTROUTING -s $WG_NET.0/24 -o $iface -j MASQUERADE
PostDown = iptables -D INPUT -p udp --dport $WG_PORT -j ACCEPT; iptables -D FORWARD -i $WG_IFACE -j ACCEPT; iptables -D FORWARD -o $WG_IFACE -j ACCEPT; iptables -t nat -D POSTROUTING -s $WG_NET.0/24 -o $iface -j MASQUERADE
EOF
  chmod 600 "$WG_CONF"

  cat > "$WG_ENV" <<EOF
# generated by wg-server install - do not edit by hand
WG_ENDPOINT="$WG_ENDPOINT"
WG_PORT="$WG_PORT"
WG_NET="$WG_NET"
WG_DNS="$WG_DNS"
WG_OUT_IFACE="$iface"
SERVER_PUB="$server_pub"
EOF
  chmod 600 "$WG_ENV"

  say "Enabling IP forwarding"
  if dry; then
    echo "   (dry-run) sysctl net.ipv4.ip_forward=1"
  else
    printf 'net.ipv4.ip_forward = 1\n' > /etc/sysctl.d/99-wireguard.conf
    sysctl -q -p /etc/sysctl.d/99-wireguard.conf
  fi

  say "Starting $WG_IFACE and enabling it on boot"
  run systemctl enable --now "wg-quick@$WG_IFACE"

  # Ubuntu's ufw, if it is enabled, must also allow the port.
  if ! dry && command -v ufw >/dev/null 2>&1 && ufw status 2>/dev/null | grep -q "Status: active"; then
    say "ufw is active: allowing $WG_PORT/udp"
    ufw allow "$WG_PORT/udp" >/dev/null
  fi

  # Install this script as a command
  if ! dry; then
    cp "$0" "$INSTALL_PATH" 2>/dev/null || cat "$0" > "$INSTALL_PATH"
    chmod 755 "$INSTALL_PATH"
  fi

  echo
  say "${c_bold}Server is up.${c_off}"
  cat <<EOF

  Next steps
  ----------
  1. Open UDP port $WG_PORT to the world in your cloud firewall:
       Oracle Cloud : Networking -> Virtual Cloud Networks -> your VCN -> Security Lists
                      -> Default Security List -> Add Ingress Rule
                      Source 0.0.0.0/0, Protocol UDP, Destination port $WG_PORT
       Home router  : Port forward UDP $WG_PORT to this machine's LAN IP
     (the OS firewall on this box is already open)

  2. Add your devices:
       sudo wg-server add phone     -> scan the QR with the WireGuard app
       sudo wg-server add pc        -> import the .conf file in WireGuard for Windows/Mac

  3. Check it works: connect, then open https://ifconfig.me - it should show $WG_ENDPOINT

EOF
}

# ----------------------------------------------------------------------------- clients
valid_name() { [[ "$1" =~ ^[A-Za-z0-9_-]{1,32}$ ]]; }

next_free_ip() {
  local used i
  used="$(grep -oE "AllowedIPs = $WG_NET\.[0-9]+/32" "$WG_CONF" 2>/dev/null | grep -oE '[0-9]+/32' | cut -d/ -f1 || true)"
  for i in $(seq 2 254); do
    grep -qx "$i" <<<"$used" || { echo "$i"; return; }
  done
  die "no free IPs left in $WG_NET.0/24"
}

cmd_add() {
  need_root add
  load_env
  local name="${1:-}"
  [ -n "$name" ] || die "usage: wg-server add NAME     (e.g. phone, laptop, work-pc)"
  valid_name "$name" || die "name must be letters, digits, - or _ (max 32)"
  grep -q "^# BEGIN client $name\$" "$WG_CONF" && die "client '$name' already exists. Remove it first or pick another name."

  local ip priv pub psk
  ip="$WG_NET.$(next_free_ip)"
  priv="$(wg genkey)"
  pub="$(printf '%s' "$priv" | wg pubkey)"
  psk="$(wg genpsk)"

  cat >> "$WG_CONF" <<EOF

# BEGIN client $name
[Peer]
PublicKey = $pub
PresharedKey = $psk
AllowedIPs = $ip/32
# END client $name
EOF

  mkdir -p "$CLIENTS_DIR"
  local cfile="$CLIENTS_DIR/$name.conf"
  # AllowedIPs 0.0.0.0/0, ::/0 = full tunnel. ::/0 is there on purpose: it
  # stops IPv6 from leaking around the VPN even if the server has no IPv6.
  cat > "$cfile" <<EOF
[Interface]
PrivateKey = $priv
Address = $ip/32
DNS = $WG_DNS

[Peer]
PublicKey = $SERVER_PUB
PresharedKey = $psk
Endpoint = $WG_ENDPOINT:$WG_PORT
AllowedIPs = 0.0.0.0/0, ::/0
PersistentKeepalive = 25
EOF
  chmod 600 "$cfile"

  apply_live

  say "Client '$name' added with tunnel IP $ip"
  echo "   Config file: $cfile"
  echo
  echo "   Phone: open the WireGuard app -> + -> Scan from QR code"
  echo "   PC/Mac: copy $cfile to the machine -> WireGuard app -> Import tunnel from file"
  echo
  show_qr "$name"
}

show_qr() {
  local cfile="$CLIENTS_DIR/$1.conf"
  [ -f "$cfile" ] || die "no client named '$1'"
  if command -v qrencode >/dev/null 2>&1; then
    qrencode -t ansiutf8 < "$cfile"
  else
    warn "qrencode not installed; showing the config instead"
    cat "$cfile"
  fi
}

cmd_qr() {
  load_env
  [ -n "${1:-}" ] || die "usage: wg-server qr NAME"
  show_qr "$1"
}

cmd_remove() {
  need_root remove
  load_env
  local name="${1:-}"
  [ -n "$name" ] || die "usage: wg-server remove NAME"
  grep -q "^# BEGIN client $name\$" "$WG_CONF" || die "no client named '$name'"
  # delete the block between the markers (inclusive) plus the blank line before it
  sed -i "/^# BEGIN client $name\$/,/^# END client $name\$/d" "$WG_CONF"
  sed -i '/^$/N;/^\n$/D' "$WG_CONF"   # squeeze repeated blank lines
  rm -f "$CLIENTS_DIR/$name.conf"
  apply_live
  say "Client '$name' removed"
}

cmd_list() {
  load_env
  echo "${c_bold}Clients${c_off}  (endpoint $WG_ENDPOINT:$WG_PORT)"
  local names; names="$(grep -oE '^# BEGIN client [A-Za-z0-9_-]+' "$WG_CONF" | awk '{print $4}' || true)"
  [ -n "$names" ] || { echo "  none yet - run: sudo wg-server add phone"; return; }
  local name pub ip hs rx tx
  for name in $names; do
    pub="$(sed -n "/^# BEGIN client $name\$/,/^# END client $name\$/p" "$WG_CONF" | awk '/PublicKey/ {print $3}')"
    ip="$(sed -n "/^# BEGIN client $name\$/,/^# END client $name\$/p" "$WG_CONF" | awk '/AllowedIPs/ {print $3}')"
    hs="never"; rx="0"; tx="0"
    if ! dry && wg show "$WG_IFACE" dump >/dev/null 2>&1; then
      local line; line="$(wg show "$WG_IFACE" dump | awk -v p="$pub" '$1==p')"
      if [ -n "$line" ]; then
        local ts; ts="$(awk '{print $5}' <<<"$line")"
        [ "$ts" != "0" ] && hs="$(date -d "@$ts" '+%Y-%m-%d %H:%M:%S')"
        rx="$(awk '{printf "%.1f MB", $6/1048576}' <<<"$line")"
        tx="$(awk '{printf "%.1f MB", $7/1048576}' <<<"$line")"
      fi
    fi
    printf '  %-16s %-18s last handshake: %-20s  down %s  up %s\n' "$name" "$ip" "$hs" "$rx" "$tx"
  done
}

cmd_status() {
  load_env
  if dry; then echo "(dry-run) status unavailable"; return; fi
  systemctl --no-pager status "wg-quick@$WG_IFACE" | head -5 || true
  echo
  wg show "$WG_IFACE" || die "$WG_IFACE is not running. Try: sudo systemctl restart wg-quick@$WG_IFACE"
}

usage() {
  sed -n '2,29p' "$0" | sed -e 's/^#  \{0,1\}//' -e 's/^#$//'
}

# ----------------------------------------------------------------------------- main
case "${1:-help}" in
  install) shift; cmd_install "$@" ;;
  add)     shift; cmd_add "$@" ;;
  qr)      shift; cmd_qr "$@" ;;
  remove|rm|revoke) shift; cmd_remove "$@" ;;
  list|ls) shift; cmd_list "$@" ;;
  status)  shift; cmd_status "$@" ;;
  help|-h|--help) usage ;;
  *) die "unknown command '$1'. Commands: install, add, qr, list, remove, status" ;;
esac
