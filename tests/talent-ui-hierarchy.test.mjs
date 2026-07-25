import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { buildBulkTriageCounts, buildMatchOnlyReviewProposal, buildSingleStudentReviewProposal, filterTalentStudents, isNewApplicantCandidate } from "../portal/talent/app.mjs";

const root = new URL("../portal/talent/", import.meta.url);

test("Talent exposes recruitment and workforce as accessible primary tabs", async () => {
  const html = await readFile(new URL("index.html", root), "utf8");

  assert.match(html, /aria-label="人財投資管理の業務区分"/);
  assert.match(html, /data-primary-tab="recruitment"[\s\S]*求人管理/);
  assert.match(html, /data-primary-tab="workforce"[\s\S]*現職者管理/);
  assert.match(html, /id="panel-recruitment"[\s\S]*role="tabpanel"/);
  assert.match(html, /id="panel-workforce"[\s\S]*role="tabpanel"/);
});

test("recruitment subtabs stay visually and semantically below the primary tabs", async () => {
  const html = await readFile(new URL("index.html", root), "utf8");

  assert.match(html, /class="secondary-tabs"[\s\S]*全体サマリー/);
  assert.match(html, /data-secondary-tab="students"[\s\S]*学生フォロー/);
  assert.match(html, /data-secondary-tab="fairs"[\s\S]*フェア分析/);
  assert.match(html, /data-secondary-tab="schools"[\s\S]*学校分析/);
});

test("workforce management exposes four accessible procedure tabs", async () => {
  const html = await readFile(new URL("index.html", root), "utf8");
  const app = await readFile(new URL("app.mjs", root), "utf8");

  assert.match(html, /aria-label="現職者管理メニュー"/);
  for (const key of ["onboarding", "transfer", "leave", "retirement"]) {
    assert.match(html, new RegExp(`data-workforce-tab="${key}"`));
    assert.match(html, new RegExp(`id="workforce-${key}"[\\s\\S]*role="tabpanel"`));
  }
  assert.match(app, /WORKFORCE_TABS/);
  assert.match(app, /data-workforce-tab/);
});

test("student editing supports canonical profiles and unmapped staging rows", async () => {
  const html = await readFile(new URL("index.html", root), "utf8");
  const app = await readFile(new URL("app.mjs", root), "utf8");

  assert.match(html, /id="student-edit-open"[^>]*disabled[^>]*aria-disabled="true"/);
  assert.match(app, /editButton\.disabled = !editable/);
  assert.match(app, /student\.mappingStatus === "UNMAPPED"/);
  assert.match(app, /staging補足情報を保存しています/);
  assert.match(app, /createTalentStagingSupplementController/);
});

test("student detail exposes an individual confirmation action without replacing the bulk flow", async () => {
  const html = await readFile(new URL("index.html", root), "utf8");
  const app = await readFile(new URL("app.mjs", root), "utf8");

  assert.match(html, /id="student-confirm-open"[^>]*disabled[^>]*aria-disabled="true"/);
  assert.match(app, /buildSingleStudentReviewProposal/);
  assert.match(app, /student\.suggestionCategory === "EXACT1"/);
  assert.match(app, /confirmButton\.disabled = !historicalReviewController\.enabled/);
  assert.match(app, /この候補だけを確認/);
  assert.match(app, /既存名簿との一致だけを反映しますか/);
  assert.match(html, /id="student-review-target"/);
  assert.match(app, /ENTRIES_27/, "manual mapping is available for entry records");
  assert.match(app, /OFFERS_27/, "manual mapping is available for offer records");
});

test("single link confirmation includes an unmapped contact target as the primary step", () => {
  const proposal = buildSingleStudentReviewProposal({
    recordId: "00000000-0000-4000-8000-000000000002",
    mappingStatus: "UNMAPPED",
    primaryEligible: false,
    suggestionCategory: "EXACT1",
    suggestedTargetRecordId: "00000000-0000-4000-8000-000000000001"
  }, {
    students: [{
      recordId: "00000000-0000-4000-8000-000000000001",
      sourceCode: "CONTACTS_27",
      mappingStatus: "UNMAPPED"
    }]
  });

  assert.deepEqual(proposal.primaryRecordIds, ["00000000-0000-4000-8000-000000000001"]);
  assert.equal(proposal.linkPairs.length, 1);
});

test("single review can build a manually selected contact mapping", () => {
  const proposal = buildSingleStudentReviewProposal({
    recordId: "00000000-0000-4000-8000-000000000012",
    mappingStatus: "UNMAPPED",
    primaryEligible: false,
    suggestionCategory: "NONE"
  }, {
    students: [{
      recordId: "00000000-0000-4000-8000-000000000013",
      sourceCode: "CONTACTS_27",
      mappingStatus: "UNMAPPED"
    }]
  }, "00000000-0000-4000-8000-000000000013");

  assert.deepEqual(proposal.primaryRecordIds, ["00000000-0000-4000-8000-000000000013"]);
  assert.deepEqual(proposal.linkPairs, [{
    sourceRecordId: "00000000-0000-4000-8000-000000000012",
    targetRecordId: "00000000-0000-4000-8000-000000000013"
  }]);
});

test("student review KPIs separate owner review, quarantine, and confirmed states", async () => {
  const html = await readFile(new URL("index.html", root), "utf8");
  const app = await readFile(new URL("app.mjs", root), "utf8");

  for (const id of ["student-owner-review", "student-quarantine", "student-importable"]) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  assert.match(app, /"student-owner-review": overview\.ownerReview/);
  assert.match(app, /"student-quarantine": overview\.quarantined/);
  assert.match(app, /"student-importable": overview\.mapped/);
});

