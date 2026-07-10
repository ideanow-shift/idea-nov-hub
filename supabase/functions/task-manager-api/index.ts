import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

type JsonRecord = Record<string, unknown>;

type StaffDirectoryRow = {
  id: string | null;
  employee_id: string | null;
  name: string | null;
  company: string | null;
  store: string | null;
  department: string | null;
  position: string | null;
  job_type: string | null;
  status: string | null;
  is_active: boolean | null;
  role: string | null;
};

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-task-manager-api-token, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const SUPABASE_URL = (Deno.env.get("SUPABASE_URL") || "").replace(/\/+$/, "");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const TASK_MANAGER_API_TOKEN = Deno.env.get("TASK_MANAGER_API_TOKEN") || "";

class TaskManagerApiError extends Error {
  code: string;
  status: number;

  constructor(code: string, status = 400) {
    super(code);
    this.code = code;
    this.status = status;
  }
}

function jsonResponse(body: JsonRecord, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...CORS_HEADERS,
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

function publicMessage(code: string): string {
  const messages: Record<string, string> = {
    METHOD_NOT_ALLOWED: "Method is not allowed.",
    INVALID_JSON: "Request JSON is invalid.",
    TOKEN_MISSING: "Task Manager API token is missing.",
    TOKEN_INVALID: "Task Manager API token is invalid.",
    SETUP_MISSING: "Task Manager API setup is incomplete.",
    INVALID_ACTION: "Action is invalid.",
    INVALID_REQUEST_FIELD: "Request contains an unsupported field.",
    INVALID_INCLUDE_INACTIVE: "includeInactive must be boolean.",
    INVALID_LIMIT: "limit must be an integer between 1 and 1000.",
    RPC_FAILED: "Staff directory request failed.",
  };
  return messages[code] || "Task Manager API request failed.";
}

function safeError(error: unknown): Response {
  if (error instanceof TaskManagerApiError) {
    return jsonResponse({ ok: false, code: error.code, message: publicMessage(error.code) }, error.status);
  }
  return jsonResponse({ ok: false, code: "RPC_FAILED", message: publicMessage("RPC_FAILED") }, 500);
}

function assertSetup(): void {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !TASK_MANAGER_API_TOKEN) {
    throw new TaskManagerApiError("SETUP_MISSING", 500);
  }
}

function getBearerToken(request: Request): string {
  const header = request.headers.get("authorization") || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : "";
}

function validateApiToken(request: Request): void {
  const token = getBearerToken(request) || (request.headers.get("x-task-manager-api-token") || "").trim();
  if (!token) throw new TaskManagerApiError("TOKEN_MISSING", 401);
  if (token !== TASK_MANAGER_API_TOKEN) throw new TaskManagerApiError("TOKEN_INVALID", 401);
}

async function readPayload(request: Request): Promise<JsonRecord> {
  if (request.method === "GET") {
    return Object.fromEntries(new URL(request.url).searchParams.entries());
  }
  if (request.method !== "POST") {
    throw new TaskManagerApiError("METHOD_NOT_ALLOWED", 405);
  }
  const contentType = request.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    return {};
  }
  try {
    const parsed = await request.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new TaskManagerApiError("INVALID_JSON", 400);
    }
    return parsed as JsonRecord;
  } catch (error) {
    if (error instanceof TaskManagerApiError) throw error;
    throw new TaskManagerApiError("INVALID_JSON", 400);
  }
}

function assertAllowedFields(payload: JsonRecord): void {
  const allowed = new Set(["action", "includeInactive", "limit"]);
  for (const key of Object.keys(payload)) {
    if (!allowed.has(key)) throw new TaskManagerApiError("INVALID_REQUEST_FIELD", 400);
  }
}

function normalizeAction(request: Request, payload: JsonRecord): string {
  const pathTail = new URL(request.url).pathname.split("/").filter(Boolean).pop() || "";
  const pathAction = pathTail === "staff-directory" ? "staffDirectory" : "";
  return String(payload.action || pathAction || "").trim();
}

function normalizeIncludeInactive(value: unknown): boolean {
  if (value === undefined || value === null || value === "") return false;
  if (value === true || value === false) return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") return true;
    if (normalized === "false") return false;
  }
  throw new TaskManagerApiError("INVALID_INCLUDE_INACTIVE", 400);
}

function normalizeLimit(value: unknown): number {
  if (value === undefined || value === null || value === "") return 500;
  const limit = typeof value === "number" ? value : Number(String(value).trim());
  if (!Number.isInteger(limit) || limit < 1 || limit > 1000) {
    throw new TaskManagerApiError("INVALID_LIMIT", 400);
  }
  return limit;
}

function sanitizeStaffRow(row: Record<string, unknown>): StaffDirectoryRow {
  return {
    id: row.id == null ? null : String(row.id),
    employee_id: row.employee_id == null ? null : String(row.employee_id),
    name: row.name == null ? null : String(row.name),
    company: row.company == null ? null : String(row.company),
    store: row.store == null ? null : String(row.store),
    department: row.department == null ? null : String(row.department),
    position: row.position == null ? null : String(row.position),
    job_type: row.job_type == null ? null : String(row.job_type),
    status: row.status == null ? null : String(row.status),
    is_active: typeof row.is_active === "boolean" ? row.is_active : null,
    role: row.role == null ? null : String(row.role),
  };
}

async function handleStaffDirectory(request: Request): Promise<Response> {
  validateApiToken(request);
  assertSetup();

  const payload = await readPayload(request);
  assertAllowedFields(payload);

  const action = normalizeAction(request, payload);
  if (action !== "staffDirectory") throw new TaskManagerApiError("INVALID_ACTION", 400);

  const includeInactive = normalizeIncludeInactive(payload.includeInactive);
  const limit = normalizeLimit(payload.limit);

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const { data, error } = await supabase.rpc("task_manager_staff_directory", {
    p_include_inactive: includeInactive,
    p_limit: limit,
  });

  if (error) throw new TaskManagerApiError("RPC_FAILED", 502);

  const rows = Array.isArray(data) ? data : [];
  const staff = rows.map((row) => sanitizeStaffRow(row as Record<string, unknown>));

  return jsonResponse({
    ok: true,
    staff,
    meta: {
      source: "core_rpc",
      count: staff.length,
      includeInactive,
    },
  });
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  try {
    return await handleStaffDirectory(request);
  } catch (error) {
    return safeError(error);
  }
});
