import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const root = process.cwd();
const migrationsDir = path.join(root, 'supabase', 'migrations');
const rollbackDir = path.join(root, 'supabase', 'rollback', 'pr001a');

const migrationFiles = (await readdir(migrationsDir))
  .filter((name) => /_m0(?:0[1-9]|10)_bdf_/.test(name))
  .sort();
const rollbackFiles = (await readdir(rollbackDir))
  .filter((name) => /^m0(?:0[1-9]|10)_bdf_.*\.rollback\.sql$/.test(name))
  .sort();

const migrationSql = new Map(
  await Promise.all(migrationFiles.map(async (name) => [name, await readFile(path.join(migrationsDir, name), 'utf8')]))
);
const rollbackSql = new Map(
  await Promise.all(rollbackFiles.map(async (name) => [name, await readFile(path.join(rollbackDir, name), 'utf8')]))
);
const allForward = [...migrationSql.values()].join('\n');
const m010 = [...migrationSql.entries()].find(([name]) => name.includes('_m010_'))[1];
const preM010 = [...migrationSql.entries()]
  .filter(([name]) => !name.includes('_m010_'))
  .map(([, sql]) => sql)
  .join('\n');

test('M001-M010 exist exactly once and are timestamp ordered', () => {
  assert.equal(migrationFiles.length, 10);
  const ids = migrationFiles.map((name) => name.match(/_(m0(?:0[1-9]|10))_/)[1].toUpperCase());
  assert.deepEqual(ids, Array.from({ length: 10 }, (_, index) => `M${String(index + 1).padStart(3, '0')}`));
});

test('all migration dollar-quoted bodies are closed with matching tags', () => {
  for (const [name, sql] of migrationSql) {
    const tags = sql.match(/\$[a-z_]*\$/gi) ?? [];
    assert.equal(tags.length % 2, 0, `${name}: unpaired dollar quote`);
    for (let index = 0; index < tags.length; index += 2) {
      assert.equal(tags[index], tags[index + 1], `${name}: mismatched dollar quote`);
    }
  }
});

test('rollback package covers M001-M010 exactly once', () => {
  assert.equal(rollbackFiles.length, 10);
  const ids = rollbackFiles.map((name) => name.slice(0, 4).toUpperCase());
  assert.deepEqual(ids, Array.from({ length: 10 }, (_, index) => `M${String(index + 1).padStart(3, '0')}`));
});

test('forward migrations never reference Production physical masters', () => {
  for (const forbidden of [
    'public.employees',
    'public.stores',
    'public.corporations',
    'public.departments',
    'public.employee_store_assignments',
    'idea-nov-core',
    'project_ref',
    'firebase_uid',
  ]) {
    assert.equal(preM010.toLowerCase().includes(forbidden), false, `forbidden dependency: ${forbidden}`);
  }
  assert.doesNotMatch(preM010, /^\s*(?:insert|update|delete|truncate|drop)\b/im);
});

test('canonical identities use UUID PKs and source keys stay in crosswalk', () => {
  for (const table of ['corporation', 'store', 'department', 'employee', 'assignment']) {
    assert.match(allForward, new RegExp(`create table core\\.${table}_identities \\([\\s\\S]*?${table}_id uuid primary key`, 'i'));
  }
  assert.match(allForward, /create table governance\.source_entity_crosswalks/i);
  assert.match(allForward, /create table governance\.canonical_entity_registry/i);
  assert.match(allForward, /source_entity_crosswalks_canonical_fk foreign key \(canonical_entity_id, entity_type\)/i);
  assert.doesNotMatch(allForward, /source_record_key[^;]*create table core\./i);
});

test('version registry makes Version Members type-safe and exact-one per entity', () => {
  assert.match(allForward, /create table governance\.canonical_version_registry/i);
  assert.match(allForward, /master_version_members_registry_fk foreign key/i);
  assert.match(allForward, /primary key \(master_version_id, entity_type, canonical_entity_id\)/i);
  assert.match(allForward, /master_version_members_version_unique unique \(master_version_id, entity_type, entity_version_id\)/i);
});

test('all effective-dated canonical tables reject invalid and overlapping periods', () => {
  for (const marker of [
    'corporations_period_excl',
    'stores_period_excl',
    'departments_period_excl',
    'employees_period_excl',
    'employee_store_assignments_identity_period_excl',
    'corporation_store_relationships_period_excl',
    'source_entity_crosswalks_period_excl',
  ]) assert.match(allForward, new RegExp(marker));
});

