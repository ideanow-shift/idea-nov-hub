export const NOV_NAVI_TODAY_SCHEMA = "nov-navi-today-v1";

export const NOV_NAVI_TODAY_FIELDS = Object.freeze([
  "schedule",
  "tasks",
  "approvals",
  "thanks",
  "inquiries",
  "growthPoints"
]);

export const NOV_NAVI_TODAY_SOURCES = Object.freeze({
  schedule: "attendance",
  tasks: "task_manager",
  approvals: "decision_hub",
  thanks: "idea_link",
  inquiries: "nov_support",
  growthPoints: "growth"
});

function isBoundedAggregate(value) {
  return Number.isSafeInteger(value) && value >= 0 && value <= 1_000_000;
}

export function getNovNaviTodaySnapshot(today) {
  const source = today && typeof today === "object" && !Array.isArray(today) ? today : {};
  return NOV_NAVI_TODAY_FIELDS.map((key) => (isBoundedAggregate(source[key]) ? source[key] : null));
}

export function isNovNaviTodayEnvelope(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  if (value.schema !== NOV_NAVI_TODAY_SCHEMA) return false;
  if (!value.aggregates || typeof value.aggregates !== "object" || Array.isArray(value.aggregates)) return false;
  return Object.keys(value).every((key) => key === "schema" || key === "aggregates")
    && Object.keys(value.aggregates).every((key) => NOV_NAVI_TODAY_FIELDS.includes(key))
    && NOV_NAVI_TODAY_FIELDS.every((key) => value.aggregates[key] === undefined || isBoundedAggregate(value.aggregates[key]));
}
