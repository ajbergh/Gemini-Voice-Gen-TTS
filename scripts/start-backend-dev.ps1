<<<<<<< HEAD
# Gemini Voice Studio — Backend Dev Launcher (PowerShell)
=======
# Gemini Voice Library — Backend Dev Launcher (PowerShell)
>>>>>>> dc43ce53dd934fdd804b70e1a041bb3ec532174e
# Starts the Go backend in development mode with debug logging.
# Usage: .\scripts\start-backend-dev.ps1 [-Port 8080] [-LogLevel debug|info|warn|error] [-OpenBrowser]
#
# SPDX-License-Identifier: Apache-2.0

param(
    [int]$Port = 8080,
    [ValidateSet("debug", "info", "warn", "error")]
    [string]$LogLevel = "debug",
    [switch]$OpenBrowser
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent (Split-Path -Parent $PSCommandPath)
$BackendDir = Join-Path $ProjectRoot "backend"

if (-not (Get-Command go -ErrorAction SilentlyContinue)) {
    throw "Go is not installed or not available on PATH."
}

if (-not (Test-Path $BackendDir)) {
    throw "Backend directory not found at $BackendDir"
}

$OpenValue = if ($OpenBrowser.IsPresent) { "true" } else { "false" }

<<<<<<< HEAD
Write-Host "=== Gemini Voice Studio — Backend Dev Server ===" -ForegroundColor Cyan
=======
Write-Host "=== Gemini Voice Library — Backend Dev Server ===" -ForegroundColor Cyan
>>>>>>> dc43ce53dd934fdd804b70e1a041bb3ec532174e
Write-Host "Project root: $ProjectRoot"
Write-Host "Backend dir: $BackendDir"
Write-Host "Port: $Port"
Write-Host "Log level: $LogLevel"
Write-Host "Open browser: $OpenValue"
Write-Host "Tip: run npm run dev in another terminal for the frontend."
Write-Host ""

Push-Location $BackendDir
try {
    go run ./cmd/server --port $Port --log-level $LogLevel --open=$OpenValue
} finally {
    Pop-Location
<<<<<<< HEAD
}
=======
}
>>>>>>> dc43ce53dd934fdd804b70e1a041bb3ec532174e
