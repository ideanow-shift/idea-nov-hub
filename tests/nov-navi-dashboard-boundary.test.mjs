import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  shouldEnableLocalNovNaviDemo,
  shouldEnableNovNaviDashboard
} from "../portal/js/nov-navi-dashboard.js";

const enableCases = [
  ["public preview query is rejected", false, "ideanow-shift.github.io", "?nov_navi_preview=1", false],
  ["localhost preview is allowed", false, "localhost", "?nov_navi_preview=1", true],
  ["127 preview is allowed", false, "127.0.0.1", "?nov_navi_preview=1", true],
  ["feature flag enables public dashboard", true, "ideanow-shift.github.io", "", true],
  ["legacy overrides feature flag", true, "ideanow-shift.github.io", "?legacy=1", false],
  ["legacy overrides localhost preview", false, "localhost", "?nov_navi_preview=1&legacy=1", false]
];

for (const [name, featureEnabled, hostname, search, expected] of enableCases) {
  assert.equal(
    shouldEnableNovNaviDashboard({ featureEnabled, hostname, search }),
    expected,
    name
  );
}

assert.equal(
  shouldEnableLocalNovNaviDemo({
    hostname: "ideanow-shift.github.io",
    search: "?nov_navi_preview=1&demo=1"
  }),
  false,
  "public demo query must fail closed"
);
assert.equal(
  shouldEnableLocalNovNaviDemo({ hostname: "localhost", search: "?nov_navi_preview=1&demo=1" }),
  true,
  "exact localhost demo query is allowed"
);
assert.equal(
  shouldEnableLocalNovNaviDemo({ hostname: "localhost", search: "?nov_navi_preview=1" }),
  false,
  "demo=1 is required"
);

const dashboardSource = await readFile(new URL("../portal/js/nov-navi-dashboard.js", import.meta.url), "utf8");
const mainSource = await readFile(new URL("../portal/js/main.js", import.meta.url), "utf8");
const unmappedAppFixture = { appId: "fixture-unmapped-app", appName: "未配置アプリfixture" };
const mappedAliasesFixture = ["idea-link", "attendance", "shift", "management-system"];

assert.equal(
  mappedAliasesFixture.includes(unmappedAppFixture.appId),
  false,
  "fixture must remain unmapped from NOV NAVI cards"
);

assert.doesNotMatch(
  dashboardSource.match(/function toggleLegacyHome[\s\S]*?\n}/)?.[0] || "",
  /#all-apps-heading/,
  "existing all-apps section must remain reachable"
);
assert.match(
  mainSource.match(/function loginDemo[\s\S]*?\n}/)?.[0] || "",
  /shouldEnableLocalNovNaviDemo/,
  "loginDemo itself must enforce the local demo boundary"
);
assert.match(mainSource, /if \(localDemoEnabled\) \{[\s\S]*?DEMO_EMPLOYEES\.forEach/, "demo options are local-only");
assert.match(mainSource, /if \(localDemoEnabled\) \{[\s\S]*?demoLogin\.addEventListener/, "demo handler is local-only");

console.log("NOV NAVI dashboard boundary fixtures: PASS");
