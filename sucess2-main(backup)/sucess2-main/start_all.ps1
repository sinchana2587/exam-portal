# MIT Mysore EMS - Unified System Launcher (Development)
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " MAHARAJA INSTITUTE OF TECHNOLOGY MYSORE - EMS" -ForegroundColor Cyan
Write-Host " Development Services Launcher (Central, Lab & 3 Portals)" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

$root = $PSScriptRoot
$backendRoot = Join-Path $root "CampusExam"

function Test-PortListening {
    param([int]$Port)
    $conns = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
    return ($null -ne $conns -and $conns.Count -gt 0)
}

# --- PREREQUISITE CHECKS ---
$javaCmd = Get-Command java -ErrorAction SilentlyContinue
$javacCmd = Get-Command javac -ErrorAction SilentlyContinue
if (-not $javaCmd -or -not $javacCmd) {
    Write-Host "[ERROR] Java Development Kit (JDK 17+) is required but 'java' or 'javac' was not found on PATH." -ForegroundColor Red
    Write-Host "Please install JDK 17 or higher and ensure it is added to your PATH environment variable." -ForegroundColor Yellow
    exit 1
}

$npmCmd = Get-Command npm.cmd -ErrorAction SilentlyContinue
if (-not $npmCmd) {
    $npmCmd = Get-Command npm -ErrorAction SilentlyContinue
}
if (-not $npmCmd) {
    Write-Host "[ERROR] Node.js & npm are required but 'npm' was not found on PATH." -ForegroundColor Red
    Write-Host "Please install Node.js (v18+ or v20+ LTS) from https://nodejs.org/" -ForegroundColor Yellow
    exit 1
}

# PostgreSQL Reachability Warning
if (-not (Test-PortListening 5432)) {
    Write-Host "[WARNING] PostgreSQL does not appear to be running on port 5432." -ForegroundColor Yellow
    Write-Host "If Central Backend fails to connect, please ensure PostgreSQL is started and database is initialized with .\init_database.ps1" -ForegroundColor Yellow
}

# --- STEP 1: AUTOMATIC JAVA COMPILATION ---
$classFile1 = Join-Path $backendRoot "build_dev\CampusExam.class"
$classFile2 = Join-Path $backendRoot "build_dev\LabServer.class"

if (-not (Test-Path $classFile1) -or -not (Test-Path $classFile2)) {
    Write-Host "Compiled Java classes not found. Compiling Central Backend and Lab Server..." -ForegroundColor Yellow
    if (-not (Test-Path "$backendRoot\build_dev")) {
        New-Item -ItemType Directory -Path "$backendRoot\build_dev" | Out-Null
    }
    Push-Location $backendRoot
    try {
        & javac -cp "lib/postgresql.jar;src" -d build_dev CampusExam.java LabServer.java
        if ($LASTEXITCODE -ne 0) {
            Write-Host "[ERROR] Java compilation failed. Please verify JDK 17+ is installed." -ForegroundColor Red
            exit 1
        }
        Write-Host "[OK] Central Backend and Lab Server compiled successfully." -ForegroundColor Green
    } finally {
        Pop-Location
    }
} else {
    Write-Host "[OK] Compiled Java classes verified in build_dev" -ForegroundColor Green
}

# --- STEP 2: ENSURE PORTAL DEPENDENCIES ---
function Ensure-PortalDependencies {
    param([string]$PortalDir, [string]$PortalName)
    $nmPath = Join-Path $PortalDir "node_modules"
    if (-not (Test-Path $nmPath)) {
        Write-Host "Missing node_modules for $PortalName. Installing dependencies via package-lock.json..." -ForegroundColor Yellow
        Push-Location $PortalDir
        try {
            & npm.cmd ci --prefer-offline --no-audit
            if ($LASTEXITCODE -ne 0) {
                Write-Host "npm ci failed, falling back to npm install..." -ForegroundColor Yellow
                & npm.cmd install --no-audit
            }
            Write-Host "[OK] Dependencies installed for $PortalName." -ForegroundColor Green
        } finally {
            Pop-Location
        }
    }
}

Ensure-PortalDependencies "$root\admin-portal (7)" "Admin/HOD Portal"
Ensure-PortalDependencies "$root\coe-portal (7)" "COE Portal"
Ensure-PortalDependencies "$root\student-portal (Final)\student-portal (Final)\student-portal" "Student Portal"

# --- STEP 3: START CENTRAL JAVA BACKEND (Port 8081) ---
if (Test-PortListening 8081) {
    Write-Host "[OK] Central Java Backend is already running on port 8081" -ForegroundColor Green
} else {
    Write-Host "Starting Central Java Backend on port 8081..." -ForegroundColor Yellow
    $centralCmd = "`$env:DB_URL='jdbc:postgresql://localhost:5432/campusexam_test'; `$env:DB_USER='campusexam'; `$env:DB_PASSWORD='password'; `$env:PORT='8081'; `$env:BIND='127.0.0.1'; `$env:LAB_SERVER_URL='http://127.0.0.1:8082'; cd '$backendRoot'; Write-Host '=== CENTRAL BACKEND (Port 8081) ===' -ForegroundColor Cyan; java -cp 'build_dev;lib/postgresql.jar;src' CampusExam"
    Start-Process powershell -ArgumentList "-ExecutionPolicy", "Bypass", "-NoExit", "-Command", $centralCmd
    Start-Sleep -Seconds 2
}

