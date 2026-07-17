import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..");
const sqlPath = path.join(repoRoot, "supabase", "portal-apps-display-fix-sealed-20260717.sql");
const rollbackPath = path.join(repoRoot, "supabase", "portal-apps-display-fix-sealed-rollback-20260717.sql");
const executorPath = path.join(repoRoot, "tools", "run_portal_apps_display_fix_sealed_20260717.ps1");

const sql = fs.readFileSync(sqlPath, "utf8");
const rollback = fs.readFileSync(rollbackPath, "utf8");
const executor = fs.readFileSync(executorPath, "utf8");
const sha256 = (value) => crypto.createHash("sha256")
  .update(value.replace(/\r\n/g, "\n"))
  .digest("hex")
  .toUpperCase();

const checks = {
  transaction: /^begin;[\s\S]*commit;\s*$/m.test(sql),
  timeouts: ["statement_timeout = '15s'", "lock_timeout = '5s'", "idle_in_transaction_session_timeout = '20s'"].every((v) => sql.includes(v)),
  lockedTargetsOnly: sql.includes("where app_id in ('EDU', 'THANKS', 'idea-link')") && sql.includes("for update"),
  exactPreconditions: ["target_count = 3", "edu_exact_count = 1", "thanks_exact_count = 1", "idea_link_exact_count = 1"].every((v) => sql.includes(v)),
  exactUpdateTargets: (sql.match(/where app\.app_id = 'EDU'/g) || []).length === 1
    && (sql.match(/where app\.app_id = 'THANKS'/g) || []).length === 1,
  maxTwoRows: sql.includes("edu_updated_count + thanks_updated_count = 2"),
  safeOutput: ["portal_apps_display_fix_applied", "rawValuesPrinted", "rollbackExecuted"].every((v) => sql.includes(v)),
  ideaLinkNeverUpdated: !/update\s+public\.portal_apps[\s\S]{0,500}where\s+app\.app_id\s*=\s*'idea-link'/i.test(sql),
  noInsertDelete: !/\b(insert|delete|truncate|alter|drop|grant|revoke|create)\b/i.test(sql.replace(/^--.*$/gm, "")),
  rollbackPreparedOnly: rollback.includes("PREPARED ONLY") && rollback.includes("separate approval"),
  rollbackNoAutomationReference: !/Start-Process|Invoke-Expression|child_process|exec\(/i.test(rollback),
  cliIdentityFixed: executor.includes('$ExpectedCliVersion = "2.109.1"'),
  productionIdentityFixed: executor.includes('$ExpectedProjectRefSha256 = "D5C7FC778E9AAEE37351272C5659ED02534968A0C68DE2BA826C4FEC1CBD1EF4"'),
  sqlIdentityFixed: executor.includes('$ExpectedSqlSha256 = "9E5F6C6BFD093775ABA00DB8C27648B5862F7F975C99934A94E61BEED5524EC9"'),
  linkedCliCommandFixed: executor.includes("npx.cmd supabase db query --linked --output-format json --file $SqlPath --workdir $LinkedProjectDir"),
  rollbackNotInvoked: !executor.includes("portal-apps-display-fix-sealed-rollback-20260717.sql"),
  sanitizedExecutorOutput: ["rawValuesPrinted = $false", "rollbackExecuted = $false", "otherRowsUpdated = $false"].every((v) => executor.includes(v)),
};

const failed = Object.entries(checks).filter(([, ok]) => !ok).map(([name]) => name);
const result = {
  ok: failed.length === 0,
  safeCode: failed.length === 0 ? "sealed_static_validation_passed" : "sealed_static_validation_failed",
  checkCount: Object.keys(checks).length,
  failedChecks: failed,
  sqlSha256: sha256(sql),
  rollbackSha256: sha256(rollback),
  productionMutationExecuted: false,
  rawValuesPrinted: false,
};

process.stdout.write(`${JSON.stringify(result)}\n`);
if (failed.length) process.exitCode = 1;
