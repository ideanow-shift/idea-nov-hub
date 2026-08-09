import { hashCanonical, stableRecordSet } from './canonicalization.mjs';
import { FIXED_QUERY_REGISTRY, PUBLIC_QUERY_CATALOG_HASH, QUERY_PACK_IDS, getFixedQuery } from './query-pack-registry.mjs';

const HASH = /^[a-f0-9]{64}$/;

function without(object, field) {
  const { [field]: _discarded, ...rest } = object;
  return rest;
}

function sameArray(left, right) {
  return Array.isArray(left) && left.length === right.length && left.every((value, index) => value === right[index]);
}

export function hashPrivateQueryPackManifest(manifest) {
  return hashCanonical(without(manifest, 'contentHash'));
}

export function hashSchemaContract(contract) {
  return hashCanonical(without(contract, 'schemaContractHash'));
}

export function hashStage0Evidence(records) {
  if (!Array.isArray(records)) throw new Error('SCHEMA_CONTRACT_MISMATCH');
  const normalized = records.map(({ queryId, rows }) => {
    const query = getFixedQuery(queryId);
    if (!query || query.stage !== 'stage0') throw new Error('SCHEMA_CONTRACT_MISMATCH');
    return { queryId, rows: stableRecordSet(rows, query.canonicalKeyFields) };
  }).sort((left, right) => left.queryId.localeCompare(right.queryId));
  return hashCanonical(normalized);
}

export function assertApprovedSchemaContract(contract) {
  const valid = contract
    && contract.contractId === 'SOCE-SCHEMA-COLUMN-CONTRACT-v1'
    && contract.executionState === 'approved'
    && contract.sourceProjectLabel === 'idea-nov-core'
    && contract.targetProjectLabel === 'idea-nov-staging'
    && typeof contract.approvalReference === 'string'
    && /^approval:[A-Za-z0-9._:/-]{1,160}$/.test(contract.approvalReference)
    && sameArray(contract.packIds, QUERY_PACK_IDS)
    && contract.publicQueryCatalogHash === PUBLIC_QUERY_CATALOG_HASH
    && HASH.test(contract.expectedStage0Digest ?? '')
    && HASH.test(contract.privateQueryPackManifestHash ?? '')
    && HASH.test(contract.schemaContractHash ?? '')
    && contract.schemaContractHash === hashSchemaContract(contract);
  if (!valid) throw Object.assign(new Error('SCHEMA_CONTRACT_MISMATCH'), { code: 'SCHEMA_CONTRACT_MISMATCH' });
  return true;
}

export function assertPrivateQueryPackManifest(manifest, contract) {
  const valid = manifest
    && manifest.manifestId === 'SOCE-PRIVATE-QUERY-PACK-MANIFEST-v1'
    && manifest.executionState === 'sealed'
    && manifest.publicQueryCatalogHash === PUBLIC_QUERY_CATALOG_HASH
    && sameArray(manifest.packIds, QUERY_PACK_IDS)
    && Array.isArray(manifest.packs)
    && manifest.packs.length === QUERY_PACK_IDS.length
    && Object.keys(manifest).every((key) => ['manifestId', 'executionState', 'publicQueryCatalogHash', 'packIds', 'packs', 'contentHash'].includes(key))
    && HASH.test(manifest.contentHash ?? '')
    && manifest.contentHash === hashPrivateQueryPackManifest(manifest)
    && contract.privateQueryPackManifestHash === manifest.contentHash
    && manifest.packs.every((entry, index) => {
      const expected = FIXED_QUERY_REGISTRY.filter((query) => query.packId === QUERY_PACK_IDS[index]).map((query) => query.queryId);
      return entry && entry.packId === QUERY_PACK_IDS[index]
        && sameArray(entry.queryIds, expected)
        && HASH.test(entry.sealedQueryPackHash ?? '')
        && Object.keys(entry).every((key) => ['packId', 'queryIds', 'sealedQueryPackHash'].includes(key))
        && !Object.hasOwn(entry, 'sql')
        && !Object.hasOwn(entry, 'connection');
    });
  if (!valid) throw Object.assign(new Error('PRIVATE_QUERY_PACK_REJECTED'), { code: 'PRIVATE_QUERY_PACK_REJECTED' });
  return true;
}

export function assertStage0Matches(contract, records) {
  if (hashStage0Evidence(records) !== contract.expectedStage0Digest) {
    throw Object.assign(new Error('SCHEMA_CONTRACT_MISMATCH'), { code: 'SCHEMA_CONTRACT_MISMATCH' });
  }
  return true;
}
