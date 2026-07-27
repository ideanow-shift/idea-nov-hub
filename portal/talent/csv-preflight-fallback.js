(() => {
  const modulePath = "./csv-import-preflight.mjs?v=20260727-talent-28-csv-fallback-1";

  const safeCounts = [
    ["行数", "totalRows"],
    ["投入候補", "readyRows"],
    ["隔離候補", "quarantineRows"],
    ["接触", "contactsRows"],
    ["エントリー", "entriesRows"],
    ["内定", "offersRows"],
    ["連絡あり", "contactRows"],
    ["状態あり", "statusRows"],
    ["次回対応", "nextActionRows"],
    ["重複候補", "duplicateRows"],
    ["要確認", "reviewRows"]
  ];

  const count = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;

  const writeSummary = (documentObject, counts) => {
    const summary = documentObject.getElementById("talent-28-csv-summary");
    if (!summary) return;
    summary.replaceChildren(...safeCounts.map(([label, key]) => {
      const item = documentObject.createElement("div");
      const term = documentObject.createElement("dt");
      const description = documentObject.createElement("dd");
      const value = {
        contactRows: count(counts.phoneRows) + count(counts.emailRows) + count(counts.lineRows),
        statusRows: count(counts.entryStatusRows) + count(counts.selectionStatusRows) + count(counts.offerStatusRows),
        duplicateRows: count(counts.duplicateStableKeyHintRows) + count(counts.duplicateContactHintRows),
        reviewRows: count(counts.rowColumnMismatchRows) + count(counts.invalidSourceRowNoRows) + count(counts.duplicateSourceRowNoRows) + count(counts.invalidYearRows) + count(counts.invalidSourceRows) + count(counts.missingSourceLabelRows) + count(counts.missingIdentityRows) + count(counts.invalidDateRows) + count(counts.inconsistentQuarantineRows)
      }[key] ?? count(counts[key]);
      term.textContent = label;
      description.textContent = String(value);
      item.append(term, description);
      return item;
    }));
  };

  const writePlan = (documentObject, result, readiness) => {
    const plan = documentObject.getElementById("talent-28-csv-plan");
    const receipt = documentObject.getElementById("talent-28-csv-receipt");
    const route = documentObject.getElementById("talent-28-csv-correction-route");
    if (plan) {
      const steps = readiness.canRequestStagingPreflight
        ? ["件数カテゴリを確認", "別承認でstaging preflightへ進む", "canonical・LINE履歴・昇格はまだ行わない"]
        : ["CSV列・年度・由来・必須項目を修正", "個人値をチャットへ貼らず再度CSVを選択", "PASS後にstaging preflight承認へ進む"];
      plan.replaceChildren(...steps.map((label, index) => {
        const item = documentObject.createElement("li");
        item.textContent = `${index + 1}. ${label}`;
        return item;
      }));
    }
    if (receipt) {
      receipt.dataset.category = readiness.canRequestStagingPreflight ? "READY_FOR_STAGING_PREFLIGHT_APPROVAL" : "NEEDS_SAFE_FIX";
      receipt.textContent = readiness.canRequestStagingPreflight
        ? "CSV形式検証はPASSです。投入前承認へ進めます。"
        : "CSVの安全修正が必要です。DB・staging・canonical書き込みは行っていません。";
    }
    if (route) {
      route.dataset.category = result.fixedCategory;
      route.textContent = readiness.canRequestStagingPreflight
        ? "次の操作: 件数カテゴリを確認して、別承認でstaging preflightへ進みます。"
        : "次の操作: CSVを修正して、再度この画面で検証します。";
    }
  };

  const runFallbackPreflight = async () => {
    const documentObject = globalThis.document;
    const input = documentObject?.getElementById("talent-28-csv-file");
    const status = documentObject?.getElementById("talent-28-csv-status");
    const file = input?.files?.[0];
    if (!status) return;
    status.dataset.category = "CHECKING";
    status.textContent = "CSVを検証しています。完了までこの画面でお待ちください。";
    if (!file || !/\.csv$/i.test(file.name) || file.size > 5_000_000) {
      status.dataset.category = "NEEDS_FIX";
      status.textContent = "CSVファイルを選択してください。";
      return;
    }
    try {
      const module = await import(modulePath);
      const result = module.analyzeTalent28CsvPreflight(await file.text());
      const readiness = module.buildTalent28CsvImportReadiness(result);
      status.dataset.category = readiness.category;
      status.textContent = `${readiness.title}。${readiness.copy}`;
      writeSummary(documentObject, result.counts);
      writePlan(documentObject, result, readiness);
    } catch {
      status.dataset.category = "NEEDS_FIX";
      status.textContent = "CSV検証機能を読み込めませんでした。ページを強制更新してから、もう一度検証してください。";
    }
  };

  const bind = () => {
    const documentObject = globalThis.document;
    const runButton = documentObject?.getElementById("talent-28-csv-run");
    const input = documentObject?.getElementById("talent-28-csv-file");
    if (!runButton || runButton.dataset.fallbackBound === "true") return;
    runButton.dataset.fallbackBound = "true";
    runButton.addEventListener("click", runFallbackPreflight);
    input?.addEventListener("change", runFallbackPreflight);
  };

  if (globalThis.document?.readyState === "loading") {
    globalThis.document.addEventListener("DOMContentLoaded", bind, { once: true });
  } else {
    bind();
  }
})();
