param(
    [string]$ServerHost,
    [int]$Port = 5432,
    [string]$Database = "campusexam",
    [string]$User = "campusexam",
    [string]$Password = ""
)

$envPath = "$PSScriptRoot\.env"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " MIT Mysore CampusExam - College Server Database Setup" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

if (-not $ServerHost) {
    $ServerHost = Read-Host "Enter College Server IP / Hostname (e.g. 10.130.125.x or 192.168.x.x)"
}

if (-not $ServerHost) {
    Write-Host "Error: Server IP or hostname is required." -ForegroundColor Red
    exit 1
}

$portInput = Read-Host "Enter PostgreSQL Port [Default: $Port]"
if ($portInput -and $portInput.Trim() -ne "") { $Port = [int]$portInput.Trim() }

$dbInput = Read-Host "Enter Database Name [Default: $Database]"
if ($dbInput -and $dbInput.Trim() -ne "") { $Database = $dbInput.Trim() }

$userInput = Read-Host "Enter Database User [Default: $User]"
if ($userInput -and $userInput.Trim() -ne "") { $User = $userInput.Trim() }

if (-not $Password) {
    $Password = Read-Host "Enter Database Password" -AsSecureString
    $BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($Password)
    $Password = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)
}

Write-Host "`nTesting network connection to $ServerHost on port $Port..." -ForegroundColor Yellow
$testResult = Test-NetConnection -ComputerName $ServerHost -Port $Port -WarningAction SilentlyContinue

if ($testResult.TcpTestSucceeded) {
    Write-Host " SUCCESS: Reached $ServerHost on port $Port!" -ForegroundColor Green
} else {
    Write-Host " WARNING: Could not connect to $ServerHost on port $Port." -ForegroundColor Red
    Write-Host " Please check if you are connected to the college Wi-Fi/LAN and the PostgreSQL service is accepting connections." -ForegroundColor Yellow
}

$dbUrl = "jdbc:postgresql://${ServerHost}:${Port}/${Database}"

$envContent = @"
# MIT Mysore CampusExam College Server Configuration
DB_URL=$dbUrl
DB_USER=$User
DB_PASSWORD=$Password
BOOTSTRAP_USER=admin
BOOTSTRAP_PASSWORD=password1234
"@

Set-Content -Path $envPath -Value $envContent -Encoding UTF8
Write-Host "`n Configuration saved to $envPath" -ForegroundColor Green
Write-Host "DB_URL = $dbUrl" -ForegroundColor Cyan
Write-Host "DB_USER = $User" -ForegroundColor Cyan
Write-Host "`nYou can now launch CampusExam with start-campusexam.bat" -ForegroundColor Green
