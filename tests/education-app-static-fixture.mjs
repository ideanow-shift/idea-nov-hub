import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), "utf8");
const index = read("../portal/education-app/index.html");
const app = read("../portal/education-app/app.js");
const css = read("../portal/education-app/styles.css");
const apps = read("../portal/js/apps.js");
const main = read("../portal/js/main.js");
const runtime = `${index}\n${app}\n${css}\n${apps}\n${main}`;

const checks = [
  ["three role panels", ["staff", "store", "admin"].every((view) => index.includes(`data-panel="${view}"`))],
  ["three role tabs", ["staff", "store", "admin"].every((view) => index.includes(`data-view="${view}"`))],
  ["write controls disabled", (index.match(/disabled/g) || []).length === 6],
  ["GAS runtime absent", !/script\.google\.com|google\.script\.run/i.test(runtime)],
  ["network code absent", !/\bfetch\s*\(|XMLHttpRequest|supabase/i.test(index + app)],
  ["storage absent", !/localStorage|sessionStorage|indexedDB/i.test(index + app)],
  ["credential terms absent", !/service_role|authorization|bearer|api[_-]?key|secret/i.test(index + app)],
  ["Education local route", apps.includes('url: "./education-app/"') && main.includes('const EDUCATION_APP_URL = "./education-app/"')],
  ["IDEA LINK deployment classifier removed", !main.includes("IDEA_LINK_LEGACY_DEPLOYMENT_ID")],
  ["IDEA LINK semantic route retained", main.includes('appId === "idea-link"') && main.includes("IDEA_LINK_APP_URL")],
  ["responsive layout", css.includes("@media (max-width:720px)")],
  ["content identity present", index.includes("./app.js?v=f7fc67dd7158")]
];

for (const [label, passed] of checks) assert.equal(passed, true, label);
console.log(`education-app-static-fixture: ${checks.length}/${checks.length} PASS`);
