param(
    [string]$Platform = "all",
    [string]$BuildDir = "dist",
    [switch]$SkipTests,
    [switch]$Clean,
    [switch]$Help
)

# NEXUS MVP Production Build Script (PowerShell)
# This script builds the NEXUS application for production deployment

if ($Help) {
    Write-Host @"
NEXUS MVP Production Build Script

Usage: .\build-prod.ps1 [OPTIONS]

OPTIONS:
    -Platform <platform>    Target platform (win, mac, linux, all) [default: all]
    -BuildDir <directory>   Build output directory [default: dist]
    -SkipTests             Skip running tests
    -Clean                 Clean build directory before building
    -Help                  Show this help message

EXAMPLES:
    .\build-prod.ps1                           # Build for all platforms
    .\build-prod.ps1 -Platform win             # Build for Windows only
    .\build-prod.ps1 -SkipTests -Clean         # Clean build without tests
    .\build-prod.ps1 -BuildDir custom-dist     # Use custom build directory

ENVIRONMENT VARIABLES:
    NODE_ENV              Set to 'production' automatically
    GENERATE_SOURCEMAP    Set to 'false' automatically
    BUILD_DIR             Override default build directory
    PLATFORM              Override default platform
    SKIP_TESTS            Set to 'true' to skip tests
"@
    exit 0
}

$ErrorActionPreference = "Stop"

# Environment setup
$env:NODE_ENV = "production"
$env:GENERATE_SOURCEMAP = "false"

# Use environment variables if set, otherwise use parameters
$BuildDir = if ($env:BUILD_DIR) { $env:BUILD_DIR } else { $BuildDir }
$Platform = if ($env:PLATFORM) { $env:PLATFORM } else { $Platform }
$SkipTests = if ($env:SKIP_TESTS -eq "true") { $true } else { $SkipTests }

Write-Host "🏗️  Building NEXUS MVP for production" -ForegroundColor Green
Write-Host "Platform: $Platform" -ForegroundColor Blue
Write-Host "Build directory: $BuildDir" -ForegroundColor Blue
Write-Host "Skip tests: $SkipTests" -ForegroundColor Blue

# Check prerequisites
function Test-Prerequisites {
    Write-Host "🔍 Checking prerequisites..." -ForegroundColor Yellow
    
    # Check Node.js version
    try {
        $nodeVersion = node --version
        $majorVersion = [int]($nodeVersion -replace 'v(\d+)\..*', '$1')
        
        if ($majorVersion -lt 18) {
            throw "Node.js 18+ is required. Current version: $nodeVersion"
        }
        
        Write-Host "✅ Node.js version: $nodeVersion" -ForegroundColor Green
    }
    catch {
        Write-Host "❌ Node.js is not installed or version check failed" -ForegroundColor Red
        throw
    }
    
    # Check if package.json exists
    if (-not (Test-Path "package.json")) {
        Write-Host "❌ package.json not found. Run from project root." -ForegroundColor Red
        throw "package.json not found"
    }
    
    Write-Host "✅ Prerequisites check passed" -ForegroundColor Green
}

# Clean previous build
function Clear-Build {
    if ($Clean -and (Test-Path $BuildDir)) {
        Write-Host "🧹 Cleaning previous build..." -ForegroundColor Yellow
        Remove-Item -Recurse -Force $BuildDir
    }
    
    # Clean other temporary directories
    if (Test-Path "temp") {
        Remove-Item -Recurse -Force "temp" -ErrorAction SilentlyContinue
    }
}

# Install dependencies
function Install-Dependencies {
    Write-Host "📦 Installing production dependencies..." -ForegroundColor Yellow
    
    # Use npm ci for clean, fast, reliable installs
    npm ci --production=false
    
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to install dependencies"
    }
    
    Write-Host "✅ Dependencies installed successfully" -ForegroundColor Green
}

