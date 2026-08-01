import { validateProjectionResponse } from "./contract.js";
import { ProjectionRequestError } from "./projection.js";

const STATUS_ERRORS = Object.freeze({
  401: ["UNAUTHORIZED", "HUBセッションを確認できません。", false],
  403: ["FORBIDDEN", "店舗営業管理を利用する権限がありません。", false],
  404: ["NOT_FOUND", "対象店舗または対象期間が見つかりません。", false],
  408: ["TIMEOUT", "データ取得に時間がかかっています。", true],
  409: ["VERSION_CONFLICT", "データを更新しています。", true],
  422: ["VALIDATION_ERROR", "データ形式を確認できません。", false],
  500: ["SERVER_ERROR", "データを取得できません。", true],
  503: ["SERVER_ERROR", "データを取得できません。", true]
});
const SAFE_ERROR_CODES = new Set(["MAINTENANCE", "TIMEOUT", "VALIDATION_ERROR"]);
const PERIOD = /^\d{4}-(0[1-9]|1[0-2])$/;
const STORE_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;

export function createStoreSalesApiAdapter(config, dependencies = {}) {
  if (!["integration", "staging", "production"].includes(config.mode)) {
    throw new Error("Store Sales API adapter requires a read-only API mode.");
  }
  const fetchImpl = dependencies.fetchImpl || globalThis.fetch;
  const getSessionToken = dependencies.getSessionToken || (() => "");
  let activeController = null;
  let requestSequence = 0;

  async function requestProjection({ period, storeId = null }) {
    if (!PERIOD.test(String(period || ""))) {
      throw new ProjectionRequestError("INVALID_PERIOD", "対象期間を確認してください。", 422);
    }
    if (storeId !== null && !STORE_ID.test(String(storeId))) {
      throw new ProjectionRequestError("INVALID_STORE_ID", "店舗IDを確認してください。", 422);
    }
    activeController?.abort("superseded");
    const controller = new AbortController();
    activeController = controller;
    const sequence = ++requestSequence;
    const timeoutId = setTimeout(() => controller.abort(), config.timeoutMs);
    let response;
    try {
      const token = String(await getSessionToken() || "").trim();
      if (!token) throw new ProjectionRequestError("UNAUTHORIZED", "HUBセッションを確認できません。", 401);
      const url = apiUrl(config.endpoint, storeId);
      url.searchParams.set("period", period);
      response = await fetchImpl(url, {
        method: "GET",
        headers: {
          Authorization: "Bearer " + token,
          Accept: "application/json",
          "X-Contract-Version": config.contractVersion,
          "X-Request-ID": globalThis.crypto?.randomUUID?.() || "store-sales-" + Date.now()
        },
        signal: controller.signal,
        cache: "no-store",
        credentials: "omit"
      });
    } catch (cause) {
      if (cause instanceof ProjectionRequestError) throw cause;
      if (cause?.name === "AbortError" && sequence !== requestSequence) {
        throw new ProjectionRequestError("REQUEST_ABORTED", "前のデータ取得を終了しました。", 409, true);
      }
      if (cause?.name === "AbortError") throw new ProjectionRequestError("TIMEOUT", "データ取得に時間がかかっています。", 408, true);
      throw new ProjectionRequestError("NETWORK_ERROR", "データを取得できません。", 503, true);
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
      throw new ProjectionRequestError(responseCode || fallbackCode, message, response.status, retryable);
    }
    let payload;
    try {
      payload = await response.json();
    } catch {
      throw new ProjectionRequestError("MALFORMED_JSON", "データ形式を確認できません。", 422);
    }
    try {
      return validateProjectionResponse(payload);
    } catch {
      throw new ProjectionRequestError("VALIDATION_ERROR", "データ形式を確認できません。", 422);
    }
  }

  return Object.freeze({
    mode: config.mode,
    readOnly: true,
    loadDashboard: ({ period }) => requestProjection({ period }),
    loadStore: ({ period, storeId }) => requestProjection({ period, storeId }),
    clear() {
      requestSequence += 1;
      activeController?.abort("cleared");
      activeController = null;
    }
  });
}

function apiUrl(endpoint, storeId) {
  const url = new URL(endpoint);
  if (storeId !== null) {
    if (/\/dashboard\/?$/.test(url.pathname)) {
      url.pathname = url.pathname.replace(/\/dashboard\/?$/, "/stores/" + encodeURIComponent(storeId));
    } else {
      url.pathname = url.pathname.replace(/\/$/, "") + "/stores/" + encodeURIComponent(storeId);
    }
  }
  return url;
}
