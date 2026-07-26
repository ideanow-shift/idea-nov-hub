import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  getVisibleNaviCategories,
  getVisibleNaviNotices,
  getNaviTodaySnapshot,
  getNaviCategoryId,
  getNaviCategoryAudienceHint,
  getNaviLaunchState,
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

assert.deepEqual(
  getVisibleNaviNotices([
    { title: "normal", unread: false },
    { title: "important", unread: false, type: "important" },
    { title: "unread", unread: true },
    { title: "second unread", unread: true }
  ]).map((notice) => notice.title),
  ["unread", "second unread", "important"],
  "NOV NAVI notices must prioritize unread and important items without changing their data"
);
assert.deepEqual(getVisibleNaviNotices("not-an-array"), [], "invalid notice sources must fail closed to an empty list");

assert.deepEqual(
  getNaviTodaySnapshot({ schedule: 1, tasks: 2, approvals: 0, thanks: 4, inquiries: 3, growthPoints: 8 }),
  [1, 2, 0, 4, 3, 8],
  "Today snapshot must accept only the six bounded aggregate values"
);
assert.deepEqual(
  getNaviTodaySnapshot({ schedule: -1, tasks: "2", approvals: 1_000_001, unexpected: 9 }),
  [null, null, null, null, null, null],
  "Today snapshot must fail closed for invalid or unrecognized values"
);
assert.equal(getNaviCategoryAudienceHint("経営管理"), "店長以上・許可範囲", "management category must communicate its display boundary");
assert.equal(getNaviCategoryAudienceHint("システム管理"), "システム管理者のみ", "system administration must remain explicitly restricted");
assert.equal(getNaviCategoryAudienceHint("unknown"), "", "unknown categories must not invent an audience boundary");
assert.equal(getNaviCategoryId("unknown"), "", "unknown categories must not receive a navigation target");
assert.equal(getNaviCategoryId(getVisibleNaviCategories({ roleLevel: 1, roleKeys: [] })[0]), "navi-category-1", "visible category targets must use stable IDs");
assert.deepEqual(
  getNaviLaunchState({ status: "trial" }, null),
  { status: "coming_soon", actionLabel: "接続準備中", enabled: false },
  "unmapped systems must remain visibly unavailable regardless of their planned release state"
);
assert.deepEqual(
  getNaviLaunchState({ status: "available" }, { url: "./task/" }),
  { status: "available", actionLabel: "システムを開く", enabled: true },
  "connected systems must keep the existing launcher path"
);
assert.deepEqual(
  getNaviLaunchState({ status: "available" }, { url: "#demo-preview" }),
  { status: "preview", actionLabel: "サンプルを見る", enabled: true },
  "sample systems must remain explicitly labeled"
);

assert.equal(getNaviGreeting(8), "おはようございます。今日の仕事を確認しましょう。", "morning greeting");
assert.equal(getNaviGreeting(13), "おつかれさまです。今日の進み具合を確認しましょう。", "afternoon greeting");
assert.equal(getNaviGreeting(20), "おつかれさまです。明日の準備を確認しましょう。", "evening greeting");

assert.deepEqual(
  getVisibleNaviCategories({ roleLevel: 1, roleKeys: [] }),
  ["運営管理", "成長", "キャリア"],
  "employee sees the daily work areas only"
);
assert.deepEqual(
  getVisibleNaviCategories({ roleLevel: 3, roleKeys: [] }),
  ["運営管理", "成長", "キャリア", "経営管理"],
  "store manager sees management operations without system administration"
);
assert.deepEqual(
  getVisibleNaviCategories({ roleLevel: 1, roleKeys: ["super_admin"] }),
  ["運営管理", "成長", "キャリア", "経営管理", "システム管理"],
  "system administrator sees all NOV NAVI categories"
);

