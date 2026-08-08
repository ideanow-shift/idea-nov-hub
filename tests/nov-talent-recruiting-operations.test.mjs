import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { buildRecruitmentDashboardDecision } from "../portal/talent/recruitment-ux.mjs";

const root = new URL("../", import.meta.url);

test("dashboard exposes connected facts and preserves unavailable states", () => {
  const dashboard = {
    candidateCount: 636, graduation2027: 528, graduation2028: 108,
    lineRegistrations: 615, entries: 42, salonTourCompleted: 23,
    interviewHistory: 42, offers: 35, offeredElsewhere: 0,
    withdrawals: 2, rejected: 5, schoolCount: 81, fairCount: 45,
    eventCount: 672, salonTourPlanned: 0, interviewPlanned: 0,
    availability: {
      candidateCount: true, graduation2027: true, graduation2028: true,
      lineRegistrations: true, entries: true, salonTourCompleted: true,
      interviewHistory: true, offers: true, offeredElsewhere: true,
      withdrawals: true, rejected: true, schoolCount: true, fairCount: true,
      eventCount: true, salonTourPlanned: false, interviewPlanned: true
    }
  };
  const view = buildRecruitmentDashboardDecision({ students: [{ recordId: "fixture" }], dashboard }, []);
  assert.equal(view.category, "AGGREGATION_PREPARING");
  assert.equal(view.metrics.find((metric) => metric.key === "candidateCount")?.value, 636);
  assert.equal(view.metrics.find((metric) => metric.key === "salonTourPlanned")?.value, "集計準備中");
  assert.equal(view.metrics.find((metric) => metric.key === "interviewPlanned")?.value, 0);
  assert.doesNotMatch(view.title, /安定しています/u);
});

test("Staging operation schema is audited, reversible, and server-only", async () => {
  const sql = await readFile(new URL("supabase/migrations/20260804102927_nov_talent_recruiting_operations.sql", root), "utf8");
  assert.match(sql, /nov_talent_recruitment_activity_audit_v1/iu);
  assert.match(sql, /append-only/iu);
  assert.match(sql, /DEACTIVATE','RESTORE/iu);
  assert.match(sql, /p_expected_version/iu);
  assert.match(sql, /grant execute[\s\S]*to service_role/iu);
  assert.match(sql, /revoke all[\s\S]*from public,anon,authenticated/iu);
  assert.doesNotMatch(sql, /idea-nov-core|employee_core|line_history/iu);
});

test("formal interview facts retain only source lineage and dates", async () => {
  const sql = await readFile(new URL("supabase/migrations/20260804103149_nov_talent_interview_source_facts.sql", root), "utf8");
  assert.equal((sql.match(/::date\)/gu) || []).length, 42);
  assert.match(sql, /ENTRIES_27/iu);
  assert.match(sql, /INTERVIEW_COMPLETED/iu);
  assert.doesNotMatch(sql, /student_name|phone|email|line_identifier/iu);
});

test("Candidate detail supports Event, Selection, Next Action, and manual interview linking", async () => {
  const [html, app, api] = await Promise.all([
    readFile(new URL("portal/talent/index.html", root), "utf8"),
    readFile(new URL("portal/talent/app.mjs", root), "utf8"),
    readFile(new URL("supabase/functions/nov-talent-staging-api/index.ts", root), "utf8")
  ]);
  for (const id of ["candidate-contact-add", "candidate-selection-add", "candidate-action-add", "candidate-activity-dialog", "unlinked-interview-list"])
    assert.match(html, new RegExp(`id="${id}"`, "u"));
  assert.match(app, /activityConfirmationController\?\.open/u);
  assert.match(app, /mutateActivity\(command\)/u);
  assert.match(app, /completeCandidateNextAction/u);
  assert.match(app, /operation: restoring \? "RESTORE" : "DEACTIVATE"/u);
  assert.match(app, /linkUnlinkedSelection/u);
  assert.match(api, /nov_talent_mutate_recruiting_activity_v1/u);
  assert.match(api, /actor\.profile === "executive"/u);
});

test("the browser client never exposes a service-role key or direct database write", async () => {
  const client = await readFile(new URL("portal/talent/staging-write.mjs", root), "utf8");
  assert.doesNotMatch(client, /service_role|SUPABASE_SERVICE_ROLE_KEY|rest\/v1/iu);
  assert.match(client, /Authorization: `Bearer \$\{bearer\}`/u);
});
