import { DbfRuntimeError, normalizeActionPayload, parseAction, toStagingRows } from "./domain.ts";

type Json = Record<string, unknown>;
type Runtime = {
  hubApiUrl: string;
  supabaseUrl: string;
  serviceRoleKey: string;
  expectedProjectRef: string;
  runtimeImport: string;
  productionWrite: string;
  fetchImpl: typeof fetch;
};

const DEFAULT_STAGING_REF = "zgkoofphhivesclehrom";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const MAX_BODY_BYTES = 8_000_000;

function response(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

function fail(status: number, code: string) {
  return response(status, { ok: false, code, requestId: crypto.randomUUID() });
}

function assertRuntimeBoundary(runtime: Runtime) {
  const hostname = new URL(runtime.supabaseUrl).hostname;
  if (runtime.expectedProjectRef !== DEFAULT_STAGING_REF || hostname !== `${DEFAULT_STAGING_REF}.supabase.co`) {
    throw new DbfRuntimeError("STAGING_TARGET_MISMATCH", 503);
  }
  if (runtime.productionWrite !== "DISABLED") throw new DbfRuntimeError("PRODUCTION_WRITE_GATE_FAILED", 503);
  if (runtime.runtimeImport !== "ENABLED") throw new DbfRuntimeError("RUNTIME_IMPORT_DISABLED", 503);
}

async function readBody(request: Request) {
  const raw = await request.arrayBuffer();
  if (raw.byteLength < 2 || raw.byteLength > MAX_BODY_BYTES) throw new DbfRuntimeError("REQUEST_SIZE_INVALID", 413);
  try {
    const parsed = JSON.parse(new TextDecoder().decode(raw));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("shape");
    return parsed as Json;
  } catch {
    throw new DbfRuntimeError("INVALID_JSON");
  }
}

function bearer(request: Request) {
  const match = /^Bearer ([A-Za-z0-9._~-]{20,4096})$/u.exec(request.headers.get("authorization") || "");
  if (!match) throw new DbfRuntimeError("AUTH_REQUIRED", 401);
  return match[1];
}

async function callHub(runtime: Runtime, token: string, action: string, payload: Json) {
  const result = await runtime.fetchImpl(runtime.hubApiUrl, {
    method: "POST",
    redirect: "error",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      action,
      token,
      payload: { authType: "dbf_staging_session", ...payload },
    }),
  });
  if (result.status === 401) throw new DbfRuntimeError("AUTH_REQUIRED", 401);
  if (result.status === 403) throw new DbfRuntimeError("FORBIDDEN", 403);
  if (result.status === 400) throw new DbfRuntimeError("CANONICAL_MASTER_REJECTED", 400);
  if (!result.ok) throw new DbfRuntimeError("AUTH_BACKEND_UNAVAILABLE", 503);
  return await result.json().catch(() => null);
}

async function authorize(runtime: Runtime, token: string) {
  const envelope = await callHub(runtime, token, "dbfBusinessDataAdminAuthorizeV1", {});
  const actorEmployeeId = String(envelope?.data?.actorEmployeeId || "");
  if (envelope?.ok !== true || envelope?.data?.capability?.businessDataAdmin !== true || !UUID.test(actorEmployeeId)) {
    throw new DbfRuntimeError("FORBIDDEN", 403);
  }
  return { actorEmployeeId: actorEmployeeId.toLowerCase(), scope: envelope.data.scope || "none" };
}

async function verifyCanonicalMapping(runtime: Runtime, token: string, payload: any) {
  const envelope = await callHub(runtime, token, "dbfCanonicalMasterVerifyV1", {
    entityType: payload.entityType,
    sourceKey: payload.sourceKey,
    canonicalId: payload.canonicalId,
    companyCanonicalId: payload.companyCanonicalId,
  });
  const canonicalId = String(envelope?.data?.canonicalId || "").toLowerCase();
  const evidenceSha256 = String(envelope?.data?.canonicalEvidenceSha256 || "").toLowerCase();
  if (envelope?.ok !== true || canonicalId !== payload.canonicalId || !/^[0-9a-f]{64}$/u.test(evidenceSha256)) {
    throw new DbfRuntimeError("CANONICAL_MAPPING_REJECTED", 400);
  }
  return evidenceSha256;
}

