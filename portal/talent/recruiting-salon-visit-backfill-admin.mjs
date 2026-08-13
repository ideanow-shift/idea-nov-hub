const CONTRACT_VERSION = "1.0.0";
const REVIEW_SHA = "10C87773B376DDDAF044DC1C3E2DD88E68B759E2A237DF0E406A8A563A192540";
const SOURCE_SHA = "ed954ba2a5553ab645d5050cd8ed036aad6e749435d09a9fcfe256255426c023";

export function createRecruitingSalonVisitBackfillClient({
  globalObject = globalThis,
  fetchImpl = globalObject.fetch,
  hubSessionHelper = globalObject.NovHubSession,
} = {}) {
  const base = String(globalObject?.NOV_TALENT_CONFIG?.readonlyApiBaseUrl || "").replace(/\/+$/u, "");
  const staging = globalObject?.NOV_TALENT_CONFIG?.runtimeMode === "staging"
    && globalObject?.NOV_TALENT_CONFIG?.networkEnabled === true;
  const hostedOrigin = globalObject?.location?.origin === "https://ideanow-shift.github.io";
  if (!staging || !hostedOrigin || !/^https:\/\//u.test(base) || typeof fetchImpl !== "function"
    || typeof hubSessionHelper?.getSessionToken !== "function") return null;
  let canExecute = false;
  const request = async (path, method = "GET") => {
    if (method === "POST" && !canExecute) return Object.freeze({ ok: false, category: "writes_disabled", requestCount: 0 });
    let token;
    try { token = await hubSessionHelper.getSessionToken(); } catch { return Object.freeze({ ok: false, category: "auth_required", requestCount: 0 }); }
    if (typeof token !== "string" || token.trim().length < 20) return Object.freeze({ ok: false, category: "auth_required", requestCount: 0 });
    try {
      const response = await fetchImpl(`${base}${path}`, {
        method, credentials: "omit", cache: "no-store",
        headers: { Accept: "application/json", "Content-Type": "application/json", Authorization: `Bearer ${token.trim()}` },
        body: method === "POST" ? "{}" : undefined,
      });
      const envelope = await response.json().catch(() => null);
      if (response.status === 401) return Object.freeze({ ok: false, category: "auth_required", requestCount: 1 });
      if (response.status === 403) return Object.freeze({ ok: false, category: "forbidden", requestCount: 1 });
      if (!response.ok || envelope?.ok !== true) return Object.freeze({ ok: false, category: safeCategory(envelope?.safeCode), requestCount: 1 });
      if (method === "POST") {
        const valid = envelope.data?.state === "COMPLETED" && envelope.data?.sourceEventCount === 4
          && envelope.data?.storeVisitFactCount === 15 && envelope.data?.planningUniqueCandidateCount === 4;
        if (valid) canExecute = false;
        return valid ? Object.freeze({ ok: true, data: Object.freeze({ ...envelope.data }), requestCount: 1 })
          : Object.freeze({ ok: false, category: "invalid_response", requestCount: 1 });
      }
      const data = cleanPreflight(envelope.data);
      if (!data) { canExecute = false; return Object.freeze({ ok: false, category: "invalid_response", requestCount: 1 }); }
      canExecute = data.canExecute;
      return Object.freeze({ ok: true, data, requestCount: 1 });
    } catch { return Object.freeze({ ok: false, category: "api_error", requestCount: 1 }); }
  };
  const path = "/api/talent/v1/recruiting-actual-facts/backfills/salon-visit-2027";
  return Object.freeze({
    preflight: () => request(`${path}/preflight`),
    execute: () => request(path, "POST"),
  });
}

