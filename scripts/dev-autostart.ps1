# dev-autostart.ps1 — Watcher de démarrage à froid de l'environnement SPOK
#
# Raison d'être : lancé en arrière-plan par le hook SessionStart (session-start-hook.ps1)
#   uniquement quand le dev server n'est pas déjà actif. Enchaîne :
#     1. attend que le démon Docker réponde (Docker Desktop met ~60s à démarrer)
#     2. lance `pnpm dev:start` (Postgres + API + Web) sans bloquer
#     3. attend que les ports servent du 200 (readiness réelle, pas un simple délai)
#     4. ouvre le navigateur sur l'app
#
# Règles d'usage :
#   - Ne pas appeler à la main : passer par `pnpm dev:start` pour un démarrage manuel.
#   - `pnpm dev:start` est détaché (Start-Process) : `pnpm dev:stop` l'arrête par port.
#   - Ouverture navigateur inconditionnelle (un onglet à chaque démarrage à froid).
#   - Une seule méthode pour Chrome, aucun fallback en cascade.

$ErrorActionPreference = 'Continue'

# --- 1. Attente du démon Docker ---
$maxWait = 120
$elapsed = 0
while ($elapsed -lt $maxWait) {
    Start-Sleep -Seconds 5
    $elapsed += 5
    $null = & docker ps 2>&1
    if ($LASTEXITCODE -eq 0) { break }
}
if ($LASTEXITCODE -ne 0) {
    Write-Host "dev-autostart: Docker toujours indisponible apres ${maxWait}s - abandon" -ForegroundColor Red
    exit 1
}

# --- 2. Lancement de la stack (non bloquant) ---
Start-Process pnpm -ArgumentList 'dev:start' -WorkingDirectory 'C:/_dev/spok' -WindowStyle Hidden

# --- 3. Attente de la readiness (ports qui servent du 200) ---
$webUrl    = 'http://localhost:3000'
$apiUrl    = 'http://localhost:3001/health'
$deadline  = (Get-Date).AddSeconds(180)
$ready     = $false

while ((Get-Date) -lt $deadline) {
    Start-Sleep -Seconds 3
    try {
        $web = (Invoke-WebRequest -Uri $webUrl -UseBasicParsing -TimeoutSec 3).StatusCode
        $api = (Invoke-WebRequest -Uri $apiUrl -UseBasicParsing -TimeoutSec 3).StatusCode
        if ($web -eq 200 -and $api -eq 200) { $ready = $true; break }
    } catch { }
}

if (-not $ready) {
    Write-Host "dev-autostart: stack pas prete apres 180s - navigateur non ouvert" -ForegroundColor Yellow
    exit 1
}

# --- 4. Ouverture du navigateur (inconditionnelle, une seule methode) ---
$chrome = @(
    "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
    "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe"
) | Where-Object { Test-Path $_ } | Select-Object -First 1

if ($chrome) {
    Start-Process $chrome $webUrl
} else {
    Write-Host "dev-autostart: Chrome introuvable - ouvrir $webUrl manuellement" -ForegroundColor Yellow
}
