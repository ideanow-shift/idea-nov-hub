import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const read = (name) =>
  fs.readFileSync(path.join(root, "supabase", name), "utf8");

const precheck = read("portal-apps-zero-gas-cutover-precheck-20260718.sql");
const forward = read("portal-apps-zero-gas-cutover-candidate-20260718.sql");
const rollback = read(
  "portal-apps-zero-gas-cutover-rollback-candidate-20260718.sql",
);
const executable = `${precheck}\n${forward}\n${rollback}`;
const sqlWithoutComments = (value) => value.replace(/^--.*$/gm, "");

const retiredPaths = [
  "portal-apps-display-fix-candidate-20260717.sql",
  "portal-apps-display-fix-rollback-candidate-20260717.sql",
  "portal-apps-display-fix-sealed-20260717.sql",
  "portal-apps-display-fix-sealed-rollback-20260717.sql",
].map((name) => path.join(root, "supabase", name));

const checks = {
  legacyExecutablesAbsent: retiredPaths.every((value) => !fs.existsSync(value)),
  noLegacyEndpoint: !/script\.google|google\.script|\/macros\/s\/|AKfy/i.test(
    executable,
  ),
  precheckSelectOnly:
    !/\b(update|insert|delete|alter|drop|grant|revoke|create|truncate)\b/i.test(
      sqlWithoutComments(precheck),
    ),
  localEducationRoute: forward.includes("url = './education-app/'"),
  ideaLinkGuarded: forward.includes("url = './idea-link-app/'"),
  thanksDisabled: forward.includes("app.app_id = 'THANKS'") &&
    forward.includes("is_active = false") &&
    forward.includes("is_featured = false"),
  transactionAndTimeouts: [forward, rollback].every((value) =>
    /^begin;/m.test(value) && /commit;\s*$/m.test(value) &&
    value.includes("statement_timeout = '15s'") &&
    value.includes("lock_timeout = '5s'")
  ),
  rollbackNeverRestoresUrl:
    !/set\s+url\s*=/i.test(sqlWithoutComments(rollback)) &&
    rollback.includes("legacyUrlRestored', false"),
  rollbackDoesNotEnable: !/is_active\s*=\s*true|is_featured\s*=\s*true/i.test(
    sqlWithoutComments(rollback),
  ),
  noBroadMutation: [forward, rollback].every((value) =>
    !/\b(insert|delete|alter|drop|grant|revoke|create|truncate)\b/i.test(
      sqlWithoutComments(value),
    )
  ),
  noExecutionRunner: !fs.existsSync(
    path.join(root, "tools", "run_portal_apps_display_fix_sealed_20260717.ps1"),
  ),
};

const failed = Object.entries(checks).filter(([, ok]) => !ok).map(([name]) =>
  name
);
const result = {
  ok: failed.length === 0,
  safeCode: failed.length === 0
    ? "portal_apps_zero_gas_static_pass"
    : "portal_apps_zero_gas_static_failed",
  checkCount: Object.keys(checks).length,
  failedChecks: failed,
  productionMutationExecuted: false,
};

process.stdout.write(`${JSON.stringify(result)}\n`);
if (failed.length) process.exitCode = 1;
