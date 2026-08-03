#!/usr/bin/env pwsh
# ----------------------------------------------------------------------
#  Orcha Agent OS - One-Command Bootstrap Script
#
#  Usage:  .\setup.ps1            (full setup from scratch)
#          .\setup.ps1 -SkipBuild (skip Docker image rebuild)
#          .\setup.ps1 -SkipDeps  (skip npm install)
#
#  This script reads secrets from .env at runtime - nothing is hardcoded.
# ----------------------------------------------------------------------
param(
    [switch]$SkipBuild,
    [switch]$SkipDeps
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

# -- Helpers --------------------------------------------------------------

function Write-Step($n, $msg) {
    Write-Host ""
    Write-Host "========================================================" -ForegroundColor Cyan
    Write-Host "  Step $n - $msg" -ForegroundColor Cyan
    Write-Host "========================================================" -ForegroundColor Cyan
}

function Write-Ok($msg)   { Write-Host "  [OK] $msg" -ForegroundColor Green }
function Write-Info($msg) { Write-Host "  [..] $msg" -ForegroundColor Gray }
function Write-Warn($msg) { Write-Host "  [!!] $msg" -ForegroundColor Yellow }

function Load-EnvFile {
    <# Reads .env into a hashtable (no export to process env - just returns values). #>
    $envVars = @{}
    if (Test-Path ".env") {
        Get-Content ".env" | ForEach-Object {
            $line = $_.Trim()
            if ($line -and -not $line.StartsWith("#")) {
                $eqIdx = $line.IndexOf("=")
                if ($eqIdx -gt 0) {
                    $key = $line.Substring(0, $eqIdx).Trim()
                    $val = $line.Substring($eqIdx + 1).Trim().Trim('"').Trim("'")
                    $envVars[$key] = $val
                }
            }
        }
    } else {
        Write-Host "  [FAIL] .env file not found! Please create one first." -ForegroundColor Red
        exit 1
    }
    return $envVars
}

function Wait-ForHealthy($service, $timeoutSec = 120) {
    <# Polls docker compose until a service is healthy. #>
    Write-Info "Waiting for '$service' to become healthy (timeout: ${timeoutSec}s)..."
    $elapsed = 0
    while ($elapsed -lt $timeoutSec) {
        $status = docker compose ps $service --format "{{.Health}}" 2>$null
        if ($status -match "healthy") {
            Write-Ok "'$service' is healthy."
            return
        }
        Start-Sleep -Seconds 3
        $elapsed += 3
    }
    Write-Host "  [FAIL] Timed out waiting for '$service' to become healthy." -ForegroundColor Red
    exit 1
}

$CONVEX_CLI = "node_modules\convex\bin\main.js"
$CONVEX_URL = "http://localhost:3210"

# -- Pre-flight -----------------------------------------------------------

Write-Host ""
Write-Host "Orcha Agent OS - Automated Setup" -ForegroundColor Magenta
Write-Host "---------------------------------------" -ForegroundColor DarkGray

# Ensure we're in the project root
if (-not (Test-Path "package.json")) {
    Write-Host "[FAIL] Run this script from the repository root (where package.json lives)." -ForegroundColor Red
    exit 1
}

# Load .env values
$env_vars = Load-EnvFile
$ENCRYPTION_KEY    = $env_vars["ENCRYPTION_KEY"]
$CLERK_ISSUER      = $env_vars["CLERK_ISSUER_DOMAIN"]

if (-not $ENCRYPTION_KEY) {
    Write-Warn "ENCRYPTION_KEY not found in .env - Convex will not be able to decrypt database credentials."
}
if (-not $CLERK_ISSUER) {
    Write-Warn "CLERK_ISSUER_DOMAIN not found in .env - Convex auth will not work."
}

# -- Step 1: Install Dependencies -----------------------------------------

if (-not $SkipDeps) {
    Write-Step 1 "Installing Node.js Dependencies"
    pnpm install --frozen-lockfile 2>$null
    if ($LASTEXITCODE -ne 0) {
        Write-Info "pnpm failed or not available, falling back to npm..."
        npm install
    }
    Write-Ok "Dependencies installed."
} else {
    Write-Info "Skipping dependency install (-SkipDeps)."
}

# -- Step 2: Start Docker Infrastructure ----------------------------------

Write-Step 2 "Starting Docker Infrastructure"
if ($SkipBuild) {
    docker compose up -d
} else {
    docker compose up -d --build
}
Write-Ok "Docker containers starting."

# -- Step 3: Wait for Backend Health --------------------------------------

Write-Step 3 "Waiting for Convex Backend"
Wait-ForHealthy "backend" 120

# -- Step 4: Generate Admin Key -------------------------------------------

Write-Step 4 "Generating Local Admin Key"

# Temporarily allow non-terminating errors so Docker stderr doesn't crash the script
$prevEAP = $ErrorActionPreference
$ErrorActionPreference = "Continue"
$adminKeyRaw = docker compose exec backend ./generate_admin_key.sh 2>&1 | Out-String
$ErrorActionPreference = $prevEAP

# Extract the key line (matches "convex-self-hosted|...")
$match = [regex]::Match($adminKeyRaw, "(convex-self-hosted\|[a-f0-9]+)")
if (-not $match.Success) {
    Write-Host "  [FAIL] Failed to generate admin key. Raw output:" -ForegroundColor Red
    Write-Host $adminKeyRaw
    exit 1
}
$adminKey = $match.Value.Trim()
Write-Ok "Admin key generated."
Write-Info "Key: $($adminKey.Substring(0, 30))..."

# Update .env file with the new admin key
$envContent = Get-Content ".env" -Raw
if ($envContent -match "CONVEX_SELF_HOSTED_ADMIN_KEY=") {
    $envContent = $envContent -replace "CONVEX_SELF_HOSTED_ADMIN_KEY=.*", "CONVEX_SELF_HOSTED_ADMIN_KEY=$adminKey"
    Set-Content ".env" -Value $envContent -NoNewline
    Write-Ok "Updated CONVEX_SELF_HOSTED_ADMIN_KEY in .env"
}

# -- Step 5: Set Convex Environment Variables -----------------------------

Write-Step 5 "Configuring Convex Environment Variables"

if ($ENCRYPTION_KEY) {
    Write-Info "Setting ENCRYPTION_KEY..."
    node $CONVEX_CLI env set ENCRYPTION_KEY "$ENCRYPTION_KEY" --url "$CONVEX_URL" --admin-key "$adminKey"
    Write-Ok "ENCRYPTION_KEY set."
}

if ($CLERK_ISSUER) {
    Write-Info "Setting CLERK_ISSUER_DOMAIN..."
    node $CONVEX_CLI env set CLERK_ISSUER_DOMAIN "$CLERK_ISSUER" --url "$CONVEX_URL" --admin-key "$adminKey"
    Write-Ok "CLERK_ISSUER_DOMAIN set."
}

# -- Step 6: Deploy Convex Schema and Functions ---------------------------

Write-Step 6 "Deploying Convex Schema and Functions"
Write-Info "This may take 1-2 minutes for index backfilling..."
node $CONVEX_CLI deploy --url "$CONVEX_URL" --admin-key "$adminKey"
if ($LASTEXITCODE -ne 0) {
    Write-Host "  [FAIL] Convex deploy failed." -ForegroundColor Red
    exit 1
}
Write-Ok "Convex functions deployed and indexes backfilled."

# -- Step 7: Restart UI and Worker (pick up fresh env) --------------------

Write-Step 7 "Restarting UI and Worker Containers"
docker compose up -d ui worker
Write-Ok "UI and Worker restarted."

# Wait briefly and show logs
Start-Sleep -Seconds 5

# -- Step 8: Verify -------------------------------------------------------

Write-Step 8 "Verifying Services"

$prevEAP2 = $ErrorActionPreference
$ErrorActionPreference = "Continue"
$containers = docker compose ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}" 2>&1 | Out-String
$ErrorActionPreference = $prevEAP2
Write-Host $containers

Write-Host ""
Write-Host "========================================================" -ForegroundColor Green
Write-Host "  [OK] Orcha Agent OS is ready!" -ForegroundColor Green
Write-Host ""
Write-Host "  UI:        http://localhost:3000" -ForegroundColor White
Write-Host "  Dashboard: http://localhost:6791" -ForegroundColor White
Write-Host "  Grafana:   http://localhost:3001  (admin/admin)" -ForegroundColor White
Write-Host "  Convex:    http://localhost:3210" -ForegroundColor White
Write-Host ""
Write-Host "  To run in dev mode instead: npm run dev" -ForegroundColor DarkGray
Write-Host "========================================================" -ForegroundColor Green
Write-Host ""
