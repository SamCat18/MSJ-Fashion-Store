param([int]$Port = 8765)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$backupDirectory = Join-Path $projectRoot 'backups'
$panelPath = Join-Path $projectRoot 'backup-panel.html'
$tokenBytes = New-Object byte[] 24
[Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($tokenBytes)
$token = [Convert]::ToBase64String($tokenBytes).Replace('+', 'A').Replace('/', 'B').TrimEnd('=')
$listener = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, $Port)
$listener.Start()
Write-Host "Panel local: http://127.0.0.1:$Port/"
Write-Host 'Solo escucha en este equipo. Presiona Ctrl+C para detenerlo.'

function Send-Response($stream, [int]$status, [string]$contentType, [string]$body) {
  $bytes = [Text.Encoding]::UTF8.GetBytes($body)
  $reason = if ($status -eq 200) { 'OK' } elseif ($status -eq 403) { 'Forbidden' } elseif ($status -eq 404) { 'Not Found' } elseif ($status -eq 405) { 'Method Not Allowed' } else { 'Bad Request' }
  $headers = "HTTP/1.1 $status $reason`r`nContent-Type: $contentType`r`nContent-Length: $($bytes.Length)`r`nCache-Control: no-store`r`nConnection: close`r`n`r`n"
  $headerBytes = [Text.Encoding]::ASCII.GetBytes($headers)
  $stream.Write($headerBytes, 0, $headerBytes.Length)
  $stream.Write($bytes, 0, $bytes.Length)
}

while ($true) {
  $client = $listener.AcceptTcpClient()
  try {
    $stream = $client.GetStream()
    $reader = New-Object IO.StreamReader($stream, [Text.Encoding]::ASCII, $false, 1024, $true)
    $requestLine = $reader.ReadLine()
    if (-not $requestLine) { $client.Close(); continue }
    $requestParts = $requestLine.Split(' ')
    $method = $requestParts[0]
    $path = $requestParts[1].Split('?')[0]
    $headers = @{}
    while ($null -ne ($line = $reader.ReadLine()) -and $line.Length -gt 0) {
      $separator = $line.IndexOf(':')
      if ($separator -gt 0) { $headers[$line.Substring(0, $separator).Trim().ToLowerInvariant()] = $line.Substring($separator + 1).Trim() }
    }

    if ($method -eq 'GET' -and $path -eq '/') {
      $html = (Get-Content -LiteralPath $panelPath -Raw -Encoding UTF8).Replace('__BACKUP_TOKEN__', $token)
      Send-Response $stream 200 'text/html; charset=utf-8' $html
    } elseif ($method -eq 'GET' -and $path -eq '/backup-panel.css') {
      Send-Response $stream 200 'text/css; charset=utf-8' (Get-Content -LiteralPath (Join-Path $projectRoot 'backup-panel.css') -Raw -Encoding UTF8)
    } elseif ($method -eq 'GET' -and $path -eq '/backup-panel.js') {
      Send-Response $stream 200 'application/javascript; charset=utf-8' (Get-Content -LiteralPath (Join-Path $projectRoot 'backup-panel.js') -Raw -Encoding UTF8)
    } elseif ($method -eq 'GET' -and $path -eq '/api/status') {
      $task = Get-ScheduledTask -TaskName 'MSJ Supabase Database Backup' -ErrorAction SilentlyContinue
      $taskInfo = if ($task) { Get-ScheduledTaskInfo -TaskName 'MSJ Supabase Database Backup' -ErrorAction SilentlyContinue } else { $null }
      $configPath = Join-Path $env:APPDATA 'MSJ-Fashion-Store\backup-config.json'
      $status = [ordered]@{ taskInstalled = [bool]$task; taskState = if ($task) { [string]$task.State } else { 'NotInstalled' }; lastRun = if ($taskInfo -and $taskInfo.LastRunTime.Year -gt 2000) { $taskInfo.LastRunTime.ToString('o') } else { $null }; nextRun = if ($taskInfo -and $taskInfo.NextRunTime.Year -gt 2000) { $taskInfo.NextRunTime.ToString('o') } else { $null }; lastResult = if ($taskInfo) { "Código de salida $($taskInfo.LastTaskResult)" } else { $null }; pgDumpAvailable = [bool](Get-Command pg_dump -ErrorAction SilentlyContinue); configured = Test-Path -LiteralPath $configPath }
      Send-Response $stream 200 'application/json; charset=utf-8' ($status | ConvertTo-Json -Compress)
    } elseif ($method -eq 'GET' -and $path -eq '/api/backups') {
      $files = @(Get-ChildItem -LiteralPath $backupDirectory -Filter 'msj-database-*.dump' -File -ErrorAction SilentlyContinue | Sort-Object LastWriteTimeUtc -Descending | ForEach-Object { [ordered]@{ name = $_.Name; bytes = $_.Length; createdAt = $_.LastWriteTime.ToString('o') } })
      Send-Response $stream 200 'application/json; charset=utf-8' (@{ files = $files } | ConvertTo-Json -Compress -Depth 4)
    } elseif ($method -eq 'POST' -and $path -eq '/api/run') {
      $origin = $headers['origin']
      $providedToken = $headers['x-msj-backup-token']
      if ($origin -ne "http://127.0.0.1:$Port" -or $providedToken -ne $token) {
        Send-Response $stream 403 'application/json; charset=utf-8' '{"error":"Solicitud local no autorizada."}'
      } elseif (-not (Get-Command pg_dump -ErrorAction SilentlyContinue)) {
        Send-Response $stream 400 'application/json; charset=utf-8' '{"error":"Instala PostgreSQL Command Line Tools para usar pg_dump."}'
      } elseif (-not (Test-Path -LiteralPath (Join-Path $env:APPDATA 'MSJ-Fashion-Store\backup-config.json'))) {
        Send-Response $stream 400 'application/json; charset=utf-8' '{"error":"Configura primero la conexión cifrada."}'
      } else {
        $powerShell = (Get-Command powershell.exe -ErrorAction Stop).Source
        $backupScript = Join-Path $PSScriptRoot 'backup-database.ps1'
        $null = & $powerShell -NoProfile -ExecutionPolicy Bypass -File $backupScript 2>&1
        if ($LASTEXITCODE -eq 0) {
          $latest = Get-ChildItem -LiteralPath $backupDirectory -Filter 'msj-database-*.dump' -File | Sort-Object LastWriteTimeUtc -Descending | Select-Object -First 1
          Send-Response $stream 200 'application/json; charset=utf-8' (@{ success = $true; name = $latest.Name } | ConvertTo-Json -Compress)
        } else {
          Send-Response $stream 400 'application/json; charset=utf-8' '{"error":"Falló pg_dump. Revisa backups/backup.log y la conexión."}'
        }
      }
    } elseif ($method -ne 'GET' -and $method -ne 'POST') {
      Send-Response $stream 405 'application/json; charset=utf-8' '{"error":"Método no permitido."}'
    } else {
      Send-Response $stream 404 'text/plain; charset=utf-8' 'No encontrado.'
    }
    $reader.Dispose()
    $client.Close()
  } catch {
    if ($client) { $client.Close() }
    Write-Warning 'Error atendiendo una solicitud del panel local.'
  }
}
