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
import { isStoreSalesMockIdentity, resolveMockIdentityFixture } from "./mock-identity.js";
import { createRuntimeDiagnostics } from "./diagnostics.js";

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
  const now = dependencies.now || (() => Date.now());
  const diagnostics = createRuntimeDiagnostics({ logger: dependencies.logger, now });
  const listeners = new Set();
  let runtimeConfig = { ...(options.runtimeConfig || {}) };
  let adapter = null;
  let session = null;
  let previewContext = null;
  let mockIdentity = null;
  let featureFlag = null;
  let lastPeriod = null;
  let retryCount = 0;
  let retryInFlight = null;
  let loadStartedAt = null;
  let loadSequence = 0;
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
      canRetry: ["maintenance", "timeout", "offline"].includes(next.status),
      diagnostics: diagnostics.snapshot()
    });
  }

  function publish(next) {
    const previousStatus = snapshot?.status || "idle";
    const durationMs = loadStartedAt && next.status !== "loading" ? Math.max(0, now() - loadStartedAt) : 0;
    diagnostics.record("runtime_transition", {
      from: previousStatus, to: next.status, status: next.status, featureFlag: featureFlag || "unresolved",
      period: lastPeriod || "unset", errorCode: next.errorCode || "none", retryCount, durationMs
    });
    if (next.status === "loading") loadStartedAt = now();
    else if (durationMs) loadStartedAt = null;
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
    const mockIdentityAllowed = featureFlag === "preview" || featureFlag === "mock";
    const candidateMockIdentity = mockIdentityAllowed ? dependencies.getMockIdentity?.() : null;
    mockIdentity = isStoreSalesMockIdentity(candidateMockIdentity) ? candidateMockIdentity : null;
    const sessionResult = await refreshSessionIfNeeded();
    if (runtimeConfig.requireHubSession && !sessionResult.session && !mockIdentity) {
      const error = Object.assign(new Error("HUB session is unavailable."), { code: "UNAUTHORIZED", status: 401 });
      throw Object.assign(error, { sessionStatus: sessionResult.sessionStatus });
    }
    previewContext = mockIdentity
      ? Object.freeze({ fixture: resolveMockIdentityFixture(mockIdentity), source: "runtime-mock-identity" })
      : runtimeConfig.preview ? restoreStoreSalesPreviewContext() : null;
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
        getMockIdentity: () => mockIdentity,
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
    const sequence = ++loadSequence;
    publish({
      status: "loading",
      presentation: runtimePresentation("loading")
    });
    try {
      const projection = await adapter.loadDashboard({ period: lastPeriod });
      if (sequence !== loadSequence) return snapshot;
      const status = Array.isArray(projection?.stores) && projection.stores.length === 0 ? "empty" : "ready";
      return publish({
        status,
        projection,
        presentation: status === "empty"
          ? runtimePresentation("empty")
          : runtimePresentation("ready", { body: ["mock", "preview"].includes(featureFlag) ? "画面確認用のサンプルデータを表示しています。実績値ではありません。" : "取得済みのread-onlyデータを表示しています。" })
      });
    } catch (error) {
      if (sequence !== loadSequence || error?.code === "REQUEST_ABORTED") return snapshot;
      return handleError(error);
    }
  }

  async function loadStore({ period, storeId } = {}) {
    if (period) lastPeriod = period;
    if (!adapter) await configureAdapter();
    if (typeof adapter?.loadStore !== "function") {
      throw Object.assign(new Error("Store detail endpoint is unavailable."), { code: "NOT_FOUND", status: 404 });
    }
    const sequence = ++loadSequence;
    publish({ status: "loading", presentation: runtimePresentation("loading") });
    try {
      const projection = await adapter.loadStore({ period: lastPeriod, storeId });
      if (sequence !== loadSequence) return snapshot;
      return publish({ status: "ready", projection, presentation: runtimePresentation("ready") });
    } catch (error) {
      if (sequence !== loadSequence || error?.code === "REQUEST_ABORTED") return snapshot;
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
      mockIdentity = null;
      clearNovHubSession();
    }
    return publish({ status: mapped.status, errorCode: mapped.code, presentation: mapped.presentation });
  }

  async function retry() {
    if (retryInFlight) return retryInFlight;
    if (!snapshot.canRetry) return snapshot;
    retryCount += 1;
    retryInFlight = load({ period: lastPeriod }).finally(() => { retryInFlight = null; });
    return retryInFlight;
  }

  async function updateSession(nextSession) {
    loadSequence += 1;
    adapter?.clear?.();
    adapter = null;
    if (!setNovHubSession(nextSession)) clearNovHubSession();
    return initialize({ period: lastPeriod });
  }

  async function switchProjection(nextFeatureFlag, configOverride = {}) {
    loadSequence += 1;
    adapter?.clear?.();
    adapter = null;
    runtimeConfig = { ...runtimeConfig, ...configOverride, featureFlag: nextFeatureFlag, mode: nextFeatureFlag };
    return initialize({ period: lastPeriod });
  }

  return Object.freeze({
    initialize,
    load,
    loadStore,
    retry,
    updateSession,
    switchProjection,
    getDiagnostics: () => diagnostics.entries(),
    getSnapshot: () => snapshot,
    subscribe(listener) {
      if (typeof listener !== "function") return () => {};
      listeners.add(listener);
      listener(snapshot);
      return () => listeners.delete(listener);
    }
  });
}
