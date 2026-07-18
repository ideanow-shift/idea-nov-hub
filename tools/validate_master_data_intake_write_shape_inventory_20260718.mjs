import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const root = path.resolve(import.meta.dirname, "..");
const file = path.join(root, "supabase", "master-data-intake-write-shape-select-only-inventory-20260718.sql");
const sql = fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n");
const code = sql.replace(/^\s*--.*$/gm, "").trim();

const forbidden = /\b(insert|update|delete|merge|truncate|alter|create|drop|grant|revoke|call|do|execute|copy|vacuum|analyze|refresh|listen|notify)\b/i;
const requiredTables = [
  "employees",
  "stores",
  "corporations",
  "store_business_profiles",
  "corporation_business_profiles",
  "master_change_logs",
];

const checks = [
  ["single SELECT/CTE statement", /^with\b[\s\S]+\bselect\b[\s\S]+;$/i.test(code) && (code.match(/;/g) || []).length === 1],
  ["mutation keywords absent", !forbidden.test(code)],
  ["row tables used only as catalog target names", !/\bfrom\s+public\.(employees|stores|corporations|master_change_logs)\b/i.test(code)],
  ["column defaults are not exposed", /case when c\.column_default is null then false else true end as has_default/i.test(code)],
  ["catalog sources only", ["information_schema.columns", "pg_catalog.pg_constraint", "pg_catalog.pg_indexes", "information_schema.table_privileges", "pg_catalog.pg_class"].every((name) => sql.includes(name))],
  ...requiredTables.map((name) => [`target ${name}`, sql.includes(`'${name}'`)]),
];

const failed = checks.filter(([, ok]) => !ok).map(([name]) => name);
if (failed.length) {
  console.error(JSON.stringify({ ok: false, failed }));
  process.exit(1);
}

console.log(JSON.stringify({
  ok: true,
  checkCount: checks.length,
  sqlSha256: crypto.createHash("sha256").update(sql).digest("hex").toUpperCase(),
  productionQueryExecuted: false,
  businessRowsRead: false,
}));
