import { createNovTalentMockRepository } from "./mock-repository.mjs";

const METRIC_LABELS = Object.freeze({
  contacts: "接点数",
  lineRegistrations: "LINE登録",
  salonTours: "サロン見学",
  interviews: "面接",
  passed: "承諾",
  offers: "内定",
  expectedJoiners: "入社予定"
});

export function readNovTalentRuntime({ globalObject = globalThis } = {}) {
  const configured = String(globalObject?.NOV_TALENT_CONFIG?.mockState || "").trim();
  const queryState = readQueryState(globalObject?.location?.search);
  return Object.freeze({
    mode: "mock",
    state: queryState || configured || "ready",
    networkEnabled: false,
    writeEnabled: false,
    repository: createNovTalentMockRepository({ state: queryState || configured || "ready" })
  });
}

export function createDashboardSummaryExecutor({ globalObject = globalThis } = {}) {
  const runtime = readNovTalentRuntime({ globalObject });
  let consumed = false;
  return Object.freeze({
    async run() {
      if (consumed) return safeResult("duplicate_startup_prevented");
      consumed = true;
      const result = await runtime.repository.getSummary();
      if (!result.ok) return safeResult(result.category);
      return Object.freeze({
        ...safeResult("ready", true),
        data: result.data,
        viewModel: buildDashboardSummaryViewModel(result.data)
      });
    }
  });
}

export function createTalentWorkspaceExecutor({ globalObject = globalThis } = {}) {
  const runtime = readNovTalentRuntime({ globalObject });
  let consumed = false;
  return Object.freeze({
    async run() {
      if (consumed) return safeResult("duplicate_startup_prevented");
      consumed = true;
      const result = await runtime.repository.getWorkspace();
      if (!result.ok) return safeResult(result.category);
      const tasks = await runtime.repository.getTodayTasks({ limit: 5 });
      return Object.freeze({
        ...safeResult("ready", true),
        data: Object.freeze({ ...result.data, todayTasks: tasks.ok ? tasks.data : Object.freeze([]) })
      });
    }
  });
}

export function buildDashboardSummaryViewModel(data) {
  return Object.entries(METRIC_LABELS).map(([key, label]) => Object.freeze({
    key,
    label,
    value: Number.isInteger(data?.summary?.[key]) && data.summary[key] >= 0 ? data.summary[key] : 0
  }));
}

function readQueryState(search) {
  try {
    return new URLSearchParams(String(search || "")).get("mockState") || "";
  } catch {
    return "validation_error";
  }
}

function safeResult(category, ready = false) {
  return Object.freeze({
    executed: ready,
    httpRequestSent: false,
    httpStatus: 0,
    okBoolean: ready,
    stopCategory: category,
    requestCount: 0,
    retryCount: 0,
    runtimeMode: "mock",
    networkOperationCount: 0
  });
}
