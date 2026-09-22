# Start Stackly locally against MySQL + Spring Boot + Vite (no mock data).
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

$env:SPRING_PROFILES_ACTIVE = 'dev'
$env:DB_HOST = 'localhost'
$env:DB_PORT = '3306'
$env:DB_NAME = 'stackly_pms'
$env:DB_USERNAME = 'stackly'
$env:DB_PASSWORD = 'change_me'
$env:JWT_SECRET = 'local_dev_jwt_secret_replace_with_a_long_random_secret_at_least_64_chars_xx'

Write-Host 'Building backend...' -ForegroundColor Cyan
Push-Location backend
mvn -q -DskipTests package
if ($LASTEXITCODE -ne 0) { throw 'Backend build failed' }
Start-Process -FilePath 'java' -ArgumentList '-jar', '.\target\pms-0.1.0.jar' -WorkingDirectory (Get-Location)
Pop-Location

Write-Host 'Starting frontend (VITE_USE_MOCK=false)...' -ForegroundColor Cyan
Push-Location frontend
Start-Process -FilePath 'npm' -ArgumentList 'run', 'dev', '--', '--host', '127.0.0.1', '--port', '5173' -WorkingDirectory (Get-Location)
Pop-Location

# Bootstrap: creates the Scrum Master + one starter project + the SCRUM_MASTER assignment
# on the first run, then returns "Already seeded". Safe to call on every start.
Write-Host 'Waiting for backend, then bootstrapping the first Scrum Master...' -ForegroundColor Cyan
$seeded = $false
for ($i = 0; $i -lt 40; $i++) {
    Start-Sleep -Seconds 2
    try {
        $res = Invoke-RestMethod -Uri 'http://localhost:8080/api/seed/first-run' -Method Post -ContentType 'application/json' -Body '{}' -TimeoutSec 8
        Write-Host "Seed: $($res.message)" -ForegroundColor Green
        $seeded = $true
        break
    } catch {
        if ($_.Exception.Response) { $seeded = $true; break }
    }
}
if (-not $seeded) { Write-Host 'Seed skipped: backend not reachable yet. Run POST /api/seed/first-run manually.' -ForegroundColor Yellow }

Write-Host ''
Write-Host 'Backend:  http://localhost:8080'
Write-Host 'Frontend: http://127.0.0.1:5173'
Write-Host 'Login:    aerrapothuapurwa@thestackly.com / Password@123'
