import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { buildBudgetDraft, buildTargetDraft, createRecruitingPlanningAdminClient, planningAdminWriteEnabled } from "../portal/talent/recruiting-planning-admin.mjs";

const API = "https://staging.example.invalid/functions/v1/nov-talent-staging-api";
const TOKEN = "s".repeat(40);
const ID = "10000000-0000-4000-8000-000000000001";
function config() { return { NOV_TALENT_CONFIG: { runtimeMode: "staging", networkEnabled: true, writeEnabled: true, readonlyApiBaseUrl: API, writeApiBaseUrl: API, features: {} } }; }
function capability(canWritePlanning) { return { ok: true, data: { recruiting_planning_capability_contract_version: "1.1.0", canWritePlanning } }; }
function envelope(kind, targets = [], budgets = [], budgetLines = []) { return { ok: true, data: { recruiting_planning_contract_version: "1.1.0", kind, targets, budgets, budgetLines, sourceAvailability: true, actualSources: { CONTACT_COUNT: "ACTUAL_SOURCE_UNAVAILABLE", SALON_VISIT_COUNT: "ACTUAL_SOURCE_UNAVAILABLE", APPLICATION_COUNT: "SELECTION_HISTORY:APPLICATION_RECEIVED", OFFERED_COUNT: "SELECTION_HISTORY:OFFERED", OFFER_ACCEPTED_COUNT: "SELECTION_HISTORY:OFFER_ACCEPTED", EXPECTED_JOIN_COUNT: "NOT_OPERATIONAL" } } }; }
function targetRow() { return { targetId: ID, recruitingTrack: "NEW_GRAD", graduationYear: 2028, targetMetric: "APPLICATION_COUNT", period: { code: "GRAD_2028", start: "2027-04-01", end: "2028-03-31" }, scope: "COMPANY", targetCount: 45, version: 1, rowVersion: 1, state: "DRAFT", effectivePeriod: { from: "2026-08-11", to: "2028-03-31" }, reason: "Owner review", approvedAt: null }; }

test("admin reads approved, drafts, and history through the existing HUB session only", async () => {
  const calls = [];
  const client = createRecruitingPlanningAdminClient({ globalObject: config(), hubSessionHelper: { async getSessionToken() { return TOKEN; } }, fetchImpl: async (url, init) => {
    calls.push({ url: String(url), method: init.method, auth: init.headers.Authorization });
    const kind = String(url).endsWith("/current") ? "APPROVED" : String(url).endsWith("/drafts") ? "DRAFT" : "HISTORY";
    return Response.json(envelope(kind));
  } });
  assert.equal((await client.current()).ok, true);
  assert.equal((await client.drafts()).ok, true);
  assert.equal((await client.history()).ok, true);
  assert.deepEqual(calls.map((call) => [call.method, call.url.slice(API.length)]), [["GET","/api/talent/v1/recruiting-planning/current"],["GET","/api/talent/v1/recruiting-planning/drafts"],["GET","/api/talent/v1/recruiting-planning/history"]]);
  assert.equal(JSON.stringify(calls).includes(TOKEN), true);
});

test("Planning validators accept only the exact 1.1.0 contract", async () => {
  const responseFor = (body) => async () => Response.json(body);
  const clientFor = (body) => createRecruitingPlanningAdminClient({
    globalObject: config(),
    hubSessionHelper: { async getSessionToken() { return TOKEN; } },
    fetchImpl: responseFor(body)
  });
  assert.equal((await clientFor(envelope("APPROVED")).current()).ok, true);
  for (const body of [
    { ok: true, data: { ...envelope("APPROVED").data, recruiting_planning_contract_version: "1.0.0" } },
    { ok: true, data: { ...envelope("APPROVED").data, recruiting_planning_contract_version: "2.0.0" } },
    { ok: true, data: { ...envelope("APPROVED").data, recruiting_planning_contract_version: undefined } },
    { ok: true, data: { recruiting_planning_contract_version: "1.1.0" } }
  ]) {
    const result = await clientFor(body).current();
    assert.equal(result.ok, false);
    assert.equal(result.category, "invalid_response");
  }
});

