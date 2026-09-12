# dev-stop.ps1 — Arret de l'environnement SPOK
# Usage : pnpm dev:stop
# Note : PostgreSQL reste actif (partage entre projets)

Write-Host "Arret des processus SPOK (API + Web)..." -ForegroundColor Cyan

$freed = 0
foreach ($port in @(3000, 3001)) {
    $connections = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
    if ($connections) {
        $procIds = $connections | Select-Object -ExpandProperty OwningProcess -Unique
        foreach ($procId in $procIds) {
            $proc = Get-Process -Id $procId -ErrorAction SilentlyContinue
            if ($proc -and $proc.ProcessName -eq "node") {
                Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
                Write-Host "  Port ${port}: PID $procId (node) arrete" -ForegroundColor Yellow
                $freed++
            }
        }
    }
}

if ($freed -gt 0) {
    Write-Host "$freed processus arretes" -ForegroundColor Green
} else {
    Write-Host "Aucun processus SPOK en cours" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "PostgreSQL reste actif (partage entre projets)" -ForegroundColor DarkGray
Write-Host "Pour l'arreter : docker compose -f docker/docker-compose.dev.yml down" -ForegroundColor DarkGray
