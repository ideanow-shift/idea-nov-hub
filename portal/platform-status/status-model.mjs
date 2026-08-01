import { STATUS } from './status-data.mjs';

export const CHECKS = Object.freeze([
  ['dataIntegrity', 'データ整合性'],
  ['workflow', '業務フロー'],
  ['ux', 'UI/UX'],
  ['operationalReview', '実運用レビュー'],
  ['developmentQuality', '開発品質'],
]);

export function getReleaseState(checks) {
  const values = CHECKS.map(([key]) => checks[key]);
  if (values.every((value) => value === STATUS.PASS)) return 'RELEASE_READY';
  if (values.includes(STATUS.BLOCKED)) return 'NO_GO';
  return 'NOT_READY';
}

export function getDisplayStatus(status) {
  return ({ PASS: 'PASS', CONDITIONAL: '条件付き', BLOCKED: '停止中', UNVERIFIED: '未確認', NOT_APPLICABLE: '対象外', RELEASE_READY: 'Ready', NOT_READY: '未準備', NO_GO: 'No-Go' })[status] ?? '未確認';
}

export function statusTone(status) {
  return ({ PASS: 'pass', CONDITIONAL: 'conditional', BLOCKED: 'blocked', UNVERIFIED: 'unverified', NOT_APPLICABLE: 'na', RELEASE_READY: 'pass', NOT_READY: 'unverified', NO_GO: 'blocked' })[status] ?? 'unverified';
}
