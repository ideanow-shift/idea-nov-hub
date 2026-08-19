import { DbfRuntimeError, normalizeActionPayload, parseAction, toStagingRows } from "./domain.ts";
import { buildDbfPilotMonthPreview, DBF_PILOT_202606_CONTRACT } from "./pilot-preview.ts";
import {
  buildCorporateAccountingActualProjection,
  buildStoreMonthlyActualProjection,
  ConsumerReadError,
  resolveCorporateCompany,
  resolveOfficialOperatingStores,
} from "./consumer-read.ts";

type Json = Record<string, unknown>;
type Runtime = {
  hubApiUrl: string;
  supabaseUrl: string;
  serviceRoleKey: string;
  expectedProjectRef: string;
  runtimeImport: string;
  productionWrite: string;
  corporateAccountingExecution?: string;
  corporatePromotionManifestJson?: string;
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

async function readStoreMonthlyActualProjection(
  runtime: Runtime,
  token: string,
  selectedMonth: string,
) {
  const master = await readCanonicalMasterOptions(runtime, token);
  const stores = resolveOfficialOperatingStores(master);
  const companyIds = [...new Set(stores.map((store) => store.companyId))];
  const factGroups = await Promise.all(companyIds.map((companyId) => rpc(
    runtime,
    "dbf_store_monthly_actual_read_v1",
    {
      p_fiscal_month: `${selectedMonth}-01`,
      p_company_id: companyId,
      p_store_ids: stores.filter((store) => store.companyId === companyId).map((store) => store.rawId),
    },
  )));
  return buildStoreMonthlyActualProjection(selectedMonth, stores, factGroups.flat());
}

async function readCorporateAccountingActualProjection(
  runtime: Runtime,
  token: string,
  selectedMonth: string,
) {
  const master = await readCanonicalMasterOptions(runtime, token);
  const company = resolveCorporateCompany(master);
  const facts = await rpc(runtime, "dbf_corporate_accounting_actual_read_v1", {
    p_fiscal_month: `${selectedMonth}-01`,
    p_company_id: company.id,
  });
  return buildCorporateAccountingActualProjection(selectedMonth, company, facts);
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
    console.warn("DBF_RUNTIME_RPC_REJECTED", {
      rpc: name,
      status: result.status,
      dbCode: dbCode || "UNKNOWN",
    });
    if (result.status === 409 || dbCode === "23505" || dbCode === "40001") throw new DbfRuntimeError("VERSION_CONFLICT", 409);
    if (["PGRST202", "42883"].includes(dbCode)) throw new DbfRuntimeError("RUNTIME_RPC_UNAVAILABLE", 503);
    throw new DbfRuntimeError("RUNTIME_RPC_REJECTED", 400);
  }
  return body;
}

async function readPilotMonthPreview(runtime: Runtime, payload: any) {
  const fiscalMonth = String(payload.fiscalMonth || "").slice(0, 7);
  if (fiscalMonth !== DBF_PILOT_202606_CONTRACT.fiscalMonth) {
    throw new DbfRuntimeError("PILOT_MONTH_NOT_SUPPORTED", 404);
  }
  const history = await rpc(runtime, "dbf_import_history_v1", {
    p_fiscal_month: payload.fiscalMonth,
    p_fact_kind: null,
    p_limit: 200,
  });
  const items = Array.isArray(history?.items) ? history.items : [];
  const previews = [];
  // Keep the five bounded read-only preview calls deterministic. The Staging
  // PostgREST gateway may reject a burst of concurrent RPC calls even though
  // each individual batch preview is valid and independently authorized.
  for (const item of items) {
    previews.push(await rpc(runtime, "dbf_import_preview_v1", { p_batch_id: item.batchId }));
  }
  return buildDbfPilotMonthPreview(history, previews, payload.section);
}

