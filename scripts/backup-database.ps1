$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$backupDirectory = Join-Path $projectRoot 'backups'
$configPath = Join-Path $env:APPDATA 'MSJ-Fashion-Store\backup-config.json'
$logPath = Join-Path $backupDirectory 'backup.log'
New-Item -ItemType Directory -Path $backupDirectory -Force | Out-Null

function Write-BackupLog([string]$text) {
  Add-Content -LiteralPath $logPath -Value "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] $text" -Encoding UTF8
}

$tempPath = $null
$passwordPointer = [IntPtr]::Zero
try {
  if (-not (Test-Path -LiteralPath $configPath)) {
    throw 'Falta configurar la conexión. Ejecuta scripts/configure-backup.ps1.'
  }
  $pgDump = Get-Command pg_dump -ErrorAction SilentlyContinue
  if (-not $pgDump) { throw 'No se encuentra pg_dump en PATH.' }
  $config = Get-Content -LiteralPath $configPath -Raw | ConvertFrom-Json
  $securePassword = ConvertTo-SecureString -String $config.Password
  $passwordPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
  $env:PGPASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($passwordPointer)

  $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
  $fileName = "msj-database-$stamp.dump"
  $tempPath = Join-Path $backupDirectory "$fileName.partial"
  $backupPath = Join-Path $backupDirectory $fileName
  & $pgDump.Source --format=custom --no-owner --no-acl --host $config.Host --port $config.Port --username $config.Username --dbname $config.Database --file $tempPath 2>$null
  if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $tempPath) -or (Get-Item -LiteralPath $tempPath).Length -eq 0) {
    throw 'pg_dump no pudo completar el respaldo.'
  }
  Move-Item -LiteralPath $tempPath -Destination $backupPath
  $sizeMB = [Math]::Round((Get-Item -LiteralPath $backupPath).Length / 1MB, 2)
  Write-BackupLog "OK $fileName ($sizeMB MB)"
  Get-ChildItem -LiteralPath $backupDirectory -Filter 'msj-database-*.dump' -File |
    Where-Object { $_.LastWriteTimeUtc -lt [DateTime]::UtcNow.AddDays(-30) } |
    Remove-Item -Force
  Write-Host "Backup creado: $backupPath"
} catch {
  if ($tempPath -and (Test-Path -LiteralPath $tempPath)) {
    Remove-Item -LiteralPath $tempPath -Force -ErrorAction SilentlyContinue
  }
  Write-BackupLog 'ERROR El respaldo falló. Revisa pg_dump, la conexión y los datos cifrados; no se registraron credenciales.'
  Write-Error $_.Exception.Message
  exit 1
} finally {
  Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
  if ($passwordPointer -ne [IntPtr]::Zero) {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordPointer)
  }
}
