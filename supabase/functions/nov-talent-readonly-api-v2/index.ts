// @ts-nocheck
import { buildTalentWorkspaceData } from "./workspace-domain.ts";
// supabase/functions/nov-talent-readonly-api-v2/domain.ts
var SUMMARY_FIELDS = Object.freeze([
  "contacts",
  "lineRegistrations",
  "salonTours",
  "interviews",
  "passed",
  "offers",
  "expectedJoiners"
]);
function isPlainRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
function normalizeFiscalYear(value) {
  const candidate = String(value || "current").trim();
  return /^(current|[0-9]{4})$/.test(candidate) ? candidate : null;
}
function validateSummary(value) {
  if (!isPlainRecord(value)) return null;
  if (Object.keys(value).length !== SUMMARY_FIELDS.length) return null;
  if (!SUMMARY_FIELDS.every((field) => Object.hasOwn(value, field))) return null;
  if (!SUMMARY_FIELDS.every((field) => Number.isInteger(value[field]) && Number(value[field]) >= 0)) return null;
  return Object.freeze(Object.fromEntries(SUMMARY_FIELDS.map((field) => [
    field,
    Number(value[field])
  ])));
}
function buildSuccessEnvelope({ fiscalYear, summary, generatedAt, requestId }) {
  return Object.freeze({
    ok: true,
    data: Object.freeze({
      config: Object.freeze({
        appName: "NOV Talent"
      }),
      fiscalYear,
      payloadMode: "summary",
      summary
    }),
    meta: Object.freeze({
      generatedAt,
      requestId,
      source: "nov-talent-readonly-api",
      version: "1"
    })
  });
}

