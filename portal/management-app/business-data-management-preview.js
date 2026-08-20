import { STORE_MONTHLY_METRICS } from "./dbf-business-data-contract.js";
import { DBF_IMPORT_RUNTIME, buildDbfRawRows, buildDbfSourceArtifact, buildDbfSourceFile } from "./dbf-business-data-runtime.js";
import { bindDbfCanonicalMappings, dbfNormalizedCsvTemplate, parseDbfNormalizedCsv } from "./dbf-business-data-normalized-csv.js";
import { parseClipboardGrid, prepareDbfInput, STORE_METRIC_GROUPS, STORE_METRIC_LABELS, validateOfficialStoreBaseline } from "./dbf-business-data-input-adapter.js";
import { createDbfAccountMappingReview } from "./dbf-account-mapping-review.js";

const FACTS = Object.freeze([
  Object.freeze({ key: "PL", runtimeKey: "pl", view: "pl", label: "法人P/L", statement: "PL", source: "会計担当者が用意した月次P/Lデータ", purpose: "法人の売上・費用・利益を登録します。", required: "法人コード、勘定科目コード、勘定科目名、金額", caution: "対象月と法人が正しいこと、合計行と明細行が混在していないこと" }),
  Object.freeze({ key: "BS", runtimeKey: "bs", view: "bs", label: "法人B/S", statement: "BS", source: "会計担当者が用意した月次B/Sデータ", purpose: "法人の資産・負債・純資産を登録します。", required: "法人コード、勘定科目コード、勘定科目名、金額、区分", caution: "資産と負債・純資産が一致していること" }),
  Object.freeze({ key: "STORE_OPERATING_RESULT", runtimeKey: "store_operating_result", view: "stores", label: "店舗月次実績", statement: "STORE_OPERATING_RESULT", source: "営業部が管理している店舗月次実績データ", purpose: "売上・客数・単価・リピート率・生産性などを登録します。", required: "法人コード、店舗コード、指標コード、値", caution: "対象店舗と対象月が正しいこと、店舗コードが正式マスタと一致すること" }),
  Object.freeze({ key: "BUDGET", runtimeKey: "budget", view: "budget", label: "予算", statement: "BUDGET", source: "経営管理で確定した月次予算データ", purpose: "法人・店舗の月次予算を登録します。", required: "法人コード、必要に応じて店舗コード、予算項目、金額", caution: "実績値ではなく承認済み予算であること" }),
]);

export const BUSINESS_DATA_PREVIEW_FIXTURE = Object.freeze({
  schemaVersion: "dbf-business-data-management-preview-v1",
  fiscalMonth: "2026-06",
  sections: Object.freeze(FACTS.map((fact) => Object.freeze({ key: fact.key, label: fact.label, status: "未登録", rowCount: 0, errors: 0 }))),
  history: Object.freeze([]),
});

export const BUSINESS_DATA_EMPTY_FIXTURE = BUSINESS_DATA_PREVIEW_FIXTURE;

function node(doc, tag, className = "", text = "") {
  const element = doc.createElement(tag);
  if (className) element.className = className;
  if (text) element.textContent = text;
  return element;
}

function option(doc, value, label) {
  const element = node(doc, "option", "", label);
  element.value = value;
  return element;
}

function errorCode(error) {
  return String(error?.message || error || "DBF_RUNTIME_REQUEST_FAILED").replace(/[^A-Z0-9_:-]/gu, "").slice(0, 120);
}

const WORKFLOW_STEPS = Object.freeze([
  Object.freeze({ key: "import", label: "データ取込", target: "pl" }),
  Object.freeze({ key: "validation", label: "データ検証", target: "pl" }),
  Object.freeze({ key: "mapping", label: "法人・店舗の紐付け", target: "pl" }),
  Object.freeze({ key: "account-review", label: "勘定科目確認", target: "account-review" }),
  Object.freeze({ key: "approval", label: "承認", target: "dashboard" }),
  Object.freeze({ key: "promotion", label: "正式データへ反映", target: "dashboard" }),
  Object.freeze({ key: "complete", label: "完了", target: "history" }),
]);

const STATUS_ORDER = Object.freeze({ uploaded: 1, parsed: 1, raw: 1, mapping: 2, quarantined: 2, staged: 3, validated: 3, previewed: 3, approved: 5, promoted: 6, superseded: 6 });
const WORKFLOW_STATUS_LABEL = Object.freeze({ not_started: "未開始", processing: "処理中", needs_attention: "要確認", complete: "完了", error: "エラー" });

export function deriveDbfWorkflowState(items = [], options = {}) {
  const rows = Array.isArray(items) ? items : [];
  const progressByFact = new Map();
  rows.forEach((item) => {
    const factKind = String(item?.factKind || "").toLowerCase();
    progressByFact.set(factKind, Math.max(progressByFact.get(factKind) || 0, STATUS_ORDER[String(item?.status || "").toLowerCase()] || 0));
  });
  const missingFact = FACTS.find((fact) => !progressByFact.has(fact.runtimeKey));
  const allFactsPresent = !missingFact;
  const allFactsValidated = allFactsPresent && FACTS.every((fact) => (progressByFact.get(fact.runtimeKey) || 0) >= 3);
  const max = rows.reduce((value, item) => Math.max(value, STATUS_ORDER[String(item?.status || "").toLowerCase()] || 0), 0);
  const hasErrors = rows.some((item) => Number(item?.errorCount || 0) > 0);
  const hasQuarantine = rows.some((item) => Number(item?.quarantinedCount || 0) > 0 || String(item?.status || "").toLowerCase() === "quarantined");
  const affectedItem = rows.find((item) => Number(item?.errorCount || 0) > 0 || Number(item?.quarantinedCount || 0) > 0 || String(item?.status || "").toLowerCase() === "quarantined");
  const affectedFact = FACTS.find((fact) => fact.runtimeKey === String(affectedItem?.factKind || "").toLowerCase());
  const reviewComplete = options.reviewComplete === true;
  const preflightReady = options.preflightReady === true;
  const steps = WORKFLOW_STEPS.map((step, index) => {
    let state = "not_started";
    if (index === 0 && rows.length && !allFactsPresent) state = "needs_attention";
    if (index === 0 && allFactsPresent) state = "complete";
    if (index === 1 && rows.length && !allFactsValidated && !hasErrors) state = "processing";
    if (index === 1 && hasErrors) state = "error";
    if (index === 1 && allFactsValidated && !hasErrors) state = "complete";
    if (index === 2 && hasQuarantine) state = "needs_attention";
    if (index === 2 && allFactsValidated && !hasQuarantine) state = "complete";
    if (index === 3 && allFactsValidated && !reviewComplete) state = "needs_attention";
    if (index === 3 && reviewComplete) state = "complete";
    if (index === 4 && reviewComplete && max < 5) state = "needs_attention";
    if (index === 4 && max >= 5) state = "complete";
    if (index === 5 && max >= 5 && max < 6) state = preflightReady ? "needs_attention" : "not_started";
    if (index === 5 && max >= 6) state = "complete";
    if (index === 6 && max >= 6) state = "complete";
    return { ...step, state };
  });
  const firstPending = steps.find((step) => step.state !== "complete");
  const blocked = hasErrors || hasQuarantine || (firstPending?.key === "approval" && !preflightReady);
  return {
    steps,
    blocked,
    nextAction: hasErrors ? "データ検証のエラーを修正してください" : hasQuarantine ? "法人・店舗の紐付けが必要なデータを確認してください" : missingFact ? `${missingFact.label}ファイルを登録してください` : firstPending ? `${firstPending.label}へ進んでください` : "今月のデータ処理は完了しました",
    nextTarget: (hasErrors || hasQuarantine) ? (affectedFact?.view || "pl") : missingFact?.view || firstPending?.target || "history",
  };
}

export function safeDbfManagementError(error) {
  const code = errorCode(error);
  const messages = {
    DBF_STAGING_SESSION_REQUIRED: "Staging Sessionを確認してください。NOV HUBの正式Launcherから開き直せます。",
    UNAUTHORIZED: "認証を確認できませんでした。NOV HUBから再度開いてください。",
    FORBIDDEN: "経営データ管理権限がありません。",
    COMPANY_SCOPE_REJECTED: "対象法人を確認できませんでした。対象月と法人の選択条件を確認してください。",
    DBF_ACCOUNT_REVIEW_ALREADY_FINAL: "この候補は既に最終判断済みです。再読込して最新状態を確認してください。",
    DBF_IMPORT_REQUEST_DUPLICATE: "同じ操作は既に受け付け済みです。履歴から結果を確認してください。",
    DBF_DUPLICATE_REVIEW_REQUEST: "同じ判断は既に受け付け済みです。最新状態を再読込してください。",
    CORRECTION_NO_CHANGES: "変更内容がありません。訂正する値またはデータ状態を確認してください。",
  };
  return { code, message: messages[code] || "処理を完了できませんでした。時間をおいて再度お試しください。", retryable: !new Set(["FORBIDDEN", "COMPANY_SCOPE_REJECTED"]).has(code) };
}

