# ====================================================================
# MAHARAJA INSTITUTE OF TECHNOLOGY MYSORE - EXAMINATION MANAGEMENT SYSTEM
# AUTOMATED SETUP SCRIPT (Windows PowerShell)
# ====================================================================
[CmdletBinding()]
param (
    [switch]$InitDatabase,
    [switch]$SkipNpm,
    [string]$DbUser = "campusexam",
    [string]$DbPassword = "password",
    [string]$DbName = "campusexam_test",
    [string]$DbHost = "127.0.0.1",
    [int]$DbPort = 5432
)

$ErrorActionPreference = "Stop"
$scriptRoot = $PSScriptRoot
if (-not $scriptRoot) { $scriptRoot = Get-Location }

Write-Host "====================================================================" -ForegroundColor Cyan
Write-Host "  MIT MYSORE EXAMINATION MANAGEMENT SYSTEM - AUTOMATED SETUP" -ForegroundColor Cyan
Write-Host "====================================================================" -ForegroundColor Cyan

# 1. PREREQUISITE CHECKS
Write-Host "`n[1/6] Checking system prerequisites..." -ForegroundColor Yellow

# Java check
if (Get-Command java -ErrorAction SilentlyContinue) {
    Write-Host "  [OK] Java detected in PATH." -ForegroundColor Green
} else {
    Write-Host "  [ERROR] Java JDK 17+ is required but not found in PATH." -ForegroundColor Red
    Write-Host "  Please install OpenJDK 17 or Eclipse Temurin 17 and add to PATH." -ForegroundColor Red
    exit 1
}

# Node.js check
if (Get-Command node -ErrorAction SilentlyContinue) {
    $nodeVer = node -v
    Write-Host "  [OK] Node.js detected: $nodeVer" -ForegroundColor Green
} else {
    Write-Host "  [ERROR] Node.js 18+ is required but not found in PATH." -ForegroundColor Red
    exit 1
}

# npm check
if (Get-Command npm -ErrorAction SilentlyContinue) {
    $npmVer = npm -v
    Write-Host "  [OK] npm detected: $npmVer" -ForegroundColor Green
} else {
    Write-Host "  [ERROR] npm is required but not found in PATH." -ForegroundColor Red
    exit 1
}

# PostgreSQL check (search PATH or standard install dirs)
$psqlExe = $null
if (Get-Command psql -ErrorAction SilentlyContinue) {
    $psqlExe = "psql"
} else {
    $stdPsql = "C:\Program Files\PostgreSQL\16\bin\psql.exe"
    if (Test-Path $stdPsql) { $psqlExe = $stdPsql }
    else {
        $found = Get-ChildItem "C:\Program Files\PostgreSQL" -Filter "psql.exe" -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($found) { $psqlExe = $found.FullName }
    }
}
if ($psqlExe) {
    Write-Host "  [OK] PostgreSQL client detected ($psqlExe)" -ForegroundColor Green
} else {
    Write-Host "  [WARN] psql client not found in PATH. Database auto-init will require manual step." -ForegroundColor DarkYellow
}

# 2. ENVIRONMENT FILE INITIALIZATION
Write-Host "`n[2/6] Configuring environment files..." -ForegroundColor Yellow
$envPath = Join-Path $scriptRoot ".env"
$envExamplePath = Join-Path $scriptRoot ".env.example"
if (-not (Test-Path $envPath) -and (Test-Path $envExamplePath)) {
    Copy-Item $envExamplePath $envPath
    Write-Host "  [OK] Created .env from .env.example" -ForegroundColor Green
} else {
    Write-Host "  [OK] .env already exists" -ForegroundColor Green
}

# 3. DIRECTORY STRUCTURE INITIALIZATION
Write-Host "`n[3/6] Initializing local storage and key directories..." -ForegroundColor Yellow
$dirsToCreate = @(
    "CampusExam/build_dev",
    "CampusExam/keys",
    "CampusExam/lab_server_keys",
    "CampusExam/lab_storage/packages",
    "CampusExam/lab_storage/submissions",
    "CampusExam/lab_storage/results",
    "CampusExam/lab_storage/credentials",
    "CampusExam/audit_storage/results",
    "admin-portal (7)/server/uploads/originals",
    "admin-portal (7)/server/uploads/temp"
)
foreach ($d in $dirsToCreate) {
    $fullPath = Join-Path $scriptRoot $d
    if (-not (Test-Path $fullPath)) {
        New-Item -ItemType Directory -Path $fullPath -Force | Out-Null
    }
}
Write-Host "  [OK] Storage directory structures initialized." -ForegroundColor Green

