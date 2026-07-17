import { readFile } from "node:fs/promises";

const files = [
  "portal/js/firebase-config.js",
  "portal/js/api.js",
  "portal/idea-link/index.html",
  "portal/idea-link-app/index.html",
  "portal/education-app/index.html",
  "portal/js/apps.js",
  "portal/js/main.js",
];

const forbidden = [
  "script.google.com",
  "google.script.run",
  "IDEA_LINK_GAS_URL",
  "GAS_API_URL",
  "gasApiUrl",
  "apiFallback",
  "getApiEndpoints",
  "shouldFallbackToNextEndpoint",
  "IDEA_LINK_LEGACY_DEPLOYMENT_ID",
  "AKfy",
];

const expected = [
  ["portal/js/firebase-config.js", 'apiMode: "edge"'],
  ["portal/js/firebase-config.js", "edgeApiUrl:"],
  [
    "portal/idea-link/index.html",
    'import { callApiAction } from "../js/api.js"',
  ],
  ["portal/idea-link/index.html", 'callApiAction("ideaLinkTimelineRead"'],
  ["portal/idea-link-app/index.html", 'callApiAction("ideaLinkPostCreate"'],
  ["portal/js/main.js", 'const IDEA_LINK_APP_URL = "./idea-link-app/'],
  ["portal/js/main.js", 'const EDUCATION_APP_URL = "./education-app/"'],
  ["portal/js/apps.js", 'url: "./education-app/"'],
  ["portal/education-app/index.html", "Education Hub / 教育・育成"],
];

const failures = [];

for (const file of files) {
  const text = await readFile(new URL(`../${file}`, import.meta.url), "utf8");
  for (const pattern of forbidden) {
    if (text.includes(pattern)) {
      failures.push(`${file}: contains forbidden pattern ${pattern}`);
    }
  }
}

for (const [file, pattern] of expected) {
  const text = await readFile(new URL(`../${file}`, import.meta.url), "utf8");
  if (!text.includes(pattern)) {
    failures.push(`${file}: missing expected pattern ${pattern}`);
  }
}

if (failures.length) {
  console.error(JSON.stringify({ ok: false, failures }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify(
  {
    ok: true,
    checkedFiles: files.length,
    forbiddenPatterns: forbidden.length,
    mode: "strict-gas-exit-source-candidate",
  },
  null,
  2,
));
