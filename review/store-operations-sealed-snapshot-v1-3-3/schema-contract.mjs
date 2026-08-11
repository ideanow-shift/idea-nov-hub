import { hashCanonical, stableRecordSet } from './canonicalization.mjs';
import { FIXED_QUERY_REGISTRY, PUBLIC_QUERY_CATALOG_HASH, QUERY_PACK_IDS, getFixedQuery } from './query-pack-registry.mjs';
import { SECURITY_ALLOWLIST, SECURITY_ALLOWLIST_HASH } from './execution-path-security.mjs';
import { PACKAGE_ID, PACKAGE_VERSION } from './package-metadata.mjs';

const HASH = /^[a-f0-9]{64}$/;
const MD5 = /^[a-f0-9]{32}$/;
const QUERY_BINDING_FIELDS = Object.freeze([
  'queryId',
  'queryVersion',
  'packId',
  'sqlFile',
  'sqlSha256',
  'astSha256',
  'expectedColumns',
  'expectedTypes',
  'expectedOutputSchemaVersion',
]);
export const APPROVED_SCHEMA_CONTRACT_FIELDS = Object.freeze([
  'contractId', 'contractVersion', 'executionState', 'sourceProjectLabel', 'targetProjectLabel',
  'approvalReference', 'packageId', 'packageVersion', 'packageSha256', 'queryPackSha256',
  'packIds', 'publicQueryCatalogHash', 'securityAllowlistHash', 'privateQueryPackManifestHash',
  'sourceObjectSet', 'targetObjectSet', 'relationColumnSet', 'roleScope', 'rlsPrivilegeEvidence',
  'expectedObjectSetHash', 'expectedStage0Digest', 'sourceApplicationSchemaCount',
  'sourceApplicationSchemaSetMd5', 'targetApplicationSchemaCount',
  'targetApplicationSchemaSetMd5', 'schemaContractHash',
]);

export const QP02_SOURCE_OBJECT_SET = Object.freeze([
  'public.corporations', 'public.departments', 'public.employee_organization_assignments',
  'public.employee_store_assignments', 'public.employees', 'public.organization_assignment_types',
  'public.stores',
]);

