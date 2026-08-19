import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import {
  ACCOUNT_REVIEW_ACTIONS,
  buildAccountReviewDecisionPayload,
  filterAccountReviewItems,
  flagsForRowSemantics,
  safeAccountReviewError,
  submitAccountReviewDraft,
  validateAccountReviewDraft,
} from "../portal/management-app/dbf-account-mapping-review.js";

const ui = fs.readFileSync(new URL("../portal/management-app/dbf-account-mapping-review.js", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../portal/management-app/styles.css", import.meta.url), "utf8");
const runtime = fs.readFileSync(new URL("../portal/management-app/dbf-business-data-runtime.js", import.meta.url), "utf8");

const validDraft = {
  candidateId: "11111111-1111-4111-8111-111111111111",
  decision: "APPROVE",
  proposedAccountCode: "PL.SALES",
  proposedAccountName: "売上高",
  accountCategory: "revenue",
  normalBalance: "credit",
  parentCandidateId: null,
  hierarchyLevel: 0,
  rowSemantics: "POSTABLE_DETAIL",
};
const requestId = "22222222-2222-4222-8222-222222222222";

test("Account Review uses only the existing list and decide actions", () => {
  assert.deepEqual(ACCOUNT_REVIEW_ACTIONS, { list: "dbfAccountReviewListV1", decide: "dbfAccountReviewDecideV1" });
  assert.match(runtime, /accountReviewList:.*dbfAccountReviewListV1/u);
  assert.match(runtime, /accountReviewDecide:.*dbfAccountReviewDecideV1/u);
  assert.doesNotMatch(ui, /FINAL_DECISIONS|TERMINAL_DECISIONS|isFinalDecision/u);
});

test("missing decision and approval fields stop before the API call", async () => {
  let calls = 0;
  const fakeRuntime = { accountReviewDecide: async () => { calls += 1; } };
  const missingDecision = await submitAccountReviewDraft({ draft: { ...validDraft, decision: "" }, runtime: fakeRuntime, requestId, reload: async () => ({}) });
  assert.equal(missingDecision.kind, "validation");
  assert.equal(missingDecision.validation.errors.decision, "判断を選択してください。");
  const missingApprove = await submitAccountReviewDraft({ draft: { ...validDraft, proposedAccountCode: "" }, runtime: fakeRuntime, requestId, reload: async () => ({}) });
  assert.equal(missingApprove.validation.errors.proposedAccountCode, "正式な勘定科目コードは必須です。");
  const missingEdit = await submitAccountReviewDraft({ draft: { ...validDraft, decision: "EDIT_AND_APPROVE", proposedAccountName: "" }, runtime: fakeRuntime, requestId, reload: async () => ({}) });
  assert.equal(missingEdit.validation.errors.proposedAccountName, "正式な勘定科目名は必須です。");
  assert.equal(calls, 0);
});

test("approval validation follows the backend bounds and UUID contract", () => {
  assert.equal(validateAccountReviewDraft({ ...validDraft, hierarchyLevel: 33 }).errors.hierarchyLevel.length > 0, true);
  assert.equal(validateAccountReviewDraft({ ...validDraft, parentCandidateId: "not-a-uuid" }).errors.parentCandidateId.length > 0, true);
  assert.equal(validateAccountReviewDraft(validDraft).valid, true);
});

test("row semantics produce the exact backend flag pairs", () => {
  assert.deepEqual(flagsForRowSemantics("POSTABLE_DETAIL"), { isPostable: true, isControlTotal: false });
  assert.deepEqual(flagsForRowSemantics("DERIVED_SUBTOTAL"), { isPostable: false, isControlTotal: false });
  assert.deepEqual(flagsForRowSemantics("CONTROL_TOTAL"), { isPostable: false, isControlTotal: true });
  assert.deepEqual(flagsForRowSemantics("DISPLAY_ONLY"), { isPostable: false, isControlTotal: false });
});

test("exclude and needs-review send no invented canonical values", () => {
  for (const decision of ["EXCLUDE", "NEEDS_REVIEW"]) {
    const payload = buildAccountReviewDecisionPayload({ ...validDraft, decision }, requestId);
    assert.deepEqual({ code: payload.proposedAccountCode, name: payload.proposedAccountName, category: payload.accountCategory,
      balance: payload.normalBalance, parent: payload.parentCandidateId, level: payload.hierarchyLevel,
      semantics: payload.rowSemantics, postable: payload.isPostable, control: payload.isControlTotal },
    { code: null, name: null, category: null, balance: null, parent: null, level: null, semantics: null, postable: null, control: null });
  }
});

test("successful decide validates the receipt and reloads backend state", async () => {
  let reloads = 0;
  const fakeRuntime = { accountReviewDecide: async (payload) => ({ candidateId: payload.candidateId, decision: payload.decision, requestId: payload.requestId }) };
  const result = await submitAccountReviewDraft({ draft: validDraft, runtime: fakeRuntime, requestId, reload: async () => { reloads += 1; return { items: [] }; } });
  assert.equal(result.ok, true);
  assert.equal(reloads, 1);
});

test("conflict, final and duplicate safe errors reload without becoming success", async () => {
  for (const code of ["VERSION_CONFLICT", "DBF_ACCOUNT_REVIEW_ALREADY_FINAL", "DBF_DUPLICATE_REVIEW_REQUEST"]) {
    let reloads = 0;
    const error = new Error(code); error.requestId = "safe_request_1";
    const result = await submitAccountReviewDraft({ draft: validDraft, runtime: { accountReviewDecide: async () => { throw error; } }, requestId, reload: async () => { reloads += 1; return {}; } });
    assert.equal(result.ok, false);
    assert.equal(result.error.code, code);
    assert.equal(result.error.requestId, "safe_request_1");
    assert.equal(reloads, 1);
  }
});

test("transient and network failures preserve the caller draft", async () => {
  const draft = { ...validDraft };
  const snapshot = structuredClone(draft);
  const transient = new Error("AUTH_BACKEND_UNAVAILABLE");
  const result = await submitAccountReviewDraft({ draft, runtime: { accountReviewDecide: async () => { throw transient; } }, requestId, reload: async () => ({}) });
  assert.equal(result.ok, false); assert.deepEqual(draft, snapshot);
  let networkReloads = 0;
  const network = await submitAccountReviewDraft({ draft, runtime: { accountReviewDecide: async () => { throw new TypeError("network"); } }, requestId, reload: async () => { networkReloads += 1; return {}; } });
  assert.equal(network.kind, "network"); assert.equal(networkReloads, 1); assert.deepEqual(draft, snapshot);
});

test("safe errors sanitize request IDs and never expose raw messages", () => {
  const known = new Error("FORBIDDEN"); known.requestId = "request_safe-1";
  assert.deepEqual(safeAccountReviewError(known), { code: "FORBIDDEN", message: "この操作に必要な経営データ管理権限がありません。", requestId: "request_safe-1", reload: false, auth: false });
  const unknown = new Error("SQL says token=secret"); unknown.requestId = "<unsafe>";
  const safe = safeAccountReviewError(unknown);
  assert.equal(safe.requestId, null); assert.doesNotMatch(safe.message, /SQL|token|secret/u);
});

test("filters operate locally and return a dedicated zero-result state", () => {
  const items = [{ statementType: "PL", mappingStatus: "UNREVIEWED", sourceAccountName: "売上高", candidateSourceCode: "PL1" }];
  assert.equal(filterAccountReviewItems(items, { statementType: "PL", mappingStatus: "ALL", query: "売上" }).length, 1);
  assert.equal(filterAccountReviewItems(items, { statementType: "BS", mappingStatus: "ALL", query: "" }).length, 0);
});

test("source contains loading, error, empty, retry, labels, focus and row-scoped pending states", () => {
  for (const contract of [/aria-busy/u, /aria-live/u, /role", "alert/u, /対象データはありません/u, /条件に一致する候補はありません/u,
    /再読込/u, /財務諸表/u, /確認状況/u, /絞り込みを解除/u, /aria-invalid/u, /aria-describedby/u,
    /\.focus\(\)/u, /pending\.has\(item\.candidateId\)/u, /crypto\.randomUUID/u]) assert.match(ui, contract);
  assert.doesNotMatch(ui, /拒否:\s*\$\{error\.message\}/u);
});

test("responsive styles avoid the former fixed 1500px table", () => {
  assert.doesNotMatch(css, /min-width:\s*1500px/u);
  assert.match(css, /overflow-x:auto/u);
  assert.match(css, /position:sticky/u);
  assert.match(css, /@media\(max-width:800px\)/u);
  assert.match(css, /grid-template-columns:1fr/u);
  assert.match(css, /min-width:0/u);
});
