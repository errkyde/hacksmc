# =============================================================================
# start.ps1 — HackSMC starten (Windows 11)
#
# Entwicklungsmodus: Backend (Spring Boot) + Frontend (Vite) in separaten
# Terminalfenstern starten.
#
# Secrets zuruecksetzen: .\start.ps1 --reconfigure
# =============================================================================
param([switch]$Reconfigure)

$Root       = Split-Path -Parent $MyInvocation.MyCommand.Path
$ConfigFile = Join-Path $Root "config.env"

# Sicherstellt, dass das Script mit PowerShell 5.1+ laeuft
if ($PSVersionTable.PSVersion.Major -lt 5) {
    Write-Error "PowerShell 5.1 oder neuer wird benoetigt."
    exit 1
}

# ── Hilfsfunktionen ───────────────────────────────────────────────────────────
function Write-Info    ($msg) { Write-Host "  -> $msg" -ForegroundColor Cyan }
function Write-Success ($msg) { Write-Host "  OK $msg" -ForegroundColor Green }
function Write-Header  ($msg) { Write-Host "`n$msg" -ForegroundColor White }
function Read-Secret   ($prompt) {
    $ss = Read-Host $prompt -AsSecureString
    return [System.Net.NetworkCredential]::new("", $ss).Password
}
function New-RandomSecret {
    $bytes = [byte[]]::new(36)
    [System.Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
    return [System.Convert]::ToBase64String($bytes)
}

# ── Reconfigure-Flag ──────────────────────────────────────────────────────────
if ($Reconfigure -or ($args -contains "--reconfigure")) {
    Remove-Item -Force $ConfigFile -ErrorAction SilentlyContinue
    Write-Host "Konfiguration (Secrets) zurueckgesetzt."
}

# =============================================================================
# DATENBANK-WAHL
# =============================================================================
Write-Host ""
Write-Host "============================================="
Write-Host "  HackSMC -- Start (Windows)"
Write-Host "============================================="
Write-Host ""
Write-Host "Welche Datenbank soll verwendet werden?"
Write-Host "  1) H2         (lokal, kein Server noetig)  [empfohlen]"
Write-Host "  2) PostgreSQL (vorhandener Server)"
Write-Host ""
$dbChoice = Read-Host "Auswahl [1/2]"
$DbMode = if ($dbChoice -eq "2") { "postgres" } else { "h2" }

# =============================================================================
# SECRETS: nur beim ersten Mal (oder nach --reconfigure) abfragen
# =============================================================================
if (-not (Test-Path $ConfigFile)) {
    Write-Host ""
    Write-Host "============================================="
    Write-Host "  Erstkonfiguration -- Secrets"
    Write-Host "============================================="

    $lines = [System.Collections.Generic.List[string]]::new()

    if ($DbMode -eq "postgres") {
        Write-Header "PostgreSQL"
        $v = Read-Host "  DB_HOST      [localhost]"; $lines.Add("DB_HOST=$(if ($v) { $v } else { 'localhost' })")
        $v = Read-Host "  DB_PORT      [5432]";      $lines.Add("PORT_POSTGRES=$(if ($v) { $v } else { '5432' })")
        $v = Read-Host "  DB_NAME      [hacksmc]";   $lines.Add("DB_NAME=$(if ($v) { $v } else { 'hacksmc' })")
        $v = Read-Host "  DB_USER      [hacksmc]";   $lines.Add("DB_USER=$(if ($v) { $v } else { 'hacksmc' })")
        $v = Read-Secret "  DB_PASSWORD"; $lines.Add("DB_PASSWORD=$v")
    }

    Write-Header "JWT"
    $v = Read-Host "  JWT_SECRET (Enter = Zufallswert)"
    if (-not $v) {
        $v = New-RandomSecret
        Write-Info "Generiert: $v"
    }
    $lines.Add("JWT_SECRET=$v")

    Write-Header "pfSense"
    $v = Read-Host "  Base-URL  [https://pfsense.local]"
    $lines.Add("PFSENSE_BASE_URL=$(if ($v) { $v } else { 'https://pfsense.local' })")
    $v = Read-Secret "  API-Key"
    $lines.Add("PFSENSE_API_KEY=$(if ($v) { $v } else { 'dummy-dev-key' })")
    $v = Read-Host "  TLS-Zertifikat ignorieren? [j/N]"
    $lines.Add("PFSENSE_TRUST_ALL_CERTS=$(if ($v -match '^[jJ]$') { 'true' } else { 'false' })")

    $lines.Add("JWT_EXPIRATION_MS=3600000")

    $lines | Set-Content -Path $ConfigFile -Encoding UTF8
    Write-Host ""
    Write-Success "Secrets gespeichert -> config.env"
    Write-Info    "Zuruecksetzen mit: .\start.ps1 --reconfigure"
    Write-Host ""
}

# =============================================================================
# KONFIGURATION LADEN
# =============================================================================
Get-Content $ConfigFile | ForEach-Object {
    if ($_ -match '^([A-Za-z_][A-Za-z0-9_]*)=(.*)$') {
        Set-Item -Path "env:$($Matches[1])" -Value $Matches[2]
    }
}

# H2-Defaults (kein echtes Secret noetig)
if ($DbMode -eq "h2") {
    if (-not $env:JWT_SECRET)      { $env:JWT_SECRET      = "hacksmc-h2-dev-secret-key-minimum-32-chars!" }
    if (-not $env:PFSENSE_API_KEY) { $env:PFSENSE_API_KEY = "dummy-h2-dev-key" }
}

# =============================================================================
# ENTWICKLUNGS-MODUS
# =============================================================================
$dbLabel = if ($DbMode -eq "h2") { "H2 (lokal)" } else { "PostgreSQL" }

Write-Host ""
Write-Host "============================================="
Write-Host "  HackSMC -- Entwicklungsmodus"
Write-Host "============================================="
Write-Info "Datenbank  -> $dbLabel"
Write-Info "Backend    -> http://localhost:3000"
Write-Info "Frontend   -> http://localhost:5173"
Write-Info "Swagger    -> http://localhost:3000/api/swagger-ui"
if ($DbMode -eq "h2") { Write-Info "H2-Konsole -> http://localhost:3000/h2-console" }
Write-Host ""
Write-Info "Backend und Frontend starten in separaten Fenstern."
Write-Info "Ctrl+C in diesem Fenster beendet beide Prozesse."
Write-Host ""

# Maven-Kommando je nach DB-Modus
$mvnArgs = if ($DbMode -eq "h2") {
    "spring-boot:run -Dspring-boot.run.profiles=h2"
} else {
    "spring-boot:run"
}

# Backend starten (neues cmd-Fenster, erbt aktuelle Umgebungsvariablen)
$backendProc = Start-Process -FilePath "cmd.exe" `
    -ArgumentList "/k", "title HackSMC Backend && cd /d `"$Root\backend`" && mvn $mvnArgs" `
    -PassThru

Start-Sleep -Milliseconds 500

# Frontend starten (neues cmd-Fenster)
$frontendProc = Start-Process -FilePath "cmd.exe" `
    -ArgumentList "/k", "title HackSMC Frontend && cd /d `"$Root\frontend`" && npm run dev" `
    -PassThru

Write-Success "Backend  gestartet (PID $($backendProc.Id))"
Write-Success "Frontend gestartet (PID $($frontendProc.Id))"
Write-Host ""

# Auf Ctrl+C warten, dann beide Prozesse (inkl. Kindprozesse) beenden
try {
    while (-not $backendProc.HasExited -and -not $frontendProc.HasExited) {
        Start-Sleep -Milliseconds 500
    }
} finally {
    Write-Host "`nStopping..."
    foreach ($proc in @($backendProc, $frontendProc)) {
        if ($proc -and -not $proc.HasExited) {
            # taskkill beendet den kompletten Prozessbaum (cmd + Java/node)
            & taskkill /F /T /PID $proc.Id 2>$null
        }
    }
    Write-Host "Beendet."
}
