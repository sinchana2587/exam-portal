# ====================================================================
# MAHARAJA INSTITUTE OF TECHNOLOGY MYSORE - EXAMINATION MANAGEMENT SYSTEM
# SERVICE STATUS CHECK (Windows PowerShell)
# ====================================================================
[CmdletBinding()]
param ()

$ErrorActionPreference = "SilentlyContinue"

Write-Host "====================================================================" -ForegroundColor Cyan
Write-Host "  MIT MYSORE EXAMINATION SYSTEM - LIVE SERVICE STATUS" -ForegroundColor Cyan
Write-Host "====================================================================" -ForegroundColor Cyan

$services = @(
    @{ Name = "PostgreSQL Database"; Port = 5432; CheckUrl = $null },
    @{ Name = "Central Java Backend"; Port = 8081; CheckUrl = "http://127.0.0.1:8081/monitoring/health" },
    @{ Name = "Independent Lab Server"; Port = 8082; CheckUrl = "http://127.0.0.1:8082/health" },
    @{ Name = "HOD / Faculty Portal"; Port = 3000; CheckUrl = "http://127.0.0.1:3000" },
    @{ Name = "COE Examination Portal"; Port = 3001; CheckUrl = "http://127.0.0.1:3001" },
    @{ Name = "Student Examination Portal"; Port = 3002; CheckUrl = "http://127.0.0.1:3002" },
    @{ Name = "Document Converter API"; Port = 5001; CheckUrl = "http://127.0.0.1:5001/api/health" }
)

foreach ($s in $services) {
    $conn = Get-NetTCPConnection -LocalPort $s.Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($conn) {
        $statusStr = "LISTENING (PID: $($conn.OwningProcess))"
        $statusColor = "Green"
        if ($s.CheckUrl) {
            try {
                $res = Invoke-RestMethod -Uri $s.CheckUrl -TimeoutSec 2 -ErrorAction SilentlyContinue
                if ($res -and ($res.status -eq "ok" -or $res.status -eq "UP")) {
                    $statusStr += " - HEALTHY"
                }
            } catch {}
        }
        Write-Host ("  {0,-28} [Port {1,4}]: {2}" -f $s.Name, $s.Port, $statusStr) -ForegroundColor $statusColor
    } else {
        Write-Host ("  {0,-28} [Port {1,4}]: STOPPED" -f $s.Name, $s.Port) -ForegroundColor Red
    }
}
Write-Host "====================================================================" -ForegroundColor Cyan
