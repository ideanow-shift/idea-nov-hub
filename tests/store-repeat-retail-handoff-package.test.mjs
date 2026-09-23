import assert from "node:assert/strict";
import test from "node:test";

import { validateRepeatPackage, validateRetailPackage } from "../tools/store_repeat_retail_handoff/validate_handoff_packages.mjs";
import { buildDryRunPlan } from "../tools/store_repeat_retail_handoff/build_dry_run_plan.mjs";
import { DATABASE_WRITE_CAPABILITY, partitionRetailCandidates, prepareCompanyRepeatCandidate } from "../tools/store_repeat_retail_handoff/prepare_load_candidates.mjs";

const companySegments = [
  ["TOTAL", "TOTAL_REPEAT_RATE"],
  ["NEW", "NEW_REPEAT_RATE"],
  ["RETURNING", "SECOND_REPEAT_RATE"],
  ["SEMI_FIXED", "THIRD_REPEAT_RATE"],
  ["FIXED", "FIXED_REPEAT_RATE"],
];
const storeSegments = [
  ["TOTAL", "TOTAL_REPEAT_RATE"],
  ["NEW", "NEW_REPEAT_RATE"],
  ["RETURNING", "RETURNING_REPEAT_RATE"],
  ["SEMI_FIXED", "SEMI_FIXED_REPEAT_RATE"],
  ["FIXED", "FIXED_REPEAT_RATE"],
];

function repeatFact(scope, identity, segment, metric) {
  return {
    scope_type: scope,
    company_no: scope === "COMPANY_TOTAL" ? identity : undefined,
    company_id: scope === "COMPANY_TOTAL" ? null : undefined,
    unit_key: scope === "STORE" ? identity : undefined,
    store_id: null,
    operator_no_at_visit_month: scope === "STORE" ? "0001" : undefined,
    visit_month: "2026-01",
    calculation_month: "2026-05",
    horizon_months: 4,
    customer_segment: segment,
    metric_code_candidate: metric,
    definition_version: "POS_REPEAT_COHORT_4M_CUMULATIVE_V1",
    denominator_visit_count: 100,
    numerator_cumulative_repeat_count: 25,
    pos_display_rate: 0.25,
    exact_rate: 0.25,
    rate_unit: "RATIO_0_TO_1",
    source_sha256: "A".repeat(64),
  };
}

function repeatFixture() {
  return {
    manifest: { definition_version: "POS_REPEAT_COHORT_4M_CUMULATIVE_V1", production_write_count: 0 },
    definition: { mapping_policy: "RETURNING is not SECOND_REPEAT_RATE; SEMI_FIXED is not THIRD_REPEAT_RATE" },
    facts: [
      ...companySegments.map(([segment, metric]) => repeatFact("COMPANY_TOTAL", "0001", segment, metric)),
      ...storeSegments.map(([segment, metric]) => repeatFact("STORE", "SALON:fixture", segment, metric)),
    ],
  };
}

function repeatProfile() {
  return { repeatFactRows: 10, repeatUniqueKeys: 10, repeatCompanyRows: 5, repeatStoreRows: 5, repeatStoreCount: 1, repeatStartMonth: "2026-01", repeatEndMonth: "2026-01" };
}

function retailFixture() {
  const base = {
    metric_code_candidate: "RETAIL_PURCHASE_CUSTOMER_VISITS",
    definition_version: "POS_RETAIL_PURCHASE_CUSTOMER_COUNT_V1",
    quantity: 2,
    total_customer_visits_for_validation: 10,
    retail_purchase_rate_exact_candidate: 0.2,
    store_id: null,
    source_file: "fixture.xlsx",
    source_sha256: "B".repeat(64),
    source_validation_status: "PASS",
  };
  return {
    manifest: { metric_code_candidate: "RETAIL_PURCHASE_CUSTOMER_VISITS", definition_version: "POS_RETAIL_PURCHASE_CUSTOMER_COUNT_V1", production_write_count: 0 },
    definition: { value_kind: "quantity" },
    facts: [
      { ...base, scope_type: "COMPANY_TOTAL", unit_key: "COMPANY_TOTAL:fixture", fiscal_month: "2026-01", promotion_status: "SEPARATE_COMPANY_SCOPE_DESIGN_REQUIRED", raw_record_id: "company" },
      { ...base, scope_type: "SALON", unit_key: "SALON:ready", company_no_at_month: "0001", fiscal_month: "2026-01", promotion_status: "READY_AFTER_CORE_DB_STORE_ID_EXACT_MATCH", raw_record_id: "salon-ready" },
      { ...base, scope_type: "SALON", unit_key: "SALON:excluded", fiscal_month: "2026-01", promotion_status: "EXCLUDED_OUTSIDE_CANONICAL_OPERATION_PERIOD", raw_record_id: "salon-excluded" },
      { ...base, scope_type: "EC", unit_key: "EC:fixture", fiscal_month: "2026-01", promotion_status: "STAGING_ONLY_NON_SALON_SCOPE", raw_record_id: "ec" },
    ],
  };
}

