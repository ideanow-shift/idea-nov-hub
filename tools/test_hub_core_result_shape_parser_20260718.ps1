Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Find-ContractRow($Node, [string[]]$ExpectedFields) {
  if ($null -eq $Node) { return $null }
  if ($Node -is [string] -or $Node -is [ValueType]) { return $null }
  if ($Node -is [System.Collections.IEnumerable] -and -not ($Node -is [pscustomobject])) {
    foreach ($item in $Node) {
      $found = Find-ContractRow $item $ExpectedFields
      if ($null -ne $found) { return $found }
    }
    return $null
  }
  $properties = @($Node.PSObject.Properties)
  $propertyNames = @($properties | ForEach-Object { $_.Name })
  if (@($ExpectedFields | Where-Object { $propertyNames -notcontains $_ }).Count -eq 0) { return $Node }
  foreach ($property in $properties) {
    $found = Find-ContractRow $property.Value $ExpectedFields
    if ($null -ne $found) { return $found }
  }
  return $null
}

$fields = @("alpha_count", "ready")
$row = [pscustomobject]@{ alpha_count = 2; ready = $true }
$fixtures = @(
  $row,
  @($row),
  [pscustomobject]@{ result = @($row) },
  [pscustomobject]@{ data = [pscustomobject]@{ rows = @($row) } }
)

$passed = 0
foreach ($fixture in $fixtures) {
  $found = Find-ContractRow $fixture $fields
  if ($null -eq $found -or $found.alpha_count -ne 2 -or $found.ready -ne $true) {
    throw "result_shape_fixture_failed"
  }
  $passed++
}

[pscustomobject]@{
  ok = $true
  fixtureCount = $fixtures.Count
  passedCount = $passed
  productionQueryExecuted = $false
  rawOutputPrinted = $false
} | ConvertTo-Json -Compress | Write-Output
