export const STATUS = Object.freeze({
  PASS: 'PASS',
  CONDITIONAL: 'CONDITIONAL',
  BLOCKED: 'BLOCKED',
  UNVERIFIED: 'UNVERIFIED',
  NOT_APPLICABLE: 'NOT_APPLICABLE',
});

const system = (id, name, owner, detail, checks, sources, nextDecision) => ({ id, name, owner, detail, checks, sources, nextDecision });

// Update this registry with evidence references whenever a platform-domain status changes.
export const PLATFORM_STATUS_UPDATED_AT = '2026-08-01';
export const PLATFORM_STATUS_SYSTEMS = Object.freeze([
  system('recruiting', '求人管理', 'NOV Talent', 'CSV検証と隔離表示は進んでいるが、対象データの業務受入と本番連携は別ゲート。', {
    dataIntegrity: STATUS.CONDITIONAL, workflow: STATUS.CONDITIONAL, ux: STATUS.CONDITIONAL, operationalReview: STATUS.UNVERIFIED, developmentQuality: STATUS.CONDITIONAL,
  }, ['Talent CSV validation/normalization evidence', 'Talent release readiness documents'], '対象学年・隔離データの業務受入を確認する'),
  system('store-operations', '店舗営業管理', 'Store Operations', 'ローカルCSVを用いた分析導線はある。正式データSourceと営業部レビューは未完了。', {
    dataIntegrity: STATUS.CONDITIONAL, workflow: STATUS.CONDITIONAL, ux: STATUS.CONDITIONAL, operationalReview: STATUS.UNVERIFIED, developmentQuality: STATUS.CONDITIONAL,
  }, ['Store Operations local CSV checks', 'Store Operations production-readiness plans'], '営業部レビューと正式Store Sales read-only経路を確定する'),
  system('hub', 'HUB', 'HUB Core', 'プラットフォームUIは段階的に整備中。集計Providerと業務データの接続は未承認。', {
    dataIntegrity: STATUS.UNVERIFIED, workflow: STATUS.CONDITIONAL, ux: STATUS.CONDITIONAL, operationalReview: STATUS.UNVERIFIED, developmentQuality: STATUS.CONDITIONAL,
  }, ['NOV NAVI boundary tests', 'Provider source-only contracts'], '接続可能なProviderごとのowner確認を得る'),
  system('core-db', 'Core DB', 'Core DB Governance', 'SSoT、所沢UUID、実DB事実確認はProduction read-only監査の承認待ち。', {
    dataIntegrity: STATUS.BLOCKED, workflow: STATUS.CONDITIONAL, ux: STATUS.NOT_APPLICABLE, operationalReview: STATUS.UNVERIFIED, developmentQuality: STATUS.CONDITIONAL,
  }, ['Core DB remediation documents', 'Production read-only audit runner approval board'], 'D01〜D10の人間承認とcatalog-only smokeを判断する'),
  system('accounting', 'Accounting', 'Accounting Core', 'ローカルP/L分析の候補はあるが、正式利益Source・確定期間・経理受入は未確定。', {
    dataIntegrity: STATUS.CONDITIONAL, workflow: STATUS.CONDITIONAL, ux: STATUS.CONDITIONAL, operationalReview: STATUS.UNVERIFIED, developmentQuality: STATUS.CONDITIONAL,
  }, ['Accounting aggregate/local fixture evidence', 'Release plan 1.1 source gate'], '利益Source、計算式、confirmed_through_periodを経理責任者が確認する'),
  system('people', 'People', 'People / HR', '現職者・人事の実運用対象、データ範囲、受入レビューの統合証拠は未確認。', {
    dataIntegrity: STATUS.UNVERIFIED, workflow: STATUS.CONDITIONAL, ux: STATUS.UNVERIFIED, operationalReview: STATUS.UNVERIFIED, developmentQuality: STATUS.UNVERIFIED,
  }, ['Permission model architecture', 'HR aggregate contracts are source-only'], '対象業務とデータ責任者、実運用レビューを定義する'),
  system('finance', 'Finance', 'Finance / Management', 'ローカル財務CSVの分析候補はある。正式な月次確定・運用受入・本番Sourceは未確認。', {
    dataIntegrity: STATUS.CONDITIONAL, workflow: STATUS.CONDITIONAL, ux: STATUS.CONDITIONAL, operationalReview: STATUS.UNVERIFIED, developmentQuality: STATUS.CONDITIONAL,
  }, ['Management local financial CSV fixtures', 'Accounting confirmed-source gate'], '経理・経営管理で月次確定と利用フローを受入確認する'),
]);
