import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const SHA256_RE = /^[0-9a-f]{64}$/iu;
const MONTH_RE = /^\d{4}-\d{2}$/u;
// These are source-package candidates only. They are validated for package
// integrity, but are never treated as a canonical semantic mapping. In
// particular, RETURNING != SECOND_REPEAT_RATE and
// SEMI_FIXED != THIRD_REPEAT_RATE.
const SOURCE_SEGMENT_METRIC_CANDIDATE = Object.freeze({
  COMPANY_TOTAL: Object.freeze({
    TOTAL: "TOTAL_REPEAT_RATE",
    NEW: "NEW_REPEAT_RATE",
    RETURNING: "SECOND_REPEAT_RATE",
    SEMI_FIXED: "THIRD_REPEAT_RATE",
    FIXED: "FIXED_REPEAT_RATE",
  }),
  STORE: Object.freeze({
    TOTAL: "TOTAL_REPEAT_RATE",
    NEW: "NEW_REPEAT_RATE",
    RETURNING: "RETURNING_REPEAT_RATE",
    SEMI_FIXED: "SEMI_FIXED_REPEAT_RATE",
    FIXED: "FIXED_REPEAT_RATE",
  }),
});
const RETAIL_PROMOTION_STATUS = Object.freeze({
  COMPANY_TOTAL: "SEPARATE_COMPANY_SCOPE_DESIGN_REQUIRED",
  EC: "STAGING_ONLY_NON_SALON_SCOPE",
  HQ: "STAGING_ONLY_NON_SALON_SCOPE",
});

export const HANDOFF_20260921_PROFILE = Object.freeze({
  repeatSha256: "EC6446D0FED94CC0494E8AA47320309EE931DE65F52A54157172D3BB8852EB9A",
  repeatFactRows: 7480,
  repeatUniqueKeys: 7480,
  repeatCompanyRows: 440,
  repeatStoreRows: 7040,
  repeatStoreCount: 20,
  repeatStartMonth: "2019-01",
  repeatEndMonth: "2026-04",
  retailSha256: "EF2C56108BACED3F1999F6903C681B8D7BE963A50707388DC84BEA2BBFA68942",
  retailFactRows: 2476,
  retailUniqueKeys: 2476,
  retailStartMonth: "2019-01",
  retailEndMonth: "2026-08",
  retailScopeCounts: Object.freeze({ COMPANY_TOTAL: 92, SALON: 1554, EC: 784, HQ: 46 }),
  retailPromotionCounts: Object.freeze({
    READY_AFTER_CORE_DB_STORE_ID_EXACT_MATCH: 1492,
    EXCLUDED_OUTSIDE_CANONICAL_OPERATION_PERIOD: 62,
    SEPARATE_COMPANY_SCOPE_DESIGN_REQUIRED: 92,
    STAGING_ONLY_NON_SALON_SCOPE: 830,
  }),
});

function assert(condition, code, context = "") {
  if (!condition) throw new Error(context ? `${code}:${context}` : code);
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex").toUpperCase();
}

function rowRoot(rows) {
  const normalized = rows.map((row) => JSON.stringify(row)).sort();
  return sha256(Buffer.from(normalized.join("\n"), "utf8"));
}

function monthIndex(value) {
  assert(MONTH_RE.test(String(value)), "MONTH_FORMAT_INVALID", String(value));
  const [year, month] = String(value).split("-").map(Number);
  assert(month >= 1 && month <= 12, "MONTH_RANGE_INVALID", String(value));
  return year * 12 + month - 1;
}

function sameNumber(left, right, tolerance = 1e-12) {
  return Number.isFinite(left) && Number.isFinite(right) && Math.abs(left - right) <= tolerance;
}

function truncatedPosRate(exactRate) {
  return Math.trunc((exactRate + Number.EPSILON) * 1000) / 1000;
}

function increment(map, key) {
  map.set(key, (map.get(key) ?? 0) + 1);
}

function objectFromMap(map) {
  return Object.fromEntries([...map.entries()].sort(([left], [right]) => left.localeCompare(right)));
}

