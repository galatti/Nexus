# Build script for Pomodoro MCP server
param([string]$NodeEnv = "production")

$ErrorActionPreference = "Stop"

Write-Host "Building Pomodoro MCP Server..." -ForegroundColor Green

# Get paths
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir
$SrcDir = Join-Path $ProjectRoot "src\main\mcp\servers"
$BuildDir = Join-Path $ProjectRoot "dist\main\mcp\servers"

# Ensure build directory exists
if (-not (Test-Path $BuildDir)) {
    New-Item -ItemType Directory -Path $BuildDir -Force | Out-Null
}

Write-Host "Source: $SrcDir" -ForegroundColor Blue
Write-Host "Output: $BuildDir" -ForegroundColor Blue

# Check source file
$SourceFile = Join-Path $SrcDir "PomodoroServer.ts"
if (-not (Test-Path $SourceFile)) {
    Write-Host "Source file not found: $SourceFile" -ForegroundColor Red
    exit 1
}

# Compile TypeScript
Write-Host "Compiling TypeScript..." -ForegroundColor Yellow

$TscArgs = @(
    $SourceFile
    "--outDir", $BuildDir
    "--target", "ES2020"
    "--module", "commonjs"
    "--moduleResolution", "node"
    "--esModuleInterop"
    "--allowSyntheticDefaultImports"
    "--strict"
    "--skipLibCheck"
    "--forceConsistentCasingInFileNames"
    "--resolveJsonModule"
)

try {
    & npx tsc @TscArgs
    
    if ($LASTEXITCODE -eq 0) {
        $OutputFile = Join-Path $BuildDir "PomodoroServer.js"
        Write-Host "Compilation successful: $OutputFile" -ForegroundColor Green
        
        if (Test-Path $OutputFile) {
            $FileSize = (Get-Item $OutputFile).Length
            $FileSizeKB = [math]::Round($FileSize / 1024, 2)
            Write-Host "File size: $FileSizeKB KB" -ForegroundColor Blue
        }
        
        Write-Host "Build complete!" -ForegroundColor Green
    } else {
        throw "TypeScript compilation failed"
    }
} catch {
    Write-Host "Compilation failed: $_" -ForegroundColor Red
    exit 1
} 