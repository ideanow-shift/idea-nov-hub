const CONTRACT_VERSION = "1.0.0";
const REVIEW_SHA = "139D6B1B222CD7A7D820375C08E1B4ACE811FC285ED89E27DD924D2BFB8C9125";
const SOURCE_SHA = "725cc4b8ae933081dc30fd7ce37179741661d795a20edaed542023b4d3621a77";

export function createRecruitingContactBackfillClient({
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
        const valid = envelope.data?.state === "COMPLETED" && envelope.data?.factEventCount === 11
          && envelope.data?.planningUniqueCandidateCount === 10;
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
  const path = "/api/talent/v1/recruiting-actual-facts/backfills/contact-2027";
  return Object.freeze({
    preflight: () => request(`${path}/preflight`),
    execute: () => request(path, "POST"),
  });
}

export function initializeRecruitingContactBackfillOperator(documentObject = globalThis.document, globalObject = globalThis) {
  const panel = documentObject?.getElementById?.("contact-backfill-operator");
  if (!panel) return Object.freeze({ initialized: false });
  const client = createRecruitingContactBackfillClient({ globalObject });
  if (!client) return Object.freeze({ initialized: false });
  const status = documentObject.getElementById("contact-backfill-status");
  const open = documentObject.getElementById("contact-backfill-open");
  const dialog = documentObject.getElementById("contact-backfill-dialog");
  const confirm = documentObject.getElementById("contact-backfill-confirm");
  const cancel = documentObject.getElementById("contact-backfill-cancel");
  const reviewShaState = documentObject.getElementById("contact-backfill-review-sha-state");
  const sourceShaState = documentObject.getElementById("contact-backfill-source-sha-state");
  const existingState = documentObject.getElementById("contact-backfill-existing-state");
  let ready = false, submitting = false, restoreFocus = null;
  const apply = (enabled) => { open.disabled = !enabled || submitting; confirm.disabled = !enabled || submitting; };
  apply(false);
  const load = async () => {
    status.textContent = "承認済みパッケージを確認しています";
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
    else if (result.data.state !== "PASS") status.textContent = "承認PackageとSourceの完全一致を確認できません";
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
    submitting = true; apply(false); status.textContent = "CONTACT 11件を記録しています";
    const result = await client.execute();
    close(); submitting = false;
    if (result.ok) { ready = false; status.textContent = "CONTACT 11件のBackfillが完了しました"; await load(); }
    else { status.textContent = operationMessage(result.category); ready = false; apply(false); }
  });
  load();
  return Object.freeze({ initialized: true, reload: load, get ready() { return ready; } });
}

function cleanPreflight(data) {
  const p = data?.preview;
  if (data?.recruiting_contact_backfill_preflight_contract_version !== CONTRACT_VERSION
    || !["PASS", "BLOCKED", "COMPLETED", "VOIDED", "UNAVAILABLE"].includes(data.state)
    || typeof data.exactPreflightPassed !== "boolean" || typeof data.canExecute !== "boolean"
    || data.reviewPackageSha256 !== REVIEW_SHA || data.canonicalSourceSha256 !== SOURCE_SHA
    || data.originalActorStatus !== "UNAVAILABLE" || !p) return null;
  if (p.graduationYear !== 2027 || p.period?.start !== "2026-04-01" || p.period?.end !== "2027-03-31"
    || p.factEventCount !== 11 || p.planningUniqueCandidateCount !== 10
    || !Array.isArray(p.excludedScopes)) return null;
  return Object.freeze({ ...data, preview: Object.freeze({ ...p }) });
}
function safeCategory(code) {
  if (code === "RECRUITING_CONTACT_BACKFILL_DISABLED") return "writes_disabled";
  if (code === "RECRUITING_CONTACT_BACKFILL_CONFLICT" || code === "RECRUITING_CONTACT_BACKFILL_PREFLIGHT_FAILED") return "preflight_changed";
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
    return `Engagement Fact ${result.data.existingFactCount}件 / receipt 0件 / duplicate 0件 / cancellation Candidate 0名`;
  }
  if (result.data.state === "COMPLETED") {
    return "Engagement Fact 11件 / receipt 1件 / duplicate 0件 / cancellation Candidate 0名";
  }
  if (result.data.state === "VOIDED") {
    return "Backfill receiptは正式なappend-only voidで無効化済み";
  }
  return "exact preflight不一致";
}
