import assert from "node:assert/strict";
import {
  buildCanonicalTitleProjection,
  classifyLegacyPositionLabel,
} from "./position-assignment-contract.mjs";

const corporate = ["会長", "社長", "副社長", "取締役", "執行役員", "相談役"];
const assignments = ["部長", "課長", "係長", "エリアマネージャー", "店長", "副店長", "店長見習い", "FCオーナー", "FCオーナー見習い"];

for (const label of corporate) {
  assert.equal(classifyLegacyPositionLabel(label), "corporate_position");
}
for (const label of assignments) {
  assert.equal(classifyLegacyPositionLabel(label), "organization_assignment");
}
assert.equal(classifyLegacyPositionLabel("未設定"), "null_state");
assert.equal(classifyLegacyPositionLabel("一般スタッフ"), "staff_classification_review");

const egawaCase = buildCanonicalTitleProjection({
  positionName: "執行役員",
  asOf: "2026-08-11",
  assignments: [{
    organizationName: "営業部",
    assignmentName: "部長",
    effectiveFrom: "2026-01-01",
    effectiveTo: null,
    active: true,
    primary: true,
  }],
});
assert.deepEqual(egawaCase, {
  source: "canonical",
  displayTitle: "執行役員 兼 営業部長",
  positionName: "執行役員",
  assignmentLabels: ["営業部長"],
});

const expired = buildCanonicalTitleProjection({
  positionName: "",
  legacyPositionName: "部長",
  asOf: "2026-08-11",
  assignments: [{
    organizationName: "営業部",
    assignmentName: "部長",
    effectiveFrom: "2025-01-01",
    effectiveTo: "2026-01-01",
    active: true,
  }],
});
assert.equal(expired.source, "legacy_fallback");
assert.equal(expired.displayTitle, "部長");

const multi = buildCanonicalTitleProjection({
  positionName: "取締役",
  asOf: "2026-08-11",
  assignments: [
    { organizationName: "BASSA野方店", assignmentName: "店長", active: true, primary: false, priority: 2 },
    { organizationName: "営業部", assignmentName: "部長", active: true, primary: true, priority: 1 },
  ],
});
assert.equal(multi.displayTitle, "取締役 兼 営業部長 兼 BASSA野方店長");

console.log("position-assignment contract fixtures: pass");