function appendScreenGuide(doc, panel, title, purpose, condition, action) {
  const details = node(doc, "details", "dbf-screen-guide");
  const summary = node(doc, "summary", "", "この画面は何をするところ？");
  const body = node(doc, "div", "dbf-screen-guide-body");
  body.append(node(doc, "strong", "", title), node(doc, "p", "", purpose), node(doc, "p", "", `次に進める条件：${condition}`), node(doc, "p", "", `次にやること：${action}`));
  details.append(summary, body);
  panel.prepend(details);
}

function renderSafeError(doc, container, error, actionLabel = "再度確認する") {
  const safe = safeDbfManagementError(error);
  container.replaceChildren();
  container.className = "dbf-business-error";
  container.setAttribute("role", "alert");
  container.tabIndex = -1;
  container.append(node(doc, "strong", "", safe.message), node(doc, "p", "", `対応：${safe.retryable ? actionLabel : "管理者へお問い合わせください"}`));
  const detail = node(doc, "details", "dbf-technical-detail");
  detail.append(node(doc, "summary", "", "技術情報を表示"), node(doc, "code", "", safe.code));
  container.append(detail);
  container.focus();
  return safe;
}

function runtimeEnabled(options) {
  const runtime = options.runtime || globalThis.window?.__DBF_RUNTIME__ || {};
  return runtime.environment === "staging"
    && runtime.projectRef === "zgkoofphhivesclehrom"
    && runtime.runtimeImport === "ENABLED"
    && runtime.productionWrite === "DISABLED";
}

function createStatus(doc) {
  const status = node(doc, "div", "business-data-runtime-status", "ファイル未選択");
  status.setAttribute("role", "status");
  return status;
}

function parserReceipt(fact) {
  return {
    statement: fact.statement,
    status: "PARSED",
    balanceCheck: fact.runtimeKey === "bs" ? "BALANCED" : null,
    parserVersion: "dbf-normalized-csv-v1",
  };
}

function correctionSignature(rows) {
  return (Array.isArray(rows) ? rows : []).map(({ sourceRowNumber: _sourceRowNumber, ...row }) => JSON.stringify(row, Object.keys(row).sort())).sort().join("\n");
}

function renderHistoryItems(list, items, onCorrection = null) {
  list.replaceChildren();
  if (!items.length) {
    list.append(node(list.ownerDocument, "li", "", "未登録（0件は正常状態です）"));
    return;
  }
  items.forEach((item) => {
    const fact = FACTS.find((entry) => entry.runtimeKey === item.factKind);
    const statusLabel = ({ promoted: "現在の正式データ", superseded: "訂正前データ", approved: "承認済み", validated: "検証済み", quarantined: "要確認" })[item.status] || item.status;
    const entry = node(list.ownerDocument, "li", "business-data-history-item");
    entry.append(node(list.ownerDocument, "strong", "", `${item.fiscalMonth} / ${fact?.label || item.factKind}`), node(list.ownerDocument, "span", "", `${statusLabel}・${item.rowCount}行${item.errorCount ? `・修正が必要 ${item.errorCount}件` : ""}`));
    const detail = node(list.ownerDocument, "details", "dbf-technical-detail");
    detail.append(node(list.ownerDocument, "summary", "", "内容を見る"), node(list.ownerDocument, "p", "", `${item.fiscalMonth} ${fact?.label || item.factKind} / Revision ${item.revision}`), node(list.ownerDocument, "code", "", `batch=${item.batchId}`));
    entry.append(detail);
    if (typeof onCorrection === "function" && item.status === "promoted" && FACTS.some((entry) => entry.runtimeKey === item.factKind)) {
      const correction = node(list.ownerDocument, "button", "business-data-secondary-action", "訂正として登録");
      correction.type = "button";
      correction.addEventListener("click", async () => {
        correction.disabled = true;
        try { await onCorrection(item); } finally { correction.disabled = false; }
      });
      entry.append(correction);
    }
    list.append(entry);
  });
}

function updateDashboardCards(cards, items) {
  for (const fact of FACTS) {
    const card = cards.get(fact.key);
    const matching = items.filter((item) => item.factKind === fact.runtimeKey);
    const active = matching.find((item) => item.status === "promoted") || matching[0];
    const needsAttention = Number(active?.errorCount || 0) > 0 || Number(active?.quarantinedCount || 0) > 0 || active?.status === "quarantined";
    const status = needsAttention ? "要確認" : active ? (({ promoted: "登録済み", approved: "承認済み", validated: "確認済み", previewed: "確認中" })[active.status] || "取込中") : "未登録";
    card.dataset.dbfState = needsAttention ? "attention" : active ? "registered" : "missing";
    card.querySelector("[data-dbf-status]").textContent = status;
    card.querySelector("[data-dbf-count]").textContent = active ? `${active.rowCount}行を登録済み` : "まだデータが登録されていません";
    card.querySelector("[data-dbf-errors]").textContent = needsAttention ? `確認が必要：${Number(active?.errorCount || active?.quarantinedCount || 0)}件` : "確認事項なし";
  }
}

function formatCount(value) {
  return new Intl.NumberFormat("ja-JP").format(Number(value || 0));
}

function formatYen(value) {
  return `${new Intl.NumberFormat("ja-JP").format(Number(value || 0))}円`;
}

function appendDefinition(doc, container, label, value, status = "") {
  const row = node(doc, "div", `business-data-pilot-definition${status ? ` is-${status}` : ""}`);
  row.append(node(doc, "dt", "", label), node(doc, "dd", "", String(value)));
  container.append(row);
}

