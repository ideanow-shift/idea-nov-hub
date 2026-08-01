import { createAuditSink } from "./audit.js";
import { errorResponse, StagingApiError } from "./errors.js";
import { stagingHealth } from "./health.js";
import { buildSyntheticProjection, validatePeriod, validateStoreId } from "./projection.js";
import { resolveActorScope } from "./scope.js";
import { SYNTHETIC_STORES } from "./synthetic-data.js";

const STORE_PATH = /^\/v1\/store-sales\/stores\/([^/]+)$/;

export function createStoreSalesStagingService(options) {
  const { config, tokenVerifier } = options;
  const audit = options.audit || createAuditSink();
  const stores = options.stores || SYNTHETIC_STORES;
  const now = options.now || (() => Date.now());
  const requestCounts = new Map();
  return Object.freeze({
    async handle(input) {
      const started = now();
      const requestId = String(input.requestId || crypto.randomUUID());
      const url = new URL(input.url, "http://staging.invalid");
      const baseFields = { request_id: requestId, period: url.searchParams.get("period"), contract_version: config.contractVersion, environment: config.appEnv, synthetic: true };
      audit.emit("api_request", baseFields);
      try {
        if (input.method !== "GET") throw new StagingApiError("METHOD_NOT_ALLOWED", "GET only.", 405);
        if (url.pathname === "/health") return success(stagingHealth(config), requestId);
        if (options.maintenance === true) {
          audit.emit("maintenance", baseFields);
          throw new StagingApiError("MAINTENANCE", "Staging is under maintenance.", 503);
        }
        const contract = String(input.headers?.["x-contract-version"] || input.headers?.get?.("x-contract-version") || "");
        if (contract !== config.contractVersion) {
          audit.emit("contract_mismatch", baseFields);
          throw new StagingApiError("CONTRACT_MISMATCH", "Contract version is required.", 422);
        }
        const actor = await tokenVerifier.verify(input.headers?.authorization || input.headers?.Authorization || input.headers?.get?.("authorization"));
        const [baseRole, scenario] = actor.role.split("__", 2);
        const scopedActor = { ...actor, role: baseRole };
        if (scenario === "timeout") throw new StagingApiError("TIMEOUT", "Staging synthetic timeout", 504);
        if (scenario === "maintenance") throw new StagingApiError("MAINTENANCE", "Staging synthetic maintenance", 503);
        if (scenario === "validation_error") throw new StagingApiError("VALIDATION_ERROR", "Staging synthetic validation error", 422);
        const scope = resolveActorScope(scopedActor);
        const rateKey = `${actor.employeeId}:${Math.floor(now() / 60_000)}`;
        const count = (requestCounts.get(rateKey) || 0) + 1;
        requestCounts.set(rateKey, count);
        if (count > 120) throw new StagingApiError("RATE_LIMITED", "Rate limit exceeded.", 429);
        const period = validatePeriod(url.searchParams.get("period"));
        let storeId = null;
        if (url.pathname !== "/v1/store-sales/dashboard") {
          const match = url.pathname.match(STORE_PATH);
          if (!match) throw new StagingApiError("NOT_FOUND", "Endpoint was not found.", 404);
          storeId = validateStoreId(decodeURIComponent(match[1]));
        }
        const body = buildSyntheticProjection({ stores, scope, period, storeId, requestId });
        audit.emit(body.stores.length ? "api_success" : "projection_empty", {
          ...baseFields, actor_id: actor.employeeId, role: actor.role, scope_key: scope.key,
          store_id: storeId, status: 200, duration_ms: now() - started
        });
        return success(body, requestId);
      } catch (error) {
        const event = error?.status === 401 ? "session_invalid" : error?.status === 403 ? "access_denied" : error?.code === "TIMEOUT" ? "timeout" : "api_failure";
        audit.emit(event, { ...baseFields, status: Number(error?.status || 500), duration_ms: now() - started });
        return errorResponse(error, requestId);
      }
    }
  });
}

function success(body, requestId) {
  return {
    status: 200,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
      "x-request-id": requestId,
      "x-contract-version": "store-sales-projection-v1",
      "x-synthetic-data": "true"
    },
    body
  };
}