// supabase/functions/nov-talent-readonly-api-v2/http.ts
var ALLOWED_ORIGIN = "https://ideanow-shift.github.io";
var FUNCTION_NAME_PATH = "/nov-talent-readonly-api-v2";
var FUNCTION_PATH = "/functions/v1/nov-talent-readonly-api-v2";
var SUMMARY_ROUTE = "/api/talent/v1/dashboard/summary";
var WORKSPACE_ROUTE = "/api/talent/v1/workspace";
var PROFILE_AUDIT_ROUTE = "/api/talent/v1/students/profile-audit";
var STAGING_SUPPLEMENT_AUDIT_ROUTE = "/api/talent/v1/staging/supplement-audit";
var MAX_BEARER_LENGTH = 4096;
function corsHeaders(origin) {
  const headers = new Headers({
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8",
    "Vary": "Origin"
  });
  if (origin === ALLOWED_ORIGIN) {
    headers.set("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
    headers.set("Access-Control-Allow-Headers", "authorization, content-type");
    headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
  }
  return headers;
}
function jsonResponse(status, body, origin) {
  return new Response(JSON.stringify(body), {
    status,
    headers: corsHeaders(origin)
  });
}
function safeFailure(status, safeCode, message, origin, requestId) {
  return jsonResponse(status, Object.freeze({
    ok: false,
    message,
    requestId,
    safeCode
  }), origin);
}
function readBearer(request) {
  const value = request.headers.get("Authorization") || "";
  if (value.length > MAX_BEARER_LENGTH + 7) return null;
  const match = /^Bearer ([A-Za-z0-9._~-]+)$/.exec(value);
  return match?.[1] || null;
}
async function handleTalentReadonlyRequest(request, dependencies) {
  const origin = request.headers.get("Origin") || "";
  const requestId = dependencies.createRequestId();
  if (origin !== ALLOWED_ORIGIN) {
    return safeFailure(403, "ORIGIN_NOT_ALLOWED", "Request origin is not allowed.", origin, requestId);
  }
  const url = new URL(request.url);
  const matchedRoute = [SUMMARY_ROUTE, WORKSPACE_ROUTE, PROFILE_AUDIT_ROUTE, STAGING_SUPPLEMENT_AUDIT_ROUTE].find((route) => (
    url.pathname === route
    || url.pathname === `${FUNCTION_NAME_PATH}${route}`
    || url.pathname === `${FUNCTION_PATH}${route}`
  ));
  if (!matchedRoute) {
    return safeFailure(404, "NOT_FOUND", "Requested resource was not found.", origin, requestId);
  }
  if (request.method === "OPTIONS") {
    const headers = corsHeaders(origin);
    headers.delete("Content-Type");
    return new Response(null, {
      status: 204,
      headers
    });
  }
  if (request.method !== "GET") {
    return safeFailure(405, "METHOD_NOT_ALLOWED", "Only GET is supported.", origin, requestId);
  }
  const bearer = readBearer(request);
  if (!bearer) {
    return safeFailure(401, "AUTH_REQUIRED", "Authentication is required.", origin, requestId);
  }
  let capability = null;
  try {
    capability = await dependencies.verifyHubSession(bearer);
  } catch {
    capability = null;
  }
  if (!capability) {
    return safeFailure(401, "AUTH_REQUIRED", "Authentication is required.", origin, requestId);
  }
  if (matchedRoute === WORKSPACE_ROUTE) {
    const fiscalYear = normalizeFiscalYear(url.searchParams.get("fiscalYear"));
    if (!fiscalYear) {
      return safeFailure(400, "INVALID_REQUEST", "Request parameters are invalid.", origin, requestId);
    }
    let workspace = null;
    try {
      workspace = await dependencies.readWorkspace(capability, fiscalYear);
    } catch {
      workspace = null;
    }
    if (!workspace) {
      return safeFailure(503, "NOT_READY", "Talent workspace is not ready.", origin, requestId);
    }
    return jsonResponse(200, Object.freeze({
      ok: true,
      data: workspace,
      meta: Object.freeze({
        generatedAt: dependencies.nowIso(),
        requestId,
        source: "nov-talent-readonly-api",
        version: "2"
      })
    }), origin);
  }
  if (matchedRoute === PROFILE_AUDIT_ROUTE) {
    const applicationNo = url.searchParams.get("applicationNo") || "";
    if (!/^NT-[0-9]{4}-[0-9]{6}$/.test(applicationNo)) {
      return safeFailure(400, "INVALID_REQUEST", "Request parameters are invalid.", origin, requestId);
    }
    let audit = null;
    try {
      audit = await dependencies.readProfileAudit(capability, applicationNo);
    } catch {
      audit = null;
    }
    if (!audit) {
      return safeFailure(503, "NOT_READY", "Talent profile history is not ready.", origin, requestId);
    }
    return jsonResponse(200, Object.freeze({
      ok: true,
      data: audit,
      meta: Object.freeze({
        generatedAt: dependencies.nowIso(),
        requestId,
        source: "nov-talent-readonly-api",
        version: "2"
      })
    }), origin);
  }
  if (matchedRoute === STAGING_SUPPLEMENT_AUDIT_ROUTE) {
    const stagingRecordId = url.searchParams.get("stagingRecordId") || "";
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(stagingRecordId)) {
      return safeFailure(400, "INVALID_REQUEST", "Request parameters are invalid.", origin, requestId);
    }
    let audit = null;
    try {
      audit = await dependencies.readStagingSupplementAudit(capability, stagingRecordId);
    } catch {
      audit = null;
    }
    if (!audit) {
      return safeFailure(503, "NOT_READY", "Talent staging history is not ready.", origin, requestId);
    }
    return jsonResponse(200, Object.freeze({
      ok: true,
      data: audit,
      meta: Object.freeze({
        generatedAt: dependencies.nowIso(),
        requestId,
        source: "nov-talent-readonly-api",
        version: "2"
      })
    }), origin);
  }
  const fiscalYear = normalizeFiscalYear(url.searchParams.get("fiscalYear"));
  if (!fiscalYear) {
    return safeFailure(400, "INVALID_REQUEST", "Request parameters are invalid.", origin, requestId);
  }
  let summary = null;
  try {
    summary = validateSummary(await dependencies.readSummary(capability, fiscalYear));
  } catch {
    summary = null;
  }
  if (!summary) {
    return safeFailure(503, "NOT_READY", "Talent service is not ready.", origin, requestId);
  }
  return jsonResponse(200, buildSuccessEnvelope({
    fiscalYear,
    summary,
    generatedAt: dependencies.nowIso(),
    requestId
  }), origin);
}
var TALENT_READONLY_HTTP_CONTRACT = Object.freeze({
  allowedOrigin: ALLOWED_ORIGIN,
  functionPath: FUNCTION_PATH,
  methods: Object.freeze([
    "GET",
    "OPTIONS"
  ]),
  routes: Object.freeze([SUMMARY_ROUTE, WORKSPACE_ROUTE, PROFILE_AUDIT_ROUTE, STAGING_SUPPLEMENT_AUDIT_ROUTE])
});

