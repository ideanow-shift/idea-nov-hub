import assert from 'node:assert/strict';
import { access, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const moduleRoot = process.env.SOCE_PGLITE_MODULE_ROOT;
const modulePath = moduleRoot && join(moduleRoot, '@electric-sql', 'pglite', 'dist', 'index.js');
let passed = 0;

async function test(name, fn) {
  await fn();
  passed += 1;
  process.stdout.write(`PASS ${name}\n`);
}

function quoteIdentifier(identifier) {
  return `"${identifier.replaceAll('"', '""')}"`;
}

function expectRejected(row, field) {
  assert.equal(row.read_only_role_contract_passed, false);
  assert.equal(Number(row[field]) > 0, true, field);
}

if (!modulePath) throw new Error('LOCAL_POSTGRES17_TEST_DEPENDENCY_REQUIRED');
await access(modulePath);
const { PGlite } = await import(pathToFileURL(modulePath).href);
const sourceSql = await readFile(join(here, 'queries', 'SOCE-QP01-SOURCE-READONLY.sql'), 'utf8');
const targetSql = await readFile(join(here, 'queries', 'SOCE-QP01-TARGET-READONLY.sql'), 'utf8');
const temporaryDirectory = await mkdtemp(join(tmpdir(), 'soce-pg17-role-'));
let admin = null;

try {
  admin = await PGlite.create({ dataDir: temporaryDirectory });
  const version = Number((await admin.query("SELECT current_setting('server_version_num')::integer AS server_version_num")).rows[0].server_version_num);
  assert.equal(Math.trunc(version / 10000), 17);
  const databaseName = (await admin.query('SELECT current_database() AS database_name')).rows[0].database_name;
  const database = quoteIdentifier(databaseName);

  await admin.exec(`
    REVOKE CREATE, TEMPORARY ON DATABASE ${database} FROM PUBLIC;
    REVOKE ALL ON SCHEMA public FROM PUBLIC;
    CREATE SCHEMA core AUTHORIZATION postgres;
    CREATE SCHEMA third AUTHORIZATION postgres;
    CREATE SCHEMA app_fixture AUTHORIZATION postgres;
    CREATE ROLE ro_safe NOLOGIN NOINHERIT NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
    CREATE ROLE ro_database_owner NOLOGIN NOINHERIT NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
    CREATE ROLE ro_schema_owner NOLOGIN NOINHERIT NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
    CREATE ROLE ro_relation_owner NOLOGIN NOINHERIT NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
    CREATE ROLE ro_function_owner NOLOGIN NOINHERIT NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
    CREATE ROLE ro_type_owner NOLOGIN NOINHERIT NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
    CREATE ROLE ro_temp NOLOGIN NOINHERIT NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
    CREATE ROLE ro_writer NOLOGIN NOINHERIT NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
    CREATE ROLE ro_noinherit_set NOLOGIN NOINHERIT NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
    CREATE ROLE ro_inherit NOLOGIN NOINHERIT NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
    CREATE ROLE ro_nested_parent NOLOGIN NOINHERIT NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
    CREATE ROLE ro_nested NOLOGIN NOINHERIT NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
    CREATE ROLE ro_third_execute NOLOGIN NOINHERIT NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
    CREATE ROLE ro_public_execute NOLOGIN NOINHERIT NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
    CREATE ROLE ro_safe_group NOLOGIN NOINHERIT NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
    CREATE ROLE ro_safe_member NOLOGIN NOINHERIT NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
    CREATE TABLE app_fixture.write_target (id integer);
    CREATE SEQUENCE app_fixture.write_sequence;
    CREATE TABLE app_fixture.owned_relation (id integer);
    ALTER TABLE app_fixture.owned_relation OWNER TO ro_relation_owner;
    ALTER SEQUENCE app_fixture.write_sequence OWNER TO ro_relation_owner;
    CREATE FUNCTION app_fixture.owned_function() RETURNS integer LANGUAGE sql VOLATILE AS $$ SELECT 1 $$;
    ALTER FUNCTION app_fixture.owned_function() OWNER TO ro_function_owner;
    CREATE TYPE app_fixture.owned_type AS ENUM ('safe');
    ALTER TYPE app_fixture.owned_type OWNER TO ro_type_owner;
    CREATE SCHEMA owned_schema AUTHORIZATION ro_schema_owner;
    CREATE FUNCTION third.write_action() RETURNS integer LANGUAGE sql VOLATILE AS $$ INSERT INTO app_fixture.write_target VALUES (1) RETURNING 1 $$;
    CREATE FUNCTION third.public_action() RETURNS integer LANGUAGE sql VOLATILE AS $$ INSERT INTO app_fixture.write_target VALUES (2) RETURNING 2 $$;
    REVOKE ALL ON FUNCTION app_fixture.owned_function() FROM PUBLIC;
    REVOKE ALL ON FUNCTION third.write_action() FROM PUBLIC;
    REVOKE ALL ON FUNCTION third.public_action() FROM PUBLIC;
    GRANT EXECUTE ON FUNCTION third.write_action() TO ro_third_execute;
    GRANT UPDATE ON TABLE app_fixture.write_target TO ro_writer;
    GRANT USAGE, UPDATE ON SEQUENCE app_fixture.write_sequence TO ro_writer;
    GRANT TEMPORARY ON DATABASE ${database} TO ro_temp;
    GRANT ro_writer TO ro_noinherit_set WITH INHERIT FALSE, SET TRUE;
    GRANT ro_writer TO ro_inherit WITH INHERIT TRUE, SET TRUE;
    GRANT ro_writer TO ro_nested_parent WITH INHERIT FALSE, SET TRUE;
    GRANT ro_nested_parent TO ro_nested WITH INHERIT FALSE, SET TRUE;
    GRANT ro_safe_group TO ro_safe_member WITH INHERIT TRUE, SET TRUE;
    ALTER DATABASE ${database} OWNER TO ro_database_owner;
  `);
  await admin.close();
  admin = null;

  async function queryAs(roleName, sql = sourceSql) {
    const database = await PGlite.create({ dataDir: temporaryDirectory });
    try {
      await database.exec(`SET SESSION AUTHORIZATION ${quoteIdentifier(roleName)}; BEGIN READ ONLY; SET LOCAL default_transaction_read_only = on;`);
      const result = await database.query(sql);
      await database.exec('ROLLBACK');
      return result.rows[0];
    } finally {
      await database.close();
    }
  }

  async function setPublicRoutineExecute(enabled) {
    const database = await PGlite.create({ dataDir: temporaryDirectory });
    try {
      await database.exec(`${enabled ? 'GRANT' : 'REVOKE'} EXECUTE ON FUNCTION third.public_action() ${enabled ? 'TO' : 'FROM'} PUBLIC;`);
    } finally {
      await database.close();
    }
  }

  await test('PostgreSQL 17 runtime is verified', () => {
    assert.equal(Math.trunc(version / 10000), 17);
  });

  await test('complete read-only role passes in source and target QP01', async () => {
    const source = await queryAs('ro_safe', sourceSql);
    const target = await queryAs('ro_safe', targetSql);
    assert.equal(source.attestation_side, 'source');
    assert.equal(target.attestation_side, 'target');
    assert.equal(source.read_only_role_contract_passed, true, JSON.stringify(source));
    assert.equal(target.read_only_role_contract_passed, true, JSON.stringify(target));
    assert.equal(source.effective_temp_privilege_count, 0);
    assert.equal(source.executable_application_routine_count, 0);
  });

  await test('database owner is rejected', async () => expectRejected(await queryAs('ro_database_owner'), 'owned_database_count'));
  await test('application schema owner is rejected', async () => expectRejected(await queryAs('ro_schema_owner'), 'owned_application_schema_count'));
  await test('relation and sequence owner is rejected', async () => expectRejected(await queryAs('ro_relation_owner'), 'owned_relation_count'));
  await test('function owner is rejected', async () => expectRejected(await queryAs('ro_function_owner'), 'owned_function_count'));
  await test('type owner is rejected', async () => expectRejected(await queryAs('ro_type_owner'), 'owned_type_count'));
  await test('TEMP privilege is rejected', async () => expectRejected(await queryAs('ro_temp'), 'effective_temp_privilege_count'));

  await test('NOINHERIT SET ROLE membership reaches and rejects writer', async () => {
    const row = await queryAs('ro_noinherit_set');
    expectRejected(row, 'unsafe_reachable_role_count');
    assert.equal(row.settable_role_count >= 2, true);
    assert.equal(row.effective_update_privilege_count > 0, true);
  });

  await test('INHERIT writer membership is rejected', async () => {
    const row = await queryAs('ro_inherit');
    expectRejected(row, 'unsafe_reachable_role_count');
    assert.equal(row.inherited_role_count >= 2, true);
    assert.equal(row.effective_dml_privilege_count > 0, true);
  });

  await test('nested SET ROLE writer membership is rejected', async () => {
    const row = await queryAs('ro_nested');
    expectRejected(row, 'unsafe_reachable_role_count');
    assert.equal(row.settable_role_count >= 3, true);
    assert.equal(row.effective_sequence_write_count > 0, true);
  });

  await test('third application schema routine EXECUTE is rejected', async () => expectRejected(await queryAs('ro_third_execute'), 'executable_application_routine_count'));
  await test('PUBLIC routine EXECUTE is rejected', async () => {
    await setPublicRoutineExecute(true);
    try {
      expectRejected(await queryAs('ro_public_execute'), 'executable_application_routine_count');
    } finally {
      await setPublicRoutineExecute(false);
    }
  });

  await test('safe inherited and SET ROLE membership passes', async () => {
    const row = await queryAs('ro_safe_member');
    assert.equal(row.read_only_role_contract_passed, true);
    assert.equal(row.reachable_role_count, 2);
    assert.equal(row.settable_role_count, 2);
    assert.equal(row.inherited_role_count, 2);
  });

  await test('cycle-safe traversal terminates in PostgreSQL 17', async () => {
    const database = await PGlite.create({ dataDir: temporaryDirectory });
    try {
      const result = await database.query(`
        WITH RECURSIVE edges(member, roleid) AS (
          VALUES (1, 2), (2, 1)
        ), paths(role_oid, role_path) AS (
          SELECT 1, ARRAY[1]::integer[]
          UNION ALL
          SELECT edges.roleid, paths.role_path || edges.roleid
          FROM paths
          INNER JOIN edges ON edges.member = paths.role_oid
          WHERE NOT edges.roleid = ANY(paths.role_path)
        )
        SELECT count(*)::integer AS reachable_count FROM paths;
      `);
      assert.equal(result.rows[0].reachable_count, 2);
    } finally {
      await database.close();
    }
  });
} finally {
  if (admin) await admin.close().catch(() => undefined);
  await rm(temporaryDirectory, { recursive: true, force: true, maxRetries: 5 });
}

assert.equal(passed, 15);
process.stdout.write(`RESULT ${passed}/15 PASS\n`);
