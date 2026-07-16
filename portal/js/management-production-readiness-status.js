export const MANAGEMENT_PRODUCTION_READINESS_CATEGORIES = Object.freeze([
  "LOCAL_REHEARSAL_PASS",
  "PRODUCTION_EVIDENCE_REQUIRED",
  "RUNTIME_DIGESTS_NULL",
  "WRITE_ACTIONS_DISABLED",
]);

const MODEL_KEYS = Object.freeze(["summary", "items", "actionsEnabled"]);
const ITEM_KEYS = Object.freeze(["category", "label", "state", "detail"]);
const HARD_RUNTIME_GATE = false;

export const SANITIZED_MANAGEMENT_PRODUCTION_READINESS = Object.freeze({
  summary: "ローカルPostgreSQL rehearsalはPASS。本番反映は、production catalog evidenceとprovider runtime identityが揃うまで停止中です。",
  actionsEnabled: false,
  items: Object.freeze([
    Object.freeze({
      category: "LOCAL_REHEARSAL_PASS",
      label: "ローカルDDL rehearsal",
      state: "PASS",
      detail: "forward / verify / rollback / clean を完了",
    }),
    Object.freeze({
      category: "PRODUCTION_EVIDENCE_REQUIRED",
      label: "本番catalog証跡",
      state: "PENDING",
      detail: "Free運用のためread-only証跡は未取得",
    }),
    Object.freeze({
      category: "RUNTIME_DIGESTS_NULL",
      label: "provider runtime identity",
      state: "NOT_READY",
      detail: "version / snapshot / scope / audit は未承認",
    }),
    Object.freeze({
      category: "WRITE_ACTIONS_DISABLED",
      label: "反映・承認・再計算",
      state: "DISABLED",
      detail: "本番DDL/DML/RPC/GRANTは未実行",
    }),
  ]),
});

function exactKeys(value, expected) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const keys = Object.keys(value);
  return keys.length === expected.length && keys.every((key) => expected.includes(key));
}

export function validateManagementProductionReadiness(model) {
  return exactKeys(model, MODEL_KEYS)
    && typeof model.summary === "string"
    && model.summary === SANITIZED_MANAGEMENT_PRODUCTION_READINESS.summary
    && model.actionsEnabled === false
    && Array.isArray(model.items)
    && model.items.length === SANITIZED_MANAGEMENT_PRODUCTION_READINESS.items.length
    && model.items.every((item, index) => {
      const expected = SANITIZED_MANAGEMENT_PRODUCTION_READINESS.items[index];
      return exactKeys(item, ITEM_KEYS)
        && MANAGEMENT_PRODUCTION_READINESS_CATEGORIES.includes(item.category)
        && item.category === expected.category
        && item.label === expected.label
        && item.state === expected.state
        && item.detail === expected.detail;
    });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function fallbackModel() {
  return Object.freeze({
    summary: "本番反映の準備状態を安全に確認できません。反映・承認・再計算は停止しています。",
    actionsEnabled: false,
    items: Object.freeze([
      Object.freeze({
        category: "WRITE_ACTIONS_DISABLED",
        label: "反映・承認・再計算",
        state: "DISABLED",
        detail: "状態確認に失敗したため停止",
      }),
    ]),
  });
}

export function canEnableManagementProductionActions(model = SANITIZED_MANAGEMENT_PRODUCTION_READINESS) {
  return HARD_RUNTIME_GATE === true
    && validateManagementProductionReadiness(model)
    && model.items.every((item) => item.state === "PASS")
    && model.actionsEnabled === true;
}

export function renderManagementProductionReadiness(model = SANITIZED_MANAGEMENT_PRODUCTION_READINESS) {
  const view = validateManagementProductionReadiness(model) && HARD_RUNTIME_GATE === false ? model : fallbackModel();
  const cards = view.items.map((item) => `
    <article class="production-readiness-item" data-production-readiness-category="${escapeHtml(item.category)}">
      <span>${escapeHtml(item.state)}</span>
      <strong>${escapeHtml(item.label)}</strong>
      <p>${escapeHtml(item.detail)}</p>
    </article>`).join("");
  return `
    <section class="production-readiness-panel" aria-label="本番反映準備状態">
      <div class="production-readiness-head">
        <div>
          <p>Production Readiness</p>
          <h3>データ反映までの残タスク</h3>
        </div>
        <button type="button" disabled aria-disabled="true" title="本番証跡とruntime identityが揃うまで利用できません">反映を開始</button>
      </div>
      <p class="production-readiness-summary">${escapeHtml(view.summary)}</p>
      <div class="production-readiness-grid">${cards}</div>
    </section>`;
}

export function mountManagementProductionReadiness(container, model = SANITIZED_MANAGEMENT_PRODUCTION_READINESS) {
  if (!container || typeof container !== "object" || !("innerHTML" in container)) return false;
  container.innerHTML = renderManagementProductionReadiness(model);
  return true;
}
