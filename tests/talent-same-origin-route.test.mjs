import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  initializeTalentSummaryControl,
  invalidateTalentDashboardSummaryRun,
  resetTalentDashboardSummaryStartupForFixture,
  startTalentDashboardSummary
} from "../portal/talent/app.mjs";
import {
  buildDashboardSummaryViewModel,
  createDashboardSummaryExact1Executor,
  readTalentRuntime
} from "../portal/talent/exact1.mjs";

function validEnvelope() {
  return {
    ok: true,
    data: {
      config: { appName: "NOV Talent" },
      fiscalYear: "current",
      payloadMode: "summary",
      summary: {
        contacts: 1,
        lineRegistrations: 2,
        salonTours: 3,
        interviews: 4,
        passed: 5,
        offers: 6,
        expectedJoiners: 7
      }
    },
    meta: {
      generatedAt: "2026-07-17T00:00:00.000Z",
      requestId: "fixture-request",
      source: "fixture",
      version: "1"
    }
  };
}

function defaultHelper(token) {
  const tokenValue = token === undefined ? "fixture-session-token-value-not-real" : token;
  return {
    async getSessionToken() {
      return tokenValue;
    }
  };
}

function fakeGlobal({ enabled = true, helper = defaultHelper(), audience = "nov_hub" } = {}) {
  return {
    NOV_TALENT_CONFIG: {
      readonlyApiEnabled: enabled,
      readonlyApiBaseUrl: "https://example.test/functions/v1/nov-talent-readonly-api"
    },
    NovHubSession: helper,
    NOV_HUB_SESSION_CONTRACT: { audience }
  };
}

function fakeDocument() {
  const elements = new Map();
  const metrics = {
    children: [],
    replaceChildren(...children) {
      this.children = children;
    }
  };
  const status = { dataset: {}, textContent: "", focusCount: 0, focus() { this.focusCount += 1; } };
  const button = {
    dataset: {},
    disabled: false,
    textContent: "集計を表示",
    attributes: {},
    listeners: new Map(),
    addEventListener(type, listener) {
      this.listeners.set(type, listener);
    },
    setAttribute(name, value) {
      this.attributes[name] = String(value);
    },
    async click(event = {}) {
      return this.listeners.get("click")?.({ type: "click", ...event });
    }
  };
  elements.set("summary-metrics", metrics);
  elements.set("summary-status", status);
  elements.set("summary-load-button", button);
  return {
    metrics,
    status,
    button,
    createElement(tagName) {
      return {
        tagName,
        children: [],
        className: "",
        dataset: {},
        textContent: "",
        append(...children) {
          this.children = children;
        }
      };
    },
    getElementById(id) {
      return elements.get(id) || null;
    }
  };
}

test("same-origin route uses HUB helper and performs exactly one summary request", async () => {
  resetTalentDashboardSummaryStartupForFixture();
  const calls = [];
  const documentObject = fakeDocument();
  const result = await startTalentDashboardSummary({
    globalObject: fakeGlobal(),
    documentObject,
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return {
        status: 200,
        ok: true,
        headers: { get: () => "application/json" },
        async json() {
          return validEnvelope();
        }
      };
    }
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].options.method, "GET");
  assert.equal(Object.keys(calls[0].options.headers).includes("Authorization"), true);
  assert.equal(
    calls[0].url,
    "https://example.test/functions/v1/nov-talent-readonly-api/api/talent/v1/dashboard/summary?fiscalYear=current"
  );
  assert.equal(
    calls[0].url.startsWith("https://example.test/api/talent/v1/dashboard/summary"),
    false
  );
  assert.equal(result.metricCount, 7);
  assert.equal(result.requestCount, 1);
  assert.equal(result.retryCount, 0);
  assert.equal(documentObject.metrics.children.length, 7);
  assert.equal(documentObject.status.textContent, "集計を表示しました");
  assert.equal(result.rawResponseReturned, false);
  assert.equal(result.tokenValueReturned, false);
  assert.equal(result.studentRowsReturned, false);
});

test("startup duplicate prevention keeps request max1 and retry0", async () => {
  resetTalentDashboardSummaryStartupForFixture();
  const calls = [];
  const fetchImpl = async () => {
    calls.push(true);
    return {
      status: 200,
      ok: true,
      headers: { get: () => "application/json" },
      async json() {
        return validEnvelope();
      }
    };
  };

  await startTalentDashboardSummary({ globalObject: fakeGlobal(), documentObject: fakeDocument(), fetchImpl });
  const second = await startTalentDashboardSummary({ globalObject: fakeGlobal(), documentObject: fakeDocument(), fetchImpl });

  assert.equal(calls.length, 1);
  assert.equal(second.stopCategory, "duplicate_control_prevented");
  assert.equal(second.httpRequestSent, false);
});

