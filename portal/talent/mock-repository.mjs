import { buildAnonymousTalentSeeds, MOCK_SEED_INVENTORY } from "./mock-seeds.mjs";

export const MOCK_RUNTIME_STATES = Object.freeze([
  "loading", "ready", "empty", "unauthorized", "forbidden",
  "validation_error", "timeout", "offline", "maintenance"
]);

export function createNovTalentMockRepository({ state = "ready", now = new Date() } = {}) {
  const normalizedState = MOCK_RUNTIME_STATES.includes(state) ? state : "validation_error";
  const seed = buildAnonymousTalentSeeds({ now });
  const candidates = normalizedState === "empty" ? Object.freeze([]) : seed.candidates;

  return Object.freeze({
    mode: "mock",
    state: normalizedState,
    seedInventory: MOCK_SEED_INVENTORY,
    async getSummary() {
      return stateResult(normalizedState, () => buildSummary(candidates));
    },
    async getWorkspace() {
      return stateResult(normalizedState, () => buildWorkspace(candidates));
    },
    async getTodayTasks({ limit = 5 } = {}) {
      return stateResult(normalizedState, () => buildTodayTasks(candidates, now, limit));
    }
  });
}

function stateResult(state, factory) {
  if (state === "ready" || state === "empty") return Object.freeze({ ok: true, state, data: factory() });
  return Object.freeze({ ok: false, state, category: state });
}

function buildSummary(candidates) {
  const count = (code) => candidates.filter((candidate) => candidate.statusCode === code).length;
  return Object.freeze({
    payloadMode: "summary",
    fiscalYear: "all",
    summary: Object.freeze({
      contacts: candidates.length,
      lineRegistrations: candidates.filter((candidate) => candidate.lineRegistrationDate).length,
      salonTours: count("SALON_TOUR_COMPLETED"),
      interviews: count("INTERVIEW_COMPLETED"),
      passed: count("OFFER_ACCEPTED"),
      offers: count("OFFERED"),
      expectedJoiners: count("EXPECTED_JOIN")
    })
  });
}

function buildWorkspace(candidates) {
  const countSource = (prefix) => candidates.filter((candidate) => candidate.sourceCode.startsWith(prefix)).length;
  const ownerReview = candidates.filter((candidate) => candidate.classification === "OWNER_REVIEW").length;
  const quarantined = candidates.filter((candidate) => candidate.classification === "QUARANTINE").length;
  return Object.freeze({
    fiscalYear: "all",
    payloadMode: "workspace",
    overview: Object.freeze({
      contacts: countSource("CONTACTS_"),
      entries: countSource("ENTRIES_"),
      exactLinkSuggestions: 0,
      mapped: candidates.length - ownerReview - quarantined,
      manual: 0,
      offers: countSource("OFFERS_"),
      ownerReview,
      primaryCandidates: 0,
      quarantined,
      remainingManual: ownerReview + quarantined,
      total: candidates.length
    }),
    students: candidates
  });
}

export function buildTodayTasks(candidates, now = new Date(), limit = 5) {
  const today = dateText(now);
  return Object.freeze(candidates
    .map((candidate) => {
      const overdue = candidate.nextActionAt && candidate.nextActionAt <= today;
      const reason = overdue
        ? candidate.nextActionLabel || "対応期限を確認"
        : candidate.nextActionLabel || (candidate.statusCode === "OFFERED" ? "内定承諾を確認"
          : candidate.statusCode === "SALON_TOUR_COMPLETED" ? "見学後フォロー"
            : candidate.classification === "OWNER_REVIEW" ? "要確認を整理" : "");
      return reason ? Object.freeze({
        candidateId: candidate.recordId,
        candidateName: candidate.displayName,
        dueDate: candidate.nextActionAt,
        label: reason,
        priority: overdue ? "高" : "通常"
      }) : null;
    })
    .filter(Boolean)
    .sort((left, right) => String(left.dueDate || "9999-12-31").localeCompare(String(right.dueDate || "9999-12-31")))
    .slice(0, Math.max(0, Math.min(5, Number(limit) || 0))));
}

function dateText(value) {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
