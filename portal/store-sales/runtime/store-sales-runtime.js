import {
  clearNovHubSession,
  getNovHubSessionStatus,
  restoreNovHubSession,
  setNovHubSession
} from "../../js/nov-hub-session-candidate.js";
import { createStoreSalesAdapter } from "../adapters/index.js";
import { restoreStoreSalesPreviewContext } from "../preview-context.js";
import { mapRuntimeError, runtimePresentation } from "./error-mapping.js";
import { resolveStoreSalesFeatureFlag, toAdapterRuntimeConfig } from "./feature-flags.js";

export const STORE_SALES_RUNTIME_STATES = Object.freeze([
  "initializing",
  "loading",
  "ready",
  "empty",
  "unauthorized",
  "forbidden",
  "validation_error",
  "maintenance",
  "timeout",
  "offline"
]);

export function createStoreSalesRuntime(options = {}) {
  const location = options.location || globalThis.location || {};
  const dependencies = options.dependencies || {};
  const listeners = new Set();
  let runtimeConfig = { ...(options.runtimeConfig || {}) };
  let adapter = null;
  let session = null;
  let previewContext = null;
  let featureFlag = null;
  let lastPeriod = null;
  let retryCount = 0;
  let snapshot = freezeSnapshot({ status: "initializing", presentation: runtimePresentation("initializing") });

  function freezeSnapshot(next) {
    return Object.freeze({
      status: next.status,
      featureFlag,
      projection: next.projection ?? null,
      errorCode: next.errorCode ?? null,
      presentation: next.presentation || runtimePresentation(next.status),
      period: lastPeriod,
      retryCount,
      canRetry: ["maintenance", "timeout", "offline"].includes(next.status)
    });
  }

  function publish(next) {
    snapshot = freezeSnapshot(next);
    listeners.forEach((listener) => listener(snapshot));
    return snapshot;
  }

  async function refreshSessionIfNeeded() {
    const sessionStatus = getNovHubSessionStatus();
    session = restoreNovHubSession();
    if (session || !runtimeConfig.requireHubSession) return { sessionStatus, session };
    if (typeof dependencies.refreshSession === "function") {
      const refreshed = await dependencies.refreshSession();
      if (setNovHubSession(refreshed)) session = restoreNovHubSession();
    }
    return { sessionStatus, session };
  }

  async function configureAdapter() {
    featureFlag = resolveStoreSalesFeatureFlag(runtimeConfig);
    const sessionResult = await refreshSessionIfNeeded();
    if (runtimeConfig.requireHubSession && !sessionResult.session) {
      const error = Object.assign(new Error("HUB session is unavailable."), { code: "UNAUTHORIZED", status: 401 });
      throw Object.assign(error, { sessionStatus: sessionResult.sessionStatus });
    }
    previewContext = runtimeConfig.preview ? restoreStoreSalesPreviewContext() : null;
    if (runtimeConfig.preview && !previewContext) {
      throw Object.assign(new Error("Preview actor context is unavailable."), { code: "ACTOR_SCOPE_DENIED", status: 403 });
    }
    const adapterRuntimeConfig = toAdapterRuntimeConfig(featureFlag, runtimeConfig);
    const adapterFactory = dependencies.createAdapter || createStoreSalesAdapter;
    const created = adapterFactory({
      location,
      runtimeConfig: adapterRuntimeConfig,
      dependencies: {
        ...dependencies,
        getSessionToken: () => session?.sessionToken || "",
        getPreviewFixtureName: () => previewContext?.fixture || ""
      }
    });
    adapter = created.adapter;
  }

  async function initialize({ period } = {}) {
    lastPeriod = period || lastPeriod;
    publish({ status: "initializing", presentation: runtimePresentation("initializing") });
    try {
      await configureAdapter();
      return await load({ period: lastPeriod });
    } catch (error) {
      return handleError(error);
    }
  }

  async function load({ period } = {}) {
    if (period) lastPeriod = period;
    if (!adapter) return initialize({ period: lastPeriod });
    publish({
      status: "loading",
      presentation: Object.freeze({ title: "店舗営業情報を読み込んでいます", body: "RuntimeがProjectionを確認しています。", blocking: false, retryable: false })
    });
    try {
      const projection = await adapter.loadDashboard({ period: lastPeriod });
      const status = Array.isArray(projection?.stores) && projection.stores.length === 0 ? "empty" : "ready";
      return publish({
        status,
        projection,
        presentation: status === "empty"
          ? runtimePresentation("empty")
          : Object.freeze({ title: ["mock", "preview"].includes(featureFlag) ? "Preview Mode" : "Store Sales Runtime", body: ["mock", "preview"].includes(featureFlag) ? "mockのサンプルデータを表示しています。実会計データではありません。" : "read-only Projectionを表示しています。", blocking: false, retryable: false })
      });
    } catch (error) {
      return handleError(error);
    }
  }

  function handleError(error) {
    const mapped = mapRuntimeError(error, {
      sessionStatus: error?.sessionStatus,
      online: dependencies.isOnline ? dependencies.isOnline() : globalThis.navigator?.onLine
    });
    if (mapped.status === "unauthorized") {
      adapter?.clear?.();
      adapter = null;
      session = null;
      clearNovHubSession();
    }
    return publish({ status: mapped.status, errorCode: mapped.code, presentation: mapped.presentation });
  }

  async function retry() {
    retryCount += 1;
    return load({ period: lastPeriod });
  }

  async function updateSession(nextSession) {
    adapter?.clear?.();
    adapter = null;
    if (!setNovHubSession(nextSession)) clearNovHubSession();
    return initialize({ period: lastPeriod });
  }

  async function switchProjection(nextFeatureFlag, configOverride = {}) {
    adapter?.clear?.();
    adapter = null;
    runtimeConfig = { ...runtimeConfig, ...configOverride, featureFlag: nextFeatureFlag, mode: nextFeatureFlag };
    return initialize({ period: lastPeriod });
  }

  return Object.freeze({
    initialize,
    load,
    retry,
    updateSession,
    switchProjection,
    getSnapshot: () => snapshot,
    subscribe(listener) {
      if (typeof listener !== "function") return () => {};
      listeners.add(listener);
      listener(snapshot);
      return () => listeners.delete(listener);
    }
  });
}