async function verifyCanonicalBindings(runtime: Runtime, token: string, rows: Array<Record<string, unknown>>) {
  const byKey = new Map<string, { companyId: string; storeId: string | null }>();
  for (const row of rows) {
    const companyId = String(row.companyId || "").toLowerCase();
    const storeId = row.storeId ? String(row.storeId).toLowerCase() : null;
    byKey.set(`${companyId}:${storeId || ""}`, { companyId, storeId });
  }
  const envelope = await callHub(runtime, token, "dbfCanonicalMasterValidateBindingsV1", {
    bindings: [...byKey.values()],
  });
  if (envelope?.ok !== true || envelope?.data?.valid !== true || Number(envelope?.data?.bindingCount) !== byKey.size) {
    throw new DbfRuntimeError("CANONICAL_BINDING_REJECTED", 400);
  }
}

async function readCanonicalMasterOptions(runtime: Runtime, token: string) {
  const envelope = await callHub(runtime, token, "dbfCanonicalMasterOptionsV1", {});
  if (envelope?.ok !== true || !Array.isArray(envelope?.data?.companies) || !Array.isArray(envelope?.data?.stores)) {
    throw new DbfRuntimeError("CANONICAL_MASTER_OPTIONS_UNAVAILABLE", 503);
  }
  return envelope.data;
}

