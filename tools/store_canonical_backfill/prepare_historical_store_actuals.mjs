import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

import { resolveStore } from "../store_repeat_retail_handoff/generate_staging_sql.mjs";

export const DATABASE_WRITE_CAPABILITY = false;

export const CANONICAL_BACKFILL_PROFILE = Object.freeze({
  projectRef: "nkmxevmioczcmnldreyo",
  actorEmployeeId: "369d9cd5-f6ba-4e53-9428-f631f0893469",
  canonicalCsvSha256: "A87BF388B5B5F7349EDE6A65DF37FDF3689039E947CDBD30CA67B6C952B64CC9",
  canonicalCsvByteSize: 37665586,
  retailPackageSha256: "EF2C56108BACED3F1999F6903C681B8D7BE963A50707388DC84BEA2BBFA68942",
  retailPackageByteSize: 3252873,
  expectedStoreMonths: 1492,
  expectedCandidateSlots: 13428,
  expectedUnavailable: 6,
  expectedCandidates: 13422,
  expectedInsert: 9003,
  expectedExisting: 4419,
  existingStartMonth: "2024-07",
});

const COMPANY_IDS = Object.freeze({
  "0001": "e4059116-bdb3-4e13-9763-bbc77bdfe062",
  "0002": "f0d56e0d-62e1-4eba-a37a-17e396ab0b61",
  "0003": "becb6f4b-2222-406d-8315-1eed48717327",
  "0004": "127b2041-a61c-498e-9040-a9d0a8146182",
  "0005": "2dcb7eb1-3aa9-4f75-a439-471da534b2fb",
  "0006": "34afa056-2d7c-413a-b6ea-80e2620e003c",
});

export const METRIC_MAP = Object.freeze({
  "総売上_税抜": Object.freeze({ code: "TOTAL_SALES", kind: "amount" }),
  "技術売上_税抜": Object.freeze({ code: "TECHNICAL_SALES", kind: "amount" }),
  "店販売上_税抜": Object.freeze({ code: "RETAIL_SALES", kind: "amount" }),
  "総客数": Object.freeze({ code: "TOTAL_CUSTOMERS", kind: "quantity" }),
  "新規客数": Object.freeze({ code: "NEW_CUSTOMERS", kind: "quantity" }),
  "総単価_税抜": Object.freeze({ code: "TOTAL_UNIT_PRICE", kind: "amount" }),
  "技術単価_税抜": Object.freeze({ code: "TECHNICAL_UNIT_PRICE", kind: "amount" }),
  "総売上FTE生産性": Object.freeze({ code: "TOTAL_PRODUCTIVITY", kind: "amount" }),
  "技術売上FTE生産性": Object.freeze({ code: "TECHNICAL_PRODUCTIVITY", kind: "amount" }),
});

export const REQUIRED_HEADER = Object.freeze([
  "canonical_record_id", "canonical_store_id", "canonical_store_name", "year_month", "unit_type",
  "metric", "metric_unit", "raw_value", "normalized_value", "value_status", "adopted_status",
  "validation_status", "source_type", "source_file_name", "source_file_path", "source_logical_source",
  "source_sha256", "source_sheet", "source_cell", "source_range", "raw_record_id", "raw_record_key",
  "source_store_name", "source_month", "source_period", "duplicate_candidate_count",
  "duplicate_raw_record_keys", "derivation_expression", "upstream_record_ids", "store_history_status", "note",
]);

function assert(condition, code) {
  if (!condition) throw new Error(code);
}

export function sha256(value) {
  return createHash("sha256").update(value).digest("hex").toUpperCase();
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  const source = String(text ?? "").replace(/^\uFEFF/u, "").replace(/\r\n?/gu, "\n");
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (quoted) {
      if (char === '"' && source[index + 1] === '"') { cell += '"'; index += 1; }
      else if (char === '"') quoted = false;
      else cell += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") { row.push(cell); cell = ""; }
    else if (char === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; }
    else cell += char;
  }
  assert(!quoted, "CANONICAL_CSV_QUOTE_UNCLOSED");
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((candidate) => candidate.some((value) => value !== ""));
}

function normalizedDecimal(value) {
  const text = String(value ?? "").trim();
  assert(/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/u.test(text), "CANONICAL_VALUE_INVALID");
  assert(Number.isFinite(Number(text)), "CANONICAL_VALUE_NON_FINITE");
  return text;
}

function roundDecimal(value, scale) {
  const text = normalizedDecimal(value);
  const negative = text.startsWith("-");
  const unsigned = negative ? text.slice(1) : text;
  const [whole, fraction = ""] = unsigned.split(".");
  const padded = fraction.padEnd(scale + 1, "0");
  const kept = padded.slice(0, scale);
  const roundUp = Number(padded[scale] ?? "0") >= 5;
  let scaled = BigInt(`${whole}${kept}` || "0");
  if (roundUp) scaled += 1n;
  const digits = scaled.toString().padStart(scale + 1, "0");
  const result = scale === 0 ? digits : `${digits.slice(0, -scale)}.${digits.slice(-scale)}`;
  return negative && scaled !== 0n ? `-${result}` : result;
}

