import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const runner = fs.readFileSync(
  path.join(root, "tools", "run_hub_core_select_only_prechecks_20260717.ps1"),
  "utf8"
).replace(/\r\n/g, "\n");

const checks = {
  validateOnlyByDefault: runner.includes("if (-not $Execute)") && runner.includes('safeCode = "select_only_contract_ready"'),
  explicitApprovalRequired: runner.includes("HUB_CORE_SELECT_ONLY_EXECUTION_APPROVED") && runner.includes("fresh_explicit_approval_missing"),
  projectIdentityPinned: runner.includes("ExpectedProjectRefSha256") && runner.includes("production_target_identity_mismatch"),
  sqlHashesPinned: [
    "992E37261B93810C0C4B8F55D3FEF94A8BCF19E8ADEEDB9F5C2BA80432259F0E",
    "85E433A97A6CA24BF3048B9D82E6BBB8C57DB8C670606C1579F79DEA3CFBBBDF"
  ].every((value) => runner.includes(value)),
  cliVersionPinned: runner.includes('$ExpectedCliVersion = "2.109.1"'),
  linkedOnly: runner.includes("db query --linked") && runner.includes("supabase\\.temp\\project-ref"),
  rawOutputNotPrinted: !/Write-Output\s+\$?(raw|parsed|row|projectRef)/i.test(runner),
  tempOutputRemoved: runner.includes("Remove-Item -LiteralPath $stdoutPath") && runner.includes("Remove-Item -LiteralPath $stderrPath"),
  mutationReportedFalse: runner.includes('mutationExecuted = $false'),
  twoContractsFixed: runner.includes('"line-works"') && runner.includes('"data-intake"')
};

const failedChecks = Object.entries(checks).filter(([, ok]) => !ok).map(([name]) => name);
console.log(JSON.stringify({
  ok: failedChecks.length === 0,
  checkCount: Object.keys(checks).length,
  failedChecks,
  productionQueryExecuted: false,
  mutationExecuted: false
}));
if (failedChecks.length) process.exitCode = 1;
