const PRESENTATIONS = Object.freeze({
  initializing: ["店舗営業情報を準備しています", "画面の表示準備をしています。"],
  loading: ["データを取得しています", "店舗の売上・利益・KPIを読み込んでいます。"],
  ready: ["店舗営業情報を表示しています", "最新の取得結果を表示しています。"],
  collecting: ["売上・利益データを集計しています", "確定するまで数値は表示されません。"],
  preparing: ["データを準備しています", "利用可能になるまでしばらくお待ちください。"],
  unavailable: ["現在取得できないデータがあります", "ほかの項目は引き続き確認できます。"],
  unauthorized: ["HUBログインが必要です", "NOV HUBへ戻り、店舗営業管理を開き直してください。"],
  session_expired: ["セッションの有効期限が切れました", "NOV HUBへ戻り、再ログインしてください。"],
  forbidden: ["アクセス権限がありません", "NOV HUBへ戻って権限をご確認ください。"],
  validation_error: ["データを表示できません", "取得したデータの形式を確認しています。担当者へご連絡ください。"],
  maintenance: ["ただいまメンテナンス中です", "終了後に「再試行」を押してください。"],
  timeout: ["データ取得に時間がかかっています", "通信状況を確認し、「再試行」を押してください。"],
  offline: ["ネットワークに接続できません", "通信状況を確認し、「再試行」を押してください。"],
  empty: ["対象店舗のデータは0件です", "選択した対象月と表示条件をご確認ください。"]
});

export function runtimePresentation(status, overrides = {}) {
  const [title, body] = PRESENTATIONS[status] || ["表示状態を確認できません", "画面を再読み込みしても解消しない場合は担当者へご連絡ください。"];
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
