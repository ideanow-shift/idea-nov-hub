import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const source = fs.readFileSync(path.join(root, "portal", "master-admin", "master-admin.js"), "utf8");
const saveStart = source.indexOf("async function saveEmployeeLineWorksDestination");
const saveEnd = source.indexOf("\nfunction renderEmployeeProfileImagePanel", saveStart);
if (saveStart < 0 || saveEnd < 0) throw new Error("LINE WORKS save function boundary was not found");
const saveSource = source.slice(saveStart, saveEnd);

const checks = [
  ["write flag enabled in candidate", /EMPLOYEE_LINE_WORKS_DESTINATION_WRITE_ENABLED\s*=\s*true/],
  ["readonly users remain disabled", /const lineWorksReadonly = readonly \|\| !EMPLOYEE_LINE_WORKS_DESTINATION_WRITE_ENABLED/],
  ["save setup rejects readonly", /readonly \|\| !EMPLOYEE_LINE_WORKS_DESTINATION_WRITE_ENABLED\) return/],
  ["save handler has defensive feature guard", /if \(!EMPLOYEE_LINE_WORKS_DESTINATION_WRITE_ENABLED\)/],
  ["raw response exposure stops save", /JSON\.stringify\(response\)\.includes\(lineWorksRecipientId\)/],
  ["backend action is used", /callApiAction\("masterUpsertEmployeeLineWorksDestination"/],
  ["actor is not sent by client", !/actorEmployeeId\s*:/.test(saveSource)],
  ["no direct supabase browser write", !/\.from\(["']notification_destinations["']\)/.test(saveSource)],
  ["save starts disabled", /id="save-line-works-destination"[^>]*disabled/],
  ["pending review label removed when enabled", /EMPLOYEE_LINE_WORKS_DESTINATION_WRITE_ENABLED \? "保存" : "設計レビュー待ち"/],
];

const failures = checks.filter(([, expectation]) => expectation instanceof RegExp ? !expectation.test(source) : !expectation);
if (failures.length) {
  for (const [name] of failures) console.error(`FAIL: ${name}`);
  process.exit(1);
}

console.log(JSON.stringify({
  ok: true,
  fixtureCount: checks.length,
  mutationExecuted: false,
  rawRecipientIdPrinted: false,
}));
