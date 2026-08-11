function reject(code) {
  throw Object.assign(new Error(code), { code });
}

export const BROKER_METHODS = Object.freeze([
  'trustedNow',
  'resolveProfile',
  'verifyBrokerMetadata',
  'openReadOnly',
  'closeReadOnlySessions',
  'close',
]);

export const READ_ONLY_CONNECTION_METHODS = Object.freeze([
  'beginReadOnly',
  'attestReadOnly',
  'attestCatalogBindings',
  'attestSealedQueryPacks',
  'attestRuntimeEvidence',
  'executeFixedQuery',
  'attestFinalRuntimeEvidence',
  'rollback',
  'close',
]);

export const ARTIFACT_SINK_METHODS = Object.freeze([
  'buildLocalEphemeralBundle',
  'finalizeLocalEphemeralBundle',
  'verifyLocalEphemeralBundle',
  'discardLocalEphemeralBundle',
  'atomicCommitFinalBundle',
  'verifyCommittedBundle',
  'revokeCommittedBundle',
  'cleanupTemporaryResources',
]);

export const LEDGER_METHODS = Object.freeze(['claim', 'complete', 'fail']);

export function assertExecutionInterfaces({ broker, privateArtifactSink, privateExecutionLedger }) {
  const brokerValid = broker && BROKER_METHODS.every((method) => typeof broker[method] === 'function');
  const sinkValid = privateArtifactSink && ARTIFACT_SINK_METHODS.every((method) => typeof privateArtifactSink[method] === 'function');
  const ledgerValid = privateExecutionLedger && LEDGER_METHODS.every((method) => typeof privateExecutionLedger[method] === 'function');
  if (!brokerValid || !sinkValid || !ledgerValid) reject('REQUEST_REJECTED');
  return true;
}

export function assertReadOnlyConnection(connection) {
  if (!connection || READ_ONLY_CONNECTION_METHODS.some((method) => typeof connection[method] !== 'function')) reject('REQUEST_REJECTED');
  const forbidden = ['query', 'execute', 'executeSql', 'raw', 'prepare', 'interactive', 'setRole', 'setSessionAuthorization'];
  if (forbidden.some((method) => typeof connection[method] === 'function')) reject('REQUEST_REJECTED');
  return true;
}
