#!/usr/bin/env bash
# =============================================================================
#  create-vpn.sh - build a free WireGuard VPN on Oracle Cloud, end to end.
#
#  Paste this ONE line into Oracle Cloud Shell (the ">_" icon, top right of
#  the Oracle Cloud console) and press Enter:
#
#    bash <(curl -fsSL https://raw.githubusercontent.com/nabeeeel123/ecombunch/claude/charming-fermi-7ptowx/vpn/oracle/create-vpn.sh)
#
#  It will:
#    1. create a network (VCN, subnet, internet gateway, firewall rules)
#    2. launch an Always Free VM in your home region (ARM A1 first, x86 Micro
#       as fallback when Oracle says "out of capacity")
#    3. install the WireGuard server on it via cloud-init
#    4. wait until it's up and print the QR code for your phone
#
#  Every step is idempotent: re-run it if it fails half way.
#
#  Options (env vars):
#    SHAPE=micro          skip ARM, go straight to VM.Standard.E2.1.Micro
#    A1_RETRY_MINUTES=30  keep retrying ARM for N minutes before falling back
#    WG_PORT=51820
# =============================================================================
set -euo pipefail

RAW="https://raw.githubusercontent.com/nabeeeel123/ecombunch/claude/charming-fermi-7ptowx/vpn"
WG_PORT="${WG_PORT:-51820}"
NAME="wg-vpn"
SHAPE_PREF="${SHAPE:-a1}"
A1_RETRY_MINUTES="${A1_RETRY_MINUTES:-0}"
KEY="$HOME/.ssh/id_wg"

c_green=$'\e[32m'; c_yellow=$'\e[33m'; c_red=$'\e[31m'; c_off=$'\e[0m'
say()  { echo "${c_green}==>${c_off} $*"; }
warn() { echo "${c_yellow}warning:${c_off} $*" >&2; }
die()  { echo "${c_red}error:${c_off} $*" >&2; exit 1; }

command -v oci >/dev/null 2>&1 || die "the 'oci' command is missing. Run this inside Oracle Cloud Shell (the >_ icon in the console)."
command -v jq  >/dev/null 2>&1 || die "jq is missing (it is preinstalled in Cloud Shell)."

# ----------------------------------------------------------------------------- where are we
TENANCY="${OCI_TENANCY:-$(grep -m1 '^tenancy' "$HOME/.oci/config" 2>/dev/null | cut -d= -f2 | tr -d ' ' || true)}"
[ -n "$TENANCY" ] || die "could not find your tenancy OCID. Are you in Cloud Shell?"
C="$TENANCY"   # root compartment is fine for a one-VM free account

HOME_REGION="$(oci iam region-subscription list --query 'data[?"is-home-region"]."region-name" | [0]' --raw-output 2>/dev/null || true)"
CUR_REGION="${OCI_REGION:-$(oci iam region-subscription list --query 'data[0]."region-name"' --raw-output)}"
if [ -n "$HOME_REGION" ] && [ "$HOME_REGION" != "$CUR_REGION" ]; then
  warn "Cloud Shell is in $CUR_REGION but your home region is $HOME_REGION."
  warn "Always Free VMs only work in the home region. Switch the region picker (top bar) to $HOME_REGION and re-run."
  die "wrong region"
fi
say "Tenancy OK. Region: $CUR_REGION"

# ----------------------------------------------------------------------------- ssh key
if [ ! -f "$KEY" ]; then
  say "Generating an SSH key ($KEY)"
  mkdir -p "$HOME/.ssh"; chmod 700 "$HOME/.ssh"
  ssh-keygen -q -t ed25519 -N "" -f "$KEY" -C "wg-vpn"
fi

# ----------------------------------------------------------------------------- network
get_or_null() { local v; v="$("$@" 2>/dev/null || true)"; [ "$v" = "null" ] && v=""; echo "$v"; }

VCN="$(get_or_null oci network vcn list -c "$C" --display-name "$NAME-vcn" --query 'data[0].id' --raw-output)"
if [ -z "$VCN" ]; then
  say "Creating network $NAME-vcn"
  VCN="$(oci network vcn create -c "$C" --display-name "$NAME-vcn" --cidr-block 10.0.0.0/16 --dns-label wgvcn \
          --wait-for-state AVAILABLE --query data.id --raw-output)"
else
  say "Network $NAME-vcn already exists"
fi