test("operator control initializes with request0 and token0", () => {
  resetTalentDashboardSummaryStartupForFixture();
  let tokenReads = 0;
  let fetches = 0;
  const documentObject = fakeDocument();
  const result = initializeTalentSummaryControl({
    globalObject: {
      ...fakeGlobal({ helper: { async getSessionToken() { tokenReads += 1; return "fixture"; } } }),
      AbortController,
      addEventListener() {}
    },
    documentObject,
    fetchImpl: async () => { fetches += 1; }
  });

  assert.equal(result.initialized, true);
  assert.equal(result.helperAvailable, true);
  assert.equal(tokenReads, 0);
  assert.equal(fetches, 0);
  assert.equal(documentObject.button.disabled, false);
  assert.equal(documentObject.status.textContent, "ボタンを押すと最新の集計を表示します");
});

test("one trusted click disables first and performs exact1 while reentry stays request0", async () => {
  resetTalentDashboardSummaryStartupForFixture();
  const observations = [];
  const documentObject = fakeDocument();
  initializeTalentSummaryControl({
    globalObject: { ...fakeGlobal(), AbortController, addEventListener() {} },
    documentObject,
    fetchImpl: async () => {
      observations.push({ disabled: documentObject.button.disabled, busy: documentObject.button.attributes["aria-busy"] });
      return {
        status: 200,
        ok: true,
        headers: { get: () => "application/json" },
        async json() { return validEnvelope(); }
      };
    }
  });

  const first = documentObject.button.click();
  const second = await documentObject.button.click();
  const result = await first;

  assert.equal(observations.length, 1);
  assert.deepEqual(observations[0], { disabled: true, busy: "true" });
  assert.equal(result.requestCount, 1);
  assert.equal(second.stopCategory, "duplicate_control_prevented");
  assert.equal(documentObject.button.disabled, true);
  assert.equal(documentObject.button.textContent, "集計を表示済み");
  assert.equal(documentObject.status.focusCount, 1);
});

test("missing helper disables control at startup with request0 and token0", () => {
  resetTalentDashboardSummaryStartupForFixture();
  let tokenReads = 0;
  let fetches = 0;
  const documentObject = fakeDocument();
  const result = initializeTalentSummaryControl({
    globalObject: {
      ...fakeGlobal({ helper: null }),
      AbortController,
      addEventListener() {},
      readToken() { tokenReads += 1; }
    },
    documentObject,
    fetchImpl: async () => { fetches += 1; }
  });

  assert.equal(result.initialized, true);
  assert.equal(result.helperAvailable, false);
  assert.equal(result.stopCategory, "auth_required");
  assert.equal(result.requestCount, 0);
  assert.equal(result.retryCount, 0);
  assert.equal(fetches, 0);
  assert.equal(tokenReads, 0);
  assert.equal(documentObject.button.disabled, true);
  assert.equal(documentObject.status.dataset.state, "stopped");
  assert.equal(documentObject.status.dataset.safeCategory, "auth_required");
  assert.equal(documentObject.status.dataset.requestCount, "0");
  assert.equal(documentObject.status.dataset.retryCount, "0");
  assert.equal(documentObject.status.dataset.httpStatusCategory, "none");
  assert.equal(documentObject.status.textContent, "認証確認が必要です（送信前に停止）");
});

test("API failure after one click preserves request1 retry0 as safe DOM categories", async () => {
  resetTalentDashboardSummaryStartupForFixture();
  const documentObject = fakeDocument();
  const result = await startTalentDashboardSummary({
    globalObject: fakeGlobal(),
    documentObject,
    fetchImpl: async () => {
      throw new Error("fixture_network_failure");
    }
  });

  assert.equal(result.stopCategory, "api_error");
  assert.equal(result.requestCount, 1);
  assert.equal(result.retryCount, 0);
  assert.equal(result.httpStatusCategory, "none");
  assert.equal(documentObject.status.dataset.safeCategory, "api_error");
  assert.equal(documentObject.status.dataset.requestCount, "1");
  assert.equal(documentObject.status.dataset.retryCount, "0");
  assert.equal(documentObject.status.textContent, "API接続で停止しました（1回送信・再試行なし）");
});

