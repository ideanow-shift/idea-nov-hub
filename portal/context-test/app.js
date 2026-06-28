import {
  HUB_CONTEXT_KEY,
  HUB_CONTEXT_QUERY_KEY,
  clearHubEmployeeContext,
  readHubEmployeeContext
} from "../js/hub-context.js";

const IDEA_LINK_ROLES = ["idea_link.staff", "idea_link.manager", "idea_link.admin"];

const elements = {
  statusCard: document.querySelector("#status-card"),
  statusMark: document.querySelector("#status-mark"),
  statusTitle: document.querySelector("#status-title"),
  statusMessage: document.querySelector("#status-message"),
  sourceBadge: document.querySelector("#source-badge"),
  employeeList: document.querySelector("#employee-list"),
  roleCount: document.querySelector("#role-count"),
  roleChips: document.querySelector("#role-chips"),
  ideaLinkStatus: document.querySelector("#idea-link-status"),
  diagnosticList: document.querySelector("#diagnostic-list"),
  rawJson: document.querySelector("#raw-json"),
  reloadContext: document.querySelector("#reload-context"),
  clearContext: document.querySelector("#clear-context"),
  copyJson: document.querySelector("#copy-json")
};

function text(value, fallback = "-") {
  const normalized = String(value ?? "").trim();
  return normalized || fallback;
}

function formatDateTime(value) {
  const time = Date.parse(value || "");
  if (!time) return "-";
  return new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(time));
}

function getStoredContextSource() {
  const params = new URLSearchParams(window.location.search);
  if (params.get(HUB_CONTEXT_QUERY_KEY)) return "URL hub_context";
  if (sessionStorage.getItem(HUB_CONTEXT_KEY)) return "sessionStorage";
  if (localStorage.getItem(HUB_CONTEXT_KEY)) return "localStorage";
  return "未取得";
}

function createRows(items) {
  const fragment = document.createDocumentFragment();
  items.forEach(([label, value]) => {
    const dt = document.createElement("dt");
    const dd = document.createElement("dd");
    dt.textContent = label;
    dd.textContent = text(value);
    fragment.append(dt, dd);
  });
  return fragment;
}

function renderStatus(context) {
  elements.statusCard.classList.toggle("is-ok", Boolean(context));
  elements.statusCard.classList.toggle("is-ng", !context);
  elements.statusMark.textContent = context ? "OK" : "!";
  elements.statusTitle.textContent = context ? "HUB Contextを受け取りました" : "HUB Contextがありません";
  elements.statusMessage.textContent = context
    ? "この画面をHUBのアプリカードから開くと、各アプリへ渡す社員IDと権限を確認できます。"
    : "NOV HUBにログイン後、HUB内のカードからこの画面を開いてください。直接URLを開くとContextは渡りません。";
}

function renderEmployee(context) {
  elements.sourceBadge.textContent = context ? text(context.sourceLabel || context.source) : "未取得";
  elements.employeeList.replaceChildren(createRows([
    ["schema", context?.schema],
    ["schemaVersion", context?.schemaVersion],
    ["employees.id", context?.id || context?.employeeId || context?.supabaseEmployeeId],
    ["社員番号", context?.employeeNumber],
    ["氏名", context?.name || context?.fullName || context?.displayName],
    ["メール", context?.email || context?.authEmail],
    ["店舗", context?.primaryStoreName || context?.storeName || context?.store],
    ["部署", context?.departmentName],
    ["役職", context?.positionName],
    ["ログイン方式", context?.authType],
    ["発行日時", formatDateTime(context?.issuedAt)],
    ["有効期限", formatDateTime(context?.expiresAt)]
  ]));
}

function renderRoles(context) {
  const roleKeys = Array.isArray(context?.roleKeys) ? context.roleKeys : [];
  elements.roleCount.textContent = String(roleKeys.length);
  if (!roleKeys.length) {
    const empty = document.createElement("p");
    empty.className = "caption";
    empty.textContent = "role_keysはありません。";
    elements.roleChips.replaceChildren(empty);
    return;
  }
  elements.roleChips.replaceChildren(...roleKeys.map((roleKey) => {
    const chip = document.createElement("span");
    chip.className = "chip";
    chip.textContent = roleKey;
    return chip;
  }));
}

function renderIdeaLink(context) {
  const roleKeys = new Set(Array.isArray(context?.roleKeys) ? context.roleKeys : []);
  elements.ideaLinkStatus.replaceChildren(...IDEA_LINK_ROLES.map((roleKey) => {
    const enabled = roleKeys.has(roleKey);
    const item = document.createElement("div");
    item.className = `permission-item${enabled ? " is-ok" : ""}`;
    item.innerHTML = `<strong>${roleKey}</strong><span>${enabled ? "付与されています" : "未付与"}</span>`;
    return item;
  }));
}

function renderDiagnostics(context) {
  const params = new URLSearchParams(window.location.search);
  elements.diagnosticList.replaceChildren(createRows([
    ["受け取り経路", getStoredContextSource()],
    ["URL hub_context", params.get(HUB_CONTEXT_QUERY_KEY) ? "あり" : "なし"],
    ["sessionStorage", sessionStorage.getItem(HUB_CONTEXT_KEY) ? "あり" : "なし"],
    ["localStorage", localStorage.getItem(HUB_CONTEXT_KEY) ? "あり" : "なし"],
    ["現在時刻", formatDateTime(new Date().toISOString())],
    ["Context有効", context ? "true" : "false"]
  ]));
}

function renderJson(context) {
  elements.rawJson.textContent = JSON.stringify(context || {}, null, 2);
}

function render() {
  const context = readHubEmployeeContext();
  renderStatus(context);
  renderEmployee(context);
  renderRoles(context);
  renderIdeaLink(context);
  renderDiagnostics(context);
  renderJson(context);
}

elements.reloadContext.addEventListener("click", render);
elements.clearContext.addEventListener("click", () => {
  clearHubEmployeeContext();
  render();
});
elements.copyJson.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(elements.rawJson.textContent);
    elements.copyJson.textContent = "コピーしました";
    window.setTimeout(() => {
      elements.copyJson.textContent = "JSONをコピー";
    }, 1800);
  } catch (error) {
    console.warn("JSON copy failed", error);
  }
});

render();
