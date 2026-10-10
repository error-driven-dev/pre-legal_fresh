# Run every lint, type, test and build check. Run this before declaring any change done.
$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent

function Step($name, $dir, $cmd) {
    Write-Host "==> $name" -ForegroundColor Cyan
    Push-Location (Join-Path $root $dir)
    $rest = $cmd[1..($cmd.Length - 1)]
    try { & $cmd[0] @rest; if ($LASTEXITCODE -ne 0) { throw "$name failed" } }
    finally { Pop-Location }
}

Step "backend: ruff"   "backend"  @("uv", "run", "ruff", "check", ".")
Step "backend: mypy"   "backend"  @("uv", "run", "mypy", "app", "tests")
Step "backend: pytest" "backend"  @("uv", "run", "pytest", "-q")
Step "frontend: api types up to date" "frontend" @("npm", "run", "gen:api:check")
Step "frontend: eslint"    "frontend" @("npm", "run", "lint")
Step "frontend: tsc"       "frontend" @("npm", "run", "typecheck")
Step "frontend: vitest"    "frontend" @("npm", "test")
Step "frontend: build"     "frontend" @("npm", "run", "build")
Write-Host "All checks passed." -ForegroundColor Green
