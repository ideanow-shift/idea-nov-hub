const PROVIDERS = Object.freeze([
  Object.freeze({ label: "版管理", statusLabel: "証跡待ち", reason: "本番カタログの権限確認が未完了です。" }),
  Object.freeze({ label: "スナップショット", statusLabel: "基盤候補済み", reason: "安全な基盤候補は検証済みです。runtime適用は未実施です。" }),
  Object.freeze({ label: "法人範囲", statusLabel: "基盤候補済み", reason: "範囲判定の非破壊基盤候補は検証済みです。runtime適用は未実施です。" }),
  Object.freeze({ label: "対象期間", statusLabel: "基盤候補済み", reason: "対象月と有効期間の非破壊基盤候補は検証済みです。runtime適用は未実施です。" }),
  Object.freeze({ label: "データ所有元", statusLabel: "基盤候補済み", reason: "所有元判定とsnapshot連携の非破壊基盤候補は検証済みです。runtime適用は未実施です。" }),
  Object.freeze({ label: "実行者・監査", statusLabel: "基盤候補済み", reason: "実行者確認と監査記録の非破壊基盤候補は検証済みです。runtime適用は未実施です。" }),
]);

const WORKFLOW = Object.freeze([
  Object.freeze({ label: "ローカル検証", statusLabel: "完了", detail: "forward・確認・rollback・cleanを完了" }),
  Object.freeze({ label: "本番証跡", statusLabel: "保留", detail: "権限リスクの切り分け待ち" }),
  Object.freeze({ label: "分類承認", statusLabel: "停止中", detail: "6提供元の基盤候補を検証済み（うち本番証跡待ち1件）。runtime接続まで操作不可" }),
]);

const APPROVAL_RULES = Object.freeze([
  "レビュー済みの対象だけを扱います",
  "対象は1件から50件まで明示選択します",
  "変更前に版とスナップショットを再確認します",
]);

const CLASSIFICATION_MILESTONES = Object.freeze([
  Object.freeze({ label: "Source基盤", statusLabel: "完了", detail: "6提供元の非破壊基盤候補とrollback境界を検証済み" }),
  Object.freeze({ label: "本番カタログ証跡", statusLabel: "保留", detail: "権限・owner・lock適合性のread-only確認が必要" }),
  Object.freeze({ label: "基盤適用", statusLabel: "未実施", detail: "本番証跡PASS後に別承認で適用" }),
  Object.freeze({ label: "Runtime接続", statusLabel: "未実施", detail: "承認済みprovider identityのみを6件接続" }),
  Object.freeze({ label: "Preflight・承認", statusLabel: "停止中", detail: "対象1〜50件を再解決し、fail-closeで実行" }),
]);

const HARD_RUNTIME_GATE = false;

export const SANITIZED_CLASSIFICATION_READINESS = Object.freeze({
  status: "BLOCKED",
  statusLabel: "準備中",
  summary: "ローカル検証は完了しています。本番証跡と6つの提供元が揃うまで分類承認は安全のため停止します。",
  localRehearsal: "PASS",
  productionCatalogProof: "PENDING",
  providers: PROVIDERS,
  workflow: WORKFLOW,
  approvalRules: APPROVAL_RULES,
  action: Object.freeze({ label: "分類承認", enabled: false, reason: "VERSION_PROVIDER_NOT_READY" }),
});

const MODEL_KEYS = Object.freeze([
  "status",
  "statusLabel",
  "summary",
  "localRehearsal",
  "productionCatalogProof",
  "providers",
  "workflow",
  "approvalRules",
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
  if (model.localRehearsal !== "PASS" || model.productionCatalogProof !== "PENDING") return false;
  if (!Array.isArray(model.providers) || model.providers.length !== PROVIDERS.length) return false;
  if (!model.providers.every((provider, index) => exactKeys(provider, ["label", "statusLabel", "reason"])
    && provider.label === PROVIDERS[index].label
    && provider.statusLabel === PROVIDERS[index].statusLabel
    && provider.reason === PROVIDERS[index].reason)) return false;
  if (!Array.isArray(model.workflow) || model.workflow.length !== WORKFLOW.length) return false;
  if (!model.workflow.every((step, index) => exactKeys(step, ["label", "statusLabel", "detail"])
    && step.label === WORKFLOW[index].label
    && step.statusLabel === WORKFLOW[index].statusLabel
    && step.detail === WORKFLOW[index].detail)) return false;
  if (!Array.isArray(model.approvalRules) || model.approvalRules.length !== APPROVAL_RULES.length) return false;
  if (!model.approvalRules.every((rule, index) => rule === APPROVAL_RULES[index])) return false;
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
    workflow: Object.freeze([]),
    approvalRules: Object.freeze([]),
    action: Object.freeze({ label: "分類承認", enabled: false, reason: "READINESS_INPUT_INVALID" }),
  });
}

