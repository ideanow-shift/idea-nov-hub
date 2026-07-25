export const WORKFORCE_EVIDENCE_CATEGORIES = Object.freeze([
  "AUTHORITATIVE_READY",
  "LOCAL_VALIDATED_PENDING_PRODUCTION",
  "SOURCE_CONTRACT_INCOMPLETE",
  "UNAVAILABLE",
]);

const MODEL_KEYS = Object.freeze([
  "category",
  "statusLabel",
  "summary",
  "sourceLabel",
  "productionEvidence",
  "aggregateValuesVisible",
  "relatedActionsEnabled",
  "facts",
]);
const FACT_KEYS = Object.freeze(["label", "value"]);
const HARD_RUNTIME_GATE = false;
const WORKFORCE_ALLOCATION_TEMPLATE_ROWS = Object.freeze([
  Object.freeze(["所属部門", "法人配賦", "店舗配賦", "配賦区分", "備考"]),
  Object.freeze(["本部", "IDEA NOV", "本部", "HQ_OR_SHARED", "例: 本部・総務・経理など共通部門"]),
  Object.freeze(["総務", "IDEA NOV", "本部", "HQ_OR_SHARED", "例: 本部共通費として扱う部門"]),
  Object.freeze(["経理", "IDEA NOV", "本部", "HQ_OR_SHARED", "例: 店舗へ直接人数配賦しない管理部門"]),
  Object.freeze(["教育", "IDEA NOV", "本部", "HQ_OR_SHARED", "例: 店舗へ直接配賦しない教育部門"]),
  Object.freeze(["採用", "IDEA NOV", "本部", "HQ_OR_SHARED", "例: 採用・人事など全社支援部門"]),
  Object.freeze(["店舗運営", "IDEA NOV", "BASSA所沢店", "STORE", "例: 特定店舗に紐づく部門"]),
  Object.freeze(["BASSA所沢店", "IDEA NOV", "BASSA所沢店", "STORE", "例: 部門名が店舗名と一致する場合"]),
  Object.freeze(["BASSA新所沢店", "ALBERO", "BASSA新所沢店", "STORE", "例: 法人が別会社の店舗"]),
  Object.freeze(["BASSA久米川店", "UNO", "BASSA久米川店", "STORE", "例: FC法人の店舗"]),
  Object.freeze(["BASSA所沢店アシスタント", "IDEA NOV", "BASSA所沢店", "STORE", "例: 職種名が付いた部門は店舗へ寄せる"]),
  Object.freeze(["BASSA所沢店スタイリスト", "IDEA NOV", "BASSA所沢店", "STORE", "例: 同じ店舗の職種別部門"]),
  Object.freeze(["KYARA HALF", "IDEA NOV", "KYARA HALF", "STORE", "例: 店舗候補名をそのまま使う"]),
  Object.freeze(["FC店舗候補", "UNO", "BASSA久米川店", "STORE", "例: 法人と店舗を両方入力"]),
  Object.freeze(["LUA店舗候補", "LUA", "店舗名確認中", "STORE", "例: 店舗名は後で正式名へ直す"]),
  Object.freeze(["法人のみ判明", "BIOEL", "", "UNASSIGNED_REVIEW", "例: 店舗が未確定なら要確認のまま"]),
  Object.freeze(["所属なし", "", "", "UNASSIGNED_REVIEW", "例: 不明・未配賦はこのまま要確認"]),
  Object.freeze(["不明部門", "", "", "UNASSIGNED_REVIEW", "例: 判断できない部門は無理に埋めない"]),
  Object.freeze(["退職者・過去所属", "", "", "UNASSIGNED_REVIEW", "例: 月末/as-of契約が未確定なら要確認"]),
]);
const WORKFORCE_ALLOCATION_HEADER = WORKFORCE_ALLOCATION_TEMPLATE_ROWS[0];
const WORKFORCE_ALLOCATION_STATUSES = Object.freeze([
  "WORKFORCE_ALLOCATION_LOCAL_EVIDENCE",
  "WORKFORCE_STORE_MASTER_LOCAL_EVIDENCE",
  "WORKFORCE_ALLOCATION_FILE_INVALID",
  "WORKFORCE_ALLOCATION_FORMAT_INVALID",
  "WORKFORCE_ALLOCATION_SCOPE_INCOMPLETE",
]);
const WORKFORCE_ALLOCATION_KINDS = new Set(["STORE", "HQ_OR_SHARED", "UNASSIGNED_REVIEW"]);
const CURRENT_HUB_STORE_WORKFORCE_HEADER = Object.freeze([
  "元_所属",
  "元_主店舗名",
  "元_部署",
  "対象件数",
  "経営管理_店舗",
  "経営管理_配賦区分",
  "経営管理_在籍人数区分",
  "経営管理_稼働人数区分",
  "経営管理_法人状態",
  "経営管理_確認ステータス",
  "備考",
]);
const CURRENT_HUB_RESIDENT_KINDS = new Set(["INCLUDE_RESIDENT"]);
const CURRENT_HUB_WORKING_KINDS = new Set(["INCLUDE_WORKING", "EXCLUDE_NON_WORKING_LEAVE"]);

