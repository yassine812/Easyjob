param([switch]$Managed)
$ErrorActionPreference = 'Stop'
$apiRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Set-Location -LiteralPath $apiRoot
if (!$Managed) {
  & node (Join-Path $PSScriptRoot 'local-services.cjs')
  exit $LASTEXITCODE
}
$env:NODE_USE_SYSTEM_CA = '1'

function Test-LocalApi {
  try {
    $health = Invoke-RestMethod 'http://localhost:3002/api/v1/health' -TimeoutSec 3
    return $health.status -eq 'ok'
  } catch { return $false }
}

if (Test-LocalApi) {
  Write-Output 'EasyJob API is already healthy on http://localhost:3002.'
  & (Join-Path $PSScriptRoot 'start-profile-services.ps1')
  exit 0
}

# Start the project's existing database and cache, keeping their stored data.
& docker compose -f docker-compose.yml up -d postgres redis
if ($LASTEXITCODE -ne 0) { throw 'Could not start PostgreSQL and Redis. Check that Docker Desktop is running.' }

$apiListener = Get-NetTCPConnection -State Listen -LocalPort 3002 -ErrorAction SilentlyContinue
if ($apiListener) {
  # A previous supervisor/API may still be completing its startup. Give it a
  # short grace period before treating the listener as a broken service; this
  # avoids a false failure when npm run dev is launched twice during recovery.
  $portDeadline = (Get-Date).AddSeconds(45)
  while ((Get-Date) -lt $portDeadline) {
    if (Test-LocalApi) {
      Write-Output 'EasyJob API became healthy on http://localhost:3002.'
      & (Join-Path $PSScriptRoot 'start-profile-services.ps1')
      exit 0
    }
    Start-Sleep -Seconds 2
  }
  throw 'Port 3002 is occupied but its health check failed. Inspect the existing API logs before restarting it.'
}

$runtimeDir = Join-Path $apiRoot '.runtime'
New-Item -ItemType Directory -Path $runtimeDir -Force | Out-Null
$pidPath = Join-Path $runtimeDir 'api.pid'
$apiProcess = $null
if (Test-Path -LiteralPath $pidPath) {
  $previousId = (Get-Content -LiteralPath $pidPath -Raw).Trim()
  if ($previousId -match '^\d+$') {
    $previousProcess = Get-CimInstance Win32_Process -Filter "ProcessId=$previousId"
    if ($previousProcess -and $previousProcess.Name -eq 'node.exe' -and $previousProcess.CommandLine.Contains((Join-Path $apiRoot 'dist/main.js'))) {
      $apiProcess = Get-Process -Id $previousId
    }
  }
}

if (!$apiProcess) {
  $distMain = Get-Item -LiteralPath 'dist/main.js' -ErrorAction SilentlyContinue
  $latestBackendSource = Get-ChildItem -LiteralPath (Join-Path $apiRoot 'src') -Recurse -File -Filter '*.ts' -ErrorAction SilentlyContinue | Sort-Object LastWriteTimeUtc -Descending | Select-Object -First 1
  $backendNeedsBuild = !$distMain -or ($latestBackendSource -and $latestBackendSource.LastWriteTimeUtc -gt $distMain.LastWriteTimeUtc)
  if ($backendNeedsBuild) {
    Write-Output 'Backend sources are newer than dist; rebuilding the API before startup.'
    & npm.cmd run build
    if ($LASTEXITCODE -ne 0) { throw 'Backend build failed.' }
  }
  $env:PORT = '3002'
  $env:HOST = '0.0.0.0'
  $env:RUN_WORKERS = 'false'
  $apiProcess = Start-Process -FilePath (Get-Command node).Source -ArgumentList ('"' + (Join-Path $apiRoot 'dist/main.js') + '"') -WorkingDirectory $apiRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $runtimeDir 'api-recovery.log') -RedirectStandardError (Join-Path $runtimeDir 'api-recovery.error.log') -PassThru
  Set-Content -LiteralPath $pidPath -Value $apiProcess.Id
}

Write-Output 'Waiting for the API, PostgreSQL and Redis health check...'
$deadline = (Get-Date).AddMinutes(5)
while ((Get-Date) -lt $deadline) {
  if (Test-LocalApi) {
    Write-Output 'EasyJob API is ready on http://localhost:3002. The frontend stays on http://localhost:3000.'
    & (Join-Path $PSScriptRoot 'start-profile-services.ps1')
    exit 0
  }
  if ($apiProcess.HasExited) { throw 'API startup failed. See .runtime/api-recovery.error.log.' }
  Start-Sleep -Seconds 2
}
throw 'API health check timed out. See .runtime/api-recovery.log and .runtime/api-recovery.error.log.'
