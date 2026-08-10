import { hashCanonical, hashRecordSet } from './canonicalization.mjs';
import { assertCleanupReceipt } from './cleanup-receipt.mjs';
import { PACKAGE_VERSION } from './package-metadata.mjs';

function digestFor(records, side) {
  return hashCanonical(records.filter((record) => record.side === side).map(({ queryId, rows }) => ({
    queryId,
    rows: hashRecordSet(rows),
  })).sort((left, right) => left.queryId.localeCompare(right.queryId)));
}

export function buildPrivateSnapshotManifest({ request, packageLock, schemaContract, privateQueryPackManifest, stage0Records, stage1Records, executionTimestamp, executionAuthorizationBindingHash, cleanupReceipt }) {
  assertCleanupReceipt(cleanupReceipt, { requirePassing: true });
  const canonicalPayload = {
    manifestVersion: 'SOCE-MANIFEST-v1',
    packageId: request.executionPackageId,
    packageVersion: PACKAGE_VERSION,
    packageSha256: packageLock.packageSha256,
    queryPackSha256: packageLock.queryPackSha256,
    securityAllowlistSha256: packageLock.securityAllowlistSha256,
    executionPathSecuritySha256: packageLock.executionPathSecuritySha256,
    runId: request.runId,
    authorizationReference: request.authorizationReference,
    executionAuthorizationBindingHash,
    sourceProjectLabel: request.sourceProjectLabel,
    targetProjectLabel: request.targetProjectLabel,
    executionTimestamp,
    schemaContractHash: schemaContract.schemaContractHash,
    privateQueryPackManifestHash: privateQueryPackManifest.contentHash,
    publicQueryCatalogHash: privateQueryPackManifest.publicQueryCatalogHash,
    stage0EvidenceHash: hashCanonical(stage0Records.map(({ queryId, rows }) => ({ queryId, rows: hashRecordSet(rows) }))),
    sourceSnapshotHash: digestFor(stage1Records, 'source'),
    targetPreStateHash: digestFor(stage1Records, 'target'),
    queryIds: stage0Records.concat(stage1Records).map(({ queryId }) => queryId),
    cleanupReceiptVersion: cleanupReceipt.cleanupReceiptVersion,
    cleanupReceiptSha256: cleanupReceipt.cleanupReceiptSha256,
    cleanupOverallStatus: cleanupReceipt.cleanupOverallStatus,
    failedCleanupCount: cleanupReceipt.failedCleanupCount,
    notCreatedCount: cleanupReceipt.notCreatedCount,
  };
  const canonicalPayloadHash = hashCanonical(canonicalPayload);
  const manifest = {
    manifestVersion: 'SOCE-MANIFEST-v1',
    canonicalPayloadHash,
    canonicalPayload,
  };
  return Object.freeze({
    ...manifest,
    manifestFileHash: hashCanonical(manifest),
  });
}
