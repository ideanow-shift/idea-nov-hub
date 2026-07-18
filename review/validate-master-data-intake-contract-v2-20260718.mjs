import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const candidate = JSON.parse(fs.readFileSync(
  path.join(here, "master-data-intake-contract-v2-candidate-20260718.json"),
  "utf8"
).replace(/^\uFEFF/, ""));

const exactTargets = ["employees", "stores", "corporations"];
const targetKeys = Object.keys(candidate.targets).sort();
if (JSON.stringify(targetKeys) !== JSON.stringify([...exactTargets].sort())) throw new Error("TARGETS_NOT_EXACT");
if (candidate.schemaVersion !== 2) throw new Error("SCHEMA_VERSION_NOT_EXACT");
if (candidate.blankOptionalCell !== "no_change" || candidate.explicitClearSupported !== false) throw new Error("BLANK_CONTRACT_NOT_EXACT");
if (candidate.batchFailureMode !== "atomic_fail_close") throw new Error("FAILURE_MODE_NOT_EXACT");

const employees = candidate.targets.employees;
const stores = candidate.targets.stores;
const corporations = candidate.targets.corporations;

const checks = {
  employeeNaturalKeyImmutable: employees.immutableAfterCreate.includes("社員番号"),
  combinedAffiliationRemoved: !employees.optional.includes("所属") && employees.combinedDisplayFieldsAcceptedForWrite === false,
  employeeTypedReferencesPresent: ["法人コード", "店舗ID", "部署コード", "役職コード", "職種コード"].every((item) => employees.optional.includes(item)),
  storeNumberRequiredOnCreate: stores.requiredOnCreate.includes("店舗No"),
  storeKeysImmutable: ["店舗ID", "店舗No"].every((item) => stores.immutableAfterCreate.includes(item)),
  corporationCodeRequiredOnCreate: corporations.requiredOnCreate.includes("法人コード"),
  corporationKeysImmutable: ["法人No", "法人コード"].every((item) => corporations.immutableAfterCreate.includes(item)),
  ambiguousReferenceFailsClosed: employees.referenceResolution === "exact_active_canonical_code" && stores.referenceResolution === "exact_active_canonical_code",
  pendingMetadataExplicit: Array.isArray(candidate.pendingMetadataConfirmation) && candidate.pendingMetadataConfirmation.length === 3
};

const passed = Object.values(checks).filter(Boolean).length;
if (passed !== Object.keys(checks).length) throw new Error("CONTRACT_CHECK_FAILED");

process.stdout.write(JSON.stringify({
  result: "DATA_INTAKE_CONTRACT_V2_CANDIDATE_PASS",
  checkCount: passed,
  targetCount: targetKeys.length,
  runtimeChangeCount: 0,
  productionAccessCount: 0,
  mutationCount: 0
}) + "\n");
