# dev-stop.ps1 — Arrêt de l'environnement SPOK (Docker)
# Usage : pnpm dev:stop

# Déterminer le répertoire racine du projet (parent de scripts/)
$projectRoot = Split-Path -Parent $PSScriptRoot

Write-Host "Arret des conteneurs SPOK..." -ForegroundColor Cyan

Push-Location $projectRoot
docker compose -f docker/docker-compose.dev.yml down
Pop-Location

if ($LASTEXITCODE -eq 0) {
    Write-Host "Conteneurs arretes" -ForegroundColor Green
} else {
    Write-Host "Erreur lors de l'arret des conteneurs" -ForegroundColor Red

    # Fallback : tuer les processus node sur les ports 3000/3001
    Write-Host "Tentative de liberation des ports..." -ForegroundColor Yellow
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
                }
            }
        }
    }
    if ($freed -gt 0) {
        Write-Host "$freed processus arretes" -ForegroundColor Green
    }
}
