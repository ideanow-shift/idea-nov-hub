const SCOPE_BY_ROLE = Object.freeze({
  representative: Object.freeze(["All", "Direct", "FC"]),
  sales_manager: Object.freeze(["Direct"]),
  area_manager: Object.freeze(["Assigned"]),
  store_manager: Object.freeze(["Self"])
});

export function allowedScopes(role) {
  return SCOPE_BY_ROLE[role] || Object.freeze([]);
}

export function canSelectScope(role, scope) {
  return allowedScopes(role).includes(scope);
}

export function normalizeScope(role, scope) {
  const allowed = allowedScopes(role);
  return allowed.includes(scope) ? scope : allowed[0] || null;
}

export function scopeHeading(role, scope, storeName = "") {
  if (role === "store_manager") return `${storeName || "自店舗"}の状況`;
  if (role === "area_manager") return "担当店舗の状況";
  if (scope === "Direct") return "直営店舗の状況";
  if (scope === "FC") return "FC店舗の状況";
  return "全店の状況";
}

export function emptyScopeMessage({ permitted, collecting = false } = {}) {
  if (!permitted) return "この店舗範囲は権限対象外です。";
  if (collecting) return "対象店舗のデータを集計中です。";
  return "選択した条件に該当する店舗データは0件です。";
}
