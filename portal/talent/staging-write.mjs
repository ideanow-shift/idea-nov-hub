import { getNovHubSessionToken } from "../js/nov-hub-session-candidate.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export function stagingWriteEnabled(globalObject = globalThis) {
  const config = globalObject?.NOV_TALENT_CONFIG || {};
  return config.runtimeMode === "staging" && config.networkEnabled === true && config.writeEnabled === true
    && /^https:\/\//u.test(String(config.writeApiBaseUrl || ""));
}

export function createStagingCandidateClient({
  globalObject = globalThis,
  fetchImpl = globalObject.fetch,
  sessionTokenProvider = getNovHubSessionToken
} = {}) {
  if (!stagingWriteEnabled(globalObject) || typeof fetchImpl !== "function") return null;
  const base = String(globalObject.NOV_TALENT_CONFIG.writeApiBaseUrl).replace(/\/+$/u, "");
  const token = async () => {
    const value = await sessionTokenProvider?.();
    if (!value || typeof value !== "string") throw safe("auth_required");
    return value;
  };
  const request = async (path, { method = "GET", body } = {}) => {
    try {
      const bearer = await token();
      const response = await fetchImpl(`${base}${path}`, {
        method,
        headers: { Accept: "application/json", "Content-Type": "application/json", Authorization: `Bearer ${bearer}` },
        credentials: "omit",
        body: body === undefined ? undefined : JSON.stringify(body)
      });
      const envelope = await response.json().catch(() => null);
      if (!response.ok || envelope?.ok !== true) return Object.freeze({ ok: false, category: mapCode(envelope?.safeCode, response.status) });
      return Object.freeze({ ok: true, data: envelope.data });
    } catch (error) {
      return Object.freeze({ ok: false, category: error?.safeCategory || "api_error" });
    }
  };
  return Object.freeze({
    checkDuplicates: (payload) => request("/api/talent/v1/candidates/duplicate-check", { method: "POST", body: payload }),
    create: (payload) => request("/api/talent/v1/candidates", { method: "POST", body: payload }),
    update: (candidateId, payload) => UUID.test(candidateId) ? request(`/api/talent/v1/candidates/${candidateId}`, { method: "PATCH", body: payload }) : Promise.resolve({ ok: false, category: "invalid_request" }),
    deactivate: (candidateId, payload) => UUID.test(candidateId) ? request(`/api/talent/v1/candidates/${candidateId}/active`, { method: "POST", body: { ...payload, active: false } }) : Promise.resolve({ ok: false, category: "invalid_request" }),
    restore: (candidateId, payload) => UUID.test(candidateId) ? request(`/api/talent/v1/candidates/${candidateId}/active`, { method: "POST", body: { ...payload, active: true } }) : Promise.resolve({ ok: false, category: "invalid_request" }),
    mutateActivity: (payload) => request("/api/talent/v1/activities", { method: "POST", body: payload }),
    mutateMaster: (payload) => request("/api/talent/v1/masters", { method: "POST", body: payload }),
    linkMasters: (candidateId, payload) => UUID.test(candidateId) ? request(`/api/talent/v1/candidates/${candidateId}/master-links`, { method: "POST", body: payload }) : Promise.resolve({ ok: false, category: "invalid_request" }),
    linkUnlinkedSelection: (payload) => request("/api/talent/v1/unlinked-selection/link", { method: "POST", body: payload }),
    audit: (candidateId) => UUID.test(candidateId) ? request(`/api/talent/v1/candidates/${candidateId}/audit`) : Promise.resolve({ ok: false, category: "invalid_request" })
  });
}

function mapCode(code, status) {
  if (status === 401) return "auth_required";
  if (status === 403) return "forbidden";
  if (status === 409) return "version_conflict";
  if (status === 400) return "invalid_request";
  return String(code || "api_error").toLowerCase();
}

function safe(category) {
  const error = new Error(category);
  error.safeCategory = category;
  return error;
}