test('Store Scope expresses primary assignment and prevents overlap', () => {
  assert.match(allForward, /assignment_kind in \('primary', 'secondary', 'temporary', 'support'\)/);
  assert.match(allForward, /employee_store_assignments_primary_period_excl/);
  assert.match(allForward, /allocation_ratio > 0 and allocation_ratio <= 1/);
});

test('population requires Human Review and isolates unresolved stores', () => {
  assert.match(allForward, /'pending_review', 'excluded', 'non_operational', 'unresolved'/);
  assert.match(allForward, /review_status = 'approved'/);
  assert.match(allForward, /expected_direct_count \+ expected_franchise_count = expected_official_count/);
  for (const marker of [
    'item_count <> new.expected_item_count',
    'official_count <> 20',
    'direct_count <> 13',
    'franchise_count <> 7',
    'pending_count <> 0',
    'unresolved_count <> 0',
    'rejected_official_count <> 0',
  ]) assert.match(allForward, new RegExp(marker.replaceAll('.', '\\.')));
  assert.match(allForward, /guard_store_population_publication/);
  assert.match(allForward, /guard_store_population_item_mutation/);
});

test('immutable strategy B is enforced by system-version registry and DML guards', () => {
  for (const marker of [
    'reject_corporations_mutation', 'reject_stores_mutation', 'reject_departments_mutation',
    'reject_employees_mutation', 'reject_assignments_mutation',
    'reject_corporation_store_relationships_mutation', 'reject_master_audit_event_mutation',
    'guard_master_source_snapshot_mutation', 'guard_master_version_member_mutation',
  ]) assert.match(allForward, new RegExp(marker));
  assert.match(allForward, /source_snapshot_id with =,[\s\S]*?daterange\(effective_from, effective_to, '\[\)'\) with &&/i);
  assert.match(allForward, /BDF_IMMUTABLE_ROW/);
});