# --- STEP 4: START INDEPENDENT LAB SERVER (Port 8082) ---
if (Test-PortListening 8082) {
    Write-Host "[OK] Independent Lab Server is already running on port 8082" -ForegroundColor Green
} else {
    Write-Host "Starting Independent Lab Server on port 8082..." -ForegroundColor Yellow
    $labCmd = "`$env:PORT='8082'; `$env:BIND='127.0.0.1'; `$env:LAB_ID='LAB-CSE-01'; `$env:CENTRAL_URL='http://127.0.0.1:8081'; cd '$backendRoot'; Write-Host '=== INDEPENDENT LAB SERVER (Port 8082) ===' -ForegroundColor Cyan; java -cp 'build_dev' LabServer"
    Start-Process powershell -ArgumentList "-ExecutionPolicy", "Bypass", "-NoExit", "-Command", $labCmd
    Start-Sleep -Seconds 2
}

# --- STEP 5: START ADMIN / HOD PORTAL (Port 3000) ---
if (Test-PortListening 3000) {
    Write-Host "[OK] Admin/HOD Portal is already running on port 3000" -ForegroundColor Green
} else {
    Write-Host "Starting Admin/HOD Portal on port 3000..." -ForegroundColor Yellow
    $adminCmd = "`$env:VITE_API_BASE_URL='http://127.0.0.1:8081/api/v1'; cd '$root\admin-portal (7)'; Write-Host '=== ADMIN/HOD PORTAL (Port 3000) ===' -ForegroundColor Green; npm.cmd run dev -- --port 3000 --host 127.0.0.1"
    Start-Process powershell -ArgumentList "-ExecutionPolicy", "Bypass", "-NoExit", "-Command", $adminCmd
}

# --- STEP 6: START COE PORTAL (Port 3001) ---
if (Test-PortListening 3001) {
    Write-Host "[OK] COE Portal is already running on port 3001" -ForegroundColor Green
} else {
    Write-Host "Starting COE Portal on port 3001..." -ForegroundColor Yellow
    $coeCmd = "`$env:VITE_API_BASE_URL='http://127.0.0.1:8081/api/v1'; `$env:VITE_LAB_API_BASE_URL='http://127.0.0.1:8082/lab-api'; cd '$root\coe-portal (7)'; Write-Host '=== COE PORTAL (Port 3001) ===' -ForegroundColor Yellow; npm.cmd run dev -- --port 3001 --host 127.0.0.1"
    Start-Process powershell -ArgumentList "-ExecutionPolicy", "Bypass", "-NoExit", "-Command", $coeCmd
}

# --- STEP 7: START STUDENT PORTAL (Port 3002) ---
if (Test-PortListening 3002) {
    Write-Host "[OK] Student Portal is already running on port 3002" -ForegroundColor Green
} else {
    Write-Host "Starting Student Portal on port 3002..." -ForegroundColor Yellow
    $studentCmd = "`$env:VITE_API_URL='http://127.0.0.1:8082'; `$env:VITE_LAB_API_BASE_URL='http://127.0.0.1:8082'; cd '$root\student-portal (Final)\student-portal (Final)\student-portal'; Write-Host '=== STUDENT PORTAL (Port 3002) ===' -ForegroundColor Magenta; npm.cmd run dev -- --port 3002 --host 127.0.0.1"
    Start-Process powershell -ArgumentList "-ExecutionPolicy", "Bypass", "-NoExit", "-Command", $studentCmd
}

Write-Host ""
Write-Host "==========================================================" -ForegroundColor Green
Write-Host " ALL FIVE SERVICES CONFIGURED ON DEDICATED PORTS:" -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Green
Write-Host "  1. Central Backend (Java): http://127.0.0.1:8081  (campusexam_test)" -ForegroundColor Cyan
Write-Host "  2. Lab Server (Offline):   http://127.0.0.1:8082  (LAB-CSE-01)" -ForegroundColor Cyan
Write-Host "  3. Admin/HOD Portal:       http://localhost:3000  (Principal & HOD)" -ForegroundColor Green
Write-Host "  4. COE Portal:             http://localhost:3001  (Controller of Examinations)" -ForegroundColor Yellow
Write-Host "  5. Student Portal:         http://localhost:3002  (Student Examination Runtime)" -ForegroundColor Magenta
Write-Host "==========================================================" -ForegroundColor Green
Write-Host "To stop all services later, run: .\stop_all.ps1" -ForegroundColor Yellow
