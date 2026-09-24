<#
.SYNOPSIS
  Turns a Windows 10/11 PC into a WireGuard VPN server.

.DESCRIPTION
  Run this ONCE, as Administrator, on the Windows PC that will be the server
  (for a US IP that PC has to physically be in the USA).

    Right-click PowerShell -> Run as administrator, then:
    Set-ExecutionPolicy -Scope Process Bypass -Force
    .\Install-WireGuardServer.ps1

  What it does:
    1. Installs WireGuard for Windows (winget, or the official MSI)
    2. Generates server keys and C:\ProgramData\WireGuardServer\wg0.conf
    3. Installs wg0 as a Windows service that starts on boot
    4. Enables IP forwarding and NAT so clients reach the internet through this PC
    5. Opens UDP 51820 in Windows Firewall
    6. Stops the PC from sleeping (a sleeping server is no server)

  Then add devices with:   .\Manage-Client.ps1 -Add phone

  The ONE thing it cannot do for you: forward UDP 51820 on your home router
  to this PC. It prints the LAN IP you need for that at the end.

.PARAMETER Port       UDP port to listen on (default 51820)
.PARAMETER TunnelNet  First three octets of the tunnel network (default 10.66.66)
.PARAMETER Dns        DNS servers pushed to clients (default Cloudflare)
.PARAMETER Endpoint   Public IP or DDNS hostname clients connect to (auto-detected)
#>
#Requires -RunAsAdministrator
[CmdletBinding()]
param(
  [int]$Port = 51820,
  [string]$TunnelNet = '10.66.66',
  [string]$Dns = '1.1.1.1, 1.0.0.1',
  [string]$Endpoint = ''
)

$ErrorActionPreference = 'Stop'
$Base        = 'C:\ProgramData\WireGuardServer'
$ConfPath    = Join-Path $Base 'wg0.conf'
$StatePath   = Join-Path $Base 'server.json'
$WgDir       = Join-Path $env:ProgramFiles 'WireGuard'
$WgExe       = Join-Path $WgDir 'wg.exe'
$WireGuardExe= Join-Path $WgDir 'wireguard.exe'
$ServiceName = 'WireGuardTunnel$wg0'
$NatName     = 'WireGuardNAT'

function Say($msg)  { Write-Host "==> $msg" -ForegroundColor Green }
function Warn($msg) { Write-Host "warning: $msg" -ForegroundColor Yellow }

