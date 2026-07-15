const PROVIDER_LABELS = Object.freeze([
  "版管理",
  "スナップショット",
  "法人範囲",
  "対象期間",
  "データ所有元",
  "実行者・監査",
]);

const HARD_RUNTIME_GATE = false;

export const SANITIZED_CLASSIFICATION_READINESS = Object.freeze({
  status: "BLOCKED",
  statusLabel: "準備中",
  summary: "ローカル検証は完了しています。実運用の提供元確認が完了するまで承認操作は利用できません。",
  localRehearsal: "完了",
  productionCatalogProof: "費用判断により保留",
  providers: Object.freeze(PROVIDER_LABELS.map((label) => Object.freeze({ label, statusLabel: "未準備" }))),
  action: Object.freeze({ label: "分類承認", enabled: false, reason: "VERSION_PROVIDER_NOT_READY" }),
});

const MODEL_KEYS = Object.freeze([
  "status",
  "statusLabel",
  "summary",
  "localRehearsal",
  "productionCatalogProof",
  "providers",
  "action",
]);

function exactKeys(value, expected) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const keys = Object.keys(value);
  return keys.length === expected.length && keys.every((key) => expected.includes(key));
}

export function validateSanitizedReadinessModel(model) {
  if (!exactKeys(model, MODEL_KEYS)) return false;
  if (model.status !== "BLOCKED" || model.statusLabel !== "準備中") return false;
  if (model.localRehearsal !== "完了" || model.productionCatalogProof !== "費用判断により保留") return false;
  if (!Array.isArray(model.providers) || model.providers.length !== PROVIDER_LABELS.length) return false;
  if (!model.providers.every((provider, index) => exactKeys(provider, ["label", "statusLabel"])
    && provider.label === PROVIDER_LABELS[index]
    && provider.statusLabel === "未準備")) return false;
  return exactKeys(model.action, ["label", "enabled", "reason"])
    && model.action.label === "分類承認"
    && model.action.enabled === false
    && model.action.reason === "VERSION_PROVIDER_NOT_READY";
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function invalidModel() {
  return Object.freeze({
    status: "INVALID",
    statusLabel: "確認が必要",
    summary: "準備状況を安全に確認できません。",
    localRehearsal: "未確認",
    productionCatalogProof: "未確認",
    providers: Object.freeze([]),
    action: Object.freeze({ label: "分類承認", enabled: false, reason: "READINESS_INPUT_INVALID" }),
  });
}

export function renderClassificationReadinessPanel(model = SANITIZED_CLASSIFICATION_READINESS) {
  const view = validateSanitizedReadinessModel(model) && HARD_RUNTIME_GATE === false ? model : invalidModel();
  const providerRows = view.providers.map((provider) => `
        <li class="classification-readiness-provider">
          <span>${escapeHtml(provider.label)}</span>
          <span class="classification-readiness-state">${escapeHtml(provider.statusLabel)}</span>
        </li>`).join("");

  return `
    <section class="panel classification-readiness-panel" data-readiness-status="${escapeHtml(view.status)}" aria-labelledby="classificationReadinessTitle">
      <div class="panel-head horizontal classification-readiness-head">
        <div>
          <p class="section-label">Classification Approval</p>
          <h2 id="classificationReadinessTitle">分類承認の準備状況</h2>
          <p class="muted-text">${escapeHtml(view.summary)}</p>
        </div>
        <span class="classification-readiness-badge">${escapeHtml(view.statusLabel)}</span>
      </div>
      <dl class="classification-readiness-facts">
        <div><dt>ローカル検証</dt><dd>${escapeHtml(view.localRehearsal)}</dd></div>
        <div><dt>本番カタログ確認</dt><dd>${escapeHtml(view.productionCatalogProof)}</dd></div>
      </dl>
      <ul class="classification-readiness-providers" aria-label="提供元の準備状況">${providerRows}
      </ul>
      <div class="classification-readiness-action">
        <button type="button" disabled aria-disabled="true" title="現在は操作できません">${escapeHtml(view.action.label)}</button>
        <span>実運用の準備完了後に利用できます。</span>
      </div>
    </section>`;
}

export function mountClassificationReadinessPanel(root = globalThis.document) {
  const mount = root?.getElementById?.("classificationReadinessPanel");
  if (!mount) return false;
  mount.innerHTML = renderClassificationReadinessPanel();
  return true;
}

if (typeof document !== "undefined") mountClassificationReadinessPanel(document);
