import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { buildTalentAnalytics } from "../portal/talent/analytics.mjs";

const root = new URL("../", import.meta.url);

test("School and Fair Master schema is staging-only, audited, reversible, and linked to Candidate", async () => {
  const sql = await readFile(new URL("supabase/migrations/20260804133953_nov_talent_recruitment_master_completion.sql", root), "utf8");
  for (const token of ["nov_talent_school_masters_v1", "nov_talent_fair_masters_v1", "school_id", "fair_id", "nov_talent_recruitment_master_audit_v1"])
    assert.match(sql, new RegExp(token, "u"));
  assert.match(sql, /DEACTIVATE','RESTORE/u);
  assert.match(sql, /enable row level security/iu);
  assert.match(sql, /revoke all[\s\S]*anon, authenticated/iu);
  assert.match(sql, /grant execute[\s\S]*service_role/iu);
  assert.match(sql, /insert into public\.nov_talent_fair_masters_v1[\s\S]*from public\.nov_talent_fair_metrics_v1/iu);
  assert.doesNotMatch(sql, /delete from|idea-nov-core|employee_core/iu);
});

test("server API exposes master data through HUB session and keeps executive read-only", async () => {
  const [domain, api, client] = await Promise.all([
    readFile(new URL("supabase/functions/nov-talent-staging-api/domain.ts", root), "utf8"),
    readFile(new URL("supabase/functions/nov-talent-staging-api/index.ts", root), "utf8"),
    readFile(new URL("portal/talent/staging-write.mjs", root), "utf8")
  ]);
  assert.match(domain, /cleanRecruitmentMaster/u);
  assert.match(api, /nov_talent_mutate_recruitment_master_v1/u);
  assert.match(api, /nov_talent_set_candidate_master_links_v1/u);
  assert.match(api, /actor\.profile === "executive"/u);
  assert.match(client, /mutateMaster/u);
  assert.match(client, /linkMasters/u);
  assert.doesNotMatch(client, /service_role|rest\/v1/iu);
});

test("master-backed analytics calculates School and Fair rates without inventing denominators", () => {
  const analytics = buildTalentAnalytics({ overview: { total: 1, contacts: 1, offers: 1, mapped: 1 }, dashboard: { lineRegistrations: 1 },
    students: [{ schoolId: "school-1", school: "学校A", statusCode: "OFFERED", selectionHistory: [], eventHistory: [] }],
    schoolMasters: [{ school_id: "school-1", school_name: "学校A", is_active: true }],
    fairMasters: [{ fair_id: "fair-1", fair_name: "フェアA", event_date: "2026-08-01", contact_count: 10,
      line_registration_count: 8, participant_count: 12, offer_count: 2, hire_count: 1, participation_fee: 50000, is_active: true }]
  });
  assert.equal(analytics.schools[0].contacts, 1);
  assert.equal(analytics.schools[0].offers, 1);
  assert.equal(analytics.flow[0].hireRate, 10);
  assert.equal(analytics.flow[0].hireCost, 50000);
});

test("Fair Master analytics preserves null, confirmed zero, and positive integers", () => {
  const fair = (fair_id, event_date, values) => ({
    fair_id, fair_name: fair_id, event_date, is_active: true, ...values
  });
  const analytics = buildTalentAnalytics({ students: [], schoolMasters: [], fairMasters: [
    fair("null", "2026-08-03", { contact_count: null, line_registration_count: null, participant_count: null,
      offer_count: null, hire_count: null, participation_fee: null }),
    fair("zero", "2026-08-02", { contact_count: 0, line_registration_count: 0, participant_count: 0,
      offer_count: 0, hire_count: 0, participation_fee: 0 }),
    fair("positive", "2026-08-01", { contact_count: 10, line_registration_count: 8, participant_count: 12,
      offer_count: 2, hire_count: 1, participation_fee: 50000 })
  ] });

  assert.equal(analytics.flow[0].contacts, null);
  assert.equal(analytics.flow[0].participationFee, null);
  assert.equal(analytics.flow[1].contacts, 0);
  assert.equal(analytics.flow[1].participationFee, 0);
  assert.equal(analytics.flow[2].contacts, 10);
  assert.equal(analytics.flow[2].hireCost, 50000);
});

test("operation UI provides responsive School and Fair Master input", async () => {
  const [html, css] = await Promise.all([
    readFile(new URL("portal/talent/index.html", root), "utf8"), readFile(new URL("portal/talent/style.css", root), "utf8")
  ]);
  for (const id of ["fair-master-form", "fair-master-body", "school-master-form", "school-master-body", "profile-school-id", "profile-fair-id"])
    assert.match(html, new RegExp(`id="${id}"`, "u"));
  assert.match(css, /@media \(max-width: 520px\)[\s\S]*\.master-form/u);
});

test("workspace contract accepts candidate master links and master collections", async () => {
  const exact1 = await readFile(new URL("portal/talent/exact1.mjs", root), "utf8");
  assert.match(exact1, /"fairMasters", "schoolMasters", "students"/u);
  assert.match(exact1, /"schoolId"/u);
  assert.match(exact1, /"fairId"/u);
  assert.match(exact1, /validateSchoolMasters\(data\.schoolMasters\)/u);
  assert.match(exact1, /validateFairMasters\(data\.fairMasters\)/u);
});
