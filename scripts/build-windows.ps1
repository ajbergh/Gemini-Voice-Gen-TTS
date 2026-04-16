# Gemini Voice Library — Windows Build Script (PowerShell)
# Builds the frontend and compiles the Go backend into a single binary.
# Usage: .\scripts\build-windows.ps1 [-Arch amd64|arm64] [-Clean]
#
# SPDX-License-Identifier: Apache-2.0

param(
    [ValidateSet("amd64", "arm64")]
    [string]$Arch = "amd64",
    [switch]$Clean
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent (Split-Path -Parent $PSCommandPath)
$BinDir = Join-Path $ProjectRoot "bin"
$EmbedDir = Join-Path $ProjectRoot "backend" "internal" "embed" "dist"
$BinaryName = "gemini-voice-library-windows-$Arch.exe"

Write-Host "=== Gemini Voice Library — Windows Build ===" -ForegroundColor Cyan
Write-Host "Architecture: $Arch"
Write-Host "Project root: $ProjectRoot"

# Clean previous artifacts if requested
if ($Clean) {
    Write-Host "`n--- Cleaning previous build artifacts ---" -ForegroundColor Yellow
    if (Test-Path $BinDir) { Remove-Item -Recurse -Force $BinDir }
    if (Test-Path $EmbedDir) { Remove-Item -Recurse -Force $EmbedDir }
    $FrontendDist = Join-Path $ProjectRoot "dist"
    if (Test-Path $FrontendDist) { Remove-Item -Recurse -Force $FrontendDist }
}

# Step 1: Build frontend
Write-Host "`n--- Step 1: Building frontend ---" -ForegroundColor Green
Push-Location $ProjectRoot
try {
    npm install --silent
    npx vite build
} finally {
    Pop-Location
}

# Step 2: Copy frontend dist to embed directory
Write-Host "`n--- Step 2: Copying frontend to embed directory ---" -ForegroundColor Green
$FrontendDist = Join-Path $ProjectRoot "dist"
if (-not (Test-Path $FrontendDist)) {
    Write-Error "Frontend build output not found at $FrontendDist"
    exit 1
}
if (Test-Path $EmbedDir) { Remove-Item -Recurse -Force $EmbedDir }
Copy-Item -Recurse -Force $FrontendDist $EmbedDir

# Step 3: Build Go binary
Write-Host "`n--- Step 3: Compiling Go backend (windows/$Arch) ---" -ForegroundColor Green
if (-not (Test-Path $BinDir)) { New-Item -ItemType Directory -Force -Path $BinDir | Out-Null }

$env:CGO_ENABLED = "0"
$env:GOOS = "windows"
$env:GOARCH = $Arch

Push-Location (Join-Path $ProjectRoot "backend")
try {
    go build -ldflags="-s -w" -o (Join-Path $BinDir $BinaryName) ./cmd/server
} finally {
    Pop-Location
}

$OutputPath = Join-Path $BinDir $BinaryName
$Size = [math]::Round((Get-Item $OutputPath).Length / 1MB, 2)

Write-Host "`n=== Build complete ===" -ForegroundColor Cyan
Write-Host "Binary: $OutputPath ($Size MB)"
Write-Host "Run with: .\bin\$BinaryName"
