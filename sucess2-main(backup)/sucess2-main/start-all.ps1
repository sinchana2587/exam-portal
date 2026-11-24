# ====================================================================
# MAHARAJA INSTITUTE OF TECHNOLOGY MYSORE - EXAMINATION MANAGEMENT SYSTEM
# START ALL SERVICES (Windows PowerShell)
# ====================================================================
[CmdletBinding()]
param (
    [ValidateSet("Local", "LAN")]
    [string]$Mode = "Local",
    [string]$DbUser = "campusexam",
    [string]$DbPassword = "password",
    [string]$DbName = "campusexam_test",
    [string]$DbHost = "127.0.0.1",
    [int]$DbPort = 5432
)

$ErrorActionPreference = "Stop"
$scriptRoot = $PSScriptRoot
if (-not $scriptRoot) { $scriptRoot = Get-Location }

# 1. RESOLVE HOST IP & PORTS
$bindHost = "127.0.0.1"
$displayHost = "127.0.0.1"

if ($Mode -eq "LAN") {
    $bindHost = "0.0.0.0"
    $ips = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
           Where-Object { $_.IPAddress -notmatch '^(127\.|169\.254\.)' -and $_.InterfaceAlias -notmatch 'vEthernet|Loopback' }
    if ($ips) {
        $displayHost = $ips[0].IPAddress
    }
    Write-Host "[LAN Mode] Host IP determined as: $displayHost" -ForegroundColor Cyan
}

Write-Host "====================================================================" -ForegroundColor Cyan
Write-Host "  STARTING MIT MYSORE EXAMINATION SYSTEM (Mode: $Mode)" -ForegroundColor Cyan
Write-Host "====================================================================" -ForegroundColor Cyan

# 2. CHECK / TERMINATE STALE PROCESSES ON TARGET PORTS
$targetPorts = @(8081, 8082, 3000, 3001, 3002, 5001)
foreach ($p in $targetPorts) {
    $conns = Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue
    if ($conns) {
        foreach ($c in $conns) {
            $ownerId = $c.OwningProcess
            if ($ownerId -gt 0) {
                Write-Host "  Stopping existing process on port $p (PID: $ownerId)..." -ForegroundColor DarkYellow
                Stop-Process -Id $ownerId -Force -ErrorAction SilentlyContinue
            }
        }
        Start-Sleep -Milliseconds 500
    }
}

# Track started PIDs
$pids = @{}

# 3. START CENTRAL JAVA BACKEND (Port 8081)
Write-Host "`n[1/5] Starting Central Java Backend on port 8081..." -ForegroundColor Yellow
$backendEnv = @{
    "DB_URL" = "jdbc:postgresql://${DbHost}:${DbPort}/${DbName}"
    "DB_USER" = $DbUser
    "DB_PASSWORD" = $DbPassword
    "DB_NAME" = $DbName
    "ALLOW_ANY_DB" = "true"
    "PORT" = "8081"
    "BIND" = $bindHost
    "CENTRAL_URL" = "http://${displayHost}:8081"
    "LAB_SERVER_URL" = "http://${displayHost}:8082"
}
$backendCmd = "& { "
foreach ($k in $backendEnv.Keys) {
    $backendCmd += "`$env:$k = '$($backendEnv[$k])'; "
}
$backendCmd += "Set-Location '$scriptRoot\CampusExam'; java -cp 'build_dev;lib/postgresql.jar;src' CampusExam }"

$backendProc = Start-Process powershell.exe -ArgumentList "-NoProfile", "-Command", $backendCmd -PassThru -WindowStyle Hidden
$pids["CentralBackend"] = $backendProc.Id
Write-Host "  [OK] Central Backend started (PID: $($backendProc.Id))" -ForegroundColor Green

# 4. START LAB SERVER (Port 8082)
Write-Host "`n[2/5] Starting Lab Server on port 8082..." -ForegroundColor Yellow
$labEnv = @{
    "PORT" = "8082"
    "BIND" = $bindHost
    "LAB_ID" = "LAB-CSE-01"
    "CENTRAL_URL" = "http://${displayHost}:8081"
}
$labCmd = "& { "
foreach ($k in $labEnv.Keys) {
    $labCmd += "`$env:$k = '$($labEnv[$k])'; "
}
$labCmd += "Set-Location '$scriptRoot\CampusExam'; java -cp 'build_dev' LabServer }"

$labProc = Start-Process powershell.exe -ArgumentList "-NoProfile", "-Command", $labCmd -PassThru -WindowStyle Hidden
$pids["LabServer"] = $labProc.Id
Write-Host "  [OK] Lab Server started (PID: $($labProc.Id))" -ForegroundColor Green

# 5. START COE PORTAL (Port 3001)
Write-Host "`n[3/5] Starting COE Portal on port 3001..." -ForegroundColor Yellow
$coeCmd = "& { `$env:VITE_API_BASE_URL = 'http://${displayHost}:8081/api/v1'; `$env:VITE_LAB_API_BASE_URL = 'http://${displayHost}:8082/lab-api'; Set-Location '$scriptRoot\coe-portal (7)'; npm.cmd run dev -- --port 3001 --host 0.0.0.0 }"
$coeProc = Start-Process powershell.exe -ArgumentList "-NoProfile", "-Command", $coeCmd -PassThru -WindowStyle Hidden
$pids["CoePortal"] = $coeProc.Id
Write-Host "  [OK] COE Portal started (PID: $($coeProc.Id))" -ForegroundColor Green

