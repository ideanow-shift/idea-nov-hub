import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { hashCanonical } from './canonicalization.mjs';
import { SECURITY_CONTRACT_VERSION } from './package-metadata.mjs';
import { parseSecurityAst } from './sql-security-ast.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const HASH = /^[a-f0-9]{64}$/;
const ROLE = /^[a-z][a-z0-9_]{2,62}$/;
const EXACT_RUNTIME_KEYS = Object.freeze([
  'sessionUser', 'currentUser', 'expectedRole', 'defaultTransactionReadOnly',
  'transactionReadOnly', 'transactionIsolation', 'searchPath', 'transactionStatus',
  'xidAssigned', 'tempSchemaOid', 'insertedTuples', 'updatedTuples', 'deletedTuples',
  'advisoryLockCount', 'preparedStatementCount', 'listenChannelCount',
  'queryOrdinal', 'expectedQueryCount', 'queryId', 'querySha256', 'astSha256',
]);

function reject(code = 'EXECUTION_PATH_SECURITY_REJECTED') {
  throw Object.assign(new Error(code), { code });
}

function exactKeys(value, keys) {
  return value && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));
}

function sameArray(left, right) {
  return Array.isArray(left) && Array.isArray(right) && left.length === right.length
    && left.every((value, index) => hashCanonical(value) === hashCanonical(right[index]));
}

function readAllowlist() {
  let value;
  try { value = JSON.parse(readFileSync(join(root, 'security-allowlist-v1.json'), 'utf8')); } catch { reject(); }
  const { contentSha256, ...core } = value ?? {};
  if (!HASH.test(contentSha256 ?? '') || contentSha256 !== hashCanonical(core)
    || value.contractVersion !== SECURITY_CONTRACT_VERSION
    || value.parserContract !== 'SOCE-POSTGRES-SELECT-SECURITY-AST-v1'
    || value.globalPublicHardeningRequired !== false || value.retryCount !== 0
    || !Array.isArray(value.queries) || value.queries.length !== 16
    || !Array.isArray(value.operatorSignatures) || value.operatorSignatures.length === 0
    || !value.functionSignatures || typeof value.functionSignatures !== 'object') reject();
  return Object.freeze(value);
}

export const SECURITY_ALLOWLIST = readAllowlist();
export const SECURITY_ALLOWLIST_HASH = SECURITY_ALLOWLIST.contentSha256;
export const SECURITY_CATALOG_BINDINGS_HASH = hashCanonical({
  functionSignatures: SECURITY_ALLOWLIST.functionSignatures,
  operatorSignatures: SECURITY_ALLOWLIST.operatorSignatures,
});

export function assertQuerySecurity(query, sqlText) {
  const expected = SECURITY_ALLOWLIST.queries.find((entry) => entry.queryId === query?.queryId);
  if (!expected || expected.sqlSha256 !== query.sqlSha256) reject('QUERY_ALLOWLIST_REJECTED');
  const ast = parseSecurityAst(sqlText);
  for (const key of ['statementType', 'statementCount', 'astSha256']) {
    if (ast[key] !== expected[key]) reject('QUERY_ALLOWLIST_REJECTED');
  }
  for (const key of ['cteNames', 'relations', 'columnReferences', 'functions', 'operators']) {
    if (!sameArray(ast[key], expected[key])) reject('QUERY_ALLOWLIST_REJECTED');
  }
  if (hashCanonical(ast.identifiers) !== expected.identifiersSha256 || ast.forbiddenNodes.length !== 0) reject('QUERY_ALLOWLIST_REJECTED');
  return Object.freeze({ queryId: query.queryId, sqlSha256: query.sqlSha256, astSha256: ast.astSha256 });
}

export function assertCatalogBindings(attestation) {
  const keys = ['allowlistHash', 'catalogBindingsHash', 'allResolved', 'pgCatalogOnly', 'securityDefinerRoutineCount', 'applicationRoutineCount', 'extensionRoutineCount'];
  if (!exactKeys(attestation, keys)
    || attestation.allowlistHash !== SECURITY_ALLOWLIST_HASH
    || attestation.catalogBindingsHash !== SECURITY_CATALOG_BINDINGS_HASH
    || attestation.allResolved !== true || attestation.pgCatalogOnly !== true
    || attestation.securityDefinerRoutineCount !== 0 || attestation.applicationRoutineCount !== 0 || attestation.extensionRoutineCount !== 0) reject('CATALOG_ALLOWLIST_REJECTED');
  return true;
}