const dashboardSource = await readFile(new URL("../portal/js/nov-navi-dashboard.js", import.meta.url), "utf8");
const mainSource = await readFile(new URL("../portal/js/main.js", import.meta.url), "utf8");
const designSystemSource = await readFile(new URL("../portal/css/design-system.css", import.meta.url), "utf8");
const naviStylesSource = await readFile(new URL("../portal/css/nov-navi-dashboard.css", import.meta.url), "utf8");
const portalIndexSource = await readFile(new URL("../portal/index.html", import.meta.url), "utf8");
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
assert.match(dashboardSource, /class="navi-legacy-launcher"/, "NOVA must provide a deliberate path to the preserved legacy app list");
assert.match(dashboardSource, /document\.querySelector\("\.legacy-apps-disclosure"\)/, "legacy app navigation must reuse the existing disclosure");
assert.match(dashboardSource, /"\.legacy-apps-section"/, "NOVA must hide the legacy app list until the user explicitly opens it");
assert.match(dashboardSource, /function revealLegacyApps\(\)/, "legacy app navigation must reveal the preserved app list only on demand");
assert.match(dashboardSource, /disclosure\.open = true/, "legacy app navigation must explicitly open the existing disclosure");
assert.match(naviStylesSource, /\.navi-legacy-launcher \{[^}]*min-height: 40px/, "legacy app navigation must meet the mobile touch target");
assert.match(
  mainSource.match(/function loginDemo[\s\S]*?\n}/)?.[0] || "",
  /shouldEnableLocalNovNaviDemo/,
  "loginDemo itself must enforce the local demo boundary"
);
assert.match(mainSource, /if \(localDemoEnabled\) \{[\s\S]*?DEMO_EMPLOYEES\.forEach/, "demo options are local-only");
assert.match(mainSource, /if \(localDemoEnabled\) \{[\s\S]*?demoLogin\.addEventListener/, "demo handler is local-only");
assert.match(dashboardSource, /function getVisibleNaviNotices\(notices\)/, "NOVA notices must use the shared visibility helper");
assert.match(dashboardSource, /\.slice\(0, 3\)/, "NOVA notices must be capped at three");
assert.match(dashboardSource, /notice\.unread/, "NOVA notices must prioritize unread items");
assert.match(mainSource, /state\.notifications = Array\.isArray\(data\.notifications\)[\s\S]*?renderPortal\(\)/, "notification refresh must also refresh the NOV NAVI view");
assert.match(mainSource, /state\.announcements = Array\.isArray\(data\.announcements\)[\s\S]*?renderPortal\(\)/, "announcement refresh must also refresh the NOV NAVI view");
assert.match(dashboardSource, /function getNaviCategoryAudienceHint\(category\)/, "NOVA category audience labels must be centralized");
assert.match(dashboardSource, /data-navi-category-target/, "NOVA role categories must provide local navigation controls");
assert.match(dashboardSource, /section\.dataset\.naviCardCount = String\(systems\.length\)/, "NOVA categories must expose only their local card count for responsive layout");
assert.match(dashboardSource, /target\.scrollIntoView/, "NOVA category controls must use in-page navigation only");
assert.match(naviStylesSource, /\.navi-role-categories button \{[^}]*min-height: 40px/, "NOVA category controls must meet the mobile touch target");
assert.match(naviStylesSource, /\.navi-category\[data-navi-card-count="1"\] \.navi-system-grid/, "single-card categories must use the available mobile width");
assert.match(dashboardSource, /function getNaviLaunchState\(system, app\)/, "NOVA launch labels must be centralized");
assert.match(dashboardSource, /button\.disabled = !launchState\.enabled/, "unconnected systems must render as disabled controls");
assert.match(dashboardSource, /decision_hub: "\.\/assets\/icons\/approval\.svg"/, "approval cards must use their dedicated NOV NAVI SVG");
assert.match(dashboardSource, /pos: "\.\/assets\/icons\/store-operations\.svg"/, "store operation cards must use their dedicated NOV NAVI SVG");
assert.match(dashboardSource, /title: "キャリアシステム", status: "preview", icon: "\.\/assets\/icons\/career\.svg"/, "career cards must remain identifiable before a launch target is connected");
assert.match(dashboardSource, /const TODAY_KEYS = \["schedule", "tasks", "approvals", "thanks", "inquiries", "growthPoints"\]/, "Today card keys must remain allowlisted");
assert.match(dashboardSource, /Number\.isSafeInteger\(value\)/, "Today card values must remain bounded aggregates");
assert.match(dashboardSource, /data-navi-today-key="schedule"/, "Today cards must bind their values by an explicit key");
assert.match(dashboardSource, /\[data-navi-today-key="\$\{key\}"\]/, "Today card rendering must not rely on card position");
assert.match(dashboardSource, /card\.dataset\.naviTodayState = "ready"/, "Today cards must distinguish verified data from pending state");
assert.match(dashboardSource, /card\.setAttribute\("aria-busy", "false"\)/, "Today cards must clear busy state after a verified value arrives");
assert.match(dashboardSource, /\.navi-today-grid"\)\?\.setAttribute\("aria-live", "polite"\)/, "Today updates must be announced without exposing raw data");
assert.match(naviStylesSource, /\.navi-today-card\[data-navi-today-state="ready"\]/, "Today ready state must have a distinct visual treatment");
assert.match(dashboardSource, /onOpenNotice\(notice\)/, "NOVA notices must use the existing HUB handler");
assert.doesNotMatch(dashboardSource, /localStorage|sessionStorage|handoff_code|sessionToken/, "NOVA dashboard must not store or transport auth material");
assert.match(dashboardSource, /await onOpenApp\(app\)/, "NOVA cards must await the existing app launcher");
assert.match(dashboardSource, /button\.disabled = true/, "NOVA cards must prevent duplicate launch clicks");
assert.match(dashboardSource, /button\.disabled = false/, "NOVA cards must recover after the existing launcher returns");
assert.match(portalIndexSource, /<button class="navi-notification-hint"[^>]*type="button"/, "header notification hint must be a button");
assert.match(mainSource, /function focusNaviNotices\(\)/, "header notification hint must have a NOV NAVI notice handler");
assert.match(mainSource, /naviNotificationHint\.addEventListener\("click", focusNaviNotices\)/, "header notification hint must use its safe local handler");
assert.match(mainSource, /setAttribute\("aria-label", `未読通知 \$\{count\}件を確認`\)/, "notification hint must announce unread count without exposing notice data");
assert.match(naviStylesSource, /\.navi-notification-hint \{[^}]*min-height: 40px/, "header notification button must meet the minimum touch target");
assert.match(naviStylesSource, /\.site-header \{[^}]*background: #fff/, "NOV NAVI sticky header must remain opaque while content scrolls beneath it");
assert.match(naviStylesSource, /\.welcome \{ display: none; \}/, "NOV NAVI must hide legacy welcome and internal context copy");
assert.match(designSystemSource, /--control-min-height:\s*44px/, "shared design system must preserve 44px controls");
assert.match(designSystemSource, /--shadow-card:/, "shared design system must provide a card shadow token");
assert.match(designSystemSource, /--focus-ring:/, "shared design system must provide a focus token");
assert.match(naviStylesSource, /\.navi-open-button:disabled \{[^}]*cursor: not-allowed/, "disabled NOVA launch controls must not imply a runnable app");

console.log("NOV NAVI dashboard boundary fixtures: PASS");