test("contract mismatch preserves request1 as a safe invalid-response category", async () => {
  resetTalentDashboardSummaryStartupForFixture();
  const documentObject = fakeDocument();
  const result = await startTalentDashboardSummary({
    globalObject: fakeGlobal(),
    documentObject,
    fetchImpl: async () => ({
      status: 200,
      ok: true,
      headers: { get: () => "application/json" },
      async json() {
        const envelope = validEnvelope();
        envelope.data.summary.extra = 1;
        return envelope;
      }
    })
  });

  assert.equal(result.stopCategory, "invalid_response");
  assert.equal(result.requestCount, 1);
  assert.equal(result.retryCount, 0);
  assert.equal(result.httpStatusCategory, "none");
  assert.equal(documentObject.status.dataset.safeCategory, "invalid_response");
  assert.equal(documentObject.status.dataset.requestCount, "1");
  assert.equal(documentObject.status.dataset.retryCount, "0");
  assert.equal(documentObject.status.textContent, "集計形式を確認できません（1回送信・再試行なし）");
});

test("invalidation aborts and suppresses stale completion rendering", async () => {
  resetTalentDashboardSummaryStartupForFixture();
  let releaseResponse;
  const documentObject = fakeDocument();
  initializeTalentSummaryControl({
    globalObject: { ...fakeGlobal(), AbortController, addEventListener() {} },
    documentObject,
    fetchImpl: async () => new Promise((resolve) => {
      releaseResponse = () => resolve({
        status: 200,
        ok: true,
        headers: { get: () => "application/json" },
        async json() { return validEnvelope(); }
      });
    })
  });

  const pending = documentObject.button.click();
  for (let attempt = 0; attempt < 10 && typeof releaseResponse !== "function"; attempt += 1) {
    await Promise.resolve();
  }
  assert.equal(typeof releaseResponse, "function");
  invalidateTalentDashboardSummaryRun({ documentObject });
  releaseResponse();
  const result = await pending;

  assert.equal(result.stopCategory, "run_invalidated");
  assert.equal(result.staleCompletionSuppressed, true);
  assert.equal(documentObject.metrics.children.length, 0);
  assert.equal(documentObject.status.textContent, "集計表示を中止しました");
});

test("runtime disabled, helper missing, wrong audience, and absent token fail before HTTP", async () => {
  for (const scenario of [
    { globalObject: fakeGlobal({ enabled: false }) },
    { globalObject: fakeGlobal({ helper: null }) },
    { globalObject: fakeGlobal({ audience: "wrong_audience" }) },
    { globalObject: fakeGlobal({ helper: defaultHelper("") }) }
  ]) {
    resetTalentDashboardSummaryStartupForFixture();
    let fetched = false;
    const result = await startTalentDashboardSummary({
      ...scenario,
      documentObject: fakeDocument(),
      fetchImpl: async () => {
        fetched = true;
        throw new Error("should_not_fetch");
      }
    });
    assert.equal(fetched, false);
    assert.equal(result.httpRequestSent, false);
  }
});

test("validator rejects extra keys and malformed summary without raw data output", async () => {
  const executor = createDashboardSummaryExact1Executor({
    globalObject: fakeGlobal(),
    fetchImpl: async () => ({
      status: 200,
      ok: true,
      headers: { get: () => "application/json" },
      async json() {
        const envelope = validEnvelope();
        envelope.data.summary.extra = 1;
        return envelope;
      }
    })
  });
  const result = await executor.run();
  assert.equal(result.okBoolean, false);
  assert.equal(result.rawResponseReturned, false);
  assert.equal(result.employeeIdentityReturned, false);
  assert.equal(result.studentRowsReturned, false);
});

test("view model exposes seven aggregate Japanese labels only", () => {
  const viewModel = buildDashboardSummaryViewModel(validEnvelope().data);
  assert.equal(viewModel.length, 7);
  assert.deepEqual(Object.keys(viewModel[0]).sort(), ["key", "label", "value"]);
  assert.equal(viewModel[0].label, "接点数");
});

test("runtime reader strips query/hash from API base and never treats URL params as token transport", () => {
  const globalObject = fakeGlobal();
  globalObject.NOV_TALENT_CONFIG.readonlyApiBaseUrl = "https://example.test/functions/v1/nov-talent-readonly-api?debug=1#x";
  const runtime = readTalentRuntime({ globalObject });
  assert.equal(runtime.apiBaseUrl, "https://example.test/functions/v1/nov-talent-readonly-api");
});

