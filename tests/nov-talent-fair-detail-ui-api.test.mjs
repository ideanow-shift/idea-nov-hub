import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { buildFairDetailView, summarizeActiveFairMasters } from "../portal/talent/app.mjs";

const root = new URL("../", import.meta.url);

test("Fair API returns every existing detail column without inventing lineage columns", async () => {
  const source = await readFile(new URL("supabase/functions/nov-talent-staging-api/index.ts", root), "utf8");
  for (const field of [
    "participation_fee", "organizer_name", "event_format", "expected_contacts", "total_attendance",
    "participating_salons", "contact_count", "line_registration_count", "salon_tour_count", "note",
    "is_active", "created_at"
  ]) assert.match(source, new RegExp(`select=[^\n\"]*${field}`, "u"));
  for (const unavailable of ["source_spreadsheet", "source_sheet", "source_hash", "import_batch_id"])
    assert.doesNotMatch(source, new RegExp(`select=[^\n\"]*${unavailable}`, "u"));
});

test("active Fair analytics excludes inactive rows and preserves null separately from zero", () => {
  const summary = summarizeActiveFairMasters([
    { is_active: true, participation_fee: null, contact_count: null, line_registration_count: null, salon_tour_count: null },
    { is_active: true, participation_fee: 0, contact_count: 0, line_registration_count: 0, salon_tour_count: 0 },
    { is_active: true, participation_fee: 100000, contact_count: 20, line_registration_count: 10, salon_tour_count: 5 },
    { is_active: false, participation_fee: 900000, contact_count: 99, line_registration_count: 99, salon_tour_count: 99 }
  ]);
  assert.deepEqual(summary, {
    activeCount: 3,
    contactCount: 20,
    lineRegistrationCount: 10,
    salonTourCount: 5,
    participationFee: 100000,
    contactCost: 5000
  });
  const nullOnly = summarizeActiveFairMasters([{ is_active: true, participation_fee: null, contact_count: null }]);
  assert.equal(nullOnly.participationFee, null);
  assert.equal(nullOnly.contactCount, null);
  assert.equal(nullOnly.contactCost, null);
});

test("Fair detail distinguishes unregistered, confirmed zero, and calculated values", () => {
  const view = buildFairDetailView({
    fair_name: "表示テスト", event_date: "2026-08-06", is_active: true,
    participation_fee: 0, expected_contacts: null, total_attendance: 0, participating_salons: 2,
    contact_count: 10, line_registration_count: 0, salon_tour_count: null,
    interview_count: null, offer_count: null, hire_count: null,
    organizer_name: null, event_format: "対面", assigned_to: null, note: null, created_at: "2026-08-06T00:00:00Z"
  });
  const fields = Object.fromEntries(view.sections.flatMap((section) => section.fields));
  assert.equal(fields["参加費"], "0円");
  assert.equal(fields["接触見込み数"], "未登録");
  assert.equal(fields["全体入場数"], 0);
  assert.equal(fields["LINE登録率"], "0.0%");
  assert.equal(fields["見学率"], "集計準備中");
  assert.equal(fields["面接数"], "集計準備中");
  assert.equal(fields["内定数"], "集計準備中");
  assert.equal(fields["採用数"], "集計準備中");
  assert.equal(fields["採用率"], "集計準備中");
  assert.equal(fields["Source Lineage"], "未登録");
});

test("Fair management offers PC table, mobile cards, detail panel, and active-only copy", async () => {
  const [html, css, app] = await Promise.all([
    readFile(new URL("portal/talent/index.html", root), "utf8"),
    readFile(new URL("portal/talent/style.css", root), "utf8"),
    readFile(new URL("portal/talent/app.mjs", root), "utf8")
  ]);
  assert.match(html, /class="analysis-table fair-master-table"/u);
  assert.match(html, /id="fair-detail-panel"/u);
  assert.match(css, /@media \(max-width: 720px\)[\s\S]*\.fair-master-table thead \{ display: none;/u);
  assert.match(app, /masters\.filter\(\(fair\) => fair\.is_active !== false\)/u);
  assert.match(app, /"詳細", "detail"/u);
});