export function assertRoleExecutionContainment(attestation) {
  const requiredTrue = [
    'currentUserVerified', 'transactionReadOnly', 'defaultTransactionReadOnly',
    'roleClosureChecked', 'ownershipChecked', 'tempChecked', 'routineExecuteChecked',
    'executionPathTempBlocked', 'executionPathRoutineBlocked', 'genericSqlUnavailable',
    'interactiveSqlUnavailable', 'dynamicSqlUnavailable', 'queryIdOnly',
  ];
  const requiredFalse = [
    'canInsert', 'canUpdate', 'canDelete', 'canTruncate', 'canReferences', 'canTrigger',
    'canSequenceUsage', 'canSequenceUpdate', 'canDatabaseCreate', 'canApplicationSchemaCreate',
    'canAlterDrop', 'ownsDatabase', 'ownsApplicationSchema', 'ownsRelation', 'ownsFunction',
    'ownsType', 'ownsExtension', 'canSetRole', 'hasMembershipAdminOption',
    'hasUnsafeRoleClosure', 'bypassRls', 'serviceRole',
  ];
  if (!attestation || requiredTrue.some((key) => attestation[key] !== true)
    || requiredFalse.some((key) => attestation[key] !== false)
    || typeof attestation.canTemporaryCreate !== 'boolean'
    || typeof attestation.canFunctionExecute !== 'boolean') reject('READ_ONLY_ROLE_REJECTED');
  return true;
}

export function assertRuntimeEvidence(attestation, { expectedRole, query, queryOrdinal, expectedQueryCount }) {
  if (!ROLE.test(expectedRole ?? '') || !exactKeys(attestation, EXACT_RUNTIME_KEYS)) reject('RUNTIME_EVIDENCE_REJECTED');
  const expected = SECURITY_ALLOWLIST.queries.find((entry) => entry.queryId === query.queryId);
  if (!expected
    || attestation.sessionUser !== expectedRole || attestation.currentUser !== expectedRole || attestation.expectedRole !== expectedRole
    || attestation.defaultTransactionReadOnly !== 'on' || attestation.transactionReadOnly !== 'on'
    || attestation.transactionIsolation !== 'repeatable read' || attestation.searchPath !== 'pg_catalog'
    || attestation.transactionStatus !== 'in_transaction' || attestation.xidAssigned !== false
    || attestation.tempSchemaOid !== 0 || attestation.insertedTuples !== 0 || attestation.updatedTuples !== 0 || attestation.deletedTuples !== 0
    || attestation.advisoryLockCount !== 0 || attestation.preparedStatementCount !== 0 || attestation.listenChannelCount !== 0
    || attestation.queryOrdinal !== queryOrdinal || attestation.expectedQueryCount !== expectedQueryCount
    || attestation.queryId !== query.queryId || attestation.querySha256 !== query.sqlSha256 || attestation.astSha256 !== expected.astSha256) {
    reject('RUNTIME_EVIDENCE_REJECTED');
  }
  return true;
}

export function assertFinalRuntimeEvidence(attestation, expectedRole, expectedQueryIds) {
  if (!attestation || attestation.expectedRole !== expectedRole || attestation.sessionUser !== expectedRole || attestation.currentUser !== expectedRole
    || attestation.transactionReadOnly !== 'on' || attestation.transactionIsolation !== 'repeatable read' || attestation.searchPath !== 'pg_catalog'
    || attestation.transactionStatus !== 'in_transaction' || attestation.xidAssigned !== false || attestation.tempSchemaOid !== 0
    || attestation.insertedTuples !== 0 || attestation.updatedTuples !== 0 || attestation.deletedTuples !== 0
    || attestation.advisoryLockCount !== 0 || attestation.preparedStatementCount !== 0 || attestation.listenChannelCount !== 0
    || !Array.isArray(expectedQueryIds) || attestation.executedQueryCount !== expectedQueryIds.length || attestation.queryOrderHash !== hashCanonical(expectedQueryIds)) {
    reject('RUNTIME_EVIDENCE_REJECTED');
  }
  return true;
}
