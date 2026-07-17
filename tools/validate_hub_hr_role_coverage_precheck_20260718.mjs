import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sql = fs.readFileSync(path.join(root, "supabase", "hub-hr-role-coverage-select-only-precheck-20260718.sql"), "utf8").replace(/\r\n/g, "\n");
const withoutComments = sql.replace(/^\s*--.*$/gm, "");
const statementTokens = withoutComments.replace(/'(?:''|[^'])*'/g, "''");
const checks = {
  selectOnly: /^\s*with\b[\s\S]*\bselect\b[\s\S]*;\s*$/i.test(withoutComments),
  noMutation: !/\b(insert|update|delete|merge|truncate|alter|drop|create|grant|revoke|call|do|execute|copy)\b/i.test(statementTokens),
  roleKeysFixed: sql.includes("'hr.staff'") && sql.includes("'hr.admin'"),
  aggregateProjectionOnly: ["active_hr_role_definition_count", "active_hr_role_assignment_count", "distinct_assigned_employee_count", "active_assigned_employee_count", "login_ready_employee_count", "missing_credential_count", "login_disabled_count", "currently_locked_count", "duplicate_active_assignment_group_count", "all_scope_assignment_count"].every((field) => sql.includes(`as ${field}`)),
  noPersonalProjection: !/\bas\s+(employee_id|full_name|email|login_email|pin_hash|locked_until)\b/i.test(withoutComments),
  employeeActiveChecked: sql.includes("e.is_active is distinct from false"),
  loginBoundaryChecked: ["login_enabled", "locked_until", "credential_present"].every((value) => sql.includes(value)),
  duplicateBoundaryChecked: sql.includes("assignment_count > 1"),
  noRawRows: !/select\s+\*\s+from/i.test(withoutComments)
};
const failedChecks = Object.entries(checks).filter(([, ok]) => !ok).map(([name]) => name);
console.log(JSON.stringify({ ok: failedChecks.length === 0, checkCount: Object.keys(checks).length, failedChecks, sqlSha256: crypto.createHash("sha256").update(sql).digest("hex").toUpperCase(), productionQueryExecuted: false, personalValuesProjected: false, mutationExecuted: false }));
if (failedChecks.length) process.exitCode = 1;
