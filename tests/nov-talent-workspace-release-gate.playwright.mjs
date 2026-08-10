import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const packageDir = process.env.PLAYWRIGHT_PACKAGE_DIR;
assert.ok(packageDir, "PLAYWRIGHT_PACKAGE_DIR is required");
const { chromium } = await import(pathToFileURL(join(packageDir, "index.mjs")).href);
const portalRoot = fileURLToPath(new URL("../portal/", import.meta.url));
const productionHtml = await readFile(resolve(portalRoot, "talent/index.html"), "utf8");
const fixtureHtml = productionHtml.replace(
  /<script\s+type=["']module["']\s+src=["']\.\/app\.mjs(?:\?[^"']*)?["']><\/script>/gu,
  '<script type="module" src="/__fixture__/talent-bootstrap.mjs"></script>'
);

const hubHtml = `<!doctype html><html lang="ja"><body>
  <button id="login">ログイン</button>
  <a id="talent" href="/talent/index.html" hidden>求人管理</a>
  <script type="module">
    import { setNovHubSession } from "/js/nov-hub-session-candidate.js";
    import { saveHubEmployeeContext } from "/js/hub-context.js";
    document.getElementById("login").addEventListener("click", () => {
      setNovHubSession({ sessionToken: "fixture-session-token-not-real", audience: "nov_hub", expiresAt: new Date(Date.now() + 60000).toISOString() });
      saveHubEmployeeContext({ id: "10000000-0000-4000-8000-000000009999", name: "Fixture HR", roleKeys: ["hr.admin"] }, "hub_session");
      document.getElementById("talent").hidden = false;
    });
  </script>
</body></html>`;

const talentBootstrap = String.raw`
const uuid = (index) => "10000000-0000-4000-8000-" + String(index).padStart(12, "0");
const eventFact = (index, offset, code) => ({
  active: true, assignedTo: null, code, content: null, date: "2026-08-01",
  id: uuid(5000 + (index * 3) + offset), label: code, notes: null, state: null, version: 1
});
const students = Array.from({ length: 636 }, (_, index) => ({
  applicationNo: null, businessDate: null, classification: "IMPORTABLE", classificationLabel: "有効",
  displayName: "表示用学生" + (index + 1), email: null, faculty: null,
  graduationYear: index < 528 ? 2027 : 2028, kana: null, lineIdentifier: null, lineRegistrationDate: null,
  legacyNoPresent: true, mappingStatus: "OWNER_CONFIRMED", nextActionAt: null, nextActionLabel: null,
  offerDate: null, expectedJoinDate: null, plannedStore: null, phone: null, acquisitionSource: null,
  assignee: null, notes: null, preferredStore: null, primaryEligible: true, profileVersion: 1,
  supplementVersion: null, reasonLabels: [], recordId: uuid(index + 1), schoolId: null, fairId: null,
  school: "表示用学校" + ((index % 20) + 1), sourceCode: index < 528 ? "CONTACTS_27" : "CONTACTS_28",
  sourceLabel: index < 528 ? "27卒" : "28卒", sourceKeyStatus: "OWNER_CONFIRMED", status: "LINE登録",
  statusCode: "LINE_REGISTERED", suggestedTargetRecordId: null, suggestionCategory: "NONE",
  contactHistory: [
    ...(index < 34 ? [eventFact(index, 0, "CONTACT_RECORDED")] : []),
    ...(index < 615 ? [eventFact(index, 1, "LINE_REGISTERED")] : [])
  ],
  eventHistory: index < 23 ? [eventFact(index, 2, "SALON_TOUR_COMPLETED")] : [],
  nextActions: [], selectionHistory: []
}));
const fairMasters = Array.from({ length: 46 }, (_, index) => ({
  assigned_to: null, contact_count: index === 0 ? null : index, created_at: "2026-08-06T00:00:00.000Z",
  event_date: "2026-08-06", event_format: null, expected_contacts: null, fair_id: uuid(2000 + index),
  fair_name: "表示用フェア" + (index + 1), hire_count: null, interview_count: null, is_active: true,
  line_registration_count: null, note: null, offer_count: null, organizer_name: null,
  participant_count: null, participating_salons: null, participation_fee: index === 0 ? null : 0,
  salon_tour_count: null, total_attendance: null, venue: null, version: 1
}));
const availability = Object.fromEntries(["candidateCount","entries","eventCount","fairCount","graduation2027","graduation2028","interviewHistory","interviewPlanned","lineRegistrations","offeredElsewhere","offers","rejected","salonTourCompleted","salonTourPlanned","schoolCount","todayActions","withdrawals"].map((key) => [key, true]));
const partial = new URL(location.href).searchParams.get("partial") === "1";
const coveragePartial = new URL(location.href).searchParams.get("coveragePartial") === "1";
if (partial) availability.schoolCount = false;
const selectionCodes = ["APPLICATION_RECEIVED","INTERVIEW_PLANNED","INTERVIEW_COMPLETED","OFFERED","OFFER_ACCEPTED","WITHDRAWN","REJECTED"];
const coverage = {
  selection_coverage_contract_version: "1.0.0",
  sourceCoverageState: coveragePartial ? "PREPARING" : "READY",
  officialSelectionRows: coveragePartial ? null : 0,
  officialUniqueCandidates: coveragePartial ? null : 0,
  unlinkedEvidenceTotal: coveragePartial ? null : 126,
  datedUnlinkedEvidence: coveragePartial ? null : 42,
  undatedUnlinkedEvidence: coveragePartial ? null : 84,
  unlinkedUniqueCandidates: null,
  metrics: selectionCodes.map((code, index) => ({
    code,
    officialRows: coveragePartial ? null : 0,
    officialUniqueCandidates: coveragePartial ? null : 0,
    unlinkedEvidenceTotal: coveragePartial ? null : (index < 2 ? 63 : 0),
    datedUnlinkedEvidence: coveragePartial ? null : (index === 0 ? 21 : index === 1 ? 21 : 0),
    undatedUnlinkedEvidence: coveragePartial ? null : (index === 0 ? 42 : index === 1 ? 42 : 0)
  }))
};
const workspace = {
  workspace_contract_version: "1.0.0", accessProfile: "full", canWrite: true, fiscalYear: "all", payloadMode: "workspace",
  overview: { contacts: 34, entries: 0, exactLinkSuggestions: 0, mapped: 636, manual: 0, offers: 0, ownerReview: 0, primaryCandidates: 636, quarantined: 0, remainingManual: 0, total: 636 },
  dashboard: { availability, candidateCount: 636, entries: 0, eventCount: 672, fairCount: 46, graduation2027: 528, graduation2028: 108, interviewHistory: 0, interviewPlanned: 0, lineRegistrations: 615, offeredElsewhere: 0, offers: 0, rejected: 0, salonTourCompleted: 23, salonTourPlanned: 0, schoolCount: 20, selectionHistoryCount: 0, todayActions: 0, undatedActions: 0, unlinkedInterviewHistoryCount: 0, withdrawals: 0 },
  summary: { contacts: 34, expectedJoiners: 0, interviews: 0, lineRegistrations: 615, offers: 0, passed: 0, salonTours: 23 },
  partialStatus: { retryCount: partial ? 1 : 0, state: partial ? "partial" : "complete", unavailableViews: partial ? ["school_masters"] : [] },
  fairMasters, schoolMasters: [], students, todayTasks: [], unlinkedSelectionHistory: []
};
window.__workspaceRequests = 0;
window.__selectionCoverageRequests = 0;
window.__dailyWorkflowRequests = 0;
window.__dashboardSummaryRequests = 0;
const originalFetch = window.fetch.bind(window);
window.fetch = async (input, init = {}) => {
  const url = String(input);
  if (url.includes("/api/talent/v1/workspace")) {
    window.__workspaceRequests += 1;
    return Response.json({ ok: true, data: workspace, meta: { generatedAt: "2026-08-06T00:00:00.000Z", requestId: "browser-gate", source: "fixture", version: "3" } });
  }
  if (url.includes("/api/talent/v1/selection-coverage")) {
    window.__selectionCoverageRequests += 1;
    return Response.json({ ok: true, data: coverage, meta: { generatedAt: "2026-08-06T00:00:00.000Z", requestId: "coverage-gate", source: "fixture", version: "1" } });
  }
  if (url.includes("/api/talent/v1/daily-workflow")) {
    window.__dailyWorkflowRequests += 1;
    return Response.json({ ok: true, data: { daily_workflow_contract_version: "1.1.0", sourceCoverageState: "COMPLETE", generatedAt: "2026-08-06T00:00:00.000Z", communications: [], nextActions: [], assignees: [] } });
  }
  if (url.includes("/api/talent/v1/dashboard/summary")) {
    window.__dashboardSummaryRequests += 1;
    throw new Error("duplicate dashboard summary request");
  }
  return originalFetch(input, init);
};
await import("/talent/app.mjs?v=20260809-outcome2-daily-workflow-2");
`;

const server = createServer(async (request, response) => {
  try {
    const requestUrl = decodeURIComponent((request.url || "/").split("?")[0]);
    if (requestUrl === "/favicon.ico") return void response.writeHead(204).end();
    if (requestUrl === "/__fixture__/hub.html") return void response.writeHead(200, { "content-type": "text/html; charset=utf-8" }).end(hubHtml);
    if (requestUrl === "/__fixture__/talent-bootstrap.mjs") return void response.writeHead(200, { "content-type": "text/javascript; charset=utf-8" }).end(talentBootstrap);
    const requestPath = requestUrl.replace(/^\/+/, "") || "talent/index.html";
    const filePath = resolve(portalRoot, requestPath);
    const scoped = relative(portalRoot, filePath);
    if (scoped.startsWith("..") || isAbsolute(scoped)) return void response.writeHead(404).end();
    const body = requestUrl === "/talent/index.html" ? fixtureHtml : await readFile(filePath);
    const contentType = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml" }[extname(filePath)] || "application/octet-stream";
    response.writeHead(200, { "content-type": contentType }).end(body);
  } catch {
    response.writeHead(404).end();
  }
});

await new Promise((resolveListen) => server.listen(0, "127.0.0.1", resolveListen));
const origin = `http://127.0.0.1:${server.address().port}`;
const browserChannel = String(process.env.NOV_TALENT_BROWSER_CHANNEL || "").trim() || undefined;
const browser = await chromium.launch({ ...(browserChannel ? { channel: browserChannel } : {}), headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const consoleErrors = [];
  const consoleWarnings = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
    if (message.type() === "warning") consoleWarnings.push(message.text());
  });
  page.on("pageerror", (error) => consoleErrors.push(error.message));
  await page.goto(`${origin}/__fixture__/hub.html`);
  await page.getByRole("button", { name: "ログイン" }).click();
  await page.getByRole("link", { name: "求人管理" }).click();
  await page.getByText("636件を集計").waitFor().catch(async () => {
    throw new Error(JSON.stringify({ consoleErrors, body: (await page.locator("body").innerText()).slice(0, 500) }));
  });
  await page.getByRole("tab", { name: "管理・診断" }).click();
  await page.locator("#selection-coverage-status").filter({ hasText: "確認待ちの元データ 126件" }).waitFor();
  assert.deepEqual(await page.evaluate(() => ({ workspace: window.__workspaceRequests, coverage: window.__selectionCoverageRequests, summary: window.__dashboardSummaryRequests })), { workspace: 1, coverage: 1, summary: 0 });
  assert.equal(await page.locator("#selection-coverage-status").innerText(), "確認待ちの元データ 126件（日付確認可能 42件 / 日付未登録 84件）");
  assert.equal(await page.locator("#selection-coverage-grid").innerText().then((text) => text.includes("正式登録 0件")), true);
  await page.getByRole("tab", { name: "学生" }).click();
  assert.equal(await page.locator("#student-contacts").innerText(), "34");
  assert.equal(await page.locator("#student-total").innerText(), "636");
  assert.equal(await page.locator(".student-list-item").count(), 636);
  await page.getByRole("button", { name: "27卒" }).click();
  assert.equal(await page.locator(".student-list-item").count(), 528);
  await page.getByRole("button", { name: "28卒" }).click();
  assert.equal(await page.locator(".student-list-item").count(), 108);
  await page.getByRole("button", { name: "すべて" }).click();
  await page.getByRole("tab", { name: "就職フェア" }).click();
  assert.equal(await page.locator("#fair-master-body tr").count(), 46);
  assert.equal(await page.locator("#fair-flow-body tr").count(), 46);
  assert.deepEqual(consoleErrors, []);
  assert.deepEqual(consoleWarnings, []);
  await page.close();

  const partialPage = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await partialPage.goto(`${origin}/__fixture__/hub.html`);
  await partialPage.getByRole("button", { name: "ログイン" }).click();
  await partialPage.evaluate(() => { document.getElementById("talent").href = "/talent/index.html?partial=1&coveragePartial=1"; });
  await partialPage.getByRole("link", { name: "求人管理" }).click();
  await partialPage.getByText("636件を集計").waitFor();
  await partialPage.getByRole("tab", { name: "管理・診断" }).click();
  await partialPage.locator("#selection-coverage-status").filter({ hasText: "集計準備中" }).waitFor();
  assert.ok(await partialPage.getByText("集計準備中", { exact: true }).count() > 0);
  assert.equal(await partialPage.locator("#selection-coverage-status").innerText(), "集計準備中");
  assert.equal(await partialPage.locator(".student-list-item").count(), 636);
  await partialPage.close();

  const mobilePage = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const mobileConsoleErrors = [];
  const mobileConsoleWarnings = [];
  mobilePage.on("console", (message) => {
    if (message.type() === "error") mobileConsoleErrors.push(message.text());
    if (message.type() === "warning") mobileConsoleWarnings.push(message.text());
  });
  mobilePage.on("pageerror", (error) => mobileConsoleErrors.push(error.message));
  await mobilePage.goto(`${origin}/__fixture__/hub.html`);
  await mobilePage.getByRole("button", { name: "ログイン" }).click();
  await mobilePage.getByRole("link", { name: "求人管理" }).click();
  await mobilePage.getByText("636件を集計").waitFor();
  await mobilePage.getByRole("tab", { name: "管理・診断" }).click();
  await mobilePage.locator("#selection-coverage-status").filter({ hasText: "確認待ちの元データ 126件" }).waitFor();
  assert.equal(await mobilePage.locator(".student-list-item").count(), 636);
  assert.equal(await mobilePage.locator("#selection-coverage-status").innerText(), "確認待ちの元データ 126件（日付確認可能 42件 / 日付未登録 84件）");
  assert.equal(await mobilePage.locator("#selection-coverage-grid article").count(), 6);
  assert.equal(await mobilePage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), true);
  assert.deepEqual(mobileConsoleErrors, []);
  assert.deepEqual(mobileConsoleWarnings, []);
  await mobilePage.close();
} finally {
  await browser.close();
  await new Promise((resolveClose) => server.close(resolveClose));
}

console.log("nov_talent_workspace_release_gate: PASS");
