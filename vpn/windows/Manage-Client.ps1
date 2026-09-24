<#
.SYNOPSIS
  Add, list, show or remove WireGuard clients on a Windows server set up with
  Install-WireGuardServer.ps1.  Run as Administrator.

.EXAMPLE
  .\Manage-Client.ps1 -Add phone        # new client, opens a QR code page
  .\Manage-Client.ps1 -Add laptop       # new client, .conf file for PC/Mac
  .\Manage-Client.ps1 -Qr phone         # open the QR page again
  .\Manage-Client.ps1 -List
  .\Manage-Client.ps1 -Remove phone
#>
#Requires -RunAsAdministrator
[CmdletBinding(DefaultParameterSetName = 'List')]
param(
  [Parameter(ParameterSetName = 'Add')]    [string]$Add,
  [Parameter(ParameterSetName = 'Remove')] [string]$Remove,
  [Parameter(ParameterSetName = 'Qr')]     [string]$Qr,
  [Parameter(ParameterSetName = 'List')]   [switch]$List
)

$ErrorActionPreference = 'Stop'
$Base        = 'C:\ProgramData\WireGuardServer'
$ConfPath    = Join-Path $Base 'wg0.conf'
$StatePath   = Join-Path $Base 'server.json'
$ClientsDir  = Join-Path $Base 'clients'
$WgExe       = Join-Path $env:ProgramFiles 'WireGuard\wg.exe'
$ServiceName = 'WireGuardTunnel$wg0'

function Say($msg) { Write-Host "==> $msg" -ForegroundColor Green }

if (-not (Test-Path $StatePath)) { throw 'Server not installed. Run .\Install-WireGuardServer.ps1 first.' }
$S = Get-Content $StatePath -Raw | ConvertFrom-Json
New-Item -ItemType Directory -Force -Path $ClientsDir | Out-Null

