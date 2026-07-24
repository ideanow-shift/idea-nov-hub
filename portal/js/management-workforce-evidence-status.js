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
  "facts",
]);
const FACT_KEYS = Object.freeze(["label", "value"]);
const HARD_RUNTIME_GATE = false;

export const SANITIZED_WORKFORCE_EVIDENCE = Object.freeze({
  category: "LOCAL_VALIDATED_PENDING_PRODUCTION",
  statusLabel: "社員マスタ確認済み・本番反映待ち",
  summary: "社員マスタを正本として在職・退職・所属部門をローカル集計済みです。退職者月別推移表は退職側の補助証跡として照合対象にします。個人を特定できる項目やセンシティブ項目は表示しません。",
  sourceLabel: "社員マスタ + 退職者月別推移表",
  productionEvidence: "PENDING",
  aggregateValuesVisible: true,
  relatedActionsEnabled: false,
  facts: Object.freeze([
    Object.freeze({ label: "社員マスタ行", value: "431件" }),
    Object.freeze({ label: "在職", value: "190名" }),
    Object.freeze({ label: "退職/退職日あり", value: "241名" }),
    Object.freeze({ label: "所属部門", value: "22区分" }),
    Object.freeze({ label: "退職補助証跡", value: "5シート" }),
    Object.freeze({ label: "本番反映", value: "disabled" }),
  ]),
});

function exactKeys(value, expected) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const keys = Object.keys(value);
  return keys.length === expected.length && keys.every((key) => expected.includes(key));
}

function validateFact(fact) {
  return exactKeys(fact, FACT_KEYS)
    && typeof fact.label === "string"
    && typeof fact.value === "string"
    && fact.label.length >= 1
    && fact.label.length <= 24
    && fact.value.length >= 1
    && fact.value.length <= 32
    && !/(employeeId|employee_id|社員番号|氏名|給与|評価|健康|token|session|digest|sha256)/iu.test(`${fact.label} ${fact.value}`);
}

export function validateWorkforceEvidenceModel(model) {
  return exactKeys(model, MODEL_KEYS)
    && model.category === SANITIZED_WORKFORCE_EVIDENCE.category
    && model.statusLabel === SANITIZED_WORKFORCE_EVIDENCE.statusLabel
    && model.summary === SANITIZED_WORKFORCE_EVIDENCE.summary
    && model.sourceLabel === SANITIZED_WORKFORCE_EVIDENCE.sourceLabel
    && model.productionEvidence === SANITIZED_WORKFORCE_EVIDENCE.productionEvidence
    && model.aggregateValuesVisible === true
    && model.relatedActionsEnabled === false
    && Array.isArray(model.facts)
    && model.facts.length === SANITIZED_WORKFORCE_EVIDENCE.facts.length
    && model.facts.every((fact, index) => validateFact(fact)
      && fact.label === SANITIZED_WORKFORCE_EVIDENCE.facts[index].label
      && fact.value === SANITIZED_WORKFORCE_EVIDENCE.facts[index].value);
}

export function canDisplayWorkforceAggregates(model = SANITIZED_WORKFORCE_EVIDENCE) {
  return HARD_RUNTIME_GATE === true
    && validateWorkforceEvidenceModel(model)
    && model.category === "AUTHORITATIVE_READY"
    && model.aggregateValuesVisible === true;
}

export function localWorkforceAggregateMetric(model = SANITIZED_WORKFORCE_EVIDENCE) {
  if (!validateWorkforceEvidenceModel(model) || model.category !== "LOCAL_VALIDATED_PENDING_PRODUCTION") return null;
  if (model.aggregateValuesVisible !== true) return null;
  const activeFact = model.facts[1];
  return activeFact?.value ? `社員マスタ ${activeFact.value}` : null;
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
    facts: Object.freeze([
      Object.freeze({ label: "状態", value: "UNAVAILABLE" }),
      Object.freeze({ label: "本番反映", value: "disabled" }),
    ]),
  });
}

function renderFacts(facts) {
  return facts.map((fact) => `
        <div><dt>${escapeHtml(fact.label)}</dt><dd>${escapeHtml(fact.value)}</dd></div>`).join("");
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
        <div><dt>本番証跡</dt><dd>${escapeHtml(view.productionEvidence)}</dd></div>${renderFacts(view.facts)}</dl>
      <div class="workforce-evidence-action">
        <button type="button" disabled aria-disabled="true" title="本番反映契約の確定まで利用できません">関連AI・承認</button>
        <span>社員マスタ正本のローカル集計は確認済みです。本番反映・承認・再計算はdisabledです。</span>
      </div>
    </section>`;
}

export function mountWorkforceEvidenceStatus(container, model = SANITIZED_WORKFORCE_EVIDENCE) {
  if (!container || typeof container !== "object" || !("innerHTML" in container)) return false;
  container.innerHTML = renderWorkforceEvidenceStatus(model);
  return true;
}
