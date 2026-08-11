const CONTRACT_VERSION = "1.1.0";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const METRICS = Object.freeze([
  ["CONTACT_COUNT", "接触"], ["SALON_VISIT_COUNT", "サロン見学"], ["APPLICATION_COUNT", "応募"],
  ["OFFERED_COUNT", "内定"], ["OFFER_ACCEPTED_COUNT", "内定承諾"]
]);
const CHANNELS = Object.freeze([
  ["JOB_FAIR", "就職フェア"], ["SCHOOL_GUIDANCE", "学校ガイダンス"], ["SCHOOL_VISIT", "学校訪問"],
  ["PAID_JOB_MEDIA", "有料求人媒体"], ["FREE_JOB_MEDIA", "無料求人媒体"], ["SNS", "SNS"],
  ["OWNED_WEB", "自社Web"], ["REFERRAL", "リファラル"], ["HELLO_WORK", "ハローワーク"],
  ["REHIRE", "再雇用"], ["DEALER_REFERRAL", "ディーラー紹介"], ["OTHER", "その他"]
]);

export function planningAdminWriteEnabled(canWritePlanning, globalObject = globalThis) {
  const config = globalObject?.NOV_TALENT_CONFIG;
  return config?.runtimeMode === "staging" && config?.networkEnabled === true && config?.writeEnabled === true &&
    canWritePlanning === true && /^https:\/\//u.test(String(config?.writeApiBaseUrl || ""));
}