test("Planning writes default OFF and stop every mutation before fetch", async () => {
  let fetchCount = 0;
  const globalObject = config();
  const client = createRecruitingPlanningAdminClient({ globalObject, hubSessionHelper: { async getSessionToken() { return TOKEN; } }, fetchImpl: async () => { fetchCount += 1; throw new Error("must not fetch"); } });
  assert.equal(planningAdminWriteEnabled(false, globalObject), false);
  for (const result of [await client.createTargetDraft({}), await client.createBudgetDraft({}), await client.approveTarget(ID, 1), await client.approveBudget(ID, 1)]) {
    assert.equal(result.category, "writes_disabled"); assert.equal(result.requestCount, 0);
  }
  assert.equal(fetchCount, 0);
});

test("enabled frontend sends exact Target command without actor, role, UUID, or token fields", async () => {
  const calls = [];
  const payload = buildTargetDraft({ graduationYear: "2028", targetMetric: "APPLICATION_COUNT", targetCount: "45", periodStart: "2027-04-01", periodEnd: "2028-03-31", effectiveFrom: "2026-08-11", effectiveTo: "2028-03-31", reason: "Owner確認済み計画" }, "NEW_GRAD");
  const client = createRecruitingPlanningAdminClient({ globalObject: config(), hubSessionHelper: { async getSessionToken() { return TOKEN; } }, fetchImpl: async (url, init) => { calls.push({ url: String(url), body: init.body ? JSON.parse(init.body) : undefined }); return String(url).endsWith("/capability") ? Response.json(capability(true)) : Response.json(envelope("DRAFT", [targetRow()])); } });
  assert.equal((await client.capability()).data.canWritePlanning, true);
  assert.equal((await client.createTargetDraft(payload)).ok, true);
  assert.deepEqual(Object.keys(calls[1].body).sort(), ["effectiveFrom","effectiveTo","graduationYear","periodCode","periodEnd","periodStart","reason","recruitingTrack","targetCount","targetMetric"].sort());
  assert.equal(JSON.stringify(calls[1].body).match(/actor|role|token|employeeId/iu), null);
});

test("server capability, never a frontend role string, controls Planning mutations", async () => {
  let writes = 0;
  const globalObject = config();
  globalObject.NOV_TALENT_CONFIG.role = "super_admin";
  const client = createRecruitingPlanningAdminClient({ globalObject, hubSessionHelper: { async getSessionToken() { return TOKEN; } }, fetchImpl: async (url, init) => {
    if (String(url).endsWith("/capability")) return Response.json(capability(false));
    if (init.method === "POST") writes += 1;
    return Response.json(envelope("DRAFT", [targetRow()]));
  } });
  assert.equal((await client.capability()).data.canWritePlanning, false);
  assert.equal((await client.createTargetDraft({})).category, "writes_disabled");
  assert.equal(writes, 0);
  assert.equal(planningAdminWriteEnabled(true, globalObject), true);
  assert.equal(planningAdminWriteEnabled(false, globalObject), false);
});

