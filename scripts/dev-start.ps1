# dev-start.ps1 — Démarrage complet de l'environnement SPOK
# Usage : pnpm dev:start

Write-Host "[1/4] Verification Docker..." -ForegroundColor Cyan
$dockerInfo = docker info 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "  Docker n'est pas lance. Demarre Docker Desktop d'abord." -ForegroundColor Red
    exit 1
}
Write-Host "  OK" -ForegroundColor Green

Write-Host "[2/4] Demarrage PostgreSQL (port 25432)..." -ForegroundColor Cyan
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

Write-Host "[3/4] Liberation des ports 3000/3001..." -ForegroundColor Cyan
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

Write-Host "[4/4] Lancement pnpm dev..." -ForegroundColor Cyan
Write-Host ""
pnpm dev