export function createRecruitingPlanningAdminClient({ globalObject = globalThis, fetchImpl = globalObject.fetch, hubSessionHelper = globalObject.NovHubSession } = {}) {
  const base = String(globalObject?.NOV_TALENT_CONFIG?.readonlyApiBaseUrl || "").replace(/\/+$/u, "");
  if (!/^https:\/\//u.test(base) || typeof fetchImpl !== "function" || typeof hubSessionHelper?.getSessionToken !== "function") return null;
  let canWritePlanning = false;
  const request = async (path, { method = "GET", body, write = false, capability = false, correction = false } = {}) => {
    if (write && !planningAdminWriteEnabled(canWritePlanning, globalObject)) return Object.freeze({ ok: false, category: "writes_disabled", requestCount: 0 });
    let token;
    try { token = await hubSessionHelper.getSessionToken(); } catch { return Object.freeze({ ok: false, category: "auth_required", requestCount: 0 }); }
    if (typeof token !== "string" || token.trim().length < 20) return Object.freeze({ ok: false, category: "auth_required", requestCount: 0 });
    try {
      const response = await fetchImpl(`${base}${path}`, {
        method, credentials: "omit", cache: "no-store",
        headers: { Accept: "application/json", "Content-Type": "application/json", Authorization: `Bearer ${token.trim()}` },
        body: body === undefined ? undefined : JSON.stringify(body)
      });
      const envelope = await response.json().catch(() => null);
      if (response.status === 401) return Object.freeze({ ok: false, category: "auth_required", requestCount: 1 });
      if (!response.ok || envelope?.ok !== true) return Object.freeze({ ok: false, category: safeCategory(envelope?.safeCode, response.status), requestCount: 1 });
      if (capability) {
        const data = cleanCapability(envelope.data);
        if (!data) return Object.freeze({ ok: false, category: "invalid_response", requestCount: 1 });
        canWritePlanning = data.canWritePlanning;
        return Object.freeze({ ok: true, data, requestCount: 1 });
      }
      if (correction) {
        const data = method === "GET" ? cleanCorrectionPreflight(envelope.data) : envelope.data?.state === "COMPLETED" ? Object.freeze({ state: "COMPLETED" }) : null;
        return data ? Object.freeze({ ok: true, data, requestCount: 1 }) : Object.freeze({ ok: false, category: "invalid_response", requestCount: 1 });
      }
      const data = cleanEnvelope(envelope.data);
      return data ? Object.freeze({ ok: true, data, requestCount: 1 }) : Object.freeze({ ok: false, category: "invalid_response", requestCount: 1 });
    } catch { return Object.freeze({ ok: false, category: "api_error", requestCount: 1 }); }
  };
  return Object.freeze({
    capability: () => request("/api/talent/v1/recruiting-planning/capability", { capability: true }),
    current: () => request("/api/talent/v1/recruiting-planning/current"),
    drafts: () => request("/api/talent/v1/recruiting-planning/drafts"),
    history: () => request("/api/talent/v1/recruiting-planning/history"),
    correctionPreflight: () => request("/api/talent/v1/recruiting-planning/corrections/new-grad-2027/preflight", { correction: true }),
    executeCorrection: () => request("/api/talent/v1/recruiting-planning/corrections/new-grad-2027", { method: "POST", body: {}, write: true, correction: true }),
    createTargetDraft: (body) => request("/api/talent/v1/recruiting-planning/targets/drafts", { method: "POST", body, write: true }),
    createBudgetDraft: (body) => request("/api/talent/v1/recruiting-planning/budgets/drafts", { method: "POST", body, write: true }),
    approveTarget: (id, rowVersion) => UUID.test(id) ? request(`/api/talent/v1/recruiting-planning/targets/${id}/approve`, { method: "POST", body: { expectedRowVersion: rowVersion }, write: true }) : Promise.resolve({ ok: false, category: "invalid_request", requestCount: 0 }),
    approveBudget: (id, rowVersion) => UUID.test(id) ? request(`/api/talent/v1/recruiting-planning/budgets/${id}/approve`, { method: "POST", body: { expectedRowVersion: rowVersion }, write: true }) : Promise.resolve({ ok: false, category: "invalid_request", requestCount: 0 })
  });
}

export function buildTargetDraft(form, track) {
  const year = track === "NEW_GRAD" ? integer(form.graduationYear) : null;
  const count = integer(form.targetCount);
  if (!['NEW_GRAD','MID_CAREER'].includes(track) || (track === "NEW_GRAD" && (year < 2020 || year > 2100)) || count < 0 ||
      !dateRange(form.periodStart, form.periodEnd) || !dateRange(form.effectiveFrom, form.effectiveTo) || !METRICS.some(([code]) => code === form.targetMetric) || !reason(form.reason)) return null;
  return Object.freeze({ recruitingTrack: track, graduationYear: year, targetMetric: form.targetMetric,
    periodCode: periodCode(track, year, form.periodStart, form.periodEnd), periodStart: form.periodStart, periodEnd: form.periodEnd,
    targetCount: count, effectiveFrom: form.effectiveFrom, effectiveTo: form.effectiveTo, reason: form.reason.trim() });
}

export function buildBudgetDraft(form, track) {
  const year = track === "NEW_GRAD" ? integer(form.graduationYear) : null;
  const total = integer(form.totalBudget);
  const lines = Array.isArray(form.lines) ? form.lines.filter((line) => line.amount !== "" || String(line.reason || "").trim() !== "").map((line) => ({ channelCode: line.channelCode, amount: integer(line.amount), reason: String(line.reason || "").trim() })) : [];
  if (!['NEW_GRAD','MID_CAREER'].includes(track) || (track === "NEW_GRAD" && (year < 2020 || year > 2100)) || total < 0 ||
      !dateRange(form.periodStart, form.periodEnd) || !dateRange(form.effectiveFrom, form.effectiveTo) || !reason(form.reason) ||
      lines.some((line) => !CHANNELS.some(([code]) => code === line.channelCode) || line.amount < 0 || !reason(line.reason)) || new Set(lines.map((line) => line.channelCode)).size !== lines.length || lines.reduce((sum, line) => sum + line.amount, 0) > total) return null;
  return Object.freeze({ recruitingTrack: track, graduationYear: year, periodCode: periodCode(track, year, form.periodStart, form.periodEnd),
    periodStart: form.periodStart, periodEnd: form.periodEnd, totalBudget: total, currency: "JPY",
    effectiveFrom: form.effectiveFrom, effectiveTo: form.effectiveTo, reason: form.reason.trim(), lines: Object.freeze(lines) });
}

export function initializeRecruitingPlanningAdmin(documentObject = globalThis.document, globalObject = globalThis) {
  const panel = documentObject?.getElementById?.("planning-admin-panel");
  if (!panel || panel.dataset.bound) return null;
  const client = createRecruitingPlanningAdminClient({ globalObject });
  if (!client) return null;
  panel.dataset.bound = "true";
  let track = "NEW_GRAD";
  let state = { current: emptyData("APPROVED"), drafts: emptyData("DRAFT"), history: emptyData("HISTORY") };
  let writeEnabled = false;
  let correctionReady = false, correctionSubmitting = false;
  const status = documentObject.getElementById("planning-admin-status");
  const message = documentObject.getElementById("planning-admin-message");
  const targetForm = documentObject.getElementById("planning-target-form");
  const budgetForm = documentObject.getElementById("planning-budget-form");
  const targetSave = documentObject.getElementById("planning-target-save");
  const budgetSave = documentObject.getElementById("planning-budget-save");
  const correctionPanel=documentObject.getElementById("planning-correction-operator"),correctionStatus=documentObject.getElementById("planning-correction-status"),correctionOpen=documentObject.getElementById("planning-correction-open"),correctionDialog=documentObject.getElementById("planning-correction-dialog"),correctionConfirm=documentObject.getElementById("planning-correction-confirm");
  const applyWriteCapability = (enabled) => {
    writeEnabled = planningAdminWriteEnabled(enabled, globalObject);
    targetSave.disabled = !writeEnabled; budgetSave.disabled = !writeEnabled;
    if(correctionOpen)correctionOpen.disabled=!(writeEnabled&&correctionReady)||correctionSubmitting;
    panel.querySelectorAll("[data-planning-write-note]").forEach((node) => { node.hidden = writeEnabled; });
  };
  applyWriteCapability(false);
  renderBudgetLines(documentObject);

  const load = async () => {
    status.textContent = "確認しています";
    const [capability, current, drafts, history, correction] = await Promise.all([client.capability(), client.current(), client.drafts(), client.history(), client.correctionPreflight()]);
    if (![capability, current, drafts, history].every((result) => result.ok)) {
      applyWriteCapability(false);
      const auth = [capability, current, drafts, history].some((result) => result.category === "auth_required");
      status.textContent = auth ? "セッションの有効期限が切れました。HUBへ戻り、求人管理を開き直してください。" : "集計準備中";
      return false;
    }
    applyWriteCapability(capability.data.canWritePlanning);
    correctionReady=correction.ok&&correction.data.state==="PASS"&&correction.data.exactPreflightPassed===true;
    if(correctionPanel)correctionPanel.hidden=!(track==="NEW_GRAD"&&correction.ok);
    if(correctionStatus)correctionStatus.textContent=correction.ok?(correction.data.state==="PASS"?(correction.data.canExecute?"実行準備完了":"事前確認済み・実行停止中"):correction.data.state==="COMPLETED"?"訂正済み":"実行条件が一致しません"):"事前確認を完了できませんでした";
    if(correctionOpen){correctionOpen.hidden=correction.ok&&correction.data.state==="COMPLETED";correctionOpen.disabled=!(writeEnabled&&correctionReady);}
    state = { current: current.data, drafts: drafts.data, history: history.data };
    status.textContent = writeEnabled ? "登録・承認できます" : "読み取りのみ（登録はOwner承認待ち）";
    renderAll(); return true;
  };
  correctionOpen?.addEventListener("click",()=>{if(!correctionOpen.disabled&&correctionDialog?.showModal)correctionDialog.showModal();});
  documentObject.getElementById("planning-correction-cancel")?.addEventListener("click",()=>correctionDialog?.close());
  correctionDialog?.addEventListener("cancel",()=>correctionDialog.close());
  correctionConfirm?.addEventListener("click",async()=>{if(correctionSubmitting||!writeEnabled||!correctionReady)return;correctionSubmitting=true;correctionConfirm.disabled=true;correctionOpen.disabled=true;const result=await client.executeCorrection();correctionDialog.close();if(correctionStatus)correctionStatus.textContent=result.ok?"訂正が完了しました":operationMessage(result.category);correctionSubmitting=false;correctionConfirm.disabled=false;if(result.ok){correctionReady=false;await load();}else correctionOpen.disabled=!(writeEnabled&&correctionReady);});
  const renderAll = () => {
    const context = readContext(documentObject, track);
    renderSummary(documentObject, state.current, track, context);
    renderVersions(documentObject, "planning-draft-list", state.drafts, track, context, writeEnabled, approve);
    renderVersions(documentObject, "planning-history-list", state.history, track, context, false, approve);
  };
  const approve = async (kind, id, rowVersion) => {
    message.textContent = "承認しています";
    const result = kind === "TARGET" ? await client.approveTarget(id, rowVersion) : await client.approveBudget(id, rowVersion);
    message.textContent = result.ok ? "承認しました" : operationMessage(result.category);
    if (result.ok) await load();
  };
  panel.querySelectorAll("[data-planning-track]").forEach((button) => button.addEventListener("click", () => {
    track = button.dataset.planningTrack;
    panel.querySelectorAll("[data-planning-track]").forEach((item) => item.setAttribute("aria-pressed", String(item === button)));
    panel.querySelectorAll("[data-planning-new-grad]").forEach((item) => { item.hidden = track !== "NEW_GRAD"; });
    renderAll();
  }));
  documentObject.getElementById("planning-admin-reload")?.addEventListener("click", load);
  for (const id of ["planning-graduation-year", "planning-period-start", "planning-period-end"]) documentObject.getElementById(id)?.addEventListener("input", renderAll);
  targetForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const payload = buildTargetDraft(readTargetForm(documentObject), track);
    if (!payload) { message.textContent = "入力内容を確認してください"; return; }
    targetSave.disabled = true;
    const result = await client.createTargetDraft(payload);
    message.textContent = result.ok ? "目標を下書き保存しました。内容を確認して承認してください。" : operationMessage(result.category);
    targetSave.disabled = !writeEnabled;
    if (result.ok) await load();
  });
  budgetForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const payload = buildBudgetDraft(readBudgetForm(documentObject), track);
    if (!payload) { message.textContent = "予算と内訳を確認してください"; return; }
    budgetSave.disabled = true;
    const result = await client.createBudgetDraft(payload);
    message.textContent = result.ok ? "予算を下書き保存しました。内容を確認して承認してください。" : operationMessage(result.category);
    budgetSave.disabled = !writeEnabled;
    if (result.ok) await load();
  });
  const updateBalance = () => updateBudgetBalance(documentObject);
  documentObject.getElementById("planning-total-budget")?.addEventListener("input", updateBalance);
  documentObject.getElementById("planning-budget-line-list")?.addEventListener("input", updateBalance);
  return Object.freeze({ initialized: true, get writeEnabled() { return writeEnabled; }, reload: load });
}