test("source fixture keeps Japanese UI and desktop/mobile responsive rules", () => {
  const html = readFileSync(new URL("../portal/talent/index.html", import.meta.url), "utf8");
  const css = readFileSync(new URL("../portal/talent/style.css", import.meta.url), "utf8");
  const apps = readFileSync(new URL("../portal/js/apps.js", import.meta.url), "utf8");

  assert.match(html, /採用・人材投資 集計/);
  assert.match(html, /id="summary-load-button"[\s\S]*集計を表示/);
  assert.match(html, /aria-live="polite"/);
  assert.doesNotMatch(html, /Dashboard Summary|summary_loading/);
  assert.match(css, /\.summary-load-button/);
  assert.match(css, /\.summary-load-button \{ width: 100%; \}/);
  assert.match(css, /@media \(max-width: 860px\)/);
  assert.match(css, /@media \(max-width: 520px\)/);
  assert.match(apps, /appId: "human-capital-investment"[\s\S]*url: "\.\/talent\/"/);
  assert.doesNotMatch(apps.match(/appId: "human-capital-investment"[\s\S]*?priority: 64/)?.[0] || "", /hr-investment-dashboard/);
});

test("published runtime candidate enables only the approved read-only API", () => {
  const runtimeConfig = readFileSync(
    new URL("../portal/talent/runtime-config.candidate.js", import.meta.url),
    "utf8"
  );

  assert.match(runtimeConfig, /readonlyApiEnabled:\s*true/);
  assert.match(
    runtimeConfig,
    /https:\/\/nkmxevmioczcmnldreyo\.supabase\.co\/functions\/v1\/nov-talent-readonly-api/
  );
  assert.doesNotMatch(runtimeConfig, new RegExp(`${["service", "role"].join("_")}|sb_secret_|eyJ`, "i"));
});

