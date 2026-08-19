import { restoreDbfStagingSession } from "../js/dbf-staging-session-handoff-candidate.js";

const ENDPOINT = "/api/dbf/import";

function hex(bytes) {
  return [...new Uint8Array(bytes)].map((value) => value.toString(16).padStart(2, "0")).join("");
}

export async function sha256Bytes(value, cryptoImpl = globalThis.crypto) {
  const bytes = value instanceof ArrayBuffer ? value : new TextEncoder().encode(String(value));
  return hex(await cryptoImpl.subtle.digest("SHA-256", bytes));
}

export function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export async function buildDbfRawRows(rows, cryptoImpl = globalThis.crypto) {
  return await Promise.all((Array.isArray(rows) ? rows : []).map(async (payload, index) => ({
    sourceRowNumber: index + 1,
    payload,
    payloadSha256: await sha256Bytes(stableJson(payload), cryptoImpl),
  })));
}

export async function buildDbfSourceFile(file, cryptoImpl = globalThis.crypto) {
  const bytes = await file.arrayBuffer();
  return {
    sha256: await sha256Bytes(bytes, cryptoImpl),
    byteSize: bytes.byteLength,
    originalFileName: String(file.name || ""),
    mediaType: String(file.type || "application/octet-stream"),
  };
}

export async function buildDbfSourceArtifact(artifact, cryptoImpl = globalThis.crypto) {
  const content = String(artifact?.content || "");
  const bytes = new TextEncoder().encode(content);
  return {
    sha256: await sha256Bytes(bytes, cryptoImpl),
    byteSize: bytes.byteLength,
    originalFileName: String(artifact?.name || "dbf-manual-input.csv"),
    mediaType: String(artifact?.mediaType || "text/csv;charset=utf-8"),
  };
}

export async function callDbfImportRuntime(action, payload, options = {}) {
  const session = options.session || restoreDbfStagingSession();
  if (!session?.sessionToken || session?.capability?.businessDataAdmin !== true) {
    const error = new Error("DBF_STAGING_SESSION_REQUIRED");
    error.status = 401;
    throw error;
  }
  const response = await (options.fetchImpl || fetch)(ENDPOINT, {
    method: "POST",
    credentials: "same-origin",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${session.sessionToken}`,
    },
    body: JSON.stringify({ action, payload }),
  });
  const body = await response.json().catch(() => ({ code: "DBF_RUNTIME_INVALID_RESPONSE" }));
  if (!response.ok || body?.ok !== true) {
    const error = new Error(String(body?.code || "DBF_RUNTIME_REQUEST_FAILED"));
    error.status = response.status;
    error.requestId = body?.requestId || null;
    throw error;
  }
  return body.data;
}

export const DBF_IMPORT_RUNTIME = Object.freeze({
  masterOptions: (options) => callDbfImportRuntime("dbfImportMasterOptionsV1", {}, options),
  start: (payload, options) => callDbfImportRuntime("dbfImportStartV1", payload, options),
  resolveMappings: (payload, options) => callDbfImportRuntime("dbfImportResolveMappingsV1", payload, options),
  quarantineMappings: (payload, options) => callDbfImportRuntime("dbfImportQuarantineMappingsV1", payload, options),
  confirmMapping: (payload, options) => callDbfImportRuntime("dbfImportConfirmMappingV1", payload, options),
  validate: (payload, options) => callDbfImportRuntime("dbfImportValidateV1", payload, options),
  preview: (batchId, options) => callDbfImportRuntime("dbfImportPreviewV1", { batchId }, options),
  approve: (batchId, options) => callDbfImportRuntime("dbfImportApproveV1", { batchId, ownerConfirmation: true }, options),
  promote: (batchId, options) => callDbfImportRuntime("dbfImportPromoteV1", { batchId }, options),
  history: (payload = {}, options) => callDbfImportRuntime("dbfImportHistoryV1", payload, options),
  pilotPreview: (payload, options) => callDbfImportRuntime("dbfPilotMonthPreviewV1", payload, options),
  accountReviewInitialize: (payload, options) => callDbfImportRuntime("dbfAccountReviewInitializeV1", payload, options),
  accountReviewList: (payload, options) => callDbfImportRuntime("dbfAccountReviewListV1", payload, options),
  accountReviewDecide: (payload, options) => callDbfImportRuntime("dbfAccountReviewDecideV1", payload, options),
  corporatePromotionPreflight: (options) => callDbfImportRuntime("dbfCorporateAccountingPromotionPreflightV1", {}, options),
  corporateActualProjection: (selectedMonth, options) => callDbfImportRuntime("dbfCorporateAccountingActualProjectionV1", { selectedMonth }, options),
  storeMonthlyActualProjection: (selectedMonth, options) => callDbfImportRuntime("storeMonthlyActualProjectionV1", { selectedMonth }, options),
});
