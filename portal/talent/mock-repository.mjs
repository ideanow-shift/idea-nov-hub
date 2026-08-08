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
  const countEvent = (code) => candidates.filter((candidate) => hasEvent(candidate, code)).length;
  const countSelection = (code) => candidates.filter((candidate) => hasSelection(candidate, code)).length;
  return Object.freeze({
    payloadMode: "summary",
    fiscalYear: "all",
    summary: Object.freeze({
      contacts: countEventRows(candidates, "CONTACT_RECORDED"),
      lineRegistrations: countEvent("LINE_REGISTERED"),
      salonTours: countEvent("SALON_TOUR_COMPLETED"),
      interviews: countSelection("INTERVIEW_COMPLETED"),
      passed: countSelection("OFFER_ACCEPTED"),
      offers: countSelection("OFFERED"),
      expectedJoiners: candidates.filter((candidate) => candidate.statusCode === "EXPECTED_JOIN").length
    })
  });
}

function buildWorkspace(candidates) {
  const ownerReview = candidates.filter((candidate) => candidate.classification === "OWNER_REVIEW").length;
  const quarantined = candidates.filter((candidate) => candidate.classification === "QUARANTINE").length;
  return Object.freeze({
    fiscalYear: "all",
    payloadMode: "workspace",
    overview: Object.freeze({
      contacts: countEventRows(candidates, "CONTACT_RECORDED"),
      entries: candidates.filter((candidate) => hasSelection(candidate, "APPLICATION_RECEIVED")).length,
      exactLinkSuggestions: 0,
      mapped: candidates.length - ownerReview - quarantined,
      manual: 0,
      offers: candidates.filter((candidate) => hasSelection(candidate, "OFFERED")).length,
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
    .filter((candidate) => /^\d{4}-\d{2}-\d{2}$/u.test(String(candidate.nextActionAt || "")) && candidate.nextActionAt <= today)
    .map((candidate) => {
      const reason = candidate.nextActionLabel || "対応期限を確認";
      return Object.freeze({
        assignedTo: candidate.assignee || null,
        candidateId: candidate.recordId,
        dueDate: candidate.nextActionAt,
        label: reason
      });
    })
    .sort((left, right) => String(left.dueDate || "9999-12-31").localeCompare(String(right.dueDate || "9999-12-31")))
    .slice(0, Math.max(0, Math.min(5, Number(limit) || 0))));
}

function hasEvent(candidate, code) {
  return [...(candidate?.contactHistory || []), ...(candidate?.eventHistory || [])]
    .some((item) => item?.active !== false && item?.code === code);
}

function countEventRows(candidates, code) {
  return candidates.reduce((count, candidate) => count + [...(candidate?.contactHistory || []), ...(candidate?.eventHistory || [])]
    .filter((item) => item?.active !== false && item?.code === code).length, 0);
}

function hasSelection(candidate, code) {
  return (candidate?.selectionHistory || [])
    .some((item) => item?.active !== false && item?.code === code);
}

function dateText(value) {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
