import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  SECURITY_ALLOWLIST,
  SECURITY_ALLOWLIST_HASH,
  SECURITY_CATALOG_BINDINGS_HASH,
  assertCatalogBindings,
  assertQuerySecurity,
  assertRoleExecutionContainment,
  assertRuntimeEvidence,
} from './execution-path-security.mjs';
import { FakeSealedSnapshotConnection } from './fake-broker.mjs';
import { getFixedQuery } from './query-pack-registry.mjs';
import { parseSecurityAst } from './sql-security-ast.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const baseQuery = getFixedQuery('SOCE-QP01-SOURCE-IDENTITY');
const baseSql = readFileSync(join(here, baseQuery.sqlFile), 'utf8');
let passed = 0;

async function test(name, fn) {
  await fn();
  passed += 1;
  process.stdout.write(`PASS ${name}\n`);
}

function rejected(sql, pattern = /REJECTED/) {
  assert.throws(() => assertQuerySecurity(baseQuery, sql), pattern);
}

const adversarial = [
  ['modifying CTE', "WITH changed AS (UPDATE public.stores SET is_active=false RETURNING *) SELECT * FROM changed;\n"],
  ['SELECT INTO', 'SELECT 1 INTO temporary_snapshot;\n'],
  ['FOR UPDATE', 'SELECT * FROM public.stores FOR UPDATE;\n'],
  ['FOR NO KEY UPDATE', 'SELECT * FROM public.stores FOR NO KEY UPDATE;\n'],
  ['FOR SHARE', 'SELECT * FROM public.stores FOR SHARE;\n'],
  ['FOR KEY SHARE', 'SELECT * FROM public.stores FOR KEY SHARE;\n'],
  ['nextval', "SELECT nextval('public.sequence_fixture');\n"],
  ['setval', "SELECT setval('public.sequence_fixture', 2);\n"],
  ['advisory lock', 'SELECT pg_advisory_lock(1);\n'],
  ['session configuration', "SELECT set_config('search_path','public',false);\n"],
  ['TEMP object', 'CREATE TEMP TABLE snapshot_escape(id integer);\n'],
  ['SECURITY DEFINER routine', 'SELECT private.security_definer_fixture();\n'],
  ['extension routine', "SELECT extensions.http_get('https://invalid.example');\n"],
  ['application routine', 'SELECT public.application_fixture();\n'],
  ['multi statement', 'SELECT 1; SELECT 2;\n'],
  ['PREPARE', 'PREPARE p AS SELECT 1;\n'],
  ['EXECUTE', 'EXECUTE p;\n'],
  ['CALL', 'CALL public.application_fixture();\n'],
  ['DO', 'DO $$ BEGIN NULL; END $$;\n'],
  ['COPY', 'COPY public.stores TO STDOUT;\n'],
  ['SET ROLE', 'SET ROLE postgres;\n'],
  ['SET SESSION AUTHORIZATION', 'SET SESSION AUTHORIZATION postgres;\n'],
  ['allowlist-external relation', 'SELECT * FROM public.unsealed_relation;\n'],
  ['allowlist-external column', 'SELECT s.secret_payload FROM public.stores s;\n'],
  ['allowlist-external operator', 'SELECT 1 % 1;\n'],
];

for (const [name, sql] of adversarial) await test(`${name} is rejected`, () => rejected(sql));

await test('the approved query has one immutable SELECT AST and exact hash', () => {
  const ast = parseSecurityAst(baseSql);
  assert.equal(ast.statementCount, 1);
  assert.equal(ast.statementType, 'select');
  assert.equal(ast.forbiddenNodes.length, 0);
  assert.equal(assertQuerySecurity(baseQuery, baseSql).astSha256, SECURITY_ALLOWLIST.queries.find(({ queryId }) => queryId === baseQuery.queryId).astSha256);
});

await test('query hash and Query ID substitution are rejected', () => {
  assert.throws(() => assertQuerySecurity({ ...baseQuery, sqlSha256: '0'.repeat(64) }, baseSql), /QUERY_ALLOWLIST_REJECTED/);
  assert.throws(() => assertQuerySecurity({ ...baseQuery, queryId: 'SOCE-QP99-UNSEALED' }, baseSql), /QUERY_ALLOWLIST_REJECTED/);
});