function renderPilotMonthPreview(container, data) {
  container.replaceChildren();
  if (!data || data.pilotMonth !== "2026-06") {
    container.hidden = true;
    return;
  }
  container.hidden = false;
  container.dataset.pilotPreviewReady = String(data.sourceStatus === "READY_FOR_OWNER_PREVIEW");

  const doc = container.ownerDocument;
  container.append(node(doc, "summary", "business-data-pilot-summary-toggle", "詳細な取込状況を表示"));
  const header = node(doc, "div", "business-data-pilot-header");
  const heading = node(doc, "div");
  heading.append(node(doc, "p", "eyebrow", "パイロット月・参照専用プレビュー"), node(doc, "h3", "", `対象月 ${data.pilotMonth}`));
  const status = node(doc, "strong", `business-data-pilot-status ${data.sourceStatus === "READY_FOR_OWNER_PREVIEW" ? "is-ready" : "is-mismatch"}`,
    data.sourceStatus === "READY_FOR_OWNER_PREVIEW" ? "プレビュー接続済み" : "基準情報が一致しません");
  header.append(heading, status);
  container.append(header);

  const identity = node(doc, "dl", "business-data-pilot-definitions");
  appendDefinition(doc, identity, "データ提供責任者", data.sourceOwner);
  appendDefinition(doc, identity, "会計確定状態", data.accountingStatus);
  appendDefinition(doc, identity, "読取仕様", data.parserContract);
  appendDefinition(doc, identity, "管理境界", "経営データ管理 管理者専用");
  container.append(identity);

  const summary = node(doc, "div", "business-data-pilot-summary");
  [
    ["取込ファイル", `${formatCount(data.summary?.sourceFiles)}件`],
    ["取込単位", `${formatCount(data.summary?.importBatches)}件`],
    ["読取行", `${formatCount(data.summary?.rawRows)}件`],
    ["検証対象行", `${formatCount(data.summary?.stagingRows)}件`],
    ["検証エラー", `${formatCount(data.summary?.errors)}件`],
    ["警告", `${formatCount(data.summary?.warnings)}件`],
    ["正式反映候補", `${formatCount(data.summary?.promotionCandidates)}件`],
    ["正式データ書込", `${formatCount(data.summary?.canonicalFactWrites)}件`],
  ].forEach(([label, value]) => {
    const card = node(doc, "article", "business-data-pilot-summary-card");
    card.append(node(doc, "span", "", label), node(doc, "strong", "", value));
    summary.append(card);
  });
  container.append(summary);

  const details = node(doc, "div", "business-data-pilot-detail-grid");
  const pl = node(doc, "section", "business-data-pilot-detail-card");
  pl.append(node(doc, "h4", "", "P/L取込内容"));
  const plList = node(doc, "dl", "business-data-pilot-definitions");
  appendDefinition(doc, plList, "PDF P/L", `${formatCount(data.pl?.pdfRows)}件`);
  appendDefinition(doc, plList, "Excel P/L", `${formatCount(data.pl?.excelRows)}件`);
  appendDefinition(doc, plList, "照合結果", data.pl?.reconciliation, data.pl?.reconciliation === "PASS" ? "pass" : "warning");
  appendDefinition(doc, plList, "総売上", formatYen(data.pl?.controlTotals?.totalSales));
  appendDefinition(doc, plList, "技術売上", formatYen(data.pl?.controlTotals?.technicalSales));
  appendDefinition(doc, plList, "商品売上", formatYen(data.pl?.controlTotals?.retailSales));
  appendDefinition(doc, plList, "EC売上", formatYen(data.pl?.controlTotals?.ecSales));
  appendDefinition(doc, plList, "経常損益", formatYen(data.pl?.controlTotals?.ordinaryProfit));
  pl.append(plList);

  const bs = node(doc, "section", "business-data-pilot-detail-card");
  bs.append(node(doc, "h4", "", "B/S取込内容"));
  const bsList = node(doc, "dl", "business-data-pilot-definitions");
  appendDefinition(doc, bsList, "行数", `${formatCount(data.bs?.rows)}件`);
  appendDefinition(doc, bsList, "貸借一致", data.bs?.balance, data.bs?.balance === "PASS" ? "pass" : "warning");
  appendDefinition(doc, bsList, "資産", formatYen(data.bs?.assets));
  appendDefinition(doc, bsList, "負債", formatYen(data.bs?.liabilities));
  appendDefinition(doc, bsList, "純資産", formatYen(data.bs?.equity));
  appendDefinition(doc, bsList, "差額", formatYen(data.bs?.difference), Number(data.bs?.difference) === 0 ? "pass" : "warning");
  bs.append(bsList);

  const budget = node(doc, "section", "business-data-pilot-detail-card");
  budget.append(node(doc, "h4", "", "予算取込内容"));
  const budgetList = node(doc, "dl", "business-data-pilot-definitions");
  appendDefinition(doc, budgetList, "行数", `${formatCount(data.budget?.rows)}件`);
  appendDefinition(doc, budgetList, "法人", `${formatCount(data.budget?.corporationRows)}件`);
  appendDefinition(doc, budgetList, "店舗", `${formatCount(data.budget?.storeRows)}件`);
  appendDefinition(doc, budgetList, "提供元確認", data.budget?.sourceConfirmation, "pass");
  appendDefinition(doc, budgetList, "予算内容確認", data.budget?.confirmation, "warning");
  appendDefinition(doc, budgetList, "予算承認", data.budget?.approval, "warning");
  budget.append(budgetList);

  const mapping = node(doc, "section", "business-data-pilot-detail-card");
  mapping.append(node(doc, "h4", "", "紐付け・監査"));
  const mappingList = node(doc, "dl", "business-data-pilot-definitions");
  appendDefinition(doc, mappingList, "完全一致", formatCount(data.mapping?.exact));
  appendDefinition(doc, mappingList, "法人の紐付け", formatCount(data.mapping?.companyBindings));
  appendDefinition(doc, mappingList, "店舗の紐付け", formatCount(data.mapping?.storeBindings));
  appendDefinition(doc, mappingList, "監査済み", formatCount(data.mapping?.auditPages?.exact));
  appendDefinition(doc, mappingList, "未解決", formatCount(data.mapping?.auditPages?.unresolved), "warning");
  appendDefinition(doc, mappingList, "隔離中", formatCount(data.mapping?.auditPages?.quarantined), "warning");
  mapping.append(mappingList);
  details.append(pl, bs, budget, mapping);
  container.append(details);

  const warnings = node(doc, "section", "business-data-pilot-section");
  warnings.append(node(doc, "h4", "", `警告 ${formatCount(data.validation?.warnings)}件`));
  const warningList = node(doc, "ul", "business-data-pilot-warning-list");
  (data.validation?.categories || []).forEach((item) => {
    const entry = node(doc, "li");
    entry.append(node(doc, "strong", "", item.category), node(doc, "span", "", `${item.status} / ${item.detail}`));
    warningList.append(entry);
  });
  warnings.append(warningList);
  container.append(warnings);

  const gates = node(doc, "div", "business-data-pilot-detail-grid");
  const precedence = node(doc, "section", "business-data-pilot-detail-card");
  precedence.append(node(doc, "h4", "", "データ提供元の優先順位確認"));
  const precedenceList = node(doc, "dl", "business-data-pilot-definitions");
  appendDefinition(doc, precedenceList, "重複候補", formatCount(data.sourcePrecedence?.overlappingCandidateCount));
  appendDefinition(doc, precedenceList, "選択した提供元", data.sourcePrecedence?.selectedSource);
  appendDefinition(doc, precedenceList, "対象外の提供元", data.sourcePrecedence?.excludedSource);
  appendDefinition(doc, precedenceList, "理由", data.sourcePrecedence?.precedenceReason);
  appendDefinition(doc, precedenceList, "正式データの単位", (data.sourcePrecedence?.canonicalGrain || []).join(" + "));
  appendDefinition(doc, precedenceList, "重複反映", formatCount(data.sourcePrecedence?.duplicatePromotionCount), "pass");
  precedence.append(precedenceList);

  const tax = node(doc, "section", "business-data-pilot-detail-card");
  tax.append(node(doc, "h4", "", "税区分確認"), node(doc, "p", "business-data-pilot-gate-status", data.taxBasis?.status));
  const taxList = node(doc, "dl", "business-data-pilot-definitions");
  (data.taxBasis?.groups || []).forEach((item) => appendDefinition(doc, taxList, item.basis, `${formatCount(item.rows)}件 / ${item.source}`));
  tax.append(taxList);
  gates.append(precedence, tax);
  container.append(gates);

  const promotion = node(doc, "button", "business-data-danger-action business-data-disabled-action", "正式データへの反映は無効です（責任者承認待ち）");
  promotion.type = "button";
  promotion.disabled = true;
  promotion.dataset.pilotPromotion = "disabled";
  container.append(promotion);
}

function renderMappingRows(doc, state, container, refresh) {
  container.replaceChildren();
  if (!state.unresolved.length) {
    container.append(node(doc, "p", "business-data-ok", "法人・店舗の紐付けはすべて解決済みです。"));
    return;
  }
  container.append(node(doc, "h4", "", "未解決の紐付け（責任者の確認が必要）"));
  for (const mapping of state.unresolved) {
    const row = node(doc, "div", "business-data-mapping-row");
    row.append(node(doc, "span", "", `${mapping.entityType === "company" ? "法人" : "店舗"}: ${mapping.sourceKey}`));
    const select = node(doc, "select", "business-data-mapping-select");
    select.append(option(doc, "", "正式マスタを選択"));
    let candidates = mapping.entityType === "company" ? state.masterOptions.companies : state.masterOptions.stores;
    let companyCanonicalId = null;
    if (mapping.entityType === "store") {
      const companyKeys = [...new Set(state.parsed.rows.filter((item) => item.storeKey === mapping.sourceKey).map((item) => item.companyKey))];
      if (companyKeys.length === 1) {
        const companyMapping = state.mappings.find((item) => item.entityType === "company" && item.sourceKey === companyKeys[0] && item.status === "active");
        companyCanonicalId = companyMapping?.canonicalId || null;
        candidates = companyCanonicalId ? candidates.filter((item) => item.companyId === companyCanonicalId) : [];
      } else {
        candidates = [];
      }
    }
    candidates.forEach((item) => select.append(option(doc, item.id, `${item.code} / ${item.name}`)));
    const confirm = node(doc, "button", "business-data-action", "紐付けを確定");
    confirm.type = "button";
    confirm.disabled = candidates.length === 0;
    confirm.addEventListener("click", async () => {
      if (!select.value) return;
      confirm.disabled = true;
      try {
        await DBF_IMPORT_RUNTIME.confirmMapping({
          batchId: state.batchId,
          sourceSystem: state.sourceSystem,
          entityType: mapping.entityType,
          sourceKey: mapping.sourceKey,
          canonicalId: select.value,
          companyCanonicalId: mapping.entityType === "store" ? companyCanonicalId : null,
        });
        await refresh();
      } catch (error) {
        state.status.textContent = `紐付けを確定できませんでした。詳細: ${errorCode(error)}`;
        confirm.disabled = false;
      }
    });
    row.append(select, confirm);
    container.append(row);
  }
}