function assertExpectedCounts(actual, expected, code) {
  for (const [key, expectedValue] of Object.entries(expected)) {
    assert(actual[key] === expectedValue, code, `${key}:${actual[key]}!=${expectedValue}`);
  }
}

export function validateRepeatPackage(pkg, profile = HANDOFF_20260921_PROFILE) {
  assert(pkg && typeof pkg === "object" && !Array.isArray(pkg), "REPEAT_PACKAGE_OBJECT_REQUIRED");
  assert(Array.isArray(pkg.facts), "REPEAT_FACTS_ARRAY_REQUIRED");
  assert(pkg.manifest?.definition_version === "POS_REPEAT_COHORT_4M_CUMULATIVE_V1", "REPEAT_MANIFEST_DEFINITION_INVALID");
  assert(pkg.manifest?.production_write_count === 0, "REPEAT_PRODUCTION_WRITE_COUNT_INVALID");
  assert(pkg.definition?.mapping_policy === "RETURNING is not SECOND_REPEAT_RATE; SEMI_FIXED is not THIRD_REPEAT_RATE", "REPEAT_MAPPING_POLICY_INVALID");
  assert(pkg.facts.length === profile.repeatFactRows, "REPEAT_FACT_COUNT_MISMATCH");

  const keys = new Set();
  const storeUnits = new Set();
  const scopeCounts = new Map();
  const months = new Set();
  let zeroDenominatorRows = 0;

  const normalized = pkg.facts.map((fact, index) => {
    const context = String(index + 1);
    assert(fact.scope_type === "COMPANY_TOTAL" || fact.scope_type === "STORE", "REPEAT_SCOPE_INVALID", context);
    assert(fact.definition_version === "POS_REPEAT_COHORT_4M_CUMULATIVE_V1", "REPEAT_DEFINITION_INVALID", context);
    assert(fact.horizon_months === 4, "REPEAT_HORIZON_INVALID", context);
    assert(monthIndex(fact.calculation_month) === monthIndex(fact.visit_month) + 4, "REPEAT_CALCULATION_MONTH_INVALID", context);
    const sourceMetricCandidates = SOURCE_SEGMENT_METRIC_CANDIDATE[fact.scope_type];
    assert(Object.hasOwn(sourceMetricCandidates, fact.customer_segment), "REPEAT_SEGMENT_INVALID", context);
    assert(fact.metric_code_candidate === sourceMetricCandidates[fact.customer_segment], "REPEAT_SOURCE_METRIC_CODE_INVALID", context);
    assert(Number.isInteger(fact.denominator_visit_count) && fact.denominator_visit_count >= 0, "REPEAT_DENOMINATOR_INVALID", context);
    assert(Number.isInteger(fact.numerator_cumulative_repeat_count) && fact.numerator_cumulative_repeat_count >= 0, "REPEAT_NUMERATOR_INVALID", context);
    assert(fact.numerator_cumulative_repeat_count <= fact.denominator_visit_count, "REPEAT_NUMERATOR_EXCEEDS_DENOMINATOR", context);
    assert(fact.rate_unit === "RATIO_0_TO_1", "REPEAT_RATE_UNIT_INVALID", context);
    assert(SHA256_RE.test(String(fact.source_sha256)), "REPEAT_SOURCE_SHA_INVALID", context);
    assert(fact.store_id === null, "REPEAT_STORE_ID_MUST_BE_UNRESOLVED", context);

    if (fact.denominator_visit_count === 0) {
      zeroDenominatorRows += 1;
      assert(fact.numerator_cumulative_repeat_count === 0, "REPEAT_ZERO_DENOMINATOR_NUMERATOR_INVALID", context);
      assert(fact.exact_rate === null, "REPEAT_ZERO_DENOMINATOR_EXACT_RATE_INVALID", context);
      assert(fact.pos_display_rate === 0, "REPEAT_ZERO_DENOMINATOR_DISPLAY_RATE_INVALID", context);
    } else {
      const exact = fact.numerator_cumulative_repeat_count / fact.denominator_visit_count;
      assert(sameNumber(exact, fact.exact_rate), "REPEAT_EXACT_RATE_MISMATCH", context);
      assert(sameNumber(truncatedPosRate(exact), fact.pos_display_rate), "REPEAT_POS_DISPLAY_RATE_MISMATCH", context);
    }

    const scopeIdentity = fact.scope_type === "COMPANY_TOTAL" ? fact.company_no : fact.unit_key;
    assert(typeof scopeIdentity === "string" && scopeIdentity.length > 0, "REPEAT_SCOPE_IDENTITY_REQUIRED", context);
    if (fact.scope_type === "COMPANY_TOTAL") {
      assert(fact.company_id === null, "REPEAT_COMPANY_ID_MUST_BE_UNRESOLVED", context);
    } else {
      storeUnits.add(fact.unit_key);
      assert(typeof fact.operator_no_at_visit_month === "string" && fact.operator_no_at_visit_month.length > 0, "REPEAT_OPERATOR_NO_REQUIRED", context);
    }

    const key = [fact.scope_type, scopeIdentity, fact.visit_month, fact.customer_segment, fact.horizon_months, fact.definition_version].join("|");
    assert(!keys.has(key), "REPEAT_DUPLICATE_KEY", key);
    keys.add(key);
    months.add(fact.visit_month);
    increment(scopeCounts, fact.scope_type);

    return {
      scope_type: fact.scope_type,
      scope_identity: scopeIdentity,
      visit_month: fact.visit_month,
      calculation_month: fact.calculation_month,
      horizon_months: fact.horizon_months,
      customer_segment: fact.customer_segment,
      source_metric_code_candidate: fact.metric_code_candidate,
      definition_version: fact.definition_version,
      denominator: fact.denominator_visit_count,
      numerator: fact.numerator_cumulative_repeat_count,
      pos_display_rate: fact.pos_display_rate,
      exact_rate: fact.exact_rate,
      source_sha256: String(fact.source_sha256).toUpperCase(),
    };
  });

  assert(keys.size === profile.repeatUniqueKeys, "REPEAT_UNIQUE_KEY_COUNT_MISMATCH");
  assert(scopeCounts.get("COMPANY_TOTAL") === profile.repeatCompanyRows, "REPEAT_COMPANY_COUNT_MISMATCH");
  assert(scopeCounts.get("STORE") === profile.repeatStoreRows, "REPEAT_STORE_COUNT_MISMATCH");
  assert(storeUnits.size === profile.repeatStoreCount, "REPEAT_STORE_UNIT_COUNT_MISMATCH");
  const orderedMonths = [...months].sort((left, right) => monthIndex(left) - monthIndex(right));
  assert(orderedMonths[0] === profile.repeatStartMonth, "REPEAT_START_MONTH_MISMATCH");
  assert(orderedMonths.at(-1) === profile.repeatEndMonth, "REPEAT_END_MONTH_MISMATCH");

  return Object.freeze({
    status: "PASS",
    factRows: pkg.facts.length,
    uniqueKeys: keys.size,
    scopeCounts: objectFromMap(scopeCounts),
    storeUnitCount: storeUnits.size,
    firstVisitMonth: orderedMonths[0],
    lastVisitMonth: orderedMonths.at(-1),
    zeroDenominatorRows,
    metricCodePolicy: "SOURCE_CANDIDATE_VALIDATED_BUT_NOT_USED_FOR_CANONICAL_MAPPING",
    orderedRowRootSha256: rowRoot(normalized),
  });
}

