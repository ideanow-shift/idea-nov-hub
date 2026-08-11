import { hashCanonical } from './canonicalization.mjs';
import { generateExecutionAuthorization, assertAuthorizationGeneratorParity } from './authorization-generator.mjs';
import { verifyExecutionPackage } from './execution-package-lock.mjs';
import { resolveCanonicalOperator } from './operator-resolver.mjs';
import { PUBLIC_QUERY_CATALOG_HASH } from './query-pack-registry.mjs';
import { assertSeparationOfDuties } from './run-contract.mjs';
import {
  assertApprovedSchemaContract,
  assertPrivateQueryPackManifest,
  QP02_SOURCE_OBJECT_SET,
  QP04_CANONICAL_ASSIGNMENT_COLUMNS,
} from './schema-contract.mjs';

function reject() {
  throw Object.assign(new Error('FORMAL_RUNNER_PREFLIGHT_REJECTED'), { code: 'FORMAL_RUNNER_PREFLIGHT_REJECTED' });
}

export function zeroConnectionFormalRunnerPreflight({
  request,
  authorizationSource,
  approvedSchemaContract,
  privateQueryPackManifest,
  sourceProfile,
  targetProfile,
  operatorSummary,
  operatorEmployeeUuid,
  operatorEmployeeNumber,
  reviewerPrincipal,
  executionLedgerBinding,
  packageRoot,
  trustedNow,
}) {
  assertAuthorizationGeneratorParity();
  const packageLock = verifyExecutionPackage({ packageRoot });
  assertApprovedSchemaContract(approvedSchemaContract);
  assertPrivateQueryPackManifest(privateQueryPackManifest, approvedSchemaContract);
  const generated = generateExecutionAuthorization({ source: authorizationSource, request, packageLock, approvedSchemaContract });
  if (generated.requiredFieldCount !== 31 || generated.missingFieldCount !== 0 || generated.unknownFieldCount !== 0) reject();
  const authorization = generated.authorization;
  if (request.privateQueryPackManifestHash !== privateQueryPackManifest.contentHash
    || request.publicQueryCatalogHash !== PUBLIC_QUERY_CATALOG_HASH
    || request.schemaContractHash !== approvedSchemaContract.schemaContractHash
    || authorization.sourceProfileReference !== sourceProfile.profileReference
    || authorization.sourceProfileFingerprint !== sourceProfile.profileFingerprint
    || authorization.targetProfileReference !== targetProfile.profileReference
    || authorization.targetProfileFingerprint !== targetProfile.profileFingerprint
    || authorization.sourceSnapshotRole !== sourceProfile.expectedSnapshotRole
    || authorization.targetSnapshotRole !== targetProfile.expectedSnapshotRole
    || authorization.brokerReference !== sourceProfile.brokerReference
    || authorization.brokerReference !== targetProfile.brokerReference) reject();
  const operator = resolveCanonicalOperator({
    summary: operatorSummary,
    expectedEmployeeUuid: operatorEmployeeUuid,
    expectedEmployeeNumber: operatorEmployeeNumber,
    reviewerPrincipal,
  });
  if (authorization.operatorReference !== `principal:canonical-employee:${operator.employeeUuid}`
    || authorization.reviewerReference !== reviewerPrincipal
    || authorization.operatorReference === authorization.reviewerReference) reject();
  assertSeparationOfDuties(authorization, trustedNow);
  if (!QP02_SOURCE_OBJECT_SET.includes('public.employee_organization_assignments')
    || !QP02_SOURCE_OBJECT_SET.includes('public.organization_assignment_types')
    || QP04_CANONICAL_ASSIGNMENT_COLUMNS.some((column) => !approvedSchemaContract.relationColumnSet.includes(column))) reject();
  if (!executionLedgerBinding || executionLedgerBinding.runId !== request.runId
    || executionLedgerBinding.authorizationBindingHash !== generated.authorizationSha256
    || executionLedgerBinding.outputPolicy !== authorization.snapshotOutputPolicy
    || executionLedgerBinding.state !== 'AUTHORIZED') reject();
  return Object.freeze({
    state: 'EXECUTION_READY',
    connectionAttemptCount: 0,
    queryExecutionCount: 0,
    authorizationFieldCount: 31,
    missingFieldCount: 0,
    unknownFieldCount: 0,
    packageSha256: packageLock.packageSha256,
    schemaContractHash: approvedSchemaContract.schemaContractHash,
    authorizationBindingHash: generated.authorizationSha256,
    operatorBindingHash: hashCanonical(operator),
  });
}
