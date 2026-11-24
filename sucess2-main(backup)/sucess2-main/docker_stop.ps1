# MIT Mysore Examination Management System - Docker Stopper
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force

Write-Host "Stopping all MIT Mysore EMS Docker services..." -ForegroundColor Yellow
docker compose stop
Write-Host "All Docker containers stopped cleanly. Persistent data and keys preserved." -ForegroundColor Green