export function validateRetailPackage(pkg, profile = HANDOFF_20260921_PROFILE) {
  assert(pkg && typeof pkg === "object" && !Array.isArray(pkg), "RETAIL_PACKAGE_OBJECT_REQUIRED");
  assert(Array.isArray(pkg.facts), "RETAIL_FACTS_ARRAY_REQUIRED");
  assert(pkg.manifest?.metric_code_candidate === "RETAIL_PURCHASE_CUSTOMER_VISITS", "RETAIL_MANIFEST_METRIC_INVALID");
  assert(pkg.manifest?.definition_version === "POS_RETAIL_PURCHASE_CUSTOMER_COUNT_V1", "RETAIL_MANIFEST_DEFINITION_INVALID");
  assert(pkg.manifest?.production_write_count === 0, "RETAIL_PRODUCTION_WRITE_COUNT_INVALID");
  assert(pkg.definition?.value_kind === "quantity", "RETAIL_VALUE_KIND_INVALID");
  assert(pkg.facts.length === profile.retailFactRows, "RETAIL_FACT_COUNT_MISMATCH");

  const keys = new Set();
  const rawRecordIds = new Set();
  const scopeCounts = new Map();
  const promotionCounts = new Map();
  const units = new Set();
  const months = new Set();
  let nullQuantityRows = 0;
  let nullRateRows = 0;

  const normalized = pkg.facts.map((fact, index) => {
    const context = String(index + 1);
    assert(["COMPANY_TOTAL", "SALON", "EC", "HQ"].includes(fact.scope_type), "RETAIL_SCOPE_INVALID", context);
    assert(typeof fact.unit_key === "string" && fact.unit_key.length > 0, "RETAIL_UNIT_KEY_REQUIRED", context);
    assert(MONTH_RE.test(String(fact.fiscal_month)), "RETAIL_MONTH_INVALID", context);
    assert(fact.metric_code_candidate === "RETAIL_PURCHASE_CUSTOMER_VISITS", "RETAIL_METRIC_INVALID", context);
    assert(fact.definition_version === "POS_RETAIL_PURCHASE_CUSTOMER_COUNT_V1", "RETAIL_DEFINITION_INVALID", context);
    assert(fact.store_id === null, "RETAIL_STORE_ID_MUST_BE_UNRESOLVED", context);
    assert(SHA256_RE.test(String(fact.source_sha256)), "RETAIL_SOURCE_SHA_INVALID", context);
    assert(fact.source_validation_status === "PASS", "RETAIL_SOURCE_VALIDATION_INVALID", context);
    assert(typeof fact.raw_record_id === "string" && fact.raw_record_id.length > 0, "RETAIL_RAW_RECORD_ID_REQUIRED", context);
    assert(!rawRecordIds.has(fact.raw_record_id), "RETAIL_DUPLICATE_RAW_RECORD_ID", fact.raw_record_id);
    rawRecordIds.add(fact.raw_record_id);

    const quantity = fact.quantity;
    const total = fact.total_customer_visits_for_validation;
    if (quantity === null) {
      nullQuantityRows += 1;
      assert(fact.retail_purchase_rate_exact_candidate === null, "RETAIL_NULL_QUANTITY_RATE_MUST_BE_NULL", context);
    } else {
      assert(Number.isInteger(quantity) && quantity >= 0, "RETAIL_QUANTITY_INVALID", context);
      assert(total === null || (Number.isInteger(total) && total >= 0), "RETAIL_TOTAL_CUSTOMERS_INVALID", context);
      if (total === null || total === 0) {
        nullRateRows += 1;
        assert(fact.retail_purchase_rate_exact_candidate === null, "RETAIL_ZERO_OR_NULL_DENOMINATOR_RATE_INVALID", context);
        if (total === 0) assert(quantity === 0, "RETAIL_QUANTITY_EXCEEDS_ZERO_DENOMINATOR", context);
      } else {
        assert(quantity <= total, "RETAIL_QUANTITY_EXCEEDS_TOTAL", context);
        assert(sameNumber(quantity / total, fact.retail_purchase_rate_exact_candidate), "RETAIL_RATE_MISMATCH", context);
      }
    }

    if (fact.scope_type === "SALON") {
      assert(["READY_AFTER_CORE_DB_STORE_ID_EXACT_MATCH", "EXCLUDED_OUTSIDE_CANONICAL_OPERATION_PERIOD"].includes(fact.promotion_status), "RETAIL_SALON_PROMOTION_INVALID", context);
      if (fact.promotion_status === "READY_AFTER_CORE_DB_STORE_ID_EXACT_MATCH") {
        assert(typeof fact.company_no_at_month === "string" && fact.company_no_at_month.length > 0, "RETAIL_COMPANY_NO_REQUIRED", context);
      }
    } else {
      assert(fact.promotion_status === RETAIL_PROMOTION_STATUS[fact.scope_type], "RETAIL_NON_SALON_PROMOTION_INVALID", context);
    }

    const key = [fact.scope_type, fact.unit_key, fact.fiscal_month, fact.definition_version].join("|");
    assert(!keys.has(key), "RETAIL_DUPLICATE_KEY", key);
    keys.add(key);
    units.add(fact.unit_key);
    months.add(fact.fiscal_month);
    increment(scopeCounts, fact.scope_type);
    increment(promotionCounts, fact.promotion_status);

    return {
      scope_type: fact.scope_type,
      unit_key: fact.unit_key,
      fiscal_month: fact.fiscal_month,
      metric_code: fact.metric_code_candidate,
      definition_version: fact.definition_version,
      quantity,
      total_customer_visits: total,
      exact_rate_candidate: fact.retail_purchase_rate_exact_candidate,
      company_no_at_month: fact.company_no_at_month,
      promotion_status: fact.promotion_status,
      source_sha256: String(fact.source_sha256).toUpperCase(),
      raw_record_id: fact.raw_record_id,
    };
  });

  assert(keys.size === profile.retailUniqueKeys, "RETAIL_UNIQUE_KEY_COUNT_MISMATCH");
  assertExpectedCounts(objectFromMap(scopeCounts), profile.retailScopeCounts, "RETAIL_SCOPE_COUNT_MISMATCH");
  assertExpectedCounts(objectFromMap(promotionCounts), profile.retailPromotionCounts, "RETAIL_PROMOTION_COUNT_MISMATCH");
  const orderedMonths = [...months].sort((left, right) => monthIndex(left) - monthIndex(right));
  assert(orderedMonths[0] === profile.retailStartMonth, "RETAIL_START_MONTH_MISMATCH");
  assert(orderedMonths.at(-1) === profile.retailEndMonth, "RETAIL_END_MONTH_MISMATCH");

  return Object.freeze({
    status: "PASS",
    factRows: pkg.facts.length,
    uniqueKeys: keys.size,
    scopeCounts: objectFromMap(scopeCounts),
    promotionCounts: objectFromMap(promotionCounts),
    unitCount: units.size,
    firstFiscalMonth: orderedMonths[0],
    lastFiscalMonth: orderedMonths.at(-1),
    nullQuantityRows,
    nullRateRows,
    orderedRowRootSha256: rowRoot(normalized),
  });
}

