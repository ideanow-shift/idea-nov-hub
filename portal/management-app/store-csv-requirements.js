const REQUIREMENT_KEYS = Object.freeze(["name", "fields", "purpose"]);

const CSV_TEMPLATES = Object.freeze([
  Object.freeze({ filename: "store-monthly-sales-template.csv", headers: Object.freeze(["対象月", "店舗", "売上"]) }),
  Object.freeze({ filename: "store-daily-sales-template.csv", headers: Object.freeze(["営業日", "店舗", "売上", "客数", "客単価"]) }),
  Object.freeze({ filename: "store-reservations-template.csv", headers: Object.freeze(["営業日", "店舗", "予約枠", "予約数"]) }),
]);

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

function createTemplate(requirement, template) {
  const csv = `\uFEFF${template.headers.map((value) => `"${value.replaceAll('"', '""')}"`).join(",")}\r\n`;
  return Object.freeze({
    name: requirement.name,
    fields: requirement.fields,
    purpose: requirement.purpose,
    filename: template.filename,
    csv,
    href: `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`,
  });
}

export function buildCsvRequirementsView(items) {
  if (!validateCsvRequirements(items)) {
    return Object.freeze({
      status: "INVALID",
      summary: "CSV要件を安全に確認できません。取込は実行しません。",
      labels: Object.freeze([]),
      templates: Object.freeze([]),
    });
  }
  return Object.freeze({
    status: "READY_FOR_FILE_PREPARATION",
    summary: "3ファイルの必要項目を確認し、ヘッダーだけのひな形を保存できます。データ取込はまだ実行しません。",
    labels: Object.freeze(items.map((item) => `${item.name}｜必要項目: ${item.fields}｜用途: ${item.purpose}`)),
    templates: Object.freeze(items.map((item, index) => createTemplate(item, CSV_TEMPLATES[index]))),
  });
}

export function renderCsvRequirements(container, items, documentRef = globalThis.document) {
  if (!container || !documentRef?.createElement) return false;
  const view = buildCsvRequirementsView(items);
  const heading = documentRef.createElement("h3");
  heading.textContent = "Data Operations Hubへ渡すデータ";
  const summary = documentRef.createElement("p");
  summary.textContent = view.summary;
  const list = documentRef.createElement("div");
  list.className = "csv-template-list";
  if (!view.templates.length) {
    const fallback = documentRef.createElement("p");
    fallback.textContent = "CSV要件の確認待ち";
    list.append(fallback);
  }
  view.templates.forEach((template) => {
    const item = documentRef.createElement("div");
    item.className = "csv-template-item";
    const copy = documentRef.createElement("div");
    const name = documentRef.createElement("strong");
    name.textContent = template.name;
    const detail = documentRef.createElement("span");
    detail.textContent = `必要項目: ${template.fields}｜用途: ${template.purpose}`;
    copy.append(name, detail);
    const download = documentRef.createElement("a");
    download.className = "csv-template-download";
    download.href = template.href;
    download.download = template.filename;
    download.textContent = "CSVひな形を保存";
    download.setAttribute("aria-label", `${template.name}のCSVひな形を保存`);
    item.append(copy, download);
    list.append(item);
  });
  container.dataset.csvRequirementStatus = view.status;
  container.replaceChildren(heading, summary, list);
  return true;
}
