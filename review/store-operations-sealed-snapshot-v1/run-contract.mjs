import { hashCanonical } from './canonicalization.mjs';
import { PACKAGE_ID, PACKAGE_VERSION } from './package-metadata.mjs';

const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
const SAFE_REFERENCE = /^(?:approval|principal|attestation|run|private):[A-Za-z0-9._:/-]{1,160}$/;
const HASH = /^[a-f0-9]{64}$/;
export const SNAPSHOT_OUTPUT_POLICY = 'sealed_private_snapshot_only';

function reject(code) {
  throw Object.assign(new Error(code), { code });
}

function parseUtc(value) {
  if (typeof value !== 'string' || !ISO_UTC.test(value) || Number.isNaN(new Date(value).getTime())) reject('EXECUTION_AUTHORIZATION_REJECTED');
  return new Date(value);
}

const BINDING_FIELDS = Object.freeze([
  'authorizationReference', 'runId', 'packageId', 'packageVersion', 'packageSha256', 'queryPackSha256', 'schemaContractSha256', 'approvedSchemaContractHash', 'privateQueryPackManifestHash', 'publicQueryCatalogHash',
  'sourceProfileReference', 'sourceProfileFingerprint', 'targetProfileReference', 'targetProfileFingerprint', 'brokerReference', 'brokerFingerprint',
  'operatorReference', 'reviewerReference', 'ownerReference', 'sourceRoleOwnerReference', 'targetRoleOwnerReference', 'brokerOwnerReference', 'profileCustodianReference',
  'authorizedAt', 'executionWindowStart', 'executionWindowEnd', 'snapshotOutputPolicy',
]);

export function assertExecutionAuthorizationBinding({ request, authorization, packageLock, approvedSchemaContract }) {
  if (!authorization || typeof authorization !== 'object' || Array.isArray(authorization)
    || Object.keys(authorization).length !== BINDING_FIELDS.length || BINDING_FIELDS.some((field) => !Object.hasOwn(authorization, field))) {
    reject('EXECUTION_AUTHORIZATION_REJECTED');
  }
  const values = [
    authorization.authorizationReference === request.authorizationReference,
    authorization.runId === request.runId,
    authorization.packageId === PACKAGE_ID,
    authorization.packageVersion === PACKAGE_VERSION,
    authorization.packageSha256 === packageLock.packageSha256,
    authorization.queryPackSha256 === packageLock.queryPackSha256,
    authorization.schemaContractSha256 === packageLock.schemaContractSha256,
    authorization.approvedSchemaContractHash === approvedSchemaContract.schemaContractHash,
    authorization.privateQueryPackManifestHash === request.privateQueryPackManifestHash,
    authorization.publicQueryCatalogHash === request.publicQueryCatalogHash,
    authorization.snapshotOutputPolicy === SNAPSHOT_OUTPUT_POLICY,
  ];
  if (values.some((value) => value !== true) || [
    authorization.packageSha256, authorization.queryPackSha256, authorization.schemaContractSha256,
    authorization.sourceProfileFingerprint, authorization.targetProfileFingerprint, authorization.brokerFingerprint,
  ].some((value) => !HASH.test(value ?? ''))) {
    reject('EXECUTION_AUTHORIZATION_REJECTED');
  }
  for (const field of BINDING_FIELDS.filter((field) => field.endsWith('Reference'))) {
    if (!SAFE_REFERENCE.test(authorization[field] ?? '')) reject('EXECUTION_AUTHORIZATION_REJECTED');
  }
  return hashCanonical(authorization);
}

export function assertSeparationOfDuties(authorization, now) {
  const authorizedAt = parseUtc(authorization.authorizedAt);
  const windowStart = parseUtc(authorization.executionWindowStart);
  const windowEnd = parseUtc(authorization.executionWindowEnd);
  if (!(now instanceof Date) || Number.isNaN(now.getTime()) || authorizedAt > windowStart || windowStart >= windowEnd || now < windowStart || now >= windowEnd) {
    reject('EXECUTION_AUTHORIZATION_REJECTED');
  }
  if (authorization.operatorReference === authorization.reviewerReference
    || [authorization.sourceRoleOwnerReference, authorization.targetRoleOwnerReference, authorization.brokerOwnerReference, authorization.profileCustodianReference].includes(authorization.operatorReference)) {
    reject('EXECUTION_AUTHORIZATION_REJECTED');
  }
  return true;
}
