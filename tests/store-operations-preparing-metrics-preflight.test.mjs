import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  DATABASE_WRITE_CAPABILITY,
  buildProductionRetailLoadPlan,
  prepareRetailProductionCandidate,
} from "../tools/store_repeat_retail_handoff/prepare_production_retail_load.mjs";

const REVIEW_SQL = readFileSync(new URL(
  "../docs/store_operations_management/production_integration/store-operations-preparing-metrics-production-v1.review-only.sql",
  import.meta.url,
), "utf8");

function retailFact(overrides = {}) {
  return {
    scope_type: "SALON",
    unit_key: "SALON:久米川",
    company_no_at_month: "0001",
    fiscal_month: "2026-06",
    metric_code_candidate: "RETAIL_PURCHASE_CUSTOMER_VISITS",
    definition_version: "POS_RETAIL_PURCHASE_CUSTOMER_COUNT_V1",
    quantity: 20,
    total_customer_visits_for_validation: 100,
    retail_purchase_rate_exact_candidate: 0.2,
    store_id: null,
    promotion_status: "READY_AFTER_CORE_DB_STORE_ID_EXACT_MATCH",
    source_file: "fixture.xlsx",
    source_sha256: "A".repeat(64),
    source_validation_status: "PASS",
    raw_record_id: "fixture-retail-row",
    ...overrides,
  };
}

const profile = {
  retailFactRows: 1,
  retailUniqueKeys: 1,
  retailStartMonth: "2026-06",
  retailEndMonth: "2026-06",
  retailScopeCounts: { SALON: 1 },
  retailPromotionCounts: { READY_AFTER_CORE_DB_STORE_ID_EXACT_MATCH: 1 },
};

test("Production loader stays write-incapable and creates an exact mapped quantity candidate", () => {
  const pkg = {
    manifest: {
      metric_code_candidate: "RETAIL_PURCHASE_CUSTOMER_VISITS",
      definition_version: "POS_RETAIL_PURCHASE_CUSTOMER_COUNT_V1",
      production_write_count: 0,
    },
    definition: { value_kind: "quantity" },
    facts: [retailFact()],
  };
  const plan = buildProductionRetailLoadPlan(pkg, {
    validationProfile: profile,
    expectedInsertCount: 1,
    existingRateRows: 4,
  });
  assert.equal(DATABASE_WRITE_CAPABILITY, false);
  assert.equal(plan.databaseWriteCapability, false);
  assert.deepEqual(plan.mapping, { matched: 1, unmatched: 0, ambiguous: 0 });
  assert.equal(plan.candidates[0].candidate.metric_code, "RETAIL_PURCHASE_CUSTOMER_VISITS");
  assert.equal(plan.candidates[0].candidate.store_id, "3ba5e54d-5f39-4bcd-b917-7daaea34a8e9");
  assert.equal(plan.productionPlan.existingRetailPurchaseRateV1.supersede, 0);
});

test("Production candidate rejects non-SALON and quarantined rows", () => {
  assert.throws(() => prepareRetailProductionCandidate(retailFact({ scope_type: "EC" })), /SALON_SCOPE_REQUIRED/u);
  assert.throws(
    () => prepareRetailProductionCandidate(retailFact({ promotion_status: "EXCLUDED_OUTSIDE_CANONICAL_OPERATION_PERIOD" })),
    /PROMOTION_STATUS_INVALID/u,
  );
});

test("review-only SQL fails before DDL/DML and never mutates the canonical rate", () => {
  const guard = REVIEW_SQL.indexOf("REVIEW_ONLY_STORE_OPERATIONS_PREPARING_METRICS_PRODUCTION_V1_EXECUTION_NOT_AUTHORIZED");
  const ddl = REVIEW_SQL.indexOf("alter table dbf_ingest.metric_definitions");
  const dml = REVIEW_SQL.indexOf("insert into public.dbf_store_monthly_metric_facts");
  assert.ok(guard >= 0 && guard < ddl && ddl < dml);
  assert.match(REVIEW_SQL, /Planned canonical STORE quantity inserts: 1,492/u);
  assert.match(REVIEW_SQL, /existing_rate_count <> 4/u);
  assert.doesNotMatch(REVIEW_SQL, /update\s+public\.dbf_store_monthly_metric_facts/iu);
  assert.doesNotMatch(REVIEW_SQL, /delete\s+from\s+public\.dbf_store_monthly_metric_facts/iu);
  assert.doesNotMatch(REVIEW_SQL, /security\s+definer/iu);
  assert.doesNotMatch(REVIEW_SQL, /grant\s+/iu);
});
