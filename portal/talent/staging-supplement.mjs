const STAGING_SUPPLEMENT_PATH = "/api/talent/v1/staging/supplement";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const STATUS_VALUES = Object.freeze([
  "LINE_REGISTERED", "APPLICATION_RECEIVED", "SALON_TOUR_PLANNED", "SALON_TOUR_COMPLETED",
  "INTERVIEW_PLANNED", "INTERVIEW_COMPLETED", "UNDER_REVIEW", "OFFERED",
  "OFFER_ACCEPTED", "EXPECTED_JOIN", "OFFERED_ELSEWHERE", "WITHDRAWN", "REJECTED",
]);
const STAGING_KEYS = Object.freeze([
  "stagingRecordId", "expectedVersion", "displayName", "kana", "school",
  "phone", "email", "preferredStore", "currentStatus", "nextActionAt",
  "offerDate", "expectedJoinDate", "plannedStore",
]);

function normalizeBaseUrl(value) {
  try {
    const url = new URL(String(value || ""));
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) return null;
    url.pathname = url.pathname.replace(/\/+$/u, "");
    return url.href.replace(/\/$/u, "");
  } catch {
    return null;
  }
}

function nullable(value, maximum) {
  const normalized = String(value || "").normalize("NFKC").trim();
  return normalized ? normalized.slice(0, maximum) : null;
}

export function normalizeTalentStagingSupplement(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  if (Object.keys(value).length !== STAGING_KEYS.length
    || !Object.keys(value).every((key) => STAGING_KEYS.includes(key))) return null;
  const stagingRecordId = String(value.stagingRecordId || "");
  const expectedVersion = Number(value.expectedVersion);
  const displayName = nullable(value.displayName, 120);
  const email = nullable(value.email, 254);
  const nextActionAt = nullable(value.nextActionAt, 10);
  const offerDate = nullable(value.offerDate, 10);
  const expectedJoinDate = nullable(value.expectedJoinDate, 10);
  if (!UUID.test(stagingRecordId)
    || !Number.isInteger(expectedVersion)
    || expectedVersion < 0
    || !displayName
    || !STATUS_VALUES.includes(String(value.currentStatus))
    || (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email))
    || (nextActionAt && !/^\d{4}-\d{2}-\d{2}$/u.test(nextActionAt))
    || (offerDate && !/^\d{4}-\d{2}-\d{2}$/u.test(offerDate))
    || (expectedJoinDate && !/^\d{4}-\d{2}-\d{2}$/u.test(expectedJoinDate))) return null;
  return Object.freeze({
    stagingRecordId,
    expectedVersion,
    displayName,
    kana: nullable(value.kana, 120),
    school: nullable(value.school, 180),
    phone: nullable(value.phone, 40),
    email,
    preferredStore: nullable(value.preferredStore, 120),
    currentStatus: String(value.currentStatus),
    nextActionAt,
    offerDate,
    expectedJoinDate,
    plannedStore: nullable(value.plannedStore, 120),
  });
}

function validResult(value) {
  if (!value || typeof value !== "object" || Array.isArray(value) || value.ok !== true) return null;
  const data = value.data;
  if (!data || typeof data !== "object" || Array.isArray(data)
    || Object.keys(data).length !== 3
    || !UUID.test(String(data.stagingRecordId || ""))
    || !Number.isInteger(data.supplementVersion)
    || data.supplementVersion < 1
    || !["CREATE", "UPDATE"].includes(data.operation)) return null;
  return Object.freeze({ ...data });
}

export function createTalentStagingSupplementController({
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

  return Object.freeze({
    enabled,
    async save(value) {
      if (!enabled) return Object.freeze({ ok: false, category: "feature_disabled" });
      const payload = normalizeTalentStagingSupplement(value);
      if (!payload) return Object.freeze({ ok: false, category: "invalid_request" });
      let token;
      try {
        token = await helper.getSessionToken({ audience: "nov_hub" });
      } catch {
        return Object.freeze({ ok: false, category: "auth_required" });
      }
      if (typeof token !== "string" || token.length < 20) {
        return Object.freeze({ ok: false, category: "auth_required" });
      }
      try {
        const response = await fetchImpl(`${baseUrl}${STAGING_SUPPLEMENT_PATH}`, {
          method: "POST",
          headers: {
            authorization: `Bearer ${token}`,
            "content-type": "application/json",
          },
          body: JSON.stringify(payload),
          credentials: "omit",
        });
        if (!response.ok) {
          return Object.freeze({
            ok: false,
            category: response.status === 401
              ? "auth_required"
              : response.status === 403 ? "write_forbidden" : "save_failed",
          });
        }
        const data = validResult(await response.json().catch(() => null));
        return data
          ? Object.freeze({ ok: true, category: "saved", data })
          : Object.freeze({ ok: false, category: "invalid_response" });
      } catch {
        return Object.freeze({ ok: false, category: "save_failed" });
      }
    },
  });
}

export const STAGING_SUPPLEMENT_UI_CONTRACT = Object.freeze({
  statuses: STATUS_VALUES,
  requestPerSave: 1,
  optimisticConcurrency: true,
  createsCanonicalApplication: false,
  rawValuesInResult: false,
});
