import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  SANITIZED_WORKFORCE_EVIDENCE,
  WORKFORCE_EVIDENCE_CATEGORIES,
  buildWorkforceAllocationTemplateCsv,
  canDisplayWorkforceAggregates,
  localWorkforceAggregateMetric,
  mountWorkforceEvidenceStatus,
  renderWorkforceEvidenceStatus,
  validateWorkforceAllocationCsv,
  validateWorkforceEvidenceModel,
  workforceAllocationTemplateFile,
} from "../portal/js/management-workforce-evidence-status.js";
import { renderClassificationWorkspace } from "../portal/management-platform/classification-readiness-panel.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const managementIndex = fs.readFileSync(path.join(root, "portal/management-app/index.html"), "utf8");
const managementApp = fs.readFileSync(path.join(root, "portal/management-app/app-v2.js"), "utf8");
const managementStyles = fs.readFileSync(path.join(root, "portal/management-app/styles.css"), "utf8");
const visualFixture = fs.readFileSync(path.join(root, "tests/fixtures/management-workforce-evidence-status.html"), "utf8");

test("workforce evidence categories are fixed and local source remains runtime fail-closed", () => {
  assert.deepEqual(WORKFORCE_EVIDENCE_CATEGORIES, [
    "AUTHORITATIVE_READY",
    "LOCAL_VALIDATED_PENDING_PRODUCTION",
    "SOURCE_CONTRACT_INCOMPLETE",
    "UNAVAILABLE",
  ]);
  assert.equal(validateWorkforceEvidenceModel(SANITIZED_WORKFORCE_EVIDENCE), true);
  assert.equal(SANITIZED_WORKFORCE_EVIDENCE.category, "LOCAL_VALIDATED_PENDING_PRODUCTION");
  assert.equal(SANITIZED_WORKFORCE_EVIDENCE.aggregateValuesVisible, true);
  assert.equal(SANITIZED_WORKFORCE_EVIDENCE.relatedActionsEnabled, false);
  assert.equal(localWorkforceAggregateMetric(), "社員マスタ 190名");
  assert.equal(canDisplayWorkforceAggregates(), false);
  assert.equal(validateWorkforceEvidenceModel({ ...SANITIZED_WORKFORCE_EVIDENCE, category: "AUTHORITATIVE_READY" }), false);
  assert.equal(localWorkforceAggregateMetric({ ...SANITIZED_WORKFORCE_EVIDENCE, category: "AUTHORITATIVE_READY" }), null);
});

test("status output uses employee master aggregates without identities", () => {
  const html = renderWorkforceEvidenceStatus();
  assert.match(html, /data-workforce-evidence-category="LOCAL_VALIDATED_PENDING_PRODUCTION"/);
  assert.match(html, /社員マスタを正本として在職・退職・所属部門をローカル集計済み/);
  assert.match(html, /個人を特定できる項目やセンシティブ項目は表示しません/);
  assert.match(html, /社員マスタ \+ 退職者月別推移表/);
  assert.match(html, /社員マスタ行<\/dt><dd>431件/);
  assert.match(html, /在職<\/dt><dd>190名/);
  assert.match(html, /退職\/退職日あり<\/dt><dd>241名/);
  assert.match(html, /所属部門<\/dt><dd>22区分/);
  assert.match(html, /所属なし在職<\/dt><dd>29名/);
  assert.match(html, /法人配賦<\/dt><dd>未収録/);
  assert.match(html, /店舗配賦<\/dt><dd>未収録/);
  assert.match(html, /退職補助証跡<\/dt><dd>5シート/);
  assert.match(html, /<button type="button" disabled aria-disabled="true"/);
  assert.match(html, /部門配賦CSVを保存/);
  assert.match(html, /配賦CSVを確認/);
  assert.match(html, /data-workforce-allocation-input/);
  assert.match(html, /management-workforce-department-allocation-template\.csv/);
  assert.doesNotMatch(html, /employeeId|employee_id|社員番号|氏名|salary|給与|評価|健康|個人名|digest|sha256/i);
});

test("allocation template is department scoped and contains no personal identifiers", () => {
  const csv = buildWorkforceAllocationTemplateCsv();
  const file = workforceAllocationTemplateFile();
  assert.equal(csv.charCodeAt(0), 0xFEFF);
  assert.match(csv, /^\uFEFF"所属部門","法人配賦","店舗配賦","配賦区分","備考"/u);
  assert.match(csv, /"UNASSIGNED_REVIEW"/u);
  assert.equal(file.fileName, "management-workforce-department-allocation-template.csv");
  assert.equal(file.mimeType, "text/csv;charset=utf-8;header=present");
  assert.equal(file.rowCount, 18);
  assert.match(csv, /"店舗運営","IDEA NOV","BASSA所沢店","STORE"/u);
  assert.match(csv, /"FC店舗候補","UNO","BASSA久米川店","STORE"/u);
  assert.match(csv, /"BASSA所沢店アシスタント","IDEA NOV","BASSA所沢店","STORE"/u);
  assert.match(csv, /"総務","IDEA NOV","本部","HQ_OR_SHARED"/u);
  assert.match(csv, /"法人のみ判明","BIOEL","","UNASSIGNED_REVIEW"/u);
  assert.match(csv, /"不明部門","","","UNASSIGNED_REVIEW"/u);
  assert.match(file.href, /^data:text\/csv;charset=utf-8,/u);
  assert.doesNotMatch(csv, /employeeId|employee_id|社員番号|氏名|給与|評価|健康|個人名|メール|電話|住所|token|session|digest|sha256/i);
});

