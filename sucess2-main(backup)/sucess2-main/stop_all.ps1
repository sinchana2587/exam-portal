# MIT Mysore EMS - Unified System Stopper (Development)
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force

Write-Host "Stopping all MIT Mysore EMS development services..." -ForegroundColor Yellow

# Terminate only development ports: 8081 (Central), 8082 (Lab Server), 3000 (Admin), 3001 (COE), 3002 (Student)
# Port 8080 belongs to the production environment and is strictly excluded from termination
$ports = @(8081, 8082, 3000, 3001, 3002)
foreach ($p in $ports) {
    $conns = Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue
    foreach ($c in $conns) {
        if ($c.OwningProcess -gt 0) {
            Write-Host "Terminating process on port $p (PID $($c.OwningProcess))..." -ForegroundColor Red
            Stop-Process -Id $c.OwningProcess -Force -ErrorAction SilentlyContinue
        }
    }
}

Write-Host "All local development ports (8081, 8082, 3000, 3001, 3002) are now free." -ForegroundColor Green
