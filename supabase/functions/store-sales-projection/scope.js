import { StagingApiError } from "./errors.js";

const ROLE_SCOPE = Object.freeze({
  representative_director: { type: "all_group", key: "synthetic-group" },
  director: { type: "all_group", key: "synthetic-group" },
  executive_officer: { type: "all_group", key: "synthetic-group" },
  department_manager: { type: "department", key: "synthetic-dept-sales" },
  store_manager: { type: "own_store", key: "synthetic-direct-01" },
  franchise_owner: { type: "franchise", key: "synthetic-fc-company-01" }
});

export function resolveActorScope(actor) {
  if (actor?.role === "employee" || !ROLE_SCOPE[actor?.role]) {
    throw new StagingApiError("FORBIDDEN", "Store Sales is not available for this actor.", 403);
  }
  return Object.freeze({ actorId: actor.employeeId, role: actor.role, ...ROLE_SCOPE[actor.role] });
}

export function scopeStores(scope, stores) {
  if (scope.type === "all_group") return stores;
  if (scope.type === "department") return stores.filter((store) => store.department_id === scope.key);
  if (scope.type === "own_store") return stores.filter((store) => store.store_id === scope.key);
  if (scope.type === "franchise") return stores.filter((store) => store.fc_company_id === scope.key);
  return [];
}

export function assertStoreScope(scope, store) {
  if (!scopeStores(scope, [store]).length) throw new StagingApiError("FORBIDDEN", "Store is outside actor scope.", 403);
}
