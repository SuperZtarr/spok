# dev-start.ps1 — Démarrage complet de l'environnement SPOK
# Usage : pnpm dev:start

# Déterminer le répertoire racine du projet (parent de scripts/)
$projectRoot = Split-Path -Parent $PSScriptRoot

# Déterminer le repo principal (pour copier les .env en worktree)
# Remonte depuis .claude/worktrees/<name> vers la racine du repo
$mainRepo = $projectRoot
if ($projectRoot -match '\.claude[/\\]worktrees[/\\]') {
    $mainRepo = ($projectRoot -split '\.claude[/\\]worktrees')[0].TrimEnd('/\')
}

Write-Host "[1/7] Verification Docker..." -ForegroundColor Cyan
$dockerInfo = docker info 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "  Docker n'est pas lance. Demarre Docker Desktop d'abord." -ForegroundColor Red
    exit 1
}
Write-Host "  OK" -ForegroundColor Green

Write-Host "[2/7] Demarrage PostgreSQL (port 25432)..." -ForegroundColor Cyan
$null = docker compose -f docker/docker-compose.dev.yml up -d postgres 2>&1
# Attendre que le conteneur soit healthy
$maxRetries = 15
for ($i = 1; $i -le $maxRetries; $i++) {
    $health = docker inspect --format='{{.State.Health.Status}}' spok-postgres-dev 2>$null
    if ($health -eq "healthy") {
        Write-Host "  PostgreSQL ready" -ForegroundColor Green
        break
    }
    if ($i -eq $maxRetries) {
        Write-Host "  PostgreSQL non disponible apres ${maxRetries}s" -ForegroundColor Red
        exit 1
    }
    Write-Host "  Attente... ($i/${maxRetries})" -ForegroundColor Yellow
    Start-Sleep -Seconds 1
}

Write-Host "[3/7] Liberation des ports 3000/3001..." -ForegroundColor Cyan
$ports = @(3000, 3001)
$freed = 0
foreach ($port in $ports) {
    $connections = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
    if ($connections) {
        $pids = $connections | Select-Object -ExpandProperty OwningProcess -Unique
        foreach ($pid in $pids) {
            $proc = Get-Process -Id $pid -ErrorAction SilentlyContinue
            if ($proc -and $proc.ProcessName -eq "node") {
                Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
                Write-Host "  Port ${port}: PID $pid (node) arrete" -ForegroundColor Yellow
                $freed++
            } else {
                Write-Host "  Port ${port}: PID $pid ($($proc.ProcessName)) ignore (pas node)" -ForegroundColor DarkGray
            }
        }
    }
}
if ($freed -eq 0) {
    Write-Host "  Ports libres" -ForegroundColor Green
} else {
    Start-Sleep -Seconds 1
}

Write-Host "[4/7] Verification des fichiers .env..." -ForegroundColor Cyan
$envFiles = @(
    @{ target = ".env"; source = ".env" },
    @{ target = "apps/api/.env"; source = "apps/api/.env" },
    @{ target = "apps/web/.env"; source = "apps/web/.env" }
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
        }
    }
}
if ($envCopied -eq 0) {
    Write-Host "  OK" -ForegroundColor Green
}

Write-Host "[5/7] Verification node_modules..." -ForegroundColor Cyan
if (-not (Test-Path (Join-Path $projectRoot "node_modules"))) {
    Write-Host "  node_modules absent, installation..." -ForegroundColor Yellow
    pnpm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  Echec pnpm install" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "  OK" -ForegroundColor Green
}

Write-Host "[6/7] Verification Prisma client..." -ForegroundColor Cyan
$prismaClientPath = Join-Path $projectRoot "node_modules/.pnpm/@prisma+client@*/node_modules/@prisma/client/default.js"
$prismaExists = Get-Item $prismaClientPath -ErrorAction SilentlyContinue
if (-not $prismaExists) {
    Write-Host "  Prisma client absent, generation..." -ForegroundColor Yellow
    pnpm db:generate
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  Echec pnpm db:generate" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "  OK" -ForegroundColor Green
}

Write-Host "[7/7] Lancement pnpm dev..." -ForegroundColor Cyan
Write-Host ""
pnpm dev
