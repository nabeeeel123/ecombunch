# Self-hosted VPN (free)

Your own VPN, built on the same core the paid ones use (WireGuard), for $0.
Phones and PCs connect with the official WireGuard or Tailscale apps.

Read the honest part first, then pick a path.

## The honest part

- A VPN gives you the **IP of the machine it runs on**. To get a US IP the
  machine must be in the US. There is no way around that.
- Websites don't detect "VPN". They look up **who owns the IP**. Any cloud
  server (Oracle, AWS, Google, and every paid VPN) is a datacenter IP and is
  flagged on sight by Amazon, PayPal, Stripe, TikTok, ad platforms.
- The only IP that reads as a normal US person is a **home internet
  connection in the US**. Free plus residential exists only if a real person
  in the US runs the exit for you.
- Even a residential IP is one signal. Marketplaces and payment processors
  also check ID, bank, address, phone, device fingerprint, and timezone.
  Using this to pass a residency check will work for a while and then fail
  with money in the account. Using it for a consistent login location for a
  properly set-up US business is fine.

## Pick a path

| Path | Cost | IP type | Needs | Folder |
|---|---|---|---|---|
| **A. Tailscale exit node** on a US friend's or relative's PC, Raspberry Pi, or spare Android phone | $0 | Real home IP | One person in the US to run a script once. No router changes. | `tailscale/` |
| **B. WireGuard on Oracle Cloud Always Free** (Ashburn, Phoenix or San Jose region) | $0 forever | Datacenter, flagged as VPN | A credit or debit card for identity check, never charged. Signups get rejected often. | `linux/` |
| **C. WireGuard on a Windows PC** in a US home | $0 | Real home IP | A US person, plus one port forwarded on their router. Use A instead unless you specifically want WireGuard. | `windows/` |

Path A is the best free option. Path B is the fallback when you know nobody
in the US. Path C is A without Tailscale in the middle.

Not worth your time: Proton VPN Free (can't pick country), Windscribe Free
(10 GB a month), Google Cloud free VM (1 GB traffic a month), AWS (free for
six months of credits then billed), public proxy lists (honeypots, 100 percent
flagged), Hola-style "free residential" apps (your device becomes an exit for
strangers).

---

## A. Tailscale exit node (free, residential IP)

Tailscale is WireGuard with the networking done for you. The free Personal
plan allows 100 devices and exit nodes.

**The US person does this once:**

- Windows PC: run `tailscale/Setup-ExitNode-Windows.ps1` as Administrator.
- Raspberry Pi or Linux: `sudo bash tailscale/setup-exit-node-linux.sh`.
- Spare Android phone: install Tailscale from Play Store, sign in with the
  link you send, then in the app: Settings, **Run exit node**. Leave it
  plugged in on home Wi-Fi.

The script prints a login link. They send it to you. You open it and sign in
with your own Google, Microsoft, Apple or GitHub account. Their machine joins
your network and they never need a Tailscale account. Alternatively create an
auth key at https://login.tailscale.com/admin/settings/keys and pass it to the
script so no link is needed.

**You do this once:** open https://login.tailscale.com/admin/machines, click
the three dots next to their machine, Edit route settings, tick
**Use as exit node**, Save.

**On every device you use:** install the Tailscale app (iOS, Android,
Windows, Mac), sign in with the same account, then choose **Exit node** and
pick their machine. Every app on the device now exits from their home IP.
Check at https://ifconfig.me.

Their machine must stay on. Traffic passes through it encrypted, but the
person who owns that machine could inspect it, the same way any VPN company
can.

---

## B. WireGuard on Oracle Cloud Always Free (free, datacenter IP)

1. Sign up at https://www.oracle.com/cloud/free/ and pick a **US home
   region** (US East Ashburn, US West Phoenix, or US West San Jose). The
   region cannot be changed later.
2. Create a VM: Compute, Instances, Create. Image **Ubuntu 24.04**. Shape:
   try `VM.Standard.A1.Flex` (ARM, 2 OCPU 12 GB, free). If it says
   "Out of capacity", use `VM.Standard.E2.1.Micro` (always available, also
   free). Download the SSH key it offers.
3. Open the port: Networking, Virtual Cloud Networks, your VCN, Security
   Lists, Default Security List, Add Ingress Rule:
   Source `0.0.0.0/0`, Protocol **UDP**, Destination port **51820**.
4. SSH in (`ssh -i key.pem ubuntu@<public ip>`) and run:

```bash
curl -fsSL https://raw.githubusercontent.com/nabeeeel123/ecombunch/main/vpn/linux/wg-server.sh -o wg-server.sh
sudo bash wg-server.sh install
sudo wg-server add phone     # scan the QR with the WireGuard app
sudo wg-server add pc        # copy the printed .conf into WireGuard for Windows/Mac
```

(Until this folder is merged to `main`, replace `main` in that URL with the
branch name, or just copy the file over with `scp`.)

The same script works on any Ubuntu, Debian, Raspberry Pi OS, or Oracle
Linux machine, including a Raspberry Pi in a US home (then forward UDP
51820 on that router to the Pi, and you have a residential IP).

Commands after install:

```
sudo wg-server add NAME      new client + QR
sudo wg-server qr NAME       show the QR again
sudo wg-server list          clients, last handshake, traffic
sudo wg-server remove NAME   revoke a device
sudo wg-server status        is the tunnel up
```

Oracle deletes idle free instances. Keep the VPN in use, or set up a cron
job that does something small every day.

---

## C. WireGuard server on a Windows PC (free, residential IP if the PC is in a US home)

On the Windows PC, PowerShell as Administrator:

```powershell
Set-ExecutionPolicy -Scope Process Bypass -Force
.\windows\Install-WireGuardServer.ps1
.\windows\Manage-Client.ps1 -Add phone     # opens a QR code page
.\windows\Manage-Client.ps1 -Add laptop    # writes a .conf file
```

Then forward **UDP 51820** on the home router to the PC's LAN IP (the
installer prints it) and give the PC a fixed LAN IP. If the ISP uses CGNAT
(router WAN IP starts with 100.x), port forwarding won't work; use path A.

Manage clients with `Manage-Client.ps1 -List`, `-Qr NAME`, `-Remove NAME`.

---

## Client apps

| Device | App | How to add |
|---|---|---|
| iPhone / Android | WireGuard (App Store / Play Store) | **+**, Scan from QR code |
| Windows / Mac | WireGuard from https://www.wireguard.com/install/ | Import tunnel from file, pick the `.conf` |
| Any, path A | Tailscale | Sign in, choose Exit node |

Turn on **On-demand** (iOS) or **Always-on VPN** (Android) in the app
settings so the tunnel reconnects by itself.

## Security notes

- Each device gets its own key pair and a preshared key. Revoke a lost
  device with `remove`; nothing else has to change.
- The client config routes `0.0.0.0/0, ::/0`, so IPv6 cannot leak around
  the tunnel even when the server has no IPv6.
- Keep `/etc/wireguard` (Linux) or `C:\ProgramData\WireGuardServer`
  (Windows) private. They contain the private keys. Never commit them.
- Never share a QR code page or a `.conf` file. Anyone with it is on your VPN.
