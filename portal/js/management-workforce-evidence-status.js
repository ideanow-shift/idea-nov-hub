export const WORKFORCE_EVIDENCE_CATEGORIES = Object.freeze([
  "AUTHORITATIVE_READY",
  "LOCAL_VALIDATED_PENDING_PRODUCTION",
  "SOURCE_CONTRACT_INCOMPLETE",
  "UNAVAILABLE",
]);

const MODEL_KEYS = Object.freeze([
  "category",
  "statusLabel",
  "summary",
  "sourceLabel",
  "productionEvidence",
  "aggregateValuesVisible",
  "relatedActionsEnabled",
]);
const HARD_RUNTIME_GATE = false;

export const SANITIZED_WORKFORCE_EVIDENCE = Object.freeze({
  category: "SOURCE_CONTRACT_INCOMPLETE",
  statusLabel: "算定契約確認中",
  summary: "月末基準・異動履歴・休職・退職・兼務・出向の扱いを正本で確定するまで、人数・組織集計値を表示しません。",
  sourceLabel: "外部社員・異動マスター",
  productionEvidence: "PENDING",
  aggregateValuesVisible: false,
  relatedActionsEnabled: false,
});

function exactKeys(value, expected) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const keys = Object.keys(value);
  return keys.length === expected.length && keys.every((key) => expected.includes(key));
}

export function validateWorkforceEvidenceModel(model) {
  return exactKeys(model, MODEL_KEYS)
    && model.category === SANITIZED_WORKFORCE_EVIDENCE.category
    && model.statusLabel === SANITIZED_WORKFORCE_EVIDENCE.statusLabel
    && model.summary === SANITIZED_WORKFORCE_EVIDENCE.summary
    && model.sourceLabel === SANITIZED_WORKFORCE_EVIDENCE.sourceLabel
    && model.productionEvidence === SANITIZED_WORKFORCE_EVIDENCE.productionEvidence
    && model.aggregateValuesVisible === false
    && model.relatedActionsEnabled === false;
}

export function canDisplayWorkforceAggregates(model = SANITIZED_WORKFORCE_EVIDENCE) {
  return HARD_RUNTIME_GATE === true
    && validateWorkforceEvidenceModel(model)
    && model.category === "AUTHORITATIVE_READY"
    && model.aggregateValuesVisible === true;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function invalidEvidence() {
  return Object.freeze({
    category: "UNAVAILABLE",
    statusLabel: "利用不可",
    summary: "算定根拠状態を安全に確認できないため、人数・組織集計値を表示しません。",
    sourceLabel: "未確認",
    productionEvidence: "UNAVAILABLE",
    aggregateValuesVisible: false,
    relatedActionsEnabled: false,
  });
}

export function renderWorkforceEvidenceStatus(model = SANITIZED_WORKFORCE_EVIDENCE) {
  const view = validateWorkforceEvidenceModel(model) && HARD_RUNTIME_GATE === false ? model : invalidEvidence();
  return `
    <section class="workforce-evidence-status" data-workforce-evidence-category="${escapeHtml(view.category)}" aria-label="人数・組織集計の算定根拠状態">
      <div class="workforce-evidence-head">
        <div>
          <p class="workforce-evidence-kicker">Workforce Evidence</p>
          <h3>人数・組織集計の算定根拠</h3>
        </div>
        <span class="workforce-evidence-badge">${escapeHtml(view.statusLabel)}</span>
      </div>
      <p class="workforce-evidence-summary">${escapeHtml(view.summary)}</p>
      <dl class="workforce-evidence-facts">
        <div><dt>正本</dt><dd>${escapeHtml(view.sourceLabel)}</dd></div>
        <div><dt>本番証跡</dt><dd>${escapeHtml(view.productionEvidence)}</dd></div>
      </dl>
      <div class="workforce-evidence-action">
        <button type="button" disabled aria-disabled="true" title="算定契約の確定まで利用できません">関連AI・承認</button>
        <span>算定契約と本番証跡が揃うまで無効です。</span>
      </div>
    </section>`;
}

export function mountWorkforceEvidenceStatus(container, model = SANITIZED_WORKFORCE_EVIDENCE) {
  if (!container || typeof container !== "object" || !("innerHTML" in container)) return false;
  container.innerHTML = renderWorkforceEvidenceStatus(model);
  return true;
}
