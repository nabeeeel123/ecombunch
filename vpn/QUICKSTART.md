# Quickstart: free US VPN in 10 minutes

## Option 1: you know someone in the US (best, real home IP)

### Step 1. Send them this message

> Hey, can you do me a 5 minute favour on your Windows PC? It sets up a free
> app called Tailscale so I can route my internet through your connection.
> It doesn't touch your files, and it's free. Steps:
>
> 1. Download and install Tailscale: https://tailscale.com/download/windows
> 2. When it opens and asks you to log in, DON'T. Close that browser tab.
> 3. Right-click the Start button, pick "Terminal (Admin)" or
>    "Windows PowerShell (Admin)", and paste this line, then press Enter:
>
>    `& "$env:ProgramFiles\Tailscale\tailscale.exe" up --advertise-exit-node`
>
> 4. It will print a link that starts with https://login.tailscale.com/a/
>    Copy that link and send it to me. That's it.
> 5. Leave the PC on. If it goes to sleep the VPN stops. In Settings, System,
>    Power, set "Screen and sleep" when plugged in to Never.
>
> Thanks!

If they have a Mac, step 1 is https://tailscale.com/download/mac and step 3 is
`tailscale up --advertise-exit-node` in Terminal. If they have a spare
Android phone: install Tailscale from Play Store, tap "Log in", send you the
link it opens instead of logging in, then Settings, Run exit node.

### Step 2. You do this once (2 minutes)

1. Open the link they sent. Sign in with Google, Microsoft, Apple or GitHub.
   That creates your free Tailscale account and adds their PC to it.
2. Go to https://login.tailscale.com/admin/machines
3. Next to their PC click the three dots, **Edit route settings**, tick
   **Use as exit node**, Save.
4. Same page, three dots, **Disable key expiry**. Otherwise it stops working
   after 180 days.

### Step 3. Your devices

- Phone: install **Tailscale** from the App Store or Play Store. Sign in with
  the same account. Tap **Exit node**, pick their PC.
- PC or Mac: install Tailscale from https://tailscale.com/download. Sign in.
  Tray icon, **Exit node**, pick their PC.

Open https://ifconfig.me. It should show their US home IP. Done.

Turn the exit node off in the Tailscale app when you don't need it. All your
traffic uses their internet while it's on.

---

## Option 2: nobody in the US (free, but needs a card for ID check, datacenter IP)

Oracle Cloud's free tier. About 30 minutes. A credit or debit card is required
for identity verification and is not charged. Prepaid and virtual cards are
rejected, and Oracle rejects a lot of signups with no reason given.

1. https://www.oracle.com/cloud/free/  Start for free. Home region:
   **US East (Ashburn)**. Cannot be changed later.
2. After login: Compute, Instances, **Create instance**.
   - Image: click Change image, pick **Ubuntu**, 24.04.
   - Shape: click Change shape, **Ampere**, `VM.Standard.A1.Flex`, 2 OCPU,
     12 GB. If it errors with "Out of capacity", change to
     **AMD**, `VM.Standard.E2.1.Micro`.
   - Under SSH keys: **Save private key**. Keep that file.
   - Create. Wait until it says Running, copy the **Public IP**.
3. Open the port: Networking, Virtual cloud networks, click the VCN, Security
   Lists, Default Security List, **Add Ingress Rules**:
   Source CIDR `0.0.0.0/0`, IP Protocol **UDP**, Destination Port Range
   `51820`. Add.
4. From your PC (PowerShell or Terminal), replace the key path and IP:

```
ssh -i C:\path\to\ssh-key.key ubuntu@PUBLIC_IP
```

5. On the server, paste:

```bash
curl -fsSL https://raw.githubusercontent.com/nabeeeel123/ecombunch/claude/charming-fermi-7ptowx/vpn/linux/wg-server.sh -o wg-server.sh
sudo bash wg-server.sh install
sudo wg-server add phone
```

6. Phone: install **WireGuard** from the App Store or Play Store, tap **+**,
   **Scan from QR code**, scan the terminal. Turn it on.
7. PC: `sudo wg-server add pc`, copy the printed config into a file called
   `pc.conf`, install WireGuard from https://www.wireguard.com/install/,
   **Import tunnel(s) from file**.

Open https://ifconfig.me. It should show the Oracle IP.

---

## Option 3: nothing to set up, right now, 2 minutes (stopgap only)

Windscribe free plan: https://windscribe.com. 10 GB a month, you can pick US
servers, no card. It is not your VPN and the IP is a shared datacenter IP that
every fraud system already knows. Fine for checking how a US page looks. Not
fine for logging into anything that matters.
