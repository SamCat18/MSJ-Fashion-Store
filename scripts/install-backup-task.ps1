$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$backupScript = Join-Path $PSScriptRoot 'backup-database.ps1'
$configPath = Join-Path $env:APPDATA 'MSJ-Fashion-Store\backup-config.json'
$taskName = 'MSJ Supabase Database Backup'

if (-not (Test-Path -LiteralPath $configPath)) {
  throw 'Primero ejecuta scripts/configure-backup.ps1 para cifrar los datos de conexión.'
}
if (-not (Get-Command pg_dump -ErrorAction SilentlyContinue)) {
  throw 'Instala PostgreSQL Command Line Tools y confirma que pg_dump esté en PATH.'
}

$powerShell = (Get-Command powershell.exe -ErrorAction Stop).Source
$arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$backupScript`""
$action = New-ScheduledTaskAction -Execute $powerShell -Argument $arguments -WorkingDirectory $projectRoot
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(2) `
  -RepetitionInterval (New-TimeSpan -Hours 6) `
  -RepetitionDuration (New-TimeSpan -Days 3650)
$principal = New-ScheduledTaskPrincipal `
  -UserId ([Security.Principal.WindowsIdentity]::GetCurrent().Name) `
  -LogonType Interactive `
  -RunLevel Limited
$settings = New-ScheduledTaskSettingsSet `
  -StartWhenAvailable `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -WakeToRun `
  -MultipleInstances IgnoreNew `
  -ExecutionTimeLimit (New-TimeSpan -Hours 2)

Register-ScheduledTask `
  -TaskName $taskName `
  -Action $action `
  -Trigger $trigger `
  -Principal $principal `
  -Settings $settings `
  -Description 'Respaldo PostgreSQL cifrado local para MSJ Fashion Store, cada 6 horas.' `
  -Force | Out-Null

Write-Host "Tarea '$taskName' instalada: cada 6 horas mientras tu usuario de Windows tenga sesión iniciada."
Write-Host 'El equipo necesita estar encendido y conectado a Internet; las ejecuciones perdidas se intentarán al volver a estar disponible.'
