# MIT Mysore Examination Management System - Docker Launcher
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " MAHARAJA INSTITUTE OF TECHNOLOGY MYSORE - EMS" -ForegroundColor Cyan
Write-Host " Production Docker Launcher (All 6 Container Services)" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Ensure configuration exists
if (-not (Test-Path .env)) {
    if (Test-Path .env.example) {
        Write-Host "Creating .env from .env.example..." -ForegroundColor Yellow
        Copy-Item .env.example .env
    } else {
        Write-Host "[ERROR] .env or .env.example not found." -ForegroundColor Red
        exit 1
    }
}

# 2. Check for port conflicts with old host processes
$ports = @(8081, 8082, 3000, 3001, 3002)
foreach ($p in $ports) {
    $conns = Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue
    foreach ($c in $conns) {
        $pName = (Get-Process -Id $c.OwningProcess -ErrorAction SilentlyContinue).ProcessName
        if ($pName -eq "java" -or $pName -eq "node") {
            Write-Host "Terminating obsolete host process on port $p ($pName, PID $($c.OwningProcess))..." -ForegroundColor Yellow
            Stop-Process -Id $c.OwningProcess -Force -ErrorAction SilentlyContinue
        }
    }
}

# 3. Start Docker Compose Stack
Write-Host "Starting Docker Compose services..." -ForegroundColor Cyan
docker compose up -d

# 4. Display service status
Write-Host "`nWaiting for health status..." -ForegroundColor Yellow
Start-Sleep -Seconds 5
docker compose ps

Write-Host "`n==========================================================" -ForegroundColor Green
Write-Host " ALL SERVICES STARTED SUCCESSFULLY:" -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Green
Write-Host "  1. Central Backend (Java): http://localhost:8081" -ForegroundColor Cyan
Write-Host "  2. Lab Server (Offline):   http://localhost:8082" -ForegroundColor Cyan
Write-Host "  3. Admin/HOD Portal:       http://localhost:3000" -ForegroundColor Green
Write-Host "  4. COE Portal:             http://localhost:3001" -ForegroundColor Yellow
Write-Host "  5. Student Portal:         http://localhost:3002" -ForegroundColor Magenta
Write-Host "==========================================================" -ForegroundColor Green
Write-Host "To verify endpoints, run: python CampusExam/test_docker_stack.py" -ForegroundColor Cyan
Write-Host "To stop all services, run: .\docker_stop.ps1" -ForegroundColor Yellow
