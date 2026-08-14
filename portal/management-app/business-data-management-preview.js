import { DBF_IMPORT_FLOW, STORE_MONTHLY_METRICS } from "./dbf-business-data-contract.js";
import { DBF_IMPORT_RUNTIME, buildDbfRawRows, buildDbfSourceFile } from "./dbf-business-data-runtime.js";
import { bindDbfCanonicalMappings, dbfNormalizedCsvTemplate, parseDbfNormalizedCsv } from "./dbf-business-data-normalized-csv.js";

const FACTS = Object.freeze([
  Object.freeze({ key: "PL", runtimeKey: "pl", view: "pl", label: "月次P/L", statement: "PL" }),
  Object.freeze({ key: "BS", runtimeKey: "bs", view: "bs", label: "B/S", statement: "BS" }),
  Object.freeze({ key: "STORE_OPERATING_RESULT", runtimeKey: "store_operating_result", view: "stores", label: "営業実績", statement: "STORE_OPERATING_RESULT" }),
  Object.freeze({ key: "BUDGET", runtimeKey: "budget", view: "budget", label: "予算", statement: "BUDGET" }),
]);

export const BUSINESS_DATA_PREVIEW_FIXTURE = Object.freeze({
  schemaVersion: "dbf-business-data-management-preview-v1",
  fiscalMonth: "2026-07",
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

function renderHistoryItems(list, items) {
  list.replaceChildren();
  if (!items.length) {
    list.append(node(list.ownerDocument, "li", "", "未登録（0件は正常状態です）"));
    return;
  }
  items.forEach((item) => {
    list.append(node(list.ownerDocument, "li", "", `${item.fiscalMonth} / ${item.factKind} / v${item.revision} / ${item.status} / ${item.rowCount}行 / Error ${item.errorCount} / Batch ${item.batchId}`));
  });
}

function updateDashboardCards(cards, items) {
  for (const fact of FACTS) {
    const card = cards.get(fact.key);
    const matching = items.filter((item) => item.factKind === fact.runtimeKey);
    const active = matching.find((item) => item.status === "promoted") || matching[0];
    card.querySelector("[data-dbf-status]").textContent = active ? active.status : "未登録";
    card.querySelector("[data-dbf-count]").textContent = active ? `${active.rowCount}行` : "0件";
    card.querySelector("[data-dbf-errors]").textContent = `Error ${active?.errorCount || 0}`;
  }
}

function renderMappingRows(doc, state, container, refresh) {
  container.replaceChildren();
  if (!state.unresolved.length) {
    container.append(node(doc, "p", "business-data-ok", "法人・店舗Mappingはすべて解決済みです。"));
    return;
  }
  container.append(node(doc, "h4", "", "未解決Mapping（Owner確認必須）"));
  for (const mapping of state.unresolved) {
    const row = node(doc, "div", "business-data-mapping-row");
    row.append(node(doc, "span", "", `${mapping.entityType === "company" ? "法人" : "店舗"}: ${mapping.sourceKey}`));
    const select = node(doc, "select", "business-data-mapping-select");
    select.append(option(doc, "", "Canonical Masterを選択"));
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
    const confirm = node(doc, "button", "business-data-action", "Mapping確定");
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
        state.status.textContent = `Mapping拒否: ${errorCode(error)}`;
        confirm.disabled = false;
      }
    });
    row.append(select, confirm);
    container.append(row);
  }
}