async function rpc(runtime: Runtime, name: string, payload: Json) {
  const result = await runtime.fetchImpl(new URL(`/rest/v1/rpc/${name}`, runtime.supabaseUrl), {
    method: "POST",
    redirect: "error",
    headers: {
      apikey: runtime.serviceRoleKey,
      authorization: `Bearer ${runtime.serviceRoleKey}`,
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify(payload),
  });
  const body = await result.json().catch(() => null);
  if (!result.ok) {
    const dbCode = String(body?.code || "");
    if (result.status === 409 || dbCode === "23505" || dbCode === "40001") throw new DbfRuntimeError("VERSION_CONFLICT", 409);
    if (["PGRST202", "42883"].includes(dbCode)) throw new DbfRuntimeError("RUNTIME_RPC_UNAVAILABLE", 503);
    throw new DbfRuntimeError("RUNTIME_RPC_REJECTED", 400);
  }
  return body;
}

function rpcRequest(action: string, payload: any, actorEmployeeId: string) {
  if (action === "dbfImportStartV1") return ["dbf_import_start_v1", {
    p_actor_employee_id: actorEmployeeId,
    p_file: payload.file,
    p_fact_kind: payload.factKind,
    p_fiscal_month: payload.fiscalMonth,
    p_source_type: payload.sourceType,
    p_source_system: payload.sourceSystem,
    p_raw_rows: payload.rawRows,
    p_correction_of_batch_id: payload.correctionOfBatchId,
    p_correction_reason: payload.correctionReason,
  }] as const;
  if (action === "dbfImportResolveMappingsV1") return ["dbf_import_resolve_mappings_v1", {
    p_source_system: payload.sourceSystem, p_requests: payload.requests,
  }] as const;
  if (action === "dbfImportQuarantineMappingsV1") return ["dbf_import_quarantine_mappings_v1", {
    p_actor_employee_id: actorEmployeeId, p_batch_id: payload.batchId,
    p_source_system: payload.sourceSystem, p_mappings: payload.mappings,
  }] as const;
  if (action === "dbfImportConfirmMappingV1") return ["dbf_import_confirm_mapping_v1", {
    p_actor_employee_id: actorEmployeeId, p_batch_id: payload.batchId,
    p_source_system: payload.sourceSystem, p_entity_type: payload.entityType,
    p_source_key: payload.sourceKey, p_canonical_id: payload.canonicalId,
    p_canonical_evidence_sha256: payload.canonicalEvidenceSha256,
  }] as const;
  if (action === "dbfImportValidateV1") return ["dbf_import_stage_v1", {
    p_actor_employee_id: actorEmployeeId, p_batch_id: payload.batchId,
    p_fact_kind: payload.factKind, p_fiscal_month: payload.fiscalMonth,
    p_parser_receipt: payload.parserReceipt, p_rows: toStagingRows(payload.rows),
    p_warning_codes: payload.warnings,
  }] as const;
  if (action === "dbfImportPreviewV1") return ["dbf_import_preview_v1", { p_batch_id: payload.batchId }] as const;
  if (action === "dbfImportApproveV1") return ["dbf_import_approve_v1", {
    p_actor_employee_id: actorEmployeeId, p_batch_id: payload.batchId,
  }] as const;
  if (action === "dbfImportPromoteV1") return ["dbf_import_promote_v1", {
    p_actor_employee_id: actorEmployeeId, p_batch_id: payload.batchId,
  }] as const;
  return ["dbf_import_history_v1", {
    p_fiscal_month: payload.fiscalMonth, p_fact_kind: payload.factKind, p_limit: payload.limit,
  }] as const;
}

export async function handleDbfBusinessDataRequest(request: Request, runtime: Runtime) {
  if (request.method !== "POST") return fail(405, "METHOD_NOT_ALLOWED");
  try {
    assertRuntimeBoundary(runtime);
    const token = bearer(request);
    const body = await readBody(request);
    const action = parseAction(body.action);
    if (Object.keys(body).some((key) => !new Set(["action", "payload"]).has(key))) throw new DbfRuntimeError("UNEXPECTED_FIELD");
    const payload = normalizeActionPayload(action, body.payload);
    const auth = await authorize(runtime, token);
    if (action === "dbfImportMasterOptionsV1") {
      const data = await readCanonicalMasterOptions(runtime, token);
      return response(200, {
        ok: true,
        schemaVersion: "dbf-business-data-import-runtime-v1",
        action,
        runtimeImport: "ENABLED",
        productionWrite: "DISABLED",
        data,
      });
    }
    let trustedPayload: any = payload;
    if (action === "dbfImportConfirmMappingV1") {
      trustedPayload = {
        ...payload,
        canonicalEvidenceSha256: await verifyCanonicalMapping(runtime, token, payload),
      };
    }
    if (action === "dbfImportValidateV1") {
      await verifyCanonicalBindings(runtime, token, payload.rows as Array<Record<string, unknown>>);
    }
    const [rpcName, rpcPayload] = rpcRequest(action, trustedPayload, auth.actorEmployeeId);
    const data = await rpc(runtime, rpcName, rpcPayload);
    return response(200, {
      ok: true,
      schemaVersion: "dbf-business-data-import-runtime-v1",
      action,
      runtimeImport: "ENABLED",
      productionWrite: "DISABLED",
      data,
    });
  } catch (error) {
    if (error instanceof DbfRuntimeError) return fail(error.status, error.code);
    return fail(500, "INTERNAL_ERROR");
  }
}

function runtimeFromEnvironment(): Runtime {
  return {
    hubApiUrl: Deno.env.get("NOV_HUB_API_URL") || "",
    supabaseUrl: Deno.env.get("SUPABASE_URL") || "",
    serviceRoleKey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
    expectedProjectRef: Deno.env.get("DBF_EXPECTED_PROJECT_REF") || "",
    runtimeImport: Deno.env.get("DBF_RUNTIME_IMPORT") || "DISABLED",
    productionWrite: Deno.env.get("DBF_PRODUCTION_WRITE") || "DISABLED",
    fetchImpl: fetch,
  };
}

if (import.meta.main) Deno.serve((request) => handleDbfBusinessDataRequest(request, runtimeFromEnvironment()));
