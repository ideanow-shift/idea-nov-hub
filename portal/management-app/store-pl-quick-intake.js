import { buildFinancialLocalPreview, validateNormalizedMonthlyPlCsvFiles } from "./financial-data-intake.js?v=06AD1D86CD8B66B5";

function node(tagName, className = "", text = "") {
  const element = document.createElement(tagName);
  if (className) element.className = className;
  if (text) element.textContent = text;
  return element;
}

function statusMessage(result, fileCount) {
  if (result?.status === "PL_LOCAL_READY") {
    return `${fileCount}ファイルを端末内で確認しました。売上・利益の店舗分析を表示しています。本番保存はしていません。`;
  }
  return "P/Lを確認できませんでした。経理基準の店舗月次P/L CSVを選択してください。";
}

export function renderStorePlQuickIntake(container, { hasLocalPl = false } = {}) {
  if (!container) return false;
  if (container.dataset.storePlQuickIntakeMounted === "true") {
    const status = container.querySelector("[data-store-pl-quick-status]");
    if (status && hasLocalPl) status.textContent = "売上・利益のローカル確認中です。本番保存・承認・再計算は無効です。";
    return true;
  }

  container.dataset.storePlQuickIntakeMounted = "true";
  const section = node("section", "store-pl-quick-intake");
  const heading = node("div", "store-pl-quick-intake-heading");
  const copy = node("div");
  copy.append(
    node("p", "financial-intake-kicker", "STEP 1 / 売上・利益"),
    node("h3", "", "まず、経理基準の店舗月次P/Lを選択"),
    node("p", "", "手元の BASSA_R6・BASSA_R7・BASSA_R8 の店舗別月次PL CSVは、3つまとめて選択できます。選択後に総売上、技術売上、商品売上、EC売上、利益を店舗・月ごとに確認します。")
  );
  const boundary = node("span", "store-pl-quick-intake-boundary", "端末内の確認のみ");
  heading.append(copy, boundary);

  const selection = node("label", "store-pl-quick-intake-select", "3つの店舗月次P/L CSVを選択");
  const input = node("input");
  input.type = "file";
  input.accept = ".csv,text/csv";
  input.multiple = true;
  input.setAttribute("aria-label", "経理基準の店舗月次P/L CSVを選択");
  selection.append(input);

  const checklist = node("ul", "store-pl-quick-intake-list");
  [
    "BASSA_R6_店舗別月次PL.csv",
    "BASSA_R7_店舗別月次PL.csv",
    "BASSA_R8_店舗別月次PL.csv",
  ].forEach((fileName) => checklist.append(node("li", "", fileName)));
  const status = node("p", "store-pl-quick-intake-status", hasLocalPl
    ? "売上・利益のローカル確認中です。本番保存・承認・再計算は無効です。"
    : "この3ファイルを選択すると、店舗営業分析の最初の6指標を確認できます。");
  status.dataset.storePlQuickStatus = "true";

  input.addEventListener("change", async () => {
    const files = Array.from(input.files || []);
    if (!files.length) return;
    status.textContent = "P/Lを端末内で確認しています。";
    const result = await validateNormalizedMonthlyPlCsvFiles(files);
    const preview = buildFinancialLocalPreview(result);
    status.textContent = statusMessage(result, files.length);
    if (result?.status === "PL_LOCAL_READY" && preview?.statement === "PL") {
      container.dispatchEvent(new CustomEvent("management-financial-local-preview", { bubbles: true, detail: preview }));
    }
  });

  section.append(heading, selection, checklist, status);
  container.replaceChildren(section);
  return true;
}
