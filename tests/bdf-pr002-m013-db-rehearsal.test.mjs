import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..');
const enabled = process.env.BDF_RUN_M013_DB_REHEARSAL === '1';
const pgBin = process.env.BDF_PG_BIN;
const env = { ...process.env, LANG: 'C', LC_ALL: 'C', PGCLIENTENCODING: 'UTF8', TZ: 'UTC' };

const migrations = [
  '20260806090905_m001_bdf_schemas_default_deny.sql',
  '20260806090908_m002_bdf_source_identity_envelope.sql',
  '20260806090911_m003_bdf_corporations_stores.sql',
  '20260806090915_m004_bdf_departments_employees.sql',
  '20260806090918_m005_bdf_employee_store_assignments.sql',
  '20260806090921_m006_bdf_store_relationships_population.sql',
  '20260806090925_m007_bdf_master_versions_audit.sql',
  '20260806090928_m008_bdf_master_projections.sql',
  '20260806090931_m009_bdf_rls_grants.sql',
  '20260806090935_m010_bdf_verification_gate.sql',
  '20260806201417_m011_bdf_snapshot_metadata_foundation.sql',
  '20260807112029_m061_bdf_snapshot_contract_versions_nonblank.sql',
  '20260806223721_m012_bdf_accounting_import_boundary.sql',
  '20260807122604_m013_bdf_account_master_statement_mapping.sql',
];

const rollbacks = [
  'supabase/rollback/pr002/m013_bdf_account_master_statement_mapping.rollback.sql',
  'supabase/rollback/pr002/m012_bdf_accounting_import_boundary.rollback.sql',
  'supabase/rollback/pr001b1/m061_bdf_snapshot_contract_versions_nonblank.rollback.sql',
  'supabase/rollback/pr001b1/m011_bdf_snapshot_metadata_foundation.rollback.sql',
  'supabase/rollback/pr001a/m010_bdf_verification_gate.rollback.sql',
  'supabase/rollback/pr001a/m009_bdf_rls_grants.rollback.sql',
  'supabase/rollback/pr001a/m008_bdf_master_projections.rollback.sql',
  'supabase/rollback/pr001a/m007_bdf_master_versions_audit.rollback.sql',
  'supabase/rollback/pr001a/m006_bdf_store_relationships_population.rollback.sql',
  'supabase/rollback/pr001a/m005_bdf_employee_store_assignments.rollback.sql',
  'supabase/rollback/pr001a/m004_bdf_departments_employees.rollback.sql',
  'supabase/rollback/pr001a/m003_bdf_corporations_stores.rollback.sql',
  'supabase/rollback/pr001a/m002_bdf_source_identity_envelope.rollback.sql',
  'supabase/rollback/pr001a/m001_bdf_schemas_default_deny.rollback.sql',
];

function command(executable, args, input, allowFailure = false) {
  const result = spawnSync(executable, args, {
    cwd: root, encoding: 'utf8', env, input, maxBuffer: 32 * 1024 * 1024,
  });
  if (!allowFailure && result.status !== 0) {
    throw new Error(`${executable} ${args.join(' ')} failed\n${result.stdout}\n${result.stderr}`);
  }
  return result;
}

