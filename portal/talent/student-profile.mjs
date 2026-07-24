const PROFILE_PATH = "/api/talent/v1/students/profile";
const APPLICATION_NO = /^NT-[0-9]{4}-[0-9]{6}$/u;
const STATUS_VALUES = Object.freeze([
  "CONTACT", "LINE_REGISTERED", "SALON_TOUR", "INTERVIEW",
  "PASSED", "OFFER", "EXPECTED_JOIN", "WITHDRAWN",
]);
const PROFILE_KEYS = Object.freeze([
  "applicationNo", "expectedVersion", "displayName", "kana", "school",
  "phone", "email", "preferredStore", "currentStatus", "nextActionAt",
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

export function normalizeStudentProfileForm(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  if (Object.keys(value).length !== PROFILE_KEYS.length
    || !Object.keys(value).every((key) => PROFILE_KEYS.includes(key))) return null;
  const displayName = nullable(value.displayName, 120);
  const applicationNo = value.applicationNo === null ? null : String(value.applicationNo || "");
  const expectedVersion = Number(value.expectedVersion);
  const email = nullable(value.email, 254);
  const nextActionAt = nullable(value.nextActionAt, 10);
  if (!displayName
    || !(applicationNo === null || APPLICATION_NO.test(applicationNo))
    || !Number.isInteger(expectedVersion)
    || expectedVersion < 0
    || (applicationNo === null && expectedVersion !== 0)
    || !STATUS_VALUES.includes(String(value.currentStatus))
    || (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email))
    || (nextActionAt && !/^\d{4}-\d{2}-\d{2}$/u.test(nextActionAt))) return null;
  return Object.freeze({
    applicationNo,
    expectedVersion,
    displayName,
    kana: nullable(value.kana, 120),
    school: nullable(value.school, 180),
    phone: nullable(value.phone, 40),
    email,
    preferredStore: nullable(value.preferredStore, 120),
    currentStatus: String(value.currentStatus),
    nextActionAt,
  });
}

function validResult(value) {
  if (!value || typeof value !== "object" || Array.isArray(value) || value.ok !== true) return null;
  const data = value.data;
  if (!data || typeof data !== "object" || Array.isArray(data)
    || Object.keys(data).length !== 3
    || !APPLICATION_NO.test(String(data.applicationNo || ""))
    || !Number.isInteger(data.profileVersion)
    || data.profileVersion < 1
    || !["CREATE", "UPDATE"].includes(data.operation)) return null;
  return Object.freeze({ ...data });
}

export function createTalentStudentProfileController({
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
      const payload = normalizeStudentProfileForm(value);
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
        const response = await fetchImpl(`${baseUrl}${PROFILE_PATH}`, {
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

export const STUDENT_PROFILE_UI_CONTRACT = Object.freeze({
  statuses: STATUS_VALUES,
  requestPerSave: 1,
  optimisticConcurrency: true,
  stagingMutation: false,
});
