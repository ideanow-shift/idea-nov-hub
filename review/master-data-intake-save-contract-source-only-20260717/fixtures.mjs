import assert from "node:assert/strict";
import {
  classifyIdempotentAttempt,
  DATA_INTAKE_SAVE_CONTRACT,
  validateDataIntakeCommit
} from "./master-data-intake-save-contract-candidate.mjs";

const digestA = "a".repeat(64);
const digestB = "b".repeat(64);
const requestA = "123e4567-e89b-42d3-a456-426614174000";
const requestB = "123e4567-e89b-42d3-a456-426614174001";

function employeePayload(overrides = {}) {
  return {
    target: "employees",
    clientRequestId: requestA,
    fileDigest: digestA,
    previewDigest: digestB,
    expected: { total: 2, creates: 1, updates: 1, unchanged: 0, errors: 0 },
    rows: [
      { rowNumber: 2, action: "create", values: { "社員番号": "SYN-001", "氏名": "SYNTHETIC EMPLOYEE" } },
      { rowNumber: 3, action: "update", values: { "社員番号": "SYN-002", "氏名": "SYNTHETIC EMPLOYEE 2", "所属": "SYNTHETIC STORE" } }
    ],
    ...overrides
  };
}

const fixtures = [
  ["valid employee", () => assert.equal(validateDataIntakeCommit(employeePayload()).code, "READY_FOR_ATOMIC_COMMIT")],
  ["valid store", () => assert.equal(validateDataIntakeCommit({ ...employeePayload(), target: "stores", expected: { total: 1, creates: 1, updates: 0, unchanged: 0, errors: 0 }, rows: [{ rowNumber: 2, action: "create", values: { "店舗ID": "synthetic-store", "店舗名": "SYNTHETIC STORE" } }] }).ok, true)],
  ["valid corporation", () => assert.equal(validateDataIntakeCommit({ ...employeePayload(), target: "corporations", expected: { total: 1, creates: 1, updates: 0, unchanged: 0, errors: 0 }, rows: [{ rowNumber: 2, action: "create", values: { "法人No": "SYN-001", "法人名": "SYNTHETIC CORP" } }] }).ok, true)],
  ["invalid request id", () => assert.equal(validateDataIntakeCommit(employeePayload({ clientRequestId: "bad" })).code, "INVALID_CLIENT_REQUEST_ID")],
  ["invalid digest", () => assert.equal(validateDataIntakeCommit(employeePayload({ fileDigest: "bad" })).code, "INVALID_FILE_DIGEST")],
  ["preview errors blocked", () => assert.equal(validateDataIntakeCommit(employeePayload({ expected: { total: 2, creates: 1, updates: 1, unchanged: 0, errors: 1 } })).code, "PREVIEW_HAS_ERRORS")],
  ["count mismatch", () => assert.equal(validateDataIntakeCommit(employeePayload({ expected: { total: 3, creates: 1, updates: 1, unchanged: 0, errors: 0 } })).code, "COUNT_MISMATCH")],
  ["duplicate key", () => assert.equal(validateDataIntakeCommit(employeePayload({ rows: [{ rowNumber: 2, action: "create", values: { "社員番号": "SYN-001", "氏名": "A" } }, { rowNumber: 3, action: "update", values: { "社員番号": "SYN-001", "氏名": "B" } }] })).code, "DUPLICATE_KEY")],
  ["PIN forbidden", () => assert.equal(validateDataIntakeCommit(employeePayload({ rows: [{ rowNumber: 2, action: "create", values: { "社員番号": "SYN-001", "氏名": "A", pin: "0000" } }], expected: { total: 1, creates: 1, updates: 0, unchanged: 0, errors: 0 } })).code, "FORBIDDEN_FIELD")],
  ["LINE WORKS forbidden", () => assert.equal(validateDataIntakeCommit(employeePayload({ rows: [{ rowNumber: 2, action: "create", values: { "社員番号": "SYN-001", "氏名": "A", lineWorksRecipientId: "hidden" } }], expected: { total: 1, creates: 1, updates: 0, unchanged: 0, errors: 0 } })).code, "FORBIDDEN_FIELD")],
  ["unknown field blocked", () => assert.equal(validateDataIntakeCommit(employeePayload({ rows: [{ rowNumber: 2, action: "create", values: { "社員番号": "SYN-001", "氏名": "A", "自由欄": "x" } }], expected: { total: 1, creates: 1, updates: 0, unchanged: 0, errors: 0 } })).code, "UNKNOWN_FIELD")],
  ["no changes", () => assert.equal(validateDataIntakeCommit(employeePayload({ rows: [], expected: { total: 2, creates: 0, updates: 0, unchanged: 2, errors: 0 } })).code, "NO_CHANGES")],
  ["safe replay", () => assert.equal(classifyIdempotentAttempt({ target: "employees", clientRequestId: requestA, fileDigest: digestA, previewDigest: digestB }, { target: "employees", clientRequestId: requestA, fileDigest: digestA, previewDigest: digestB }), "SAFE_REPLAY_SAME_RESULT")],
  ["request id reuse blocked", () => assert.equal(classifyIdempotentAttempt({ target: "employees", clientRequestId: requestA, fileDigest: digestA, previewDigest: digestB }, { target: "employees", clientRequestId: requestA, fileDigest: digestB, previewDigest: digestB }), "REJECT_REQUEST_ID_REUSE")],
  ["duplicate file blocked", () => assert.equal(classifyIdempotentAttempt({ target: "employees", clientRequestId: requestA, fileDigest: digestA, previewDigest: digestB }, { target: "employees", clientRequestId: requestB, fileDigest: digestA, previewDigest: digestB }), "REJECT_DUPLICATE_FILE")],
  ["contract remains disabled", () => assert.deepEqual({ atomic: DATA_INTAKE_SAVE_CONTRACT.atomic, partialSave: DATA_INTAKE_SAVE_CONTRACT.partialSave, productionEnabled: DATA_INTAKE_SAVE_CONTRACT.productionEnabled }, { atomic: true, partialSave: false, productionEnabled: false })]
];

let passed = 0;
for (const [name, run] of fixtures) {
  try {
    run();
    passed += 1;
  } catch (error) {
    console.error(JSON.stringify({ ok: false, fixture: name, message: error.message }));
    process.exitCode = 1;
    break;
  }
}

if (!process.exitCode) {
  console.log(JSON.stringify({ ok: true, fixtureCount: passed, productionMutationExecuted: false, runtimeChanged: false }));
}
