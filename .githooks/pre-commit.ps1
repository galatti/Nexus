# Pre-commit hook to validate documentation - PowerShell version
Write-Host "🔍 Validating documentation before commit..." -ForegroundColor Blue

# Run documentation validation
if (Test-Path "scripts/validate-docs.ps1") {
    $result = powershell -ExecutionPolicy Bypass -File scripts/validate-docs.ps1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Documentation validation failed. Please fix issues before committing." -ForegroundColor Red
        Write-Host "Run 'npm run validate-docs' to see details." -ForegroundColor Yellow
        exit 1
    }
}

Write-Host "✅ Documentation validation passed!" -ForegroundColor Green
exit 0 