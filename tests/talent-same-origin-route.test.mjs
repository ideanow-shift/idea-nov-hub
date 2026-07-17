import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
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
  const status = { dataset: {}, textContent: "" };
  elements.set("summary-metrics", metrics);
  elements.set("summary-status", status);
  return {
    metrics,
    status,
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
  assert.equal(second.stopCategory, "duplicate_startup_prevented");
  assert.equal(second.httpRequestSent, false);
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
  assert.doesNotMatch(html, /Dashboard Summary|summary_loading/);
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
  assert.doesNotMatch(runtimeConfig, /service_role|sb_secret_|eyJ/i);
});

test("talent entry point cache-busts runtime config and app with one release id", () => {
  const html = readFileSync(new URL("../portal/talent/index.html", import.meta.url), "utf8");
  const runtimeVersion = html.match(/runtime-config\.candidate\.js\?v=([^"']+)/)?.[1];
  const appVersion = html.match(/app\.mjs\?v=([^"']+)/)?.[1];

  assert.ok(runtimeVersion, "runtime config must have a release id");
  assert.equal(appVersion, runtimeVersion);
});