# Run tests
function Invoke-Tests {
    if (-not $SkipTests) {
        Write-Host "🧪 Running tests..." -ForegroundColor Yellow
        
        npm test
        
        if ($LASTEXITCODE -ne 0) {
            throw "Tests failed"
        }
        
        Write-Host "✅ All tests passed" -ForegroundColor Green
    }
    else {
        Write-Host "⚠️  Skipping tests as requested" -ForegroundColor Yellow
    }
}

# Build application
function Build-Application {
    Write-Host "🔨 Building application..." -ForegroundColor Yellow
    
    npm run build
    
    if ($LASTEXITCODE -ne 0) {
        throw "Build failed"
    }
    
    Write-Host "✅ Application built successfully" -ForegroundColor Green
}

# Package for distribution
function New-Package {
    Write-Host "📦 Packaging for platform: $Platform" -ForegroundColor Yellow
    
    switch ($Platform.ToLower()) {
        { $_ -in @("win", "windows") } {
            npm run "dist:win" -- --publish=never
        }
        { $_ -in @("mac", "macos", "darwin") } {
            npm run "dist:mac" -- --publish=never
        }
        "linux" {
            npm run "dist:linux" -- --publish=never
        }
        "all" {
            npm run "dist" -- --publish=never
        }
        default {
            Write-Host "❌ Unknown platform: $Platform" -ForegroundColor Red
            Write-Host "Valid platforms: win, mac, linux, all" -ForegroundColor Yellow
            throw "Invalid platform specified"
        }
    }
    
    if ($LASTEXITCODE -ne 0) {
        throw "Packaging failed"
    }
    
    Write-Host "✅ Packaging completed successfully" -ForegroundColor Green
}

# Generate build info
function New-BuildInfo {
    Write-Host "📋 Generating build information..." -ForegroundColor Yellow
    
    $buildInfoFile = Join-Path $BuildDir "build-info.json"
    
    # Ensure build directory exists
    if (-not (Test-Path $BuildDir)) {
        New-Item -ItemType Directory -Path $BuildDir -Force | Out-Null
    }
    
    # Get git information safely
    $gitCommit = try { git rev-parse HEAD 2>$null } catch { "unknown" }
    $gitBranch = try { git rev-parse --abbrev-ref HEAD 2>$null } catch { "unknown" }
    
    $buildInfo = @{
        buildTime = (Get-Date -Format "yyyy-MM-ddTHH:mm:ssZ").ToString()
        platform = $Platform
        nodeVersion = (node --version)
        npmVersion = (npm --version)
        gitCommit = $gitCommit
        gitBranch = $gitBranch
        buildDirectory = $BuildDir
    } | ConvertTo-Json -Depth 3
    
    $buildInfo | Set-Content -Path $buildInfoFile -Encoding UTF8
    
    Write-Host "✅ Build info generated: $buildInfoFile" -ForegroundColor Green
}

# Main execution with error handling and cleanup
$startTime = Get-Date

try {
    Test-Prerequisites
    Clear-Build
    Install-Dependencies
    Invoke-Tests
    Build-Application
    New-Package
    New-BuildInfo
    
    $endTime = Get-Date
    $duration = ($endTime - $startTime).TotalSeconds
    
    Write-Host "`n🎉 Build completed successfully!" -ForegroundColor Green
    Write-Host "Total build time: $([math]::Round($duration, 2))s" -ForegroundColor Blue
    Write-Host "Build artifacts: $BuildDir" -ForegroundColor Blue
}
catch {
    Write-Host "❌ Build failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
finally {
    # Cleanup temporary files and reset environment
    Write-Host "`n🧹 Performing cleanup..." -ForegroundColor Yellow
    
    # Remove temporary files
    if (Test-Path "temp") {
        Remove-Item -Recurse -Force "temp" -ErrorAction SilentlyContinue
    }
    
    # Reset environment variables if needed
    Remove-Item -Path "env:ELECTRON_BUILDER_CACHE" -ErrorAction SilentlyContinue
    
    Write-Host "✅ Cleanup completed" -ForegroundColor Green
} 