function retailProfile() {
  return {
    retailFactRows: 4,
    retailUniqueKeys: 4,
    retailStartMonth: "2026-01",
    retailEndMonth: "2026-01",
    retailScopeCounts: { COMPANY_TOTAL: 1, SALON: 2, EC: 1 },
    retailPromotionCounts: { READY_AFTER_CORE_DB_STORE_ID_EXACT_MATCH: 1, EXCLUDED_OUTSIDE_CANONICAL_OPERATION_PERIOD: 1, SEPARATE_COMPANY_SCOPE_DESIGN_REQUIRED: 1, STAGING_ONLY_NON_SALON_SCOPE: 1 },
  };
}

test("repeat package accepts separate company and store scopes", () => {
  const result = validateRepeatPackage(repeatFixture(), repeatProfile());
  assert.equal(result.status, "PASS");
  assert.deepEqual(result.scopeCounts, { COMPANY_TOTAL: 5, STORE: 5 });
});

test("legacy source metric candidate is validated but never becomes a canonical mapping", () => {
  const pkg = repeatFixture();
  const result = validateRepeatPackage(pkg, repeatProfile());
  assert.equal(result.metricCodePolicy, "SOURCE_CANDIDATE_VALIDATED_BUT_NOT_USED_FOR_CANONICAL_MAPPING");
  pkg.facts.find((fact) => fact.scope_type === "COMPANY_TOTAL" && fact.customer_segment === "RETURNING").metric_code_candidate = "RETURNING_REPEAT_RATE";
  assert.throws(() => validateRepeatPackage(pkg, repeatProfile()), /REPEAT_SOURCE_METRIC_CODE_INVALID/u);
});

test("zero denominator preserves null exact rate instead of zero", () => {
  const pkg = repeatFixture();
  Object.assign(pkg.facts[0], { denominator_visit_count: 0, numerator_cumulative_repeat_count: 0, exact_rate: null, pos_display_rate: 0 });
  assert.equal(validateRepeatPackage(pkg, repeatProfile()).zeroDenominatorRows, 1);
  pkg.facts[0].exact_rate = 0;
  assert.throws(() => validateRepeatPackage(pkg, repeatProfile()), /REPEAT_ZERO_DENOMINATOR_EXACT_RATE_INVALID/u);
});

test("retail quantity package enforces scope promotion boundaries", () => {
  const result = validateRetailPackage(retailFixture(), retailProfile());
  assert.equal(result.status, "PASS");
  assert.equal(result.promotionCounts.STAGING_ONLY_NON_SALON_SCOPE, 1);
});

test("retail quantity cannot exceed total customer visits", () => {
  const pkg = retailFixture();
  Object.assign(pkg.facts[1], { quantity: 11, retail_purchase_rate_exact_candidate: 1.1 });
  assert.throws(() => validateRetailPackage(pkg, retailProfile()), /RETAIL_QUANTITY_EXCEEDS_TOTAL/u);
});

test("blank retail denominator remains null rate", () => {
  const pkg = retailFixture();
  Object.assign(pkg.facts[1], { quantity: 0, total_customer_visits_for_validation: 0, retail_purchase_rate_exact_candidate: null });
  assert.equal(validateRetailPackage(pkg, retailProfile()).nullRateRows, 1);
});

test("dry-run plan never schedules existing production store repeat rows", () => {
  const validation = { status: "PASS", repeat: { scopeCounts: { STORE: 7040, COMPANY_TOTAL: 440 } }, retail: { promotionCounts: { READY_AFTER_CORE_DB_STORE_ID_EXACT_MATCH: 1492, EXCLUDED_OUTSIDE_CANONICAL_OPERATION_PERIOD: 62, SEPARATE_COMPANY_SCOPE_DESIGN_REQUIRED: 92, STAGING_ONLY_NON_SALON_SCOPE: 830 } } };
  const baseline = { production: { store_repeat: { fingerprint_status: "EXACT_MATCH", row_count: 7040 }, retail: { existing_rate_rows: 4 } }, mapping: { matched: 1492, unmatched: 0, ambiguous: 0 } };
  const plan = buildDryRunPlan(validation, baseline);
  assert.deepEqual(plan.productionPlan.repeatStoreCanonical, { insert: 0, supersede: 0, unchanged: 7040 });
  assert.equal(plan.productionWriteCount, 0);
});

test("company repeat loader candidate uses customer segment and drops the source metric candidate", () => {
  const fact = repeatFixture().facts[2];
  const prepared = prepareCompanyRepeatCandidate(fact, "company-uuid");
  assert.equal(DATABASE_WRITE_CAPABILITY, false);
  assert.equal(prepared.candidate.customer_segment, "RETURNING");
  assert.equal(Object.hasOwn(prepared.candidate, "metric_code"), false);
  assert.equal(prepared.sourceMetricCodeCandidateDisposition, "VALIDATED_THEN_DROPPED_NOT_CANONICALIZED");
});

test("retail loader partitions excluded and non-salon rows away from store promotion", () => {
  const partitions = partitionRetailCandidates(retailFixture().facts);
  assert.equal(partitions.writeCapability, false);
  assert.equal(partitions.salonReadyForExactMapping.length, 1);
  assert.equal(partitions.salonExcludedOutsideOperationPeriod.length, 1);
  assert.equal(partitions.companyScopeDesignRequired.length, 1);
  assert.equal(partitions.nonSalonStagingOnly.length, 1);
});
