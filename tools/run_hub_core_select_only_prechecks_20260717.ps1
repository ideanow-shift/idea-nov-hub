param(
  [Parameter(Mandatory = $true)]
  [ValidateSet("line-works", "data-intake")]
  [string]$Contract,

  [switch]$Execute
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# This runner is validation-only unless both -Execute and the one-time approval
# marker are supplied. It never prints raw CLI output or project identifiers.
$ExpectedCliVersion = "2.109.1"
$ExpectedProjectRefSha256 = "D5C7FC778E9AAEE37351272C5659ED02534968A0C68DE2BA826C4FEC1CBD1EF4"
$ApprovalMarker = "HUB_CORE_SELECT_ONLY_20260717"
$RepoRoot = Split-Path -Parent $PSScriptRoot

$Contracts = @{
  "line-works" = @{
    Sql = "supabase\employee-line-works-destination-select-only-inventory-20260717.sql"
    Validator = "tools\validate_employee_line_works_inventory_20260717.mjs"
    SqlSha = "992E37261B93810C0C4B8F55D3FEF94A8BCF19E8ADEEDB9F5C2BA80432259F0E"
    ResultFields = @(
      "table_exists", "required_columns_present", "employee_target_supported",
      "unique_index_present", "rls_enabled", "rls_forced", "policy_count",
      "browser_policy_count", "service_role_privilege_count",
      "browser_privilege_count", "required_function_count",
      "security_definer_count", "fixed_search_path_count", "browser_execute_count"
    )
  }
  "data-intake" = @{
    Sql = "supabase\master-data-intake-catalog-select-only-precheck-20260717.sql"
    Validator = "tools\validate_master_data_intake_catalog_precheck_20260717.mjs"
    SqlSha = "85E433A97A6CA24BF3048B9D82E6BBB8C57DB8C670606C1579F79DEA3CFBBBDF"
    ResultFields = @(
      "required_table_count", "required_column_count", "present_required_column_count",
      "natural_key_unique_index_table_count", "rls_enabled_table_count",
      "rls_forced_table_count", "browser_write_privilege_count",
      "business_profile_table_count"
    )
  }
}

function Get-NormalizedSha256([string]$Path) {
  $normalized = (Get-Content -LiteralPath $Path -Raw -Encoding UTF8).Replace("`r`n", "`n")
  $bytes = [Text.Encoding]::UTF8.GetBytes($normalized)
  $hashBytes = [Security.Cryptography.SHA256]::Create().ComputeHash($bytes)
  return ([BitConverter]::ToString($hashBytes)).Replace("-", "")
}

function Get-ValueSha256([string]$Value) {
  $bytes = [Text.Encoding]::UTF8.GetBytes($Value)
  $hashBytes = [Security.Cryptography.SHA256]::Create().ComputeHash($bytes)
  return ([BitConverter]::ToString($hashBytes)).Replace("-", "")
}

function Stop-Safely([string]$Code, [bool]$Attempted = $false) {
  [pscustomobject]@{
    ok = $false
    safeCode = $Code
    contract = $Contract
    executionAttempted = $Attempted
    mutationExecuted = $false
    rawOutputPrinted = $false
    projectIdentityPrinted = $false
  } | ConvertTo-Json -Compress | Write-Output
  throw $Code
}

function Convert-SanitizedJson([string]$Raw) {
  $trimmed = $Raw.Trim()
  try { return ($trimmed | ConvertFrom-Json) } catch {}

  $arrayStart = $trimmed.IndexOf("[")
  $arrayEnd = $trimmed.LastIndexOf("]")
  if ($arrayStart -ge 0 -and $arrayEnd -gt $arrayStart) {
    try { return ($trimmed.Substring($arrayStart, $arrayEnd - $arrayStart + 1) | ConvertFrom-Json) } catch {}
  }

  $objectStart = $trimmed.IndexOf("{")
  $objectEnd = $trimmed.LastIndexOf("}")
  if ($objectStart -ge 0 -and $objectEnd -gt $objectStart) {
    try { return ($trimmed.Substring($objectStart, $objectEnd - $objectStart + 1) | ConvertFrom-Json) } catch {}
  }

  return $null
}

$definition = $Contracts[$Contract]
$SqlPath = Join-Path $RepoRoot $definition.Sql
$ValidatorPath = Join-Path $RepoRoot $definition.Validator

if (-not (Test-Path -LiteralPath $SqlPath)) { Stop-Safely "sealed_sql_missing" }
if (-not (Test-Path -LiteralPath $ValidatorPath)) { Stop-Safely "sealed_validator_missing" }
if ((Get-NormalizedSha256 $SqlPath) -ne $definition.SqlSha) { Stop-Safely "sealed_sql_sha_mismatch" }

$validationRaw = & node $ValidatorPath
if ($LASTEXITCODE -ne 0) { Stop-Safely "sealed_static_validation_failed" }
$validation = $validationRaw | ConvertFrom-Json
if (-not $validation.ok -or $validation.sqlSha256 -ne $definition.SqlSha) {
  Stop-Safely "sealed_static_contract_mismatch"
}

if (-not $Execute) {
  [pscustomobject]@{
    ok = $true
    safeCode = "select_only_contract_ready"
    contract = $Contract
    executionApproved = $false
    executionAttempted = $false
    mutationExecuted = $false
    rawOutputPrinted = $false
    projectIdentityPrinted = $false
  } | ConvertTo-Json -Compress | Write-Output
  exit 0
}

if ($env:HUB_CORE_SELECT_ONLY_EXECUTION_APPROVED -ne $ApprovalMarker) {
  Stop-Safely "fresh_explicit_approval_missing"
}

$LinkedProjectDir = $env:HUB_CORE_LINKED_PROJECT_DIR
if ([string]::IsNullOrWhiteSpace($LinkedProjectDir)) { Stop-Safely "linked_project_directory_missing" }
$ProjectRefPath = Join-Path $LinkedProjectDir "supabase\.temp\project-ref"
if (-not (Test-Path -LiteralPath $ProjectRefPath)) { Stop-Safely "linked_project_identity_missing" }
$projectRef = (Get-Content -LiteralPath $ProjectRefPath -Raw -Encoding UTF8).Trim()
if ((Get-ValueSha256 $projectRef) -ne $ExpectedProjectRefSha256) {
  Stop-Safely "production_target_identity_mismatch"
}

$cliVersion = (& npx.cmd supabase --version 2>$null | Out-String).Trim()
if ($cliVersion -ne $ExpectedCliVersion) { Stop-Safely "supabase_cli_version_mismatch" }

$stdoutPath = [IO.Path]::GetTempFileName()
$stderrPath = [IO.Path]::GetTempFileName()
try {
  $arguments = "supabase db query --linked --output-format json --file `"$SqlPath`" --workdir `"$LinkedProjectDir`""
  $process = Start-Process -FilePath "npx.cmd" -ArgumentList $arguments -Wait -PassThru -WindowStyle Hidden `
    -RedirectStandardOutput $stdoutPath -RedirectStandardError $stderrPath
  if ($process.ExitCode -ne 0) { Stop-Safely "select_only_execution_failed" $true }

  $parsed = Convert-SanitizedJson (Get-Content -LiteralPath $stdoutPath -Raw -Encoding UTF8)
  if ($null -eq $parsed) { Stop-Safely "sanitized_result_parse_failed" $true }
  $row = @($parsed) | Select-Object -First 1
  if ($null -eq $row) { Stop-Safely "sanitized_result_missing" $true }

  $result = [ordered]@{
    ok = $true
    safeCode = "select_only_precheck_complete"
    contract = $Contract
  }
  foreach ($field in $definition.ResultFields) {
    if (-not ($row.PSObject.Properties.Name -contains $field)) {
      Stop-Safely "sanitized_result_shape_mismatch" $true
    }
    $result[$field] = $row.$field
  }
  $result["executionAttempted"] = $true
  $result["mutationExecuted"] = $false
  $result["rawOutputPrinted"] = $false
  $result["projectIdentityPrinted"] = $false
  [pscustomobject]$result | ConvertTo-Json -Compress | Write-Output
} finally {
  Remove-Item -LiteralPath $stdoutPath -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath $stderrPath -Force -ErrorAction SilentlyContinue
  Remove-Item Env:HUB_CORE_SELECT_ONLY_EXECUTION_APPROVED -ErrorAction SilentlyContinue
}
