import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const name = "20260814213224_dbf_business_data_phase_c_runtime.sql";
const sql = fs.readFileSync(path.join(root, "supabase", "migrations", name), "utf8");
const functions = ["start", "resolve_mappings", "quarantine_mappings", "confirm_mapping", "stage", "preview", "approve", "promote", "history"];

test("Phase C migration is transactional, additive, and has no destructive table operation", () => {
  assert.match(sql, /^begin;[\s\S]*commit;\s*$/u);
  assert.doesNotMatch(sql, /\b(drop|truncate)\s+(table|schema)\b/iu);
  assert.doesNotMatch(sql, /^\s*(?:delete\s+from)\b/imu);
  assert.doesNotMatch(sql, /\b(finance|expense_claim|accounting\.)/iu);
});

test("all runtime RPCs are security definer, fail closed to browser roles, and service-role only", () => {
  for (const suffix of functions) {
    assert.match(sql, new RegExp(`create or replace function public\\.dbf_import_${suffix}_v1`, "u"));
  }
  assert.equal((sql.match(/security definer/g) || []).length, functions.length);
  assert.equal((sql.match(/from public, anon, authenticated;/g) || []).length, functions.length);
  assert.equal((sql.match(/to service_role;/g) || []).length, functions.length);
  assert.doesNotMatch(sql, /grant execute[\s\S]{0,240}\bto (?:anon|authenticated)\b/iu);
});

test("promotion enforces approval, quarantine, duplicate-active, correction, and audit boundaries", () => {
  assert.match(sql, /v_batch\.status <> 'approved'/u);
  assert.match(sql, /mapping_status <> 'resolved'/u);
  assert.match(sql, /DBF_ACTIVE_VERSION_EXISTS/u);
  assert.match(sql, /DBF_CORRECTION_GRAIN_MISMATCH/u);
  assert.match(sql, /v_original_count <> v_expected/u);
  assert.match(sql, /DBF_CORRECTION_LINEAGE_INVALID/u);
  assert.match(sql, /set is_active = false, superseded_at = statement_timestamp\(\)/u);
  assert.match(sql, /'CORRECTION_PROMOTED'/u);
  assert.match(sql, /update dbf_ingest\.import_batches set status = 'promoted'/u);
});

test("metric definitions cover the exact 19 Phase C store metrics", () => {
  const values = sql.match(/\('[A-Z_]+','v1','(?:amount|quantity|rate)'/g) || [];
  assert.equal(values.length, 19);
});