function createManualEditor(doc, fact, enabled) {
  const root = node(doc, "section", "dbf-manual-editor");
  root.hidden = true;
  const note = node(doc, "p", "dbf-manual-note", "入力途中の値はこのページ内だけに保持されます。ブラウザには保存しません。");
  const body = node(doc, "div", "dbf-manual-body");
  root.append(note, body);
  let masters = { companies: [], stores: [] };
  let activeGroup = STORE_METRIC_GROUPS[0];
  const storeDraft = new Map();
  let confirmationStatus = "";
  let tabularDraft = [];

  const input = (field, type = "text") => { const control = node(doc, "input", "dbf-manual-input"); control.type = type; control.dataset.field = field; control.disabled = !enabled; return control; };
  const select = (field, values) => { const control = node(doc, "select", "dbf-manual-input"); control.dataset.field = field; control.disabled = !enabled; values.forEach(([value, label]) => control.append(option(doc, value, label))); return control; };
  const masterSelect = (field, values, optionalValue = false) => select(field, [["", optionalValue ? "指定なし" : "選択してください"], ...values.map((item) => [item.code, item.name])]);

  const render = () => {
    body.replaceChildren();
    const companyValues = masters.companies || [];
    const storeValues = (masters.stores || []).filter((item) => item.code !== "honbu" && item.name !== "本部");
    if (fact.runtimeKey === "store_operating_result") {
      const statusField = node(doc, "fieldset", "dbf-confirmation-status");
      statusField.append(node(doc, "legend", "", "データ状態（必須）"));
      [
        ["confirmed", "確定値", "Store Operationsの正式データとして利用します"],
        ["provisional", "暫定値", "DBFには保存されますが、Store Operationsの正式実績にはまだ表示されません"],
      ].forEach(([value, label, description]) => {
        const choice = node(doc, "label", "dbf-confirmation-choice");
        const control = node(doc, "input");
        control.type = "radio";
        control.name = "store-operating-result-confirmation-status";
        control.value = value;
        control.checked = confirmationStatus === value;
        control.disabled = !enabled;
        control.addEventListener("change", () => { confirmationStatus = value; });
        const copy = node(doc, "span");
        copy.append(node(doc, "strong", "", label), node(doc, "small", "", description));
        choice.append(control, copy);
        statusField.append(choice);
      });
      const tabs = node(doc, "div", "dbf-manual-tabs");
      STORE_METRIC_GROUPS.forEach((group) => { const button = node(doc, "button", `dbf-manual-tab${group.key === activeGroup.key ? " is-active" : ""}`, group.label); button.type = "button"; button.addEventListener("click", () => { activeGroup = group; render(); }); tabs.append(button); });
      const help = node(doc, "p", "dbf-manual-rate-help", "率は「71%」の場合は71と入力してください（0〜100）。");
      const table = node(doc, "table", "dbf-manual-grid");
      const head = node(doc, "tr"); head.append(node(doc, "th", "", "店舗"), ...activeGroup.metrics.map((metric) => node(doc, "th", "", STORE_METRIC_LABELS[metric])));
      const thead = node(doc, "thead"); thead.append(head); const tbody = node(doc, "tbody");
      storeValues.forEach((store) => { const row = node(doc, "tr"); row.dataset.storeKey = store.code; row.dataset.companyKey = companyValues.find((item) => item.id === store.companyId)?.code || store.companyCode || ""; row.append(node(doc, "th", "", store.name)); activeGroup.metrics.forEach((metric) => { const cell = node(doc, "td"); const control = input(metric, "number"); control.dataset.metricCode = metric; control.step = "any"; control.value = storeDraft.get(`${store.code}:${metric}`) || ""; control.addEventListener("input", () => storeDraft.set(`${store.code}:${metric}`, control.value)); cell.append(control); row.append(cell); }); tbody.append(row); });
      table.append(thead, tbody);
      table.addEventListener("paste", (event) => { event.preventDefault(); try { const grid = parseClipboardGrid(event.clipboardData?.getData("text/plain"), storeValues.length, activeGroup.metrics.length); if (!globalThis.confirm?.(`${grid.length}行 × ${grid[0].length}列を貼り付けますか？`)) return; const InputEvent = doc.defaultView?.Event || globalThis.Event; [...tbody.rows].forEach((row, rowIndex) => [...row.querySelectorAll("input")].forEach((control, columnIndex) => { control.value = grid[rowIndex][columnIndex]; storeDraft.set(`${row.dataset.storeKey}:${control.dataset.metricCode}`, control.value); if (InputEvent) control.dispatchEvent(new InputEvent("input", { bubbles: true })); })); } catch { globalThis.alert?.("行数または列数が一致しないため貼り付けませんでした。"); } });
      body.append(statusField, tabs, help, table);
      return;
    }
    const table = node(doc, "table", "dbf-manual-grid"); const thead = node(doc, "thead"); const head = node(doc, "tr");
    const fields = fact.runtimeKey === "budget" ? ["法人", "店舗", "scenario", "勘定科目コード", "指標", "金額", "データ状態"] : fact.runtimeKey === "bs" ? ["法人", "勘定科目コード", "勘定科目名", "金額", "区分", "データ状態"] : ["法人", "店舗", "勘定科目コード", "勘定科目名", "金額", "detail / aggregate", "aggregate scope", "データ状態"];
    fields.forEach((label) => head.append(node(doc, "th", "", label))); thead.append(head); const tbody = node(doc, "tbody"); table.append(thead, tbody);
    const addRow = (source = {}) => { const row = node(doc, "tr"); row.append((() => { const td=node(doc,"td"); const control=masterSelect("companyKey", companyValues); control.value=source.companyKey || ""; td.append(control); return td; })()); if (fact.runtimeKey !== "bs") { const td=node(doc,"td"); const control=masterSelect("storeKey", storeValues, true); control.value=source.storeKey || ""; td.append(control); row.append(td); }
      const specs = fact.runtimeKey === "budget" ? [["scenarioCode"],["accountCode"],["metricCode"],["amount","number"],["confirmationStatus","confirmation"]] : fact.runtimeKey === "bs" ? [["accountCode"],["accountName"],["amount","number"],["classification","select"],["confirmationStatus","confirmation"]] : [["accountCode"],["accountName"],["amount","number"],["sourceRowCategory","category"],["aggregateScope"],["confirmationStatus","confirmation"]];
      specs.forEach(([field,type]) => { const td=node(doc,"td"); const control = type === "select" ? select(field, [["asset","資産"],["liability","負債"],["equity","純資産"]]) : type === "category" ? select(field, [["detail","明細"],["aggregate","集計"]]) : type === "confirmation" ? select(field, [["confirmed","確定値"],["provisional","暫定値"]]) : input(field,type); control.value=source[field] ?? (field === "confirmationStatus" ? "confirmed" : ""); td.append(control); row.append(td); }); tbody.append(row); };
    (tabularDraft.length ? tabularDraft : [{}]).forEach(addRow);
    if (fact.runtimeKey === "budget") table.addEventListener("paste", (event) => { event.preventDefault(); try { const controls = [...tbody.rows].map((row) => [...row.querySelectorAll("[data-field]")]); const grid = parseClipboardGrid(event.clipboardData?.getData("text/plain"), controls.length, fields.length); if (!globalThis.confirm?.(`${grid.length}行 × ${grid[0].length}列を貼り付けますか？`)) return; controls.forEach((row, rowIndex) => row.forEach((control, columnIndex) => { control.value = grid[rowIndex][columnIndex]; })); } catch { globalThis.alert?.("行数または列数が一致しないため貼り付けませんでした。"); } });
    const add = node(doc, "button", "business-data-secondary-action", "＋ 行を追加"); add.type = "button"; add.addEventListener("click", addRow); body.append(table, add);
  };
  render();
  return {
    root,
    setMasterOptions(value) { masters = value || masters; render(); },
    prefillStoreRows(rows) {
      storeDraft.clear();
      confirmationStatus = "";
      (Array.isArray(rows) ? rows : []).forEach((row) => storeDraft.set(`${row.storeKey}:${row.metricCode}`, String(row.value)));
      render();
    },
    prefillRows(rows) {
      tabularDraft = Array.isArray(rows) ? rows.map((row) => ({ ...row })) : [];
      render();
    },
    confirmationStatus() { return confirmationStatus; },
    rows() {
      if (fact.runtimeKey === "store_operating_result") return (masters.stores || []).filter((store) => store.code !== "honbu" && store.name !== "本部").flatMap((store) => Object.keys(STORE_METRIC_LABELS).filter((metric) => String(storeDraft.get(`${store.code}:${metric}`) || "").trim() !== "").map((metric) => ({ companyKey: (masters.companies || []).find((item) => item.id === store.companyId)?.code || store.companyCode || "", storeKey: store.code, metricCode: metric, value: storeDraft.get(`${store.code}:${metric}`), definitionVersion: "v1", confirmationStatus })));
      return [...body.querySelectorAll("tbody tr")].map((row) => Object.fromEntries([...row.querySelectorAll("[data-field]")].map((control) => [control.dataset.field, control.value]))).filter((row) => Object.values(row).some(Boolean));
    },
  };
}