function renderSummary(doc, data, track, context) {
  const root = doc.getElementById("planning-current-summary"); root.replaceChildren();
  const rows = data.targets.filter((row) => inContext(row, track, context));
  for (const [code, label] of METRICS) {
    const row = rows.find((item) => item.targetMetric === code);
    const article = doc.createElement("article");
    const name = doc.createElement("span"); name.textContent = label;
    const value = doc.createElement("strong"); value.textContent = row ? `${row.targetCount}名` : "目標未設定";
    const source = doc.createElement("small"); source.textContent = data.actualSources[code] === "ACTUAL_SOURCE_UNAVAILABLE" ? "実績比較は準備中" : "正式Selection Historyで集計";
    article.append(name, value, source); root.append(article);
  }
  const budget = data.budgets.find((row) => inContext(row, track, context));
  const article = doc.createElement("article"); article.className = "planning-budget-summary";
  const name = doc.createElement("span"); name.textContent = "年間予算";
  const value = doc.createElement("strong"); value.textContent = budget ? `${formatYen(budget.totalBudget)}円` : "予算未設定";
  article.append(name, value); root.append(article);
}

function renderVersions(doc, id, data, track, context, allowApprove, approve) {
  const root = doc.getElementById(id); root.replaceChildren();
  const rows = [...data.targets.filter((row) => inContext(row, track, context)).map((row) => ({ kind: "TARGET", row })), ...data.budgets.filter((row) => inContext(row, track, context)).map((row) => ({ kind: "BUDGET", row }))];
  if (!rows.length) { const empty = doc.createElement("p"); empty.className = "planning-empty"; empty.textContent = "該当する計画はありません"; root.append(empty); return; }
  for (const item of rows) {
    const row = item.row; const article = doc.createElement("article"); article.className = "planning-version-card";
    const heading = doc.createElement("strong"); heading.textContent = item.kind === "TARGET" ? `${metricLabel(row.targetMetric)} ${row.targetCount}名` : `年間予算 ${formatYen(row.totalBudget)}円`;
    const meta = doc.createElement("p"); meta.textContent = `Version ${row.version}・${stateLabel(row.state)}・${row.period.start} ～ ${row.period.end}`;
    const reasonNode = doc.createElement("p"); reasonNode.textContent = `理由：${row.reason}`;
    const approval = doc.createElement("p"); approval.textContent = row.approvedAt ? `承認：${formatDateTime(row.approvedAt)}（HUB Sessionで承認者を記録）` : "承認：未承認";
    article.append(heading, meta, reasonNode, approval);
    if (allowApprove && row.state === "DRAFT") { const button = doc.createElement("button"); button.type = "button"; button.textContent = "内容を承認"; button.addEventListener("click", () => approve(item.kind, item.kind === "TARGET" ? row.targetId : row.budgetId, row.rowVersion)); article.append(button); }
    root.append(article);
  }
}

