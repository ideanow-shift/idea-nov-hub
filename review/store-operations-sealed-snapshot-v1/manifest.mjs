import { hashCanonical, hashRecordSet } from './canonicalization.mjs';

function digestFor(records, side) {
  return hashCanonical(records.filter((record) => record.side === side).map(({ queryId, rows }) => ({
    queryId,
    rows: hashRecordSet(rows),
  })).sort((left, right) => left.queryId.localeCompare(right.queryId)));
}

export function buildPrivateSnapshotManifest({ request, schemaContract, privateQueryPackManifest, stage0Records, stage1Records, executionTimestamp }) {
  const canonicalPayload = {
    manifestVersion: 'SOCE-MANIFEST-v1',
    packageId: request.executionPackageId,
    authorizationReference: request.authorizationReference,
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
