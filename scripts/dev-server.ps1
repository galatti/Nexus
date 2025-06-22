param(
    [switch]$Clean,
    [switch]$Help
)

# NEXUS MVP Development Server Script (PowerShell)
# This script starts the development environment for the NEXUS application

if ($Help) {
    Write-Host @"
NEXUS MVP Development Server Script

Usage: .\dev-server.ps1 [OPTIONS]

OPTIONS:
    -Clean      Clean node_modules before starting
    -Help       Show this help message

EXAMPLES:
    .\dev-server.ps1              # Start development server
    .\dev-server.ps1 -Clean       # Clean install and start server
"@
    exit 0
}

$ErrorActionPreference = "Stop"

# Environment setup
$env:NODE_ENV = "development"
$env:ELECTRON_IS_DEV = "1"

Write-Host "🚀 Starting NEXUS MVP Development Server" -ForegroundColor Green

try {
    # Check Node.js version
    try {
        $nodeVersion = node --version
        Write-Host "✅ Node.js version: $nodeVersion" -ForegroundColor Green
    }
    catch {
        Write-Host "❌ Node.js is not installed. Please install Node.js 18+ and try again." -ForegroundColor Red
        exit 1
    }

    # Clean install if requested
    if ($Clean -and (Test-Path "node_modules")) {
        Write-Host "🧹 Cleaning node_modules..." -ForegroundColor Yellow
        Remove-Item -Recurse -Force "node_modules"
    }

    # Check if package.json exists
    if (-not (Test-Path "package.json")) {
        Write-Host "❌ package.json not found. Make sure you're in the project root directory." -ForegroundColor Red
        exit 1
    }

    # Install dependencies if needed
    if (-not (Test-Path "node_modules")) {
        Write-Host "📦 Installing dependencies..." -ForegroundColor Yellow
        npm install
        if ($LASTEXITCODE -ne 0) {
            throw "Failed to install dependencies"
        }
    }

    # Start development server
    Write-Host "🔧 Starting development server..." -ForegroundColor Green
    npm run dev
}
catch {
    Write-Host "❌ Development server failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
finally {
    # Cleanup temporary files and processes
    Write-Host "`n🧹 Cleaning up development server..." -ForegroundColor Yellow
    
    # Clean up any temporary files if they exist
    if (Test-Path "temp") {
        Remove-Item -Recurse -Force "temp" -ErrorAction SilentlyContinue
    }
    
    # Additional cleanup can be added here
} 