function renderBudgetLines(doc) {
  const root = doc.getElementById("planning-budget-line-list"); root.replaceChildren();
  for (const [code, label] of CHANNELS) {
    const row = doc.createElement("div"); row.className = "planning-budget-line"; row.dataset.channelCode = code;
    const name = doc.createElement("span"); name.textContent = label;
    const amount = doc.createElement("input"); amount.type = "number"; amount.min = "0"; amount.step = "1"; amount.inputMode = "numeric"; amount.placeholder = "0"; amount.setAttribute("aria-label", `${label} 予算額`); amount.dataset.lineAmount = "";
    const note = doc.createElement("input"); note.type = "text"; note.maxLength = 500; note.placeholder = "メモ"; note.setAttribute("aria-label", `${label} メモ`); note.dataset.lineReason = "";
    row.append(name, amount, note); root.append(row);
  }
}
function updateBudgetBalance(doc) {
  const total = integer(doc.getElementById("planning-total-budget")?.value);
  const sum = [...doc.querySelectorAll("[data-line-amount]")].reduce((n, input) => n + Math.max(0, integer(input.value)), 0);
  const node = doc.getElementById("planning-budget-balance");
  node.textContent = `内訳 ${formatYen(sum)}円 / 総予算 ${formatYen(Math.max(0, total))}円`;
  node.dataset.state = sum === total ? "match" : sum > total ? "over" : "under";
  node.title = sum === total ? "内訳と総予算が一致しています" : "内訳と総予算が一致していません";
}
function readTargetForm(doc) { return { graduationYear: doc.getElementById("planning-graduation-year").value, periodStart: doc.getElementById("planning-period-start").value, periodEnd: doc.getElementById("planning-period-end").value, effectiveFrom: doc.getElementById("planning-effective-from").value, effectiveTo: doc.getElementById("planning-effective-to").value, targetMetric: doc.getElementById("planning-target-metric").value, targetCount: doc.getElementById("planning-target-count").value, reason: doc.getElementById("planning-target-reason").value }; }
function readBudgetForm(doc) { return { graduationYear: doc.getElementById("planning-graduation-year").value, periodStart: doc.getElementById("planning-period-start").value, periodEnd: doc.getElementById("planning-period-end").value, effectiveFrom: doc.getElementById("planning-effective-from").value, effectiveTo: doc.getElementById("planning-effective-to").value, totalBudget: doc.getElementById("planning-total-budget").value, reason: doc.getElementById("planning-budget-reason").value, lines: [...doc.querySelectorAll(".planning-budget-line")].map((row) => ({ channelCode: row.dataset.channelCode, amount: row.querySelector("[data-line-amount]").value, reason: row.querySelector("[data-line-reason]").value })) }; }