await test('function and operator allowlists pin signatures rather than namespaces', () => {
  const signatures = Object.values(SECURITY_ALLOWLIST.functionSignatures).flat();
  assert.ok(signatures.length > 0);
  assert.ok(signatures.every((signature) => /^pg_catalog\.[a-z_][a-z0-9_]*\([^)]*\)$/.test(signature)));
  assert.equal(signatures.includes('pg_catalog.*'), false);
  assert.equal(SECURITY_ALLOWLIST.operatorSignatures.includes('pg_catalog.*'), false);
  for (const forbidden of ['nextval', 'setval', 'pg_advisory_lock', 'set_config']) assert.equal(Object.hasOwn(SECURITY_ALLOWLIST.functionSignatures, forbidden), false);
});

await test('PUBLIC TEMP and routine EXECUTE are tolerated only with sealed-path containment', () => {
  const connection = new FakeSealedSnapshotConnection();
  assert.equal(connection.roleAttestation.canTemporaryCreate, true);
  assert.equal(connection.roleAttestation.canFunctionExecute, true);
  assert.equal(assertRoleExecutionContainment(connection.roleAttestation), true);
  assert.throws(() => assertRoleExecutionContainment({ ...connection.roleAttestation, genericSqlUnavailable: false }), /READ_ONLY_ROLE_REJECTED/);
  assert.throws(() => assertRoleExecutionContainment({ ...connection.roleAttestation, executionPathRoutineBlocked: false }), /READ_ONLY_ROLE_REJECTED/);
});

await test('catalog bindings reject SECURITY DEFINER, extension, application, or unresolved routines', () => {
  const base = {
    allowlistHash: SECURITY_ALLOWLIST_HASH,
    catalogBindingsHash: SECURITY_CATALOG_BINDINGS_HASH,
    allResolved: true,
    pgCatalogOnly: true,
    securityDefinerRoutineCount: 0,
    applicationRoutineCount: 0,
    extensionRoutineCount: 0,
  };
  assert.equal(assertCatalogBindings(base), true);
  for (const key of ['securityDefinerRoutineCount', 'applicationRoutineCount', 'extensionRoutineCount']) {
    assert.throws(() => assertCatalogBindings({ ...base, [key]: 1 }), /CATALOG_ALLOWLIST_REJECTED/);
  }
  assert.throws(() => assertCatalogBindings({ ...base, allResolved: false }), /CATALOG_ALLOWLIST_REJECTED/);
});

await test('runtime identity and read-only state are fail-closed', async () => {
  const expectedRole = 'snapshot_fixture_ro';
  const connection = new FakeSealedSnapshotConnection({ expectedRole });
  const expected = SECURITY_ALLOWLIST.queries.find(({ queryId }) => queryId === baseQuery.queryId);
  const request = { expectedRole, queryId: baseQuery.queryId, querySha256: baseQuery.sqlSha256, astSha256: expected.astSha256, queryOrdinal: 1, expectedQueryCount: 16 };
  const evidence = await connection.attestRuntimeEvidence(request);
  assert.equal(assertRuntimeEvidence(evidence, { expectedRole, query: baseQuery, queryOrdinal: 1, expectedQueryCount: 16 }), true);
  for (const mutation of [
    { currentUser: 'other_role' },
    { sessionUser: 'other_role' },
    { transactionReadOnly: 'off' },
    { defaultTransactionReadOnly: 'off' },
    { transactionIsolation: 'read committed' },
    { searchPath: 'public' },
    { xidAssigned: true },
    { tempSchemaOid: 1234 },
    { insertedTuples: 1 },
    { advisoryLockCount: 1 },
    { preparedStatementCount: 1 },
  ]) assert.throws(() => assertRuntimeEvidence({ ...evidence, ...mutation }, { expectedRole, query: baseQuery, queryOrdinal: 1, expectedQueryCount: 16 }), /RUNTIME_EVIDENCE_REJECTED/);
});

await test('the broker connection exposes no generic or interactive SQL method', () => {
  const connection = new FakeSealedSnapshotConnection();
  for (const method of ['query', 'execute', 'executeSql', 'raw', 'prepare', 'interactive', 'setRole', 'setSessionAuthorization']) assert.equal(typeof connection[method], 'undefined');
  assert.equal(typeof connection.executeFixedQuery, 'function');
});

assert.equal(passed, adversarial.length + 7);
process.stdout.write(`RESULT ${passed}/${passed} PASS\n`);
