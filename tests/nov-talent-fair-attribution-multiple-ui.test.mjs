import assert from "node:assert/strict";
import test from "node:test";

import {
  fairOriginReviewLogicalCounts,
  filterFairOriginReviewGroups,
  groupFairOriginReviewEntries,
  renderFairOriginReview
} from "../portal/talent/app.mjs";

function element(tagName = "div") {
  return {
    tagName: String(tagName).toUpperCase(), dataset: {}, children: [], value: "", textContent: "",
    className: "", disabled: false,
    addEventListener() {}, append(...children) { this.children.push(...children); },
    replaceChildren(...children) { this.children = children; }
  };
}

function documentFixture() {
  const elements = new Map();
  return {
    createElement: (tagName) => element(tagName),
    getElementById(id) {
      if (!elements.has(id)) elements.set(id, element());
      return elements.get(id);
    }
  };
}

function visibleText(node) {
  return [node?.textContent || "", ...(node?.children || []).map(visibleText)].join(" ");
}

const entry = (overrides) => ({
  attribution_id: "10000000-0000-4000-8000-000000000001",
  candidate_id: "20000000-0000-4000-8000-000000000001",
  candidate_name: "テスト学生A", school_name: "テスト学校", original_trigger: "テストフェア",
  fair_id: "30000000-0000-4000-8000-000000000001", fair_name: "候補フェアA", fair_event_date: "2026-01-01",
  evidence_reference: "正本セル", attribution_status: "PENDING", attribution_version: 1, review_note: null,
  ...overrides
});

function entries() {
  return [
    entry({}),
    entry({
      attribution_id: "10000000-0000-4000-8000-000000000002",
      candidate_id: "20000000-0000-4000-8000-000000000002", candidate_name: "テスト学生B",
      fair_id: "30000000-0000-4000-8000-000000000002", fair_name: "候補フェアB1"
    }),
    entry({
      attribution_id: "10000000-0000-4000-8000-000000000003",
      candidate_id: "20000000-0000-4000-8000-000000000002", candidate_name: "テスト学生B",
      fair_id: "30000000-0000-4000-8000-000000000003", fair_name: "候補フェアB2", review_note: "追加確認中"
    })
  ];
}

test("physical rows are grouped into logical Candidate review units", () => {
  const groups = groupFairOriginReviewEntries(entries());
  assert.deepEqual(fairOriginReviewLogicalCounts(groups), { logical: 2, unique: 1, multiple: 1, physical: 3 });
  assert.equal(groups.find((group) => group.candidateKind === "MULTIPLE").entries.length, 2);
});

test("one-candidate, multiple-candidate, pending, confirmed and hold filters stay logical", () => {
  const groups = groupFairOriginReviewEntries(entries());
  assert.equal(filterFairOriginReviewGroups(groups, { candidateFilter: "UNIQUE" }).length, 1);
  assert.equal(filterFairOriginReviewGroups(groups, { candidateFilter: "MULTIPLE" }).length, 1);
  assert.equal(filterFairOriginReviewGroups(groups, { statusFilter: "PENDING" }).length, 2);
  assert.equal(filterFairOriginReviewGroups(groups, { statusFilter: "HOLD" }).length, 1);
  assert.equal(filterFairOriginReviewGroups(groups, { statusFilter: "CONFIRMED" }).length, 0);
});

test("synthetic UI renders one unique card and one grouped multiple-Fair card without internal IDs", () => {
  const documentObject = documentFixture();
  const consoleCalls = { error: 0, warn: 0 };
  const globalObject = {
    prompt() {},
    console: {
      error() { consoleCalls.error += 1; },
      warn() { consoleCalls.warn += 1; }
    }
  };
  documentObject.getElementById("fair-origin-review-filter").value = "ALL";
  documentObject.getElementById("fair-origin-review-candidate-filter").value = "ALL";
  renderFairOriginReview(documentObject, globalObject, entries());

  const list = documentObject.getElementById("fair-origin-review-list");
  const status = documentObject.getElementById("fair-origin-review-status");
  const text = visibleText(list);
  assert.equal(list.children.length, 2);
  assert.equal(status.textContent, "確認対象 2件（1候補 1件 / 複数候補 1件）・表示 2件");
  assert.match(text, /この学生はこのフェアがきっかけで合っていますか/);
  assert.match(text, /候補となるフェアが複数あります/);
  assert.match(text, /候補1：候補フェアB1/);
  assert.match(text, /候補2：候補フェアB2/);
  for (const label of ["このフェアで確認", "このフェアではない", "保留"]) assert.match(text, new RegExp(label));
  assert.doesNotMatch(text, /10000000-|20000000-|30000000-|Attribution|Canonical|manifest_case_id|candidate_id|fair_id/);
  assert.deepEqual(consoleCalls, { error: 0, warn: 0 });
});

test("multiple-candidate filter keeps both Fair choices inside one Review Unit", () => {
  const documentObject = documentFixture();
  documentObject.getElementById("fair-origin-review-filter").value = "ALL";
  documentObject.getElementById("fair-origin-review-candidate-filter").value = "MULTIPLE";
  renderFairOriginReview(documentObject, { prompt() {} }, entries());
  const list = documentObject.getElementById("fair-origin-review-list");
  const text = visibleText(list);
  assert.equal(list.children.length, 1);
  assert.match(text, /候補フェアB1/);
  assert.match(text, /候補フェアB2/);
  assert.doesNotMatch(text, /候補フェアA/);
});
