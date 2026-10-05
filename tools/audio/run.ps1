# Starts the audio generator in the background with a keep-awake guard.
#   powershell -ExecutionPolicy Bypass -File tools\audio\run.ps1 [-Workers 2]
param([int]$Workers = 2)
Set-Location $PSScriptRoot
$gen = Start-Process node -ArgumentList "gen.mjs", "--workers", "$Workers" -WindowStyle Hidden -PassThru `
  -RedirectStandardOutput "$PSScriptRoot\gen.log" -RedirectStandardError "$PSScriptRoot\gen.err.log"
$gen.Id | Out-File -Encoding ascii "$PSScriptRoot\gen.pid"
Start-Process powershell -WindowStyle Hidden -ArgumentList "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", "$PSScriptRoot\keep-awake.ps1", "-ProcessId", "$($gen.Id)"
"generator pid $($gen.Id)"