function readJsonAndCheckSha(filePath, expectedSha256, label) {
  const bytes = readFileSync(filePath);
  const actualSha256 = sha256(bytes);
  assert(actualSha256 === expectedSha256.toUpperCase(), `${label}_SHA256_MISMATCH`, actualSha256);
  return { actualSha256, value: JSON.parse(bytes.toString("utf8")) };
}

export function validateHandoffFiles({ repeatPath, retailPath, profile = HANDOFF_20260921_PROFILE }) {
  const repeat = readJsonAndCheckSha(repeatPath, profile.repeatSha256, "REPEAT_PACKAGE");
  const retail = readJsonAndCheckSha(retailPath, profile.retailSha256, "RETAIL_PACKAGE");
  return Object.freeze({
    status: "PASS",
    productionWriteCount: 0,
    repeatPackageSha256: repeat.actualSha256,
    retailPackageSha256: retail.actualSha256,
    repeat: validateRepeatPackage(repeat.value, profile),
    retail: validateRetailPackage(retail.value, profile),
  });
}

function parseArgs(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index];
    const value = argv[index + 1];
    assert(flag?.startsWith("--") && value, "CLI_ARGUMENT_INVALID", String(flag));
    result[flag.slice(2)] = value;
  }
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = parseArgs(process.argv.slice(2));
  assert(args.repeat, "REPEAT_PATH_REQUIRED");
  assert(args.retail, "RETAIL_PATH_REQUIRED");
  process.stdout.write(`${JSON.stringify(validateHandoffFiles({ repeatPath: args.repeat, retailPath: args.retail }), null, 2)}\n`);
}
