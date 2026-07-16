const REQUIREMENT_KEYS = Object.freeze(["name", "fields", "purpose"]);

export const SANITIZED_CSV_REQUIREMENTS = Object.freeze([
  Object.freeze({ name: "店舗別月次売上", fields: "対象月・店舗・売上", purpose: "店舗KPI" }),
  Object.freeze({ name: "日次売上", fields: "営業日・店舗・売上・客数・客単価", purpose: "日次進捗" }),
  Object.freeze({ name: "予約状況", fields: "営業日・店舗・予約枠・予約数", purpose: "予約充足率" }),
]);

function exactKeys(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const keys = Object.keys(value);
  return keys.length === REQUIREMENT_KEYS.length && keys.every((key) => REQUIREMENT_KEYS.includes(key));
}

export function validateCsvRequirements(items) {
  return Array.isArray(items)
    && items.length === SANITIZED_CSV_REQUIREMENTS.length
    && items.every((item, index) => exactKeys(item)
      && REQUIREMENT_KEYS.every((key) => item[key] === SANITIZED_CSV_REQUIREMENTS[index][key]));
}

export function buildCsvRequirementsView(items) {
  if (!validateCsvRequirements(items)) {
    return Object.freeze({
      status: "INVALID",
      summary: "CSV要件を安全に確認できません。取込は実行しません。",
      labels: Object.freeze([]),
    });
  }
  return Object.freeze({
    status: "READY_FOR_FILE_PREPARATION",
    summary: "3ファイルの必要項目を確認できます。現在は準備状況の表示のみです。",
    labels: Object.freeze(items.map((item) => `${item.name}｜必要項目: ${item.fields}｜用途: ${item.purpose}`)),
  });
}

export function renderCsvRequirements(container, items, documentRef = globalThis.document) {
  if (!container || !documentRef?.createElement) return false;
  const view = buildCsvRequirementsView(items);
  const heading = documentRef.createElement("h3");
  heading.textContent = "Data Operations Hubへ渡すデータ";
  const summary = documentRef.createElement("p");
  summary.textContent = view.summary;
  const list = documentRef.createElement("ul");
  const labels = view.labels.length ? view.labels : ["CSV要件の確認待ち"];
  labels.forEach((label) => {
    const item = documentRef.createElement("li");
    item.textContent = label;
    list.append(item);
  });
  container.dataset.csvRequirementStatus = view.status;
  container.replaceChildren(heading, summary, list);
  return true;
}