function cleanEnvelope(data) {
  if (data?.recruiting_planning_contract_version !== CONTRACT_VERSION || data.sourceAvailability !== true || !["APPROVED","DRAFT","HISTORY"].includes(data.kind) || !Array.isArray(data.targets) || !Array.isArray(data.budgets) || !Array.isArray(data.budgetLines) || !data.actualSources) return null;
  const targets = data.targets.map(cleanTarget); const budgets = data.budgets.map(cleanBudget);
  if (targets.some((row) => !row) || budgets.some((row) => !row)) return null;
  return Object.freeze({ kind: data.kind, sourceAvailability: true, targets: Object.freeze(targets), budgets: Object.freeze(budgets), budgetLines: Object.freeze(data.budgetLines), actualSources: Object.freeze({ ...data.actualSources }) });
}
function cleanCapability(data) {
  return data?.recruiting_planning_capability_contract_version === CONTRACT_VERSION && typeof data.canWritePlanning === "boolean"
    ? Object.freeze({ canWritePlanning: data.canWritePlanning }) : null;
}
function cleanCorrectionPreflight(data){const p=data?.preview;if(data?.recruiting_planning_correction_preflight_contract_version!=="1.0.0"||!["PASS","BLOCKED","COMPLETED","UNAVAILABLE"].includes(data.state)||typeof data.exactPreflightPassed!=="boolean"||typeof data.canExecute!=="boolean"||!p)return null;if(p.recruitingTrack!=="NEW_GRAD"||p.graduationYear!==2027||p.scope!=="COMPANY"||p.oldPeriod?.start!=="2025-09-01"||p.oldPeriod?.end!=="2026-08-31"||p.newPeriod?.start!=="2026-04-01"||p.newPeriod?.end!=="2027-03-31")return null;if(p.targets?.CONTACT_COUNT!==563||p.targets?.SALON_VISIT_COUNT!==112||p.targets?.APPLICATION_COUNT!==45||p.targets?.OFFERED_COUNT!==37||p.targets?.OFFER_ACCEPTED_COUNT!==37||p.budget?.amount!==7385350||p.budget?.currency!=="JPY")return null;return Object.freeze({state:data.state,exactPreflightPassed:data.exactPreflightPassed,canExecute:data.canExecute,preview:Object.freeze(p)});}
function cleanTarget(row) { return row && UUID.test(String(row.targetId)) && Number.isInteger(row.targetCount) && Number.isInteger(row.version) && Number.isInteger(row.rowVersion) && row.period ? Object.freeze({ ...row }) : null; }
function cleanBudget(row) { return row && UUID.test(String(row.budgetId)) && Number.isInteger(row.totalBudget) && Number.isInteger(row.version) && Number.isInteger(row.rowVersion) && row.period ? Object.freeze({ ...row }) : null; }
function emptyData(kind) { return Object.freeze({ kind, sourceAvailability: true, targets: Object.freeze([]), budgets: Object.freeze([]), budgetLines: Object.freeze([]), actualSources: Object.fromEntries(METRICS.map(([code]) => [code, "ACTUAL_SOURCE_UNAVAILABLE"])) }); }
function readContext(doc, track) { return Object.freeze({ year: integer(doc.getElementById("planning-graduation-year")?.value), start: String(doc.getElementById("planning-period-start")?.value || ""), end: String(doc.getElementById("planning-period-end")?.value || ""), track }); }
function inContext(row, track, context) { if (row.recruitingTrack !== track) return false; return track === "NEW_GRAD" ? context.year >= 2020 && row.graduationYear === context.year : dateRange(context.start, context.end) && row.period?.start === context.start && row.period?.end === context.end; }
function periodCode(track, year, start, end) { return track === "NEW_GRAD" ? `GRAD_${year}` : `PERIOD_${start.replaceAll("-", "")}_${end.replaceAll("-", "")}`; }
function dateRange(start, end) { return /^\d{4}-\d{2}-\d{2}$/u.test(String(start)) && /^\d{4}-\d{2}-\d{2}$/u.test(String(end)) && start <= end; }
function reason(value) { const text = String(value || "").trim(); return text.length >= 1 && text.length <= 500; }
function integer(value) { const text = String(value ?? ""); return /^\d+$/u.test(text) ? Number(text) : -1; }
function metricLabel(code) { return METRICS.find(([value]) => value === code)?.[1] || "採用目標"; }
function stateLabel(state) { return state === "APPROVED" ? "承認済み" : state === "SUPERSEDED" ? "過去Version" : "Draft"; }
function formatYen(value) { return new Intl.NumberFormat("ja-JP").format(Number(value || 0)); }
function formatDateTime(value) { try { return new Intl.DateTimeFormat("ja-JP", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Tokyo" }).format(new Date(value)); } catch { return "記録済み"; } }
function operationMessage(category) { return category === "writes_disabled" ? "Owner承認後に登録操作を有効化します。現在は読み取りのみです。" : category === "auth_required" ? "セッションの有効期限が切れました。HUBへ戻り、求人管理を開き直してください。" : category === "version_conflict" ? "計画が更新されています。再読み込みして確認してください。" : "処理を完了できませんでした"; }
function safeCategory(code, status) { if (status === 403) return "forbidden"; if (status === 409) return "version_conflict"; if (code === "RECRUITING_PLANNING_WRITES_DISABLED") return "writes_disabled"; return "api_error"; }
