import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const PACKAGE_ROOT = dirname(fileURLToPath(import.meta.url));
const SQL_FILE = /^queries\/SOCE-QP\d{2}-[A-Z0-9-]+\.sql$/;
const HASH = /^[a-f0-9]{64}$/;

function reject(code) {
  throw Object.assign(new Error(code), { code });
}

export function sha256Bytes(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

export function assertFixedSqlBytes(bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length === 0) reject('FIXED_SQL_ARTIFACT_REJECTED');
  if (bytes.subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf]))) reject('FIXED_SQL_ARTIFACT_REJECTED');
  let sqlText;
  try {
    sqlText = new TextDecoder('utf-8', { fatal: true, ignoreBOM: false }).decode(bytes);
  } catch {
    reject('FIXED_SQL_ARTIFACT_REJECTED');
  }
  if (sqlText.includes('\r') || !sqlText.endsWith('\n') || sqlText.endsWith('\n\n') || !Buffer.from(sqlText, 'utf8').equals(bytes)) {
    reject('FIXED_SQL_ARTIFACT_REJECTED');
  }
  return sqlText;
}

function resolveSqlPath(sqlFile, packageRoot) {
  if (typeof sqlFile !== 'string' || !SQL_FILE.test(sqlFile)) reject('FIXED_SQL_ARTIFACT_REJECTED');
  const absolute = resolve(packageRoot, sqlFile);
  const relativePath = relative(packageRoot, absolute).replaceAll('\\', '/');
  if (relativePath !== sqlFile || relativePath.startsWith('../')) reject('FIXED_SQL_ARTIFACT_REJECTED');
  return absolute;
}

export function readSqlArtifact(sqlFile, { packageRoot = PACKAGE_ROOT } = {}) {
  let bytes;
  try {
    bytes = readFileSync(resolveSqlPath(sqlFile, packageRoot));
  } catch {
    reject('FIXED_SQL_ARTIFACT_REJECTED');
  }
  return Object.freeze({ sqlText: assertFixedSqlBytes(bytes), sqlBytes: bytes, sqlSha256: sha256Bytes(bytes) });
}

export function verifySqlArtifact(query, options = {}) {
  if (!query || typeof query.queryVersion !== 'string' || typeof query.sqlFile !== 'string' || !HASH.test(query.sqlSha256 ?? '')) {
    reject('FIXED_QUERY_REGISTRY_REJECTED');
  }
  const artifact = readSqlArtifact(query.sqlFile, options);
  if (artifact.sqlSha256 !== query.sqlSha256) reject('FIXED_SQL_HASH_MISMATCH');
  return artifact;
}

export function verifyAllSqlArtifacts(registry, options = {}) {
  if (!Array.isArray(registry) || registry.length !== 16) reject('FIXED_QUERY_REGISTRY_REJECTED');
  return Object.freeze(registry.map((query) => Object.freeze({ queryId: query.queryId, ...verifySqlArtifact(query, options) })));
}