export function initializeRecruitingSalonVisitBackfillOperator(documentObject = globalThis.document, globalObject = globalThis) {
  const panel = documentObject?.getElementById?.("salon-visit-backfill-operator");
  if (!panel) return Object.freeze({ initialized: false });
  const client = createRecruitingSalonVisitBackfillClient({ globalObject });
  if (!client) return Object.freeze({ initialized: false });
  const status = documentObject.getElementById("salon-visit-backfill-status");
  const open = documentObject.getElementById("salon-visit-backfill-open");
  const dialog = documentObject.getElementById("salon-visit-backfill-dialog");
  const confirm = documentObject.getElementById("salon-visit-backfill-confirm");
  const cancel = documentObject.getElementById("salon-visit-backfill-cancel");
  const reviewShaState = documentObject.getElementById("salon-visit-backfill-review-sha-state");
  const sourceShaState = documentObject.getElementById("salon-visit-backfill-source-sha-state");
  const existingState = documentObject.getElementById("salon-visit-backfill-existing-state");
  let ready = false, submitting = false, restoreFocus = null;
  const apply = (enabled) => { open.disabled = !enabled || submitting; confirm.disabled = !enabled || submitting; };
  apply(false);
  const load = async () => {
    status.textContent = "Human Review候補とCanonical Sourceを確認しています";
    const result = await client.preflight();
    panel.hidden = false;
    if (reviewShaState) reviewShaState.textContent = result.ok ? "SHA-256一致" : "照合未完了";
    if (sourceShaState) sourceShaState.textContent = result.ok ? "SHA-256一致" : "照合未完了";
    if (existingState) existingState.textContent = existingStateMessage(result);
    ready = result.ok && result.data.state === "PASS" && result.data.exactPreflightPassed && result.data.canExecute;
    if (!result.ok) status.textContent = result.category === "auth_required"
      ? "セッションの有効期限が切れました。HUBへ戻り、求人管理を開き直してください。"
      : "事前確認を完了できませんでした";
    else if (result.data.state === "COMPLETED") status.textContent = "Backfill済み（再実行できません）";
    else if (result.data.state === "VOIDED") status.textContent = "Backfillは正式な取消手順で無効化済みです";
    else if (result.data.state !== "PASS") status.textContent = "Human Review候補とSourceの完全一致を確認できません";
    else status.textContent = result.data.canExecute ? "exact preflight PASS・実行準備完了" : "exact preflight PASS・Owner実行承認待ち";
    open.hidden = result.ok && ["COMPLETED", "VOIDED"].includes(result.data.state);
    apply(ready);
    return result;
  };
  open.addEventListener("click", () => {
    if (!ready || open.disabled || !dialog?.showModal) return;
    restoreFocus = documentObject.activeElement;
    dialog.showModal();
    confirm.focus();
  });
  const close = () => { dialog?.close(); restoreFocus?.focus?.(); };
  cancel?.addEventListener("click", close);
  dialog?.addEventListener("cancel", (event) => { event.preventDefault(); close(); });
  confirm?.addEventListener("click", async () => {
    if (!ready || submitting) return;
    submitting = true; apply(false); status.textContent = "店舗別SALON_VISIT 15件を記録しています";
    const result = await client.execute();
    close(); submitting = false;
    if (result.ok) { ready = false; status.textContent = "SALON_VISIT 15件のBackfillが完了しました"; await load(); }
    else { status.textContent = operationMessage(result.category); ready = false; apply(false); }
  });
  load();
  return Object.freeze({ initialized: true, reload: load, get ready() { return ready; } });
}

function cleanPreflight(data) {
  const p = data?.preview;
  if (data?.recruiting_salon_visit_backfill_preflight_contract_version !== CONTRACT_VERSION
    || !["PASS", "BLOCKED", "COMPLETED", "VOIDED", "UNAVAILABLE"].includes(data.state)
    || typeof data.exactPreflightPassed !== "boolean" || typeof data.canExecute !== "boolean"
    || data.reviewPackageSha256 !== REVIEW_SHA || data.canonicalSourceSha256 !== SOURCE_SHA
    || data.canonicalStoreState !== "READY"
    || data.originalActorStatus !== "UNAVAILABLE" || data.sourceEventGrain !== "CANDIDATE_VISIT_DATE"
    || data.factGrain !== "CANDIDATE_VISIT_DATE_STORE" || data.planningActualGrain !== "UNIQUE_CANDIDATE" || !p) return null;
  if (p.graduationYear !== 2027 || p.period?.start !== "2026-04-01" || p.period?.end !== "2027-03-31"
    || p.sourceEventCount !== 4 || p.storeVisitFactCount !== 15 || p.planningUniqueCandidateCount !== 4
    || p.distinctStoreCount !== 8 || !Array.isArray(p.excludedScopes)) return null;
  return Object.freeze({ ...data, preview: Object.freeze({ ...p }) });
}
function safeCategory(code) {
  if (code === "RECRUITING_SALON_VISIT_BACKFILL_DISABLED") return "writes_disabled";
  if (code === "RECRUITING_SALON_VISIT_BACKFILL_CONFLICT" || code === "RECRUITING_SALON_VISIT_BACKFILL_PREFLIGHT_FAILED") return "preflight_changed";
  return "api_error";
}
function operationMessage(category) {
  if (category === "auth_required") return "セッションの有効期限が切れました。HUBへ戻り、求人管理を開き直してください。";
  if (category === "writes_disabled") return "実行権限は停止中です。追加のOwner承認が必要です。";
  if (category === "preflight_changed") return "Source状態が変わったため、書き込み前に安全停止しました。";
  return "処理を完了できませんでした。再試行せず、状態を確認してください。";
}
function existingStateMessage(result) {
  if (!result.ok) return "確認未完了";
  if (result.data.state === "PASS") {
    return `店舗別Fact ${result.data.existingFactCount}件 / receipt 0件 / unexpected Source ${result.data.unexpectedSourceEventCount}件`;
  }
  if (result.data.state === "COMPLETED") {
    return "見学日4件 / 店舗別Fact 15件 / unique Candidate 4名 / receipt 1件";
  }
  if (result.data.state === "VOIDED") return "Backfill receiptは正式なappend-only voidで無効化済み";
  return "exact preflight不一致";
}
