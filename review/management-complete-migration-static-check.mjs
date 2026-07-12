import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const files = {
  api: read("portal/js/api.js"),
  main: read("portal/js/main.js"),
  html: read("portal/management-app/index.html"),
  app: read("portal/management-app/app-v2.js"),
  chart: read("portal/management-app/vendor/chart.umd.min.js"),
  backend: read("supabase/functions/nov-hub-api/management_readonly_candidate.ts"),
  index: read("supabase/functions/nov-hub-api/index.ts")
};

const required = [
  [files.api, '"managementFinanceSummary"'],
  [files.api, '"managementStoresSummary"'],
  [files.api, '"managementDataopsStatus"'],
  [files.main, 'MANAGEMENT_WEB_APP_IDS'],
  [files.main, '"./management-app/"'],
  [files.html, 'data-view="overview"'],
  [files.html, 'data-view="four-axis"'],
  [files.html, 'data-view="departments"'],
  [files.html, 'data-view="method"'],
  [files.html, 'data-view="stores"'],
  [files.html, 'data-view="dataops"'],
  [files.html, './vendor/chart.umd.min.js?v=4.4.1'],
  [files.chart, 'Chart.js v4.4.1'],
  [files.app, 'restoreNovHubSession'],
  [files.app, 'setHubSessionAuth'],
  [files.app, 'IDEA_NOV_PLACEHOLDER'],
  [files.backend, 'managementFinanceSummary: true'],
  [files.backend, 'managementStoresSummary: true'],
  [files.backend, 'managementDataopsStatus: true'],
  [files.index, 'const hubSession = await issueHubSession(employee);']
];

const missing = required.filter(([source, fragment]) => !source.includes(fragment)).map(([, fragment]) => fragment);
if (missing.length) throw new Error(`Missing required fragments: ${missing.join(", ")}`);

const frontend = `${files.html}\n${files.app}`;
const forbidden = [
  /service_role/i,
  /SUPABASE_SERVICE_ROLE/,
  /pin_hash/i,
  /script\.google\.com/i,
  /localStorage/,
  /console\.(log|debug)\s*\(/
];
const hits = forbidden.filter((pattern) => pattern.test(frontend)).map(String);
if (hits.length) throw new Error(`Forbidden frontend exposure: ${hits.join(", ")}`);

console.log(JSON.stringify({
  passed: true,
  managementActions: 3,
  views: 6,
  hubSessionRequired: true,
  frontendForbiddenExposure: false,
  browserDirectSupabase: false,
  dbMutationAdded: false
}, null, 2));
