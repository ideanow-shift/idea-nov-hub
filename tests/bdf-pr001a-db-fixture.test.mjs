import assert from 'node:assert/strict';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..');
const migrationDir = path.join(root, 'supabase', 'migrations');
const enabled = process.env.BDF_RUN_DB_FIXTURE_TEST === '1';
const engine = process.env.BDF_CONTAINER_ENGINE || 'podman';
const image = process.env.BDF_POSTGRES_IMAGE || 'postgres:17-alpine';
const pgBin = process.env.BDF_PG_BIN;
const childEnv = {
  ...process.env,
  LANG: 'C',
  LC_ALL: 'C',
  PGCLIENTENCODING: 'UTF8',
  TZ: 'UTC',
};

function command(executable, args, input, allowFailure = false) {
  const result = spawnSync(executable, args, {
    cwd: root,
    encoding: 'utf8',
    env: childEnv,
    input,
    maxBuffer: 16 * 1024 * 1024,
  });
  if (!allowFailure && result.status !== 0) {
    throw new Error([
      `${executable} ${args.join(' ')} failed with ${result.status}`,
      result.stdout,
      result.stderr,
    ].join('\n'));
  }
  return result;
}

function psql(container, sql) {
  return command(engine, [
    'exec', '-i', container, 'psql', '-X', '-v', 'ON_ERROR_STOP=1',
    '-U', 'postgres', '-d', 'postgres',
  ], sql);
}

async function verifyMigrations(executeSql) {
  const migrations = (await readdir(migrationDir))
    .filter((name) => /^202608060909\d{2}_m0(?:0[1-9]|10)_bdf_.*\.sql$/.test(name))
    .sort();
  assert.equal(migrations.length, 10);

  await executeSql([
    'create schema if not exists extensions;',
    'create role anon nologin;',
    'create role authenticated nologin;',
    'create role service_role nologin;',
  ].join('\n'));

  let firstM010Output = '';
  for (const migration of migrations) {
    let result;
    try {
      result = await executeSql(await readFile(path.join(migrationDir, migration), 'utf8'));
    } catch (error) {
      error.message = `database execution failed at ${migration}\n${error.message}`;
      throw error;
    }
    if (migration.includes('_m010_')) firstM010Output = `${result.stdout}\n${result.stderr}`;
  }

  assert.match(firstM010Output, /BDF_TEST_PENDING_REVIEW_REJECTED pending_review_count=1/);
  assert.match(firstM010Output, /BDF_TEST_NORMAL_PUBLICATION_SUCCEEDED official=20 direct=13 franchise=7 pending=0/);
  assert.match(firstM010Output, /BDF_TEST_FIXTURE_CLEANUP_SUCCEEDED residue=0/);

  const residue = (await executeSql([
    'select count(*) from governance.master_source_snapshots',
    "where source_system = 'synthetic';",
  ].join('\n'))).stdout.trim();
  assert.equal(residue, '0');

  const m010Name = migrations.find((name) => name.includes('_m010_'));
  const secondM010 = await executeSql(await readFile(path.join(migrationDir, m010Name), 'utf8'));
  const secondM010Output = `${secondM010.stdout}\n${secondM010.stderr}`;
  assert.match(secondM010Output, /BDF_TEST_PENDING_REVIEW_REJECTED pending_review_count=1/);
  assert.match(secondM010Output, /BDF_TEST_NORMAL_PUBLICATION_SUCCEEDED official=20 direct=13 franchise=7 pending=0/);
  assert.match(secondM010Output, /BDF_TEST_FIXTURE_CLEANUP_SUCCEEDED residue=0/);

  const rerunResidue = (await executeSql([
    'select count(*) from governance.master_source_snapshots',
    "where source_system = 'synthetic';",
  ].join('\n'))).stdout.trim();
  assert.equal(rerunResidue, '0');
}

test('M001-M010 fixtures execute, roll back, and rerun on disposable PostgreSQL', {
  skip: !enabled && 'set BDF_RUN_DB_FIXTURE_TEST=1 to run the disposable DB regression',
  timeout: 180_000,
}, async () => {
  if (pgBin) {
    const dataDir = await mkdtemp(path.join(os.tmpdir(), 'bdf-pr001a-pg17-'));
    const port = 55432 + (process.pid % 1000);
    const initdb = path.join(pgBin, 'initdb.exe');
    const pgCtl = path.join(pgBin, 'pg_ctl.exe');
    const postgres = path.join(pgBin, 'postgres.exe');
    const pgIsReady = path.join(pgBin, 'pg_isready.exe');
    const createdb = path.join(pgBin, 'createdb.exe');
    const localPsql = path.join(pgBin, 'psql.exe');
    let started = false;
    try {
      command(initdb, ['-D', dataDir, '-U', 'postgres', '-A', 'trust', '--encoding=SQL_ASCII', '--locale=C']);
      const server = spawn(postgres, ['-D', dataDir, '-p', String(port), '-h', '127.0.0.1'], {
        detached: true,
        env: childEnv,
        stdio: 'ignore',
        windowsHide: true,
      });
      server.unref();
      let ready = false;
      for (let attempt = 0; attempt < 60; attempt += 1) {
        const probe = command(pgIsReady, ['-h', '127.0.0.1', '-p', String(port), '-U', 'postgres'], undefined, true);
        if (probe.status === 0) {
          ready = true;
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
      assert.equal(ready, true, 'local PostgreSQL did not become ready');
      started = true;
      command(createdb, [
        '-h', '127.0.0.1', '-p', String(port), '-U', 'postgres',
        '-T', 'template0', '-E', 'UTF8', '--locale=C', 'bdf_pr001a_fixture',
      ]);
      await verifyMigrations(async (sql) => command(localPsql, [
        '-X', '-v', 'ON_ERROR_STOP=1', '-At', '-h', '127.0.0.1', '-p', String(port),
        '-U', 'postgres', '-d', 'bdf_pr001a_fixture',
      ], sql));
    } finally {
      if (started) command(pgCtl, ['-D', dataDir, '-m', 'immediate', '-w', 'stop'], undefined, true);
      await rm(dataDir, { recursive: true, force: true });
    }
    return;
  }

  const container = `bdf-pr001a-fixture-${process.pid}`;

  try {
    command(engine, [
      'run', '--rm', '-d', '--name', container,
      '-e', 'POSTGRES_PASSWORD=bdf_fixture_only', image,
    ]);

    let ready = false;
    for (let attempt = 0; attempt < 60; attempt += 1) {
      const probe = command(engine, ['exec', container, 'pg_isready', '-U', 'postgres'], undefined, true);
      if (probe.status === 0) {
        ready = true;
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    assert.equal(ready, true, 'disposable PostgreSQL did not become ready');

    await verifyMigrations(async (sql) => psql(container, sql));
  } finally {
    command(engine, ['rm', '-f', container], undefined, true);
  }
});
