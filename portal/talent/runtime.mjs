import { createNovTalentMockRepository } from "./mock-repository.mjs";
import { NOV_HUB_SESSION_CONTRACT } from "../js/nov-hub-session-candidate.js";
import {
  createDashboardSummaryExact1Executor,
  createSelectionCoverageExact1Executor,
  createTalentWorkspaceExact1Executor
} from "./exact1.mjs?v=20260808-selection-coverage-hotfix-1";

const METRIC_LABELS = Object.freeze({
  contacts: "接触数",
  lineRegistrations: "LINE登録",
  salonTours: "見学",
  interviews: "面接",
  passed: "通過",
  offers: "内定",
  expectedJoiners: "入社予定"
});

export function readNovTalentRuntime({ globalObject = globalThis } = {}) {
  const config = globalObject?.NOV_TALENT_CONFIG || {};
  const configuredMode = String(config.runtimeMode || "mock").trim();
  const stagingEnabled = configuredMode === "staging"
    && config?.features?.stagingCandidateDataset === true
    && config.readonlyApiEnabled === true
    && config.networkEnabled === true
    && [true, false].includes(config.writeEnabled);
  if (stagingEnabled) {
    return Object.freeze({
      mode: "staging",
      state: "ready",
      networkEnabled: true,
      writeEnabled: config.writeEnabled === true,
      repository: null
    });
  }
  const configured = String(config.mockState || "").trim();
  const queryState = readQueryState(globalObject?.location?.search);
  const state = queryState || configured || "ready";
  return Object.freeze({
    mode: "mock",
    state,
    networkEnabled: false,
    writeEnabled: false,
    repository: createNovTalentMockRepository({ state })
  });
}
export function createDashboardSummaryExecutor({ globalObject = globalThis, fiscalYear = "current" } = {}) {
  const runtime = readNovTalentRuntime({ globalObject });
  if (runtime.mode === "staging") {
    return createDashboardSummaryExact1Executor({
      globalObject,
      hubContract: NOV_HUB_SESSION_CONTRACT,
      fiscalYear
    });
  }
  let consumed = false;
  return Object.freeze({
    async run() {
      if (consumed) return safeResult("duplicate_startup_prevented", false, "mock");
      consumed = true;
      const result = await runtime.repository.getSummary();
      if (!result.ok) return safeResult(result.category, false, "mock");
      return Object.freeze({
        ...safeResult("ready", true, "mock"),
        data: result.data,
        viewModel: buildDashboardSummaryViewModel(result.data)
      });
    }
  });
}

export function createTalentWorkspaceExecutor({ globalObject = globalThis } = {}) {
  const runtime = readNovTalentRuntime({ globalObject });
  if (runtime.mode === "staging") {
    const executor = createTalentWorkspaceExact1Executor({
      globalObject,
      hubContract: NOV_HUB_SESSION_CONTRACT,
      fiscalYear: "current"
    });
    if (!executor) return null;
    return Object.freeze({
      async run() {
        const result = await executor.run();
        if (result?.okBoolean !== true) return result;
        return Object.freeze({
          ...result,
          runtimeMode: "staging"
        });
      }
    });
  }
  let consumed = false;
  return Object.freeze({
    async run() {
      if (consumed) return safeResult("duplicate_startup_prevented", false, "mock");
      consumed = true;
      const result = await runtime.repository.getWorkspace();
      if (!result.ok) return safeResult(result.category, false, "mock");
      const tasks = await runtime.repository.getTodayTasks({ limit: 5 });
      return Object.freeze({
        ...safeResult("ready", true, "mock"),
        data: Object.freeze({ ...result.data, todayTasks: tasks.ok ? tasks.data : Object.freeze([]) })
      });
    }
  });
}

export function createSelectionCoverageExecutor({ globalObject = globalThis } = {}) {
  const runtime = readNovTalentRuntime({ globalObject });
  if (runtime.mode === "staging") {
    return createSelectionCoverageExact1Executor({ globalObject, hubContract: NOV_HUB_SESSION_CONTRACT });
  }
  let consumed = false;
  return Object.freeze({
    async run() {
      if (consumed) return safeResult("duplicate_startup_prevented", false, "mock");
      consumed = true;
      return Object.freeze({
        ...safeResult("ready", true, "mock"),
        data: Object.freeze({
          selection_coverage_contract_version: "1.0.0",
          sourceCoverageState: "PREPARING",
          officialSelectionRows: null,
          officialUniqueCandidates: null,
          unlinkedEvidenceTotal: null,
          datedUnlinkedEvidence: null,
          undatedUnlinkedEvidence: null,
          unlinkedUniqueCandidates: null,
          metrics: Object.freeze([])
        })
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

function safeResult(category, ready = false, runtimeMode = "mock") {
  return Object.freeze({
    executed: ready,
    httpRequestSent: false,
    httpStatus: 0,
    okBoolean: ready,
    stopCategory: category,
    requestCount: 0,
    retryCount: 0,
    runtimeMode,
    networkOperationCount: 0
  });
}
