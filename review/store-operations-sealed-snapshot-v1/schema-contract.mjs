import { hashCanonical, stableRecordSet } from './canonicalization.mjs';
import { FIXED_QUERY_REGISTRY, PUBLIC_QUERY_CATALOG_HASH, QUERY_PACK_IDS, getFixedQuery } from './query-pack-registry.mjs';

const HASH = /^[a-f0-9]{64}$/;
const QUERY_BINDING_FIELDS = Object.freeze([
  'queryId',
  'queryVersion',
  'packId',
  'sqlFile',
  'sqlSha256',
  'expectedColumns',
  'expectedTypes',
  'expectedOutputSchemaVersion',
]);

function without(object, field) {
  const { [field]: _discarded, ...rest } = object;
  return rest;
}

function sameArray(left, right) {
  return Array.isArray(left) && left.length === right.length && left.every((value, index) => value === right[index]);
}

function exactKeys(object, keys) {
  return object && typeof object === 'object' && !Array.isArray(object)
    && Object.keys(object).length === keys.length && Object.keys(object).every((key) => keys.includes(key));
}

function sameValue(left, right) {
  return hashCanonical(left) === hashCanonical(right);
}

function bindingCore(binding) {
  return Object.fromEntries(QUERY_BINDING_FIELDS.map((key) => [key, binding[key]]));
}

function publicBindingShape(query) {
  return {
    queryId: query.queryId,
    queryVersion: query.queryVersion,
    packId: query.packId,
    sqlFile: query.sqlFile,
    sqlSha256: query.sqlSha256,
    expectedColumns: query.expectedColumns,
    expectedTypes: query.expectedTypes,
    expectedOutputSchemaVersion: query.expectedOutputSchemaVersion,
  };
}

function expectedPackHash(manifest, packId) {
  return hashCanonical(manifest.queries.filter((entry) => entry.packId === packId).map(bindingCore));
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

export function privateQueryAttestations(manifest) {
  return manifest.queries.map(({ queryId, queryVersion, packId, sqlFile, sqlSha256, expectedOutputSchemaVersion }) => ({
    queryId,
    queryVersion,
    packId,
    sqlFile,
    sqlSha256,
    expectedOutputSchemaVersion,
  }));
}

export function assertApprovedSchemaContract(contract) {
  const valid = contract
    && contract.contractId === 'SOCE-SCHEMA-COLUMN-CONTRACT-v1'
    && contract.executionState === 'approved'
    && contract.sourceProjectLabel === 'idea-nov-core'
    && contract.targetProjectLabel === 'idea-nov-staging'
    && typeof contract.approvalReference === 'string'
    && /^approval:[A-Za-z0-9._:/\/-]{1,160}$/.test(contract.approvalReference)
    && sameArray(contract.packIds, QUERY_PACK_IDS)
    && contract.publicQueryCatalogHash === PUBLIC_QUERY_CATALOG_HASH
    && HASH.test(contract.expectedObjectSetHash ?? '')
    && HASH.test(contract.expectedStage0Digest ?? '')
    && HASH.test(contract.privateQueryPackManifestHash ?? '')
    && HASH.test(contract.schemaContractHash ?? '')
    && contract.schemaContractHash === hashSchemaContract(contract);
  if (!valid) throw Object.assign(new Error('SCHEMA_CONTRACT_MISMATCH'), { code: 'SCHEMA_CONTRACT_MISMATCH' });
  return true;
}

export function assertPrivateQueryPackManifest(manifest, contract) {
  const valid = manifest
    && manifest.manifestId === 'SOCE-PRIVATE-QUERY-REGISTRY-v1'
    && manifest.executionState === 'sealed'
    && manifest.publicQueryCatalogHash === PUBLIC_QUERY_CATALOG_HASH
    && sameArray(manifest.packIds, QUERY_PACK_IDS)
    && Array.isArray(manifest.packs)
    && manifest.packs.length === QUERY_PACK_IDS.length
    && Array.isArray(manifest.queries)
    && manifest.queries.length === FIXED_QUERY_REGISTRY.length
    && exactKeys(manifest, ['manifestId', 'executionState', 'publicQueryCatalogHash', 'packIds', 'packs', 'queries', 'contentHash'])
    && HASH.test(manifest.contentHash ?? '')
    && manifest.contentHash === hashPrivateQueryPackManifest(manifest)
    && contract.privateQueryPackManifestHash === manifest.contentHash
    && manifest.queries.every((entry, index) => {
      const expected = FIXED_QUERY_REGISTRY[index];
      const publicShape = publicBindingShape(expected);
      return exactKeys(entry, QUERY_BINDING_FIELDS)
        && entry.queryId === publicShape.queryId
        && entry.queryVersion === publicShape.queryVersion
        && entry.packId === publicShape.packId
        && entry.sqlFile === publicShape.sqlFile
        && entry.sqlSha256 === publicShape.sqlSha256
        && sameArray(entry.expectedColumns, publicShape.expectedColumns)
        && sameValue(entry.expectedTypes, publicShape.expectedTypes)
        && entry.expectedOutputSchemaVersion === publicShape.expectedOutputSchemaVersion;
    })
    && manifest.packs.every((entry, index) => {
      const packId = QUERY_PACK_IDS[index];
      const expectedIds = FIXED_QUERY_REGISTRY.filter((query) => query.packId === packId).map((query) => query.queryId);
      return exactKeys(entry, ['packId', 'queryIds', 'queryHashManifestHash'])
        && entry.packId === packId
        && sameArray(entry.queryIds, expectedIds)
        && HASH.test(entry.queryHashManifestHash ?? '')
        && entry.queryHashManifestHash === expectedPackHash(manifest, packId);
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