export const SANITIZED_WORKFORCE_EVIDENCE = Object.freeze({
  category: "LOCAL_VALIDATED_PENDING_PRODUCTION",
  statusLabel: "社員マスタ確認済み・本番反映待ち",
  summary: "現行HUB社員マスタを正本候補として店舗スタッフ人数をローカル集計済みです。産休・育休等は在籍に含め、稼働には含めません。個人を特定できる項目やセンシティブ項目は表示しません。",
  sourceLabel: "現行HUB社員マスタ",
  productionEvidence: "PENDING",
  aggregateValuesVisible: true,
  relatedActionsEnabled: false,
  facts: Object.freeze([
    Object.freeze({ label: "社員マスタ行", value: "190件" }),
    Object.freeze({ label: "在籍候補", value: "190名" }),
    Object.freeze({ label: "稼働候補", value: "189名" }),
    Object.freeze({ label: "稼働除外在籍", value: "1名" }),
    Object.freeze({ label: "現職所属未定", value: "0名" }),
    Object.freeze({ label: "店舗集計候補", value: "32区分" }),
    Object.freeze({ label: "法人配賦", value: "別マスタ待ち" }),
    Object.freeze({ label: "本部共通", value: "分離表示" }),
    Object.freeze({ label: "本番反映", value: "disabled" }),
  ]),
});

function exactKeys(value, expected) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const keys = Object.keys(value);
  return keys.length === expected.length && keys.every((key) => expected.includes(key));
}

function validateFact(fact) {
  return exactKeys(fact, FACT_KEYS)
    && typeof fact.label === "string"
    && typeof fact.value === "string"
    && fact.label.length >= 1
    && fact.label.length <= 24
    && fact.value.length >= 1
    && fact.value.length <= 32
    && !/(employeeId|employee_id|社員番号|氏名|給与|評価|健康|token|session|digest|sha256)/iu.test(`${fact.label} ${fact.value}`);
}

export function validateWorkforceEvidenceModel(model) {
  return exactKeys(model, MODEL_KEYS)
    && model.category === SANITIZED_WORKFORCE_EVIDENCE.category
    && model.statusLabel === SANITIZED_WORKFORCE_EVIDENCE.statusLabel
    && model.summary === SANITIZED_WORKFORCE_EVIDENCE.summary
    && model.sourceLabel === SANITIZED_WORKFORCE_EVIDENCE.sourceLabel
    && model.productionEvidence === SANITIZED_WORKFORCE_EVIDENCE.productionEvidence
    && model.aggregateValuesVisible === true
    && model.relatedActionsEnabled === false
    && Array.isArray(model.facts)
    && model.facts.length === SANITIZED_WORKFORCE_EVIDENCE.facts.length
    && model.facts.every((fact, index) => validateFact(fact)
      && fact.label === SANITIZED_WORKFORCE_EVIDENCE.facts[index].label
      && fact.value === SANITIZED_WORKFORCE_EVIDENCE.facts[index].value);
}

export function canDisplayWorkforceAggregates(model = SANITIZED_WORKFORCE_EVIDENCE) {
  return HARD_RUNTIME_GATE === true
    && validateWorkforceEvidenceModel(model)
    && model.category === "AUTHORITATIVE_READY"
    && model.aggregateValuesVisible === true;
}

export function localWorkforceAggregateMetric(model = SANITIZED_WORKFORCE_EVIDENCE) {
  if (!validateWorkforceEvidenceModel(model) || model.category !== "LOCAL_VALIDATED_PENDING_PRODUCTION") return null;
  if (model.aggregateValuesVisible !== true) return null;
  const workingFact = model.facts[2];
  return workingFact?.value ? `社員マスタ ${workingFact.value}` : null;
}

