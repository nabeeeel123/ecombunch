<#
.SYNOPSIS
  Make this Windows PC a Tailscale "exit node": a free VPN endpoint with this
  PC's real home IP. No port forwarding, no router settings, nothing to rent.

.DESCRIPTION
  Give this script to the person in the USA whose PC will be the exit node.
  They run it once as Administrator:

    Set-ExecutionPolicy -Scope Process Bypass -Force
    .\Setup-ExitNode-Windows.ps1

  It installs Tailscale, prints a login link, and stops the PC from sleeping.
  Whoever OWNS the VPN opens the login link and signs in - the PC then joins
  the owner's Tailscale network without the US person needing an account.

  Or skip the link step by passing an auth key from
  https://login.tailscale.com/admin/settings/keys :

    .\Setup-ExitNode-Windows.ps1 -AuthKey tskey-auth-xxxxx

.PARAMETER AuthKey   Optional Tailscale auth key (pre-authorises the machine)
#>
#Requires -RunAsAdministrator
[CmdletBinding()]
param([string]$AuthKey = '')

$ErrorActionPreference = 'Stop'
$Ts = Join-Path $env:ProgramFiles 'Tailscale\tailscale.exe'
function Say($msg) { Write-Host "==> $msg" -ForegroundColor Green }

if (-not (Test-Path $Ts)) {
  Say 'Installing Tailscale'
  $ok = $false
  if (Get-Command winget -ErrorAction SilentlyContinue) {
    winget install -e --id tailscale.tailscale --silent --accept-package-agreements --accept-source-agreements | Out-Null
    $ok = Test-Path $Ts
  }
  if (-not $ok) {
    $msi = Join-Path $env:TEMP 'tailscale.msi'
    Invoke-WebRequest -Uri 'https://pkgs.tailscale.com/stable/tailscale-setup-latest-amd64.msi' -OutFile $msi
    Start-Process msiexec.exe -ArgumentList "/i `"$msi`" /qn" -Wait
  }
  if (-not (Test-Path $Ts)) { throw 'Tailscale did not install. Get it from https://tailscale.com/download/windows and re-run.' }
}

Say 'Disabling sleep while plugged in (an exit node has to stay on)'
powercfg /change standby-timeout-ac 0 | Out-Null
powercfg /change hibernate-timeout-ac 0 | Out-Null

Say 'Enabling IP forwarding'
Set-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Services\Tcpip\Parameters' -Name 'IPEnableRouter' -Value 1 -Type DWord

Say 'Starting Tailscale as an exit node'
$tsArgs = @('up', '--advertise-exit-node', '--reset')
if ($AuthKey) { $tsArgs += "--auth-key=$AuthKey" }
Write-Host ''
Write-Host 'If a login link appears below, send it to the VPN owner. They open it and sign in.' -ForegroundColor Yellow
Write-Host ''
& $Ts @tsArgs
try { & $Ts set --unattended 2>$null } catch {}   # keep running when nobody is logged in

Write-Host ''
Say 'Done on this PC.'
@'

  The VPN owner now does this once, from any browser:
    1. Open https://login.tailscale.com/admin/machines
    2. Click the "..." next to this PC  ->  Edit route settings  ->  tick "Use as exit node"  ->  Save

  Then on the owner's phone / laptop (Tailscale app, same login):
    Exit node  ->  pick this PC.   Everything now exits from this PC's home IP.

  This PC must stay on and online. Traffic passes through it encrypted, but the
  person who owns this PC could inspect it, exactly like any VPN provider can.
'@ | Write-Host
