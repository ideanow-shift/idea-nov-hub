import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

import { buildProductionRetailExecutionSql } from "../tools/store_repeat_retail_handoff/generate_production_retail_execution.mjs";

const SQL_PATH = new URL(
  "../docs/store_operations_management/production_integration/store-operations-preparing-metrics-production-v1.execution.sql",
  import.meta.url,
);
const MANIFEST_PATH = new URL(
  "../docs/store_operations_management/production_integration/store-operations-preparing-metrics-production-v1.execution-manifest.json",
  import.meta.url,
);
const EXECUTION_SQL = readFileSync(SQL_PATH, "utf8");
const MANIFEST = JSON.parse(readFileSync(MANIFEST_PATH, "utf8"));

function sha256(value) {
  return createHash("sha256").update(value).digest("hex").toUpperCase();
}

test("execution SQL is fixed by manifest and still awaits a separate Owner approval", () => {
  assert.equal(sha256(Buffer.from(EXECUTION_SQL, "utf8")), MANIFEST.sqlSha256);
  assert.equal(Buffer.byteLength(EXECUTION_SQL, "utf8"), MANIFEST.sqlByteSize);
  assert.equal(MANIFEST.status, "AWAITING_SEPARATE_OWNER_PRODUCTION_EXECUTION_APPROVAL");
  assert.equal(MANIFEST.productionWriteExecuted, false);
  assert.equal(MANIFEST.deployExecuted, false);
  assert.equal(MANIFEST.planned.canonicalInserts, 1492);
  assert.equal(MANIFEST.planned.existingRateUnchanged, 4);
  assert.equal(MANIFEST.planned.rateInsert, 0);
  assert.equal(MANIFEST.planned.rateUpdate, 0);
});

test("approval and Production baseline gates precede every schema or business write", () => {
  const approvalGate = EXECUTION_SQL.indexOf("OWNER_APPROVAL_SETTING_REQUIRED_FOR_FIXED_EXECUTION_SHA");
  const baselineGate = EXECUTION_SQL.indexOf("PRODUCTION_BASELINE_GATE_FAILED");
  const firstSchemaWrite = EXECUTION_SQL.indexOf("alter table dbf_ingest.metric_definitions");
  const canonicalWrite = EXECUTION_SQL.indexOf("insert into public.dbf_store_monthly_metric_facts");
  assert.ok(approvalGate > 0 && approvalGate < baselineGate && baselineGate < firstSchemaWrite && firstSchemaWrite < canonicalWrite);
  assert.match(EXECUTION_SQL, /pg_advisory_xact_lock/u);
  assert.match(EXECUTION_SQL, /begin;[\s\S]+commit;/u);
  assert.match(EXECUTION_SQL, /definition_count<>0 or quantity_count<>0/u);
  assert.match(EXECUTION_SQL, /rate_count<>4/u);
});

test("execution SQL promotes only SALON quantity rows and never mutates an existing rate", () => {
  assert.match(EXECUTION_SQL, /source_scope_type'='SALON'/u);
  assert.match(EXECUTION_SQL, /promotion_status'='READY_AFTER_CORE_DB_STORE_ID_EXACT_MATCH'/u);
  assert.match(EXECUTION_SQL, /'RETAIL_PURCHASE_CUSTOMER_VISITS'/u);
  assert.doesNotMatch(EXECUTION_SQL, /insert\s+into\s+public\.dbf_company_monthly_retail_purchase_facts/iu);
  assert.doesNotMatch(EXECUTION_SQL, /update\s+public\.dbf_store_monthly_metric_facts/iu);
  assert.doesNotMatch(EXECUTION_SQL, /delete\s+from\s+public\.dbf_store_monthly_metric_facts/iu);
  assert.doesNotMatch(EXECUTION_SQL, /security\s+definer/iu);
  assert.doesNotMatch(EXECUTION_SQL, /grant\s+/iu);
});

test("execution SQL contains the exact metadata and candidate boundaries", () => {
  assert.equal(MANIFEST.planned.companyMappings, 6);
  assert.equal(MANIFEST.planned.storeMappings, 21);
  assert.equal(MANIFEST.planned.importBatches, 92);
  assert.equal(MANIFEST.planned.rawRows, 1492);
  assert.equal(MANIFEST.planned.stagingRows, 1492);
  assert.equal((EXECUTION_SQL.match(/RTP:[0-9a-f]{64}/gu) || []).length, 1492);
  assert.match(EXECUTION_SQL, /a1997308-a402-4ddb-a3f7-8b70a75b054c/u);
  assert.match(EXECUTION_SQL, /ac20934d-ef15-4363-8c2f-759193c7fcc7/u);
  assert.match(EXECUTION_SQL, /canonical_evidence_sha256,status,confirmed_by_employee_id,confirmed_at\)[\s\S]+?'active',[\s\S]+?statement_timestamp\(\)/u);
});

test("SQL builder rejects a write-capable or incorrectly counted plan", () => {
  const candidate = {
    fiscal_month: "2026-06-01",
    company_id: "e4059116-bdb3-4e13-9763-bbc77bdfe062",
    source_company_no: "0001",
    store_id: "3ba5e54d-5f39-4bcd-b917-7daaea34a8e9",
    store_mapping_entity_key: "store:3ba5e54d-5f39-4bcd-b917-7daaea34a8e9",
    store_mapping_source_key: "kumegawa",
    source_unit_key: "SALON:久米川",
    source_scope_type: "SALON",
    promotion_status: "READY_AFTER_CORE_DB_STORE_ID_EXACT_MATCH",
    metric_code: "RETAIL_PURCHASE_CUSTOMER_VISITS",
    quantity: 20,
    definition_version: "POS_RETAIL_PURCHASE_CUSTOMER_COUNT_V1",
    source_type: "pos_retail_purchase_customer_count_v1",
    source_sha256: "A".repeat(64),
    raw_record_id: `RTP:${"b".repeat(64)}`,
    total_customer_visits_for_validation: 100,
    retail_purchase_rate_exact_candidate: 0.2,
  };
  const profile = { expectedCandidates: 1, expectedCompanyMappings: 1, expectedStoreMappings: 1, expectedMonths: 1, expectedExistingRates: 4 };
  assert.throws(() => buildProductionRetailExecutionSql({ databaseWriteCapability: true, candidates: [{ candidate }] }, profile), /WRITE_INCAPABLE/u);
  assert.throws(() => buildProductionRetailExecutionSql({ databaseWriteCapability: false, candidates: [] }, profile), /CANDIDATE_COUNT/u);
  assert.match(buildProductionRetailExecutionSql({ databaseWriteCapability: false, candidates: [{ candidate }] }, profile), /PRODUCTION_READBACK_GATE_FAILED/u);
});