function csvCell(value) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

export function buildWorkforceAllocationTemplateCsv() {
  return `\uFEFF${WORKFORCE_ALLOCATION_TEMPLATE_ROWS.map((row) => row.map(csvCell).join(",")).join("\r\n")}\r\n`;
}

export function workforceAllocationTemplateFile() {
  const csv = buildWorkforceAllocationTemplateCsv();
  return Object.freeze({
    fileName: "management-workforce-department-allocation-template.csv",
    mimeType: "text/csv;charset=utf-8;header=present",
    rowCount: WORKFORCE_ALLOCATION_TEMPLATE_ROWS.length - 1,
    href: `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`,
  });
}

function parseCsvRows(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (quoted && char === '"' && next === '"') { cell += '"'; index += 1; continue; }
    if (char === '"') { quoted = !quoted; continue; }
    if (!quoted && char === ",") { row.push(cell); cell = ""; continue; }
    if (!quoted && (char === "\n" || char === "\r")) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell);
      if (row.some((value) => value.length)) rows.push(row);
      row = [];
      cell = "";
      continue;
    }
    cell += char;
  }
  row.push(cell);
  if (row.some((value) => value.length)) rows.push(row);
  return quoted ? null : rows;
}

export function validateWorkforceAllocationCsv(text) {
  if (typeof text !== "string" || !text.length || text.length > 64 * 1024) {
    return { status: "WORKFORCE_ALLOCATION_FILE_INVALID", departmentCount: 0, storeMappedCount: 0, unassignedReviewCount: 0 };
  }
  if (/\uFFFD|employeeId|employee_id|社員番号|氏名|給与|評価|健康|個人名|メール|電話|住所|token|session|digest|sha256/iu.test(text)) {
    return { status: "WORKFORCE_ALLOCATION_FORMAT_INVALID", departmentCount: 0, storeMappedCount: 0, unassignedReviewCount: 0 };
  }
  const rows = parseCsvRows(text.replace(/^\uFEFF/u, ""));
  if (!rows || rows.length < 2 || rows.length > 81) {
    return { status: "WORKFORCE_ALLOCATION_FORMAT_INVALID", departmentCount: 0, storeMappedCount: 0, unassignedReviewCount: 0 };
  }
  const [header, ...body] = rows;
  if (header.length === CURRENT_HUB_STORE_WORKFORCE_HEADER.length && header.every((value, index) => value === CURRENT_HUB_STORE_WORKFORCE_HEADER[index])) {
    return validateCurrentHubStoreWorkforceRows(body);
  }
  if (header.length !== WORKFORCE_ALLOCATION_HEADER.length || !header.every((value, index) => value === WORKFORCE_ALLOCATION_HEADER[index])) {
    return { status: "WORKFORCE_ALLOCATION_FORMAT_INVALID", departmentCount: 0, storeMappedCount: 0, unassignedReviewCount: 0 };
  }
  const seen = new Set();
  let storeMappedCount = 0;
  let unassignedReviewCount = 0;
  for (const row of body) {
    if (row.length !== WORKFORCE_ALLOCATION_HEADER.length) {
      return { status: "WORKFORCE_ALLOCATION_FORMAT_INVALID", departmentCount: 0, storeMappedCount: 0, unassignedReviewCount: 0 };
    }
    const [department, corporation, store, kind] = row.map((value) => String(value || "").trim());
    if (!department || seen.has(department) || !WORKFORCE_ALLOCATION_KINDS.has(kind)) {
      return { status: "WORKFORCE_ALLOCATION_FORMAT_INVALID", departmentCount: 0, storeMappedCount: 0, unassignedReviewCount: 0 };
    }
    seen.add(department);
    if (kind === "STORE") {
      if (!corporation || !store) return { status: "WORKFORCE_ALLOCATION_SCOPE_INCOMPLETE", departmentCount: seen.size, storeMappedCount, unassignedReviewCount };
      storeMappedCount += 1;
    }
    if (kind === "HQ_OR_SHARED" && !corporation) return { status: "WORKFORCE_ALLOCATION_SCOPE_INCOMPLETE", departmentCount: seen.size, storeMappedCount, unassignedReviewCount };
    if (kind === "UNASSIGNED_REVIEW") unassignedReviewCount += 1;
  }
  return {
    status: "WORKFORCE_ALLOCATION_LOCAL_EVIDENCE",
    departmentCount: seen.size,
    storeMappedCount,
    unassignedReviewCount,
  };
}

