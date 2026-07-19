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
  assert.equal(String(calls[0].url).includes("/api/talent/v1/dashboard/summary"), true);
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
  assert.equal(fetches, 0);
  assert.equal(tokenReads, 0);
  assert.equal(documentObject.button.disabled, true);
  assert.equal(documentObject.status.dataset.state, "stopped");
  assert.equal(documentObject.status.textContent, "HUB接続を確認できません。HUBから開き直してください");
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