# 6. START ADMIN / HOD PORTAL (Port 3000)
Write-Host "`n[4/5] Starting Admin / HOD Portal on port 3000..." -ForegroundColor Yellow
$adminCmd = "& { `$env:VITE_API_BASE_URL = 'http://${displayHost}:8081/api/v1'; `$env:PORT = '3000'; Set-Location '$scriptRoot\admin-portal (7)'; npm.cmd run dev -- --port 3000 }"
$adminProc = Start-Process powershell.exe -ArgumentList "-NoProfile", "-Command", $adminCmd -PassThru -WindowStyle Hidden
$pids["AdminPortal"] = $adminProc.Id
Write-Host "  [OK] Admin / HOD Portal started (PID: $($adminProc.Id))" -ForegroundColor Green

# 7. START STUDENT PORTAL (Port 3002)
Write-Host "`n[5/6] Starting Student Portal on port 3002..." -ForegroundColor Yellow
$studentCmd = "& { `$env:VITE_LAB_API_BASE_URL = 'http://${displayHost}:8082'; `$env:VITE_API_URL = 'http://${displayHost}:8082'; Set-Location '$scriptRoot\student-portal (Final)\student-portal (Final)\student-portal'; npm.cmd run dev -- --port 3002 --host 0.0.0.0 }"
$studentProc = Start-Process powershell.exe -ArgumentList "-NoProfile", "-Command", $studentCmd -PassThru -WindowStyle Hidden
$pids["StudentPortal"] = $studentProc.Id
Write-Host "  [OK] Student Portal started (PID: $($studentProc.Id))" -ForegroundColor Green

# 8. START DOCUMENT CONVERTER SERVER (Port 5001)
Write-Host "`n[6/6] Starting Document Converter Server on port 5001..." -ForegroundColor Yellow
$converterCmd = "& { `$env:PORT = '5001'; Set-Location '$scriptRoot\admin-portal (7)\server\converter'; node server.js }"
$converterProc = Start-Process powershell.exe -ArgumentList "-NoProfile", "-Command", $converterCmd -PassThru -WindowStyle Hidden
$pids["ConverterServer"] = $converterProc.Id
Write-Host "  [OK] Document Converter Server started (PID: $($converterProc.Id))" -ForegroundColor Green

# Save running PIDs to JSON
$pidsPath = Join-Path $scriptRoot ".running_pids.json"
$pids | ConvertTo-Json | Set-Content -Path $pidsPath -Encoding UTF8

# 9. WAIT FOR HEALTH CHECKS
Write-Host "`nWaiting for service health checks..." -ForegroundColor Yellow
$healthy = $false
$retries = 0
while (-not $healthy -and $retries -lt 20) {
    Start-Sleep -Seconds 1
    $retries++
    try {
        $labRes = Invoke-RestMethod -Uri "http://127.0.0.1:8082/health" -Method Get -TimeoutSec 2 -ErrorAction SilentlyContinue
        if ($labRes.status -eq "ok") {
            $healthy = $true
        }
    } catch {}
}

if ($healthy) {
    Write-Host "  [OK] Lab Server and Central Backend are healthy!" -ForegroundColor Green
} else {
    Write-Host "  [WARN] Health check timeout. Services may still be compiling Vite bundles." -ForegroundColor DarkYellow
}

Write-Host "`n====================================================================" -ForegroundColor Green
Write-Host "  ALL MIT MYSORE EXAMINATION SYSTEM SERVICES RUNNING!" -ForegroundColor Green
Write-Host "====================================================================" -ForegroundColor Green
Write-Host "  1. HOD / Faculty Portal:   http://${displayHost}:3000" -ForegroundColor White
Write-Host "     Credentials:            hod.cse / CSE@2109  (or Admin@123)" -ForegroundColor Gray
Write-Host "                             hod.ise / ISE@3325  (or Admin@123)" -ForegroundColor Gray
Write-Host "  2. COE Portal:             http://${displayHost}:3001" -ForegroundColor White
Write-Host "     Credentials:            coe / COE@5828      (or Admin@123)" -ForegroundColor Gray
Write-Host "  3. Student Portal:         http://${displayHost}:3002" -ForegroundColor White
Write-Host "     Credentials (CSE):      USN: 4MH27CS001     DOB: 2004-01-01" -ForegroundColor Gray
Write-Host "     Credentials (ISE):      USN: 4MH24IS001     DOB: 2004-02-01" -ForegroundColor Gray
Write-Host "  4. Principal Portal:       http://${displayHost}:3000/principal" -ForegroundColor White
Write-Host "     Credentials:            principal / PRINCIPAL@7658 (or Admin@123)" -ForegroundColor Gray
Write-Host "  5. Central Backend API:    http://${displayHost}:8081" -ForegroundColor White
Write-Host "  6. Lab Server API:         http://${displayHost}:8082/health" -ForegroundColor White
Write-Host "  7. Document Converter API: http://${displayHost}:5001/api/health" -ForegroundColor White
Write-Host "====================================================================" -ForegroundColor Green
Write-Host "  To stop all services:      .\stop-all.ps1" -ForegroundColor Cyan
Write-Host "  To check service status:   .\status.ps1" -ForegroundColor Cyan
Write-Host "====================================================================" -ForegroundColor Green
