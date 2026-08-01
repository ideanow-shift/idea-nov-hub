import assert from 'node:assert/strict';
import { AUDIT_PACK_ID, FIXED_QUERY_REGISTRY, QUERY_IDS } from './query-registry.mjs';
import { verifyIdentity } from './identity-verifier.mjs';
import { validateFixedSql } from './sql-validator.mjs';
import { maskUuid, sanitizeRows } from './result-sanitizer.mjs';
import { validateAuditResult } from './schema-validator.mjs';
import { runSealedAudit } from './sealed-runner.mjs';
import { FakeAuditConnection } from './fake-db.mjs';

const profile = { environment: 'production', profileFingerprint: 'a'.repeat(64) };
const observation = { environment: 'production', profileFingerprint: 'a'.repeat(64), projectMatch: true, hostMatch: true, tlsMatch: true, nonProductionMatch: false };
const request = (queryIds) => ({ auditPackId: AUDIT_PACK_ID, environment: 'production', queryIds });
let passed = 0;
const test = async (name, fn) => { await fn(); passed += 1; process.stdout.write(`PASS ${name}\n`); };

await test('identity mismatch executes zero queries', async () => {
  const db = new FakeAuditConnection(); const result = await runSealedAudit({ request: request(['Q01_SCHEMA_CATALOG']), profile, identityObservation: { ...observation, hostMatch: false }, connection: db });
  assert.equal(result.queryCount, 0); assert.deepEqual(db.events, []);
});
await test('non-audit role is rejected before open', async () => {
  const db = new FakeAuditConnection({ roleClass: 'application_role' }); const result = await runSealedAudit({ request: request(['Q01_SCHEMA_CATALOG']), profile, identityObservation: observation, connection: db });
  assert.equal(result.failureCategory, 'AUDIT_ROLE_UNAVAILABLE'); assert.deepEqual(db.events, []);
});
await test('service role and writable identity are rejected', async () => {
  for (const db of [new FakeAuditConnection({ serviceRole: true }), new FakeAuditConnection({ canWrite: true })]) {
    const result = await runSealedAudit({ request: request(['Q01_SCHEMA_CATALOG']), profile, identityObservation: observation, connection: db }); assert.equal(result.queryCount, 0);
  }
});
await test('arbitrary query id is rejected', async () => {
  const db = new FakeAuditConnection(); const result = await runSealedAudit({ request: request(['Q99_ARBITRARY']), profile, identityObservation: observation, connection: db }); assert.equal(result.failureCategory, 'AUDIT_REQUEST_INVALID'); assert.deepEqual(db.events, []);
});
await test('query count exceeding twelve is rejected', async () => {
  const db = new FakeAuditConnection(); const result = await runSealedAudit({ request: request(Array(13).fill('Q01_SCHEMA_CATALOG').map((id, i) => `${id}_${i}`)), profile, identityObservation: observation, connection: db }); assert.equal(result.queryCount, 0);
});
await test('readonly guard failure rolls back', async () => {
  const db = new FakeAuditConnection({ readOnly: false }); const result = await runSealedAudit({ request: request(['Q01_SCHEMA_CATALOG']), profile, identityObservation: observation, connection: db }); assert.equal(result.failureCategory, 'READ_ONLY_SESSION_UNVERIFIED'); assert.deepEqual(db.events, ['open', 'begin_read_only', 'verify_read_only', 'rollback', 'close']);
});
await test('fixed query succeeds and always rolls back', async () => {
  const db = new FakeAuditConnection({ rowsByQuery: { Q01_SCHEMA_CATALOG: [{ schema_name: 'public' }] } }); const result = await runSealedAudit({ request: request(['Q01_SCHEMA_CATALOG']), profile, identityObservation: observation, connection: db }); assert.equal(result.runStatus, 'complete'); assert.equal(result.queryCount, 1); assert.equal(db.events.at(-2), 'rollback'); assert.equal(validateAuditResult(result), true);
});
await test('partial failure rolls back without raw error', async () => {
  const db = new FakeAuditConnection({ rowsByQuery: { Q01_SCHEMA_CATALOG: [{ schema_name: 'public' }] }, failQuery: 'Q02_STORE_TABLE_CANDIDATES' }); const result = await runSealedAudit({ request: request(['Q01_SCHEMA_CATALOG', 'Q02_STORE_TABLE_CANDIDATES']), profile, identityObservation: observation, connection: db }); assert.equal(result.failureCategory, 'AUDIT_QUERY_FAILED'); assert.equal(db.events.at(-2), 'rollback'); assert.equal(JSON.stringify(result).includes('FAKE_QUERY_FAILURE'), false);
});
await test('sanitizer rejects secret-like or uuid fields', async () => {
  assert.throws(() => sanitizeRows([{ password: 'x' }], ['password'])); assert.equal(maskUuid('12345678-1234-1234-1234-123456789abc'), '12345678…');
});
await test('sql validator rejects write and arbitrary constructs', async () => {
  for (const sql of ['INSERT INTO x VALUES (1)', 'SELECT * FROM x', 'SELECT 1; DELETE FROM x', 'SELECT pg_advisory_lock(1)']) assert.equal(validateFixedSql(sql), false);
  assert.equal(validateFixedSql('SELECT schema_name FROM information_schema.schemata'), true);
});
await test('identity verifier requires all opaque match signals', async () => {
  assert.equal(verifyIdentity(profile, observation), true); assert.equal(verifyIdentity(profile, { ...observation, nonProductionMatch: true }), false);
});
await test('registry contains exactly twelve validated immutable query ids', async () => {
  assert.equal(QUERY_IDS.length, 12); assert.equal(new Set(QUERY_IDS).size, 12); assert.equal(FIXED_QUERY_REGISTRY.every((query) => validateFixedSql(query.sql)), true);
});
await test('result schema rejects unknown output fields', async () => {
  assert.equal(validateAuditResult({ runStatus: 'safe_stop', queryCount: 0, queryResults: [], mutationExecuted: false, secretExposureDetected: false, extra: 'raw' }), false);
});
process.stdout.write(`RESULT ${passed}/13 PASS\n`);