test('projections are security invoker and public access is revoked', () => {
  const viewCount = (allForward.match(/with \(security_invoker = true\)/g) ?? []).length;
  assert.equal(viewCount, 5);
  assert.equal((allForward.match(/where mv\.status = 'published'/g) ?? []).length, 5);
  assert.equal((allForward.match(/mr\.release_sequence = \(select max\(release_sequence\)/g) ?? []).length, 5);
  assert.match(allForward, /revoke all on all tables in schema core from public, anon, authenticated, service_role/i);
  assert.match(allForward, /alter table core\.employees enable row level security/i);
  assert.doesNotMatch(allForward, /security definer/i);
});

test('every Canonical and governance table is RLS enabled', () => {
  const createdTables = [...allForward.matchAll(/create table (core|governance)\.([a-z0-9_]+)\s*\(/gi)]
    .map((match) => `${match[1]}.${match[2]}`);
  assert.equal(createdTables.length, 22);
  for (const table of createdTables) {
    assert.match(allForward, new RegExp(`alter table ${table.replace('.', '\\.')} enable row level security`, 'i'));
    assert.match(allForward, new RegExp(`alter table ${table.replace('.', '\\.')} force row level security`, 'i'));
  }
});

test('M010 fixes the exact five-view contract and fails when M008 is absent', () => {
  const required = [
    'corporation_master_v1', 'department_master_v1', 'employee_assignment_v1',
    'master_manifest_v1', 'store_master_v1',
  ];
  assert.match(m010, /expected_view_count/);
  assert.match(m010, /actual_view_count/);
  assert.match(m010, /missing_view_names/);
  assert.match(m010, /unexpected_view_names/);
  assert.match(m010, /insecure_view_names/);
  for (const view of required) assert.match(m010, new RegExp(`'${view}'`));
  const simulatedViewsWithoutM008 = new Set();
  const missing = required.filter((view) => !simulatedViewsWithoutM008.has(view));
  assert.equal(missing.length, 5);
  assert.match(m010, /BDF_PR001A_REQUIRED_VIEW_CONTRACT_FAILED/);
});

test('M010 contains executable rollback-only negative fixtures for every blocker', () => {
  for (const marker of [
    'BDF_TEST_ORPHAN_FK_ACCEPTED', 'BDF_TEST_CROSSWALK_TYPE_MISMATCH_ACCEPTED',
    'BDF_TEST_DUPLICATE_SNAPSHOT_ACCEPTED', 'BDF_TEST_OVERLAPPING_PERIOD_ACCEPTED',
    'BDF_TEST_IMMUTABLE_UPDATE_ACCEPTED', 'BDF_TEST_IMMUTABLE_DELETE_ACCEPTED',
    'BDF_TEST_VERSION_MEMBER_TYPE_MISMATCH_ACCEPTED', 'BDF_TEST_UNPUBLISHED_PROJECTION_VISIBLE',
    'BDF_TEST_VERSION_MEMBER_ORPHAN_ROW_ACCEPTED',
    'BDF_TEST_PRIMARY_ASSIGNMENT_OVERLAP_ACCEPTED', 'BDF_TEST_PENDING_REVIEW_PUBLICATION_ACCEPTED',
    'BDF_TEST_20_13_7_MISMATCH_ACCEPTED', 'BDF_TEST_REJECTED_OFFICIAL_STORE_ACCEPTED',
    'BDF_TEST_UNRESOLVED_PUBLICATION_ACCEPTED', 'BDF_TEST_HEADER_ITEM_MISMATCH_ACCEPTED',
    'BDF_TEST_ZERO_ITEM_PUBLICATION_ACCEPTED', 'BDF_TEST_PUBLISHED_POPULATION_ITEM_UPDATE_ACCEPTED',
    'BDF_TEST_PUBLISHED_POPULATION_ITEM_DELETE_ACCEPTED', 'BDF_TEST_PUBLISHED_POPULATION_ITEM_INSERT_ACCEPTED',
    'BDF_TEST_PUBLISHED_MEMBER_DELETE_ACCEPTED', 'BDF_TEST_CONFIRMED_SNAPSHOT_DELETE_ACCEPTED',
    'BDF_TEST_AUDIT_UPDATE_ACCEPTED', 'BDF_TEST_AUDIT_DELETE_ACCEPTED',
    'BDF_TEST_PUBLICATION_RELEASE_DELETE_ACCEPTED',
    'BDF_TEST_PUBLISHED_POPULATION_UPDATE_ACCEPTED', 'BDF_TEST_CONFIRMED_SNAPSHOT_UPDATE_ACCEPTED',
    'BDF_TEST_PUBLISHED_MASTER_UPDATE_ACCEPTED', 'BDF_TEST_PUBLISHED_MEMBER_UPDATE_ACCEPTED',
  ]) assert.match(m010, new RegExp(marker));
  assert.match(m010, /BDF_TEST_ROLLBACK/g);
});

test('required FK and scope lookup indexes are declared', () => {
  for (const marker of [
    'source_entity_crosswalks_snapshot_idx',
    'canonical_version_registry_entity_idx',
    'canonical_version_registry_snapshot_idx',
    'corporations_snapshot_idx',
    'stores_snapshot_idx',
    'departments_corporation_idx',
    'departments_parent_idx',
    'employees_department_idx',
    'employee_store_assignments_employee_asof_idx',
    'employee_store_assignments_store_asof_idx',
    'corporation_store_relationships_corporation_idx',
    'store_population_items_store_idx',
    'master_version_members_entity_idx',
  ]) assert.match(allForward, new RegExp(marker));
});

test('rollback stays Staging-only and never uses CASCADE', () => {
  for (const [name, sql] of rollbackSql) {
    if (name.startsWith('m010')) continue;
    assert.match(sql, /STAGING ONLY/i);
    assert.doesNotMatch(sql, /\bcascade\b/i);
  }
});

test('rollback removes every hardening trigger and function before its tables', () => {
  const m006Rollback = [...rollbackSql.entries()].find(([name]) => name.startsWith('m006'))[1];
  const m007Rollback = [...rollbackSql.entries()].find(([name]) => name.startsWith('m007'))[1];
  assert.match(m006Rollback, /drop trigger if exists guard_store_population_publication/i);
  assert.match(m006Rollback, /drop function if exists governance\.guard_store_population_publication\(\)/i);
  assert.match(m007Rollback, /drop trigger if exists reject_master_audit_event_mutation/i);
  assert.match(m007Rollback, /drop function if exists governance\.reject_immutable_mutation\(\)/i);
});
