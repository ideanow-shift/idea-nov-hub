import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { hashCanonical } from './canonicalization.mjs';
import { PACKAGE_ID, PACKAGE_LOCK_FILE, PACKAGE_VERSION } from './package-metadata.mjs';
import { FIXED_QUERY_REGISTRY } from './query-pack-registry.mjs';

const PACKAGE_ROOT = dirname(fileURLToPath(import.meta.url));
const HASH = /^[a-f0-9]{64}$/;

export const EXECUTION_ARTIFACT_PATHS = Object.freeze([
  '.gitattributes',
  'package-metadata.mjs',
  'canonicalization.mjs',
  'query-pack-registry.mjs',
  'sql-artifacts.mjs',
  'sql-security-ast.mjs',
  'security-allowlist-v1.json',
  'execution-path-security.mjs',
  'schema-contract.mjs',
  'sanitizer.mjs',
  'cleanup-receipt.mjs',
  'manifest.mjs',
  'broker-interface.mjs',
  'run-contract.mjs',
  'operator-resolver.mjs',
  'execution-package-lock.mjs',
  'sealed-snapshot-runner.mjs',
  ...FIXED_QUERY_REGISTRY.map((query) => query.sqlFile),
]);

function reject(code) {
  throw Object.assign(new Error(code), { code });
}

function sha256File(filePath) {
  try {
    return createHash('sha256').update(readFileSync(filePath)).digest('hex');
  } catch {
    reject('PACKAGE_INTEGRITY_REJECTED');
  }
}

function resolveArtifact(packageRoot, artifactPath) {
  if (typeof artifactPath !== 'string' || artifactPath.length === 0 || artifactPath.includes('..')) reject('PACKAGE_INTEGRITY_REJECTED');
  const absolute = resolve(packageRoot, artifactPath);
  if (relative(packageRoot, absolute).replaceAll('\\', '/') !== artifactPath) reject('PACKAGE_INTEGRITY_REJECTED');
  return absolute;
}

function queryPackPayload() {
  return FIXED_QUERY_REGISTRY.map((query) => ({
    queryId: query.queryId,
    queryVersion: query.queryVersion,
    packId: query.packId,
    sqlFile: query.sqlFile,
    sqlSha256: query.sqlSha256,
    expectedColumns: query.expectedColumns,
    expectedTypes: query.expectedTypes,
    expectedOutputSchemaVersion: query.expectedOutputSchemaVersion,
  }));
}

function artifactHash(artifacts, artifactPath) {
  return artifacts.find((artifact) => artifact.path === artifactPath)?.sha256;
}

function lockPayload(lock) {
  const { packageSha256: _self, ...payload } = lock;
  return payload;
}

export function deriveExecutionPackageLock({ packageRoot = PACKAGE_ROOT } = {}) {
  const artifacts = EXECUTION_ARTIFACT_PATHS.map((artifactPath) => Object.freeze({
    path: artifactPath,
    sha256: sha256File(resolveArtifact(packageRoot, artifactPath)),
  }));
  const lock = {
    lockVersion: 'SOCE-EXECUTION-PACKAGE-LOCK-v1',
    packageId: PACKAGE_ID,
    packageVersion: PACKAGE_VERSION,
    artifacts,
    queryPackSha256: hashCanonical(queryPackPayload()),
    securityAllowlistSha256: artifactHash(artifacts, 'security-allowlist-v1.json'),
    executionPathSecuritySha256: artifactHash(artifacts, 'execution-path-security.mjs'),
    schemaContractSha256: artifactHash(artifacts, 'schema-contract.mjs'),
    sanitizerContractSha256: artifactHash(artifacts, 'sanitizer.mjs'),
    manifestContractSha256: artifactHash(artifacts, 'manifest.mjs'),
  };
  return Object.freeze({ ...lock, packageSha256: hashCanonical(lock) });
}

export function verifyExecutionPackage({ packageRoot = PACKAGE_ROOT } = {}) {
  let supplied;
  try {
    supplied = JSON.parse(readFileSync(resolveArtifact(packageRoot, PACKAGE_LOCK_FILE), 'utf8'));
  } catch {
    reject('PACKAGE_INTEGRITY_REJECTED');
  }
  const exactKeys = ['lockVersion', 'packageId', 'packageVersion', 'artifacts', 'queryPackSha256', 'securityAllowlistSha256', 'executionPathSecuritySha256', 'schemaContractSha256', 'sanitizerContractSha256', 'manifestContractSha256', 'packageSha256'];
  if (!supplied || typeof supplied !== 'object' || Array.isArray(supplied)
    || Object.keys(supplied).length !== exactKeys.length || exactKeys.some((key) => !Object.hasOwn(supplied, key))
    || supplied.lockVersion !== 'SOCE-EXECUTION-PACKAGE-LOCK-v1'
    || supplied.packageId !== PACKAGE_ID || supplied.packageVersion !== PACKAGE_VERSION
    || !HASH.test(supplied.packageSha256 ?? '')
    || ['queryPackSha256', 'securityAllowlistSha256', 'executionPathSecuritySha256', 'schemaContractSha256', 'sanitizerContractSha256', 'manifestContractSha256'].some((key) => !HASH.test(supplied[key] ?? ''))) {
    reject('PACKAGE_INTEGRITY_REJECTED');
  }
  const derived = deriveExecutionPackageLock({ packageRoot });
  if (hashCanonical(lockPayload(supplied)) !== supplied.packageSha256 || hashCanonical(supplied) !== hashCanonical(derived)) {
    reject('PACKAGE_INTEGRITY_REJECTED');
  }
  return derived;
}
