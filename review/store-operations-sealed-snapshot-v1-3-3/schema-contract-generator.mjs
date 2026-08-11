import { hashCanonical } from './canonicalization.mjs';
import { PACKAGE_ID, PACKAGE_VERSION } from './package-metadata.mjs';
import { PUBLIC_QUERY_CATALOG_HASH, QUERY_PACK_IDS } from './query-pack-registry.mjs';
import { SECURITY_ALLOWLIST_HASH } from './execution-path-security.mjs';
import {
  QP02_SOURCE_OBJECT_SET,
  QP04_CANONICAL_ASSIGNMENT_COLUMNS,
  assertApprovedSchemaContract,
  hashSchemaContract,
} from './schema-contract.mjs';

export function generateApprovedSchemaContract({
  approvalReference,
  packageLock,
  privateQueryPackManifestHash,
  expectedStage0Digest,
  targetObjectSet,
  sourceApplicationSchemaCount,
  sourceApplicationSchemaSetMd5,
  targetApplicationSchemaCount,
  targetApplicationSchemaSetMd5,
  roleScope,
  rlsPrivilegeEvidence,
}) {
  const sourceObjectSet = [...QP02_SOURCE_OBJECT_SET];
  const relationColumnSet = [...QP04_CANONICAL_ASSIGNMENT_COLUMNS];
  const base = {
    contractId: 'SOCE-SCHEMA-COLUMN-CONTRACT-v1',
    contractVersion: '1.3.3',
    executionState: 'approved',
    sourceProjectLabel: 'idea-nov-core',
    targetProjectLabel: 'idea-nov-staging',
    approvalReference,
    packageId: PACKAGE_ID,
    packageVersion: PACKAGE_VERSION,
    packageSha256: packageLock.packageSha256,
    queryPackSha256: packageLock.queryPackSha256,
    packIds: [...QUERY_PACK_IDS],
    publicQueryCatalogHash: PUBLIC_QUERY_CATALOG_HASH,
    securityAllowlistHash: SECURITY_ALLOWLIST_HASH,
    privateQueryPackManifestHash,
    sourceObjectSet,
    targetObjectSet: [...targetObjectSet].sort(),
    relationColumnSet,
    roleScope: structuredClone(roleScope),
    rlsPrivilegeEvidence: structuredClone(rlsPrivilegeEvidence),
    expectedObjectSetHash: hashCanonical({ sourceObjectSet, targetObjectSet: [...targetObjectSet].sort(), relationColumnSet }),
    expectedStage0Digest,
    sourceApplicationSchemaCount,
    sourceApplicationSchemaSetMd5,
    targetApplicationSchemaCount,
    targetApplicationSchemaSetMd5,
  };
  const contract = Object.freeze({ ...base, schemaContractHash: hashSchemaContract(base) });
  assertApprovedSchemaContract(contract);
  return contract;
}
