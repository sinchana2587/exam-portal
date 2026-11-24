# MIT Mysore EMS - PostgreSQL Database Initializer
param(
    [string]$PostgresUser = "postgres",
    [string]$PostgresPassword = "",
    [string]$AppUser = "campusexam",
    [string]$AppPassword = "password",
    [string]$Database = "campusexam_test",
    [string]$DbHost = "localhost",
    [int]$Port = 5432
)

Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " MAHARAJA INSTITUTE OF TECHNOLOGY MYSORE - EMS" -ForegroundColor Cyan
Write-Host " PostgreSQL Database Initializer (Development)" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Locate psql executable
$cmd = Get-Command psql.exe -ErrorAction SilentlyContinue
$psql = if ($cmd) { $cmd.Source } else { $null }
if (-not $psql) {
    $possiblePaths = Get-ChildItem "C:\Program Files\PostgreSQL\*\bin\psql.exe" -ErrorAction SilentlyContinue
    if ($possiblePaths) {
        $psql = if ($possiblePaths -is [array]) { $possiblePaths[-1].FullName } else { $possiblePaths.FullName }
    }
}

if (-not $psql -or -not (Test-Path $psql)) {
    Write-Host "[ERROR] 'psql.exe' was not found on PATH or in C:\Program Files\PostgreSQL\" -ForegroundColor Red
    Write-Host "Please ensure PostgreSQL is installed and add its bin directory (e.g. C:\Program Files\PostgreSQL\16\bin) to your PATH." -ForegroundColor Yellow
    exit 1
}

Write-Host "Found PostgreSQL CLI: $psql" -ForegroundColor Green

# 2. Check if PostgreSQL server is accepting connections
$tcpTest = Test-NetConnection -ComputerName $DbHost -Port $Port -WarningAction SilentlyContinue
if (-not $tcpTest.TcpTestSucceeded) {
    Write-Host "[ERROR] Could not connect to PostgreSQL on $DbHost`:$Port." -ForegroundColor Red
    Write-Host "Please ensure the PostgreSQL Windows service is started." -ForegroundColor Yellow
    exit 1
}

# 3. Check if application role can already connect
Write-Host "Checking application role '$AppUser'..." -ForegroundColor Yellow
$env:PGPASSWORD = $AppPassword
$appLoginTest = & $psql -U $AppUser -h $DbHost -p $Port -d postgres -t -c "SELECT 1;" 2>$null

if (-not ($appLoginTest -match '1')) {
    Write-Host "Role '$AppUser' cannot connect yet. Creating application role..." -ForegroundColor Yellow
    if (-not $PostgresPassword -and -not $env:PGPASSWORD) {
        $PostgresPassword = Read-Host "Enter PostgreSQL administrative password for user '$PostgresUser'"
    }
    $env:PGPASSWORD = if ($PostgresPassword) { $PostgresPassword } else { "password" }

    $createUserSql = "DO `$\$ BEGIN IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '$AppUser') THEN CREATE USER $AppUser WITH PASSWORD '$AppPassword' SUPERUSER; END IF; END `$\$;"
    & $psql -U $PostgresUser -h $DbHost -p $Port -d postgres -c $createUserSql 2>$null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERROR] Failed to create database user '$AppUser'. Please check the PostgreSQL administrative password." -ForegroundColor Red
        exit 1
    }
    Write-Host "[OK] Role '$AppUser' verified/created successfully." -ForegroundColor Green
} else {
    Write-Host "[OK] Role '$AppUser' already exists and authenticated." -ForegroundColor Green
}

# 4. Check if target database exists
Write-Host "Checking target database '$Database'..." -ForegroundColor Yellow
$env:PGPASSWORD = $AppPassword
$dbCheckSql = "SELECT 1 FROM pg_database WHERE datname = '$Database';"
$dbExists = & $psql -U $AppUser -h $DbHost -p $Port -d postgres -t -c $dbCheckSql 2>$null

if (-not ($dbExists -match '1')) {
    Write-Host "Creating database '$Database' owned by '$AppUser'..." -ForegroundColor Cyan
    $createDbSql = "CREATE DATABASE $Database OWNER $AppUser;"
    & $psql -U $AppUser -h $DbHost -p $Port -d postgres -c $createDbSql
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERROR] Failed to create database '$Database'." -ForegroundColor Red
        exit 1
    }
    Write-Host "[OK] Database '$Database' created successfully." -ForegroundColor Green
} else {
    Write-Host "[OK] Database '$Database' already exists." -ForegroundColor Green
}

# 5. Check if schema / tables already exist in target database (Idempotency & Data Preservation)
$accountCount = & $psql -U $AppUser -h $DbHost -p $Port -d $Database -t -c "SELECT count(*) FROM account;" 2>$null
if ($accountCount -match '\d+') {
    Write-Host "[OK] Database '$Database' is already initialized with existing data ($($accountCount.Trim()) active accounts loaded)." -ForegroundColor Green
    Write-Host "[OK] Existing tables, examination records and results were preserved without modification." -ForegroundColor Green
    Write-Host "Ready to launch all services via: .\start_all.ps1" -ForegroundColor Cyan
    exit 0
}

# 6. If database is fresh / empty, restore schema and seed dataset from database_dump.sql
$dumpFile = Join-Path $PSScriptRoot "CampusExam\database_dump.sql"
if (-not (Test-Path $dumpFile)) {
    Write-Host "[ERROR] Database dump file not found at: $dumpFile" -ForegroundColor Red
    exit 1
}

Write-Host "Restoring schema and development dataset into fresh database '$Database'..." -ForegroundColor Yellow
$env:PGPASSWORD = $AppPassword
& $psql -U $AppUser -h $DbHost -p $Port -d $Database -q -f $dumpFile 2>$null

# 7. Final verification of fresh restoration
$accountCountVerify = & $psql -U $AppUser -h $DbHost -p $Port -d $Database -t -c "SELECT count(*) FROM account;" 2>$null
if ($accountCountVerify -match '\d+') {
    Write-Host "[OK] Fresh database '$Database' initialized successfully! ($($accountCountVerify.Trim()) active accounts loaded)." -ForegroundColor Green
    Write-Host "Ready to launch all services via: .\start_all.ps1" -ForegroundColor Cyan
} else {
    Write-Host "[WARNING] Database restore completed, but account verification returned unexpected output. Please check logs." -ForegroundColor Yellow
}