function renderImportPanel(doc, fact, enabled, onHistoryChanged, onBack) {
  const panel = node(doc, "section", "business-data-preview-panel");
  panel.dataset.businessDataPanel = fact.view;
  panel.hidden = true;
  panel.append(node(doc, "p", "eyebrow", "ファイルを追加"), node(doc, "h3", "", `${fact.label}を登録`));
  const back = node(doc, "button", "business-data-secondary-action", "← データ種別を選び直す");
  back.type = "button";
  back.addEventListener("click", onBack);
  panel.append(back);
  appendScreenGuide(doc, panel, `${fact.label}の登録`, fact.purpose, "ファイルの検証エラーと未確認の紐付けが0件になること", "下の5ステップに沿ってファイルを登録してください");
  const sourceGuide = node(doc, "section", "dbf-file-guide");
  sourceGuide.append(node(doc, "h4", "", "使用するデータ"), node(doc, "p", "", fact.source), node(doc, "p", "", `用途：${fact.purpose}`));
  const sourceHelp = node(doc, "details", "dbf-file-help");
  sourceHelp.append(node(doc, "summary", "", "ファイルの準備方法を見る"));
  const helpList = node(doc, "dl", "dbf-file-help-list");
  [["データの取得元", fact.source], ["対象月", "画面で選択した1か月"], ["対応ファイル形式", "DBF標準CSV（UTF-8）"], ["必須項目", fact.required], ["よくある間違い", fact.caution], ["取込前の確認", "ファイル名・対象月・法人／店舗コード・行数を確認してください"]].forEach(([label, value]) => appendDefinition(doc, helpList, label, value));
  sourceHelp.append(helpList);
  sourceGuide.append(sourceHelp);
  const guard = node(doc, "p", "business-data-runtime-guard", enabled
    ? "Stagingに接続済みです。承認と正式データへの反映は、内容確認後に別途実行します。"
    : "現在は登録操作を利用できません。表示内容のみ確認できます。");
  panel.append(guard);
  if (fact.runtimeKey === "store_operating_result") panel.append(node(doc, "p", "business-data-metric-count", `登録対象：売上・客数・単価・リピート率・生産性など ${Object.keys(STORE_MONTHLY_METRICS).length}指標`));

  const controls = node(doc, "div", "business-data-import-controls dbf-import-wizard");
  const step1 = node(doc, "section", "dbf-import-wizard-step");
  step1.append(node(doc, "span", "dbf-import-step-number", "STEP 1"), node(doc, "h4", "", "何のデータを登録しますか？"), node(doc, "strong", "", fact.label), node(doc, "p", "", fact.purpose));
  const step2 = node(doc, "section", "dbf-import-wizard-step");
  step2.append(node(doc, "span", "dbf-import-step-number", "STEP 2"), node(doc, "h4", "", "対象月を選択"));
  const month = node(doc, "input", "business-data-month");
  month.type = "month";
  month.value = "2026-06";
  month.disabled = !enabled;
  month.setAttribute("aria-label", `${fact.label}の対象月`);
  step2.append(month);
  const step3 = node(doc, "section", "dbf-import-wizard-step");
  step3.append(node(doc, "span", "dbf-import-step-number", "STEP 3"), node(doc, "h4", "", "入力方法を選択してください"));
  const method = node(doc, "div", "dbf-input-methods");
  const csvMethod = node(doc, "button", "business-data-action is-selected", "CSVから取り込む"); csvMethod.type = "button";
  const manualMethod = node(doc, "button", "business-data-secondary-action", "画面で直接入力"); manualMethod.type = "button";
  method.append(csvMethod, manualMethod); step3.append(method, node(doc, "p", "", "CSVの場合は使用するファイルを確認してください。"), sourceGuide);
  const step4 = node(doc, "section", "dbf-import-wizard-step");
  step4.append(node(doc, "span", "dbf-import-step-number", "STEP 4"), node(doc, "h4", "", "ファイルを選択"), node(doc, "p", "", "対応形式：DBF標準CSV（UTF-8）"));
  const file = node(doc, "input", "business-data-file");
  file.type = "file";
  file.accept = ".csv,text/csv";
  file.disabled = !enabled;
  file.setAttribute("aria-label", `${fact.label}のCSVファイルを選択`);
  const template = node(doc, "button", "business-data-secondary-action", "対応CSVテンプレートをダウンロード");
  template.type = "button";
  template.disabled = !enabled;
  template.addEventListener("click", () => {
    const url = URL.createObjectURL(new Blob(["\uFEFF", dbfNormalizedCsvTemplate(fact.runtimeKey)], { type: "text/csv;charset=utf-8" }));
    const anchor = node(doc, "a");
    anchor.href = url;
    anchor.download = `dbf-${fact.runtimeKey}-${month.value || "YYYY-MM"}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  });
  step4.append(file, template);
  const manualEditor = createManualEditor(doc, fact, enabled);
  step4.append(manualEditor.root);
  const step5 = node(doc, "section", "dbf-import-wizard-step");
  step5.append(node(doc, "span", "dbf-import-step-number", "STEP 5"), node(doc, "h4", "", "取込前確認"));
  const confirmation = node(doc, "dl", "dbf-import-confirmation");
  let selectedRowCount = "ファイル選択後に確認します";
  let sourceType = "csv_upload";
  let correctionBaseline = null;
  const correctionPreview = node(doc, "div", "dbf-correction-preview");
  const updateConfirmation = () => {
    confirmation.replaceChildren();
    const manualRows = sourceType === "manual_entry" ? manualEditor.rows() : [];
    const confirmationLabel = fact.runtimeKey !== "store_operating_result"
      ? null
      : sourceType === "manual_entry"
        ? ({ confirmed: "確定値 — Store Operationsの正式表示対象", provisional: "暫定値 — Store Operationsの正式表示対象外" })[manualEditor.confirmationStatus()] || "未選択（選択が必要です）"
        : "CSV内のconfirmation_statusを取込前検証で確認";
    [["データ種類", fact.label], ["対象月", month.value || "未選択"], ["入力方法", sourceType === "manual_entry" ? "画面で直接入力" : "CSVから取り込む"], ["ファイル名", sourceType === "manual_entry" ? "監査用Source Artifactを自動生成" : file.files?.[0]?.name || "未選択"], ["行数", sourceType === "manual_entry" ? `${manualRows.length}行` : selectedRowCount], ["対象店舗数", sourceType === "manual_entry" ? `${new Set(manualRows.map((row) => row.storeKey).filter(Boolean)).size}店舗` : "CSV検証時に確認"], ...(confirmationLabel ? [["データ状態", confirmationLabel]] : []), ["未入力セル", sourceType === "manual_entry" && manualRows.length === 0 ? "入力が必要です" : "取込前検証で確認"], ["Error / Warning", "取込前検証で確認"], ["注意事項", fact.caution]].forEach(([label, value]) => appendDefinition(doc, confirmation, label, value));
    correctionPreview.replaceChildren();
    if (correctionBaseline) {
      correctionPreview.append(node(doc, "strong", "", "変更内容を確認"));
      try {
        const current = prepareDbfInput({ sourceType: "manual_entry", rows: manualRows, factKind: fact.runtimeKey, fiscalMonth: month.value }).normalizedRows;
        correctionPreview.append(node(doc, "p", "", correctionSignature(current) === correctionSignature(correctionBaseline) ? "変更前と変更後に差がありません。" : `変更前 ${correctionBaseline.length}行 → 変更後 ${current.length}行`));
      } catch { correctionPreview.append(node(doc, "p", "", "入力を完了すると変更前・変更後を確認できます。")); }
    }
  };
  month.addEventListener("change", updateConfirmation);
  file.addEventListener("change", async () => {
    selectedRowCount = "ファイル選択後に確認します";
    try {
      if (file.files?.[0] && month.value) selectedRowCount = `${parseDbfNormalizedCsv(await file.files[0].text(), fact.runtimeKey, month.value).rows.length}行`;
    } catch {
      selectedRowCount = "ファイル形式または内容を確認してください";
    }
    updateConfirmation();
  });
  updateConfirmation();
  step5.append(confirmation, correctionPreview);
  const step6 = node(doc, "section", "dbf-import-wizard-step is-action");
  step6.append(node(doc, "span", "dbf-import-step-number", "STEP 6"), node(doc, "h4", "", "内容を確認して取込開始"));
  const start = node(doc, "button", "business-data-action", "この内容で取り込む");
  start.type = "button";
  let correctionReady = true;
  const updateStartAvailability = () => {
    const confirmationMissing = fact.runtimeKey === "store_operating_result" && sourceType === "manual_entry" && !manualEditor.confirmationStatus();
    start.disabled = !enabled || !month.value || confirmationMissing || !correctionReady || (sourceType === "csv_upload" ? !file.files?.[0] : manualEditor.rows().length === 0);
    start.title = confirmationMissing ? "確定値または暫定値を明示的に選択してください" : !correctionReady ? "訂正元Batchと訂正理由を確認してください" : start.disabled ? "対象月と入力内容を確認すると取込を開始できます" : "";
  };
  month.addEventListener("change", updateStartAvailability);
  file.addEventListener("change", updateStartAvailability);
  const selectMethod = async (next, suppliedMasterOptions = null) => {
    sourceType = next;
    csvMethod.className = next === "csv_upload" ? "business-data-action is-selected" : "business-data-secondary-action";
    manualMethod.className = next === "manual_entry" ? "business-data-action is-selected" : "business-data-secondary-action";
    file.hidden = template.hidden = sourceGuide.hidden = next === "manual_entry";
    manualEditor.root.hidden = next !== "manual_entry";
    if (next === "manual_entry" && enabled) {
      const masterOptions = suppliedMasterOptions || await DBF_IMPORT_RUNTIME.masterOptions();
      if (fact.runtimeKey === "store_operating_result") validateOfficialStoreBaseline(masterOptions);
      manualEditor.setMasterOptions(masterOptions);
    }
    updateConfirmation(); updateStartAvailability();
  };
  csvMethod.addEventListener("click", () => void selectMethod("csv_upload").catch((error) => renderSafeError(doc, status, error, "正式マスタを確認してください")));
  manualMethod.addEventListener("click", () => void selectMethod("manual_entry").catch((error) => renderSafeError(doc, status, error, "正式マスタを確認してください")));
  manualEditor.root.addEventListener("input", () => { updateConfirmation(); updateStartAvailability(); });
  updateStartAvailability();
  const correctionToggle = node(doc, "input");
  correctionToggle.type = "checkbox";
  correctionToggle.disabled = !enabled;
  const correctionLabel = node(doc, "label", "business-data-correction-toggle", "訂正取込");
  correctionLabel.prepend(correctionToggle);
  const correctionBatch = node(doc, "input", "business-data-correction-batch");
  correctionBatch.type = "text";
  correctionBatch.placeholder = "訂正元Batch UUID";
  correctionBatch.disabled = true;
  const correctionContext = node(doc, "p", "business-data-correction-context");
  const correctionReasonType = node(doc, "select", "business-data-correction-reason-type");
  [["", "訂正理由を選択"], ["入力ミス", "入力ミス"], ["金額訂正", "金額訂正"], ["勘定科目訂正", "勘定科目訂正"], ["店舗選択誤り", "店舗選択誤り"], ["確定値への変更", "確定値への変更"], ["会計確定値反映", "会計確定値反映"], ["その他", "その他"]].forEach(([value, label]) => correctionReasonType.append(option(doc, value, label)));
  correctionReasonType.disabled = true;
  const correctionReason = node(doc, "input", "business-data-correction-reason");
  correctionReason.type = "text";
  correctionReason.maxLength = 500;
  correctionReason.placeholder = "訂正理由";
  correctionReason.disabled = true;
  const syncCorrectionAvailability = () => {
    correctionBatch.disabled = correctionReasonType.disabled = correctionReason.disabled = !correctionToggle.checked;
    correctionReady = !correctionToggle.checked || (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u.test(correctionBatch.value.trim().toLowerCase()) && Boolean(correctionReasonType.value) && (correctionReasonType.value !== "その他" || Boolean(correctionReason.value.trim())));
    updateStartAvailability();
  };
  correctionToggle.addEventListener("change", syncCorrectionAvailability);
  correctionBatch.addEventListener("input", syncCorrectionAvailability);
  correctionReasonType.addEventListener("change", syncCorrectionAvailability);
  correctionReason.addEventListener("input", syncCorrectionAvailability);
  const correction = node(doc, "details", "dbf-correction-details");
  correction.append(node(doc, "summary", "", "訂正データとして登録する場合"), correctionContext, correctionLabel, correctionBatch, correctionReasonType, correctionReason);
  step6.append(correction, start);
  controls.append(step1, step2, step3, step4, step5, step6);
  panel.append(controls);

  const status = createStatus(doc);
  const mappings = node(doc, "div", "business-data-mappings");
  const actions = node(doc, "div", "business-data-import-actions");
  const validate = node(doc, "button", "business-data-action", "データを検証して確認画面へ");
  const approve = node(doc, "button", "business-data-action", "内容を承認する");
  const promote = node(doc, "button", "business-data-danger-action", "正式データへ反映する");
  for (const button of [validate, approve, promote]) { button.type = "button"; button.disabled = true; }
  actions.append(validate, approve, promote);
  const previewDetails = node(doc, "details", "dbf-technical-detail dbf-preview-details");
  previewDetails.append(node(doc, "summary", "", "検証結果の詳細を表示"));
  const preview = node(doc, "pre", "business-data-preview-json");
  previewDetails.append(preview);
  panel.append(status, mappings, actions, previewDetails);

  const state = { status, parsed: null, mappings: [], unresolved: [], masterOptions: { companies: [], stores: [] }, batchId: "", sourceSystem: "dbf_phase_c_normalized_csv_v1", file: null, validatedRows: [], preview: null };

  const refreshMappings = async () => {
    const receipt = await DBF_IMPORT_RUNTIME.resolveMappings({ sourceSystem: state.sourceSystem, requests: state.parsed.mappingRequests });
    state.mappings = receipt?.mappings || [];
    const bound = bindDbfCanonicalMappings(state.parsed, state.mappings);
    state.unresolved = bound.unresolved;
    state.validatedRows = bound.rows;
    validate.disabled = state.unresolved.length > 0;
      status.textContent = state.unresolved.length ? `法人・店舗の紐付けが必要なデータ：${state.unresolved.length}件` : `法人・店舗の紐付け完了 / ${state.validatedRows.length}行`;
    renderMappingRows(doc, state, mappings, refreshMappings);
  };

  start.addEventListener("click", async () => {
    if (!month.value || (sourceType === "csv_upload" && !file.files?.[0])) return;
    start.disabled = true;
    validate.disabled = approve.disabled = promote.disabled = true;
    preview.textContent = "";
    try {
      state.file = sourceType === "csv_upload" ? file.files[0] : null;
      const prepared = prepareDbfInput(sourceType === "csv_upload"
        ? { sourceType, text: await state.file.text(), file: state.file, factKind: fact.runtimeKey, fiscalMonth: month.value }
        : { sourceType, rows: manualEditor.rows(), factKind: fact.runtimeKey, fiscalMonth: month.value });
      state.sourceSystem = prepared.sourceSystem;
      state.parsed = { factKind: prepared.factKind, fiscalMonth: prepared.fiscalMonth, rows: prepared.normalizedRows, mappingRequests: prepared.mappingRequests };
      const [fileReceipt, rawRows, masterOptions] = await Promise.all([
        sourceType === "csv_upload" ? buildDbfSourceFile(state.file) : buildDbfSourceArtifact(prepared.sourceArtifact),
        buildDbfRawRows(state.parsed.rows),
        DBF_IMPORT_RUNTIME.masterOptions(),
      ]);
      state.masterOptions = masterOptions;
      const correctionOfBatchId = correctionToggle.checked ? correctionBatch.value.trim().toLowerCase() : null;
      const requestedCorrectionReason = correctionToggle.checked ? [correctionReasonType.value, correctionReason.value.trim()].filter(Boolean).join("：") : null;
      if (correctionToggle.checked && (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u.test(correctionOfBatchId) || !requestedCorrectionReason)) {
        throw new Error("CORRECTION_LINEAGE_INVALID");
      }
      if (correctionToggle.checked && correctionBaseline && correctionSignature(prepared.normalizedRows) === correctionSignature(correctionBaseline)) throw new Error("CORRECTION_NO_CHANGES");
      const started = await DBF_IMPORT_RUNTIME.start({
        file: fileReceipt,
        factKind: fact.runtimeKey,
        fiscalMonth: month.value,
        sourceType,
        sourceSystem: state.sourceSystem,
        rawRows,
        correctionOfBatchId,
        correctionReason: requestedCorrectionReason,
      });
      state.batchId = started.batchId;
      const initial = await DBF_IMPORT_RUNTIME.resolveMappings({ sourceSystem: state.sourceSystem, requests: state.parsed.mappingRequests });
      const unresolved = (initial?.mappings || []).filter((item) => item.status !== "active").map((item) => ({ entityType: item.entityType, sourceKey: item.sourceKey, sourceLabel: item.sourceKey }));
      if (unresolved.length) await DBF_IMPORT_RUNTIME.quarantineMappings({ batchId: state.batchId, sourceSystem: state.sourceSystem, mappings: unresolved });
      await refreshMappings();
      await onHistoryChanged(month.value);
    } catch (error) {
      renderSafeError(doc, status, error, "ファイル・対象月・入力内容を確認してください");
      updateStartAvailability();
    }
  });

  validate.addEventListener("click", async () => {
    validate.disabled = true;
    try {
      await DBF_IMPORT_RUNTIME.validate({
        batchId: state.batchId,
        factKind: fact.runtimeKey,
        fiscalMonth: month.value,
        parserReceipt: parserReceipt(fact),
        rows: state.validatedRows,
        warnings: [],
      });
      state.preview = await DBF_IMPORT_RUNTIME.preview(state.batchId);
      preview.textContent = JSON.stringify(state.preview, null, 2);
      status.textContent = state.preview.errorCount ? `データ検証で修正が必要な項目：${state.preview.errorCount}件` : `データ検証完了 / 確認事項 ${state.preview.warningCount}件`;
      approve.disabled = state.preview.errorCount !== 0 || state.preview.quarantinedCount !== 0;
      await onHistoryChanged(month.value);
    } catch (error) {
      renderSafeError(doc, status, error, "検証結果と紐付け状態を確認してください");
    }
  });

  approve.addEventListener("click", async () => {
    approve.disabled = true;
    try {
      await DBF_IMPORT_RUNTIME.approve(state.batchId);
      state.preview = await DBF_IMPORT_RUNTIME.preview(state.batchId);
      preview.textContent = JSON.stringify(state.preview, null, 2);
      promote.disabled = state.preview.promotionAllowed !== true;
      status.textContent = "承認済みです。正式データへ反映する前に最終確認してください。";
      await onHistoryChanged(month.value);
    } catch (error) {
      renderSafeError(doc, status, error, "最新状態を再読込してください");
    }
  });

  promote.addEventListener("click", async () => {
    const provisional = fact.runtimeKey === "store_operating_result" && state.parsed?.rows?.some((row) => row.confirmationStatus === "provisional");
    const confirmationNotice = provisional ? "\n\nデータ状態: 暫定値\nStore Operationsの正式実績には表示されません。" : "";
    if (!globalThis.confirm?.(`${fact.label} ${month.value} を正式データへ反映しますか？${confirmationNotice}`)) return;
    promote.disabled = true;
    try {
      const promoted = await DBF_IMPORT_RUNTIME.promote(state.batchId);
      preview.textContent = JSON.stringify(promoted, null, 2);
      const revision = Number(promoted?.revision);
      status.textContent = Number.isInteger(revision) && revision > 0
        ? `正式データへの反映が完了しました / Revision ${revision}`
        : "正式データへの反映が完了しました";
      await onHistoryChanged(month.value);
    } catch (error) {
      renderSafeError(doc, status, error, "承認状態と事前確認結果を確認してください");
    }
  });

  const panelNext = node(doc, "aside", "dbf-panel-next-action");
  panelNext.append(node(doc, "strong", "", "次にやること"), node(doc, "p", "", "まず対象月とCSVファイルを選び、取込前確認の内容を確認してください。"));
  panel.append(panelNext);

  panel.beginCorrection = async (item, previewData, masterOptions) => {
    if (item?.factKind !== fact.runtimeKey || item?.status !== "promoted" || previewData?.batchId !== item.batchId) throw new Error("CORRECTION_SOURCE_INVALID");
    const sourceRows = Array.isArray(previewData?.correctionRows) ? previewData.correctionRows : [];
    if (!sourceRows.length || sourceRows.length !== Number(item.rowCount)) throw new Error("CORRECTION_SOURCE_ROWS_INVALID");
    const companies = new Map((masterOptions.companies || []).map((company) => [String(company.id).toLowerCase(), company]));
    const stores = new Map((masterOptions.stores || []).map((store) => [String(store.id).toLowerCase(), store]));
    const rows = sourceRows.map((row) => {
      const company = companies.get(String(row.companyId || "").toLowerCase());
      const store = row.storeId ? stores.get(String(row.storeId).toLowerCase()) : null;
      if (!company?.code || (row.storeId && !store?.code)) throw new Error("CORRECTION_SOURCE_MAPPING_INVALID");
      const base = { companyKey: company.code, storeKey: store?.code || "", confirmationStatus: row.confirmationStatus };
      if (fact.runtimeKey === "store_operating_result") {
        if (!STORE_MONTHLY_METRICS[row.metricCode]) throw new Error("CORRECTION_SOURCE_MAPPING_INVALID");
        const numeric = Number(row.value); if (!Number.isFinite(numeric)) throw new Error("CORRECTION_SOURCE_VALUE_INVALID");
        return { ...base, metricCode: row.metricCode, value: STORE_MONTHLY_METRICS[row.metricCode] === "rate" ? numeric * 100 : numeric, definitionVersion: row.definitionVersion || "v1" };
      }
      if (fact.runtimeKey === "budget") return { ...base, scenarioCode: row.scenarioCode, accountCode: row.accountCode || "", metricCode: row.metricCode || "", amount: row.amount };
      if (fact.runtimeKey === "bs") return { ...base, accountCode: row.accountCode, accountName: row.accountName, amount: row.amount, classification: row.classification };
      return { ...base, accountCode: row.accountCode, accountName: row.accountName, amount: row.amount, sourceRowCategory: row.sourceRowCategory, aggregateScope: row.aggregateScope || "" };
    });
    month.value = item.fiscalMonth;
    await selectMethod("manual_entry", masterOptions);
    if (fact.runtimeKey === "store_operating_result") { validateOfficialStoreBaseline(masterOptions); manualEditor.prefillStoreRows(rows); } else manualEditor.prefillRows(rows);
    correctionBaseline = prepareDbfInput({ sourceType: "manual_entry", rows, factKind: fact.runtimeKey, fiscalMonth: item.fiscalMonth }).normalizedRows;
    correctionToggle.checked = true;
    correctionBatch.disabled = correctionReasonType.disabled = correctionReason.disabled = false;
    correctionBatch.value = item.batchId;
    correctionBatch.hidden = true;
    correctionReason.value = "";
    correctionReasonType.value = "";
    correctionContext.textContent = `${item.fiscalMonth.replace("-", "年")}月 ${fact.label}を訂正しています / 元Revision: ${item.revision}`;
    correction.open = true;
    updateConfirmation();
    syncCorrectionAvailability();
    status.textContent = fact.runtimeKey === "store_operating_result"
      ? `${item.fiscalMonth} 店舗月次実績 ${rows.length}件を引き継ぎました。データ状態で「確定値」を選び、訂正理由を入力してください。`
      : `${item.fiscalMonth} ${fact.label} ${rows.length}件を引き継ぎました。変更箇所と訂正理由を確認してください。`;
  };

  return panel;
}

export function renderBusinessDataManagementPreview(container, options = {}) {
  const doc = options.document || container?.ownerDocument || globalThis.document;
  if (!container || !doc?.createElement || container.dataset.businessDataMounted === "true") return false;
  const fixture = options.fixture || BUSINESS_DATA_EMPTY_FIXTURE;
  const enabled = runtimeEnabled(options);
  container.dataset.businessDataMounted = "true";
  container.dataset.runtimeImport = enabled ? "ENABLED" : "DISABLED";
  container.dataset.productionWrite = "DISABLED";

  const header = node(doc, "div", "business-data-preview-heading");
  header.append(node(doc, "p", "eyebrow", "本部担当者向け / 管理者専用"), node(doc, "h2", "", "経営データ管理"), node(doc, "p", "", "今月の経営データを、この画面からまとめて登録・確認します。"));

  const shell = node(doc, "section", "dbf-management-shell");
  shell.setAttribute("aria-labelledby", "dbf-management-shell-title");
  const shellHeader = node(doc, "div", "dbf-management-shell-header");
  const shellTitle = node(doc, "h3", "", "今月のデータ");
  shellTitle.id = "dbf-management-shell-title";
  const shellMonthLabel = node(doc, "label", "dbf-management-shell-month-label", "対象月");
  const shellMonth = node(doc, "input", "business-data-month dbf-management-shell-month");
  shellMonth.type = "month";
  shellMonth.value = fixture.fiscalMonth;
  shellMonthLabel.append(shellMonth);
  shellHeader.append(shellTitle, shellMonthLabel);
  const statusGrid = node(doc, "div", "dbf-single-entry-status-list");
  const cards = new Map();
  FACTS.forEach((fact) => {
    const card = node(doc, "article", "dbf-single-entry-status");
    card.dataset.dbfState = "missing";
    const detail = node(doc, "div", "dbf-single-entry-status-detail");
    const count = node(doc, "span", "", "まだデータが登録されていません"); count.dataset.dbfCount = "true";
    const errors = node(doc, "span", "", "確認事項なし"); errors.dataset.dbfErrors = "true";
    const status = node(doc, "strong", "dbf-single-entry-status-badge", "未登録"); status.dataset.dbfStatus = "true";
    detail.append(count, errors);
    card.append(node(doc, "h4", "", fact.label), detail, status);
    cards.set(fact.key, card);
    statusGrid.append(card);
  });
  const next = node(doc, "div", "dbf-management-next");
  next.setAttribute("role", "status");
  next.setAttribute("aria-live", "polite");
  const nextHeading = node(doc, "strong", "dbf-management-next-title", "次にやること");
  const nextText = node(doc, "p", "", "履歴を確認しています…");
  const nextReview = node(doc, "button", "business-data-action", "確認する");
  nextReview.type = "button";
  nextReview.hidden = true;
  const addFile = node(doc, "button", "business-data-action dbf-single-entry-primary", "＋ ファイルを追加");
  addFile.type = "button";
  const shellAlert = node(doc, "div", "dbf-management-alert");
  shellAlert.setAttribute("role", "alert");
  shellAlert.hidden = true;
  const historyLink = node(doc, "button", "business-data-secondary-action", "取込履歴を見る");
  historyLink.type = "button";
  const nextCopy = node(doc, "div", "dbf-management-next-copy");
  nextCopy.append(nextHeading, nextText);
  const nextActions = node(doc, "div", "dbf-single-entry-actions");
  nextActions.append(nextReview, addFile, historyLink);
  next.append(nextCopy, nextActions);
  shell.append(shellHeader, statusGrid, next, shellAlert);

  const dashboard = node(doc, "section", "business-data-preview-panel");
  dashboard.dataset.businessDataPanel = "dashboard";
  const workflowDetails = node(doc, "details", "dbf-operational-details");
  workflowDetails.append(node(doc, "summary", "", "月次処理の詳細を見る"));
  const workflow = node(doc, "ol", "dbf-operational-workflow");
  workflowDetails.append(workflow);
  const pilotPreview = node(doc, "details", "business-data-pilot-preview");
  pilotPreview.hidden = true;
  dashboard.append(workflowDetails, pilotPreview);

  const history = node(doc, "section", "business-data-preview-panel");
  history.dataset.businessDataPanel = "history";
  history.hidden = true;
  history.append(node(doc, "h3", "", "取込履歴"));
  appendScreenGuide(doc, history, "取込履歴", "誰が、いつ、どの月のデータを登録したかを確認します。訂正時は元の処理もここで確認します。", "確認したい処理が一覧に表示されること", "必要な履歴を確認し、今月のデータへ戻ってください");
  const historyList = node(doc, "ul", "business-data-history");
  const historyBack = node(doc, "button", "business-data-secondary-action", "今月のデータへ戻る");
  historyBack.type = "button";
  history.append(historyBack, historyList);
  renderHistoryItems(historyList, fixture.history || []);

  let workflowState = deriveDbfWorkflowState([]);
  let panels = [];
  const activateView = (key) => {
    container.dataset.dbfCurrentView = key;
    panels.forEach((panel) => { panel.hidden = panel.dataset.businessDataPanel !== key; });
  };
  const renderOperationalState = () => {
    workflow.replaceChildren();
    workflowState.steps.forEach((step, index) => {
      const stateLabel = WORKFLOW_STATUS_LABEL[step.state] || "未開始";
      workflow.append(node(doc, "li", `is-${step.state}`, `${index + 1}. ${step.label} — ${stateLabel}`));
    });
    nextText.textContent = workflowState.nextAction;
    const allComplete = workflowState.steps.length > 0 && workflowState.steps.every((step) => step.state === "complete");
    if (allComplete) nextText.textContent = `${shellMonth.value}のデータ登録は完了しました。`;
    const fileRegistration = /ファイルを登録/u.test(workflowState.nextAction);
    nextReview.hidden = fileRegistration || allComplete || !["pl", "bs", "stores", "budget", "account-review"].includes(workflowState.nextTarget);
  };
  renderOperationalState();

  const refreshHistory = async (monthValue = shellMonth.value) => {
    shellMonth.value = monthValue || shellMonth.value;
    shellAlert.hidden = true;
    if (!enabled) {
      updateDashboardCards(cards, []);
      renderPilotMonthPreview(pilotPreview, null);
      workflowState = deriveDbfWorkflowState([]);
      renderOperationalState();
      return;
    }
    try {
      // Keep the two authenticated read-only requests deterministic. Both
      // paths begin with the same bounded history RPC and the Staging gateway
      // can reject one of two simultaneous calls even though each is valid.
      const result = await DBF_IMPORT_RUNTIME.history({ fiscalMonth: shellMonth.value, limit: 100 });
      const pilot = shellMonth.value === "2026-06"
        ? await DBF_IMPORT_RUNTIME.pilotPreview({ fiscalMonth: shellMonth.value, section: "all" })
        : null;
      const items = result?.items || [];
      renderHistoryItems(historyList, items, startCorrectionFromHistory);
      updateDashboardCards(cards, items);
      renderPilotMonthPreview(pilotPreview, pilot);
      let reviewComplete = false;
      let preflightReady = false;
      if (shellMonth.value === "2026-06") {
        const [review, preflight] = await Promise.allSettled([
          DBF_IMPORT_RUNTIME.accountReviewList({ companyId: "e4059116-bdb3-4e13-9763-bbc77bdfe062", fiscalMonth: shellMonth.value }),
          DBF_IMPORT_RUNTIME.corporatePromotionPreflight(),
        ]);
        if (review.status === "fulfilled") {
          const candidates = Array.isArray(review.value?.items) ? review.value.items : [];
          reviewComplete = candidates.length > 0 && candidates.every((item) => !new Set(["UNREVIEWED", "NEEDS_REVIEW"]).has(String(item.mappingStatus || item.decision || "UNREVIEWED")));
        }
        preflightReady = preflight.status === "fulfilled" && preflight.value?.promotionAllowed === true;
      }
      workflowState = deriveDbfWorkflowState(items, { reviewComplete, preflightReady });
      renderOperationalState();
    } catch (error) {
      renderHistoryItems(historyList, []);
      updateDashboardCards(cards, []);
      pilotPreview.hidden = false;
      pilotPreview.replaceChildren(node(doc, "p", "business-data-runtime-status", "Pilot Previewを読み込めませんでした。再取込はせず、接続状態を確認してください。"));
      workflowState = deriveDbfWorkflowState([]);
      renderOperationalState();
      shellAlert.hidden = false;
      renderSafeError(doc, shellAlert, error, "接続状態を確認して再読込してください");
    }
  };

  const accountReview = createDbfAccountMappingReview(doc);
  appendScreenGuide(doc, accountReview, "勘定科目確認", "取り込んだP/L・B/Sの勘定科目をIDEA NOVの正式な勘定科目へ紐付けます。確認が必要な候補だけ判断してください。", "未確認と要再確認が0件になること", "各候補を確認し、判断を保存してください");
  const accountReviewNext = node(doc, "aside", "dbf-panel-next-action");
  accountReviewNext.append(node(doc, "strong", "", "次にやること"), node(doc, "p", "", "未確認と要再確認を0件にした後、今月のデータに戻ってください。"));
  accountReview.append(accountReviewNext);
  accountReview.dataset.businessDataPanel = "account-review";

  const entry = node(doc, "section", "business-data-preview-panel dbf-single-ingestion-entry");
  entry.dataset.businessDataPanel = "entry";
  entry.hidden = true;
  entry.append(node(doc, "p", "eyebrow", "単一取込入口"), node(doc, "h3", "", "ファイルを追加"), node(doc, "p", "", "何のデータを登録しますか？"));
  const typeGrid = node(doc, "div", "dbf-single-entry-type-grid");
  const factPanels = new Map();
  const returnToEntry = () => activateView("entry");
  FACTS.forEach((fact) => {
    const choice = node(doc, "button", "dbf-single-entry-type");
    choice.type = "button";
    choice.append(node(doc, "strong", "", fact.label), node(doc, "span", "", fact.purpose), node(doc, "small", "", fact.source));
    choice.addEventListener("click", () => {
      const panel = factPanels.get(fact.view);
      const month = panel?.querySelector(".business-data-month");
      if (month) {
        month.value = shellMonth.value;
        const EventConstructor = doc.defaultView?.Event || globalThis.Event;
        if (typeof EventConstructor === "function") month.dispatchEvent(new EventConstructor("change"));
      }
      activateView(fact.view);
    });
    typeGrid.append(choice);
  });
  entry.append(typeGrid);
  FACTS.forEach((fact) => factPanels.set(fact.view, renderImportPanel(doc, fact, enabled, refreshHistory, returnToEntry)));
  const startCorrectionFromHistory = async (item) => {
    try {
      const [preview, masterOptions] = await Promise.all([DBF_IMPORT_RUNTIME.preview(item.batchId), DBF_IMPORT_RUNTIME.masterOptions()]);
      const panel = factPanels.get("stores");
      await panel.beginCorrection(item, preview, masterOptions);
      activateView("stores");
    } catch (error) {
      shellAlert.hidden = false;
      renderSafeError(doc, shellAlert, error, "元データを再入力せず、履歴からもう一度訂正を開始してください");
    }
  };
  panels = [dashboard, entry, accountReview, ...factPanels.values(), history];

  shellMonth.addEventListener("change", () => void refreshHistory(shellMonth.value));
  addFile.addEventListener("click", () => activateView("entry"));
  historyLink.addEventListener("click", () => activateView("history"));
  historyBack.addEventListener("click", () => activateView("dashboard"));
  nextReview.addEventListener("click", () => {
    activateView(workflowState.nextTarget);
    if (workflowState.nextTarget === "account-review") void accountReview.loadAccountReview().catch((error) => {
      const status = accountReview.querySelector(".business-data-runtime-status");
      if (status) renderSafeError(doc, status, error, "対象月と法人を確認して再読込してください");
    });
  });

  const workspace = node(doc, "div", "business-data-workspace business-data-workspace-single-entry");
  const workspaceMain = node(doc, "div", "business-data-workspace-main");
  workspaceMain.append(...panels);
  workspace.append(workspaceMain);
  container.append(header, shell, workspace);
  void refreshHistory();
  return true;
}