function fingerprint(value) {
  return sha256(Buffer.from(JSON.stringify(value), "utf8"));
}

function mappingByStoreMonth(retailPackage, expectedStoreMonths) {
  assert(Array.isArray(retailPackage?.facts), "RETAIL_PACKAGE_FACTS_REQUIRED");
  const result = new Map();
  for (const fact of retailPackage.facts) {
    if (fact.scope_type !== "SALON" || fact.promotion_status !== "READY_AFTER_CORE_DB_STORE_ID_EXACT_MATCH") continue;
    const companyId = COMPANY_IDS[fact.company_no_at_month];
    assert(companyId, `COMPANY_MAPPING_MISSING:${fact.company_no_at_month}`);
    const [storeId, storeSourceKey] = resolveStore(fact.unit_key, fact.fiscal_month);
    const key = `${fact.fiscal_month}|${fact.unit_key}`;
    assert(!result.has(key), `STORE_MONTH_MAPPING_DUPLICATE:${key}`);
    result.set(key, Object.freeze({
      fiscalMonth: fact.fiscal_month,
      sourceUnitKey: fact.unit_key,
      sourceCompanyNo: fact.company_no_at_month,
      companyId,
      storeId,
      storeSourceKey,
      mappingSourceKey: `store:${storeId}`,
    }));
  }
  assert(result.size === expectedStoreMonths, "STORE_MONTH_MAPPING_COUNT_MISMATCH");
  return result;
}

function allowedValidation(sourceMetric, row) {
  if (sourceMetric.endsWith("単価_税抜")) {
    return row.validation_status === "PASS_POS_DISPLAY_TRUNCATION"
      || (row.validation_status === "DENOMINATOR_ZERO_OR_MISSING" && row.adopted_status === "DERIVED_NOT_APPLICABLE");
  }
  if (sourceMetric.endsWith("FTE生産性")) {
    return row.validation_status === "PASS"
      || (row.validation_status === "DENOMINATOR_ZERO_OR_NOT_APPLICABLE" && row.adopted_status === "DERIVED_NOT_APPLICABLE");
  }
  return row.validation_status === "PASS" || row.validation_status === "DUPLICATE_MATCH";
}

