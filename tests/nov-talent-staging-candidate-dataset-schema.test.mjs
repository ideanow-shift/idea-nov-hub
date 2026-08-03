import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const migrationPath = path.join(
  root,
  "supabase",
  "migrations",
  "20260803083708_nov_talent_candidate_versioned_dataset.sql",
);
const sql = fs.readFileSync(migrationPath, "utf8");
const executableSql = sql.replace(/^\s*--.*$/gm, "");

test("Candidate staging schema is isolated from Event and Selection", () => {
  assert.match(sql, /create table public\.nov_talent_candidate_datasets_v1/i);
  assert.match(sql, /create table public\.nov_talent_candidate_dataset_records_v1/i);
  assert.match(sql, /source_type in \('CONTACTS_27', 'CONTACTS_28'\)/i);
  assert.doesNotMatch(executableSql, /create table[^;]*(event|selection|line_history)/i);
  assert.doesNotMatch(executableSql, /insert\s+into\s+public\./i);
});

test("dataset lifecycle supports exact-one activation and previous dataset restore", () => {
  assert.match(sql, /create schema if not exists nov_talent_internal/i);
  assert.match(sql, /state in \('BUILDING', 'READY', 'ACTIVE', 'RETIRED'\)/i);
  assert.match(sql, /where state = 'ACTIVE'/i);
  assert.match(sql, /create or replace function nov_talent_internal\.seal_candidate_dataset_v1/i);
  assert.match(sql, /create or replace function nov_talent_internal\.assert_candidate_dataset_operator_v1/i);
  assert.match(sql, /candidate_dataset_operator_required/i);
  assert.doesNotMatch(sql, /public\.assert_nov_talent_accountable_owner_v1/i);
  assert.match(sql, /candidate_dataset_count_mismatch/i);
  assert.match(sql, /create or replace function nov_talent_internal\.activate_candidate_dataset_v1/i);
  assert.match(sql, /lock table public\.nov_talent_candidate_datasets_v1 in share row exclusive mode/i);
  assert.match(sql, /set state = 'RETIRED'/i);
  assert.match(sql, /set state = 'ACTIVE'/i);
  assert.match(sql, /create or replace function nov_talent_internal\.restore_previous_candidate_dataset_v1/i);
});

test("636 Candidate acceptance counts are dataset contract values rather than hard-coded writes", () => {
  assert.match(sql, /expected_candidate_count integer not null/i);
  assert.match(sql, /expected_2027_count integer not null/i);
  assert.match(sql, /expected_2028_count integer not null/i);
  assert.match(sql, /expected_2027_count \+ expected_2028_count = expected_candidate_count/i);
  assert.match(sql, /v_total <> v_dataset\.expected_candidate_count/i);
  assert.match(sql, /v_2027 <> v_dataset\.expected_2027_count/i);
  assert.match(sql, /v_2028 <> v_dataset\.expected_2028_count/i);
  assert.doesNotMatch(sql, /values\s*\([^)]*636/i);
});

test("Candidate staging tables are fail-closed to browser roles", () => {
  assert.match(sql, /enable row level security/gi);
  assert.match(sql, /revoke all on table public\.nov_talent_candidate_datasets_v1\s+from public, anon, authenticated/i);
  assert.match(sql, /revoke all on table public\.nov_talent_candidate_dataset_records_v1\s+from public, anon, authenticated/i);
  assert.match(sql, /grant select, insert on table public\.nov_talent_candidate_datasets_v1\s+to service_role/i);
  assert.match(sql, /grant select, insert on table public\.nov_talent_candidate_dataset_records_v1\s+to service_role/i);
  assert.doesNotMatch(sql, /grant (?:select|insert|update|delete)[^;]*to (?:anon|authenticated)/i);
  assert.doesNotMatch(sql, /auth\.role\(\)/i);
});

test("sealed and active Candidate rows are immutable through the import grant", () => {
  assert.match(sql, /candidate_dataset_insert_must_be_building/i);
  assert.match(sql, /before insert on public\.nov_talent_candidate_datasets_v1/i);
  assert.match(sql, /candidate_dataset_not_building/i);
  assert.match(sql, /before insert on public\.nov_talent_candidate_dataset_records_v1/i);
  assert.doesNotMatch(sql, /grant[^;]*(?:update|delete)[^;]*nov_talent_candidate_dataset_records_v1/i);
  assert.match(sql, /revoke all on function nov_talent_internal\.activate_candidate_dataset_v1\(uuid, uuid\)/i);
  assert.match(sql, /revoke all on function nov_talent_internal\.assert_candidate_dataset_operator_v1\(uuid\)/i);
  assert.match(sql, /grant execute on function nov_talent_internal\.activate_candidate_dataset_v1\(uuid, uuid\)\s+to service_role/i);
  assert.doesNotMatch(sql, /security definer[\s\S]{0,1200}create or replace function public\./i);
});

test("migration is atomic and contains no data or Production promotion", () => {
  assert.match(sql.trim(), /^begin;/i);
  assert.match(sql.trim(), /commit;$/i);
  assert.doesNotMatch(executableSql, /(?:insert\s+into|update|delete\s+from)\s+public\.(?!nov_talent_candidate_dataset)/i);
  assert.doesNotMatch(executableSql, /public\.(?:nov_talent_applications|employees|employee_core|line_history)/i);
});
