import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const base = new URL("../docs/nov_talent/fair_attribution_contract_design/", import.meta.url);
const contract = JSON.parse(readFileSync(new URL("fair-attribution-contract.json", base), "utf8"));
const read = (name) => readFileSync(new URL(name, base), "utf8");

test("contract keeps a minimal ORIGIN attribution vocabulary", () => {
  assert.deepEqual(contract.attribution.attribution_types, ["ORIGIN"]);
  assert.deepEqual(contract.attribution.statuses, ["PENDING", "CONFIRMED", "REJECTED"]);
});

test("only confirmed attribution is KPI eligible", () => {
  assert.equal(contract.attribution.kpi_eligible_status, "CONFIRMED");
  assert.equal(contract.attribution.max_confirmed_origin_per_candidate, 1);
});

test("automatic linking, merge, and delete are prohibited", () => {
  assert.equal(contract.attribution.automatic_linking, false);
  assert.equal(contract.attribution.automatic_merge, false);
  assert.equal(contract.attribution.automatic_delete, false);
});

test("interview and offer require attribution and official facts", () => {
  assert.deepEqual(contract.derived_kpis.interview_count.requires, ["CONFIRMED_ORIGIN", "OFFICIAL_INTERVIEW_FACT"]);
  assert.deepEqual(contract.derived_kpis.offer_count.requires, ["CONFIRMED_ORIGIN", "OFFICIAL_OFFER_FACT"]);
});

test("Fair hire compatibility metric is the approved offer-count alias", () => {
  assert.equal(contract.derived_kpis.hire_count.status, "ALIAS");
  assert.equal(contract.derived_kpis.hire_count.alias_of, "offer_count");
  assert.equal(contract.derived_kpis.hire_count.actual_join_included, false);
});

test("legacy Fair KPI values are not authoritative", () => {
  assert.equal(contract.legacy_fair_kpi_columns.authoritative, false);
  assert.equal(contract.legacy_fair_kpi_columns.unknown_or_default_zero_is_official, false);
});

test("Employee Core boundary is actual join and read-only", () => {
  assert.equal(contract.employee_core.boundary, "ACTUAL_JOIN_SEPARATE_FROM_FAIR_KPI");
  assert.equal(contract.employee_core.talent_write_allowed, false);
  assert.equal(contract.employee_core.candidate_copy_allowed, false);
});

test("publication gate preserves not-ready states", () => {
  const gate = read("publication-gate.md");
  assert.match(gate, /集計準備中/);
  assert.match(gate, /legacy Fair KPI列が正式計算へ混入しない/);
});

test("design package contains no implementation migration", () => {
  const overview = read("README.md");
  assert.match(overview, /Migration SQLを作成せず/);
  assert.match(overview, /自動紐付け、自動統合、自動削除/);
});
