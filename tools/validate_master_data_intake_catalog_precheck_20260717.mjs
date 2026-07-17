import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sql = fs.readFileSync(path.join(root, "supabase", "master-data-intake-catalog-select-only-precheck-20260717.sql"), "utf8").replace(/\r\n/g, "\n");
const withoutComments = sql.replace(/^\s*--.*$/gm, "");
const statementTokens = withoutComments.replace(/'(?:''|[^'])*'/g, "''");
const checks = {
  selectOnly: /^\s*with\b[\s\S]*\bselect\b[\s\S]*;\s*$/i.test(withoutComments),
  noMutation: !/\b(insert|update|delete|merge|truncate|alter|drop|create|grant|revoke|call|do|execute|copy)\b/i.test(statementTokens),
  catalogOnly: !/\bfrom\s+public\.(employees|stores|corporations|master_change_logs)\b/i.test(withoutComments),
  requiredTablesFixed: ["employees", "stores", "corporations", "master_change_logs"].every((name) => sql.includes(`('${name}')`) || sql.includes(`'${name}'`)),
  naturalKeysFixed: ["employee_id", "store_id", "corporation_no"].every((name) => sql.includes(`'${name}'`)),
  auditShapeChecked: ["action_type", "target_name", "change_summary"].every((name) => sql.includes(`'${name}'`)),
  browserWritesChecked: ["browser_write_privilege_count", "TRUNCATE", "TRIGGER", "REFERENCES"].every((name) => sql.includes(name)),
  noRowValuesProjected: !/\b(full_name|store_name|corporation_name|changed_by_email|change_payload)\s+as\b/i.test(withoutComments)
};
const failed = Object.entries(checks).filter(([, ok]) => !ok).map(([name]) => name);
console.log(JSON.stringify({
  ok: failed.length === 0,
  checkCount: Object.keys(checks).length,
  failedChecks: failed,
  sqlSha256: crypto.createHash("sha256").update(sql).digest("hex").toUpperCase(),
  productionQueryExecuted: false,
  businessRowsRead: false
}));
if (failed.length) process.exitCode = 1;
