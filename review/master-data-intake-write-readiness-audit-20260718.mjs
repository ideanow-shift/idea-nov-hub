import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const source = fs.readFileSync(path.join(root, "portal", "master-admin", "master-admin.js"), "utf8");
const evidenceText = fs.readFileSync(
  path.join(root, "review", "master-data-intake-write-shape-production-evidence-20260718.json"),
  "utf8"
).replace(/^\uFEFF/, "");
const evidence = JSON.parse(evidenceText);

const intakeStart = source.indexOf("const DATA_INTAKE_TARGETS = {");
const intakeEnd = source.indexOf("const state =", intakeStart);
if (intakeStart < 0 || intakeEnd < 0) throw new Error("DATA_INTAKE_SOURCE_NOT_FOUND");
const intake = source.slice(intakeStart, intakeEnd);

const columns = new Map(evidence.columns.map((column) => [
  `${column.table_name}.${column.column_name}`,
  column
]));
const isRequiredWithoutDefault = (table, column) => {
  const item = columns.get(`${table}.${column}`);
  return Boolean(item && item.is_nullable === "NO" && item.has_default === false);
};

const checks = {
  targetCountExact: ["employees:", "stores:", "corporations:"].every((token) => intake.includes(token)),
  corporationCodeDbRequired: isRequiredWithoutDefault("corporations", "corporation_code"),
  corporationCodeHeaderPresent: intake.includes('"法人コード"'),
  storeNumberDbRequired: isRequiredWithoutDefault("stores", "store_no"),
  storeNumberMarkedRequired: /stores:[\s\S]*?requiredHeaders:\s*\[[^\]]*"店舗No"/.test(intake),
  employeeAffiliationCombined: /employees:[\s\S]*?optionalHeaders:\s*\[[^\]]*"所属"/.test(intake),
  employeeForeignKeyCount: ["corporation_id", "department_id", "store_id", "position_id", "job_type_id"]
    .filter((column) => columns.has(`employees.${column}`)).length
};

if (!checks.targetCountExact || !checks.corporationCodeDbRequired || !checks.storeNumberDbRequired) {
  throw new Error("AUTHORITATIVE_SOURCE_IDENTITY_NOT_EXACT");
}

const gaps = [
  checks.corporationCodeDbRequired && !checks.corporationCodeHeaderPresent,
  checks.storeNumberDbRequired && !checks.storeNumberMarkedRequired,
  checks.employeeAffiliationCombined && checks.employeeForeignKeyCount > 1
].filter(Boolean).length;

process.stdout.write(JSON.stringify({
  result: gaps === 3 ? "WRITE_CONTRACT_PRODUCT_DECISION_REQUIRED" : "WRITE_CONTRACT_UNEXPECTED_STATE",
  targetCount: 3,
  gapCount: gaps,
  corporationCreateReady: false,
  storeCreateReady: false,
  employeeAffiliationResolutionReady: false,
  productionAccessCount: 0,
  mutationCount: 0
}) + "\n");
