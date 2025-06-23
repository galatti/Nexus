param(
    [switch]$Help,
    [switch]$Backup
)

# Clear MCP Configuration Script (PowerShell)
# This script clears broken MCP server configurations to allow testing the fix

if ($Help) {
    Write-Host @"
Clear MCP Configuration Script

Usage: .\clear-mcp-config.ps1 [OPTIONS]

OPTIONS:
    -Backup    Create a backup of the current configuration before clearing
    -Help      Show this help message

This script locates and clears the MCP server configurations that were created
before the cross-platform fix. This allows you to test the new fix with fresh
configurations that use the correct command structure.

The script will:
1. Find the Nexus configuration file
2. Optionally backup the current configuration
3. Remove only the MCP server entries (preserving other settings)
4. Show what was removed

After running this script, you can start the app and add MCP servers again
using the fixed configuration flow.
"@
    exit 0
}

$ErrorActionPreference = "Stop"

Write-Host "🧹 Clearing Old MCP Configurations" -ForegroundColor Blue
Write-Host "======================================"

# Find the config file path
$configPaths = @(
    "$env:APPDATA\nexus-mvp\config\nexus-config.json",
    "$env:LOCALAPPDATA\nexus-mvp\config\nexus-config.json",
    ".\nexus-config.json"
)

$configFile = $null
foreach ($path in $configPaths) {
    if (Test-Path $path) {
        $configFile = $path
        break
    }
}

if (-not $configFile) {
    Write-Host "✅ No configuration file found - no cleanup needed" -ForegroundColor Green
    Write-Host "You can start the app and create fresh MCP configurations." -ForegroundColor Blue
    exit 0
}

Write-Host "📁 Found config file: $configFile" -ForegroundColor Blue

# Read current configuration
try {
    $configContent = Get-Content $configFile -Raw -Encoding UTF8
    $config = $configContent | ConvertFrom-Json
} catch {
    Write-Host "❌ Error reading config file: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Check if there are MCP servers to remove
if (-not $config.mcp -or -not $config.mcp.servers -or $config.mcp.servers.Count -eq 0) {
    Write-Host "✅ No MCP servers found in configuration - no cleanup needed" -ForegroundColor Green
    exit 0
}

Write-Host "`n📋 Current MCP servers to be removed:" -ForegroundColor Yellow
$config.mcp.servers | ForEach-Object {
    Write-Host "   - $($_.name) (ID: $($_.id))" -ForegroundColor White
    Write-Host "     Command: $($_.command) $($_.args -join ' ')" -ForegroundColor Gray
}

# Create backup if requested
if ($Backup) {
    $backupFile = $configFile + ".backup-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
    try {
        Copy-Item $configFile $backupFile
        Write-Host "`n💾 Backup created: $backupFile" -ForegroundColor Green
    } catch {
        Write-Host "`n❌ Failed to create backup: $($_.Exception.Message)" -ForegroundColor Red
        exit 1
    }
}

# Clear MCP servers but preserve other settings
Write-Host "`n🧹 Clearing MCP server configurations..." -ForegroundColor Yellow

$config.mcp.servers = @()

# Save the updated configuration
try {
    $updatedContent = $config | ConvertTo-Json -Depth 10 -Compress:$false
    $updatedContent | Set-Content $configFile -Encoding UTF8
    
    Write-Host "✅ MCP configurations cleared successfully!" -ForegroundColor Green
    Write-Host "`n📝 What's next:" -ForegroundColor Cyan
    Write-Host "1. Start the application: npm run dev" -ForegroundColor White
    Write-Host "2. Go to Settings > MCP Servers" -ForegroundColor White
    Write-Host "3. Click 'Add Server' to create new configurations" -ForegroundColor White
    Write-Host "4. The new configurations will use the cross-platform fix" -ForegroundColor White
    
    if ($Backup) {
        Write-Host "`n💾 Your original configuration is backed up to:" -ForegroundColor Blue
        Write-Host "   $backupFile" -ForegroundColor Gray
    }
    
} catch {
    Write-Host "❌ Error saving updated configuration: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
} 