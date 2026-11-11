$ErrorActionPreference = 'Stop'

if (-not (Get-Command pg_dump -ErrorAction SilentlyContinue)) {
  throw 'Instala PostgreSQL Command Line Tools para disponer de pg_dump y vuelve a ejecutar este script.'
}

$hostName = Read-Host 'Host PostgreSQL de Supabase (sin protocolo)'
$port = Read-Host 'Puerto PostgreSQL (normalmente 5432)'
$database = Read-Host 'Nombre de la base (normalmente postgres)'
$username = Read-Host 'Usuario PostgreSQL'
$password = Read-Host 'Contraseña de la base de datos' -AsSecureString

if (-not $hostName -or -not $database -or -not $username -or $password.Length -eq 0) {
  throw 'Faltan datos de conexión.'
}
if (-not $port) { $port = '5432' }
if ($port -notmatch '^\d+$' -or [int]$port -lt 1 -or [int]$port -gt 65535) {
  throw 'El puerto no es válido.'
}

$configDirectory = Join-Path $env:APPDATA 'MSJ-Fashion-Store'
$configPath = Join-Path $configDirectory 'backup-config.json'
New-Item -ItemType Directory -Path $configDirectory -Force | Out-Null
$config = [ordered]@{
  Host = $hostName.Trim()
  Port = [int]$port
  Database = $database.Trim()
  Username = $username.Trim()
  Password = ConvertFrom-SecureString -SecureString $password
}
$config | ConvertTo-Json | Set-Content -LiteralPath $configPath -Encoding UTF8
Write-Host 'Conexión guardada cifrada para tu usuario de Windows. La contraseña no se muestra.'