test("talent entry point cache-busts runtime config and app with one release id", () => {
  const html = readFileSync(new URL("../portal/talent/index.html", import.meta.url), "utf8");
  const runtimeVersion = html.match(/runtime-config\.candidate\.js\?v=([^"']+)/)?.[1];
  const appVersion = html.match(/app\.mjs\?v=([^"']+)/)?.[1];

  assert.ok(runtimeVersion, "runtime config must have a release id");
  assert.equal(appVersion, runtimeVersion);
});

test("HUB launcher canonicalizes Talent route even when backend URL is stale", () => {
  const mainSource = readFileSync(new URL("../portal/js/main.js", import.meta.url), "utf8");

  assert.match(mainSource, /"human-capital-investment"/);
  assert.match(mainSource, /"hr-investment-dashboard"/);
  assert.match(mainSource, /"nov-talent"/);
  assert.match(mainSource, /const TALENT_APP_URL = "\.\/talent\/";/);
  assert.match(mainSource, /const TALENT_LEGACY_ORIGIN = "https:\/\/ideanow-shift\.github\.io";/);
  assert.match(mainSource, /const TALENT_LEGACY_PATH = "\/hr-investment-dashboard";/);
  assert.match(mainSource, /function isLegacyTalentUrl\(value\)/);
  assert.match(mainSource, /function isTalentApp\(app\)/);
  assert.match(mainSource, /TALENT_APP_IDS\.has\(appId\) \|\| isLegacyTalentUrl\(app\?\.url\)/);
  assert.match(mainSource, /:\s*isTalentApp\(app\)\s*\?\s*TALENT_APP_URL\s*:\s*app\.url/);
  assert.match(mainSource, /isTalentApp\(app\)\s*\?\s*appUrl\s*:\s*buildAppLaunchUrl\(appUrl, employeeContext\)/);
  assert.match(mainSource, /if \(isTalentApp\(app\)\) \{[\s\S]*window\.location\.assign\(launchUrl\);[\s\S]*return;[\s\S]*const target = window\.open/);
  assert.doesNotMatch(
    mainSource.match(/if \(isTalentApp\(app\)\) \{[\s\S]*?return;\s*\}/)?.[0] || "",
    new RegExp(`hub_context|window\\.open|${["post", "Message"].join("")}|${["open", "er"].join("")}`)
  );
});

test("Talent launch validates the canonical HUB session before same-origin navigation", () => {
  const mainSource = readFileSync(new URL("../portal/js/main.js", import.meta.url), "utf8");
  const freshnessSource = mainSource.match(/async function ensureTalentHubSessionFreshness\(\) \{[\s\S]*?\n\}/)?.[0] || "";
  const talentLaunchSource = mainSource.slice(
    mainSource.indexOf("if (isTalentApp(app))"),
    mainSource.indexOf('const target = window.open("about:blank", "_blank")')
  );

  assert.match(freshnessSource, /setNovHubSession\(current, \{ persist: false \}\)/);
  assert.match(freshnessSource, /current\.audience \|\| ""/);
  assert.match(freshnessSource, /NOV_HUB_SESSION_CONTRACT\.audience/);
  assert.match(freshnessSource, /const refreshed = await fetchPortalData\(\)/);
  assert.match(freshnessSource, /const session = refreshed\?\.hubSession \|\| null/);
  assert.match(freshnessSource, /if \(!setNovHubSession\(session\)\)/);
  assert.match(talentLaunchSource, /await ensureTalentHubSessionFreshness\(\)/);
  assert.match(talentLaunchSource, /window\.location\.assign\(launchUrl\)/);
  assert.ok(
    talentLaunchSource.indexOf("ensureTalentHubSessionFreshness") < talentLaunchSource.indexOf("window.location.assign"),
    "navigation must occur only after canonical session validation"
  );
});

test("Talent session freshness uses one fail-closed refresh attempt without forbidden fallback", () => {
  const mainSource = readFileSync(new URL("../portal/js/main.js", import.meta.url), "utf8");
  const freshnessSource = mainSource.match(/async function ensureTalentHubSessionFreshness\(\) \{[\s\S]*?\n\}/)?.[0] || "";
  const talentLaunchSource = mainSource.slice(
    mainSource.indexOf("if (isTalentApp(app))"),
    mainSource.indexOf('const target = window.open("about:blank", "_blank")')
  );

  assert.match(freshnessSource, /if \(talentSessionFreshnessAttempt\) return talentSessionFreshnessAttempt/);
  assert.match(freshnessSource, /finally \{/);
  assert.match(freshnessSource, /talentSessionFreshnessAttempt === attempt/);
  assert.match(freshnessSource, /talentSessionFreshnessAttempt = null/);
  assert.equal((freshnessSource.match(/fetchPortalData\(\)/g) || []).length, 1);
  assert.doesNotMatch(freshnessSource, /localStorage|sessionStorage|hub_context|postMessage|opener|setTimeout|retry/i);
  assert.doesNotMatch(talentLaunchSource, /console\.(?:log|info|warn|error)/);
  assert.match(talentLaunchSource, /HUB接続を確認できません/);
});

test("Talent freshness repair preserves startup request0 and click exact1 contracts", () => {
  const mainSource = readFileSync(new URL("../portal/js/main.js", import.meta.url), "utf8");
  const appSource = readFileSync(new URL("../portal/talent/app.mjs", import.meta.url), "utf8");
  const exact1Source = readFileSync(new URL("../portal/talent/exact1.mjs", import.meta.url), "utf8");

  assert.doesNotMatch(mainSource, /hub_context[^\n]*TALENT_APP_URL|TALENT_APP_URL[^\n]*hub_context/);
  assert.match(appSource, /const formalHelperAvailable = typeof globalObject\?\.NovHubSession\?\.getSessionToken === "function"/);
  assert.match(appSource, /button\.addEventListener\("click", run\)/);
  assert.match(exact1Source, /method: "GET"/);
  assert.match(exact1Source, /requestCount: 1/);
  assert.match(exact1Source, /retryCount: 0/);
});

function createTalentFreshnessFixture({ current = null, refreshed = null, refreshError = null } = {}) {
  const mainSource = readFileSync(new URL("../portal/js/main.js", import.meta.url), "utf8");
  const functionSource = mainSource.match(/async function ensureTalentHubSessionFreshness\(\) \{[\s\S]*?\n\}/)?.[0];
  assert.ok(functionSource);
  const calls = { refresh: 0, install: 0 };
  let nextRefreshed = refreshed;
  let nextRefreshError = refreshError;
  const canonicalInstall = (session) => {
    calls.install += 1;
    return Boolean(
      session?.sessionToken
      && session?.audience === "nov_hub"
      && Number.isFinite(Date.parse(session?.expiresAt))
      && Date.parse(session.expiresAt) > Date.now()
    );
  };
  const build = new Function("fixture", `
    const state = { hubSession: fixture.current };
    const NOV_HUB_SESSION_CONTRACT = { audience: "nov_hub" };
    const setNovHubSession = fixture.canonicalInstall;
    const fetchPortalData = fixture.fetchPortalData;
    let talentSessionFreshnessAttempt = null;
    ${functionSource}
    return { ensure: ensureTalentHubSessionFreshness, state };
  `);
  const runtime = build({
    current,
    canonicalInstall,
    async fetchPortalData() {
      calls.refresh += 1;
      if (nextRefreshError) throw nextRefreshError;
      return { hubSession: nextRefreshed };
    }
  });
  return {
    ...runtime,
    calls,
    setRefreshResult(value) {
      nextRefreshed = value;
      nextRefreshError = null;
    }
  };
}

const freshSession = () => ({
  sessionToken: "fixture-session-value-never-recorded",
  audience: "nov_hub",
  expiresAt: new Date(Date.now() + 60_000).toISOString()
});

test("fresh Talent session navigability needs refresh request0", async () => {
  const session = freshSession();
  const fixture = createTalentFreshnessFixture({ current: session });
  assert.equal(await fixture.ensure(), session);
  assert.equal(fixture.calls.refresh, 0);
});

test("expired and missing Talent sessions refresh exact1", async () => {
  const expired = { ...freshSession(), expiresAt: new Date(Date.now() - 60_000).toISOString() };
  for (const current of [expired, null]) {
    const replacement = freshSession();
    const fixture = createTalentFreshnessFixture({ current, refreshed: replacement });
    assert.equal(await fixture.ensure(), replacement);
    assert.equal(fixture.calls.refresh, 1);
    assert.equal(fixture.state.hubSession, replacement);
  }
});

test("wrong audience and malformed or expired refreshed sessions fail closed", async () => {
  const wrongAudience = createTalentFreshnessFixture({ current: { ...freshSession(), audience: "other" } });
  await assert.rejects(wrongAudience.ensure(), /TALENT_HUB_SESSION_UNAVAILABLE/);
  assert.equal(wrongAudience.calls.refresh, 0);

  for (const refreshed of [{ audience: "nov_hub" }, { ...freshSession(), expiresAt: new Date(0).toISOString() }]) {
    const fixture = createTalentFreshnessFixture({ current: null, refreshed });
    await assert.rejects(fixture.ensure(), /TALENT_HUB_SESSION_UNAVAILABLE/);
    assert.equal(fixture.calls.refresh, 1);
  }
});

test("one failed launch does not retry, while a later operator launch may recover", async () => {
  const failed = createTalentFreshnessFixture({ current: null, refreshError: new Error("fixed-fixture-failure") });
  await assert.rejects(failed.ensure());
  assert.equal(failed.calls.refresh, 1);

  failed.setRefreshResult(freshSession());
  await failed.ensure();
  assert.equal(failed.calls.refresh, 2);
});

test("concurrent calls share one in-flight refresh", async () => {
  const fixture = createTalentFreshnessFixture({ current: null, refreshed: freshSession() });
  const [first, second] = await Promise.all([fixture.ensure(), fixture.ensure()]);
  assert.equal(first, second);
  assert.equal(fixture.calls.refresh, 1);
});

test("a later expiry is revalidated and refreshed exact1", async () => {
  const initial = freshSession();
  const replacement = freshSession();
  const fixture = createTalentFreshnessFixture({ current: initial, refreshed: replacement });
  assert.equal(await fixture.ensure(), initial);
  assert.equal(fixture.calls.refresh, 0);

  fixture.state.hubSession = { ...initial, expiresAt: new Date(Date.now() - 60_000).toISOString() };
  assert.equal(await fixture.ensure(), replacement);
  assert.equal(fixture.calls.refresh, 1);

  assert.equal(await fixture.ensure(), replacement);
  assert.equal(fixture.calls.refresh, 1);
});

test("pageshow or BFCache restoration cannot mark a stale session connected", () => {
  const appSource = readFileSync(new URL("../portal/talent/app.mjs", import.meta.url), "utf8");
  assert.doesNotMatch(appSource, /addEventListener\?\.\("pageshow"[^\n]*setStatus/);
  assert.match(appSource, /state === "ready" \? "HUB接続済み"/);
  assert.match(appSource, /setStatus\(documentObject, "ready", "集計を表示しました"\)/);
});

test("portal entry point uses the content-addressed Talent freshness main.js identity", () => {
  const portalIndex = readFileSync(new URL("../portal/index.html", import.meta.url), "utf8");
  assert.match(
    portalIndex,
    /\.\/js\/main\.js\?v=0e672ef9c36c346349cfcba856eec3899b0fca1600b483f44d406a84df7f85e2/
  );
  assert.doesNotMatch(portalIndex, /hub-talent-route-20260719-1/);
});
