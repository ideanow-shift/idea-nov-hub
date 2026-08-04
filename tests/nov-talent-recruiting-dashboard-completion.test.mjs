import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("Recruiting Dashboard Staging schema separates events, selection, actions, and fairs", async () => {
  const sql = await readFile(new URL("supabase/migrations/20260804081824_nov_talent_recruiting_dashboard_completion.sql", root), "utf8");
  for (const table of [
    "nov_talent_recruitment_events_v1",
    "nov_talent_selection_history_v1",
    "nov_talent_next_actions_v1",
    "nov_talent_fair_metrics_v1"
  ]) assert.match(sql, new RegExp(`create table public\\.${table}`, "i"));
  assert.match(sql, /enable row level security/iu);
  assert.match(sql, /revoke all[\s\S]*from public, anon, authenticated/iu);
  assert.doesNotMatch(sql, /idea-nov-core|employee_core|line_history/iu);
});

test("aggregate source facts keep Candidate identity out of the dashboard contract", async () => {
  const sql = await readFile(new URL("supabase/migrations/20260804094610_nov_talent_recruitment_source_facts.sql", root), "utf8");
  assert.match(sql, /source_type/iu);
  assert.match(sql, /source_row_no/iu);
  assert.match(sql, /fact_code/iu);
  assert.match(sql, /source_fingerprint/iu);
  assert.doesNotMatch(sql, /student_name|phone|email|line_identifier/iu);
});

test("Staging API builds the eight operational KPIs and preserves preparing states", async () => {
  const source = await readFile(new URL("supabase/functions/nov-talent-staging-api/index.ts", root), "utf8");
  for (const key of [
    "candidateCount", "entries", "salonTourPlanned", "interviewPlanned",
    "offers", "withdrawals", "schoolCount", "fairCount", "todayActions"
  ]) assert.match(source, new RegExp(`${key}:`));
  assert.match(source, /availability:/u);
  assert.match(source, /nov_talent_recruitment_source_facts_v1/u);
  assert.match(source, /nov_talent_next_actions_v1/u);
  assert.doesNotMatch(source, /idea-nov-core/u);
});

test("formal Candidate status dictionary is shared by UI and Staging API", async () => {
  const [dictionary, html, api] = await Promise.all([
    readFile(new URL("portal/talent/status-dictionary.mjs", root), "utf8"),
    readFile(new URL("portal/talent/index.html", root), "utf8"),
    readFile(new URL("supabase/functions/nov-talent-staging-api/domain.ts", root), "utf8")
  ]);
  for (const code of [
    "LINE_REGISTERED", "APPLICATION_RECEIVED", "SALON_TOUR_PLANNED", "SALON_TOUR_COMPLETED",
    "INTERVIEW_PLANNED", "INTERVIEW_COMPLETED", "UNDER_REVIEW", "OFFERED",
    "OFFER_ACCEPTED", "EXPECTED_JOIN", "OFFERED_ELSEWHERE", "WITHDRAWN", "REJECTED"
  ]) {
    assert.match(dictionary, new RegExp(code));
    assert.match(html, new RegExp(`value="${code}"`));
    assert.match(api, new RegExp(code));
  }
});