// supabase/functions/nov-talent-readonly-api-v2/session-verifier.ts
var REQUIRED_AUDIENCE = "nov_hub";
var REQUIRED_HEADER = Object.freeze({
  alg: "HS256",
  typ: "NOV-HUB-APP-SESSION",
  v: 1
});
var HEADER_KEYS = Object.freeze([
  "alg",
  "typ",
  "v"
]);
var PAYLOAD_KEYS = Object.freeze([
  "v",
  "sid",
  "sub",
  "aud",
  "auth_source",
  "iat",
  "exp",
  "role_version_checked_at"
]);
var UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
var BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/;
var CAPABILITY_BRAND = Symbol("verified-talent-session");
function decodeBase64UrlJson(segment) {
  if (!BASE64URL_PATTERN.test(segment) || segment.length % 4 === 1) return null;
  try {
    const normalized = segment.replaceAll("-", "+").replaceAll("_", "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    const value = JSON.parse(new TextDecoder("utf-8", {
      fatal: true
    }).decode(bytes));
    return value && typeof value === "object" && !Array.isArray(value) ? value : null;
  } catch {
    return null;
  }
}
function decodeBase64UrlBytes(segment) {
  if (!BASE64URL_PATTERN.test(segment) || segment.length % 4 === 1) return null;
  try {
    const normalized = segment.replaceAll("-", "+").replaceAll("_", "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    const binary = atob(padded);
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  } catch {
    return null;
  }
}
function hasExactKeys(value, keys) {
  const actual = Object.keys(value);
  return actual.length === keys.length && actual.every((key) => keys.includes(key));
}
function validHeader(value) {
  return Boolean(value) && hasExactKeys(value, HEADER_KEYS) && value.alg === REQUIRED_HEADER.alg && value.typ === REQUIRED_HEADER.typ && value.v === REQUIRED_HEADER.v;
}
function validPayload(value, nowSeconds) {
  if (!value || !hasExactKeys(value, PAYLOAD_KEYS)) return false;
  if (value.v !== 1 || value.aud !== REQUIRED_AUDIENCE || value.auth_source !== "hub_pin") return false;
  if (!UUID_PATTERN.test(String(value.sid || "")) || !UUID_PATTERN.test(String(value.sub || ""))) return false;
  const issuedAt = Number(value.iat);
  const expiresAt = Number(value.exp);
  const roleCheckedAt = Number(value.role_version_checked_at);
  return Number.isSafeInteger(issuedAt) && Number.isSafeInteger(expiresAt) && Number.isSafeInteger(roleCheckedAt) && issuedAt <= nowSeconds + 30 && roleCheckedAt <= nowSeconds + 30 && expiresAt > nowSeconds;
}
async function importVerificationKey(secret) {
  if (secret.trim().length < 32) return null;
  return await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), {
    name: "HMAC",
    hash: "SHA-256"
  }, false, [
    "verify"
  ]);
}
function createHubSessionVerifier({ signingSecret, nowSeconds = () => Math.floor(Date.now() / 1e3) }) {
  return Object.freeze({
    async verify(bearer) {
      try {
        const parts = String(bearer || "").split(".");
        if (parts.length !== 3 || parts.some((part) => !part)) return null;
        const header = decodeBase64UrlJson(parts[0]);
        const payload = decodeBase64UrlJson(parts[1]);
        const signature = decodeBase64UrlBytes(parts[2]);
        if (!validHeader(header) || !validPayload(payload, nowSeconds()) || signature?.byteLength !== 32) return null;
        const key = await importVerificationKey(signingSecret);
        if (!key) return null;
        const verified = await crypto.subtle.verify("HMAC", key, signature, new TextEncoder().encode(`${parts[0]}.${parts[1]}`));
        return verified ? Object.freeze({
          scope: "talent_readonly",
          employeeId: payload.sub,
          [CAPABILITY_BRAND]: true
        }) : null;
      } catch {
        return null;
      }
    }
  });
}
function isVerifiedTalentSessionCapability(value) {
  return Boolean(value) && typeof value === "object" && value[CAPABILITY_BRAND] === true
    && value.scope === "talent_readonly" && UUID_PATTERN.test(String(value.employeeId || ""));
}
var HUB_SESSION_VERIFIER_CONTRACT = Object.freeze({
  audience: REQUIRED_AUDIENCE,
  headerType: REQUIRED_HEADER.typ,
  algorithm: REQUIRED_HEADER.alg,
  output: "opaque_talent_readonly_capability"
});

