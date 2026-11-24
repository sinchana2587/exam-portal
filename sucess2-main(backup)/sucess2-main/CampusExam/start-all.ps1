# CampusExam Multi-Portal Startup Script
$root = $PSScriptRoot

# 1. Start Java Backend
Start-Process powershell -ArgumentList "-NoExit", "-ExecutionPolicy", "Bypass", "-Command", "Set-Location -LiteralPath '$root'; .\run.ps1"

# 2. Start Admin Portal on Port 3000
Start-Process powershell -ArgumentList "-NoExit", "-ExecutionPolicy", "Bypass", "-Command", "Set-Location -LiteralPath '$root\frontend\admin-portal'; `$env:PORT=3000; npm run dev"

# 3. Start CoE Portal on Port 3001
Start-Process powershell -ArgumentList "-NoExit", "-ExecutionPolicy", "Bypass", "-Command", "Set-Location -LiteralPath '$root\frontend\coe-portal'; `$env:PORT=3001; npm run dev"

# 4. Start Student Portal on Port 3002
Start-Process powershell -ArgumentList "-NoExit", "-ExecutionPolicy", "Bypass", "-Command", "Set-Location -LiteralPath '$root\frontend\student-portal (Final)'; `$env:PORT=3002; npm run dev"

Write-Host "Launched Backend (8080) + Admin (3000), CoE (3001), and Student (3002) in separate windows." -ForegroundColor Green
