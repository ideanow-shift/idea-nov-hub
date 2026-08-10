import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { SECURITY_ALLOWLIST } from './execution-path-security.mjs';

const pgBin = process.env.BDF_PG_BIN;
if (!pgBin) throw new Error('BDF_PG_BIN_REQUIRED');
const environment = { ...process.env, LANG: 'C', LC_ALL: 'C', PGCLIENTENCODING: 'UTF8', TZ: 'UTC' };
const port = 59500 + (process.pid % 200);
const database = 'soce_v13';
const directory = await mkdtemp(join(tmpdir(), 'soce-v13-pg17-'));
const executable = (name) => join(pgBin, `${name}.exe`);
let started = false;
let server = null;
let passed = 0;

function command(name, args, input = undefined, allowFailure = false) {
  const result = spawnSync(executable(name), args, { encoding: 'utf8', env: environment, input, windowsHide: true, maxBuffer: 16 * 1024 * 1024 });
  if (!allowFailure && result.status !== 0) throw new Error(`${name}\n${result.stdout}\n${result.stderr}`);
  return result;
}

function psql(sql, allowFailure = false) {
  return command('psql', ['-X', '-v', 'ON_ERROR_STOP=1', '-At', '-h', '127.0.0.1', '-p', String(port), '-U', 'postgres', '-d', database], sql, allowFailure);
}

async function test(name, fn) {
  await fn();
  passed += 1;
  process.stdout.write(`PASS ${name}\n`);
}

function evidenceFor(role, sql) {
  const statement = sql.trimEnd().replace(/;$/, '');
  const script = `
SET SESSION AUTHORIZATION "${role}";
BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL search_path = pg_catalog;
SET LOCAL default_transaction_read_only = on;
${statement}
\\gset soce_
\\echo SOCE_EVIDENCE|:soce_read_only_role_contract_passed|:soce_effective_temp_privilege_count|:soce_executable_application_routine_count|:soce_direct_application_routine_execute_count|:soce_effective_update_privilege_count
ROLLBACK;
`;
  const output = psql(script).stdout.split(/\r?\n/).find((line) => line.startsWith('SOCE_EVIDENCE|'));
  assert.ok(output, 'missing SOCE_EVIDENCE');
  const [, passedValue, temp, executableRoutine, directRoutine, update] = output.split('|');
  return { passed: passedValue === 't', temp: Number(temp), executableRoutine: Number(executableRoutine), directRoutine: Number(directRoutine), update: Number(update) };
}

