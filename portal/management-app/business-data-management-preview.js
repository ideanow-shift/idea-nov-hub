import { DBF_IMPORT_FLOW, STORE_MONTHLY_METRICS } from "./dbf-business-data-contract.js";

export const BUSINESS_DATA_PREVIEW_FIXTURE = Object.freeze({
  schemaVersion: "dbf-business-data-management-preview-v1",
  fiscalMonth: "2026-07",
  sections: Object.freeze([
    Object.freeze({ key: "PL", label: "月次P/L", company: "6/6", store: "13/13", errors: 0, status: "確認済み" }),
    Object.freeze({ key: "BS", label: "B/S", company: "6/6", store: "—", errors: 0, status: "確認済み" }),
    Object.freeze({ key: "STORE_OPERATING_RESULT", label: "営業実績", company: "—", store: "20/20", errors: 0, status: "確認済み" }),
    Object.freeze({ key: "BUDGET", label: "予算", company: "6/6", store: "20/20", errors: 0, status: "登録済み" }),
  ]),
  history: Object.freeze([
    Object.freeze({ fact: "月次P/L", version: 2, state: "promoted", correction: "v1を訂正", owner: "Owner確認済み" }),
    Object.freeze({ fact: "B/S", version: 1, state: "promoted", correction: "—", owner: "Owner確認済み" }),
  ]),
});

export const BUSINESS_DATA_EMPTY_FIXTURE = Object.freeze({
  schemaVersion: "dbf-business-data-management-preview-v1",
  fiscalMonth: "2026-07",
  sections: Object.freeze([
    Object.freeze({ key: "PL", label: "月次P/L", company: "0/対象数", store: "0/対象数", errors: 0, status: "未登録" }),
    Object.freeze({ key: "BS", label: "B/S", company: "0/対象数", store: "—", errors: 0, status: "未登録" }),
    Object.freeze({ key: "STORE_OPERATING_RESULT", label: "営業実績", company: "—", store: "0/対象数", errors: 0, status: "未登録" }),
    Object.freeze({ key: "BUDGET", label: "予算", company: "0/対象数", store: "0/対象数", errors: 0, status: "未登録" }),
  ]),
  history: Object.freeze([]),
});

function node(doc, tag, className, text = "") {
  const element = doc.createElement(tag);
  if (className) element.className = className;
  if (text) element.textContent = text;
  return element;
}

function renderDashboard(doc, fixture) {
  const panel = node(doc, "section", "business-data-preview-panel");
  panel.dataset.businessDataPanel = "dashboard";
  panel.append(node(doc, "h3", "", `${fixture.fiscalMonth.replace("-", "年")}月 データ充足状況`));
  const grid = node(doc, "div", "business-data-coverage-grid");
  fixture.sections.forEach((item) => {
    const card = node(doc, "article", "business-data-coverage-card");
    card.dataset.factKind = item.key;
    card.append(node(doc, "h4", "", item.label), node(doc, "p", "", `法人 ${item.company}`), node(doc, "p", "", `店舗 ${item.store}`), node(doc, "p", "", `Error ${item.errors}`), node(doc, "strong", "", item.status));
    grid.append(card);
  });
  panel.append(grid);
  return panel;
}

function renderFactPanel(doc, key) {
  const labels = { pl: "月次P/L", bs: "B/S", stores: "営業実績", budget: "予算" };
  const panel = node(doc, "section", "business-data-preview-panel");
  panel.dataset.businessDataPanel = key;
  panel.hidden = true;
  panel.append(node(doc, "h3", "", labels[key]), node(doc, "p", "", "Source-only Preview：ファイルは送信されず、Canonical Factへの書込も行いません。"));
  const flow = node(doc, "ol", "business-data-flow");
  DBF_IMPORT_FLOW.forEach((step) => flow.append(node(doc, "li", "", step)));
  panel.append(flow);
  if (key === "stores") panel.append(node(doc, "p", "business-data-metric-count", `Canonical metrics: ${Object.keys(STORE_MONTHLY_METRICS).length}`));
  const button = node(doc, "button", "business-data-disabled-action", "Owner承認後にPromotion");
  button.type = "button";
  button.disabled = true;
  panel.append(button);
  return panel;
}

function renderHistory(doc, fixture) {
  const panel = node(doc, "section", "business-data-preview-panel");
  panel.dataset.businessDataPanel = "history";
  panel.hidden = true;
  panel.append(node(doc, "h3", "", "取込履歴"));
  const list = node(doc, "ul", "business-data-history");
  fixture.history.forEach((item) => list.append(node(doc, "li", "", `${item.fact} / v${item.version} / ${item.state} / ${item.correction} / ${item.owner}`)));
  panel.append(list);
  return panel;
}

export function renderBusinessDataManagementPreview(container, options = {}) {
  const doc = options.document || container?.ownerDocument || globalThis.document;
  if (!container || !doc?.createElement || container.dataset.businessDataMounted === "true") return false;
  const fixture = options.fixture || BUSINESS_DATA_PREVIEW_FIXTURE;
  container.dataset.businessDataMounted = "true";
  container.dataset.runtimeImport = "DISABLED";
  container.dataset.productionWrite = "DISABLED";
  const header = node(doc, "div", "business-data-preview-heading");
  header.append(node(doc, "p", "eyebrow", "SYSTEM MASTER / ADMIN ONLY"), node(doc, "h2", "", "経営データ管理"), node(doc, "p", "", "月次P/L・B/S・営業実績・予算の取込前Preview"));
  const tabs = node(doc, "nav", "business-data-tabs");
  tabs.setAttribute("aria-label", "経営データ管理メニュー");
  const definitions = [["dashboard", "Dashboard"], ["pl", "月次P/L"], ["bs", "B/S"], ["stores", "営業実績"], ["budget", "予算"], ["history", "取込履歴"]];
  const panels = [renderDashboard(doc, fixture), renderFactPanel(doc, "pl"), renderFactPanel(doc, "bs"), renderFactPanel(doc, "stores"), renderFactPanel(doc, "budget"), renderHistory(doc, fixture)];
  definitions.forEach(([key, label], index) => {
    const button = node(doc, "button", `business-data-tab${index === 0 ? " is-active" : ""}`, label);
    button.type = "button";
    button.dataset.businessDataView = key;
    button.addEventListener("click", () => {
      tabs.children.forEach((item) => item.classList.toggle("is-active", item === button));
      panels.forEach((panel) => { panel.hidden = panel.dataset.businessDataPanel !== key; });
    });
    tabs.append(button);
  });
  container.append(header, tabs, ...panels);
  return true;
}
