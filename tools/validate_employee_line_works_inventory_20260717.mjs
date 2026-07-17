import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sqlPath = path.join(root, "supabase", "employee-line-works-destination-select-only-inventory-20260717.sql");
const sql = fs.readFileSync(sqlPath, "utf8");
const normalized = sql.replace(/\r\n/g, "\n");
const withoutComments = normalized.replace(/^\s*--.*$/gm, "");
const statementTokens = withoutComments.replace(/'(?:''|[^'])*'/g, "''");

const checks = {
  selectOnly: /^\s*with\b[\s\S]*\bselect\b[\s\S]*;\s*$/i.test(withoutComments),
  noMutation: !/\b(insert|update|delete|merge|truncate|alter|drop|create|grant|revoke|call|do|execute|copy)\b/i.test(statementTokens),
  catalogOnly: !/\bfrom\s+os\.notification_destinations\b/i.test(withoutComments),
  noDestinationRowRead: !/\bchannel_id\s*(=|,|from|as)/i.test(withoutComments),
  requiredRpcInventory: [
    "get_employee_line_works_destination",
    "upsert_employee_line_works_destination",
    "disable_employee_line_works_destination"
  ].every((name) => normalized.includes(`'${name}'`)),
  tableBoundaryInventory: ["relrowsecurity", "relforcerowsecurity", "pg_policies", "table_privileges"].every((value) => normalized.includes(value)),
  browserBoundaryInventory: ["browser_policy_count", "browser_privilege_count", "browser_execute_count"].every((value) => normalized.includes(value)),
  noRawDefinitionOutput: !/\bas\s+(constraint_definition|policy_expression|function_body)\b/i.test(withoutComments)
};

const failed = Object.entries(checks).filter(([, ok]) => !ok).map(([name]) => name);
console.log(JSON.stringify({
  ok: failed.length === 0,
  checkCount: Object.keys(checks).length,
  failedChecks: failed,
  sqlSha256: crypto.createHash("sha256").update(normalized).digest("hex").toUpperCase(),
  productionQueryExecuted: false,
  destinationRowsRead: false
}));
if (failed.length) process.exitCode = 1;
