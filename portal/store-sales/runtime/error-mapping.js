const PRESENTATIONS = Object.freeze({
  unauthorized: ["HUBログインが必要です", "NOV HUBへ戻り、店舗営業管理を開き直してください。"],
  session_expired: ["セッションの有効期限が切れました", "NOV HUBへ戻り、再ログインしてください。"],
  forbidden: ["アクセス権限がありません", "NOV HUBへ戻って権限をご確認ください。"],
  validation_error: ["データ確認が必要です", "公開データまたはRuntime設定を確認しています。"],
  maintenance: ["メンテナンス中です", "終了後にもう一度お試しください。"],
  timeout: ["通信に時間がかかっています", "時間をおいて、もう一度お試しください。"],
  offline: ["一時的に取得できません", "通信状況を確認して、もう一度お試しください。"],
  empty: ["表示できる店舗がありません", "権限または対象月をご確認ください。"]
});

export function runtimePresentation(status, overrides = {}) {
  const [title, body] = PRESENTATIONS[status] || ["店舗営業情報を確認しています", "少々お待ちください。"];
  return Object.freeze({
    title: overrides.title || title,
    body: overrides.body || body,
    blocking: ["unauthorized", "forbidden"].includes(status),
    retryable: ["maintenance", "timeout", "offline"].includes(status)
  });
}

export function mapRuntimeError(error, options = {}) {
  const code = String(error?.code || "");
  const statusCode = Number(error?.status || 0);
  if (options.sessionStatus === "expired") {
    return { status: "unauthorized", code: "SESSION_EXPIRED", presentation: runtimePresentation("session_expired") };
  }
  if (statusCode === 401 || code === "UNAUTHORIZED") {
    return { status: "unauthorized", code: code || "UNAUTHORIZED", presentation: runtimePresentation("unauthorized") };
  }
  if (statusCode === 403 || ["FORBIDDEN", "ACTOR_SCOPE_DENIED"].includes(code)) {
    return { status: "forbidden", code: code || "FORBIDDEN", presentation: runtimePresentation("forbidden") };
  }
  if (code === "TIMEOUT") {
    return { status: "timeout", code, presentation: runtimePresentation("timeout") };
  }
  if (["MAINTENANCE", "SERVICE_MAINTENANCE", "MAINTENANCE_MODE"].includes(code)) {
    return { status: "maintenance", code, presentation: runtimePresentation("maintenance") };
  }
  if (["PRODUCTION_NOT_APPROVED", "INVALID_FEATURE_FLAG", "INVALID_ADAPTER_MODE", "INTEGRATION_ENDPOINT_REQUIRED", "MOCK_NOT_ALLOWED"].includes(code)) {
    return { status: "validation_error", code, presentation: runtimePresentation("validation_error") };
  }
  if (code === "NETWORK_ERROR" || options.online === false || statusCode >= 500) {
    return { status: "offline", code: code || "OFFLINE", presentation: runtimePresentation("offline") };
  }
  if (statusCode === 404 || code === "NOT_FOUND") {
    return { status: "empty", code: code || "NOT_FOUND", presentation: runtimePresentation("empty") };
  }
  return { status: "validation_error", code: code || "VALIDATION_ERROR", presentation: runtimePresentation("validation_error") };
}