function safeIntegerText(value) {
  return /^(?:0|[1-9]\d{0,4})$/u.test(value);
}

function validateCurrentHubStoreWorkforceRows(body) {
  const seen = new Set();
  let storeMappedCount = 0;
  let unassignedReviewCount = 0;
  let residentCount = 0;
  let workingCount = 0;
  let nonWorkingResidentCount = 0;
  for (const row of body) {
    if (row.length !== CURRENT_HUB_STORE_WORKFORCE_HEADER.length) {
      return { status: "WORKFORCE_ALLOCATION_FORMAT_INVALID", departmentCount: 0, storeMappedCount: 0, unassignedReviewCount: 0 };
    }
    const [
      sourceAffiliation,
      sourcePrimaryStore,
      sourceDepartment,
      rawCount,
      managementStore,
      kind,
      residentKind,
      workingKind,
      corporationStatus,
      reviewStatus,
    ] = row.map((value) => String(value || "").trim());
    const key = `${sourceAffiliation}\u001f${sourcePrimaryStore}\u001f${sourceDepartment}\u001f${residentKind}\u001f${workingKind}`;
    if (
      !sourceAffiliation
      || !sourcePrimaryStore
      || !sourceDepartment
      || !safeIntegerText(rawCount)
      || !managementStore
      || seen.has(key)
      || !WORKFORCE_ALLOCATION_KINDS.has(kind)
      || !CURRENT_HUB_RESIDENT_KINDS.has(residentKind)
      || !CURRENT_HUB_WORKING_KINDS.has(workingKind)
      || corporationStatus !== "CORPORATION_MAPPING_SEPARATE"
      || reviewStatus !== "DRAFT_FROM_CURRENT_HUB_EXPORT"
    ) {
      return { status: "WORKFORCE_ALLOCATION_FORMAT_INVALID", departmentCount: 0, storeMappedCount: 0, unassignedReviewCount: 0 };
    }
    seen.add(key);
    const count = Number(rawCount);
    residentCount += count;
    if (workingKind === "INCLUDE_WORKING") workingCount += count;
    if (workingKind === "EXCLUDE_NON_WORKING_LEAVE") nonWorkingResidentCount += count;
    if (kind === "STORE") storeMappedCount += 1;
    if (kind === "UNASSIGNED_REVIEW") unassignedReviewCount += 1;
  }
  if (!seen.size || residentCount !== workingCount + nonWorkingResidentCount) {
    return { status: "WORKFORCE_ALLOCATION_FORMAT_INVALID", departmentCount: 0, storeMappedCount: 0, unassignedReviewCount: 0 };
  }
  return {
    status: "WORKFORCE_STORE_MASTER_LOCAL_EVIDENCE",
    departmentCount: seen.size,
    storeMappedCount,
    unassignedReviewCount,
    residentCount,
    workingCount,
    nonWorkingResidentCount,
  };
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function invalidEvidence() {
  return Object.freeze({
    category: "UNAVAILABLE",
    statusLabel: "利用不可",
    summary: "算定根拠状態を安全に確認できないため、人数・組織集計値を表示しません。",
    sourceLabel: "未確認",
    productionEvidence: "UNAVAILABLE",
    aggregateValuesVisible: false,
    relatedActionsEnabled: false,
    facts: Object.freeze([
      Object.freeze({ label: "状態", value: "UNAVAILABLE" }),
      Object.freeze({ label: "本番反映", value: "disabled" }),
    ]),
  });
}

function renderFacts(facts) {
  return facts.map((fact) => `
        <div><dt>${escapeHtml(fact.label)}</dt><dd>${escapeHtml(fact.value)}</dd></div>`).join("");
}

function workforceAllocationReceiptLabel(receipt) {
  const labels = {
    WORKFORCE_ALLOCATION_LOCAL_EVIDENCE: `ローカル確認済み: 部門 ${receipt.departmentCount} / 店舗配賦 ${receipt.storeMappedCount} / 要確認 ${receipt.unassignedReviewCount}`,
    WORKFORCE_STORE_MASTER_LOCAL_EVIDENCE: `社員マスタ確認済み: 在籍 ${receipt.residentCount} / 稼働 ${receipt.workingCount} / 稼働除外 ${receipt.nonWorkingResidentCount}`,
    WORKFORCE_ALLOCATION_FILE_INVALID: "UTF-8 CSV、64KB以下の配賦CSVを選択してください。",
    WORKFORCE_ALLOCATION_FORMAT_INVALID: "配賦CSVの列・行・固定categoryが一致しません。",
    WORKFORCE_ALLOCATION_SCOPE_INCOMPLETE: "法人または店舗の配賦欄が未確定です。",
  };
  return labels[receipt?.status] || "配賦CSVを検証できませんでした。";
}

export function renderWorkforceEvidenceStatus(model = SANITIZED_WORKFORCE_EVIDENCE) {
  const view = validateWorkforceEvidenceModel(model) && HARD_RUNTIME_GATE === false ? model : invalidEvidence();
  const template = view.category === "LOCAL_VALIDATED_PENDING_PRODUCTION" ? workforceAllocationTemplateFile() : null;
  return `
    <section class="workforce-evidence-status" data-workforce-evidence-category="${escapeHtml(view.category)}" aria-label="人数・組織集計の算定根拠状態">
      <div class="workforce-evidence-head">
        <div>
          <p class="workforce-evidence-kicker">Workforce Evidence</p>
          <h3>人数・組織集計の算定根拠</h3>
        </div>
        <span class="workforce-evidence-badge">${escapeHtml(view.statusLabel)}</span>
      </div>
      <p class="workforce-evidence-summary">${escapeHtml(view.summary)}</p>
      <dl class="workforce-evidence-facts">
        <div><dt>正本</dt><dd>${escapeHtml(view.sourceLabel)}</dd></div>
        <div><dt>本番証跡</dt><dd>${escapeHtml(view.productionEvidence)}</dd></div>${renderFacts(view.facts)}</dl>
      <div class="workforce-evidence-action">
        <button type="button" disabled aria-disabled="true" title="本番反映契約の確定まで利用できません">関連AI・承認</button>
        ${template ? `<a class="workforce-evidence-template" href="${template.href}" download="${escapeHtml(template.fileName)}">部門配賦CSVを保存</a>` : ""}
        ${template ? `<label class="workforce-evidence-template">配賦CSVを確認<input data-workforce-allocation-input type="file" accept=".csv,text/csv" hidden></label>` : ""}
        ${template ? `<span data-workforce-allocation-status>配賦CSVは未確認です。</span>` : ""}
        <span>現行HUB社員マスタのローカル集計は確認済みです。本番反映・承認・再計算はdisabledです。</span>
      </div>
    </section>`;
}

export function mountWorkforceEvidenceStatus(container, model = SANITIZED_WORKFORCE_EVIDENCE, options = {}) {
  if (!container || typeof container !== "object" || !("innerHTML" in container)) return false;
  container.innerHTML = renderWorkforceEvidenceStatus(model);
  const input = typeof container.querySelector === "function" ? container.querySelector("[data-workforce-allocation-input]") : null;
  const status = typeof container.querySelector === "function" ? container.querySelector("[data-workforce-allocation-status]") : null;
  if (status && options.currentReceipt) {
    container.dataset.workforceAllocationStatus = options.currentReceipt.status;
    status.textContent = workforceAllocationReceiptLabel(options.currentReceipt);
  }
  if (input && status) {
    input.addEventListener("change", async (event) => {
      const target = event.currentTarget;
      const file = target?.files?.[0];
      let receipt = { status: "WORKFORCE_ALLOCATION_FILE_INVALID", departmentCount: 0, storeMappedCount: 0, unassignedReviewCount: 0 };
      try {
        if (!file || !/\.csv$/iu.test(String(file.name || "")) || Number(file.size) <= 0 || Number(file.size) > 64 * 1024) throw new Error("invalid");
        const text = new TextDecoder("utf-8", { fatal: true }).decode(await file.arrayBuffer());
        receipt = validateWorkforceAllocationCsv(text);
      } catch {
        receipt = { status: "WORKFORCE_ALLOCATION_FILE_INVALID", departmentCount: 0, storeMappedCount: 0, unassignedReviewCount: 0 };
      }
      container.dataset.workforceAllocationStatus = receipt.status;
      status.textContent = workforceAllocationReceiptLabel(receipt);
      if (typeof options.onReceipt === "function") {
        options.onReceipt(["WORKFORCE_ALLOCATION_LOCAL_EVIDENCE", "WORKFORCE_STORE_MASTER_LOCAL_EVIDENCE"].includes(receipt.status) ? receipt : null);
      }
      if (target) target.value = "";
    });
  }
  return true;
}
