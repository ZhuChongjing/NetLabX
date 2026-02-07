try {
  Set-Location -LiteralPath $PSScriptRoot
  $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
  $out   = Join-Path $PSScriptRoot ("network-platform-$stamp.zip")
  $excludes = @('.git','submissions')
  $items = Get-ChildItem -Force | Where-Object { $excludes -notcontains $_.Name }
  Compress-Archive -Path $items -DestinationPath $out -Force
  Write-Host "pack success: $out" -ForegroundColor Green
} catch {
  Write-Host "pack failed: $_" -ForegroundColor Red
} finally {
  Read-Host "press Enter to exit"
}
