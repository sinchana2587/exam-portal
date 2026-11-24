# ====================================================================
# MAHARAJA INSTITUTE OF TECHNOLOGY MYSORE - EXAMINATION MANAGEMENT SYSTEM
# STOP ALL SERVICES (Windows PowerShell)
# ====================================================================
[CmdletBinding()]
param ()

$ErrorActionPreference = "SilentlyContinue"
$scriptRoot = $PSScriptRoot
if (-not $scriptRoot) { $scriptRoot = Get-Location }

Write-Host "Stopping all MIT Mysore Examination System services..." -ForegroundColor Yellow

# 1. Stop tracked PIDs from .running_pids.json
$pidsPath = Join-Path $scriptRoot ".running_pids.json"
if (Test-Path $pidsPath) {
    try {
        $pidsJson = Get-Content $pidsPath -Raw | ConvertFrom-Json
        foreach ($prop in $pidsJson.PSObject.Properties) {
            $pidToStop = $prop.Value
            if ($pidToStop -and ($pidToStop -is [int] -or $pidToStop -is [long])) {
                Stop-Process -Id $pidToStop -Force -ErrorAction SilentlyContinue
                # Also kill child processes of this powershell wrapper
                Get-CimInstance Win32_Process | Where-Object { $_.ParentProcessId -eq $pidToStop } | ForEach-Object {
                    Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
                }
            }
        }
        Remove-Item $pidsPath -Force -ErrorAction SilentlyContinue
    } catch {}
}

# 2. Stop any remaining processes listening on target ports (8081, 8082, 3000, 3001, 3002, 5001)
$targetPorts = @(8081, 8082, 3000, 3001, 3002, 5001)
foreach ($port in $targetPorts) {
    $connections = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
    if ($connections) {
        foreach ($conn in $connections) {
            $procId = $conn.OwningProcess
            if ($procId -gt 0) {
                Write-Host "  Stopping process $procId listening on port $port..." -ForegroundColor DarkYellow
                Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
            }
        }
    }
}

Write-Host "[OK] All MIT Mysore Examination System services stopped cleanly." -ForegroundColor Green
