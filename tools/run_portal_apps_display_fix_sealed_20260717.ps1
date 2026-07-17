Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# Production DML executor. Do not run without a fresh explicit approval.
$ExpectedCliVersion = "2.109.1"
$ExpectedProjectRefSha256 = "D5C7FC778E9AAEE37351272C5659ED02534968A0C68DE2BA826C4FEC1CBD1EF4"
$ExpectedSqlSha256 = "9E5F6C6BFD093775ABA00DB8C27648B5862F7F975C99934A94E61BEED5524EC9"
$ExpectedValidatorSha256 = "6E0BF7FF6243E154DE32545F9F26FD85C5A7F0A22A5D10E8F19FCAE9A4699B9E"

$RepoRoot = Split-Path -Parent $PSScriptRoot
$SqlPath = Join-Path $RepoRoot "supabase\portal-apps-display-fix-sealed-20260717.sql"
$ValidatorPath = Join-Path $RepoRoot "tools\validate_portal_apps_display_fix_sealed_20260717.mjs"
$LinkedProjectDir = "C:\Users\bassa\Desktop\BASSA経営管理システム\work\idea-nov-hub-decision-hub-publish"
$ProjectRefPath = Join-Path $LinkedProjectDir "supabase\.temp\project-ref"

function Get-UpperSha256([string]$Path) {
  return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToUpperInvariant()
}

function Stop-Sealed([string]$Code, [bool]$Attempted = $false) {
  [pscustomobject]@{
    ok = $false
    safeCode = $Code
    executionAttempted = $Attempted
    rawValuesPrinted = $false
    rollbackExecuted = $false
  } | ConvertTo-Json -Compress | Write-Output
  throw $Code
}

if (-not (Test-Path -LiteralPath $SqlPath)) { Stop-Sealed "sealed_sql_missing" }
if (-not (Test-Path -LiteralPath $ValidatorPath)) { Stop-Sealed "sealed_validator_missing" }
if (-not (Test-Path -LiteralPath $ProjectRefPath)) { Stop-Sealed "linked_project_identity_missing" }

if ((Get-UpperSha256 $SqlPath) -ne $ExpectedSqlSha256) { Stop-Sealed "sealed_sql_sha_mismatch" }
if ((Get-UpperSha256 $ValidatorPath) -ne $ExpectedValidatorSha256) { Stop-Sealed "sealed_validator_sha_mismatch" }

$projectRef = (Get-Content -LiteralPath $ProjectRefPath -Raw -Encoding UTF8).Trim()
$projectRefBytes = [Text.Encoding]::UTF8.GetBytes($projectRef)
$projectRefHashBytes = [Security.Cryptography.SHA256]::Create().ComputeHash($projectRefBytes)
$projectRefHash = ([BitConverter]::ToString($projectRefHashBytes)).Replace("-", "")
if ($projectRefHash -ne $ExpectedProjectRefSha256) { Stop-Sealed "production_target_identity_mismatch" }

$cliVersion = (& npx.cmd supabase --version 2>$null | Out-String).Trim()
if ($cliVersion -ne $ExpectedCliVersion) { Stop-Sealed "supabase_cli_version_mismatch" }

$validationRaw = & node $ValidatorPath
$validation = $validationRaw | ConvertFrom-Json
if (-not $validation.ok) { Stop-Sealed "sealed_static_validation_failed" }

$raw = & npx.cmd supabase db query --linked --output-format json --file $SqlPath --workdir $LinkedProjectDir 2>$null
if ($LASTEXITCODE -ne 0) {
  [pscustomobject]@{
    ok = $false
    safeCode = "sealed_execution_failed"
    executionAttempted = $true
    rawValuesPrinted = $false
    rollbackExecuted = $false
  } | ConvertTo-Json -Compress | Write-Output
  throw "sealed_execution_failed"
}

try {
  $parsed = ($raw | Out-String) | ConvertFrom-Json
  $resultRow = @($parsed) | Where-Object { $_.PSObject.Properties.Name -contains "sealed_result" } | Select-Object -First 1
  $result = $resultRow.sealed_result
} catch {
  Stop-Sealed "sealed_result_parse_failed" $true
}

$validResult = $result.ok -eq $true `
  -and $result.safeCode -eq "portal_apps_display_fix_applied" `
  -and [int]$result.eduUpdatedCount -eq 1 `
  -and [int]$result.thanksUpdatedCount -eq 1 `
  -and [int]$result.totalUpdatedCount -eq 2 `
  -and $result.ideaLinkUnchanged -eq $true `
  -and $result.otherRowsUpdated -eq $false `
  -and $result.rollbackExecuted -eq $false

if (-not $validResult) { Stop-Sealed "sealed_result_contract_failed" $true }

[pscustomobject]@{
  ok = $true
  safeCode = "portal_apps_display_fix_applied"
  eduUpdatedCount = 1
  thanksUpdatedCount = 1
  totalUpdatedCount = 2
  ideaLinkUnchanged = $true
  otherRowsUpdated = $false
  rawValuesPrinted = $false
  rollbackExecuted = $false
} | ConvertTo-Json -Compress | Write-Output