function rpcRequest(action: string, payload: any, actorEmployeeId: string) {
  if (action === "dbfCorporateAccountingPromotionPreflightV1") {
    return ["dbf_corporate_accounting_promotion_preflight_v1", {}] as const;
  }
  if (action === "dbfAccountReviewInitializeV1") return ["dbf_account_review_initialize_v1", {
    p_actor_employee_id: actorEmployeeId, p_request_id: crypto.randomUUID(), p_company_id: payload.companyId,
    p_mapping_version: payload.mappingVersion, p_mapping_digest: payload.mappingDigest,
  }] as const;
  if (action === "dbfAccountReviewListV1") return ["dbf_account_review_list_v1", {
    p_company_id: payload.companyId, p_fiscal_month: `${payload.fiscalMonth}-01`,
  }] as const;
  if (action === "dbfAccountReviewDecideV1") return ["dbf_account_review_decide_v1", {
    p_actor_employee_id: actorEmployeeId, p_request_id: payload.requestId, p_candidate_id: payload.candidateId,
    p_decision: payload.decision, p_proposed_account_code: payload.proposedAccountCode,
    p_proposed_account_name: payload.proposedAccountName, p_account_category: payload.accountCategory,
    p_normal_balance: payload.normalBalance, p_parent_candidate_id: payload.parentCandidateId,
    p_hierarchy_level: payload.hierarchyLevel, p_row_semantics: payload.rowSemantics,
    p_is_postable: payload.isPostable, p_is_control_total: payload.isControlTotal,
  }] as const;
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

const CORPORATE_MANIFEST_ALLOWED_FIELDS = new Set([
  "manifestRef", "scopeCode", "idempotencyKey", "fiscalMonth", "companyId", "plBatchId", "bsBatchId",
  "sourceFileIds", "sourceFileDigests", "selectedRowDigest", "mappingVersion", "mappingDigest",
  "rowSemanticsDigest", "previewDigest", "controlTotalDigest", "approvalScopeDigest", "transactionPlanDigest",
  "expectedPlCandidateCount", "expectedBsCandidateCount", "expectedCanonicalBaseline", "expectedPostState",
]);

function assertCorporateAccountingExecutionEnabled(runtime: Runtime) {
  if (runtime.corporateAccountingExecution !== "ENABLED") {
    throw new DbfRuntimeError("CORPORATE_ACCOUNTING_EXECUTION_DISABLED", 503);
  }
}

function readCorporateManifestValue(runtime: Runtime, required: boolean) {
  const raw = String(runtime.corporatePromotionManifestJson || "").trim();
  if (!raw) {
    if (required) throw new DbfRuntimeError("TRUSTED_MANIFEST_UNAVAILABLE", 503);
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new DbfRuntimeError("TRUSTED_MANIFEST_INVALID", 503);
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new DbfRuntimeError("TRUSTED_MANIFEST_INVALID", 503);
  }
  const value = parsed as Record<string, unknown>;
  if (Object.keys(value).some((key) => !CORPORATE_MANIFEST_ALLOWED_FIELDS.has(key))) {
    throw new DbfRuntimeError("TRUSTED_MANIFEST_INVALID", 503);
  }
  return value;
}

function readOptionalCorporateManifestRef(runtime: Runtime) {
  const value = readCorporateManifestValue(runtime, false);
  if (value === null) return null;
  const trustedManifestRef = String(value.manifestRef || "").toLowerCase();
  if (!/^[0-9a-f]{64}$/u.test(trustedManifestRef) || value.scopeCode !== "CORPORATE_ACCOUNTING_ACTUAL_V1") {
    throw new DbfRuntimeError("TRUSTED_MANIFEST_INVALID", 503);
  }
  return trustedManifestRef;
}

function readRequiredTrustedCorporateManifest(runtime: Runtime, manifestRef: string, actorEmployeeId: string) {
  assertCorporateAccountingExecutionEnabled(runtime);
  const value = readCorporateManifestValue(runtime, true) as Record<string, unknown>;
  const trustedManifestRef = String(value.manifestRef || "").toLowerCase();
  if (!/^[0-9a-f]{64}$/u.test(trustedManifestRef) || trustedManifestRef !== manifestRef ||
      value.scopeCode !== "CORPORATE_ACCOUNTING_ACTUAL_V1") {
    throw new DbfRuntimeError("TRUSTED_MANIFEST_MISMATCH", 409);
  }
  return {
    p_actor_employee_id: actorEmployeeId,
    p_promotion_scope_id: value.scopeCode,
    p_idempotency_key: value.idempotencyKey,
    p_manifest_ref: trustedManifestRef,
    p_fiscal_month: value.fiscalMonth,
    p_company_id: value.companyId,
    p_pl_batch_id: value.plBatchId,
    p_bs_batch_id: value.bsBatchId,
    p_source_file_ids: value.sourceFileIds,
    p_source_file_digests: value.sourceFileDigests,
    p_selected_row_digest: value.selectedRowDigest,
    p_mapping_version: value.mappingVersion,
    p_mapping_digest: value.mappingDigest,
    p_row_semantics_digest: value.rowSemanticsDigest,
    p_preview_digest: value.previewDigest,
    p_control_total_digest: value.controlTotalDigest,
    p_approval_scope_digest: value.approvalScopeDigest,
    p_transaction_plan_digest: value.transactionPlanDigest,
    p_expected_pl_candidate_count: value.expectedPlCandidateCount,
    p_expected_bs_candidate_count: value.expectedBsCandidateCount,
    p_expected_canonical_baseline: value.expectedCanonicalBaseline,
    p_expected_post_state: value.expectedPostState,
  };
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
    if (action === "storeMonthlyActualProjectionV1") {
      const data = await readStoreMonthlyActualProjection(runtime, token, String(payload.selectedMonth));
      return response(200, {
        ok: true, schemaVersion: "dbf-phase1-consumer-read-projections-v1", action,
        runtimeImport: "ENABLED", productionWrite: "DISABLED", data,
      });
    }
    if (action === "dbfCorporateAccountingActualProjectionV1") {
      const data = await readCorporateAccountingActualProjection(runtime, token, String(payload.selectedMonth));
      return response(200, {
        ok: true, schemaVersion: "dbf-phase1-consumer-read-projections-v1", action,
        runtimeImport: "ENABLED", productionWrite: "DISABLED", data,
      });
    }
    if (action === "dbfCorporateAccountingPromotionPreflightV1") {
      const data = await rpc(runtime, "dbf_corporate_accounting_promotion_preflight_v1", {
        p_manifest_ref: readOptionalCorporateManifestRef(runtime),
      });
      return response(200, {
        ok: true, schemaVersion: "dbf-corporate-accounting-scoped-promotion-v1", action,
        runtimeImport: "ENABLED", productionWrite: "DISABLED", data,
      });
    }
    if (action === "dbfCorporateAccountingApproveV1") {
      const manifest = readRequiredTrustedCorporateManifest(runtime, String(payload.manifestRef), auth.actorEmployeeId);
      const data = await rpc(runtime, "dbf_corporate_accounting_approve_v1", {
        p_actor_employee_id: auth.actorEmployeeId,
        p_request_id: payload.requestId,
        p_manifest_ref: manifest.p_manifest_ref,
        p_owner_confirmation: payload.ownerConfirmation,
      });
      return response(200, {
        ok: true, schemaVersion: "dbf-corporate-accounting-scoped-promotion-v1", action,
        runtimeImport: "ENABLED", productionWrite: "DISABLED", data,
      });
    }
    if (action === "dbfCorporateAccountingPromoteV1") {
      const data = await rpc(runtime, "dbf_import_promote_corporate_accounting_v1",
        readRequiredTrustedCorporateManifest(runtime, String(payload.manifestRef), auth.actorEmployeeId));
      return response(200, {
        ok: true, schemaVersion: "dbf-corporate-accounting-scoped-promotion-v1", action,
        runtimeImport: "ENABLED", productionWrite: "DISABLED", data,
      });
    }
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
    if (action === "dbfPilotMonthPreviewV1") {
      const data = await readPilotMonthPreview(runtime, payload);
      return response(200, {
        ok: true,
        schemaVersion: "dbf-pilot-month-preview-v1",
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
    if (error instanceof ConsumerReadError) return fail(error.status, error.code);
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
    corporateAccountingExecution: Deno.env.get("DBF_CORPORATE_ACCOUNTING_EXECUTION") || "DISABLED",
    corporatePromotionManifestJson: Deno.env.get("DBF_CORPORATE_ACCOUNTING_MANIFEST_JSON") || "",
    fetchImpl: fetch,
  };
}

if (import.meta.main) Deno.serve((request) => handleDbfBusinessDataRequest(request, runtimeFromEnvironment()));
