import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const migrationName = "20260814140109_dbf_business_data_phase1_foundation.sql";
const migration = fs.readFileSync(
  path.join(root, "supabase", "migrations", migrationName),
  "utf8",
);

const factTables = [
  "dbf_pl_detail_facts",
  "dbf_pl_aggregate_facts",
  "dbf_bs_facts",
  "dbf_store_monthly_metric_facts",
  "dbf_budget_facts",
];

const ingestTables = [
  "source_files",
  "import_batches",
  "raw_rows",
  "entity_mappings",
  "staging_rows",
  "validation_issues",
  "import_events",
  "metric_definitions",
];

test("formal migration is additive, transactional, and forward-only", () => {
  assert.match(migration, /\bbegin;[\s\S]*\bcommit;\s*$/u);
  assert.doesNotMatch(migration, /\brollback\b/iu);
  assert.doesNotMatch(migration, /\b(drop|truncate)\s+(table|schema)\b/iu);
  assert.doesNotMatch(migration, /\balter\s+table\s+(?!public\.dbf_|dbf_ingest\.)/iu);
  assert.doesNotMatch(migration, /^\s*(?:update|delete\s+from)\b/imu);
  assert.doesNotMatch(migration, /\b(finance|expense_claim|accounting\.)/iu);
});

test("all five canonical fact and eight ingest tables are created", () => {
  for (const table of factTables) {
    assert.match(migration, new RegExp(`create table public\\.${table}\\b`, "u"));
  }
  for (const table of ingestTables) {
    assert.match(migration, new RegExp(`create table dbf_ingest\\.${table}\\b`, "u"));
  }
});

test("RLS and FORCE RLS protect every Phase 1 table", () => {
  for (const table of factTables) {
    assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security;`, "u"));
    assert.match(migration, new RegExp(`alter table public\\.${table} force row level security;`, "u"));
  }
  for (const table of ingestTables) {
    assert.match(migration, new RegExp(`alter table dbf_ingest\\.${table} enable row level security;`, "u"));
    assert.match(migration, new RegExp(`alter table dbf_ingest\\.${table} force row level security;`, "u"));
  }
});

test("browser roles have no direct DBF table access", () => {
  assert.match(migration, /revoke all on schema dbf_ingest from public, anon, authenticated;/u);
  assert.match(migration, /revoke all on all tables in schema dbf_ingest from public, anon, authenticated;/u);
  assert.match(migration, /from public, anon, authenticated;/u);
  assert.doesNotMatch(migration, /grant\s+(?:select|insert|update|delete)[\s\S]{0,240}\bto\s+(?:anon|authenticated)\b/iu);
  assert.doesNotMatch(migration, /create\s+policy/iu);
});

test("service role is explicit and delete remains unavailable", () => {
  assert.match(migration, /grant usage on schema dbf_ingest to service_role;/u);
  assert.match(migration, /grant select, insert on dbf_ingest\.source_files to service_role;/u);
  assert.match(migration, /grant select, insert, update on public\.dbf_pl_detail_facts,[\s\S]*to service_role;/u);
  assert.doesNotMatch(migration, /grant[\s\S]{0,200}\bdelete\b[\s\S]{0,200}\bto service_role/iu);
});

test("canonical UUID mapping is explicit and unresolved values quarantine", () => {
  assert.match(migration, /canonical_source text not null default 'nov_hub_master_api'/u);
  assert.match(migration, /canonical_evidence_sha256 text/u);
  assert.match(migration, /status = 'quarantined'[\s\S]*num_nonnulls\(company_id, store_id, employee_id, organization_id\) = 0/u);
  assert.match(migration, /status in \('active','retired'\)[\s\S]*num_nonnulls\(company_id, store_id, employee_id, organization_id\) = 1/u);
  assert.match(migration, /mapping_status in \('unresolved','resolved','quarantined'\)/u);
  assert.doesNotMatch(migration, /references\s+(?:public|core)\.(?:corporations|stores|employees|departments|corporation_identities|store_identities|employee_identities|department_identities)/iu);
});

test("version, active uniqueness, and correction lineage are enforced", () => {
  assert.equal((migration.match(/_active_grain/g) ?? []).length, 5);
  assert.equal((migration.match(/_version_grain/g) ?? []).length, 5);
  assert.equal((migration.match(/_correction_once/g) ?? []).length, 6);
  assert.equal((migration.match(/correction_of_fact_id uuid references public\./g) ?? []).length, 5);
  assert.equal((migration.match(/status text not null check \(status in \('provisional','confirmed'\)\)/g) ?? []).length, 5);
});

test("source tracking, audit, and promotion boundary are preserved", () => {
  assert.equal((migration.match(/source_file_id uuid not null references dbf_ingest\.source_files/g) ?? []).length, 6);
  assert.equal((migration.match(/batch_id uuid not null references dbf_ingest\.import_batches/g) ?? []).length, 9);
  assert.match(migration, /create table dbf_ingest\.import_events/u);
  assert.match(migration, /'owner_review','approved','promoted'/u);
  assert.match(migration, /No browser policies, public grants, promotion RPC, legacy backfill, or data/u);
});