function Assert-Name($n) {
  if ($n -notmatch '^[A-Za-z0-9_-]{1,32}$') { throw 'Name must be letters, digits, - or _ (max 32).' }
}
function Get-ClientNames {
  Select-String -Path $ConfPath -Pattern '^# BEGIN client ([A-Za-z0-9_-]+)$' |
    ForEach-Object { $_.Matches[0].Groups[1].Value }
}
function Get-NextFreeIp {
  $used = Select-String -Path $ConfPath -Pattern ("AllowedIPs = " + [regex]::Escape($S.TunnelNet) + '\.(\d+)/32') |
          ForEach-Object { [int]$_.Matches[0].Groups[1].Value }
  foreach ($i in 2..254) { if ($used -notcontains $i) { return "$($S.TunnelNet).$i" } }
  throw "No free IPs left in $($S.TunnelNet).0/24"
}
function Restart-Tunnel {
  Say 'Applying to the running tunnel'
  Restart-Service -Name $ServiceName -Force
}
function Write-QrPage($name) {
  $conf = Get-Content (Join-Path $ClientsDir "$name.conf") -Raw
  $json = $conf | ConvertTo-Json   # safely escaped JS string literal
  $html = @"
<!doctype html>
<html><head><meta charset="utf-8"><title>WireGuard - $name</title>
<style>
  body{font-family:system-ui,Segoe UI,sans-serif;background:#111;color:#eee;display:flex;flex-direction:column;align-items:center;padding:24px}
  #qr{background:#fff;padding:16px;border-radius:8px}
  pre{background:#222;padding:12px;border-radius:8px;font-size:12px;max-width:90vw;overflow:auto}
  p{max-width:520px;text-align:center;line-height:1.4}
</style></head><body>
<h2>WireGuard client: $name</h2>
<p>On the phone: open the <b>WireGuard</b> app &rarr; <b>+</b> &rarr; <b>Scan from QR code</b>.<br>
Anyone who scans this gets access to your VPN. Close this page when done.</p>
<div id="qr"></div>
<p style="opacity:.6">If the QR does not render (no internet on this PC), import the .conf file instead:<br>$ClientsDir\$name.conf</p>
<pre id="conf"></pre>
<script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
<script>
  var conf = $json;
  document.getElementById('conf').textContent = conf;
  new QRCode(document.getElementById('qr'), { text: conf, width: 360, height: 360, correctLevel: QRCode.CorrectLevel.L });
</script>
</body></html>
"@
  $page = Join-Path $ClientsDir "$name-qr.html"
  $html | Set-Content -Path $page -Encoding UTF8
  return $page
}

switch ($PSCmdlet.ParameterSetName) {

  'Add' {
    Assert-Name $Add
    if ((Get-ClientNames) -contains $Add) { throw "Client '$Add' already exists. Remove it first or pick another name." }
    $ip   = Get-NextFreeIp
    $priv = (& $WgExe genkey).Trim()
    $pub  = ($priv | & $WgExe pubkey).Trim()
    $psk  = (& $WgExe genpsk).Trim()

    Add-Content -Path $ConfPath -Encoding ASCII -Value @"

# BEGIN client $Add
[Peer]
PublicKey = $pub
PresharedKey = $psk
AllowedIPs = $ip/32
# END client $Add
"@

    $clientConf = Join-Path $ClientsDir "$Add.conf"
    @"
[Interface]
PrivateKey = $priv
Address = $ip/32
DNS = $($S.Dns)

[Peer]
PublicKey = $($S.ServerPub)
PresharedKey = $psk
Endpoint = $($S.Endpoint):$($S.Port)
AllowedIPs = 0.0.0.0/0, ::/0
PersistentKeepalive = 25
"@ | Set-Content -Path $clientConf -Encoding ASCII

    Restart-Tunnel
    $page = Write-QrPage $Add
    Say "Client '$Add' added with tunnel IP $ip"
    Write-Host "   Config file : $clientConf"
    Write-Host "   QR page     : $page"
    Write-Host ''
    Write-Host '   Phone : scan the QR page that just opened'
    Write-Host '   PC/Mac: copy the .conf to the machine -> WireGuard app -> Import tunnel(s) from file'
    Start-Process $page
  }

  'Qr' {
    Assert-Name $Qr
    if (-not (Test-Path (Join-Path $ClientsDir "$Qr.conf"))) { throw "No client named '$Qr'." }
    Start-Process (Write-QrPage $Qr)
  }

  'Remove' {
    Assert-Name $Remove
    if ((Get-ClientNames) -notcontains $Remove) { throw "No client named '$Remove'." }
    $lines = Get-Content $ConfPath
    $out = New-Object System.Collections.Generic.List[string]
    $skip = $false
    foreach ($l in $lines) {
      if ($l -eq "# BEGIN client $Remove") { $skip = $true; if ($out.Count -gt 0 -and $out[$out.Count-1] -eq '') { $out.RemoveAt($out.Count-1) } }
      if (-not $skip) { $out.Add($l) }
      if ($l -eq "# END client $Remove") { $skip = $false }
    }
    $out | Set-Content -Path $ConfPath -Encoding ASCII
    Remove-Item -Force -ErrorAction SilentlyContinue (Join-Path $ClientsDir "$Remove.conf"), (Join-Path $ClientsDir "$Remove-qr.html")
    Restart-Tunnel
    Say "Client '$Remove' removed"
  }

  default {
    Write-Host "Clients  (endpoint $($S.Endpoint):$($S.Port))"
    $clients = @{}; $order = @(); $cur = $null
    foreach ($l in Get-Content $ConfPath) {
      if ($l -match '^# BEGIN client ([A-Za-z0-9_-]+)$') { $cur = $Matches[1]; $order += $cur; $clients[$cur] = @{ Pub = ''; Ip = '' }; continue }
      if ($l -match '^# END client')                       { $cur = $null; continue }
      if ($cur -and $l -match '^PublicKey = (.+)$')        { $clients[$cur].Pub = $Matches[1].Trim() }
      if ($cur -and $l -match '^AllowedIPs = (.+)$')       { $clients[$cur].Ip  = $Matches[1].Trim() }
    }
    if ($order.Count -eq 0) { Write-Host '  none yet - run: .\Manage-Client.ps1 -Add phone'; break }
    $live = @{}
    try {
      (& $WgExe show wg0 dump) | Select-Object -Skip 1 | ForEach-Object {
        $f = $_ -split "`t"; if ($f.Count -ge 7) { $live[$f[0]] = $f }
      }
    } catch {}
    foreach ($n in $order) {
      $hs = 'never'; $rx = 0; $tx = 0
      $pub = $clients[$n].Pub
      if ($pub -and $live.ContainsKey($pub)) {
        $f = $live[$pub]
        if ([int64]$f[4] -gt 0) { $hs = ([DateTimeOffset]::FromUnixTimeSeconds([int64]$f[4])).LocalDateTime.ToString('yyyy-MM-dd HH:mm:ss') }
        $rx = [math]::Round([int64]$f[5] / 1MB, 1); $tx = [math]::Round([int64]$f[6] / 1MB, 1)
      }
      '  {0,-16} {1,-16} last handshake: {2,-20} down {3} MB  up {4} MB' -f $n, $clients[$n].Ip, $hs, $rx, $tx | Write-Host
    }
  }
}