try {
  command('initdb', ['-D', directory, '-U', 'postgres', '-A', 'trust', '--encoding=UTF8', '--locale=C']);
  server = spawn(executable('postgres'), ['-D', directory, '-p', String(port), '-h', '127.0.0.1'], { env: environment, windowsHide: true, stdio: 'ignore' });
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const ready = command('pg_isready', ['-h', '127.0.0.1', '-p', String(port), '-U', 'postgres'], undefined, true);
    if (ready.status === 0) break;
    if (attempt === 99) throw new Error('POSTGRES_START_TIMEOUT');
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  started = true;
  command('createdb', ['-h', '127.0.0.1', '-p', String(port), '-U', 'postgres', database]);
  const version = Number(psql("select current_setting('server_version_num')::integer;").stdout.trim());
  assert.equal(Math.trunc(version / 10000), 17);

  psql(`
    REVOKE CREATE ON DATABASE ${database} FROM PUBLIC;
    REVOKE ALL ON SCHEMA public FROM PUBLIC;
    CREATE SCHEMA app_fixture AUTHORIZATION postgres;
    CREATE ROLE ro_safe LOGIN NOINHERIT NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS CONNECTION LIMIT 1 VALID UNTIL '2099-01-01';
    CREATE ROLE ro_direct LOGIN NOINHERIT NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS CONNECTION LIMIT 1 VALID UNTIL '2099-01-01';
    CREATE ROLE ro_writer LOGIN NOINHERIT NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS CONNECTION LIMIT 1 VALID UNTIL '2099-01-01';
    ALTER ROLE ro_safe SET default_transaction_read_only = on;
    ALTER ROLE ro_direct SET default_transaction_read_only = on;
    ALTER ROLE ro_writer SET default_transaction_read_only = on;
    CREATE TABLE app_fixture.write_target(id integer);
    CREATE FUNCTION app_fixture.public_action() RETURNS integer LANGUAGE sql VOLATILE AS 'SELECT 1';
    GRANT EXECUTE ON FUNCTION app_fixture.public_action() TO ro_direct;
    GRANT USAGE ON SCHEMA app_fixture TO ro_writer;
    GRANT UPDATE ON TABLE app_fixture.write_target TO ro_writer;
  `);
  const sourceSql = await readFile(join(import.meta.dirname, 'queries', 'SOCE-QP01-SOURCE-READONLY.sql'), 'utf8');
  const targetSql = await readFile(join(import.meta.dirname, 'queries', 'SOCE-QP01-TARGET-READONLY.sql'), 'utf8');

  await test('PostgreSQL 17 is used', () => assert.equal(Math.trunc(version / 10000), 17));
  await test('PUBLIC TEMP and PUBLIC routine EXECUTE remain while the safe role passes', () => {
    for (const sql of [sourceSql, targetSql]) {
      const evidence = evidenceFor('ro_safe', sql);
      assert.equal(evidence.passed, true);
      assert.ok(evidence.temp > 0);
      assert.ok(evidence.executableRoutine > 0);
      assert.equal(evidence.directRoutine, 0);
      assert.equal(evidence.update, 0);
    }
  });
  await test('a direct application routine grant is fail-closed', () => {
    const evidence = evidenceFor('ro_direct', sourceSql);
    assert.equal(evidence.passed, false);
    assert.ok(evidence.directRoutine > 0);
  });
  await test('a direct write grant is fail-closed', () => {
    const evidence = evidenceFor('ro_writer', sourceSql);
    assert.equal(evidence.passed, false);
    assert.ok(evidence.update > 0);
  });
  await test('PostgreSQL READ ONLY rejects DML even when the role has UPDATE', () => {
    const result = psql(`SET SESSION AUTHORIZATION ro_writer; BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY; UPDATE app_fixture.write_target SET id=1;`, true);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /read-only transaction/i);
  });
  await test('every fixed function signature resolves to a pg_catalog OID', () => {
    const signatures = Object.values(SECURITY_ALLOWLIST.functionSignatures).flat();
    const values = signatures.map((signature) => `('${signature.replaceAll("'", "''")}')`).join(',');
    const count = Number(psql(`select count(*) from (values ${values}) s(signature) where to_regprocedure(signature) is not null and to_regprocedure(signature)::oid in (select oid from pg_proc where pronamespace='pg_catalog'::regnamespace);`).stdout.trim());
    assert.equal(count, signatures.length);
  });
  await test('every fixed operator signature resolves to a pg_catalog OID', () => {
    const signatures = SECURITY_ALLOWLIST.operatorSignatures;
    const values = signatures.map((signature) => `('${signature.replaceAll("'", "''")}')`).join(',');
    const count = Number(psql(`select count(*) from (values ${values}) s(signature) where to_regoperator(signature) is not null and to_regoperator(signature)::oid in (select oid from pg_operator where oprnamespace='pg_catalog'::regnamespace);`).stdout.trim());
    assert.equal(count, signatures.length);
  });
} finally {
  if (started) command('pg_ctl', ['-D', directory, '-m', 'immediate', '-w', 'stop'], undefined, true);
  if (server && server.exitCode === null) server.kill();
  await rm(directory, { recursive: true, force: true, maxRetries: 5 });
}

assert.equal(passed, 7);
process.stdout.write(`RESULT ${passed}/7 PASS\n`);
