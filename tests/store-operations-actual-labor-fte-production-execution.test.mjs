import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

import { buildProductionActualLaborFteExecutionSql } from "../tools/actual_labor_fte_handoff/generate_production_actual_labor_fte_execution.mjs";
import { prepareActualLaborFteCandidate } from "../tools/actual_labor_fte_handoff/prepare_production_actual_labor_fte_load.mjs";

const SQL_PATH = new URL(
  "../docs/store_operations_management/production_integration/store-operations-actual-labor-fte-v1.execution.sql",
  import.meta.url,
);
const MANIFEST_PATH = new URL(
  "../docs/store_operations_management/production_integration/store-operations-actual-labor-fte-v1.execution-manifest.json",
  import.meta.url,
);
const EXECUTION_SQL = readFileSync(SQL_PATH, "utf8");
const MANIFEST = JSON.parse(readFileSync(MANIFEST_PATH, "utf8"));

function sha256(value) {
  return createHash("sha256").update(value).digest("hex").toUpperCase();
}

test("execution SQL is fixed by manifest and still awaits separate Owner approval", () => {
  assert.equal(sha256(Buffer.from(EXECUTION_SQL, "utf8")), MANIFEST.sqlSha256);
  assert.equal(Buffer.byteLength(EXECUTION_SQL, "utf8"), MANIFEST.sqlByteSize);
  assert.equal(MANIFEST.status, "AWAITING_SEPARATE_OWNER_PRODUCTION_EXECUTION_APPROVAL");
  assert.equal(MANIFEST.productionWriteExecuted, false);
  assert.equal(MANIFEST.deployExecuted, false);
  assert.equal(MANIFEST.planned.canonicalInserts, 671);
  assert.equal(MANIFEST.planned.employeeAuditRows, 0);
  assert.equal(MANIFEST.planned.headquartersRows, 0);
});

test("approval and exact Production baseline gates precede every schema or business write", () => {
  const approvalGate = EXECUTION_SQL.indexOf("OWNER_APPROVAL_SETTING_REQUIRED_FOR_FIXED_EXECUTION_SHA");
  const baselineGate = EXECUTION_SQL.indexOf("PRODUCTION_BASELINE_GATE_FAILED");
  const firstSchemaWrite = EXECUTION_SQL.indexOf("alter table dbf_ingest.metric_definitions");
  const canonicalWrite = EXECUTION_SQL.indexOf("insert into public.dbf_store_monthly_metric_facts");
  assert.ok(approvalGate > 0 && approvalGate < baselineGate && baselineGate < firstSchemaWrite && firstSchemaWrite < canonicalWrite);
  assert.match(EXECUTION_SQL, /pg_advisory_xact_lock/u);
  assert.match(EXECUTION_SQL, /begin;[\s\S]+commit;/u);
  assert.match(EXECUTION_SQL, /definition_count<>0 or fact_count<>0/u);
  assert.match(EXECUTION_SQL, /store_count<>20/u);
});

test("execution SQL promotes only validated store quantity facts", () => {
  assert.match(EXECUTION_SQL, /source_scope'='STORE'/u);
  assert.match(EXECUTION_SQL, /'ACTUAL_LABOR_FTE'/u);
  assert.match(EXECUTION_SQL, /'ACTUAL_LABOR_FTE_173_76_V1'/u);
  assert.match(EXECUTION_SQL, /actual_punch_store'\)::boolean=false/u);
  assert.match(EXECUTION_SQL, /shift_backfill'\)::boolean=false/u);
  assert.match(EXECUTION_SQL, /hq_count<>0/u);
  assert.doesNotMatch(EXECUTION_SQL, /on conflict[\s\S]+do nothing/iu);
  assert.doesNotMatch(EXECUTION_SQL, /delete\s+from\s+public\.dbf_store_monthly_metric_facts/iu);
  assert.doesNotMatch(EXECUTION_SQL, /security\s+definer/iu);
  assert.doesNotMatch(EXECUTION_SQL, /grant\s+/iu);
});

test("manifest fixes exact candidate, mapping, month, and July boundaries", () => {
  assert.equal(MANIFEST.planned.companyMappings, 6);
  assert.equal(MANIFEST.planned.storeMappings, 20);
  assert.equal(MANIFEST.planned.importBatches, 36);
  assert.equal(MANIFEST.planned.rawRows, 671);
  assert.equal(MANIFEST.planned.stagingRows, 671);
  assert.equal(MANIFEST.july2026.stores, 20);
  assert.equal(MANIFEST.july2026.sourceMinutes, 1700849);
  assert.equal(MANIFEST.july2026.storedFteAfterNumeric20_4Rounding, 163.1415);
  assert.equal((EXECUTION_SQL.match(/ALFTE:[0-9a-f]{64}/gu) || []).length, 671);
  assert.match(EXECUTION_SQL, /ac20934d-ef15-4363-8c2f-759193c7fcc7/u);
  assert.match(EXECUTION_SQL, /62070a3c-c60f-4c8d-aaba-5f0fd24df795/u);
});

test("candidate preparation rejects prohibited semantics and preserves missing-as-null contract", () => {
  const fact = {
    scope: "STORE",
    unit_key: "SALON:久米川",
    store_name: "久米川",
    fiscal_month: "2026-07",
    metric_code: "ACTUAL_LABOR_FTE",
    definition_version: "ACTUAL_LABOR_FTE_173_76_V1",
    value_quantity: 1,
    allocated_actual_work_minutes: 10425.6,
    allocated_actual_work_hours: 173.76,
    reference_hours: 173.76,
    reference_hours_type: "MONTHLY_FIXED",
    allocation_method: "EMPLOYEE_MONTH_ACTUAL_HOURS_BY_SAME_MONTH_CANONICAL_STORE_FTE_RATIO",
    actual_punch_store: false,
    shift_backfill: false,
    null_semantics: "NO_CANONICAL_FACT_ROW_MEANS_MISSING_NULL",
    source_workbook_sha256: "7E04D2107876FCA9902D07F9CB548403B51529591CB431239399912A77BC3E16",
  };
  const prepared = prepareActualLaborFteCandidate(fact).candidate;
  assert.equal(prepared.quantity, 1);
  assert.equal(prepared.company_id, "becb6f4b-2222-406d-8315-1eed48717327");
  assert.equal(prepared.store_id, "3ba5e54d-5f39-4bcd-b917-7daaea34a8e9");
  assert.equal(prepared.null_semantics, "NO_CANONICAL_FACT_ROW_MEANS_MISSING_NULL");
  assert.throws(() => prepareActualLaborFteCandidate({ ...fact, shift_backfill: true }), /PROHIBITED_INTERPRETATION/u);
  assert.throws(() => prepareActualLaborFteCandidate({ ...fact, unit_key: "SALON:本部" }), /STORE_MAPPING_MISSING/u);
});

test("SQL builder rejects a write-capable or incorrectly counted plan", () => {
  assert.throws(() => buildProductionActualLaborFteExecutionSql({ databaseWriteCapability: true, candidates: [] }), /WRITE_INCAPABLE/u);
  assert.throws(() => buildProductionActualLaborFteExecutionSql({ databaseWriteCapability: false, candidates: [] }), /CANDIDATE_COUNT/u);
});