RT="$(oci network vcn get --vcn-id "$VCN" --query 'data."default-route-table-id"' --raw-output)"
SL="$(oci network vcn get --vcn-id "$VCN" --query 'data."default-security-list-id"' --raw-output)"

IGW="$(get_or_null oci network internet-gateway list -c "$C" --vcn-id "$VCN" --query 'data[0].id' --raw-output)"
if [ -z "$IGW" ]; then
  say "Creating internet gateway"
  IGW="$(oci network internet-gateway create -c "$C" --vcn-id "$VCN" --is-enabled true --display-name "$NAME-igw" \
          --wait-for-state AVAILABLE --query data.id --raw-output)"
fi

say "Setting default route and firewall rules (SSH 22/tcp, WireGuard $WG_PORT/udp)"
oci network route-table update --rt-id "$RT" --force \
  --route-rules "[{\"destination\":\"0.0.0.0/0\",\"destinationType\":\"CIDR_BLOCK\",\"networkEntityId\":\"$IGW\"}]" >/dev/null
oci network security-list update --security-list-id "$SL" --force \
  --ingress-security-rules "[
     {\"protocol\":\"6\",\"source\":\"0.0.0.0/0\",\"tcpOptions\":{\"destinationPortRange\":{\"min\":22,\"max\":22}}},
     {\"protocol\":\"17\",\"source\":\"0.0.0.0/0\",\"udpOptions\":{\"destinationPortRange\":{\"min\":$WG_PORT,\"max\":$WG_PORT}}}
   ]" \
  --egress-security-rules '[{"protocol":"all","destination":"0.0.0.0/0"}]' >/dev/null

SUBNET="$(get_or_null oci network subnet list -c "$C" --vcn-id "$VCN" --display-name "$NAME-subnet" --query 'data[0].id' --raw-output)"
if [ -z "$SUBNET" ]; then
  say "Creating subnet"
  SUBNET="$(oci network subnet create -c "$C" --vcn-id "$VCN" --display-name "$NAME-subnet" --cidr-block 10.0.0.0/24 \
            --dns-label wgsub --route-table-id "$RT" --security-list-ids "[\"$SL\"]" \
            --wait-for-state AVAILABLE --query data.id --raw-output)"
fi

# ----------------------------------------------------------------------------- cloud-init
USERDATA="$(mktemp)"
cat > "$USERDATA" <<EOF
#cloud-config
package_update: true
runcmd:
  - curl -fsSL $RAW/linux/wg-server.sh -o /root/wg-server.sh
  - WG_PORT=$WG_PORT bash /root/wg-server.sh install > /root/install.log 2>&1
  - /usr/local/sbin/wg-server add phone > /root/phone.txt 2>&1
  - /usr/local/sbin/wg-server add pc    > /root/pc.txt    2>&1
  - touch /root/wg-ready
EOF

# ----------------------------------------------------------------------------- instance
INSTANCE="$(get_or_null oci compute instance list -c "$C" --display-name "$NAME" --lifecycle-state RUNNING --query 'data[0].id' --raw-output)"
if [ -z "$INSTANCE" ]; then
  INSTANCE="$(get_or_null oci compute instance list -c "$C" --display-name "$NAME" --lifecycle-state PROVISIONING --query 'data[0].id' --raw-output)"
fi

launch() {  # $1 shape  $2 AD  [$3 shape-config json]
  local shape="$1" ad="$2" cfg="${3:-}" image out
  image="$(oci compute image list -c "$C" --operating-system "Canonical Ubuntu" --operating-system-version "24.04" \
             --shape "$shape" --sort-by TIMECREATED --sort-order DESC --query 'data[0].id' --raw-output)"
  [ -n "$image" ] && [ "$image" != "null" ] || { warn "no Ubuntu 24.04 image for $shape"; return 1; }
  local args=(compute instance launch -c "$C" --availability-domain "$ad" --shape "$shape" --image-id "$image"
              --subnet-id "$SUBNET" --assign-public-ip true --display-name "$NAME"
              --ssh-authorized-keys-file "$KEY.pub" --user-data-file "$USERDATA"
              --query data.id --raw-output)
  [ -n "$cfg" ] && args+=(--shape-config "$cfg")
  if out="$(oci "${args[@]}" 2>&1)"; then
    INSTANCE="$out"; return 0
  fi
  if grep -qi "out of host capacity\|Out of capacity" <<<"$out"; then
    warn "$shape in $ad: out of capacity"
  else
    warn "$shape in $ad failed: $(grep -m1 -io '"message": *"[^"]*"' <<<"$out" || echo "$out" | tail -1)"
  fi
  return 1
}

if [ -z "$INSTANCE" ]; then
  mapfile -t ADS < <(oci iam availability-domain list -c "$C" --query 'data[].name' --raw-output | jq -r '.[]')
  [ "${#ADS[@]}" -gt 0 ] || die "no availability domains found"

  if [ "$SHAPE_PREF" != "micro" ]; then
    say "Trying Always Free ARM shape VM.Standard.A1.Flex (2 OCPU, 12 GB)"
    deadline=$(( $(date +%s) + A1_RETRY_MINUTES * 60 ))
    while :; do
      for ad in "${ADS[@]}"; do
        launch VM.Standard.A1.Flex "$ad" '{"ocpus":2,"memoryInGBs":12}' && break 2
      done
      [ "$(date +%s)" -lt "$deadline" ] || break
      echo "   retrying ARM in 60s (until $(date -d "@$deadline" +%H:%M))..."; sleep 60
    done
  fi

  if [ -z "$INSTANCE" ]; then
    say "Falling back to Always Free x86 shape VM.Standard.E2.1.Micro"
    for ad in "${ADS[@]}"; do
      launch VM.Standard.E2.1.Micro "$ad" && break
    done
  fi
  [ -n "$INSTANCE" ] || die "could not launch a free VM in any availability domain. Re-run later, or with A1_RETRY_MINUTES=60"
  say "Instance launched: $INSTANCE"
else
  say "Instance $NAME already exists: $INSTANCE"
fi

say "Waiting for the VM to be RUNNING"
for _ in $(seq 1 60); do
  state="$(oci compute instance get --instance-id "$INSTANCE" --query 'data."lifecycle-state"' --raw-output)"
  [ "$state" = "RUNNING" ] && break
  case "$state" in TERMINATED|TERMINATING) die "instance ended up $state. Re-run the script." ;; esac
  sleep 5
done
[ "$state" = "RUNNING" ] || die "VM is still $state after 5 minutes. Re-run the script in a bit."

IP=""
for _ in $(seq 1 30); do
  IP="$(get_or_null oci compute instance list-vnics --instance-id "$INSTANCE" --query 'data[0]."public-ip"' --raw-output)"
  [ -n "$IP" ] && break
  sleep 5
done
[ -n "$IP" ] || die "the VM has no public IP yet. Re-run in a minute."
say "Public IP: $IP"

# ----------------------------------------------------------------------------- wait for wireguard
SSH=(ssh -i "$KEY" -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o LogLevel=ERROR -o ConnectTimeout=8 "ubuntu@$IP")
say "Waiting for the VPN to install (2-4 minutes on first boot)"
ready=0
for _ in $(seq 1 60); do
  if "${SSH[@]}" 'sudo test -f /root/wg-ready' 2>/dev/null; then ready=1; break; fi
  printf '.'; sleep 10
done
echo
[ "$ready" = 1 ] || die "timed out waiting. Check with:  ${SSH[*]} 'sudo cat /root/install.log'"

# ----------------------------------------------------------------------------- helper
cat > "$HOME/wg" <<EOF
#!/usr/bin/env bash
# run wg-server commands on the VPN box:  ~/wg add tablet | ~/wg list | ~/wg remove tablet | ~/wg qr phone | ~/wg status
exec ssh -i "$KEY" -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o LogLevel=ERROR "ubuntu@$IP" sudo wg-server "\$@"
EOF
chmod +x "$HOME/wg"

# ----------------------------------------------------------------------------- done
echo
say "${c_green}Your VPN is live at $IP:$WG_PORT${c_off}"
echo
echo "PHONE: install the WireGuard app, tap +, 'Scan from QR code', scan this:"
echo
"${SSH[@]}" 'sudo cat /root/phone.txt' | sed -n '/█/,$p'
echo
echo "PC/MAC: install WireGuard from https://www.wireguard.com/install/, create a file pc.conf with this, then 'Import tunnel(s) from file':"
echo
"${SSH[@]}" 'sudo cat /etc/wireguard/clients/pc.conf'
echo
cat <<EOF
Check it works: turn the tunnel on, open https://ifconfig.me -> should show $IP

More devices later (from this Cloud Shell):
  ~/wg add tablet        new device + QR
  ~/wg qr phone          show a QR again
  ~/wg list              who is connected
  ~/wg remove tablet     revoke a device
  ~/wg status            is the tunnel up

Keep the VPN in use. Oracle reclaims Always Free VMs that sit idle for a week.
EOF
