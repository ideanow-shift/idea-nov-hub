const REVIEW_PATH = "/api/talent/v1/historical/review";
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function safeResult(ok, category, requestCount = 0, data = null) {
  return Object.freeze({ ok, category, requestCount, retryCount: 0, data });
}

function normalizeBaseUrl(value) {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) return null;
    url.pathname = url.pathname.replace(/\/+$/u, "");
    return url.href.replace(/\/$/u, "");
  } catch {
    return null;
  }
}

function validProposal(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const keys = Object.keys(value);
  if (keys.length !== 2 || !keys.includes("primaryRecordIds") || !keys.includes("linkPairs")) return null;
  if (!Array.isArray(value.primaryRecordIds) || !Array.isArray(value.linkPairs)) return null;
  if (value.primaryRecordIds.length > 600 || value.linkPairs.length > 200) return null;
  if (value.primaryRecordIds.length + value.linkPairs.length === 0) return null;
  if (value.primaryRecordIds.some((id) => typeof id !== "string" || !UUID.test(id))) return null;
  if (new Set(value.primaryRecordIds).size !== value.primaryRecordIds.length) return null;
  const sourceIds = new Set();
  for (const pair of value.linkPairs) {
    if (!pair || typeof pair !== "object" || Array.isArray(pair)) return null;
    if (Object.keys(pair).length !== 2
      || typeof pair.sourceRecordId !== "string"
      || typeof pair.targetRecordId !== "string"
      || !UUID.test(pair.sourceRecordId)
      || !UUID.test(pair.targetRecordId)
      || pair.sourceRecordId === pair.targetRecordId
      || sourceIds.has(pair.sourceRecordId)) return null;
    sourceIds.add(pair.sourceRecordId);
  }
  return Object.freeze({
    primaryRecordIds: Object.freeze([...value.primaryRecordIds]),
    linkPairs: Object.freeze(value.linkPairs.map((pair) => Object.freeze({ ...pair }))),
  });
}

function validSuccess(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  if (Object.keys(value).length !== 2 || value.ok !== true || !value.data) return null;
  const data = value.data;
  const keys = [
    "canonicalEventCreated",
    "confirmedLinks",
    "createdPrimary",
    "rawValuesIncluded",
    "remainingUnmapped",
  ];
  if (typeof data !== "object" || Array.isArray(data)
    || Object.keys(data).length !== keys.length
    || !Object.keys(data).every((key) => keys.includes(key))
    || data.canonicalEventCreated !== false
    || data.rawValuesIncluded !== false) return null;
  for (const key of ["confirmedLinks", "createdPrimary", "remainingUnmapped"]) {
    if (!Number.isInteger(data[key]) || data[key] < 0) return null;
  }
  return Object.freeze({ ...data });
}

export function createTalentHistoricalReviewController({
  globalObject = globalThis,
  fetchImpl = globalObject.fetch,
  config = globalObject.NOV_TALENT_CONFIG,
  helper = globalObject.NovHubSession,
} = {}) {
  const baseUrl = normalizeBaseUrl(config?.writeApiBaseUrl);
  const enabled = config?.writeApiEnabled === true
    && baseUrl !== null
    && typeof helper?.getSessionToken === "function"
    && typeof fetchImpl === "function";
  let consumed = false;

  return Object.freeze({
    enabled,
    async apply(proposal) {
      if (!enabled) return safeResult(false, "feature_disabled");
      if (consumed) return safeResult(false, "already_consumed");
      const payload = validProposal(proposal);
      if (!payload) return safeResult(false, "invalid_request");
      consumed = true;

      let token;
      try {
        token = await helper.getSessionToken({ audience: "nov_hub" });
      } catch {
        return safeResult(false, "auth_required");
      }
      if (typeof token !== "string" || token.length < 20) return safeResult(false, "auth_required");

      let response;
      try {
        response = await fetchImpl(`${baseUrl}${REVIEW_PATH}`, {
          method: "POST",
          headers: {
            authorization: `Bearer ${token}`,
            "content-type": "application/json",
          },
          body: JSON.stringify(payload),
          credentials: "omit",
        });
      } catch {
        return safeResult(false, "request_failed", 1);
      }
      if (!response.ok) {
        const category = response.status === 401
          ? "auth_required"
          : response.status === 403 ? "write_forbidden" : "request_failed";
        return safeResult(false, category, 1);
      }
      const body = await response.json().catch(() => null);
      const data = validSuccess(body);
      return data
        ? safeResult(true, "applied", 1, data)
        : safeResult(false, "invalid_response", 1);
    },
  });
}

export const HISTORICAL_REVIEW_CONTRACT = Object.freeze({
  requestMax: 1,
  retry: 0,
  maximumPrimaryRecords: 600,
  maximumLinkPairs: 200,
  canonicalEventsCreated: false,
  requiresOwnerConfirmation: true,
});
