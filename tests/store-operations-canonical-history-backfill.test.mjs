import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  METRIC_MAP,
  REQUIRED_HEADER,
  buildHistoricalStoreActualPlan,
} from "../tools/store_canonical_backfill/prepare_historical_store_actuals.mjs";

const SQL_PATH = new URL("../docs/store_operations_management/production_integration/store-operations-canonical-history-backfill-v1.execution.sql", import.meta.url);
const MANIFEST_PATH = new URL("../docs/store_operations_management/production_integration/store-operations-canonical-history-backfill-v1.execution-manifest.json", import.meta.url);
const SQL = readFileSync(SQL_PATH, "utf8");
const MANIFEST = JSON.parse(readFileSync(MANIFEST_PATH, "utf8"));

function sha256(value) {
  return createHash("sha256").update(value).digest("hex").toUpperCase();
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\n]/u.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function sourceCsv({ blankUnitPrices = false } = {}) {
  const rows = Object.entries(METRIC_MAP).map(([sourceMetric, metric], index) => {
    const row = Object.fromEntries(REQUIRED_HEADER.map((key) => [key, ""]));
    Object.assign(row, {
      canonical_record_id: String(index + 1).padStart(64, "a"),
      canonical_store_id: "SALON:上石神井",
      canonical_store_name: "上石神井",
      year_month: "2020-01",
      unit_type: "SALON",
      metric: sourceMetric,
      normalized_value: metric.kind === "quantity" ? "3" : "100.25",
      adopted_status: sourceMetric.endsWith("単価_税抜") && blankUnitPrices ? "DERIVED_NOT_APPLICABLE" : "ADOPTED_CURRENT",
      validation_status: sourceMetric.endsWith("単価_税抜")
        ? (blankUnitPrices ? "DENOMINATOR_ZERO_OR_MISSING" : "PASS_POS_DISPLAY_TRUNCATION")
        : "PASS",
      source_sha256: "A".repeat(64),
      source_file_name: "source.xlsx",
      source_sheet: "sheet",
      source_cell: `A${index + 1}`,
      source_period: "CURRENT",
    });
    if (sourceMetric.endsWith("単価_税抜") && blankUnitPrices) row.normalized_value = "";
    return REQUIRED_HEADER.map((key) => csvCell(row[key])).join(",");
  });
  return `${REQUIRED_HEADER.join(",")}\n${rows.join("\n")}\n`;
}

const retailPackage = {
  facts: [{
    scope_type: "SALON",
    promotion_status: "READY_AFTER_CORE_DB_STORE_ID_EXACT_MATCH",
    company_no_at_month: "0001",
    unit_key: "SALON:上石神井",
    fiscal_month: "2020-01",
  }],
};

function profile({ unavailable = 0, candidates = 9 } = {}) {
  return {
    projectRef: "test",
    canonicalCsvSha256: "C".repeat(64),
    retailPackageSha256: "R".repeat(64),
    expectedStoreMonths: 1,
    expectedCandidateSlots: 9,
    expectedUnavailable: unavailable,
    expectedCandidates: candidates,
    expectedInsert: candidates,
    expectedExisting: 0,
    existingStartMonth: "2024-07",
  };
}

test("loader maps the nine approved canonical metrics without write capability", () => {
  const plan = buildHistoricalStoreActualPlan(sourceCsv(), retailPackage, profile());
  assert.equal(plan.databaseWriteCapability, false);
  assert.equal(plan.candidates.length, 9);
  assert.equal(plan.planned.insert, 9);
  assert.equal(plan.planned.existingToCompare, 0);
  assert.equal(new Set(plan.candidates.map(({ candidate }) => candidate.metric_code)).size, 9);
  assert.ok(plan.candidates.every(({ candidate }) => candidate.store_id === "1bcba30a-d063-4cdb-be74-425e250aeb25"));
});

test("loader preserves denominator-zero unit prices as unavailable instead of zero", () => {
  const plan = buildHistoricalStoreActualPlan(sourceCsv({ blankUnitPrices: true }), retailPackage, profile({ unavailable: 2, candidates: 7 }));
  assert.equal(plan.unavailable.length, 2);
  assert.equal(plan.candidates.length, 7);
  assert.ok(plan.unavailable.every((item) => item.reason === "DENOMINATOR_ZERO_OR_MISSING"));
});

test("fixed execution SQL matches manifest and awaits a separate approval", () => {
  assert.equal(sha256(Buffer.from(SQL, "utf8")), MANIFEST.sqlSha256);
  assert.equal(Buffer.byteLength(SQL, "utf8"), MANIFEST.sqlByteSize);
  assert.equal(MANIFEST.status, "AWAITING_SEPARATE_OWNER_PRODUCTION_EXECUTION_APPROVAL");
  assert.equal(MANIFEST.productionWriteExecuted, false);
  assert.equal(MANIFEST.deployExecuted, false);
  assert.equal(MANIFEST.planned.canonicalInserts, 9003);
  assert.equal(MANIFEST.planned.correctionInserts, 227);
  assert.equal(MANIFEST.planned.exactUnchanged, 4192);
  assert.equal(MANIFEST.planned.supersede, 227);
  assert.equal(MANIFEST.planned.unavailablePreserved, 6);
});

test("execution fails closed and applies corrections through append-only lineage", () => {
  const approval = SQL.indexOf("OWNER_APPROVAL_SETTING_REQUIRED_FOR_FIXED_EXECUTION_SHA");
  const baseline = SQL.indexOf("CANONICAL_BACKFILL_BASELINE_FAILED");
  const sourceWrite = SQL.indexOf("insert into dbf_ingest.source_files");
  const factWrite = SQL.indexOf("insert into public.dbf_store_monthly_metric_facts");
  assert.ok(approval > 0 && approval < baseline && baseline < sourceWrite && sourceWrite < factWrite);
  assert.match(SQL, /existing_match_count<>4192/u);
  assert.match(SQL, /existing_mismatch_count<>227/u);
  assert.match(SQL, /insert_collision_count<>0/u);
  assert.match(SQL, /all_match_count<>13422/u);
  assert.match(SQL, /'nov_hub_secure_session'\);/u);
  assert.doesNotMatch(SQL, /owner_fixed_sha_package/u);
  assert.match(SQL, /update\s+public\.dbf_store_monthly_metric_facts old\s+set is_active=false,superseded_at=statement_timestamp\(\)/iu);
  assert.match(SQL, /correction_of_fact_id,correction_reason/iu);
  assert.doesNotMatch(SQL, /update\s+public\.dbf_store_monthly_metric_facts[\s\S]{0,240}\b(?:amount|quantity|rate)\s*=/iu);
  assert.doesNotMatch(SQL, /delete\s+from\s+public\.dbf_store_monthly_metric_facts/iu);
  assert.doesNotMatch(SQL, /alter\s+table\s+public\./iu);
  assert.doesNotMatch(SQL, /grant\s+/iu);
  assert.doesNotMatch(SQL, /security\s+definer/iu);
});
