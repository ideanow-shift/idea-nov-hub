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
    contactRegisteredCount: 2,
    contactComplete: false,
    lineRegistrationCount: 10,
    lineRegistrationRegisteredCount: 2,
    lineRegistrationComplete: false,
    salonTourCount: 5,
    salonTourRegisteredCount: 2,
    salonTourComplete: false,
    participationFee: 100000,
    participationFeeRegisteredCount: 2,
    participationFeeComplete: false,
    contactCost: null
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
  assert.equal(fields["全体入場数"], "0件");
  assert.equal(fields["会場"], "未登録");
  assert.equal(fields["LINE登録率"], "0.0%");
  assert.equal(fields["見学率"], "集計準備中");
  assert.equal(fields["面接数"], "集計準備中");
  assert.equal(fields["内定数"], "集計準備中");
  assert.equal(fields["採用数"], "集計準備中");
  assert.equal(fields["採用率"], "集計準備中");
  assert.equal(fields["Source Lineage"], "未登録");
});

test("Fair KPI coverage reports registered rows without treating null as zero", () => {
  const active = Array.from({ length: 46 }, (_, index) => ({
    is_active: true,
    contact_count: index === 0 ? 712 : 0,
    line_registration_count: index < 40 ? (index === 0 ? 465 : 0) : null,
    salon_tour_count: index < 41 ? (index === 0 ? 188 : 0) : null,
    participation_fee: index < 40 ? 0 : null
  }));
  const inactive = Array.from({ length: 36 }, () => ({
    is_active: false, contact_count: 999, line_registration_count: 999, salon_tour_count: 999, participation_fee: 999
  }));
  const summary = summarizeActiveFairMasters([...active, ...inactive]);
  assert.equal(summary.activeCount, 46);
  assert.equal(summary.contactCount, 712);
  assert.equal(summary.contactRegisteredCount, 46);
  assert.equal(summary.lineRegistrationCount, 465);
  assert.equal(summary.lineRegistrationRegisteredCount, 40);
  assert.equal(summary.salonTourCount, 188);
  assert.equal(summary.salonTourRegisteredCount, 41);
  assert.equal(summary.participationFeeRegisteredCount, 40);
});

test("Fair management offers PC table, mobile cards, detail panel, and active-only copy", async () => {
  const [html, css, app] = await Promise.all([
    readFile(new URL("portal/talent/index.html", root), "utf8"),
    readFile(new URL("portal/talent/style.css", root), "utf8"),
    readFile(new URL("portal/talent/app.mjs", root), "utf8")
  ]);
  assert.match(html, /class="analysis-table fair-master-table"/u);
  assert.match(html, /id="fair-detail-panel"/u);
  for (const id of ["fair-contact-coverage", "fair-line-coverage", "fair-tour-coverage", "fair-fee-coverage"])
    assert.match(html, new RegExp(`id="${id}"`, "u"));
  assert.match(css, /@media \(max-width: 720px\)[\s\S]*\.fair-master-table thead \{ display: none;/u);
  assert.match(app, /masters\.filter\(\(fair\) => fair\.is_active !== false\)/u);
  assert.match(app, /"詳細", "detail"/u);
});