test("allocation receipt validates only aggregate department scope evidence", () => {
  const ready = [
    "所属部門,法人配賦,店舗配賦,配賦区分,備考",
    "本部,IDEA NOV,本部,HQ_OR_SHARED,共有部門",
    "店舗A,IDEA NOV,BASSA所沢店,STORE,店舗配賦",
    "所属なし,,,UNASSIGNED_REVIEW,要確認",
  ].join("\n");
  assert.deepEqual(validateWorkforceAllocationCsv(ready), {
    status: "WORKFORCE_ALLOCATION_LOCAL_EVIDENCE",
    departmentCount: 3,
    storeMappedCount: 1,
    unassignedReviewCount: 1,
  });
  assert.equal(validateWorkforceAllocationCsv("所属部門,法人配賦,店舗配賦,配賦区分,備考\n店舗A,IDEA NOV,,STORE,\n").status, "WORKFORCE_ALLOCATION_SCOPE_INCOMPLETE");
  assert.equal(validateWorkforceAllocationCsv("所属部門,法人配賦,店舗配賦,配賦区分,備考\n店舗A,IDEA NOV,BASSA所沢店,BAD,\n").status, "WORKFORCE_ALLOCATION_FORMAT_INVALID");
  assert.equal(validateWorkforceAllocationCsv("所属部門,法人配賦,店舗配賦,配賦区分,備考\n店舗A,IDEA NOV,BASSA所沢店,STORE,\n店舗A,IDEA NOV,BASSA所沢店,STORE,\n").status, "WORKFORCE_ALLOCATION_FORMAT_INVALID");
  assert.equal(validateWorkforceAllocationCsv("所属部門,法人配賦,店舗配賦,配賦区分,備考\n氏名,IDEA NOV,BASSA所沢店,STORE,\n").status, "WORKFORCE_ALLOCATION_FORMAT_INVALID");
});

test("unknown evidence fails closed as unavailable", () => {
  const html = renderWorkforceEvidenceStatus({ ...SANITIZED_WORKFORCE_EVIDENCE, rawEmployeeId: "private" });
  assert.match(html, /data-workforce-evidence-category="UNAVAILABLE"/);
  assert.match(html, /人数・組織集計値を表示しません/);
  assert.doesNotMatch(html, /private/);
  assert.equal(canDisplayWorkforceAggregates({ ...SANITIZED_WORKFORCE_EVIDENCE, aggregateValuesVisible: true }), false);
});

test("mount changes only the dedicated element", () => {
  const mount = { innerHTML: "" };
  assert.equal(mountWorkforceEvidenceStatus(mount), true);
  assert.match(mount.innerHTML, /人数・組織集計の算定根拠/);
  assert.equal(mountWorkforceEvidenceStatus(null), false);
});

test("store and classification preparation views share the same closed status", () => {
  assert.match(managementIndex, /id="workforce-evidence-status"/);
  assert.match(managementApp, /mountWorkforceEvidenceStatus\(elements\.workforceEvidence, undefined, \{/);
  assert.match(managementApp, /workforceAllocationReceipt/);
  assert.match(managementApp, /配賦確認済み（人数未投入）/);
  const storeRenderer = managementApp.match(/function renderStores\(\)\s*{[\s\S]*?\n}/)?.[0] ?? "";
  assert.match(storeRenderer, /localWorkforceStaffMetric\(data\.staffCount\)/);
  assert.match(storeRenderer, /workforceAllocationMetric\(\)/);
  assert.match(storeRenderer, /localWorkforceStoreStaffText\(row\.staffCount\)/);
  assert.match(managementApp, /function localWorkforceStaffMetric/);
  assert.match(managementApp, /localWorkforceAggregateMetric\(\) \|\| workforceMetric\(value, "人"\)/);
  assert.match(managementApp, /配賦確認済み（人数未投入）/);
  assert.doesNotMatch(storeRenderer, /number\.format\((?:row|data)\.staffCount|staffCount\s*\|\|\s*0/);
  assert.match(managementApp, /function workforceMetric\(/);
  assert.match(managementApp, /data\.aiAdviceReadiness === "aggregate-input-provenance-ready"/);
  assert.match(managementApp, /data\.expertCommentReadiness === "aggregate-content-provenance-ready"/);
  const classification = renderClassificationWorkspace();
  assert.match(classification, /data-workforce-evidence-category="LOCAL_VALIDATED_PENDING_PRODUCTION"/);
  assert.match(classification, /関連AI・承認/);
});

test("visual fixture uses only local styles and browser-safe module", () => {
  assert.match(visualFixture, /portal\/management-app\/styles\.css/);
  assert.match(visualFixture, /portal\/js\/management-workforce-evidence-status\.js/);
  assert.match(managementStyles, /\.workforce-evidence-template/);
  assert.doesNotMatch(visualFixture, /fetch\(|token|session|storage|employeeId|salary/i);
});
