param([switch]$BuildOnly)
$ErrorActionPreference = 'Stop'
Push-Location $PSScriptRoot
try {
    # Load .env configuration if present
    if (Test-Path "$PSScriptRoot\.env") {
        Get-Content "$PSScriptRoot\.env" | Where-Object { $_ -match '^\s*([^#=\s]+)\s*=\s*(.*)$' } | ForEach-Object {
            $name = $matches[1].Trim()
            $value = $matches[2].Trim()
            # Strip surrounding quotes if present
            if ($value -match '^["''](.*)["'']$') { $value = $matches[1] }
            [System.Environment]::SetEnvironmentVariable($name, $value, [System.EnvironmentVariableTarget]::Process)
        }
    }

    javac --release 17 -d build CampusExam.java
    if ($LASTEXITCODE -ne 0) { throw 'Java compilation failed' }
    if ($BuildOnly) { return }
    $driver = $env:PG_JDBC_JAR
    if (-not $driver) { $driver = 'lib/postgresql.jar' }
    if (-not (Test-Path -LiteralPath $driver -PathType Leaf)) {
        throw 'Place the PostgreSQL JDBC jar at lib/postgresql.jar or set PG_JDBC_JAR.'
    }
    java -cp "build;$driver" CampusExam
    if ($LASTEXITCODE -ne 0) { throw 'CampusExam stopped with an error' }
} finally {
    Pop-Location
}
