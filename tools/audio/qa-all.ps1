# Full audio check: Whisper pass on new/changed files, recheck of failed single words, then
# hidden.json. Keeps the machine awake while running.
#   powershell -ExecutionPolicy Bypass -File tools\audio\qa-all.ps1
Set-Location $PSScriptRoot
Start-Process powershell -WindowStyle Hidden -ArgumentList "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", "$PSScriptRoot\keep-awake.ps1", "-ProcessId", "$PID"
node qa.mjs --workers 3 *> qa.log
node qa.mjs --recheck --workers 2 *>> qa.log
node hidden.mjs *> hidden.log
"done" | Out-File -Append -Encoding ascii qa.log