test("bulk triage separates exact matches, new candidates, ambiguous rows, and holds", () => {
  const counts = buildBulkTriageCounts([
    { mappingStatus: "UNMAPPED", sourceCode: "ENTRIES_27", suggestionCategory: "EXACT1" },
    { mappingStatus: "UNMAPPED", sourceCode: "OFFERS_27", suggestionCategory: "NONE" },
    { mappingStatus: "UNMAPPED", sourceCode: "OFFERS_27", suggestionCategory: "AMBIGUOUS" },
    { mappingStatus: "UNMAPPED", sourceCode: "CONTACTS_27", suggestionCategory: "NONE" },
    { mappingStatus: "OWNER_CONFIRMED", sourceCode: "CONTACTS_27", suggestionCategory: "NONE" }
  ]);

  assert.deepEqual(counts, { exact1: 1, newApplicant: 1, ambiguous: 1, hold: 1 });
});

test("new applicant candidate filtering stays limited to unmapped entry and offer rows", () => {
  assert.equal(isNewApplicantCandidate({ mappingStatus: "UNMAPPED", sourceCode: "ENTRIES_27", suggestionCategory: "NONE" }), true);
  assert.equal(isNewApplicantCandidate({ mappingStatus: "UNMAPPED", sourceCode: "OFFERS_27", suggestionCategory: "NONE" }), true);
  assert.equal(isNewApplicantCandidate({ mappingStatus: "OWNER_CONFIRMED", sourceCode: "ENTRIES_27", suggestionCategory: "NONE" }), false);
  assert.equal(isNewApplicantCandidate({ mappingStatus: "UNMAPPED", sourceCode: "CONTACTS_27", suggestionCategory: "NONE" }), false);
});

test("student list filter keeps new candidates visible and narrows review queues", () => {
  const rows = [
    { displayName: "接触候補", sourceCode: "CONTACTS_27", classification: "OWNER_REVIEW", mappingStatus: "UNMAPPED", suggestionCategory: "NONE" },
    { displayName: "新規候補", sourceCode: "ENTRIES_27", classification: "OWNER_REVIEW", mappingStatus: "UNMAPPED", suggestionCategory: "NONE" },
    { displayName: "確認済み", sourceCode: "OFFERS_27", classification: "IMPORTABLE", mappingStatus: "OWNER_CONFIRMED", suggestionCategory: "NONE" },
    { displayName: "隔離", sourceCode: "OFFERS_27", classification: "QUARANTINE", mappingStatus: "UNMAPPED", suggestionCategory: "AMBIGUOUS" }
  ];

  assert.deepEqual(filterTalentStudents(rows, { state: "NEW_CANDIDATE" }).map((row) => row.displayName), ["新規候補"]);
  assert.deepEqual(filterTalentStudents(rows, { state: "QUARANTINE" }).map((row) => row.displayName), ["隔離"]);
  assert.deepEqual(filterTalentStudents(rows, { source: "ENTRIES_27" }).map((row) => row.displayName), ["新規候補"]);
});

test("student list keeps safe review reasons visible before selection", async () => {
  const app = await readFile(new URL("app.mjs", root), "utf8");
  const css = await readFile(new URL("style.css", root), "utf8");

  assert.match(app, /student.reasonLabels\.filter\(Boolean\)\.slice\(0, 2\)/);
  assert.match(app, /確認事項: \$\{reasons\.join\("・"\)\}/);
  assert.match(css, /\.student-list-reason\s*\{/);
});

test("student quick filters expose their queue counts", async () => {
  const html = await readFile(new URL("index.html", root), "utf8");
  const app = await readFile(new URL("app.mjs", root), "utf8");

  assert.match(html, /id="student-filter-review"[^>]*data-label="要確認"/);
  assert.match(app, /filterTalentStudents\(students, \{ state: value \}\)\.length/);
  assert.match(app, /button\.setAttribute\("aria-label", `\$\{label\} \$\{count\}件`\)/);
});

test("bulk confirmation proposal contains only exact roster links", () => {
  const proposal = buildMatchOnlyReviewProposal({ students: [
    { recordId: "00000000-0000-4000-8000-000000000001", mappingStatus: "UNMAPPED", primaryEligible: true, sourceCode: "CONTACTS_27" },
    { recordId: "00000000-0000-4000-8000-000000000002", mappingStatus: "UNMAPPED", suggestionCategory: "EXACT1", suggestedTargetRecordId: "00000000-0000-4000-8000-000000000003", sourceCode: "ENTRIES_27" },
    { recordId: "00000000-0000-4000-8000-000000000004", mappingStatus: "UNMAPPED", suggestionCategory: "NONE", sourceCode: "OFFERS_27" }
  ] });
  assert.deepEqual(proposal.primaryRecordIds, []);
  assert.deepEqual(proposal.linkPairs, [{
    sourceRecordId: "00000000-0000-4000-8000-000000000002",
    targetRecordId: "00000000-0000-4000-8000-000000000003"
  }]);
});

test("navigation supports keyboard movement and responsive one-column layouts", async () => {
  const app = await readFile(new URL("app.mjs", root), "utf8");
  const css = await readFile(new URL("style.css", root), "utf8");

  assert.match(app, /ArrowRight/);
  assert.match(app, /ArrowLeft/);
  assert.match(app, /Home/);
  assert.match(app, /End/);
  assert.match(css, /@media \(max-width: 860px\)/);
  assert.match(css, /\.primary-tabs\s*\{[\s\S]*grid-template-columns:\s*1fr/);
  assert.match(css, /\.workforce-summary\s*\{[\s\S]*grid-template-columns:\s*1fr/);
});
