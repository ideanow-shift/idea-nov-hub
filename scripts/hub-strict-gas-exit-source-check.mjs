import { readFile } from "node:fs/promises";

const files = [
  "portal/js/firebase-config.js",
  "portal/js/api.js",
  "portal/idea-link/index.html",
  "portal/js/main.js",
];

const forbidden = [
  "script.google.com",
  "google.script.run",
  "IDEA_LINK_GAS_URL",
];

const expected = [
  ["portal/js/firebase-config.js", 'apiMode: "edge"'],
  ["portal/js/firebase-config.js", 'apiFallback: "edge-only"'],
  ["portal/js/firebase-config.js", 'gasApiUrl: ""'],
  ["portal/idea-link/index.html", "IDEA_LINK_WEB_APP_ENABLED = false"],
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

console.log(JSON.stringify({
  ok: true,
  checkedFiles: files.length,
  forbiddenPatterns: forbidden.length,
  mode: "strict-gas-exit-source-candidate",
}, null, 2));
