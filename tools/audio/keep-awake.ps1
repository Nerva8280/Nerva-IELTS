# Keeps Windows from sleeping while the audio generator runs (no permanent setting change).
# Usage: powershell -File keep-awake.ps1 -ProcessId <generator pid>
param([int]$ProcessId)
Add-Type -Namespace Win32 -Name Power -MemberDefinition '[DllImport("kernel32.dll")] public static extern uint SetThreadExecutionState(uint esFlags);'
$ES_CONTINUOUS = [uint32]"0x80000000"
$ES_SYSTEM_REQUIRED = [uint32]"0x00000001"
[Win32.Power]::SetThreadExecutionState($ES_CONTINUOUS -bor $ES_SYSTEM_REQUIRED) | Out-Null
while (Get-Process -Id $ProcessId -ErrorAction SilentlyContinue) { Start-Sleep -Seconds 30 }
[Win32.Power]::SetThreadExecutionState($ES_CONTINUOUS) | Out-Null