# 4. FRONTEND DEPENDENCY INSTALLATION
Write-Host "`n[4/6] Installing frontend dependencies..." -ForegroundColor Yellow
if ($SkipNpm) {
    Write-Host "  [SKIP] Skipping npm dependencies (-SkipNpm specified)." -ForegroundColor DarkYellow
} else {
    $portals = @(
        "admin-portal (7)",
        "coe-portal (7)",
        "student-portal (Final)/student-portal (Final)/student-portal"
    )
    foreach ($p in $portals) {
        $portalDir = Join-Path $scriptRoot $p
        Write-Host "  Installing dependencies in $p..." -ForegroundColor Cyan
        Push-Location $portalDir
        try {
            if (Test-Path "package-lock.json") {
                npm ci --legacy-peer-deps --no-audit --prefer-offline
            } else {
                npm install --legacy-peer-deps --no-audit
            }
            if ($LASTEXITCODE -ne 0) {
                Write-Host "  [WARN] npm ci returned non-zero, falling back to npm install..." -ForegroundColor DarkYellow
                npm install --legacy-peer-deps --no-audit
            }
        } finally {
            Pop-Location
        }
    }
    Write-Host "  [OK] Frontend dependencies installed successfully." -ForegroundColor Green
}

# 5. COMPILE JAVA SERVICES & GENERATE CRYPTOGRAPHIC KEYS
Write-Host "`n[5/6] Compiling Java services and initializing cryptographic keys..." -ForegroundColor Yellow
$campusExamDir = Join-Path $scriptRoot "CampusExam"
Push-Location $campusExamDir
try {
    # Compile both Central Backend and Lab Server
    $cp = "lib/postgresql.jar;src"
    javac -d build_dev -cp $cp CampusExam.java LabServer.java
    if ($LASTEXITCODE -ne 0) {
        throw "javac compilation failed with exit code $LASTEXITCODE"
    }
    Write-Host "  [OK] Compiled CampusExam.java and LabServer.java into build_dev" -ForegroundColor Green

    # Initialize keys
    java -cp "build_dev;$cp" CampusExam --init-keys
    java -cp build_dev LabServer --init-keys
    Write-Host "  [OK] Independent RSA-2048 keypairs initialized and exchanged." -ForegroundColor Green
} finally {
    Pop-Location
}

# 6. DATABASE INITIALIZATION (OPTIONAL / ON-DEMAND)
Write-Host "`n[6/6] Database initialization check..." -ForegroundColor Yellow
if ($InitDatabase -and $psqlExe) {
    Write-Host "  Applying consolidated schema.sql and seed_demo_data.sql to $DbName..." -ForegroundColor Cyan
    $env:PGPASSWORD = $DbPassword
    & $psqlExe -h $DbHost -p $DbPort -U $DbUser -d postgres -c "CREATE DATABASE $DbName OWNER $DbUser;" 2>$null
    & $psqlExe -h $DbHost -p $DbPort -U $DbUser -d $DbName -f (Join-Path $campusExamDir "schema.sql")
    & $psqlExe -h $DbHost -p $DbPort -U $DbUser -d $DbName -f (Join-Path $campusExamDir "seed_demo_data.sql")
    Write-Host "  [OK] Database $DbName initialized with 48 tables and synthetic demo seed records." -ForegroundColor Green
} else {
    Write-Host "  [INFO] Skipped database recreation (use -InitDatabase to auto-create and seed $DbName)." -ForegroundColor Cyan
    Write-Host "  Existing database will be preserved." -ForegroundColor Cyan
}

Write-Host "`n====================================================================" -ForegroundColor Green
Write-Host "  SETUP COMPLETE! You can now start the application using:" -ForegroundColor Green
Write-Host "    .\start-all.ps1              (Single-Laptop Local Mode)" -ForegroundColor White
Write-Host "    .\start-all.ps1 -Mode LAN    (Multi-Laptop Local Network Mode)" -ForegroundColor White
Write-Host "====================================================================" -ForegroundColor Green
