param(
  [int]$Port = 4174,
  [switch]$CheckOnly
)

$ErrorActionPreference = "Stop"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$previewEntry = Join-Path $repoRoot "portal\index.html"
$previewUrl = "http://127.0.0.1:$Port/portal/?nov_navi_preview=1&demo=1&legacy=1"

if (-not (Test-Path -LiteralPath $previewEntry -PathType Leaf)) {
  throw "Preview files were not found. Keep start-preview.bat inside the repository root."
}

$runtimeCandidates = @(
  @{
    File = Join-Path $env:USERPROFILE ".cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe"
    Prefix = @()
  }
)

$pyLauncher = Get-Command py.exe -ErrorAction SilentlyContinue
if ($pyLauncher) {
  $runtimeCandidates += @{ File = $pyLauncher.Source; Prefix = @("-3") }
}

$pythonCommand = Get-Command python.exe -ErrorAction SilentlyContinue
if ($pythonCommand) {
  $runtimeCandidates += @{ File = $pythonCommand.Source; Prefix = @() }
}

$runtime = $null
foreach ($candidate in $runtimeCandidates) {
  if (-not (Test-Path -LiteralPath $candidate.File -PathType Leaf)) {
    continue
  }
  try {
    & $candidate.File @($candidate.Prefix) --version *> $null
    if ($LASTEXITCODE -eq 0) {
      $runtime = $candidate
      break
    }
  } catch {
    # Try the next local Python runtime.
  }
}

if (-not $runtime) {
  throw "Python could not be found. Open this folder in Codex once, or install Python 3 from python.org."
}

if ($CheckOnly) {
  Write-Output "OK: $($runtime.File)"
  Write-Output "Preview URL: $previewUrl"
  exit 0
}

$listener = [System.Net.Sockets.TcpListener]::new(
  [System.Net.IPAddress]::Loopback,
  $Port
)
try {
  $listener.Start()
} catch {
  throw "Port $Port is already in use. Close the previous Preview window and try again."
} finally {
  $listener.Stop()
}

$browserCommand = "Start-Sleep -Milliseconds 900; Start-Process '$previewUrl'"
Start-Process powershell.exe `
  -ArgumentList @("-NoLogo", "-NoProfile", "-WindowStyle", "Hidden", "-Command", $browserCommand) `
  -WindowStyle Hidden | Out-Null

Write-Host "Preview URL: $previewUrl"
Write-Host ""
Write-Host "To stop Preview, close this window or press Ctrl+C."
Write-Host ""

& $runtime.File @($runtime.Prefix) -m http.server $Port --bind 127.0.0.1 --directory $repoRoot