test('M001-M011, M061, M012, M013 forward, rollback, and reapply are deterministic', {
  skip: !enabled && 'set BDF_RUN_M013_DB_REHEARSAL=1', timeout: 300_000,
}, async () => {
  assert.ok(pgBin, 'BDF_PG_BIN is required for the PostgreSQL 17 local gate');
  const dataDir = await mkdtemp(path.join(os.tmpdir(), 'bdf-m013-pg17-'));
  const port = 56500 + (process.pid % 500);
  const exe = (name) => path.join(pgBin, `${name}.exe`);
  let started = false;

  const psql = (sql) => command(exe('psql'), [
    '-X', '-v', 'ON_ERROR_STOP=1', '-At', '-h', '127.0.0.1', '-p', String(port),
    '-U', 'postgres', '-d', 'bdf_m013_rehearsal',
  ], sql);
  const fileSql = (relative) => readFile(path.join(root, relative), 'utf8');
  const applyAll = async () => {
    for (const name of migrations) await psql(await fileSql(`supabase/migrations/${name}`));
  };
  const catalog = () => psql(`
    with tokens as (
      select 'relation|' || n.nspname || '|' || c.relname || '|' || c.relkind::text || '|' ||
        c.relrowsecurity::text || '|' || c.relforcerowsecurity::text as token
      from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname in ('core','governance','projection','accounting')
      union all
      select 'constraint|' || n.nspname || '|' || c.relname || '|' || con.conname || '|' ||
        pg_get_constraintdef(con.oid)
      from pg_constraint con join pg_class c on c.oid=con.conrelid
      join pg_namespace n on n.oid=c.relnamespace
      where n.nspname in ('core','governance','projection','accounting')
      union all
      select 'index|' || schemaname || '|' || indexname || '|' || indexdef
      from pg_indexes where schemaname in ('core','governance','projection','accounting')
      union all
      select 'function|' || n.nspname || '|' || p.proname || '|' || pg_get_functiondef(p.oid)
      from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname in ('core','governance','projection','accounting')
    ) select token from tokens order by token;
  `).stdout;

  try {
    command(exe('initdb'), ['-D', dataDir, '-U', 'postgres', '-A', 'trust', '--encoding=UTF8', '--locale=C']);
    const server = spawn(exe('postgres'), ['-D', dataDir, '-p', String(port), '-h', '127.0.0.1'], {
      detached: true, env, stdio: 'ignore', windowsHide: true,
    });
    server.unref();
    for (let i = 0; i < 80; i += 1) {
      if (command(exe('pg_isready'), ['-h', '127.0.0.1', '-p', String(port), '-U', 'postgres'], undefined, true).status === 0) {
        started = true; break;
      }
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    assert.equal(started, true);
    command(exe('createdb'), ['-h', '127.0.0.1', '-p', String(port), '-U', 'postgres',
      '-T', 'template0', '-E', 'UTF8', '--locale=C', 'bdf_m013_rehearsal']);
    psql(`create schema extensions;
      create role anon nologin;
      create role authenticated nologin;
      create role service_role nologin;`);

    await applyAll();
    await psql(await fileSql('supabase/validation/pr002/validate_m013.sql'));
    await psql(await fileSql('supabase/validation/pr002/test_m013_account_mapping.sql'));
    const residue = psql(`select
      (select count(*) from accounting.account_identities) +
      (select count(*) from accounting.accounts) +
      (select count(*) from accounting.account_statement_mappings);`).stdout.trim();
    assert.equal(residue, '0');
    const initialCatalog = catalog();
    const initialHash = createHash('sha256').update(initialCatalog).digest('hex');

    await psql(await fileSql(rollbacks[0]));
    assert.equal(psql(`select count(*) from information_schema.tables
      where table_schema='accounting' and table_name in
      ('account_identities','accounts','account_statement_mappings');`).stdout.trim(), '0');
    assert.equal(psql(`select count(*) from information_schema.tables
      where table_schema='accounting' and table_name in
      ('import_batches','import_files','import_staging_lines');`).stdout.trim(), '3');
    await psql(await fileSql(`supabase/migrations/${migrations.at(-1)}`));
    assert.equal(createHash('sha256').update(catalog()).digest('hex'), initialHash);

    for (const rollback of rollbacks) await psql(await fileSql(rollback));
    assert.equal(psql(`select count(*) from pg_namespace
      where nspname in ('core','governance','projection','accounting');`).stdout.trim(), '0');

    await applyAll();
    await psql(await fileSql('supabase/validation/pr002/validate_m013.sql'));
    await psql(await fileSql('supabase/validation/pr002/test_m013_account_mapping.sql'));
    const reapplyCatalog = catalog();
    const reapplyHash = createHash('sha256').update(reapplyCatalog).digest('hex');
    assert.equal(reapplyHash, initialHash);
    process.stdout.write(`BDF_M013_REHEARSAL_PASS forward=14 rollback=14 reapply=14 catalog=${initialHash}\n`);
  } finally {
    if (started) command(exe('pg_ctl'), ['-D', dataDir, '-m', 'immediate', '-w', 'stop'], undefined, true);
    await rm(dataDir, { recursive: true, force: true });
  }
});