# ------------------------------------------------------------------ 1. WireGuard
if (-not (Test-Path $WireGuardExe)) {
  Say 'Installing WireGuard for Windows'
  $installed = $false
  if (Get-Command winget -ErrorAction SilentlyContinue) {
    winget install -e --id WireGuard.WireGuard --silent --accept-package-agreements --accept-source-agreements | Out-Null
    $installed = Test-Path $WireGuardExe
  }
  if (-not $installed) {
    $msi = Join-Path $env:TEMP 'wireguard.msi'
    Invoke-WebRequest -Uri 'https://download.wireguard.com/windows-client/wireguard-amd64-0.5.3.msi' -OutFile $msi
    Start-Process msiexec.exe -ArgumentList "/i `"$msi`" /qn DO_NOT_LAUNCH=1" -Wait
  }
  if (-not (Test-Path $WireGuardExe)) { throw 'WireGuard did not install. Install it from https://www.wireguard.com/install/ and re-run.' }
}

if (Test-Path $ConfPath) {
  throw "$ConfPath already exists - the server is already installed. Use .\Manage-Client.ps1 -Add NAME to add devices."
}

# ------------------------------------------------------------------ 2. network facts
$defaultRoute = Get-NetRoute -DestinationPrefix '0.0.0.0/0' -AddressFamily IPv4 |
                Sort-Object RouteMetric, InterfaceMetric | Select-Object -First 1
if (-not $defaultRoute) { throw 'No default IPv4 route found. Is this PC online?' }
$outIface = Get-NetAdapter -InterfaceIndex $defaultRoute.InterfaceIndex
$lanIp    = (Get-NetIPAddress -InterfaceIndex $defaultRoute.InterfaceIndex -AddressFamily IPv4 |
             Where-Object { $_.PrefixOrigin -ne 'WellKnown' } | Select-Object -First 1).IPAddress

if (-not $Endpoint) {
  foreach ($url in 'https://api.ipify.org', 'https://ifconfig.me/ip', 'https://icanhazip.com') {
    try { $Endpoint = (Invoke-RestMethod -Uri $url -TimeoutSec 8).ToString().Trim(); if ($Endpoint) { break } } catch {}
  }
  if (-not $Endpoint) { throw 'Could not detect the public IP. Re-run with -Endpoint <your public ip or ddns name>.' }
}
Say "Public endpoint $Endpoint`:$Port (udp)   internet adapter '$($outIface.Name)' LAN IP $lanIp   tunnel $TunnelNet.0/24"

# ------------------------------------------------------------------ 3. keys + config
New-Item -ItemType Directory -Force -Path $Base, (Join-Path $Base 'clients') | Out-Null
$serverPriv = (& $WgExe genkey).Trim()
$serverPub  = ($serverPriv | & $WgExe pubkey).Trim()

@"
# WireGuard server - managed by Install-WireGuardServer.ps1 / Manage-Client.ps1
[Interface]
PrivateKey = $serverPriv
ListenPort = $Port
Address = $TunnelNet.1/24
"@ | Set-Content -Path $ConfPath -Encoding ASCII

# Lock the config down to Administrators + SYSTEM (it holds the private key)
icacls $ConfPath /inheritance:r /grant:r '*S-1-5-32-544:F' '*S-1-5-18:F' | Out-Null   # Administrators, SYSTEM (SIDs work on any language)

@{
  Endpoint  = $Endpoint
  Port      = $Port
  TunnelNet = $TunnelNet
  Dns       = $Dns
  ServerPub = $serverPub
  OutIface  = $outIface.Name
} | ConvertTo-Json | Set-Content -Path $StatePath -Encoding ASCII

# ------------------------------------------------------------------ 4. forwarding + NAT
Say 'Enabling IP forwarding'
Set-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Services\Tcpip\Parameters' -Name 'IPEnableRouter' -Value 1 -Type DWord
Set-NetIPInterface -InterfaceIndex $defaultRoute.InterfaceIndex -Forwarding Enabled -AddressFamily IPv4

Say 'Setting up NAT'
$existingNat = Get-NetNat -ErrorAction SilentlyContinue
if ($existingNat | Where-Object { $_.Name -eq $NatName }) {
  # left over from a previous install
} elseif ($existingNat) {
  Warn "Another NAT already exists ($($existingNat.Name -join ', ')). Windows allows one NAT per PC."
  Warn 'If VPN clients get no internet, remove it with:  Remove-NetNat -Name <name>   and re-run this script.'
  try { New-NetNat -Name $NatName -InternalIPInterfaceAddressPrefix "$TunnelNet.0/24" | Out-Null } catch { Warn "NAT not created: $($_.Exception.Message)" }
} else {
  New-NetNat -Name $NatName -InternalIPInterfaceAddressPrefix "$TunnelNet.0/24" | Out-Null
}

# ------------------------------------------------------------------ 5. firewall
Say "Opening UDP $Port in Windows Firewall"
Get-NetFirewallRule -DisplayName 'WireGuard Server' -ErrorAction SilentlyContinue | Remove-NetFirewallRule
New-NetFirewallRule -DisplayName 'WireGuard Server' -Direction Inbound -Protocol UDP -LocalPort $Port -Action Allow -Profile Any | Out-Null

# ------------------------------------------------------------------ 6. service
Say 'Installing the wg0 tunnel service'
& $WireGuardExe /installtunnelservice $ConfPath
$deadline = (Get-Date).AddSeconds(20)
do { Start-Sleep -Milliseconds 500; $tun = Get-NetAdapter -Name 'wg0' -ErrorAction SilentlyContinue } until ($tun -or (Get-Date) -gt $deadline)
if (-not $tun) { throw "The wg0 service did not come up. Check: Get-Service '$ServiceName' and the WireGuard log." }
Set-NetIPInterface -InterfaceAlias 'wg0' -Forwarding Enabled -AddressFamily IPv4
Set-Service -Name $ServiceName -StartupType Automatic

# ------------------------------------------------------------------ 7. no sleep
Say 'Disabling sleep while plugged in'
powercfg /change standby-timeout-ac 0 | Out-Null
powercfg /change hibernate-timeout-ac 0 | Out-Null

# ------------------------------------------------------------------ done
Write-Host ''
Say 'Server is up.'
@"

  Next steps
  ----------
  1. On your home router, forward   UDP port $Port   ->   $lanIp   (this PC).
     Every router calls it something different: "Port Forwarding", "Virtual Server", "NAT".
     Also give this PC a fixed LAN IP (DHCP reservation) so the forward keeps working.

     If your ISP uses CGNAT (the router's WAN IP starts with 100.x or 10.x) port
     forwarding will NOT work. Use the Tailscale option in ..\tailscale instead.

  2. Add devices:
       .\Manage-Client.ps1 -Add phone      (opens a QR code for the phone app)
       .\Manage-Client.ps1 -Add laptop     (writes a .conf file to import)

  3. Test from a device on mobile data, not this Wi-Fi: connect, open https://ifconfig.me
     It should show $Endpoint

"@ | Write-Host
