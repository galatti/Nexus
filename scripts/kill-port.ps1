param(
    [int]$Port = $Env:DEV_PORT
)

if (-not $Port) { $Port = 5173 }

Write-Host "🛑 Checking port $Port ..." -ForegroundColor Yellow

try {
    $connections = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
    if ($null -ne $connections) {
        $pids = $connections | Select-Object -ExpandProperty OwningProcess -Unique
        foreach ($pid in $pids) {
            try {
                Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
                Write-Host "✅ Killed process $pid holding port $Port" -ForegroundColor Green
            } catch {
                Write-Host "⚠️  Failed to kill process $pid - $($_.Exception.Message)" -ForegroundColor Red
            }
        }

        # Wait until port is free (handles TIME_WAIT)
        $maxAttempts = 20
        for ($i = 0; $i -lt $maxAttempts; $i++) {
            $connections = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
            if (-not $connections) {
                break
            }
            Start-Sleep -Milliseconds 250
        }
    } else {
        Write-Host "ℹ️  Port $Port is already free." -ForegroundColor Cyan
    }
} catch {
    Write-Host "⚠️  Could not check or free port $Port - $($_.Exception.Message)" -ForegroundColor Red
} 