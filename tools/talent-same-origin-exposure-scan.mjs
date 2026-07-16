import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(process.cwd());
const files = [
  "portal/talent/exact1.mjs",
  "portal/talent/app.mjs",
  "portal/talent/index.html",
  "portal/talent/runtime-config.candidate.js",
  "portal/talent/style.css",
  "tests/talent-same-origin-route.test.mjs"
];

const forbidden = [
  /console\.(log|error|warn|info|debug)\s*\(/,
  /script\.google\.com/i,
  /localStorage/i,
  /postMessage/i,
  /\bopener\b/i,
  /clipboard/i,
  /service_role/i,
  /\bstudentId\b/,
  /\bemployeeId\b/,
  /rawClaims?\s*[:=]\s*[^f]/,
  /rawResponse\s*[:=]\s*[^f]/
];

const findings = [];
for (const file of files) {
  const content = readFileSync(resolve(root, file), "utf8");
  forbidden.forEach((pattern) => {
    if (pattern.test(content)) findings.push(`${file} :: ${pattern}`);
  });
}

const apps = readFileSync(resolve(root, "portal/js/apps.js"), "utf8");
const talentEntry = apps.match(/appId: "human-capital-investment"[\s\S]*?priority: 64/)?.[0] || "";
if (!talentEntry.includes('url: "./talent/"')) findings.push("portal/js/apps.js :: talent url is not same-origin");
if (/hr-investment-dashboard|script\.google\.com|console\./i.test(talentEntry)) {
  findings.push("portal/js/apps.js :: talent entry contains forbidden legacy/exposure surface");
}

if (findings.length) {
  process.stderr.write(findings.join("\n"));
  process.exit(1);
}

process.stdout.write(JSON.stringify({
  scannedFiles: files.length,
  forbiddenExposureDetected: false,
  rawResponseLogged: false,
  tokenValueLogged: false,
  rawClaimsLogged: false,
  studentRowsLogged: false
}, null, 2));
