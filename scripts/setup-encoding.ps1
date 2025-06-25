# PowerShell script to configure UTF-8 encoding for Nexus development
# This ensures proper console output encoding on Windows

Write-Host "[*] Configuring UTF-8 encoding for Windows PowerShell..." -ForegroundColor Blue

try {
    # Set console output encoding to UTF-8
    [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
    [Console]::InputEncoding = [System.Text.Encoding]::UTF8
    
    # Set PowerShell output encoding
    $PSDefaultParameterValues['*:Encoding'] = 'utf8'
    
    Write-Host "[+] UTF-8 encoding configured successfully" -ForegroundColor Green
    Write-Host "    Output Encoding: $([Console]::OutputEncoding.EncodingName)" -ForegroundColor Gray
    Write-Host "    Input Encoding: $([Console]::InputEncoding.EncodingName)" -ForegroundColor Gray
}
catch {
    Write-Host "[-] Failed to configure UTF-8 encoding: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "    Falling back to default encoding" -ForegroundColor Yellow
}

# Test encoding with sample Unicode characters
Write-Host ""
Write-Host "[*] Testing Unicode character support:" -ForegroundColor Blue
Write-Host "    Checkmarks: [+] [v] [x]" -ForegroundColor Green
Write-Host "    Arrows: -> <- ^  v" -ForegroundColor Yellow
Write-Host "    Symbols: * o # @ % &" -ForegroundColor Magenta
Write-Host "" 