function renderImportPanel(doc, fact, enabled, onHistoryChanged) {
  const panel = node(doc, "section", "business-data-preview-panel");
  panel.dataset.businessDataPanel = fact.view;
  panel.hidden = true;
  panel.append(node(doc, "h3", "", fact.label));
  const guard = node(doc, "p", "business-data-runtime-guard", enabled
    ? "Staging Import Runtime接続済み。PromotionにはOwner確認が必要です。"
    : "Import Runtimeは無効です。表示・fixture確認のみ行えます。");
  panel.append(guard);
  const flow = node(doc, "ol", "business-data-flow");
  DBF_IMPORT_FLOW.forEach((step) => flow.append(node(doc, "li", "", step)));
  panel.append(flow);
  if (fact.runtimeKey === "store_operating_result") panel.append(node(doc, "p", "business-data-metric-count", `Canonical metrics: ${Object.keys(STORE_MONTHLY_METRICS).length}`));

  const controls = node(doc, "div", "business-data-import-controls");
  const month = node(doc, "input", "business-data-month");
  month.type = "month";
  month.value = "2026-07";
  month.disabled = !enabled;
  const file = node(doc, "input", "business-data-file");
  file.type = "file";
  file.accept = ".csv,text/csv";
  file.disabled = !enabled;
  const template = node(doc, "button", "business-data-secondary-action", "CSVテンプレート");
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
  const start = node(doc, "button", "business-data-action", "Upload・解析開始");
  start.type = "button";
  start.disabled = !enabled;
  const correctionToggle = node(doc, "input");
  correctionToggle.type = "checkbox";
  correctionToggle.disabled = !enabled;
  const correctionLabel = node(doc, "label", "business-data-correction-toggle", "訂正取込");
  correctionLabel.prepend(correctionToggle);
  const correctionBatch = node(doc, "input", "business-data-correction-batch");
  correctionBatch.type = "text";
  correctionBatch.placeholder = "訂正元Batch UUID";
  correctionBatch.disabled = true;
  const correctionReason = node(doc, "input", "business-data-correction-reason");
  correctionReason.type = "text";
  correctionReason.maxLength = 500;
  correctionReason.placeholder = "訂正理由";
  correctionReason.disabled = true;
  correctionToggle.addEventListener("change", () => {
    correctionBatch.disabled = correctionReason.disabled = !correctionToggle.checked;
  });
  controls.append(month, file, template, correctionLabel, correctionBatch, correctionReason, start);
  panel.append(controls);

  const status = createStatus(doc);
  const mappings = node(doc, "div", "business-data-mappings");
  const actions = node(doc, "div", "business-data-import-actions");
  const validate = node(doc, "button", "business-data-action", "Validation・Preview");
  const approve = node(doc, "button", "business-data-action", "Owner承認");
  const promote = node(doc, "button", "business-data-danger-action", "CanonicalへPromotion");
  for (const button of [validate, approve, promote]) { button.type = "button"; button.disabled = true; }
  actions.append(validate, approve, promote);
  const preview = node(doc, "pre", "business-data-preview-json");
  panel.append(status, mappings, actions, preview);

  const state = { status, parsed: null, mappings: [], unresolved: [], masterOptions: { companies: [], stores: [] }, batchId: "", sourceSystem: "dbf_phase_c_normalized_csv_v1", file: null, validatedRows: [], preview: null };

  const refreshMappings = async () => {
    const receipt = await DBF_IMPORT_RUNTIME.resolveMappings({ sourceSystem: state.sourceSystem, requests: state.parsed.mappingRequests });
    state.mappings = receipt?.mappings || [];
    const bound = bindDbfCanonicalMappings(state.parsed, state.mappings);
    state.unresolved = bound.unresolved;
    state.validatedRows = bound.rows;
    validate.disabled = state.unresolved.length > 0;
    status.textContent = state.unresolved.length ? `Mapping未解決 ${state.unresolved.length}件（quarantine）` : `Mapping解決済み / ${state.validatedRows.length}行`;
    renderMappingRows(doc, state, mappings, refreshMappings);
  };

  start.addEventListener("click", async () => {
    if (!file.files?.[0] || !month.value) return;
    start.disabled = true;
    validate.disabled = approve.disabled = promote.disabled = true;
    preview.textContent = "";
    try {
      state.file = file.files[0];
      state.parsed = parseDbfNormalizedCsv(await state.file.text(), fact.runtimeKey, month.value);
      const [fileReceipt, rawRows, masterOptions] = await Promise.all([
        buildDbfSourceFile(state.file),
        buildDbfRawRows(state.parsed.rows),
        DBF_IMPORT_RUNTIME.masterOptions(),
      ]);
      state.masterOptions = masterOptions;
      const correctionOfBatchId = correctionToggle.checked ? correctionBatch.value.trim().toLowerCase() : null;
      const requestedCorrectionReason = correctionToggle.checked ? correctionReason.value.trim() : null;
      if (correctionToggle.checked && (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u.test(correctionOfBatchId) || !requestedCorrectionReason)) {
        throw new Error("CORRECTION_LINEAGE_INVALID");
      }
      const started = await DBF_IMPORT_RUNTIME.start({
        file: fileReceipt,
        factKind: fact.runtimeKey,
        fiscalMonth: month.value,
        sourceType: "csv_upload",
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
      status.textContent = `取込開始拒否: ${errorCode(error)}`;
      start.disabled = false;
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
      status.textContent = state.preview.errorCount ? `Validation Error ${state.preview.errorCount}` : `Preview準備完了 / Warning ${state.preview.warningCount}`;
      approve.disabled = state.preview.errorCount !== 0 || state.preview.quarantinedCount !== 0;
      await onHistoryChanged(month.value);
    } catch (error) {
      status.textContent = `Validation拒否: ${errorCode(error)}`;
    }
  });

  approve.addEventListener("click", async () => {
    approve.disabled = true;
    try {
      await DBF_IMPORT_RUNTIME.approve(state.batchId);
      state.preview = await DBF_IMPORT_RUNTIME.preview(state.batchId);
      preview.textContent = JSON.stringify(state.preview, null, 2);
      promote.disabled = state.preview.promotionAllowed !== true;
      status.textContent = "Owner承認済み。Promotion実行前の最終確認が必要です。";
      await onHistoryChanged(month.value);
    } catch (error) {
      status.textContent = `Owner承認拒否: ${errorCode(error)}`;
    }
  });

  promote.addEventListener("click", async () => {
    if (!globalThis.confirm?.(`${fact.label} ${month.value} をCanonical FactへPromotionしますか？`)) return;
    promote.disabled = true;
    try {
      const promoted = await DBF_IMPORT_RUNTIME.promote(state.batchId);
      preview.textContent = JSON.stringify(promoted, null, 2);
      status.textContent = `Promotion完了 / version ${promoted.version}`;
      await onHistoryChanged(month.value);
    } catch (error) {
      status.textContent = `Promotion拒否: ${errorCode(error)}`;
    }
  });

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
  header.append(node(doc, "p", "eyebrow", "SYSTEM MASTER / BUSINESS DATA ADMIN ONLY"), node(doc, "h2", "", "経営データ管理"), node(doc, "p", "", "月次P/L・B/S・営業実績・予算のCanonical取込"));
  const tabs = node(doc, "nav", "business-data-tabs");
  tabs.setAttribute("aria-label", "経営データ管理メニュー");

  const dashboard = node(doc, "section", "business-data-preview-panel");
  dashboard.dataset.businessDataPanel = "dashboard";
  const dashboardTitle = node(doc, "h3", "", `${fixture.fiscalMonth} データ状況`);
  const dashboardMonth = node(doc, "input", "business-data-month");
  dashboardMonth.type = "month";
  dashboardMonth.value = fixture.fiscalMonth;
  const grid = node(doc, "div", "business-data-coverage-grid");
  const cards = new Map();
  FACTS.forEach((fact) => {
    const card = node(doc, "article", "business-data-coverage-card");
    card.append(node(doc, "h4", "", fact.label));
    const count = node(doc, "p", "", "0件"); count.dataset.dbfCount = "true";
    const errors = node(doc, "p", "", "Error 0"); errors.dataset.dbfErrors = "true";
    const status = node(doc, "strong", "", "未登録"); status.dataset.dbfStatus = "true";
    card.append(count, errors, status);
    cards.set(fact.key, card);
    grid.append(card);
  });
  dashboard.append(dashboardTitle, dashboardMonth, grid);

  const history = node(doc, "section", "business-data-preview-panel");
  history.dataset.businessDataPanel = "history";
  history.hidden = true;
  history.append(node(doc, "h3", "", "取込履歴"));
  const historyList = node(doc, "ul", "business-data-history");
  history.append(historyList);
  renderHistoryItems(historyList, fixture.history || []);

  const refreshHistory = async (monthValue = dashboardMonth.value) => {
    dashboardMonth.value = monthValue || dashboardMonth.value;
    dashboardTitle.textContent = `${dashboardMonth.value} データ状況`;
    if (!enabled) {
      updateDashboardCards(cards, []);
      return;
    }
    try {
      const result = await DBF_IMPORT_RUNTIME.history({ fiscalMonth: dashboardMonth.value, limit: 100 });
      const items = result?.items || [];
      renderHistoryItems(historyList, items);
      updateDashboardCards(cards, items);
    } catch (_error) {
      renderHistoryItems(historyList, []);
      updateDashboardCards(cards, []);
    }
  };
  dashboardMonth.addEventListener("change", () => void refreshHistory());

  const panels = [dashboard, ...FACTS.map((fact) => renderImportPanel(doc, fact, enabled, refreshHistory)), history];
  const definitions = [["dashboard", "Dashboard"], ...FACTS.map((fact) => [fact.view, fact.label]), ["history", "取込履歴"]];
  definitions.forEach(([key, label], index) => {
    const button = node(doc, "button", `business-data-tab${index === 0 ? " is-active" : ""}`, label);
    button.type = "button";
    button.dataset.businessDataView = key;
    button.addEventListener("click", () => {
      [...tabs.children].forEach((item) => item.classList.toggle("is-active", item === button));
      panels.forEach((panel) => { panel.hidden = panel.dataset.businessDataPanel !== key; });
    });
    tabs.append(button);
  });

  container.append(header, tabs, ...panels);
  void refreshHistory();
  return true;
}