export function renderClassificationReadinessPanel(model = SANITIZED_CLASSIFICATION_READINESS) {
  const view = validateSanitizedReadinessModel(model) && HARD_RUNTIME_GATE === false ? model : invalidModel();
  const providerRows = view.providers.map((provider) => `
        <li class="classification-readiness-provider">
          <div><strong>${escapeHtml(provider.label)}</strong><p>${escapeHtml(provider.reason)}</p></div>
          <span class="classification-readiness-state">${escapeHtml(provider.statusLabel)}</span>
        </li>`).join("");
  const workflowRows = view.workflow.map((step, index) => `
        <li class="classification-readiness-step">
          <span class="classification-readiness-step-index">${index + 1}</span>
          <div><strong>${escapeHtml(step.label)}</strong><p>${escapeHtml(step.detail)}</p></div>
          <span class="classification-readiness-step-state">${escapeHtml(step.statusLabel)}</span>
        </li>`).join("");
  const approvalRules = view.approvalRules.map((rule) => `<li>${escapeHtml(rule)}</li>`).join("");

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
      <ol class="classification-readiness-workflow" aria-label="分類承認までの進行状況">${workflowRows}
      </ol>
      <div class="classification-readiness-rules">
        <strong>承認時の安全条件</strong>
        <ul>${approvalRules}</ul>
      </div>
      <div class="classification-readiness-action">
        <button type="button" disabled aria-disabled="true" title="現在は操作できません">${escapeHtml(view.action.label)}</button>
        <span>本番証跡と6つの提供元が揃うと利用できます。</span>
      </div>
    </section>`;
}

export function renderClassificationWorkspace(model = SANITIZED_CLASSIFICATION_READINESS) {
  const view = validateSanitizedReadinessModel(model) && HARD_RUNTIME_GATE === false ? model : invalidModel();
  const milestones = view.status === "BLOCKED" ? CLASSIFICATION_MILESTONES : Object.freeze([]);
  const milestoneRows = milestones.map((milestone, index) => `
        <li class="classification-workspace-step">
          <span class="classification-readiness-step-index">${index + 1}</span>
          <div><strong>${escapeHtml(milestone.label)}</strong><p>${escapeHtml(milestone.detail)}</p></div>
          <span class="classification-readiness-step-state">${escapeHtml(milestone.statusLabel)}</span>
        </li>`).join("");

  return `
    <section class="panel classification-workspace" data-readiness-status="${escapeHtml(view.status)}" aria-labelledby="classificationWorkspaceTitle">
      <div class="panel-head horizontal classification-readiness-head">
        <div>
          <p class="section-label">Classification Workspace</p>
          <h2 id="classificationWorkspaceTitle">分類データを利用するまで</h2>
          <p class="muted-text">安全確認から基盤適用、runtime接続、分類承認までの現在地を確認します。</p>
        </div>
        <span class="classification-readiness-badge">${escapeHtml(view.statusLabel)}</span>
      </div>
      <dl class="classification-workspace-metrics">
        <div><dt>Source基盤候補</dt><dd>6 / 6</dd><span>ローカル検証済み</span></div>
        <div><dt>本番カタログ証跡</dt><dd>${escapeHtml(view.productionCatalogProof)}</dd><span>read-only確認待ち</span></div>
        <div><dt>Runtime接続</dt><dd>0 / 6</dd><span>identity未承認</span></div>
        <div><dt>承認可能件数</dt><dd>0件</dd><span>fail-close停止中</span></div>
      </dl>
      <div class="classification-workspace-notice" role="status">
        <strong>現在の停止理由</strong>
        <p>本番カタログ証跡とruntime provider identityが未完了です。データ取込・分類承認はまだ実行しません。</p>
      </div>
      <ol class="classification-workspace-timeline" aria-label="分類データ利用までの手順">${milestoneRows}
      </ol>
      <div class="classification-readiness-action">
        <button type="button" disabled aria-disabled="true" title="現在は操作できません">${escapeHtml(view.action.label)}</button>
        <span>本番証跡とruntime接続が完了するまで無効です。</span>
      </div>
    </section>`;
}

export function mountClassificationReadinessPanel(root = globalThis.document) {
  const mount = root?.getElementById?.("classificationReadinessPanel");
  if (!mount) return false;
  mount.innerHTML = renderClassificationReadinessPanel();
  return true;
}

export function mountClassificationWorkspace(root = globalThis.document) {
  const mount = root?.getElementById?.("classificationWorkspace");
  if (!mount) return false;
  mount.innerHTML = renderClassificationWorkspace();
  return true;
}

if (typeof document !== "undefined") {
  mountClassificationReadinessPanel(document);
  mountClassificationWorkspace(document);
}
