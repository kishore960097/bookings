Write-Host ""
Write-Host "  QGo Mobile Tunnel - Auto Restart" -ForegroundColor Cyan
Write-Host "  Press Ctrl+C to stop" -ForegroundColor Gray
Write-Host ""

while ($true) {
    Write-Host "  Starting tunnel..." -ForegroundColor Yellow
    $output = npx localtunnel --port 3000 2>&1
    $url = ($output | Select-String "your url is:").Line
    if ($url) {
        $cleanUrl = $url -replace "your url is: ", ""
        Write-Host ""
        Write-Host "  ============================================" -ForegroundColor Green
        Write-Host "  MOBILE PREVIEW URL:" -ForegroundColor Green
        Write-Host "  $cleanUrl" -ForegroundColor White
        Write-Host "  Password if asked: 10.160.249.168" -ForegroundColor Gray
        Write-Host "  ============================================" -ForegroundColor Green
        Write-Host ""
    }
    Write-Host "  Tunnel closed. Restarting in 2 seconds..." -ForegroundColor Red
    Start-Sleep -Seconds 2
}
