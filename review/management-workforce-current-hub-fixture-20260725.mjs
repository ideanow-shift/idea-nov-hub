import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import {
  SANITIZED_WORKFORCE_EVIDENCE,
  localWorkforceAggregateMetric,
  validateWorkforceAllocationCsv,
  validateWorkforceEvidenceModel,
  workforceProductionSubmissionStatus,
} from "../portal/js/management-workforce-evidence-status.js";

const root = process.cwd();
const currentHubPath = path.join(root, "review/current-hub-employee-store-workforce-template-20260725.csv");
const sampleCurrentHubCsv = [
  '"元_所属","元_主店舗名","元_部署","対象件数","経営管理_店舗","経営管理_配賦区分","経営管理_在籍人数区分","経営管理_稼働人数区分","経営管理_法人状態","経営管理_確認ステータス","備考"',
  '"本部","主店舗未入力","経理部","1","本部","HQ_OR_SHARED","INCLUDE_RESIDENT","INCLUDE_WORKING","CORPORATION_MAPPING_SEPARATE","DRAFT_FROM_CURRENT_HUB_EXPORT","匿名サンプル"',
  '"店舗A","店舗A","部署未入力","188","店舗A","STORE","INCLUDE_RESIDENT","INCLUDE_WORKING","CORPORATION_MAPPING_SEPARATE","DRAFT_FROM_CURRENT_HUB_EXPORT","匿名サンプル"',
  '"店舗B","店舗B","部署未入力","1","店舗B","STORE","INCLUDE_RESIDENT","EXCLUDE_NON_WORKING_LEAVE","CORPORATION_MAPPING_SEPARATE","DRAFT_FROM_CURRENT_HUB_EXPORT","匿名サンプル"',
  "",
].join("\r\n");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const sampleReceipt = validateWorkforceAllocationCsv(sampleCurrentHubCsv);
assert(sampleReceipt.status === "WORKFORCE_STORE_MASTER_LOCAL_EVIDENCE", "current HUB employee aggregate CSV shape should pass");
assert(sampleReceipt.residentCount === 190, "resident count should include leave");
assert(sampleReceipt.workingCount === 189, "working count should exclude leave");
assert(sampleReceipt.nonWorkingResidentCount === 1, "leave should be resident-only");
assert(sampleReceipt.unassignedReviewCount === 0, "current active unassigned review count should be zero");

let localReceipt = null;
if (fs.existsSync(currentHubPath)) {
  const currentHubCsv = fs.readFileSync(currentHubPath, "utf8");
  localReceipt = validateWorkforceAllocationCsv(currentHubCsv);
  assert(localReceipt.status === "WORKFORCE_STORE_MASTER_LOCAL_EVIDENCE", "local current HUB employee aggregate CSV should pass");
  assert(localReceipt.departmentCount === 32, "local current HUB aggregate rows should be fixed at 32");
  assert(localReceipt.residentCount === 190, "local resident count should include leave");
  assert(localReceipt.workingCount === 189, "local working count should exclude leave");
  assert(localReceipt.nonWorkingResidentCount === 1, "local leave should be resident-only");
  assert(localReceipt.unassignedReviewCount === 0, "local current active unassigned review count should be zero");
}

const sensitive = sampleCurrentHubCsv.replace("元_所属", "氏名");
assert(validateWorkforceAllocationCsv(sensitive).status === "WORKFORCE_ALLOCATION_FORMAT_INVALID", "sensitive key should fail close");

const wrongCorporationStatus = sampleCurrentHubCsv.replace("CORPORATION_MAPPING_SEPARATE", "ALBERO");
assert(validateWorkforceAllocationCsv(wrongCorporationStatus).status === "WORKFORCE_ALLOCATION_FORMAT_INVALID", "corporation inference should fail close");

const wrongResidentKind = sampleCurrentHubCsv.replace("INCLUDE_RESIDENT", "EXCLUDE_RESIDENT");
assert(validateWorkforceAllocationCsv(wrongResidentKind).status === "WORKFORCE_ALLOCATION_FORMAT_INVALID", "unknown resident category should fail close");

assert(validateWorkforceEvidenceModel(SANITIZED_WORKFORCE_EVIDENCE), "sanitized evidence model should remain exact");
assert(localWorkforceAggregateMetric() === "社員マスタ 189名", "local aggregate label should use working count");
const submissionStatus = workforceProductionSubmissionStatus();
assert(submissionStatus.category === "LOCAL_READY_PRODUCTION_DISABLED", "production submission route should remain disabled");
assert(submissionStatus.readyForProduction === false, "production submission must fail close");
assert(submissionStatus.items.length === 4, "production submission checklist should be fixed");
assert(submissionStatus.items.some((item) => item.category === "BACKEND_STAGING_CONTRACT_MISSING"), "backend staging contract should be explicit");

console.log(JSON.stringify({
  passed: true,
  currentHubEmployeeStoreWorkforceCsv: "WORKFORCE_STORE_MASTER_LOCAL_EVIDENCE",
  sampleRows: sampleReceipt.departmentCount,
  localRows: localReceipt?.departmentCount ?? null,
  resident: sampleReceipt.residentCount,
  working: sampleReceipt.workingCount,
  nonWorkingResident: sampleReceipt.nonWorkingResidentCount,
  unassignedReview: sampleReceipt.unassignedReviewCount,
  submissionCategory: submissionStatus.category,
  submissionItems: submissionStatus.items.length,
  productionMutation: 0,
  personalDataExposure: 0,
}, null, 2));
