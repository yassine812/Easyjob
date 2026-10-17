$ErrorActionPreference = 'Stop'
$profileRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Set-Location -LiteralPath $profileRoot
$env:NODE_USE_SYSTEM_CA = '1'
$profileRuntime = Join-Path $profileRoot '.runtime'
New-Item -ItemType Directory -Path $profileRuntime -Force | Out-Null
# Keep internal service credentials in the child process environment, out of logs.
$profileEnv = (& node -e "const fs=require('fs'),dotenv=require('dotenv'); process.stdout.write(JSON.stringify(dotenv.parse(fs.readFileSync('.env'))))") | ConvertFrom-Json
if ($LASTEXITCODE -ne 0) { throw 'Could not load the local service configuration.' }
foreach ($entry in $profileEnv.PSObject.Properties) { [Environment]::SetEnvironmentVariable($entry.Name, [string]$entry.Value, 'Process') }
# Keep local CV processing fast and offline unless a provider is explicitly
# selected in .env. An inherited OPENAI_API_KEY must not silently switch the
# development worker to a slow network dependency.
if (!$profileEnv.PSObject.Properties.Name.Contains('AI_PROVIDER')) {
  $env:AI_PROVIDER = 'rule_based'
}

function Test-Extractor {
  try { return (Invoke-RestMethod 'http://127.0.0.1:8000/health/face' -TimeoutSec 15).status -eq 'ok' } catch { return $false }
}
if (!(Test-Extractor)) {
  if (Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue) { throw 'Port 8000 is occupied but the CV extractor is unhealthy.' }
  $aiRoot = Join-Path $profileRoot 'ai-service'
  $aiProcess = Start-Process -FilePath (Get-Command python).Source -ArgumentList @('-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', '8000') -WorkingDirectory $aiRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $profileRuntime 'ai.log') -RedirectStandardError (Join-Path $profileRuntime 'ai.error.log') -PassThru
  Set-Content -LiteralPath (Join-Path $profileRuntime 'ai.pid') -Value $aiProcess.Id
  $deadline = (Get-Date).AddMinutes(3)
  while (!(Test-Extractor)) {
    if ($aiProcess.HasExited -or (Get-Date) -gt $deadline) { throw 'CV extractor failed to start. See .runtime/ai.error.log.' }
    Start-Sleep -Seconds 2
  }
}

$workerEntry = Join-Path $profileRoot 'dist/cv-worker-main.js'
if (!(Test-Path -LiteralPath $workerEntry)) { throw 'Run npm run build to compile the CV worker first.' }
$workerPidPath = Join-Path $profileRuntime 'cv-worker.pid'
if (Test-Path -LiteralPath $workerPidPath) {
  $previousId = (Get-Content -LiteralPath $workerPidPath -Raw).Trim()
  if ($previousId -match '^\d+$') {
    $existing = Get-CimInstance Win32_Process -Filter "ProcessId=$previousId"
    if ($existing -and $existing.Name -eq 'node.exe' -and $existing.CommandLine.Contains($workerEntry)) {
      Write-Output 'CV extractor is healthy and the CV worker is already running.'
      $cvProcess = Get-Process -Id $previousId
    }
  }
}
if (!$cvProcess) {
  $cvProcess = Start-Process -FilePath (Get-Command node).Source -ArgumentList ('"' + $workerEntry + '"') -WorkingDirectory $profileRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $profileRuntime 'cv-worker.log') -RedirectStandardError (Join-Path $profileRuntime 'cv-worker.error.log') -PassThru
  Set-Content -LiteralPath $workerPidPath -Value $cvProcess.Id
  Write-Output 'CV extractor is healthy; CV worker launched. Readiness is logged in .runtime/cv-worker.log.'
}

# The API enqueues password-reset and other transactional emails in BullMQ.
# Keep the queue consumer running alongside the CV worker so local recovery
# requests are delivered instead of remaining stuck in Redis.
$emailWorkerEntry = Join-Path $profileRoot 'dist/worker-main.js'
if (!(Test-Path -LiteralPath $emailWorkerEntry)) { throw 'Run npm run build to compile the email worker first.' }
$emailWorkerPidPath = Join-Path $profileRuntime 'worker.pid'
$emailWorkerProcess = $null
if (Test-Path -LiteralPath $emailWorkerPidPath) {
  $previousId = (Get-Content -LiteralPath $emailWorkerPidPath -Raw).Trim()
  if ($previousId -match '^\d+$') {
    $existing = Get-CimInstance Win32_Process -Filter "ProcessId=$previousId"
    if ($existing -and $existing.Name -eq 'node.exe' -and $existing.CommandLine.Contains($emailWorkerEntry)) {
      $emailWorkerProcess = Get-Process -Id $previousId
    }
  }
}
if (!$emailWorkerProcess) {
  $emailWorkerProcess = Start-Process -FilePath (Get-Command node).Source -ArgumentList ('"' + $emailWorkerEntry + '"') -WorkingDirectory $profileRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $profileRuntime 'worker.log') -RedirectStandardError (Join-Path $profileRuntime 'worker.error.log') -PassThru
  Set-Content -LiteralPath $emailWorkerPidPath -Value $emailWorkerProcess.Id
  Write-Output 'BullMQ worker launched for transactional emails and background jobs.'
} else {
  Write-Output 'BullMQ worker is already running.'
}