export const QP04_CANONICAL_ASSIGNMENT_COLUMNS = Object.freeze([
  'public.departments.department_name', 'public.departments.id', 'public.departments.is_active',
  'public.employee_organization_assignments.assignment_type_id', 'public.employee_organization_assignments.department_id',
  'public.employee_organization_assignments.effective_from', 'public.employee_organization_assignments.effective_to',
  'public.employee_organization_assignments.employee_id', 'public.employee_organization_assignments.is_active',
  'public.employee_organization_assignments.target_type', 'public.employees.employee_id', 'public.employees.employment_status',
  'public.employees.id', 'public.employees.is_active', 'public.employees.joined_on', 'public.employees.retired_on',
  'public.organization_assignment_types.allowed_target_type', 'public.organization_assignment_types.assignment_code',
  'public.organization_assignment_types.id', 'public.organization_assignment_types.is_active',
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
  const securityBinding = SECURITY_ALLOWLIST.queries.find((entry) => entry.queryId === query.queryId);
  return {
    queryId: query.queryId,
    queryVersion: query.queryVersion,
    packId: query.packId,
    sqlFile: query.sqlFile,
    sqlSha256: query.sqlSha256,
    astSha256: securityBinding?.astSha256,
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
  return manifest.queries.map(({ queryId, queryVersion, packId, sqlFile, sqlSha256, astSha256, expectedOutputSchemaVersion }) => ({
    queryId,
    queryVersion,
    packId,
    sqlFile,
    sqlSha256,
    astSha256,
    expectedOutputSchemaVersion,
  }));
}

export function assertApprovedSchemaContract(contract) {
  const valid = contract
    && exactKeys(contract, APPROVED_SCHEMA_CONTRACT_FIELDS)
    && contract.contractId === 'SOCE-SCHEMA-COLUMN-CONTRACT-v1'
    && contract.contractVersion === '1.3.3'
    && contract.executionState === 'approved'
    && contract.sourceProjectLabel === 'idea-nov-core'
    && contract.targetProjectLabel === 'idea-nov-staging'
    && typeof contract.approvalReference === 'string'
    && /^approval:[A-Za-z0-9._:/\/-]{1,160}$/.test(contract.approvalReference)
    && sameArray(contract.packIds, QUERY_PACK_IDS)
    && contract.packageId === PACKAGE_ID
    && contract.packageVersion === PACKAGE_VERSION
    && HASH.test(contract.packageSha256 ?? '')
    && HASH.test(contract.queryPackSha256 ?? '')
    && contract.publicQueryCatalogHash === PUBLIC_QUERY_CATALOG_HASH
    && contract.securityAllowlistHash === SECURITY_ALLOWLIST_HASH
    && HASH.test(contract.expectedObjectSetHash ?? '')
    && HASH.test(contract.expectedStage0Digest ?? '')
    && HASH.test(contract.privateQueryPackManifestHash ?? '')
    && HASH.test(contract.schemaContractHash ?? '')
    && sameArray(contract.sourceObjectSet, QP02_SOURCE_OBJECT_SET)
    && Array.isArray(contract.targetObjectSet) && contract.targetObjectSet.length > 0
    && sameArray(contract.relationColumnSet, QP04_CANONICAL_ASSIGNMENT_COLUMNS)
    && contract.roleScope && contract.roleScope.sourceSnapshotRole !== contract.roleScope.targetSnapshotRole
    && contract.roleScope.membershipCount === 0 && contract.roleScope.ownershipCount === 0
    && contract.rlsPrivilegeEvidence && contract.rlsPrivilegeEvidence.effectiveRoleClosurePassed === true
    && contract.rlsPrivilegeEvidence.sourceSelectScopePassed === true
    && contract.rlsPrivilegeEvidence.targetSelectScopePassed === true
    && contract.rlsPrivilegeEvidence.authSchemaPrivilegeCount === 0
    && Number.isSafeInteger(contract.sourceApplicationSchemaCount)
    && contract.sourceApplicationSchemaCount > 0
    && MD5.test(contract.sourceApplicationSchemaSetMd5 ?? '')
    && Number.isSafeInteger(contract.targetApplicationSchemaCount)
    && contract.targetApplicationSchemaCount > 0
    && MD5.test(contract.targetApplicationSchemaSetMd5 ?? '')
    && contract.expectedObjectSetHash === hashCanonical({
      sourceObjectSet: contract.sourceObjectSet,
      targetObjectSet: contract.targetObjectSet,
      relationColumnSet: contract.relationColumnSet,
    })
    && contract.schemaContractHash === hashSchemaContract(contract);
  if (!valid) throw Object.assign(new Error('SCHEMA_CONTRACT_MISMATCH'), { code: 'SCHEMA_CONTRACT_MISMATCH' });
  return true;
}

export function assertPrivateQueryPackManifest(manifest, contract) {
  const valid = manifest
    && manifest.manifestId === 'SOCE-PRIVATE-QUERY-REGISTRY-v1'
    && manifest.executionState === 'sealed'
    && manifest.publicQueryCatalogHash === PUBLIC_QUERY_CATALOG_HASH
    && manifest.securityAllowlistHash === SECURITY_ALLOWLIST_HASH
    && sameArray(manifest.packIds, QUERY_PACK_IDS)
    && Array.isArray(manifest.packs)
    && manifest.packs.length === QUERY_PACK_IDS.length
    && Array.isArray(manifest.queries)
    && manifest.queries.length === FIXED_QUERY_REGISTRY.length
    && exactKeys(manifest, ['manifestId', 'executionState', 'publicQueryCatalogHash', 'securityAllowlistHash', 'packIds', 'packs', 'queries', 'contentHash'])
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
        && entry.astSha256 === publicShape.astSha256
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
