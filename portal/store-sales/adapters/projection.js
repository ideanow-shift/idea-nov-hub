import { validateProjectionResponse } from "./contract.js";

export class ProjectionRequestError extends Error {
  constructor(code, message, status, retryable = false) {
    super(message);
    this.name = "ProjectionRequestError";
    this.code = code;
    this.status = status;
    this.retryable = retryable;
  }
}

const STATUS_ERRORS = {
  401: ["UNAUTHORIZED", "セッションの有効期限が切れました。", false],
  403: ["FORBIDDEN", "アクセス権限がありません。", false],
  404: ["NOT_FOUND", "対象店舗または対象月が見つかりません。", false],
  409: ["VERSION_CONFLICT", "データ更新中です。", true],
  422: ["VALIDATION_ERROR", "データ確認が必要です。", false],
  408: ["TIMEOUT", "通信に時間がかかっています。", true],
  503: ["SERVER_ERROR", "一時的に取得できません。", true],
  500: ["SERVER_ERROR", "一時的に取得できません。", true]
};
const SAFE_ERROR_CODES = new Set(["MAINTENANCE", "TIMEOUT", "VALIDATION_ERROR"]);

export function createProjectionAdapter(config, dependencies = {}) {
  if (config.mode !== "integration") throw new Error("Projection adapter requires integration mode.");
  const fetchImpl = dependencies.fetchImpl || globalThis.fetch;
  const getSessionToken = dependencies.getSessionToken || (() => "");
  let activeController = null;
  let requestSequence = 0;
  return Object.freeze({
    mode: "integration",
    async loadDashboard({ period }) {
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(period || ""))) {
        throw new ProjectionRequestError("INVALID_PERIOD", "営業対象月を確認してください。", 422);
      }
      activeController?.abort("superseded");
      const controller = new AbortController();
      activeController = controller;
      const sequence = ++requestSequence;
      const timeoutId = setTimeout(() => controller.abort(), config.timeoutMs);
      let response;
      try {
        const token = String(await getSessionToken() || "").trim();
        if (!token) throw new ProjectionRequestError("UNAUTHORIZED", "セッションの有効期限が切れました。", 401);
        const url = new URL(config.endpoint);
        url.searchParams.set("period", period);
        response = await fetchImpl(url, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
            "X-Contract-Version": config.contractVersion,
            "X-Request-ID": globalThis.crypto?.randomUUID?.() || `store-sales-${Date.now()}`
          },
          signal: controller.signal,
          cache: "no-store",
          credentials: "omit"
        });
      } catch (cause) {
        if (cause instanceof ProjectionRequestError) throw cause;
        if (cause?.name === "AbortError" && sequence !== requestSequence) throw new ProjectionRequestError("REQUEST_ABORTED", "前のデータ取得を終了しました。", 409, true);
        if (cause?.name === "AbortError") throw new ProjectionRequestError("TIMEOUT", "通信に時間がかかっています。", 408, true);
        throw new ProjectionRequestError("NETWORK_ERROR", "一時的に取得できません。", 503, true);
      } finally {
        clearTimeout(timeoutId);
        if (activeController === controller) activeController = null;
      }
      if (!response.ok) {
        const [fallbackCode, message, retryable] = STATUS_ERRORS[response.status] || STATUS_ERRORS[500];
        let responseCode = null;
        try {
          const errorPayload = await response.json();
          responseCode = SAFE_ERROR_CODES.has(errorPayload?.error?.code) ? errorPayload.error.code : null;
        } catch {}
        const code = responseCode || fallbackCode;
        throw new ProjectionRequestError(code, message, response.status, retryable);
      }
      let payload;
      try {
        payload = await response.json();
      } catch {
        throw new ProjectionRequestError("MALFORMED_JSON", "データ確認が必要です。", 422);
      }
      try {
        return validateProjectionResponse(payload);
      } catch {
        throw new ProjectionRequestError("VALIDATION_ERROR", "データ確認が必要です。", 422);
      }
    },
    clear() {
      requestSequence += 1;
      activeController?.abort("cleared");
      activeController = null;
    }
  });
}
