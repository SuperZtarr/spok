# dev-start.ps1 — Demarrage de l'environnement SPOK
# Usage : pnpm dev:start

$projectRoot = Split-Path -Parent $PSScriptRoot

# En worktree, copier les .env depuis le repo principal
$mainRepo = $projectRoot
if ($projectRoot -match '\.claude[/\\]worktrees[/\\]') {
    $mainRepo = ($projectRoot -split '\.claude[/\\]worktrees')[0].TrimEnd('/\')
}

Write-Host "[1/4] Verification Docker..." -ForegroundColor Cyan
$dockerInfo = docker info 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "  Docker n'est pas lance. Demarre Docker Desktop d'abord." -ForegroundColor Red
    exit 1
}
Write-Host "  OK" -ForegroundColor Green

Write-Host "[2/4] Verification .env..." -ForegroundColor Cyan
$targetPath = Join-Path $projectRoot ".env"
$sourcePath = Join-Path $mainRepo ".env"
if (-not (Test-Path $targetPath)) {
    if (($mainRepo -ne $projectRoot) -and (Test-Path $sourcePath)) {
        Copy-Item $sourcePath $targetPath
        Write-Host "  .env copie depuis le repo principal" -ForegroundColor Yellow
    } else {
        Write-Host "  .env MANQUANT - copie .env.example et configure-le" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "  OK" -ForegroundColor Green
}

Write-Host "[3/4] Demarrage PostgreSQL (Docker)..." -ForegroundColor Cyan
Push-Location $projectRoot
docker compose -f docker/docker-compose.dev.yml up -d
Pop-Location
if ($LASTEXITCODE -ne 0) {
    Write-Host "  Echec du demarrage PostgreSQL" -ForegroundColor Red
    exit 1
}
Write-Host "  PostgreSQL pret sur localhost:25432" -ForegroundColor Green

Write-Host "[4/4] Liberation des ports 3000/3001 (si occupes par SPOK)..." -ForegroundColor Cyan
$freed = 0
foreach ($port in @(3000, 3001)) {
    $connections = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
    if ($connections) {
        $pids = $connections | Select-Object -ExpandProperty OwningProcess -Unique
        foreach ($pid in $pids) {
            $proc = Get-Process -Id $pid -ErrorAction SilentlyContinue
            if ($proc -and $proc.ProcessName -eq "node") {
                Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
                Write-Host "  Port ${port}: PID $pid (node) arrete" -ForegroundColor Yellow
                $freed++
            }
        }
    }
}
if ($freed -eq 0) {
    Write-Host "  Ports libres" -ForegroundColor Green
} else {
    Write-Host "  $freed processus arretes" -ForegroundColor Green
}

Write-Host ""
Write-Host "=== SPOK Dev ===" -ForegroundColor Green
Write-Host "  Postgres: localhost:25432" -ForegroundColor White
Write-Host ""
Write-Host "Lancement de l'API + Web..." -ForegroundColor Cyan
Write-Host ""

Set-Location $projectRoot
pnpm dev