// supabase/functions/nov-talent-readonly-api-v2/summary-provider.ts
var TALENT_SUMMARY_QUERY_CONTRACT = Object.freeze({
  kind: "aggregate_rpc",
  name: "get_nov_talent_dashboard_summary_v1",
  arguments: Object.freeze([
    "p_fiscal_year"
  ]),
  resultColumns: SUMMARY_FIELDS,
  resultCardinality: "exactly_one_aggregate_record"
});
function validateAggregateRows(value) {
  if (!Array.isArray(value) || value.length !== 1 || !value[0] || typeof value[0] !== "object" || Array.isArray(value[0])) return null;
  const record = value[0];
  if (Object.keys(record).length !== SUMMARY_FIELDS.length) return null;
  if (!SUMMARY_FIELDS.every((field) => Object.hasOwn(record, field))) return null;
  if (!SUMMARY_FIELDS.every((field) => Number.isInteger(record[field]) && Number(record[field]) >= 0)) return null;
  return Object.freeze(Object.fromEntries(SUMMARY_FIELDS.map((field) => [
    field,
    Number(record[field])
  ])));
}
function createTalentSummaryProvider(gateway) {
  return Object.freeze({
    async readSummary(capability, fiscalYear) {
      if (!isVerifiedTalentSessionCapability(capability)) return null;
      try {
        return validateAggregateRows(await gateway.executeAggregate({
          name: TALENT_SUMMARY_QUERY_CONTRACT.name,
          fiscalYear
        }));
      } catch {
        return null;
      }
    }
  });
}

// supabase/functions/nov-talent-readonly-api-v2/runtime-bindings.ts
var SIGNING_SECRET_NAME = "HUB_APP_SESSION_SIGNING_SECRET";
var AGGREGATE_RPC_NAME = "get_nov_talent_dashboard_summary_v1";
var WORKSPACE_RPC_NAME = "get_nov_talent_staging_workspace_v2";
var PROFILE_AUDIT_RPC_NAME = "get_nov_talent_student_profile_audit_v1";
var STAGING_SUPPLEMENT_AUDIT_RPC_NAME = "get_nov_talent_staging_supplement_audit_v1";
var PROFILE_CHANGE_FIELDS = new Set([
  "displayName", "kana", "school", "phone", "email", "preferredStore",
  "currentStatus", "nextActionAt", "offerDate", "expectedJoinDate", "plannedStore"
]);
function createTalentRuntimeDependencies(input) {
  let signingSecret = "";
  try {
    signingSecret = String(input.readSecret(SIGNING_SECRET_NAME) || "");
  } catch {
    signingSecret = "";
  }
  const verifier = createHubSessionVerifier({
    signingSecret,
    nowSeconds: input.nowSeconds
  });
  const provider = createTalentSummaryProvider({
    async executeAggregate(query) {
      try {
        return await input.executeAggregateRpc(query);
      } catch {
        return null;
      }
    }
  });
  return Object.freeze({
    async verifyHubSession(bearer) {
      return await verifier.verify(bearer);
    },
    async readSummary(capability, fiscalYear) {
      return await provider.readSummary(capability, fiscalYear);
    },
    async readWorkspace(capability, fiscalYear) {
      if (!isVerifiedTalentSessionCapability(capability)) return null;
      const year = Number.parseInt(fiscalYear, 10);
      if (year !== 2027) return null;
      const raw = await input.executeWorkspaceRpc({
        name: WORKSPACE_RPC_NAME,
        employeeId: capability.employeeId,
        fiscalYear: year
      });
      return buildTalentWorkspaceData(raw, fiscalYear);
    },
    async readProfileAudit(capability, applicationNo) {
      if (!isVerifiedTalentSessionCapability(capability)) return null;
      const raw = await input.executeProfileAuditRpc({
        name: PROFILE_AUDIT_RPC_NAME,
        employeeId: capability.employeeId,
        applicationNo
      });
      if (!Array.isArray(raw) || raw.length > 20) return null;
      const entries = [];
      for (const row of raw) {
        if (!row || typeof row !== "object" || Array.isArray(row)) return null;
        const action = String(row.action || "");
        const version = Number(row.profile_version);
        const occurredAt = String(row.occurred_at || "");
        if (!["CREATE", "UPDATE"].includes(action)
          || !Number.isInteger(version) || version < 1
          || !/^\d{4}-\d{2}-\d{2}T/.test(occurredAt)
          || !Array.isArray(row.changed_fields)
          || row.changed_fields.length < 1
          || row.changed_fields.length > 11
          || row.changed_fields.some((field) => !PROFILE_CHANGE_FIELDS.has(String(field)))) {
          return null;
        }
        entries.push(Object.freeze({
          action,
          changedFields: Object.freeze(row.changed_fields.map((field) => String(field))),
          profileVersion: version,
          occurredAt
        }));
      }
      return Object.freeze({ applicationNo, entries: Object.freeze(entries) });
    },
    async readStagingSupplementAudit(capability, stagingRecordId) {
      if (!isVerifiedTalentSessionCapability(capability)) return null;
      const raw = await input.executeStagingSupplementAuditRpc({
        name: STAGING_SUPPLEMENT_AUDIT_RPC_NAME,
        employeeId: capability.employeeId,
        stagingRecordId
      });
      if (!Array.isArray(raw) || raw.length > 20) return null;
      const entries = [];
      for (const row of raw) {
        if (!row || typeof row !== "object" || Array.isArray(row)) return null;
        const action = String(row.action || "");
        const version = Number(row.supplement_version);
        const occurredAt = String(row.occurred_at || "");
        if (!["CREATE", "UPDATE"].includes(action)
          || !Number.isInteger(version) || version < 1
          || !/^\d{4}-\d{2}-\d{2}T/.test(occurredAt)
          || !Array.isArray(row.changed_fields)
          || row.changed_fields.length < 1
          || row.changed_fields.length > 11
          || row.changed_fields.some((field) => !PROFILE_CHANGE_FIELDS.has(String(field)))) {
          return null;
        }
        entries.push(Object.freeze({
          action,
          changedFields: Object.freeze(row.changed_fields.map((field) => String(field))),
          supplementVersion: version,
          occurredAt
        }));
      }
      return Object.freeze({ stagingRecordId, entries: Object.freeze(entries) });
    },
    createRequestId: input.createRequestId,
    nowIso: input.nowIso
  });
}
var TALENT_RUNTIME_BINDING_CONTRACT = Object.freeze({
  signingSecretName: SIGNING_SECRET_NAME,
  aggregateRpcName: AGGREGATE_RPC_NAME,
  aggregateRpcRequestMax: 1,
  retryCount: 0,
  rawSecretOutput: false,
  rawDatabaseErrorOutput: false
});