export function buildHistoricalStoreActualPlan(csvText, retailPackage, profile = CANONICAL_BACKFILL_PROFILE) {
  const table = parseCsv(csvText);
  assert(table.length > 1, "CANONICAL_CSV_EMPTY");
  assert(table[0].length === REQUIRED_HEADER.length && table[0].every((value, index) => value === REQUIRED_HEADER[index]), "CANONICAL_CSV_HEADER_MISMATCH");
  const mappings = mappingByStoreMonth(retailPackage, profile.expectedStoreMonths);
  const rowsByGrain = new Map();
  for (const cells of table.slice(1)) {
    assert(cells.length === REQUIRED_HEADER.length, "CANONICAL_CSV_COLUMN_COUNT_MISMATCH");
    const row = Object.fromEntries(REQUIRED_HEADER.map((key, index) => [key, cells[index]]));
    const metric = METRIC_MAP[row.metric];
    if (!metric || row.unit_type !== "SALON") continue;
    const mapping = mappings.get(`${row.year_month}|${row.canonical_store_id}`);
    if (!mapping) continue;
    assert(allowedValidation(row.metric, row), `CANONICAL_VALIDATION_STATUS_REJECTED:${row.canonical_record_id}`);
    const grain = `${row.year_month}|${row.canonical_store_id}|${metric.code}`;
    assert(!rowsByGrain.has(grain), `CANONICAL_GRAIN_DUPLICATE:${grain}`);
    rowsByGrain.set(grain, { row, metric, mapping });
  }

  const candidates = [];
  const unavailable = [];
  for (const mapping of mappings.values()) {
    for (const [sourceMetric, metric] of Object.entries(METRIC_MAP)) {
      const grain = `${mapping.fiscalMonth}|${mapping.sourceUnitKey}|${metric.code}`;
      const found = rowsByGrain.get(grain);
      assert(found, `CANONICAL_GRAIN_MISSING:${grain}`);
      const { row } = found;
      if (row.normalized_value === "") {
        assert(sourceMetric.endsWith("単価_税抜") && row.validation_status === "DENOMINATOR_ZERO_OR_MISSING" && row.adopted_status === "DERIVED_NOT_APPLICABLE", `CANONICAL_BLANK_NOT_ALLOWED:${grain}`);
        unavailable.push(Object.freeze({ grain, reason: row.validation_status, canonicalRecordId: row.canonical_record_id }));
        continue;
      }
      const sourceValue = normalizedDecimal(row.normalized_value);
      if (metric.kind === "quantity") assert(Number.isInteger(Number(sourceValue)) && Number(sourceValue) >= 0, `CANONICAL_QUANTITY_INVALID:${grain}`);
      const value = metric.kind === "amount" ? roundDecimal(sourceValue, 2) : sourceValue;
      const classification = mapping.fiscalMonth < profile.existingStartMonth ? "insert" : "existing";
      const candidate = Object.freeze({
        fiscal_month: `${mapping.fiscalMonth}-01`,
        company_id: mapping.companyId,
        source_company_no: mapping.sourceCompanyNo,
        store_id: mapping.storeId,
        store_mapping_source_key: mapping.storeSourceKey,
        store_mapping_entity_key: mapping.mappingSourceKey,
        source_unit_key: mapping.sourceUnitKey,
        metric_code: metric.code,
        value_kind: metric.kind,
        value,
        source_value: sourceValue,
        definition_version: "v1",
        source_type: "pos_canonical_historical_backfill_v1",
        canonical_record_id: row.canonical_record_id,
        canonical_source_sha256: String(row.source_sha256).toUpperCase(),
        source_file_name: row.source_file_name,
        source_sheet: row.source_sheet,
        source_cell: row.source_cell,
        source_period: row.source_period,
        source_validation_status: row.validation_status,
        classification,
      });
      candidates.push(Object.freeze({ candidate, fingerprintSha256: fingerprint(candidate) }));
    }
  }
  candidates.sort((left, right) => left.candidate.fiscal_month.localeCompare(right.candidate.fiscal_month)
    || left.candidate.store_id.localeCompare(right.candidate.store_id)
    || left.candidate.metric_code.localeCompare(right.candidate.metric_code));
  const grains = new Set(candidates.map(({ candidate }) => [candidate.fiscal_month, candidate.company_id, candidate.store_id, candidate.metric_code].join("|")));
  assert(grains.size === candidates.length, "CANONICAL_CANDIDATE_GRAIN_DUPLICATE");
  assert(mappings.size * Object.keys(METRIC_MAP).length === profile.expectedCandidateSlots, "CANONICAL_CANDIDATE_SLOT_COUNT_MISMATCH");
  assert(unavailable.length === profile.expectedUnavailable, "CANONICAL_UNAVAILABLE_COUNT_MISMATCH");
  assert(candidates.length === profile.expectedCandidates, "CANONICAL_CANDIDATE_COUNT_MISMATCH");
  assert(candidates.filter(({ candidate }) => candidate.classification === "insert").length === profile.expectedInsert, "CANONICAL_INSERT_COUNT_MISMATCH");
  assert(candidates.filter(({ candidate }) => candidate.classification === "existing").length === profile.expectedExisting, "CANONICAL_EXISTING_COUNT_MISMATCH");
  return Object.freeze({
    status: "READY_FOR_FIXED_PRODUCTION_EXECUTION_PACKAGE",
    databaseWriteCapability: DATABASE_WRITE_CAPABILITY,
    productionProjectRef: profile.projectRef,
    canonicalCsvSha256: profile.canonicalCsvSha256,
    retailPackageSha256: profile.retailPackageSha256,
    mapping: Object.freeze({ matchedStoreMonths: mappings.size, unmatched: 0, ambiguous: 0 }),
    planned: Object.freeze({ insert: profile.expectedInsert, existingToCompare: profile.expectedExisting, unavailable: profile.expectedUnavailable }),
    unavailable: Object.freeze(unavailable),
    candidates: Object.freeze(candidates),
  });
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 2) args[argv[index]?.replace(/^--/u, "")] = argv[index + 1];
  return args;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = parseArgs(process.argv.slice(2));
  assert(args.csv && args.retail, "USAGE: --csv <canonical.csv> --retail <retail-package.json>");
  const csvBytes = readFileSync(args.csv);
  const retailBytes = readFileSync(args.retail);
  assert(csvBytes.length === CANONICAL_BACKFILL_PROFILE.canonicalCsvByteSize, "CANONICAL_CSV_BYTE_SIZE_MISMATCH");
  assert(sha256(csvBytes) === CANONICAL_BACKFILL_PROFILE.canonicalCsvSha256, "CANONICAL_CSV_SHA256_MISMATCH");
  assert(retailBytes.length === CANONICAL_BACKFILL_PROFILE.retailPackageByteSize, "RETAIL_PACKAGE_BYTE_SIZE_MISMATCH");
  assert(sha256(retailBytes) === CANONICAL_BACKFILL_PROFILE.retailPackageSha256, "RETAIL_PACKAGE_SHA256_MISMATCH");
  const plan = buildHistoricalStoreActualPlan(csvBytes.toString("utf8"), JSON.parse(retailBytes.toString("utf8")));
  process.stdout.write(`${JSON.stringify({ ...plan, candidates: undefined, candidateCount: plan.candidates.length }, null, 2)}\n`);
}
