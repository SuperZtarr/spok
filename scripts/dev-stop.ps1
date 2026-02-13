# dev-stop.ps1 — Arret propre de l'environnement SPOK
# Usage : pnpm dev:stop

Write-Host "Arret des processus SPOK..." -ForegroundColor Cyan

$ports = @(3000, 3001)
$stopped = 0
foreach ($port in $ports) {
    $connections = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
    if ($connections) {
        $pids = $connections | Select-Object -ExpandProperty OwningProcess -Unique
        foreach ($p in $pids) {
            $proc = Get-Process -Id $p -ErrorAction SilentlyContinue
            if ($proc -and $proc.ProcessName -eq "node") {
                Stop-Process -Id $p -Force -ErrorAction SilentlyContinue
                Write-Host "  Port ${port}: PID $p (node) arrete" -ForegroundColor Yellow
                $stopped++
            } else {
                Write-Host "  Port ${port}: PID $p ($($proc.ProcessName)) ignore (pas node)" -ForegroundColor DarkGray
            }
        }
    }
}

if ($stopped -eq 0) {
    Write-Host "  Aucun processus SPOK en cours" -ForegroundColor Green
} else {
    Write-Host "  $stopped processus arretes" -ForegroundColor Green
}