// supabase/functions/nov-talent-readonly-api-v2/runtime-adapter.ts
var SIGNING_SECRET_NAME2 = "HUB_APP_SESSION_SIGNING_SECRET";
var SUPABASE_URL_NAME = "SUPABASE_URL";
var SUPABASE_SERVICE_ROLE_KEY_NAME = "SUPABASE_SERVICE_ROLE_KEY";
var AGGREGATE_RPC_NAME2 = "get_nov_talent_dashboard_summary_v1";
var WORKSPACE_RPC_NAME2 = "get_nov_talent_staging_workspace_v2";
var PROFILE_AUDIT_RPC_NAME2 = "get_nov_talent_student_profile_audit_v1";
var STAGING_SUPPLEMENT_AUDIT_RPC_NAME2 = "get_nov_talent_staging_supplement_audit_v1";
function createTalentRuntimeAdapter(environment, fetchImpl, clock = {
  nowIso: () => (/* @__PURE__ */ new Date()).toISOString(),
  nowSeconds: () => Math.floor(Date.now() / 1e3)
}) {
  return createTalentRuntimeDependencies({
    readSecret(name) {
      if (name !== SIGNING_SECRET_NAME2) return "";
      return environment.get(name) || "";
    },
    async executeAggregateRpc(input) {
      if (input.name !== AGGREGATE_RPC_NAME2) return null;
      const baseUrl = (environment.get(SUPABASE_URL_NAME) || "").replace(/\/+$/, "");
      const serviceKey = environment.get(SUPABASE_SERVICE_ROLE_KEY_NAME) || "";
      if (!baseUrl || !serviceKey) return null;
      try {
        const response = await fetchImpl(`${baseUrl}/rest/v1/rpc/${AGGREGATE_RPC_NAME2}`, {
          method: "POST",
          headers: {
            apikey: serviceKey,
            authorization: `Bearer ${serviceKey}`,
            "content-type": "application/json"
          },
          body: JSON.stringify({
            p_fiscal_year: input.fiscalYear
          })
        });
        if (!response.ok) return null;
        const value = await response.json();
        if (!Array.isArray(value) || value.length !== 1) return null;
        return value;
      } catch {
        return null;
      }
    },
    async executeWorkspaceRpc(input) {
      if (input.name !== WORKSPACE_RPC_NAME2) return null;
      const baseUrl = (environment.get(SUPABASE_URL_NAME) || "").replace(/\/+$/, "");
      const serviceKey = environment.get(SUPABASE_SERVICE_ROLE_KEY_NAME) || "";
      if (!baseUrl || !serviceKey) return null;
      try {
        const response = await fetchImpl(`${baseUrl}/rest/v1/rpc/${WORKSPACE_RPC_NAME2}`, {
          method: "POST",
          headers: {
            apikey: serviceKey,
            authorization: `Bearer ${serviceKey}`,
            "content-type": "application/json"
          },
          body: JSON.stringify({
            p_employee_id: input.employeeId,
            p_fiscal_year: input.fiscalYear
          })
        });
        if (!response.ok) return null;
        const value = await response.json();
        return value && typeof value === "object" && !Array.isArray(value) ? value : null;
      } catch {
        return null;
      }
    },
    async executeProfileAuditRpc(input) {
      if (input.name !== PROFILE_AUDIT_RPC_NAME2) return null;
      const baseUrl = (environment.get(SUPABASE_URL_NAME) || "").replace(/\/+$/, "");
      const serviceKey = environment.get(SUPABASE_SERVICE_ROLE_KEY_NAME) || "";
      if (!baseUrl || !serviceKey) return null;
      try {
        const response = await fetchImpl(`${baseUrl}/rest/v1/rpc/${PROFILE_AUDIT_RPC_NAME2}`, {
          method: "POST",
          headers: {
            apikey: serviceKey,
            authorization: `Bearer ${serviceKey}`,
            "content-type": "application/json"
          },
          body: JSON.stringify({
            p_employee_id: input.employeeId,
            p_application_no: input.applicationNo
          })
        });
        if (!response.ok) return null;
        const value = await response.json();
        return Array.isArray(value) ? value : null;
      } catch {
        return null;
      }
    },
    async executeStagingSupplementAuditRpc(input) {
      if (input.name !== STAGING_SUPPLEMENT_AUDIT_RPC_NAME2) return null;
      const baseUrl = (environment.get(SUPABASE_URL_NAME) || "").replace(/\/+$/, "");
      const serviceKey = environment.get(SUPABASE_SERVICE_ROLE_KEY_NAME) || "";
      if (!baseUrl || !serviceKey) return null;
      try {
        const response = await fetchImpl(`${baseUrl}/rest/v1/rpc/${STAGING_SUPPLEMENT_AUDIT_RPC_NAME2}`, {
          method: "POST",
          headers: {
            apikey: serviceKey,
            authorization: `Bearer ${serviceKey}`,
            "content-type": "application/json"
          },
          body: JSON.stringify({
            p_employee_id: input.employeeId,
            p_staging_record_id: input.stagingRecordId
          })
        });
        if (!response.ok) return null;
        const value = await response.json();
        return Array.isArray(value) ? value : null;
      } catch {
        return null;
      }
    },
    createRequestId: () => crypto.randomUUID(),
    nowIso: clock.nowIso,
    nowSeconds: clock.nowSeconds
  });
}
var TALENT_RUNTIME_ADAPTER_CONTRACT = Object.freeze({
  signingSecretName: SIGNING_SECRET_NAME2,
  secretPresenceOutput: "boolean_only",
  aggregateRpcName: AGGREGATE_RPC_NAME2,
  workspaceRpcName: WORKSPACE_RPC_NAME2,
  profileAuditRpcName: PROFILE_AUDIT_RPC_NAME2,
  stagingSupplementAuditRpcName: STAGING_SUPPLEMENT_AUDIT_RPC_NAME2,
  aggregateRpcRequestMax: 1,
  retryCount: 0,
  rawSecretOutput: false,
  rawDatabaseErrorOutput: false
});

// supabase/functions/nov-talent-readonly-api-v2/index.ts
var runtimeDependencies = createTalentRuntimeAdapter(Deno.env, fetch);
Deno.serve((request) => handleTalentReadonlyRequest(request, runtimeDependencies));
