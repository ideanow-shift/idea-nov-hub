import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  getNaviGreeting,
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

assert.equal(getNaviGreeting(8), "おはようございます。今日の仕事を確認しましょう。", "morning greeting");
assert.equal(getNaviGreeting(13), "おつかれさまです。今日の進み具合を確認しましょう。", "afternoon greeting");
assert.equal(getNaviGreeting(20), "おつかれさまです。明日の準備を確認しましょう。", "evening greeting");

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
assert.match(dashboardSource, /visibleNotices = Array\.isArray\(notices\) \? notices\.slice\(0, 3\)/, "NOVA notices must be capped at three");
assert.match(dashboardSource, /onOpenNotice\(notice\)/, "NOVA notices must use the existing HUB handler");
assert.doesNotMatch(dashboardSource, /localStorage|sessionStorage|handoff_code|sessionToken/, "NOVA dashboard must not store or transport auth material");

console.log("NOV NAVI dashboard boundary fixtures: PASS");
