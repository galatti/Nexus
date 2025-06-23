param(
    [switch]$Help
)

# MCP Setup Verification Script (PowerShell/Windows)
# This script verifies that the system is properly configured for MCP server functionality

if ($Help) {
    Write-Host @"
NEXUS MCP Setup Verification Script

Usage: .\mcp-verify.ps1 [OPTIONS]

OPTIONS:
    -Help    Show this help message

This script checks your system configuration for MCP server compatibility:
- Node.js installation and version
- npm and npx availability
- PATH environment configuration
- MCP package accessibility
- Permissions and setup

If any issues are found, the script will provide recommendations for fixing them.
"@
    exit 0
}

$ErrorActionPreference = "Continue"

Write-Host "🔍 NEXUS MCP Setup Verification" -ForegroundColor Blue
Write-Host "========================================"

# Check Node.js
Write-Host "`nChecking Node.js..." -ForegroundColor Yellow
try {
    $nodeCmd = Get-Command node -ErrorAction SilentlyContinue
    if ($nodeCmd) {
        $nodeVersion = node --version
        Write-Host "✅ Node.js found: $nodeVersion" -ForegroundColor Green
        
        # Check if version is adequate (v16+)
        $nodeMajor = [int]($nodeVersion -replace 'v(\d+)\..*', '$1')
        if ($nodeMajor -ge 16) {
            Write-Host "✅ Node.js version is compatible (v16+)" -ForegroundColor Green
        } else {
            Write-Host "❌ Node.js version is too old. Please upgrade to v16 or higher." -ForegroundColor Red
            exit 1
        }
    } else {
        Write-Host "❌ Node.js not found. Please install Node.js from https://nodejs.org" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "❌ Error checking Node.js: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Check npm
Write-Host "`nChecking npm..." -ForegroundColor Yellow
try {
    $npmCmd = Get-Command npm -ErrorAction SilentlyContinue
    if ($npmCmd) {
        $npmVersion = npm --version
        Write-Host "✅ npm found: v$npmVersion" -ForegroundColor Green
    } else {
        Write-Host "❌ npm not found. Please install npm." -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "❌ Error checking npm: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Check npx
Write-Host "`nChecking npx..." -ForegroundColor Yellow
try {
    $npxCmd = Get-Command npx -ErrorAction SilentlyContinue
    if ($npxCmd) {
        $npxVersion = npx --version
        Write-Host "✅ npx found: v$npxVersion" -ForegroundColor Green
        Write-Host "   npx location: $($npxCmd.Source)" -ForegroundColor Blue
    } else {
        Write-Host "❌ npx not found. Please update npm or install npx." -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "❌ Error checking npx: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Test npx functionality
Write-Host "`nTesting npx functionality..." -ForegroundColor Yellow
try {
    $npxHelp = npx --help 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ npx is working correctly" -ForegroundColor Green
    } else {
        Write-Host "❌ npx is not working properly" -ForegroundColor Red
        Write-Host "   Exit code: $LASTEXITCODE" -ForegroundColor Yellow
    }
} catch {
    Write-Host "❌ npx test failed: $($_.Exception.Message)" -ForegroundColor Red
}

# Check PATH
Write-Host "`nChecking PATH environment..." -ForegroundColor Yellow
$nodePath = Split-Path (Get-Command node).Source
if ($env:PATH -split ';' -contains $nodePath) {
    Write-Host "✅ Node.js is in PATH" -ForegroundColor Green
} else {
    Write-Host "⚠️ Node.js directory might not be properly in PATH" -ForegroundColor Yellow
    Write-Host "   Node.js path: $nodePath" -ForegroundColor Blue
}

# Test cmd.exe execution (which our fix uses)
Write-Host "`nTesting cmd.exe npx execution..." -ForegroundColor Yellow
try {
    $cmdTest = cmd.exe /c "npx --version" 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ cmd.exe can execute npx successfully" -ForegroundColor Green
    } else {
        Write-Host "❌ cmd.exe cannot execute npx properly" -ForegroundColor Red
        Write-Host "   This is the root cause of the MCP connection issue" -ForegroundColor Yellow
    }
} catch {
    Write-Host "❌ cmd.exe npx test failed: $($_.Exception.Message)" -ForegroundColor Red
}

# Test MCP package availability
Write-Host "`nTesting MCP package availability..." -ForegroundColor Yellow
try {
    $mcpTest = cmd.exe /c "npx --yes @modelcontextprotocol/server-filesystem --help" 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ MCP filesystem server package is accessible" -ForegroundColor Green
    } else {
        Write-Host "❌ Cannot access MCP filesystem server package" -ForegroundColor Red
        Write-Host "   This might be due to network restrictions or package registry issues." -ForegroundColor Yellow
        Write-Host "   Exit code: $LASTEXITCODE" -ForegroundColor Yellow
    }
} catch {
    Write-Host "❌ MCP package test failed: $($_.Exception.Message)" -ForegroundColor Red
}

# Check permissions
Write-Host "`nChecking permissions..." -ForegroundColor Yellow
try {
    $npmPrefix = npm config get prefix 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ npm prefix: $npmPrefix" -ForegroundColor Green
        
        if (Test-Path $npmPrefix -PathType Container) {
            try {
                $testFile = Join-Path $npmPrefix "test-write-permission.tmp"
                "test" | Out-File $testFile -ErrorAction Stop
                Remove-Item $testFile -ErrorAction SilentlyContinue
                Write-Host "✅ npm has write permissions" -ForegroundColor Green
            } catch {
                Write-Host "⚠️ npm might not have write permissions" -ForegroundColor Yellow
                Write-Host "   Consider running as administrator or changing npm prefix" -ForegroundColor Yellow
            }
        }
    } else {
        Write-Host "❌ Cannot determine npm configuration" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Error checking permissions: $($_.Exception.Message)" -ForegroundColor Red
}

# PowerShell execution policy check
Write-Host "`nChecking PowerShell execution policy..." -ForegroundColor Yellow
$executionPolicy = Get-ExecutionPolicy
Write-Host "   Current execution policy: $executionPolicy" -ForegroundColor Blue
if ($executionPolicy -eq "Restricted") {
    Write-Host "⚠️ PowerShell execution policy is Restricted" -ForegroundColor Yellow
    Write-Host "   This might affect script execution. Consider 'Set-ExecutionPolicy RemoteSigned'" -ForegroundColor Yellow
} else {
    Write-Host "✅ PowerShell execution policy allows script execution" -ForegroundColor Green
}

Write-Host "`n🎉 MCP setup verification completed!" -ForegroundColor Green
Write-Host "If you encountered any issues, please refer to the troubleshooting guide." -ForegroundColor Blue

# Summary of common fixes
if ($npxCmd -and $nodeCmd) {
    Write-Host "`n📋 Quick Troubleshooting Tips:" -ForegroundColor Cyan
    Write-Host "1. If MCP connection fails, ensure cmd.exe can execute npx" -ForegroundColor White
    Write-Host "2. Try running: cmd.exe /c 'npx --version'" -ForegroundColor White
    Write-Host "3. If that fails, reinstall Node.js or update npm" -ForegroundColor White
    Write-Host "4. Ensure your PATH includes the Node.js directory" -ForegroundColor White
} 