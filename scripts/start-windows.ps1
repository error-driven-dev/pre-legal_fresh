# Build and start Prelegal at http://localhost:8000 (database is recreated on every start).
$ErrorActionPreference = "Stop"
Set-Location (Split-Path $PSScriptRoot -Parent)

$ErrorActionPreference = "Continue"
docker info 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) { throw "Docker is not running. Start Docker Desktop and try again." }
$ErrorActionPreference = "Stop"

docker compose up -d --build
if ($LASTEXITCODE -ne 0) { throw "docker compose up failed." }

for ($i = 0; $i -lt 30; $i++) {
    try {
        $r = Invoke-RestMethod http://localhost:8000/api/health -TimeoutSec 2
        if ($r.status -eq "ok") { Write-Host "Prelegal is running at http://localhost:8000"; exit 0 }
    } catch { Start-Sleep -Seconds 1 }
}
throw "Prelegal did not become healthy. Run: docker compose logs"
