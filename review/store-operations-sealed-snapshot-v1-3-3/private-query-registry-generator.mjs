import { hashCanonical } from './canonicalization.mjs';
import { FIXED_QUERY_REGISTRY, PUBLIC_QUERY_CATALOG_HASH, QUERY_PACK_IDS } from './query-pack-registry.mjs';
import { SECURITY_ALLOWLIST, SECURITY_ALLOWLIST_HASH } from './execution-path-security.mjs';
import { assertPrivateQueryPackManifest, hashPrivateQueryPackManifest } from './schema-contract.mjs';

function queryBinding(query) {
  return {
    queryId: query.queryId,
    queryVersion: query.queryVersion,
    packId: query.packId,
    sqlFile: query.sqlFile,
    sqlSha256: query.sqlSha256,
    astSha256: SECURITY_ALLOWLIST.queries.find((entry) => entry.queryId === query.queryId)?.astSha256,
    expectedColumns: [...query.expectedColumns],
    expectedTypes: structuredClone(query.expectedTypes),
    expectedOutputSchemaVersion: query.expectedOutputSchemaVersion,
  };
}

export function generatePrivateQueryPackManifest() {
  const queries = FIXED_QUERY_REGISTRY.map(queryBinding);
  const base = {
    manifestId: 'SOCE-PRIVATE-QUERY-REGISTRY-v1',
    executionState: 'sealed',
    publicQueryCatalogHash: PUBLIC_QUERY_CATALOG_HASH,
    securityAllowlistHash: SECURITY_ALLOWLIST_HASH,
    packIds: [...QUERY_PACK_IDS],
    packs: QUERY_PACK_IDS.map((packId) => ({
      packId,
      queryIds: FIXED_QUERY_REGISTRY.filter((query) => query.packId === packId).map((query) => query.queryId),
      queryHashManifestHash: hashCanonical(queries.filter((query) => query.packId === packId)),
    })),
    queries,
  };
  return Object.freeze({ ...base, contentHash: hashPrivateQueryPackManifest(base) });
}

export function assertGeneratedPrivateQueryPackManifest(manifest, contract) {
  return assertPrivateQueryPackManifest(manifest, contract);
}
