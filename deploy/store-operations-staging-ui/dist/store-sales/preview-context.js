export const STORE_SALES_PREVIEW_CONTEXT_KEY = "ideaNov.storeSales.previewActor.v1";

const FIXTURE_BY_ROLE = Object.freeze({
  super_admin: "executive",
  executive: "executive",
  representative: "executive",
  department_manager: "sales_manager",
  sales_manager: "sales_manager",
  area_manager: "area_manager",
  store_manager: "store_manager"
});

const MOCK_ROLE_BY_FIXTURE = Object.freeze({
  executive: "representative",
  sales_manager: "sales_manager",
  area_manager: "area_manager",
  store_manager: "store_manager"
});

export function resolvePreviewFixture(roleKeys = []) {
  const roles = new Set((Array.isArray(roleKeys) ? roleKeys : []).map((value) => String(value || "").trim().toLowerCase()));
  for (const [role, fixture] of Object.entries(FIXTURE_BY_ROLE)) {
    if (roles.has(role)) return fixture;
  }
  return "employee-denied";
}

export function saveStoreSalesPreviewContext({ roleKeys = [], source = "nov-hub" } = {}) {
  const fixture = resolvePreviewFixture(roleKeys);
  const context = {
    schema: "store-sales-preview-context",
    version: 1,
    fixture,
    mockRole: MOCK_ROLE_BY_FIXTURE[fixture] || null,
    source,
    issuedAt: new Date().toISOString()
  };
  sessionStorage.setItem(STORE_SALES_PREVIEW_CONTEXT_KEY, JSON.stringify(context));
  return Object.freeze(context);
}

export function restoreStoreSalesPreviewContext() {
  let parsed;
  try {
    parsed = JSON.parse(sessionStorage.getItem(STORE_SALES_PREVIEW_CONTEXT_KEY) || "null");
  } catch {
    return null;
  }
  if (parsed?.schema !== "store-sales-preview-context" || parsed?.version !== 1) return null;
  if (!Object.values(FIXTURE_BY_ROLE).includes(parsed.fixture) && parsed.fixture !== "employee-denied") return null;
  return Object.freeze({
    fixture: parsed.fixture,
    mockRole: MOCK_ROLE_BY_FIXTURE[parsed.fixture] || null,
    source: String(parsed.source || ""),
    issuedAt: String(parsed.issuedAt || "")
  });
}

export function clearStoreSalesPreviewContext() {
  sessionStorage.removeItem(STORE_SALES_PREVIEW_CONTEXT_KEY);
}
