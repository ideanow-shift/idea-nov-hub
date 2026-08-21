const MOCK_ROLES = new Set(["representative", "sales_manager", "area_manager", "store_manager"]);

const STORE_SCOPE_BY_ROLE = Object.freeze({
  representative: Object.freeze({ type: "all", store_keys: Object.freeze([]) }),
  sales_manager: Object.freeze({ type: "direct", store_keys: Object.freeze([]) }),
  area_manager: Object.freeze({
    type: "assigned",
    store_keys: Object.freeze(["mock-store-13", "mock-store-14", "mock-store-15", "mock-store-16", "mock-store-17"])
  }),
  store_manager: Object.freeze({ type: "self", store_keys: Object.freeze(["mock-store-13"]) })
});

const FIXTURE_BY_ROLE = Object.freeze({
  representative: "executive",
  sales_manager: "sales_manager",
  area_manager: "area_manager",
  store_manager: "store_manager"
});

export function createStoreSalesMockIdentity(role = "sales_manager") {
  const normalizedRole = String(role || "").trim().toLowerCase();
  if (!MOCK_ROLES.has(normalizedRole)) return null;
  return Object.freeze({
    identity_type: "store-sales-preview-mock",
    employee_id: `mock-employee-${normalizedRole}`,
    role: normalizedRole,
    organization: Object.freeze({
      organization_id: "mock-org-idea-nov",
      organization_name: "IDEA NOV Mock Organization"
    }),
    store_scope: STORE_SCOPE_BY_ROLE[normalizedRole]
  });
}

export function isStoreSalesMockIdentity(value) {
  return Boolean(
    value &&
    value.identity_type === "store-sales-preview-mock" &&
    /^mock-employee-/.test(String(value.employee_id || "")) &&
    MOCK_ROLES.has(value.role) &&
    value.organization?.organization_id === "mock-org-idea-nov" &&
    value.store_scope === STORE_SCOPE_BY_ROLE[value.role]
  );
}

export function resolveMockIdentityFixture(identity) {
  return isStoreSalesMockIdentity(identity) ? FIXTURE_BY_ROLE[identity.role] : "";
}
