import { hashCanonical } from './canonicalization.mjs';

export const CLEANUP_RECEIPT_VERSION = 'SOCE-CLEANUP-RECEIPT-v1';
export const CLEANUP_STATUSES = Object.freeze(['pass', 'failed', 'not_created']);
export const CLEANUP_RECEIPT_FIELDS = Object.freeze([
  'sourceConnectionClosed',
  'targetConnectionClosed',
  'brokerConnectionClosed',
  'rawResultsDeleted',
  'canonicalPayloadDeleted',
  'temporaryManifestDeleted',
  'temporaryEvidenceDeleted',
  'temporaryLogsDeleted',
  'downloadedArtifactsDeleted',
  'preparedBundleAbortedOrCommitted',
  'listenersStopped',
  'childProcessesStopped',
  'temporaryDirectoriesDeleted',
]);

function reject(code) {
  throw Object.assign(new Error(code), { code });
}

function receiptCore(receipt) {
  const { cleanupReceiptSha256: _hash, ...core } = receipt;
  return core;
}

export function cleanupReceiptSha256(receipt) {
  return hashCanonical(receiptCore(receipt));
}

export function buildCleanupReceipt(statuses) {
  if (!statuses || typeof statuses !== 'object' || Array.isArray(statuses)) reject('RUNNER_CLEANUP_FAILED');
  if (Object.keys(statuses).length !== CLEANUP_RECEIPT_FIELDS.length
    || CLEANUP_RECEIPT_FIELDS.some((field) => !Object.hasOwn(statuses, field) || !CLEANUP_STATUSES.includes(statuses[field]))) {
    reject('RUNNER_CLEANUP_FAILED');
  }
  const failedCleanupCount = CLEANUP_RECEIPT_FIELDS.filter((field) => statuses[field] === 'failed').length;
  const notCreatedCount = CLEANUP_RECEIPT_FIELDS.filter((field) => statuses[field] === 'not_created').length;
  const core = {
    cleanupReceiptVersion: CLEANUP_RECEIPT_VERSION,
    ...Object.fromEntries(CLEANUP_RECEIPT_FIELDS.map((field) => [field, statuses[field]])),
    cleanupOverallStatus: failedCleanupCount === 0 ? 'pass' : 'failed',
    failedCleanupCount,
    notCreatedCount,
  };
  return Object.freeze({ ...core, cleanupReceiptSha256: hashCanonical(core) });
}

export function assertCleanupReceipt(receipt, { requirePassing = false } = {}) {
  const exactKeys = ['cleanupReceiptVersion', ...CLEANUP_RECEIPT_FIELDS, 'cleanupOverallStatus', 'failedCleanupCount', 'notCreatedCount', 'cleanupReceiptSha256'];
  if (!receipt || typeof receipt !== 'object' || Array.isArray(receipt)
    || Object.keys(receipt).length !== exactKeys.length
    || exactKeys.some((key) => !Object.hasOwn(receipt, key))
    || receipt.cleanupReceiptVersion !== CLEANUP_RECEIPT_VERSION
    || CLEANUP_RECEIPT_FIELDS.some((field) => !CLEANUP_STATUSES.includes(receipt[field]))
    || !Number.isSafeInteger(receipt.failedCleanupCount) || receipt.failedCleanupCount < 0
    || !Number.isSafeInteger(receipt.notCreatedCount) || receipt.notCreatedCount < 0
    || !/^[a-f0-9]{64}$/.test(receipt.cleanupReceiptSha256 ?? '')) {
    reject('RUNNER_CLEANUP_FAILED');
  }
  const expectedStatuses = Object.fromEntries(CLEANUP_RECEIPT_FIELDS.map((field) => [field, receipt[field]]));
  const expected = buildCleanupReceipt(expectedStatuses);
  if (receipt.cleanupOverallStatus !== expected.cleanupOverallStatus
    || receipt.failedCleanupCount !== expected.failedCleanupCount
    || receipt.notCreatedCount !== expected.notCreatedCount
    || receipt.cleanupReceiptSha256 !== expected.cleanupReceiptSha256) {
    reject('RUNNER_CLEANUP_FAILED');
  }
  if (requirePassing && receipt.cleanupOverallStatus !== 'pass') reject('RUNNER_CLEANUP_FAILED');
  return true;
}

export function cleanupEvidence(receipt) {
  assertCleanupReceipt(receipt, { requirePassing: true });
  return Object.freeze({
    evidence_type: 'cleanup_receipt',
    cleanupReceipt: receipt,
    cleanupReceiptVersion: receipt.cleanupReceiptVersion,
    cleanupReceiptSha256: receipt.cleanupReceiptSha256,
    cleanupOverallStatus: receipt.cleanupOverallStatus,
    failedCleanupCount: receipt.failedCleanupCount,
    notCreatedCount: receipt.notCreatedCount,
    status: 'pass',
  });
}
