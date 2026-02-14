# dev-start.ps1 — Démarrage complet de l'environnement SPOK (Docker)
# Usage : pnpm dev:start

# Déterminer le répertoire racine du projet (parent de scripts/)
$projectRoot = Split-Path -Parent $PSScriptRoot

# Déterminer le repo principal (pour copier les .env en worktree)
$mainRepo = $projectRoot
if ($projectRoot -match '\.claude[/\\]worktrees[/\\]') {
    $mainRepo = ($projectRoot -split '\.claude[/\\]worktrees')[0].TrimEnd('/\')
}

Write-Host "[1/5] Verification Docker..." -ForegroundColor Cyan
$dockerInfo = docker info 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "  Docker n'est pas lance. Demarre Docker Desktop d'abord." -ForegroundColor Red
    exit 1
}
Write-Host "  OK" -ForegroundColor Green

Write-Host "[2/5] Verification des fichiers .env..." -ForegroundColor Cyan
$envFiles = @(
    @{ target = ".env"; source = ".env" }
)
$envCopied = 0
foreach ($envFile in $envFiles) {
    $targetPath = Join-Path $projectRoot $envFile.target
    $sourcePath = Join-Path $mainRepo $envFile.source
    if (-not (Test-Path $targetPath)) {
        if (($mainRepo -ne $projectRoot) -and (Test-Path $sourcePath)) {
            Copy-Item $sourcePath $targetPath
            Write-Host "  $($envFile.target) copie depuis le repo principal" -ForegroundColor Yellow
            $envCopied++
        } else {
            Write-Host "  $($envFile.target) MANQUANT - copie .env.example et configure-le" -ForegroundColor Red
            exit 1
        }
    }
}
if ($envCopied -eq 0) {
    Write-Host "  OK" -ForegroundColor Green
}

Write-Host "[3/5] Arret des conteneurs existants..." -ForegroundColor Cyan
Push-Location $projectRoot
docker compose -f docker/docker-compose.dev.yml down 2>&1 | Out-Null
Write-Host "  OK" -ForegroundColor Green

Write-Host "[4/5] Demarrage des conteneurs Docker..." -ForegroundColor Cyan
docker compose -f docker/docker-compose.dev.yml up -d --build
if ($LASTEXITCODE -ne 0) {
    Write-Host "  Echec du demarrage Docker" -ForegroundColor Red
    Pop-Location
    exit 1
}
Write-Host "  Conteneurs lances" -ForegroundColor Green

Write-Host "[5/5] Attente de l'API (health check)..." -ForegroundColor Cyan
$maxRetries = 30
for ($i = 1; $i -le $maxRetries; $i++) {
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:3001/health" -UseBasicParsing -TimeoutSec 3 -ErrorAction Stop
        if ($response.StatusCode -eq 200) {
            Write-Host "  API prete !" -ForegroundColor Green
            break
        }
    } catch {
        if ($i -eq $maxRetries) {
            Write-Host "  API non disponible apres ${maxRetries} tentatives" -ForegroundColor Red
            Write-Host "  Consultez les logs : pnpm dev:logs:api" -ForegroundColor Yellow
            Pop-Location
            exit 1
        }
        Write-Host "  Attente... ($i/${maxRetries})" -ForegroundColor Yellow
        Start-Sleep -Seconds 3
    }
}

Pop-Location

Write-Host ""
Write-Host "=== SPOK Dev Environment ===" -ForegroundColor Green
Write-Host "  Web:      http://localhost:3000" -ForegroundColor White
Write-Host "  API:      http://localhost:3001" -ForegroundColor White
Write-Host "  Postgres: localhost:25432" -ForegroundColor White
Write-Host "  Debug:    localhost:9229" -ForegroundColor White
Write-Host ""
Write-Host "  Logs:     pnpm dev:logs" -ForegroundColor DarkGray
Write-Host "  Logs API: pnpm dev:logs:api" -ForegroundColor DarkGray
Write-Host "  Logs Web: pnpm dev:logs:web" -ForegroundColor DarkGray
Write-Host "  Stop:     pnpm dev:stop" -ForegroundColor DarkGray