test("new-grad and mid-career builders preserve track/date semantics and never map ambiguous hiring counts", () => {
  const target = buildTargetDraft({ graduationYear: "2028", targetMetric: "OFFER_ACCEPTED_COUNT", targetCount: "36", periodStart: "2027-04-01", periodEnd: "2028-03-31", effectiveFrom: "2026-08-11", effectiveTo: "2028-03-31", reason: "Ownerが内定承諾目標として確認" }, "NEW_GRAD");
  assert.equal(target.periodCode, "GRAD_2028"); assert.equal(target.targetMetric, "OFFER_ACCEPTED_COUNT");
  const budget = buildBudgetDraft({ graduationYear: "", periodStart: "2026-04-01", periodEnd: "2027-03-31", effectiveFrom: "2026-08-11", effectiveTo: "2027-03-31", totalBudget: "2400000", reason: "中途年間予算", lines: [{ channelCode: "OWNED_WEB", amount: "500000", reason: "HP" }, { channelCode: "PAID_JOB_MEDIA", amount: "1400000", reason: "求人媒体" }, { channelCode: "SNS", amount: "500000", reason: "SNS広告" }] }, "MID_CAREER");
  assert.equal(budget.graduationYear, null); assert.equal(budget.lines.reduce((sum, line) => sum + line.amount, 0), 2400000);
  assert.equal(buildTargetDraft({ graduationYear: "2028", targetMetric: "HIRING_COUNT", targetCount: "36", periodStart: "2027-04-01", periodEnd: "2028-03-31", effectiveFrom: "2026-08-11", effectiveTo: "2028-03-31", reason: "意味未確認" }, "NEW_GRAD"), null);
});

test("Budget permits an under-allocated Draft per server contract but rejects invalid lines", () => {
  const base = { graduationYear: "2028", periodStart: "2027-04-01", periodEnd: "2028-03-31", effectiveFrom: "2026-08-11", effectiveTo: "2028-03-31", totalBudget: "7385350", reason: "年間予算", lines: [{ channelCode: "JOB_FAIR", amount: "1000000", reason: "フェア" }] };
  assert.ok(buildBudgetDraft(base, "NEW_GRAD"));
  assert.equal(buildBudgetDraft({ ...base, lines: [{ channelCode: "UNKNOWN", amount: "1", reason: "不明" }] }, "NEW_GRAD"), null);
  assert.equal(buildBudgetDraft({ ...base, totalBudget: "100", lines: [{ channelCode: "JOB_FAIR", amount: "101", reason: "超過" }] }, "NEW_GRAD"), null);
});

test("Admin UI is isolated from the four normal routes and hides internal implementation vocabulary", () => {
  const html = fs.readFileSync(new URL("../portal/talent/index.html", import.meta.url), "utf8");
  const normalNav = html.match(/class="primary-navigation"[\s\S]*?<\/nav>/u)?.[0] || "";
  assert.doesNotMatch(normalNav, /採用計画|Planning|Budget/u);
  assert.match(html, /id="recruitment-management"[\s\S]*id="planning-admin-panel"/u);
  assert.match(html, /新卒[\s\S]*中途[\s\S]*接触目標[\s\S]*サロン見学目標[\s\S]*応募目標[\s\S]*内定目標[\s\S]*内定承諾目標/u);
  assert.doesNotMatch(html.match(/id="planning-admin-panel"[\s\S]*?id="planning-diagnostic-panel"/u)?.[0] || "", /RPC|UUID|Contract ID/u);
  const app = fs.readFileSync(new URL("../portal/talent/app.mjs", import.meta.url), "utf8");
  const module = fs.readFileSync(new URL("../portal/talent/recruiting-planning-admin.mjs", import.meta.url), "utf8");
  assert.match(app, /initializeRecruitingPlanningAdmin\(globalThis\.document, globalThis\)/u);
  assert.doesNotMatch(module, /\n\s*load\(\);\s*\n\s*return Object\.freeze\(\{ initialized/u);
});

test("PC and 390px Mobile contracts keep Planning responsive without horizontal tables", () => {
  const css = fs.readFileSync(new URL("../portal/talent/style.css", import.meta.url), "utf8");
  assert.match(css, /\.planning-editor-grid\s*\{[^}]*grid-template-columns:\s*repeat\(2/isu);
  assert.match(css, /@media \(max-width: 520px\)[\s\S]*\.planning-editor-grid\s*\{\s*grid-template-columns:\s*1fr/isu);
  assert.match(css, /\.planning-budget-line\s*\{[^}]*grid-template-columns:\s*1fr/isu);
});
