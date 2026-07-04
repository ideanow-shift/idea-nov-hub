const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const FIREBASE_API_KEY_FALLBACK = "AIzaSyBJAPJbAG_SdFmJqO0dIKh8v4Sd0tI0Vkc";
const SUPABASE_URL = (Deno.env.get("SUPABASE_URL") || "").replace(/\/+$/, "");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const PIN_HASH_PEPPER = Deno.env.get("PIN_HASH_PEPPER") || "";
const FIREBASE_API_KEY = Deno.env.get("FIREBASE_API_KEY") || FIREBASE_API_KEY_FALLBACK;
const APP_ROLE_GROUPS: Record<string, string[]> = {
  idea_link: ["idea_link.staff", "idea_link.manager", "idea_link.admin"],
};
const EMPLOYEE_PROFILE_IMAGE_BUCKET = "employee-profile-images";
const MAX_PROFILE_IMAGE_BYTES = 5 * 1024 * 1024;
const EMPLOYMENT_TYPE_ALIASES: Record<string, string> = {
  "パート": "パート・アルバイト",
  "アルバイト": "パート・アルバイト",
  "レセプション": "パート・アルバイト",
  "レセプションパート": "パート・アルバイト",
};
const EMPLOYMENT_STATUS_ALIASES: Record<string, string> = {
  "産休": "休職",
  "育休": "休職",
  "産休・育休": "休職",
  "傷病": "休職",
  "介護": "休職",
};
const LEAVE_TYPE_ALIASES: Record<string, string> = {
  "休職": "",
  "産休・育休": "",
};
let bootstrapRpcDisabledUntil = 0;

const FORBIDDEN_EMPLOYEE_ATTRIBUTE_LABELS = new Set(["会長夫人", "創業者夫人", "夫人"]);
const FORMAL_EMPLOYEE_POSITION_LABELS = new Set([
  "相談役",
  "会長",
  "社長",
  "副社長",
  "取締役",
  "執行役員",
  "部長",
  "課長",
  "係長",
  "エリアマネージャー",
  "店長",
  "店長見習い",
  "副店長",
  "FCオーナー",
  "FCオーナー見習い",
  "一般スタッフ",
]);

type JsonRecord = Record<string, unknown>;

class PortalError extends Error {
  code: string;
  status: number;
  detail: string;

  constructor(code: string, message: string, status = 400, detail = "") {
    super(message);
    this.code = code;
    this.status = status;
    this.detail = detail;
  }
}

function jsonResponse(data: JsonRecord, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...CORS_HEADERS,
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

function publicMessage(code: string) {
  const messages: Record<string, string> = {
    TOKEN_MISSING: "認証情報がありません。もう一度ログインしてください。",
    TOKEN_VERIFICATION_FAILED: "ログイン情報を確認できませんでした。",
    TOKEN_EMAIL_MISSING: "Googleアカウントのメールアドレスを確認できませんでした。",
    SETUP_MISSING: "Supabase Edge Functionの設定が不足しています。",
    ACCESS_DENIED: "このアカウントは社内ポータルの利用権限がありません。管理者へお問い合わせください。",
    INVALID_REQUEST: "APIリクエストが正しくありません。",
    MASTER_ADMIN_DENIED: "マスタ管理を利用する権限がありません。",
    DUPLICATE_LOGIN_EMAIL: "同じログインメールが別の社員に設定されています。",
    DUPLICATE_EMPLOYEE_ID: "同じ社員番号がすでに存在します。",
    FIREBASE_UID_DUPLICATED: "このFirebase UIDはすでに別の社員に紐付いています。",
    ROLE_NOT_FOUND: "必要な権限ロールが見つかりません。",
    NOT_FOUND: "対象データが見つかりません。",
    SUPABASE_REQUEST_FAILED: "Supabaseとの通信に失敗しました。",
    PIN_CHANGE_FAILED: "PIN変更に失敗しました。",
  };
  return messages[code] || "サーバー処理に失敗しました。";
}

function sanitizeErrorDetail(detail: unknown) {
  return String(detail || "")
    .replace(/AIza[0-9A-Za-z_-]+/g, "[API_KEY]")
    .replace(/[A-Za-z0-9_-]{30,}/g, "[REDACTED]")
    .slice(0, 240);
}

function normalizeEmail(value: unknown) {
  const text = String(value || "").trim().toLowerCase();
  const match = text.match(/[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+/);
  return match ? match[0] : "";
}

function normalizeList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => String(item || "").trim()).filter(Boolean);
  return String(value || "").split(/[,、\n]/).map((item) => item.trim()).filter(Boolean);
}

function uniqueStrings(values: unknown[]) {
  return values.map((value) => String(value || "").trim()).filter((value, index, list) => value && list.indexOf(value) === index);
}

function assertSetup() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new PortalError("SETUP_MISSING", "SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing.", 500);
  }
}

function buildQuery(query: Record<string, unknown> = {}) {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value) !== "") params.set(key, String(value));
  });
  const text = params.toString();
  return text ? `?${text}` : "";
}

function normalizeEmploymentType(value: unknown) {
  const normalized = String(value || "").trim();
  return EMPLOYMENT_TYPE_ALIASES[normalized] || normalized;
}

function normalizeEmploymentStatus(value: unknown) {
  const normalized = String(value || "").trim();
  return EMPLOYMENT_STATUS_ALIASES[normalized] || normalized;
}

function normalizeLeaveType(value: unknown) {
  const normalized = String(value || "").trim();
  return Object.prototype.hasOwnProperty.call(LEAVE_TYPE_ALIASES, normalized)
    ? LEAVE_TYPE_ALIASES[normalized]
    : normalized;
}

function sanitizeStorageFileName(value: unknown) {
  const name = String(value || "profile-image").trim().toLowerCase();
  const extension = name.match(/\.(jpe?g|png|webp)$/)?.[1] || "";
  const base = name
    .replace(/\.[^.]+$/u, "")
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "profile-image";
  return extension ? `${base}.${extension === "jpeg" ? "jpg" : extension}` : base;
}

function parseBase64ImagePayload(payload: JsonRecord) {
  const contentType = String(payload.contentType || "").toLowerCase();
  if (!["image/jpeg", "image/png", "image/webp"].includes(contentType)) {
    throw new PortalError("INVALID_REQUEST", "Profile image must be jpeg, png, or webp.", 400);
  }
  const base64Text = String(payload.base64 || payload.dataUrl || "")
    .replace(/^data:image\/[a-z0-9.+-]+;base64,/i, "")
    .replace(/\s+/g, "");
  if (!base64Text) throw new PortalError("INVALID_REQUEST", "Profile image data is required.", 400);
  const binary = atob(base64Text);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  if (!bytes.length || bytes.length > MAX_PROFILE_IMAGE_BYTES) {
    throw new PortalError("INVALID_REQUEST", "Profile image must be 5MB or less.", 400);
  }
  return bytes;
}

async function uploadStorageObject(bucket: string, storagePath: string, bytes: Uint8Array, contentType: string) {
  assertSetup();
  const encodedPath = storagePath.split("/").map(encodeURIComponent).join("/");
  const response = await fetch(`${SUPABASE_URL}/storage/v1/object/${encodeURIComponent(bucket)}/${encodedPath}`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": contentType,
      "x-upsert": "true",
    },
    body: bytes,
  });
  const text = await response.text();
  if (!response.ok) {
    throw new PortalError("SUPABASE_REQUEST_FAILED", `Storage upload HTTP ${response.status}`, 502, text);
  }
}

async function createStorageSignedUrl(bucket: string, storagePath: string, expiresIn = 3600) {
  if (!storagePath) return "";
  assertSetup();
  const encodedPath = storagePath.split("/").map(encodeURIComponent).join("/");
  const response = await fetch(`${SUPABASE_URL}/storage/v1/object/sign/${encodeURIComponent(bucket)}/${encodedPath}`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ expiresIn }),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new PortalError("SUPABASE_REQUEST_FAILED", `Storage sign HTTP ${response.status}`, 502, text);
  }
  const data = JSON.parse(text || "{}");
  const signedUrl = String(data.signedURL || data.signedUrl || "");
  if (!signedUrl) return "";
  return signedUrl.startsWith("http") ? signedUrl : `${SUPABASE_URL}/storage/v1${signedUrl}`;
}

async function supabaseRequest(path: string, options: {
  schema?: string;
  method?: string;
  query?: Record<string, unknown>;
  payload?: unknown;
  prefer?: string;
} = {}) {
  assertSetup();
  const method = (options.method || "GET").toUpperCase();
  const schema = options.schema || "public";
  const url = `${SUPABASE_URL}/rest/v1/${path}${buildQuery(options.query || {})}`;
  const headers: Record<string, string> = {
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    "Content-Type": "application/json",
    "Accept-Profile": schema,
    "Content-Profile": schema,
  };
  if (options.prefer) headers.Prefer = options.prefer;
  const response = await fetch(url, {
    method,
    headers,
    body: method === "GET" || method === "HEAD" ? undefined : JSON.stringify(options.payload || {}),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new PortalError("SUPABASE_REQUEST_FAILED", `${path} HTTP ${response.status}`, 502, text);
  }
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (_error) {
    return text;
  }
}

async function readRows(path: string, options: Parameters<typeof supabaseRequest>[1] = {}) {
  const data = await supabaseRequest(path, options);
  return Array.isArray(data) ? data as JsonRecord[] : [];
}

async function callSupabaseRpc(functionName: string, payload: JsonRecord = {}, schema = "public") {
  return await supabaseRequest(`rpc/${encodeURIComponent(functionName)}`, {
    method: "POST",
    payload,
    schema,
  });
}

async function verifyFirebaseToken(idToken: string) {
  if (!idToken) throw new PortalError("TOKEN_MISSING", "Firebase ID token is required.", 401);
  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(FIREBASE_API_KEY)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new PortalError("TOKEN_VERIFICATION_FAILED", "Firebase token verification failed.", 401, text);
  }
  const data = JSON.parse(text || "{}");
  const user = data.users?.[0];
  if (!user?.email) throw new PortalError("TOKEN_EMAIL_MISSING", "Firebase user email was not found.", 401);
  return {
    authType: "firebase",
    email: normalizeEmail(user.email),
    displayName: String(user.displayName || ""),
    uid: String(user.localId || ""),
  };
}

async function hashPin(pin: string) {
  if (!PIN_HASH_PEPPER) throw new PortalError("SETUP_MISSING", "PIN_HASH_PEPPER is missing.", 500);
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(PIN_HASH_PEPPER),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(String(pin || "").trim()));
  const bytes = new Uint8Array(signature);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return `hmac-sha256$${btoa(binary)}`;
}

function constantTimeEquals(left: string, right: string) {
  const a = String(left || "");
  const b = String(right || "");
  let diff = a.length ^ b.length;
  const length = Math.max(a.length, b.length);
  for (let i = 0; i < length; i += 1) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}

async function verifyPinHash(pin: string, storedHash: unknown) {
  const hash = String(storedHash || "");
  if (!hash.startsWith("hmac-sha256$")) return false;
  return constantTimeEquals(await hashPin(pin), hash);
}

function isCredentialLocked(credential: JsonRecord) {
  const lockedUntil = credential.locked_until;
  return Boolean(lockedUntil && new Date(String(lockedUntil)).getTime() > Date.now());
}

function sanitizeLoginCredential(credential: JsonRecord | null) {
  if (!credential) return null;
  return {
    id: String(credential.id || ""),
    employee_id: String(credential.employee_id || ""),
    login_email: normalizeEmail(credential.login_email),
    pin_set: Boolean(credential.pin_set || credential.pin_hash || credential.pin_updated_at),
    pin_updated_at: String(credential.pin_updated_at || ""),
    must_change_pin: Boolean(credential.must_change_pin),
    login_enabled: credential.login_enabled !== false,
    failed_attempts: Number(credential.failed_attempts || 0),
    locked_until: credential.locked_until ? String(credential.locked_until) : null,
    locked: isCredentialLocked(credential),
    last_login_at: credential.last_login_at ? String(credential.last_login_at) : null,
    created_at: String(credential.created_at || ""),
    updated_at: String(credential.updated_at || ""),
  };
}

async function findCredentialByEmail(email: string) {
  const rows = await readRows("employee_login_credentials", {
    query: {
      select: "id,employee_id,login_email,pin_hash,pin_updated_at,must_change_pin,login_enabled,failed_attempts,locked_until,last_login_at,created_at,updated_at",
      login_email: `eq.${normalizeEmail(email)}`,
      limit: "1",
    },
  });
  return rows[0] || null;
}

async function getCredentialByEmployeeId(employeeId: string) {
  const rows = await readRows("employee_login_credentials", {
    query: {
      select: "id,employee_id,login_email,pin_hash,pin_updated_at,must_change_pin,login_enabled,failed_attempts,locked_until,last_login_at,created_at,updated_at",
      employee_id: `eq.${employeeId}`,
      limit: "1",
    },
  });
  return rows[0] || null;
}

function parseBooleanLike(value: unknown, defaultValue = false) {
  if (value === undefined || value === null || value === "") return defaultValue;
  if (typeof value === "boolean") return value;
  const text = String(value).trim().toLowerCase();
  if (["true", "1", "yes", "y", "on", "有効", "必須", "する"].includes(text)) return true;
  if (["false", "0", "no", "n", "off", "無効", "不要", "しない"].includes(text)) return false;
  return defaultValue;
}

async function registerFailedPinAttempt(credential: JsonRecord) {
  if (!credential?.id) return;
  const failedAttempts = Number(credential.failed_attempts || 0) + 1;
  const updates: JsonRecord = {
    failed_attempts: failedAttempts,
    updated_at: new Date().toISOString(),
  };
  if (failedAttempts >= 5) {
    updates.locked_until = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  }
  await supabaseRequest("employee_login_credentials", {
    method: "PATCH",
    query: { id: `eq.${credential.id}` },
    payload: updates,
    prefer: "return=minimal",
  });
}

async function registerSuccessfulPinLogin(credential: JsonRecord) {
  if (!credential?.id) return;
  await supabaseRequest("employee_login_credentials", {
    method: "PATCH",
    query: { id: `eq.${credential.id}` },
    payload: {
      failed_attempts: 0,
      locked_until: null,
      last_login_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    prefer: "return=minimal",
  });
}

async function authenticate(token: string, payload: JsonRecord) {
  const authType = String(payload.authType || "firebase").trim().toLowerCase();
  if (authType === "pin") {
    const email = normalizeEmail(payload.email);
    const pin = String(payload.pin || "").trim();
    const credential = email ? await findCredentialByEmail(email) : null;
    if (!credential || credential.login_enabled === false || isCredentialLocked(credential)) {
      return { authType: "pin", email, displayName: "", employee: null };
    }
    const ok = await verifyPinHash(pin, credential.pin_hash);
    if (!ok) {
      await registerFailedPinAttempt(credential);
      return { authType: "pin", email, displayName: "", employee: null };
    }
    await registerSuccessfulPinLogin(credential);
    return { authType: "pin", email, displayName: "", credential };
  }
  return await verifyFirebaseToken(token);
}

async function getEmployeeById(id: string) {
  if (!id) return null;
  const rows = await readRows("employees", {
    query: {
      select: "id,employee_id,full_name,email,employment_status,employment_type,corporation_id,store_id,department_id,position_id,job_type_id,firebase_uid,is_active,source_row",
      id: `eq.${id}`,
      limit: "1",
    },
  });
  return rows[0] || null;
}

async function findEmployeeForAuth(authUser: JsonRecord) {
  const email = normalizeEmail(authUser.email);
  if (authUser.authType === "pin") {
    const credential = authUser.credential as JsonRecord | null;
    if (!credential?.id) return null;
    if (email) {
      const rpcEmployee = await findEmployeeByEmailRpc(email);
      if (rpcEmployee) return rpcEmployee;
    }
    const employee = await getEmployeeById(String(credential?.employee_id || ""));
    if (!isEmployeeActive(employee)) return null;
    return normalizeEmployee(employee, credential);
  }

  if (email) {
    const rpcEmployee = await findEmployeeByEmailRpc(email);
    if (rpcEmployee) return rpcEmployee;
  }

  const uid = String(authUser.uid || "").trim();
  let rows: JsonRecord[] = [];
  if (uid) {
    rows = await readRows("employees", {
      query: {
        select: "id,employee_id,full_name,email,employment_status,employment_type,corporation_id,store_id,department_id,position_id,job_type_id,firebase_uid,is_active,source_row",
        firebase_uid: `eq.${uid}`,
        limit: "1",
      },
    });
  }
  if (!rows.length && email) {
    rows = await readRows("employees", {
      query: {
        select: "id,employee_id,full_name,email,employment_status,employment_type,corporation_id,store_id,department_id,position_id,job_type_id,firebase_uid,is_active,source_row",
        email: `eq.${email}`,
        limit: "1",
      },
    });
  }
  const employee = rows[0] || null;
  if (!isEmployeeActive(employee)) return null;
  return normalizeEmployee(employee, await getCredentialByEmployeeId(String(employee.id || "")));
}

function isBootstrapRpcTemporarilyDisabled() {
  return bootstrapRpcDisabledUntil > Date.now();
}

function temporarilyDisableBootstrapRpc() {
  bootstrapRpcDisabledUntil = Date.now() + 60 * 1000;
}

async function findEmployeeByEmailRpc(email: string) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail || isBootstrapRpcTemporarilyDisabled()) return null;
  try {
    const data = await callSupabaseRpc("get_nov_hub_bootstrap_by_email", { p_email: normalizedEmail });
    return normalizeBootstrapEmployee(data as JsonRecord | null, normalizedEmail);
  } catch (error) {
    temporarilyDisableBootstrapRpc();
    console.warn("NOV HUB bootstrap RPC failed. Falling back to table reads.", sanitizeErrorDetail(error instanceof PortalError ? error.detail || error.message : error));
    return null;
  }
}

function isEmployeeActive(employee: JsonRecord | null) {
  if (!employee || employee.is_active === false) return false;
  const status = String(employee.employment_status || "");
  return !/退職|休職|産休|育休/.test(status);
}

async function getOne(table: string, id: unknown, select: string) {
  if (!id) return null;
  const rows = await readRows(table, { query: { select, id: `eq.${id}`, limit: "1" } });
  return rows[0] || null;
}

async function getRoles(employeeId: string) {
  if (!employeeId) return [];
  const employeeRoles = await readRows("employee_roles", {
    query: {
      select: "role_id",
      employee_id: `eq.${employeeId}`,
      is_active: "eq.true",
      limit: "50",
    },
  });
  const roleIds = uniqueStrings(employeeRoles.map((row) => row.role_id));
  if (!roleIds.length) return [];
  const roles = await readRows("roles", {
    query: {
      select: "id,role_key,role_name",
      id: `in.(${roleIds.join(",")})`,
    },
  });
  const byId = new Map(roles.map((role) => [String(role.id), role]));
  return employeeRoles.map((row) => {
    const role = byId.get(String(row.role_id)) || {};
    return {
      roleKey: String(role.role_key || ""),
      roleName: String(role.role_name || ""),
      scopeType: "",
      scopeId: null,
    };
  }).filter((role) => role.roleKey);
}

async function getStoreAssignments(employeeId: string) {
  if (!employeeId) return [];
  const assignments = await readRows("employee_store_assignments", {
    query: {
      select: "store_id,assignment_order,assignment_type,is_active",
      employee_id: `eq.${employeeId}`,
      is_active: "eq.true",
      order: "assignment_order.asc",
      limit: "10",
    },
  });
  const storeIds = uniqueStrings(assignments.map((row) => row.store_id));
  if (!storeIds.length) return [];
  const stores = await readRows("stores", {
    query: {
      select: "id,store_no,store_id,store_name",
      id: `in.(${storeIds.join(",")})`,
    },
  });
  const byId = new Map(stores.map((store) => [String(store.id), store]));
  return assignments.map((row) => {
    const store = byId.get(String(row.store_id)) || {};
    return {
      storeId: String(row.store_id || ""),
      storeNo: String(store.store_no || ""),
      storeCode: String(store.store_id || ""),
      storeName: String(store.store_name || ""),
      assignmentType: String(row.assignment_type || ""),
      priority: Number(row.assignment_order || 0),
    };
  });
}

function buildPrimaryStore(store: JsonRecord | null, assignments: JsonRecord[]) {
  const primary = assignments.find((item) => item.assignmentType === "primary" || Number(item.priority || 0) === 1);
  if (primary) {
    return {
      id: String(primary.storeId || ""),
      storeNo: String(primary.storeNo || ""),
      storeId: String(primary.storeCode || ""),
      name: String(primary.storeName || ""),
    };
  }
  if (!store) return null;
  return {
    id: String(store.id || ""),
    storeNo: String(store.store_no || ""),
    storeId: String(store.store_id || ""),
    name: String(store.store_name || ""),
  };
}

function getRoleLevel(roleKeys: string[]) {
  if (roleKeys.includes("super_admin") || roleKeys.includes("executive")) return 5;
  if (roleKeys.includes("department_manager") || roleKeys.includes("backoffice") || roleKeys.includes("accounting")) return 4;
  if (roleKeys.includes("area_manager") || roleKeys.includes("store_manager") || roleKeys.includes("fc_owner") || roleKeys.includes("trainer")) return 3;
  return 1;
}

function buildTags(employee: JsonRecord, context: { department: JsonRecord | null; position: JsonRecord | null; store: JsonRecord | null; roleKeys: string[] }) {
  const tags = ["all", ...context.roleKeys];
  const departmentName = String(context.department?.department_name || "");
  const positionName = String(context.position?.position_name || "");
  const storeName = String(context.store?.store_name || "");
  if (/営業/.test(departmentName)) tags.push("sales");
  if (/教育/.test(departmentName)) tags.push("education");
  if (/総務|人事/.test(departmentName)) tags.push("hr", "backoffice");
  if (/経理/.test(departmentName)) tags.push("accounting");
  if (/本部/.test(storeName) || departmentName) tags.push("hq");
  if (context.roleKeys.includes("executive") || context.roleKeys.includes("super_admin")) tags.push("executive");
  if (context.roleKeys.includes("backoffice")) tags.push("hq", "hr", "backoffice");
  if (context.roleKeys.includes("accounting")) tags.push("hq", "accounting");
  if (context.roleKeys.includes("trainer")) tags.push("education");
  if (context.roleKeys.includes("store_manager") || context.roleKeys.includes("area_manager") || context.roleKeys.includes("department_manager") || /店長|部長|マネージャー/.test(positionName)) tags.push("manager");
  if (context.roleKeys.includes("fc_owner") || /FC/.test(positionName)) tags.push("fc_owner");
  return uniqueStrings(tags);
}

async function normalizeEmployee(employee: JsonRecord | null, credential: JsonRecord | null) {
  if (!employee) return null;
  const [corporation, store, department, position, jobType, roles, storeAssignments] = await Promise.all([
    getOne("corporations", employee.corporation_id, "id,corporation_no,corporation_name,is_active"),
    getOne("stores", employee.store_id, "id,store_no,store_id,store_name,area,store_type,corporation_id,business_unit_id,is_active"),
    getOne("departments", employee.department_id, "id,department_code,department_name,is_active"),
    getOne("positions", employee.position_id, "id,position_name,is_active"),
    getOne("job_types", employee.job_type_id, "id,job_type_key,job_type_name,is_active"),
    getRoles(String(employee.id || "")),
    getStoreAssignments(String(employee.id || "")),
  ]);
  const roleKeys = roles.map((role) => role.roleKey).filter(Boolean);
  const primaryStore = buildPrimaryStore(store, storeAssignments);
  const source = (employee.source_row || {}) as JsonRecord;
  const loginCredential = sanitizeLoginCredential(credential);
  const tags = buildTags(employee, { department, position, store, roleKeys });
  return {
    id: String(employee.id || ""),
    coreEmployeeId: String(employee.id || ""),
    employeeId: String(employee.employee_id || ""),
    employeeNumber: String(employee.employee_id || ""),
    firebaseUid: String(employee.firebase_uid || ""),
    email: normalizeEmail((loginCredential && loginCredential.login_email) || employee.email),
    name: String(employee.full_name || employee.email || ""),
    fullName: String(employee.full_name || employee.email || ""),
    store: primaryStore?.name || String(source.assigned_location || ""),
    storeCode: primaryStore?.storeId || "",
    department: String(department?.department_name || source.department_name || ""),
    position: String(position?.position_name || source.position_name || ""),
    jobType: String(jobType?.job_type_name || ""),
    grade: "",
    roleLevel: getRoleLevel(roleKeys),
    roleKeys,
    roles,
    tags,
    status: "active",
    source: "supabase-edge",
    corporation: String(corporation?.corporation_name || ""),
    employmentStatus: String(employee.employment_status || ""),
    employmentType: String(employee.employment_type || ""),
    isActive: employee.is_active !== false,
    loginCredential,
    mustChangePin: Boolean(loginCredential?.must_change_pin),
    corporationRef: corporation ? { id: String(corporation.id || ""), code: String(corporation.corporation_no || ""), name: String(corporation.corporation_name || "") } : null,
    departmentRef: department ? { id: String(department.id || ""), code: String(department.department_code || ""), name: String(department.department_name || "") } : null,
    positionRef: position ? { id: String(position.id || ""), name: String(position.position_name || "") } : null,
    jobTypeRef: jobType ? { id: String(jobType.id || ""), key: String(jobType.job_type_key || ""), name: String(jobType.job_type_name || "") } : null,
    primaryStore,
    storeAssignments,
  };
}

function normalizeBootstrapRoles(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((role) => ({
    roleKey: String(role?.roleKey || role?.role_key || ""),
    roleName: String(role?.roleName || role?.role_name || ""),
    scopeType: String(role?.scopeType || role?.scope_type || ""),
    scopeId: role?.scopeId || role?.scope_id || null,
  })).filter((role) => role.roleKey);
}

function normalizeBootstrapStoreAssignments(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((assignment) => ({
    storeId: String(assignment?.storeId || assignment?.store_id || ""),
    storeNo: String(assignment?.storeNo || assignment?.store_no || ""),
    storeCode: String(assignment?.storeCode || assignment?.store_code || ""),
    storeName: String(assignment?.storeName || assignment?.store_name || ""),
    assignmentType: String(assignment?.assignmentType || assignment?.assignment_type || ""),
    priority: Number(assignment?.priority || assignment?.assignment_order || 0),
  })).filter((assignment) => assignment.storeId || assignment.storeName);
}

function normalizeBootstrapEmployee(data: JsonRecord | null, fallbackEmail: string) {
  if (!data || !data.employee || typeof data.employee !== "object") return null;
  const employee = data.employee as JsonRecord;
  const employmentStatus = String(employee.employmentStatus || employee.employment_status || "");
  if (employee.isActive === false || employee.is_active === false || /退職|休職|産休|育休/.test(employmentStatus)) return null;

  const source = (employee.sourceRow || employee.source_row || {}) as JsonRecord;
  const corporation = (data.corporation || {}) as JsonRecord;
  const store = (data.store || {}) as JsonRecord;
  const department = (data.department || {}) as JsonRecord;
  const position = (data.position || {}) as JsonRecord;
  const jobType = (data.jobType || data.job_type || {}) as JsonRecord;
  const roles = normalizeBootstrapRoles(data.roles);
  const roleKeys = roles.map((role) => role.roleKey).filter(Boolean);
  const storeAssignments = normalizeBootstrapStoreAssignments(data.storeAssignments || data.store_assignments);
  const primaryStore = buildPrimaryStore({
    id: String(store.id || ""),
    store_no: String(store.storeNo || store.store_no || ""),
    store_id: String(store.storeCode || store.store_code || ""),
    store_name: String(store.name || store.storeName || store.store_name || ""),
  }, storeAssignments);
  const loginCredential = sanitizeLoginCredential((data.loginStatus || data.login_status || null) as JsonRecord | null);
  const tags = buildTags({ source_row: source }, {
    department: { department_name: String(department.name || department.departmentName || department.department_name || "") },
    position: { position_name: String(position.name || position.positionName || position.position_name || "") },
    store: { store_name: String(primaryStore?.name || store.name || store.storeName || store.store_name || "") },
    roleKeys,
  });
  const employeeEmail = normalizeEmail((loginCredential && loginCredential.login_email) || employee.email || fallbackEmail);
  const fullName = String(employee.fullName || employee.full_name || employee.email || fallbackEmail || "");

  return {
    id: String(employee.id || ""),
    coreEmployeeId: String(employee.id || ""),
    employeeId: String(employee.employeeId || employee.employee_id || ""),
    employeeNumber: String(employee.employeeId || employee.employee_id || ""),
    firebaseUid: String(employee.firebaseUid || employee.firebase_uid || ""),
    email: employeeEmail,
    name: fullName,
    fullName,
    store: primaryStore?.name || String(source.assigned_location || ""),
    storeCode: primaryStore?.storeId || "",
    department: String(department.name || department.departmentName || department.department_name || source.department_name || ""),
    position: String(position.name || position.positionName || position.position_name || source.position_name || ""),
    jobType: String(jobType.name || jobType.jobTypeName || jobType.job_type_name || ""),
    grade: "",
    roleLevel: getRoleLevel(roleKeys),
    roleKeys,
    roles,
    tags,
    status: "active",
    source: "supabase-rpc",
    corporation: String(corporation.name || corporation.corporationName || corporation.corporation_name || ""),
    employmentStatus,
    employmentType: String(employee.employmentType || employee.employment_type || ""),
    isActive: employee.isActive !== false && employee.is_active !== false,
    loginCredential,
    mustChangePin: Boolean(loginCredential?.must_change_pin),
    corporationRef: corporation.id ? { id: String(corporation.id || ""), code: String(corporation.code || corporation.corporation_no || ""), name: String(corporation.name || corporation.corporation_name || "") } : null,
    departmentRef: department.id ? { id: String(department.id || ""), code: String(department.code || department.department_code || ""), name: String(department.name || department.department_name || "") } : null,
    positionRef: position.id ? { id: String(position.id || ""), name: String(position.name || position.position_name || "") } : null,
    jobTypeRef: jobType.id ? { id: String(jobType.id || ""), key: String(jobType.key || jobType.job_type_key || ""), name: String(jobType.name || jobType.job_type_name || "") } : null,
    primaryStore,
    storeAssignments,
  };
}

function normalizeApp(row: JsonRecord) {
  return {
    id: String(row.id || ""),
    appId: String(row.app_id || row.appId || ""),
    appName: String(row.app_name || row.appName || ""),
    description: String(row.description || ""),
    url: String(row.url || ""),
    category: String(row.category || "社内アプリ"),
    icon: String(row.icon || "default"),
    color: String(row.color || ""),
    requiredLevel: Number(row.required_level || row.requiredLevel || 1),
    allowedTags: normalizeList(row.allowed_tags || row.allowedTags),
    targetDepartment: normalizeList(row.target_department || row.targetDepartment),
    targetPosition: normalizeList(row.target_position || row.targetPosition),
    isActive: row.is_active !== false && row.isActive !== false,
    isFeatured: Boolean(row.is_featured || row.isFeatured),
    priority: Number(row.priority || 999),
    createdAt: String(row.created_at || ""),
    updatedAt: String(row.updated_at || ""),
  };
}

function fixedApps(employee: JsonRecord) {
  const apps = [
    {
      appId: "nov-navi",
      appName: "NOV Navi",
      description: "必要な情報、申請、アプリへ案内します",
      url: "./concierge/",
      category: "全般",
      icon: "nov-hub",
      requiredLevel: 1,
      allowedTags: [],
      targetDepartment: [],
      targetPosition: [],
      isActive: true,
      isFeatured: true,
      priority: 6,
    },
    {
      appId: "idea-link",
      appName: "IDEA LINK",
      description: "サンクス投稿と理念行動共有のHUB連携準備ページ",
      url: "./idea-link/",
      category: "称賛",
      icon: "idea-link",
      requiredLevel: 1,
      allowedTags: [],
      targetDepartment: [],
      targetPosition: [],
      isActive: true,
      isFeatured: false,
      priority: 88,
    },
    {
      appId: "expense_hub",
      appName: "経費精算管理システム",
      description: "経費明細登録・月次精算・経理確認・弥生会計CSV出力",
      url: "https://ideanow-shift.github.io/idea-nov-expense-hub/",
      category: "Finance Module",
      icon: "expense-hub",
      requiredLevel: 1,
      allowedTags: [],
      targetDepartment: [],
      targetPosition: [],
      isActive: true,
      isFeatured: false,
      priority: 66,
    },
    {
      appId: "human-capital-investment",
      appName: "人財投資管理システム",
      description: "採用活動・学校接点・人財投資状況を確認",
      url: "https://ideanow-shift.github.io/hr-investment-dashboard/",
      category: "人財",
      icon: "human-capital-investment",
      requiredLevel: 4,
      allowedTags: ["executive", "backoffice"],
      targetDepartment: [],
      targetPosition: [],
      isActive: true,
      isFeatured: false,
      priority: 64,
    },
    {
      appId: "hub-context-test",
      appName: "HUB Context Test",
      description: "HUBから各アプリへ渡すログイン情報を確認します",
      url: "./context-test/",
      category: "開発・診断",
      icon: "database",
      requiredLevel: 5,
      allowedTags: [],
      targetDepartment: [],
      targetPosition: [],
      isActive: true,
      isFeatured: false,
      priority: 98,
    },
  ];
  if (canViewMasterAdmin(employee)) {
    apps.push({
      appId: "core-master-admin",
      appName: "社員・店舗マスタ管理",
      description: "社員情報・店舗情報の基幹マスタを管理",
      url: "./master-admin/",
      category: "管理",
      icon: "database",
      requiredLevel: 4,
      allowedTags: [],
      targetDepartment: [],
      targetPosition: [],
      isActive: true,
      isFeatured: true,
      priority: 1,
    });
  }
  return apps.map(normalizeApp);
}

function canViewMasterAdmin(employee: JsonRecord) {
  const roleKeys = normalizeList(employee.roleKeys);
  return roleKeys.some((role) => ["super_admin", "executive", "department_manager", "backoffice", "accounting"].includes(role))
    || Number(employee.roleLevel || 0) >= 5
    || normalizeEmail(employee.email) === "m.wakita@idea-nov.com";
}

function canEditMasterAdmin(employee: JsonRecord) {
  const roleKeys = normalizeList(employee.roleKeys);
  return roleKeys.some((role) => ["super_admin", "backoffice"].includes(role))
    || normalizeEmail(employee.email) === "m.wakita@idea-nov.com";
}

function getMasterPermissions(employee: JsonRecord) {
  const roleKeys = uniqueStrings([...normalizeList(employee.roleKeys), ...normalizeList(employee.tags)]);
  return {
    canView: canViewMasterAdmin(employee),
    canEdit: canEditMasterAdmin(employee),
    roleKeys,
  };
}

function assertMasterViewer(employee: JsonRecord) {
  if (!canViewMasterAdmin(employee)) {
    throw new PortalError("MASTER_ADMIN_DENIED", "Master admin view permission is required.", 403);
  }
}

function assertMasterEditor(employee: JsonRecord) {
  if (!canEditMasterAdmin(employee)) {
    throw new PortalError("MASTER_ADMIN_DENIED", "Master admin edit permission is required.", 403);
  }
}

function indexById(rows: JsonRecord[]) {
  return rows.reduce((index, row) => {
    const id = String(row.id || "");
    if (id) index[id] = row;
    return index;
  }, {} as Record<string, JsonRecord>);
}

async function listCoreMaster(tableName: string, select: string, order: string) {
  return await readRows(tableName, { query: { select, order } });
}

async function listEmployeeLoginCredentialsForAdmin() {
  return await readRows("employee_login_credentials", {
    query: {
      select: "id,employee_id,login_email,pin_hash,pin_updated_at,must_change_pin,login_enabled,failed_attempts,locked_until,last_login_at,created_at,updated_at",
      limit: "2000",
    },
  }).catch(() => []);
}

async function indexLoginCredentialsByEmployee() {
  const credentials = await listEmployeeLoginCredentialsForAdmin();
  return credentials.reduce((index, credential) => {
    const employeeId = String(credential.employee_id || "");
    if (employeeId) index[employeeId] = sanitizeLoginCredential(credential);
    return index;
  }, {} as Record<string, ReturnType<typeof sanitizeLoginCredential>>);
}

async function listEmployeeRolesForAdmin() {
  return await readRows("employee_roles", {
    query: {
      select: "employee_id,role_id,is_active",
      is_active: "eq.true",
      limit: "2000",
    },
  });
}

async function groupRolesByEmployeeForAdmin() {
  const [roles, employeeRoles] = await Promise.all([
    listCoreMaster("roles", "id,role_key,role_name", "role_no.asc").catch(() => []),
    listEmployeeRolesForAdmin().catch(() => []),
  ]);
  const rolesById = indexById(roles);
  return employeeRoles.reduce((grouped, employeeRole) => {
    const employeeId = String(employeeRole.employee_id || "");
    const role = rolesById[String(employeeRole.role_id || "")] || {};
    const roleKey = String(role.role_key || "");
    if (!employeeId || !roleKey) return grouped;
    if (!grouped[employeeId]) grouped[employeeId] = { role_keys: [], role_names: [] };
    if (!grouped[employeeId].role_keys.includes(roleKey)) grouped[employeeId].role_keys.push(roleKey);
    const roleName = String(role.role_name || "");
    if (roleName && !grouped[employeeId].role_names.includes(roleName)) grouped[employeeId].role_names.push(roleName);
    return grouped;
  }, {} as Record<string, { role_keys: string[]; role_names: string[] }>);
}

async function listEmployeeStoreAssignmentsForAdmin() {
  return await readRows("employee_store_assignments", {
    query: {
      select: "id,employee_id,store_id,assignment_order,assignment_type,effective_from,effective_to,is_active",
      order: "assignment_order.asc",
      limit: "1000",
    },
  });
}

function groupStoreAssignmentsByEmployeeForAdmin(assignments: JsonRecord[], storesById: Record<string, JsonRecord>) {
  return assignments.reduce((grouped, assignment) => {
    const employeeId = String(assignment.employee_id || "");
    if (!employeeId || assignment.is_active === false) return grouped;
    const store = storesById[String(assignment.store_id || "")] || {};
    if (!grouped[employeeId]) grouped[employeeId] = [];
    grouped[employeeId].push({
      ...assignment,
      store_name: String(store.store_name || ""),
      store_code: String(store.store_id || ""),
    });
    return grouped;
  }, {} as Record<string, JsonRecord[]>);
}

function sanitizeEmployeeProfileImage(row: JsonRecord | null, signedUrl = "") {
  if (!row) return null;
  return {
    id: String(row.id || ""),
    employeeId: String(row.employee_id || ""),
    storageBucket: String(row.storage_bucket || EMPLOYEE_PROFILE_IMAGE_BUCKET),
    storagePath: String(row.storage_path || ""),
    isPrimary: row.is_primary !== false,
    uploadedByEmployeeId: String(row.uploaded_by_employee_id || ""),
    profileImageUrl: signedUrl,
    avatarUrl: signedUrl,
    profileImageUpdatedAt: String(row.updated_at || row.created_at || ""),
  };
}

async function listEmployeeProfileImagesForAdmin() {
  return await readRows("employee_profile_images", {
    query: {
      select: "id,employee_id,storage_bucket,storage_path,is_primary,uploaded_by_employee_id,created_at,updated_at",
      is_primary: "eq.true",
      limit: "1000",
    },
  }).catch(() => []);
}

async function indexEmployeeProfileImagesForAdmin() {
  const rows = await listEmployeeProfileImagesForAdmin();
  const signedEntries = await Promise.all(rows.map(async (row) => {
    const bucket = String(row.storage_bucket || EMPLOYEE_PROFILE_IMAGE_BUCKET);
    const storagePath = String(row.storage_path || "");
    const signedUrl = storagePath ? await createStorageSignedUrl(bucket, storagePath).catch(() => "") : "";
    return [String(row.employee_id || ""), sanitizeEmployeeProfileImage(row, signedUrl)] as const;
  }));
  return signedEntries.reduce((index, [employeeId, image]) => {
    if (employeeId && image) index[employeeId] = image;
    return index;
  }, {} as Record<string, ReturnType<typeof sanitizeEmployeeProfileImage>>);
}

async function uploadEmployeeProfileImage(payload: JsonRecord, actor: JsonRecord) {
  const employeeId = String(payload.id || payload.employee_id || "").trim();
  if (!employeeId) throw new PortalError("INVALID_REQUEST", "Employee id is required.", 400);
  const employee = await getCoreEmployeeById(employeeId);
  if (!employee?.id) throw new PortalError("NOT_FOUND", "Employee was not found.", 404);
  const contentType = String(payload.contentType || "").toLowerCase();
  const bytes = parseBase64ImagePayload(payload);
  const safeFileName = sanitizeStorageFileName(payload.fileName);
  const extension = safeFileName.match(/\.(jpg|png|webp)$/)?.[1]
    || (contentType === "image/png" ? "png" : contentType === "image/webp" ? "webp" : "jpg");
  const storagePath = `employees/${employeeId}/profile-${Date.now()}.${extension}`;
  await uploadStorageObject(EMPLOYEE_PROFILE_IMAGE_BUCKET, storagePath, bytes, contentType);
  await supabaseRequest("employee_profile_images", {
    method: "PATCH",
    query: {
      employee_id: `eq.${employeeId}`,
      is_primary: "eq.true",
    },
    payload: {
      is_primary: false,
      updated_at: new Date().toISOString(),
    },
    prefer: "return=minimal",
  }).catch(() => null);
  const rows = await supabaseRequest("employee_profile_images", {
    method: "POST",
    query: { select: "id,employee_id,storage_bucket,storage_path,is_primary,uploaded_by_employee_id,created_at,updated_at" },
    payload: {
      employee_id: employeeId,
      storage_bucket: EMPLOYEE_PROFILE_IMAGE_BUCKET,
      storage_path: storagePath,
      is_primary: true,
      uploaded_by_employee_id: actor.id || null,
    },
    prefer: "return=representation",
  }) as JsonRecord[];
  const row = Array.isArray(rows) ? rows[0] || null : null;
  await appendMasterChangeLog("employee_profile_images", employeeId, {
    storage_bucket: EMPLOYEE_PROFILE_IMAGE_BUCKET,
    storage_path: storagePath,
  }, actor, {
    actionType: "update_profile_image",
    targetName: String(employee.full_name || employee.employee_id || employee.id || ""),
  });
  const signedUrl = row ? await createStorageSignedUrl(EMPLOYEE_PROFILE_IMAGE_BUCKET, storagePath).catch(() => "") : "";
  return sanitizeEmployeeProfileImage(row, signedUrl);
}

async function listCoreEmployeesForAdmin() {
  const [
    employees,
    corporations,
    stores,
    departments,
    positions,
    jobTypes,
    assignments,
    rolesByEmployee,
    credentialsByEmployee,
    profileImagesByEmployee,
  ] = await Promise.all([
    readRows("employees", {
      query: {
        select: "id,employee_id,full_name,email,birth_date,joined_on,retired_on,leave_start_date,leave_end_date,leave_type,employment_status,employment_type,corporation_id,store_id,department_id,position_id,job_type_id,firebase_uid,is_active,updated_at,source_row",
        order: "employee_id.asc",
        limit: "1000",
      },
    }),
    listCoreMaster("corporations", "id,corporation_no,corporation_name", "corporation_no.asc"),
    listCoreMaster("stores", "id,store_id,store_name", "store_no.asc"),
    listCoreMaster("departments", "id,department_code,department_name", "department_no.asc"),
    listCoreMaster("positions", "id,position_name,is_active", "position_no.asc"),
    listCoreMaster("job_types", "id,job_type_key,job_type_name,sort_order,is_active", "sort_order.asc,job_type_name.asc").catch(() => []),
    listEmployeeStoreAssignmentsForAdmin().catch(() => []),
    groupRolesByEmployeeForAdmin().catch(() => ({})),
    indexLoginCredentialsByEmployee().catch(() => ({})),
    indexEmployeeProfileImagesForAdmin().catch(() => ({})),
  ]);
  const corporationsById = indexById(corporations);
  const storesById = indexById(stores);
  const departmentsById = indexById(departments);
  const positionsById = indexById(positions);
  const jobTypesById = indexById(jobTypes);
  const storeAssignmentsByEmployee = groupStoreAssignmentsByEmployeeForAdmin(assignments, storesById);
  return employees.map((employee) => {
    const source = (employee.source_row || {}) as JsonRecord;
    const corporation = corporationsById[String(employee.corporation_id || "")] || {};
    const store = storesById[String(employee.store_id || "")] || {};
    const department = departmentsById[String(employee.department_id || "")] || {};
    const position = positionsById[String(employee.position_id || "")] || {};
    const jobType = jobTypesById[String(employee.job_type_id || "")] || {};
    const roleGroup = rolesByEmployee[String(employee.id || "")] || { role_keys: [], role_names: [] };
    return {
      ...employee,
      corporation_name: String(corporation.corporation_name || ""),
      corporation_code: String(corporation.corporation_no || ""),
      store_name: String(store.store_name || ""),
      store_code: String(store.store_id || ""),
      department_name: String(department.department_name || ""),
      department_code: String(department.department_code || ""),
      position_name: String(position.position_name || ""),
      job_type_name: String(jobType.job_type_name || ""),
      job_type_key: String(jobType.job_type_key || ""),
      store_assignments: storeAssignmentsByEmployee[String(employee.id || "")] || [],
      role_keys: roleGroup.role_keys,
      role_names: roleGroup.role_names,
      source_company_name: String(source.company_name || ""),
      source_assigned_location: String(source.assigned_location || ""),
      source_position_name: String(source.position_name || ""),
      login_credential: credentialsByEmployee[String(employee.id || "")] || null,
      profile_image: profileImagesByEmployee[String(employee.id || "")] || null,
    };
  });
}

function sanitizeLineWorksDestination(destination: JsonRecord | null) {
  if (!destination) {
    return {
      id: "",
      channel_id: "",
      channel_name: "",
      purpose: "expense_approval",
      is_active: false,
      updated_at: "",
    };
  }
  return {
    id: String(destination.id || ""),
    channel_id: String(destination.channel_id || ""),
    channel_name: String(destination.channel_name || ""),
    purpose: String(destination.purpose || "expense_approval"),
    is_active: destination.is_active !== false,
    updated_at: String(destination.updated_at || ""),
  };
}

async function indexStoreLineWorksDestinations() {
  const rows = await readRows("notification_destinations", {
    schema: "os",
    query: {
      select: "id,provider,target_type,target_id,channel_id,channel_name,purpose,is_active,updated_at",
      provider: "eq.line_works",
      target_type: "eq.store",
      purpose: "eq.expense_approval",
      limit: "500",
    },
  }).catch(() => []);
  return rows.reduce((index, row) => {
    const targetId = String(row.target_id || "");
    if (targetId) index[targetId] = row;
    return index;
  }, {} as Record<string, JsonRecord>);
}

async function listCoreStoresForAdmin() {
  const [stores, destinations, corporations, businessUnits] = await Promise.all([
    readRows("stores", {
      query: {
        select: "id,store_no,store_id,store_name,corporation_id,business_unit_id,area,store_type,is_active,updated_at",
        order: "store_no.asc",
        limit: "500",
      },
    }),
    indexStoreLineWorksDestinations(),
    listCoreMaster("corporations", "id,corporation_no,corporation_name", "corporation_no.asc"),
    listCoreMaster("business_units", "id,business_unit_code,business_unit_name", "business_unit_no.asc"),
  ]);
  const corporationsById = indexById(corporations);
  const businessUnitsById = indexById(businessUnits);
  return stores.map((store) => {
    const corporation = corporationsById[String(store.corporation_id || "")] || {};
    const businessUnit = businessUnitsById[String(store.business_unit_id || "")] || {};
    return {
      ...store,
      corporation_name: String(corporation.corporation_name || ""),
      corporation_code: String(corporation.corporation_no || ""),
      business_unit_name: String(businessUnit.business_unit_name || ""),
      business_unit_code: String(businessUnit.business_unit_code || ""),
      line_works_channel: sanitizeLineWorksDestination(destinations[String(store.id || "")] || null),
    };
  });
}

async function listPortalAppsForAdmin() {
  const rows = await readRows("portal_apps", {
    query: {
      select: "*",
      order: "priority.asc,app_name.asc",
    },
  });
  return rows.map(normalizeApp);
}

async function listMasterChangeLogsForAdmin() {
  return await readRows("master_change_logs", {
    query: {
      select: "id,table_name,record_id,changed_by_email,change_payload,action_type,target_name,change_summary,created_at",
      order: "created_at.desc",
      limit: "100",
    },
  }).catch(() => []);
}

function getMasterChangeFieldLabel(key: string) {
  return ({
    email: "メール",
    login_email: "ログインメール",
    login_enabled: "ログイン可否",
    must_change_pin: "次回PIN変更",
    pin_changed: "PIN変更",
    lock_cleared: "ロック解除",
    source: "更新元",
    employee_id: "社員番号",
    full_name: "氏名",
    birth_date: "誕生日",
    joined_on: "入社日",
    retired_on: "退職日",
    leave_start_date: "休職開始日",
    leave_end_date: "休職終了日・復職日",
    leave_type: "休職区分",
    employment_status: "現職/休職/退職",
    employment_type: "雇用形態",
    corporation_id: "法人",
    store_id: "主店舗",
    department_id: "部署",
    position_id: "役職",
    firebase_uid: "Firebase UID",
    hub_role: "HUB権限",
    scope_type: "権限範囲",
    app_key: "アプリ",
    role_keys: "権限",
    before_role_keys: "変更前権限",
    provider: "通知プロバイダー",
    target_type: "通知対象種別",
    purpose: "通知用途",
    channel_id: "チャンネルID",
    channel_name: "チャンネル名",
    app_id: "アプリID",
    app_name: "アプリ名",
    description: "説明",
    url: "URL",
    category: "カテゴリ",
    icon: "アイコン",
    color: "色",
    required_level: "必要権限レベル",
    allowed_tags: "許可タグ",
    target_department: "対象部署",
    target_position: "対象役職",
    is_active: "有効状態",
    is_featured: "よく使う表示",
    priority: "表示順",
  } as Record<string, string>)[key] || key;
}

function buildMasterChangeSummary(changes: JsonRecord) {
  const labels = Object.keys(changes || {})
    .filter((key) => key !== "updated_at")
    .map(getMasterChangeFieldLabel);
  return labels.length ? `${labels.join("、")}を変更` : "変更内容なし";
}

async function appendMasterChangeLog(tableName: string, recordId: string, changes: JsonRecord, actor: JsonRecord, meta: JsonRecord = {}) {
  try {
    await supabaseRequest("master_change_logs", {
      method: "POST",
      payload: {
        table_name: tableName,
        record_id: recordId,
        changed_by_email: normalizeEmail(actor.email),
        change_payload: changes,
        action_type: String(meta.actionType || "update"),
        target_name: String(meta.targetName || ""),
        change_summary: buildMasterChangeSummary(changes),
      },
      prefer: "return=minimal",
    });
  } catch (error) {
    console.error("Master change log write failed", error);
  }
}

async function syncEmployeeEmailFromLoginEmailIfEmpty(employee: JsonRecord, loginEmail: string, actor: JsonRecord) {
  const employeeId = String(employee.id || "").trim();
  const normalizedLoginEmail = normalizeEmail(loginEmail);
  const currentEmail = normalizeEmail(employee.email);
  if (!employeeId || !normalizedLoginEmail || currentEmail === normalizedLoginEmail) return null;
  const now = new Date().toISOString();
  const updates = {
    email: normalizedLoginEmail,
    updated_at: now,
  };
  const rows = await readRows("employees", {
    method: "PATCH",
    query: { id: `eq.${employeeId}`, select: "id,employee_id,full_name,email,updated_at" },
    payload: updates,
    prefer: "return=representation",
  });
  await appendMasterChangeLog("employees", employeeId, {
    previous_email: currentEmail,
    email: normalizedLoginEmail,
    source: "login_credential_email_sync",
  }, actor, {
    actionType: "sync_employee_email_from_login_email",
    targetName: String(employee.full_name || employee.employee_id || employeeId),
  });
  return rows[0] || null;
}

async function syncLoginEmailFromEmployeeEmailIfExists(employee: JsonRecord, email: string, actor: JsonRecord) {
  const employeeId = String(employee.id || "").trim();
  const normalizedEmail = normalizeEmail(email);
  if (!employeeId || !normalizedEmail) return null;

  const existing = await getCredentialByEmployeeId(employeeId);
  if (!existing?.id) return null;
  if (normalizeEmail(existing.login_email) === normalizedEmail) return sanitizeLoginCredential(existing);

  const duplicate = await findCredentialByEmail(normalizedEmail);
  if (duplicate?.employee_id && String(duplicate.employee_id) !== employeeId) {
    throw new PortalError("DUPLICATE_LOGIN_EMAIL", "Duplicate login email.", 409);
  }

  const now = new Date().toISOString();
  const rows = await readRows("employee_login_credentials", {
    method: "PATCH",
    query: { id: `eq.${existing.id}`, select: "id,employee_id,login_email,pin_updated_at,must_change_pin,login_enabled,failed_attempts,locked_until,last_login_at,created_at,updated_at" },
    payload: {
      login_email: normalizedEmail,
      updated_at: now,
    },
    prefer: "return=representation",
  });
  await appendMasterChangeLog("employee_login_credentials", employeeId, {
    login_email: normalizedEmail,
    source: "employee_email_sync",
  }, actor, {
    actionType: "sync_login_email_from_employee_email",
    targetName: String(employee.full_name || employee.employee_id || employeeId),
  });
  return sanitizeLoginCredential(rows[0] || { ...existing, login_email: normalizedEmail, updated_at: now });
}

async function updateEmployeeLoginCredential(actor: JsonRecord, payload: JsonRecord) {
  const employeeId = String(payload.id || payload.employee_id || "").trim();
  if (!employeeId) throw new PortalError("INVALID_REQUEST", "Employee id is required.", 400);

  const employee = await getEmployeeById(employeeId);
  if (!employee?.id) throw new PortalError("NOT_FOUND", "Employee was not found.", 404);

  const loginEmail = normalizeEmail(payload.login_email || employee.email);
  if (!loginEmail) throw new PortalError("INVALID_REQUEST", "Login email is required.", 400);

  const newPin = String(payload.new_pin || "").trim();
  if (newPin && !/^\d{4,12}$/.test(newPin)) {
    throw new PortalError("INVALID_REQUEST", "PIN must be 4 to 12 digits.", 400);
  }

  const duplicate = await findCredentialByEmail(loginEmail);
  if (duplicate?.employee_id && String(duplicate.employee_id) !== employeeId) {
    throw new PortalError("DUPLICATE_LOGIN_EMAIL", "Duplicate login email.", 409);
  }

  const existing = await getCredentialByEmployeeId(employeeId);
  const now = new Date().toISOString();
  const clearLock = parseBooleanLike(payload.clear_lock, false);
  const updates: JsonRecord = {
    employee_id: employeeId,
    login_email: loginEmail,
    login_enabled: parseBooleanLike(payload.login_enabled, true),
    must_change_pin: parseBooleanLike(payload.must_change_pin, false),
    failed_attempts: clearLock ? 0 : Number(existing?.failed_attempts || 0),
    locked_until: clearLock ? null : existing?.locked_until || null,
    updated_at: now,
  };

  if (newPin) {
    updates.pin_hash = await hashPin(newPin);
    updates.pin_updated_at = now;
    updates.failed_attempts = 0;
    updates.locked_until = null;
  }

  const select = "id,employee_id,login_email,pin_hash,pin_updated_at,must_change_pin,login_enabled,failed_attempts,locked_until,last_login_at,created_at,updated_at";
  let rows: JsonRecord[];
  if (existing?.id) {
    rows = await readRows("employee_login_credentials", {
      method: "PATCH",
      query: { id: `eq.${existing.id}`, select },
      payload: updates,
      prefer: "return=representation",
    });
  } else {
    rows = await readRows("employee_login_credentials", {
      method: "POST",
      query: { select },
      payload: { created_at: now, ...updates },
      prefer: "return=representation",
    });
  }

  const credential = rows[0] || { ...existing, ...updates };
  await syncEmployeeEmailFromLoginEmailIfEmpty(employee, loginEmail, actor);
  await appendMasterChangeLog("employee_login_credentials", employeeId, {
    login_email: loginEmail,
    login_enabled: Boolean(updates.login_enabled),
    must_change_pin: Boolean(updates.must_change_pin),
    pin_changed: Boolean(newPin),
    lock_cleared: clearLock,
  }, actor, {
    actionType: existing?.id ? "update_login_credential" : "create_login_credential",
    targetName: String(employee.full_name || employee.employee_id || employeeId),
  });
  return sanitizeLoginCredential(credential);
}

function copyStringField(target: JsonRecord, source: JsonRecord, fieldName: string) {
  if (Object.prototype.hasOwnProperty.call(source, fieldName)) {
    target[fieldName] = String(source[fieldName] || "").trim();
  }
}

function copyNullableUuidField(target: JsonRecord, source: JsonRecord, fieldName: string) {
  if (Object.prototype.hasOwnProperty.call(source, fieldName)) {
    const value = String(source[fieldName] || "").trim();
    target[fieldName] = value || null;
  }
}

async function assertAllowedEmployeePosition(positionId: unknown) {
  const normalizedPositionId = String(positionId || "").trim();
  if (!normalizedPositionId) return;
  const rows = await readRows("positions", {
    query: {
      select: "id,position_name,is_active",
      id: `eq.${normalizedPositionId}`,
      limit: "1",
    },
  });
  const position = rows[0] || null;
  const positionName = String(position?.position_name || "").trim();
  if (FORBIDDEN_EMPLOYEE_ATTRIBUTE_LABELS.has(positionName)) {
    throw new PortalError("INVALID_REQUEST", "家族関係・敬称ラベルは役職として設定できません。", 400);
  }
  if (!FORMAL_EMPLOYEE_POSITION_LABELS.has(positionName) || position?.is_active === false) {
    throw new PortalError("INVALID_REQUEST", "正式役職リストにない値は役職として設定できません。職種は職種欄で管理してください。", 400);
  }
}

function copyDateField(target: JsonRecord, source: JsonRecord, fieldName: string) {
  if (!Object.prototype.hasOwnProperty.call(source, fieldName)) return;
  const value = String(source[fieldName] || "").trim();
  if (value && !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new PortalError("INVALID_REQUEST", `${fieldName} must be YYYY-MM-DD.`, 400);
  }
  target[fieldName] = value || null;
}

function todayJst() {
  const formatter = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(new Date());
}

function getActorEmployeeId(actor: JsonRecord) {
  return String(actor.id || actor.coreEmployeeId || actor.supabaseEmployeeId || actor.employee_id || "").trim() || null;
}

async function getCoreEmployeeById(id: string) {
  const rows = await readRows("employees", {
    query: {
      select: "id,employee_id,full_name,email,birth_date,joined_on,retired_on,leave_start_date,leave_end_date,leave_type,employment_status,employment_type,corporation_id,store_id,department_id,position_id,job_type_id,firebase_uid,is_active,source_row,created_at,updated_at",
      id: `eq.${id}`,
      limit: "1",
    },
  });
  return rows[0] || null;
}

async function getCoreStoreById(id: unknown) {
  const storeId = String(id || "").trim();
  if (!storeId) return null;
  const rows = await readRows("stores", {
    query: {
      select: "id,store_no,store_id,store_name,area,store_type,corporation_id,business_unit_id,is_active,updated_at",
      id: `eq.${storeId}`,
      limit: "1",
    },
  });
  return rows[0] || null;
}

async function appendAssignmentHistoryForCreatedEmployee(employee: JsonRecord, actor: JsonRecord) {
  if (!employee?.id) return;
  const store = employee.store_id ? await getCoreStoreById(employee.store_id) : null;
  const history = {
    employee_id: employee.id,
    corporation_id: employee.corporation_id || null,
    business_unit_id: store?.business_unit_id || null,
    department_id: employee.department_id || null,
    store_id: employee.store_id || null,
    position_id: employee.position_id || null,
    employment_status: String(employee.employment_status || "現職"),
    effective_from: String(employee.joined_on || todayJst()),
    change_type: "join",
    change_reason: "マスタ管理画面から新規追加",
    source: `master_admin:${normalizeEmail(actor.email) || "unknown"}`,
  };
  try {
    await supabaseRequest("employee_assignment_histories", {
      method: "POST",
      payload: history,
      prefer: "return=minimal",
    });
  } catch (error) {
    console.error("Failed to append assignment history for created employee", error);
  }
}

function inferAssignmentChangeType(before: JsonRecord, after: JsonRecord, updates: JsonRecord) {
  if (String(after.employment_status || "").includes("退職") || after.is_active === false) return "retire";
  if (Object.prototype.hasOwnProperty.call(updates, "store_id")) return "transfer";
  if (Object.prototype.hasOwnProperty.call(updates, "employment_status")) {
    const beforeStatus = String(before.employment_status || "");
    const afterStatus = String(after.employment_status || "");
    if (afterStatus.includes("休職")) return "leave";
    if (beforeStatus.includes("休職") && afterStatus.includes("現職")) return "return";
    return "correction";
  }
  if (Object.prototype.hasOwnProperty.call(updates, "position_id")) return "correction";
  return "update";
}

async function appendAssignmentHistoryIfNeeded(before: JsonRecord | null, after: JsonRecord | null, updates: JsonRecord, actor: JsonRecord) {
  if (!before || !after) return;
  const trackedFields = ["corporation_id", "store_id", "department_id", "position_id", "employment_status", "is_active"];
  const changed = trackedFields.some((field) => (
    Object.prototype.hasOwnProperty.call(updates, field)
    && String(before[field] || "") !== String(after[field] || "")
  ));
  if (!changed) return;

  const store = after.store_id ? await getCoreStoreById(after.store_id) : null;
  await supabaseRequest("employee_assignment_histories", {
    method: "POST",
    payload: {
      employee_id: after.id,
      corporation_id: after.corporation_id || null,
      business_unit_id: store?.business_unit_id || null,
      department_id: after.department_id || null,
      store_id: after.store_id || null,
      position_id: after.position_id || null,
      employment_status: String(after.employment_status || ""),
      effective_from: todayJst(),
      change_type: inferAssignmentChangeType(before, after, updates),
      change_reason: "マスタ管理画面から更新",
      source: normalizeEmail(actor.email) ? `master_admin:${normalizeEmail(actor.email)}` : "master_admin",
    },
    prefer: "return=minimal",
  });
}

function buildEmployeeStoreAssignments(employeeId: string, payload: JsonRecord) {
  return [
    { order: 1, field: "store_id", type: "primary" },
    { order: 2, field: "store_assignment_2", type: "secondary" },
    { order: 3, field: "store_assignment_3", type: "third" },
  ].map((item) => {
    const storeId = String(payload[item.field] || "").trim();
    if (!storeId) return null;
    return {
      employee_id: employeeId,
      store_id: storeId,
      assignment_order: item.order,
      assignment_type: item.type,
    };
  }).filter(Boolean) as JsonRecord[];
}

function areStoreAssignmentsSame(existing: JsonRecord[], desired: JsonRecord[]) {
  const sortByOrder = (left: JsonRecord, right: JsonRecord) => Number(left.assignment_order || 0) - Number(right.assignment_order || 0);
  const current = existing.slice().sort(sortByOrder);
  const next = desired.slice().sort(sortByOrder);
  if (current.length !== next.length) return false;
  return current.every((row, index) => {
    const expected = next[index];
    return String(row.store_id || "") === String(expected.store_id || "")
      && Number(row.assignment_order || 0) === Number(expected.assignment_order || 0)
      && String(row.assignment_type || "") === String(expected.assignment_type || "");
  });
}

async function updateEmployeeStoreAssignmentsIfPresent(employeeId: string, payload: JsonRecord, actor: JsonRecord) {
  const hasAssignmentPayload = ["store_id", "store_assignment_2", "store_assignment_3"].some((field) => (
    Object.prototype.hasOwnProperty.call(payload, field)
  ));
  if (!hasAssignmentPayload) return;

  const desiredAssignments = buildEmployeeStoreAssignments(employeeId, payload);
  const storeIds = desiredAssignments.map((assignment) => String(assignment.store_id || ""));
  if (storeIds.length !== new Set(storeIds).size) {
    throw new PortalError("INVALID_REQUEST", "Store assignments must be unique.", 400);
  }

  const existing = await readRows("employee_store_assignments", {
    query: {
      select: "id,store_id,assignment_order,assignment_type",
      employee_id: `eq.${employeeId}`,
      is_active: "eq.true",
      effective_to: "is.null",
      order: "assignment_order.asc",
      limit: "20",
    },
  });
  if (areStoreAssignmentsSame(existing, desiredAssignments)) return;

  const today = todayJst();
  const now = new Date().toISOString();
  if (existing.length) {
    await supabaseRequest("employee_store_assignments", {
      method: "PATCH",
      query: {
        employee_id: `eq.${employeeId}`,
        is_active: "eq.true",
        effective_to: "is.null",
      },
      payload: {
        is_active: false,
        effective_to: today,
        updated_at: now,
      },
      prefer: "return=minimal",
    });
  }
  if (desiredAssignments.length) {
    await supabaseRequest("employee_store_assignments", {
      method: "POST",
      payload: desiredAssignments.map((assignment) => ({
        ...assignment,
        effective_from: today,
        source: "master_admin",
        updated_at: now,
        is_active: true,
      })),
      prefer: "return=minimal",
    });
  }
  const employee = await getCoreEmployeeById(employeeId);
  await appendMasterChangeLog("employee_store_assignments", employeeId, {
    before: existing,
    after: desiredAssignments,
  }, actor, {
    actionType: "update_store_assignments",
    targetName: String(employee?.full_name || ""),
  });
}

function buildEmployeeRow(payload: JsonRecord, now: string, includeCreatedAt = false) {
  const row: JsonRecord = {
    employee_id: String(payload.employee_id || "").trim(),
    full_name: String(payload.full_name || "").trim(),
    updated_at: now,
  };
  if (includeCreatedAt) row.created_at = now;
  copyStringField(row, payload, "email");
  copyStringField(row, payload, "leave_type");
  copyStringField(row, payload, "employment_status");
  copyStringField(row, payload, "employment_type");
  if (Object.prototype.hasOwnProperty.call(row, "employment_type")) {
    row.employment_type = normalizeEmploymentType(row.employment_type);
  }
  if (Object.prototype.hasOwnProperty.call(row, "employment_status")) {
    row.employment_status = normalizeEmploymentStatus(row.employment_status);
  }
  if (Object.prototype.hasOwnProperty.call(row, "leave_type")) {
    row.leave_type = normalizeLeaveType(row.leave_type);
  }
  copyDateField(row, payload, "birth_date");
  copyDateField(row, payload, "joined_on");
  copyDateField(row, payload, "retired_on");
  copyDateField(row, payload, "leave_start_date");
  copyDateField(row, payload, "leave_end_date");
  copyNullableUuidField(row, payload, "corporation_id");
  copyNullableUuidField(row, payload, "store_id");
  copyNullableUuidField(row, payload, "department_id");
  copyNullableUuidField(row, payload, "position_id");
  copyNullableUuidField(row, payload, "job_type_id");
  if (Object.prototype.hasOwnProperty.call(payload, "is_active")) row.is_active = parseBooleanLike(payload.is_active, true);
  return row;
}

function isStaffRoleAssignableEmployee(employee: JsonRecord | null) {
  if (!employee?.id) return false;
  if (employee.is_active === false) return false;
  if (/退職|休職|産休|育休/.test(String(employee.employment_status || ""))) return false;
  return true;
}

async function getRoleByKey(roleKey: string) {
  const rows = await readRows("roles", {
    query: {
      select: "id,role_key,role_name,is_active",
      role_key: `eq.${roleKey}`,
      is_active: "eq.true",
      limit: "1",
    },
  });
  return rows[0] || null;
}

async function getRolesByKeys(roleKeys: string[]) {
  const normalizedRoleKeys = uniqueStrings(roleKeys).sort();
  if (!normalizedRoleKeys.length) return {} as Record<string, JsonRecord>;
  const rows = await readRows("roles", {
    query: {
      select: "id,role_key,role_name,is_active",
      role_key: `in.(${normalizedRoleKeys.join(",")})`,
      is_active: "eq.true",
      limit: "100",
    },
  });
  return rows.reduce((index, role) => {
    const roleKey = String(role.role_key || "");
    if (roleKey) index[roleKey] = role;
    return index;
  }, {} as Record<string, JsonRecord>);
}

async function assignDefaultStaffRoleForEmployee(employee: JsonRecord, actor: JsonRecord, silent = false) {
  const staffRole = await getRoleByKey("staff");
  if (!staffRole?.id) throw new PortalError("ROLE_NOT_FOUND", "staff role was not found.", 404);
  const existingRows = await readRows("employee_roles", {
    query: {
      select: "id,employee_id,role_id,scope_type,is_active",
      employee_id: `eq.${employee.id}`,
      role_id: `eq.${staffRole.id}`,
      scope_type: "eq.all",
      limit: "1",
    },
  });
  const existing = existingRows[0] || null;
  if (existing && existing.is_active !== false) return existing;

  let employeeRole: JsonRecord | null = null;
  if (existing?.id) {
    const rows = await readRows("employee_roles", {
      method: "PATCH",
      query: { id: `eq.${existing.id}`, select: "*" },
      payload: { is_active: true },
      prefer: "return=representation",
    });
    employeeRole = rows[0] || existing;
  } else {
    const rows = await readRows("employee_roles", {
      method: "POST",
      query: { select: "*" },
      payload: {
        employee_id: employee.id,
        role_id: staffRole.id,
        scope_type: "all",
        is_active: true,
      },
      prefer: "return=representation",
    });
    employeeRole = rows[0] || null;
  }

  await appendMasterChangeLog("employee_roles", String(employee.id || ""), {
    hub_role: "staff",
    scope_type: "all",
  }, actor, {
    actionType: silent ? "auto_assign_staff_role" : "assign_staff_role",
    targetName: String(employee.full_name || employee.employee_id || employee.id || ""),
  });
  return employeeRole;
}

async function assignDefaultStaffRole(payload: JsonRecord, actor: JsonRecord) {
  const id = String(payload.id || "").trim();
  if (!id) throw new PortalError("INVALID_REQUEST", "Employee id is required.", 400);
  const employee = await getCoreEmployeeById(id);
  if (!employee?.id) throw new PortalError("NOT_FOUND", "Employee was not found.", 404);
  if (!isStaffRoleAssignableEmployee(employee)) {
    throw new PortalError("INVALID_REQUEST", "現職かつ有効な社員だけstaffを付与できます。復職時は就労ステータスを現職、有効をONに保存してから付与してください。", 400);
  }
  return await assignDefaultStaffRoleForEmployee(employee, actor, false);
}

async function assignDefaultStaffRoleSafely(employee: JsonRecord, actor: JsonRecord) {
  try {
    if (!isStaffRoleAssignableEmployee(employee)) return null;
    return await assignDefaultStaffRoleForEmployee(employee, actor, true);
  } catch (error) {
    console.error("Default staff role failed", error);
    return null;
  }
}

function normalizeAppRoleKeys(roleKeys: unknown, allowedRoleKeys: string[]) {
  const source = Array.isArray(roleKeys) ? roleKeys : [];
  const allowed = new Set(allowedRoleKeys);
  return source.reduce((result, roleKeyValue) => {
    const roleKey = String(roleKeyValue || "").trim();
    if (!roleKey) return result;
    if (!allowed.has(roleKey)) throw new PortalError("INVALID_REQUEST", `Unsupported role key: ${roleKey}`, 400);
    if (!result.includes(roleKey)) result.push(roleKey);
    return result;
  }, [] as string[]);
}

async function updateEmployeeAppRoles(payload: JsonRecord, actor: JsonRecord) {
  const employeeId = String(payload.id || "").trim();
  const appKey = String(payload.appKey || "").trim();
  if (!employeeId) throw new PortalError("INVALID_REQUEST", "Employee id is required.", 400);
  if (!appKey) throw new PortalError("INVALID_REQUEST", "App key is required.", 400);

  const employee = await getCoreEmployeeById(employeeId);
  if (!employee?.id) throw new PortalError("NOT_FOUND", "Employee was not found.", 404);

  const allowedRoleKeys = APP_ROLE_GROUPS[appKey] || [];
  if (!allowedRoleKeys.length) throw new PortalError("INVALID_REQUEST", `Unsupported app key: ${appKey}`, 400);
  const desiredRoleKeys = normalizeAppRoleKeys(payload.roleKeys, allowedRoleKeys);
  const rolesByKey = await getRolesByKeys(allowedRoleKeys);
  const missingRoleKeys = allowedRoleKeys.filter((roleKey) => !rolesByKey[roleKey]?.id);
  if (missingRoleKeys.length) throw new PortalError("ROLE_NOT_FOUND", `App roles are missing: ${missingRoleKeys.join(", ")}`, 404);

  const roleIds = allowedRoleKeys.map((roleKey) => String(rolesByKey[roleKey].id || ""));
  const existingRows = await readRows("employee_roles", {
    query: {
      select: "id,employee_id,role_id,scope_type,is_active",
      employee_id: `eq.${employee.id}`,
      role_id: `in.(${roleIds.join(",")})`,
      limit: "100",
    },
  });
  const existingByRoleId = existingRows.reduce((index, row) => {
    index[String(row.role_id || "")] = row;
    return index;
  }, {} as Record<string, JsonRecord>);
  const beforeRoleKeys = allowedRoleKeys.filter((roleKey) => {
    const existing = existingByRoleId[String(rolesByKey[roleKey].id || "")];
    return existing && existing.is_active !== false;
  });
  const desired = new Set(desiredRoleKeys);

  await Promise.all(allowedRoleKeys.map(async (roleKey) => {
    const role = rolesByKey[roleKey];
    const existing = existingByRoleId[String(role.id || "")] || null;
    const shouldBeActive = desired.has(roleKey);
    if (existing && existing.is_active !== false && shouldBeActive) return;
    if (existing && existing.is_active === false && !shouldBeActive) return;
    if (existing?.id) {
      await supabaseRequest("employee_roles", {
        method: "PATCH",
        query: { id: `eq.${existing.id}` },
        payload: { is_active: shouldBeActive },
        prefer: "return=minimal",
      });
      return;
    }
    if (shouldBeActive) {
      await supabaseRequest("employee_roles", {
        method: "POST",
        payload: {
          employee_id: employee.id,
          role_id: role.id,
          scope_type: "all",
          is_active: true,
        },
        prefer: "return=minimal",
      });
    }
  }));

  await appendMasterChangeLog("employee_roles", String(employee.id || ""), {
    app_key: appKey,
    before_role_keys: beforeRoleKeys,
    role_keys: desiredRoleKeys,
  }, actor, {
    actionType: "update_app_roles",
    targetName: String(employee.full_name || employee.employee_id || employee.id || ""),
  });
  return { appKey, roleKeys: desiredRoleKeys };
}

async function createCoreEmployee(payload: JsonRecord, actor: JsonRecord) {
  const employeeId = String(payload.employee_id || "").trim();
  const fullName = String(payload.full_name || "").trim();
  if (!employeeId) throw new PortalError("INVALID_REQUEST", "Employee id is required.", 400);
  if (!fullName) throw new PortalError("INVALID_REQUEST", "Full name is required.", 400);

  const duplicateRows = await readRows("employees", {
    query: { select: "id,employee_id,full_name", employee_id: `eq.${employeeId}`, limit: "1" },
  });
  if (duplicateRows.length) throw new PortalError("DUPLICATE_EMPLOYEE_ID", "Duplicate employee id.", 409);

  const now = new Date().toISOString();
  await assertAllowedEmployeePosition(payload.position_id);
  const row = buildEmployeeRow(payload, now, true);
  row.employee_id = employeeId;
  row.full_name = fullName;
  row.is_legacy = /^LEGACY-/i.test(employeeId);
  if (!Object.prototype.hasOwnProperty.call(row, "is_active")) row.is_active = true;
  if (!row.employment_status) row.employment_status = "現職";
  if (!row.employment_type) row.employment_type = "正社員";
  row.employment_type = normalizeEmploymentType(row.employment_type);
  row.employment_status = normalizeEmploymentStatus(row.employment_status);
  row.leave_type = normalizeLeaveType(row.leave_type);

  const createdRows = await readRows("employees", {
    method: "POST",
    query: { select: "*" },
    payload: row,
    prefer: "return=representation",
  });
  const created = createdRows[0] || row;
  await appendMasterChangeLog("employees", String(created.id || employeeId), row, actor, {
    actionType: "create",
    targetName: String(created.full_name || fullName),
  });
  await appendAssignmentHistoryForCreatedEmployee(created, actor);
  await updateEmployeeStoreAssignmentsIfPresent(String(created.id || ""), payload, actor);
  await assignDefaultStaffRoleSafely(created, actor);
  return created;
}

async function updateCoreEmployee(payload: JsonRecord, actor: JsonRecord) {
  const id = String(payload.id || "").trim();
  if (!id) throw new PortalError("INVALID_REQUEST", "Employee id is required.", 400);
  const before = await getCoreEmployeeById(id);
  if (!before?.id) throw new PortalError("NOT_FOUND", "Employee was not found.", 404);
  await assertAllowedEmployeePosition(Object.prototype.hasOwnProperty.call(payload, "position_id") ? payload.position_id : before.position_id);
  const updates = buildEmployeeRow(payload, new Date().toISOString());
  delete updates.employee_id;
  delete updates.full_name;
  const changedUpdates = getChangedFields(before, updates);
  let after = before;
  if (Object.keys(changedUpdates).length) {
    const rows = await readRows("employees", {
      method: "PATCH",
      query: { id: `eq.${id}`, select: "*" },
      payload: changedUpdates,
      prefer: "return=representation",
    });
    after = rows[0] || before;
    await appendMasterChangeLog("employees", id, changedUpdates, actor, {
      actionType: "update",
      targetName: String(after.full_name || before.full_name || ""),
    });
    await appendAssignmentHistoryIfNeeded(before, after, changedUpdates, actor);
  }
  await updateEmployeeStoreAssignmentsIfPresent(id, payload, actor);
  if (Object.prototype.hasOwnProperty.call(payload, "email")) {
    await syncLoginEmailFromEmployeeEmailIfExists(after, String(payload.email || ""), actor);
  }
  return after;
}

async function linkFirebaseUid(payload: JsonRecord, actor: JsonRecord) {
  const id = String(payload.id || "").trim();
  const firebaseUid = String(payload.firebase_uid || "").trim();
  if (!id) throw new PortalError("INVALID_REQUEST", "Employee id is required.", 400);
  if (!/^[A-Za-z0-9_-]{10,128}$/.test(firebaseUid)) {
    throw new PortalError("INVALID_REQUEST", "Firebase UID format is invalid.", 400);
  }
  const duplicates = (await readRows("employees", {
    query: {
      select: "id,employee_id,full_name,email",
      firebase_uid: `eq.${firebaseUid}`,
      limit: "2",
    },
  })).filter((employee) => String(employee.id || "") !== id);
  if (duplicates.length) {
    throw new PortalError("FIREBASE_UID_DUPLICATED", "Firebase UID is already linked to another employee.", 409);
  }
  const before = await getCoreEmployeeById(id);
  if (!before?.id) throw new PortalError("NOT_FOUND", "Employee was not found.", 404);
  if (String(before.firebase_uid || "") === firebaseUid) return before;
  const updates = { firebase_uid: firebaseUid, updated_at: new Date().toISOString() };
  const rows = await readRows("employees", {
    method: "PATCH",
    query: { id: `eq.${id}`, select: "*" },
    payload: updates,
    prefer: "return=representation",
  });
  const after = rows[0] || before;
  await appendMasterChangeLog("employees", id, updates, actor, {
    actionType: "link_firebase_uid",
    targetName: String(after.full_name || before.full_name || ""),
  });
  return after;
}

async function getStoreLineWorksDestination(storeId: string) {
  if (!storeId) return null;
  const rows = await readRows("notification_destinations", {
    schema: "os",
    query: {
      select: "id,provider,target_type,target_id,channel_id,channel_name,purpose,is_active,updated_at",
      provider: "eq.line_works",
      target_type: "eq.store",
      target_id: `eq.${storeId}`,
      purpose: "eq.expense_approval",
      limit: "1",
    },
  });
  return rows[0] || null;
}

async function updateStoreLineWorksDestinationIfPresent(storeId: string, payload: JsonRecord, actor: JsonRecord, store: JsonRecord) {
  const hasPayload = ["line_works_channel_id", "line_works_channel_name", "line_works_channel_active"].some((key) => (
    Object.prototype.hasOwnProperty.call(payload, key)
  ));
  if (!hasPayload) return await getStoreLineWorksDestination(storeId);

  const channelId = String(payload.line_works_channel_id || "").trim();
  const channelName = String(payload.line_works_channel_name || "").trim();
  const isActive = parseBooleanLike(payload.line_works_channel_active, Boolean(channelId));
  const existing = await getStoreLineWorksDestination(storeId);

  if (!channelId && !channelName && !isActive) {
    if (!existing?.id || existing.is_active === false) return existing;
    const rows = await readRows("notification_destinations", {
      schema: "os",
      method: "PATCH",
      query: { id: `eq.${existing.id}`, select: "*" },
      payload: {
        is_active: false,
        updated_by_employee_id: getActorEmployeeId(actor),
        updated_at: new Date().toISOString(),
      },
      prefer: "return=representation",
    });
    const disabled = rows[0] || existing;
    await appendMasterChangeLog("os.notification_destinations", storeId, {
      provider: "line_works",
      target_type: "store",
      purpose: "expense_approval",
      is_active: false,
    }, actor, {
      actionType: "disable_line_works_channel",
      targetName: String(store.store_name || storeId),
    });
    return disabled;
  }

  if (!channelId) throw new PortalError("INVALID_REQUEST", "LINE WORKS channel id is required.", 400);
  const now = new Date().toISOString();
  const row = {
    provider: "line_works",
    target_type: "store",
    target_id: storeId,
    channel_id: channelId,
    channel_name: channelName,
    purpose: "expense_approval",
    is_active: isActive,
    updated_by_employee_id: getActorEmployeeId(actor),
    updated_at: now,
  };
  let rows: JsonRecord[];
  if (existing?.id) {
    rows = await readRows("notification_destinations", {
      schema: "os",
      method: "PATCH",
      query: { id: `eq.${existing.id}`, select: "*" },
      payload: row,
      prefer: "return=representation",
    });
  } else {
    rows = await readRows("notification_destinations", {
      schema: "os",
      method: "POST",
      query: { select: "*" },
      payload: {
        created_by_employee_id: getActorEmployeeId(actor),
        created_at: now,
        ...row,
      },
      prefer: "return=representation",
    });
  }
  const destination = rows[0] || await getStoreLineWorksDestination(storeId);
  await appendMasterChangeLog("os.notification_destinations", storeId, {
    provider: "line_works",
    target_type: "store",
    purpose: "expense_approval",
    channel_id: channelId,
    channel_name: channelName,
    is_active: isActive,
  }, actor, {
    actionType: existing?.id ? "update_line_works_channel" : "create_line_works_channel",
    targetName: String(store.store_name || storeId),
  });
  return destination;
}

async function updateCoreStore(payload: JsonRecord, actor: JsonRecord) {
  const id = String(payload.id || "").trim();
  if (!id) throw new PortalError("INVALID_REQUEST", "Store id is required.", 400);
  const before = await getCoreStoreById(id);
  if (!before?.id) throw new PortalError("NOT_FOUND", "Store was not found.", 404);
  const updates: JsonRecord = { updated_at: new Date().toISOString() };
  copyStringField(updates, payload, "store_name");
  copyStringField(updates, payload, "area");
  copyStringField(updates, payload, "store_type");
  copyNullableUuidField(updates, payload, "corporation_id");
  copyNullableUuidField(updates, payload, "business_unit_id");
  if (Object.prototype.hasOwnProperty.call(payload, "is_active")) updates.is_active = parseBooleanLike(payload.is_active, true);
  const changedUpdates = getChangedFields(before, updates);
  let after = before;
  if (Object.keys(changedUpdates).length) {
    const rows = await readRows("stores", {
      method: "PATCH",
      query: { id: `eq.${id}`, select: "*" },
      payload: changedUpdates,
      prefer: "return=representation",
    });
    after = rows[0] || before;
    await appendMasterChangeLog("stores", id, changedUpdates, actor, {
      actionType: "update",
      targetName: String(after.store_name || before.store_name || ""),
    });
  }
  const lineWorksDestination = await updateStoreLineWorksDestinationIfPresent(id, payload, actor, after);
  return {
    ...after,
    line_works_channel: sanitizeLineWorksDestination(lineWorksDestination),
  };
}

function getPayloadValue(source: JsonRecord, primaryKey: string, fallbackKey: string) {
  if (Object.prototype.hasOwnProperty.call(source, primaryKey)) return source[primaryKey];
  if (Object.prototype.hasOwnProperty.call(source, fallbackKey)) return source[fallbackKey];
  return undefined;
}

function normalizePortalAppRow(payload: JsonRecord, now: string, includeCreatedAt = false) {
  const row: JsonRecord = {
    app_id: String(payload.appId || payload.app_id || "").trim(),
    app_name: String(payload.appName || payload.app_name || "").trim(),
    description: String(payload.description || "").trim(),
    url: String(payload.url || "").trim(),
    category: String(payload.category || "").trim() || "internal",
    icon: String(payload.icon || "").trim() || "default",
    color: String(payload.color || "").trim() || null,
    required_level: Math.max(1, Math.min(5, Number(payload.requiredLevel || payload.required_level || 1))),
    allowed_tags: normalizeList(payload.allowedTags || payload.allowed_tags),
    target_department: normalizeList(payload.targetDepartment || payload.target_department),
    target_position: normalizeList(payload.targetPosition || payload.target_position),
    is_active: parseBooleanLike(getPayloadValue(payload, "isActive", "is_active"), true),
    is_featured: parseBooleanLike(getPayloadValue(payload, "isFeatured", "is_featured"), false),
    priority: Number(payload.priority || 999),
    updated_at: now,
  };
  if (includeCreatedAt) row.created_at = now;
  return row;
}

async function getPortalAppById(id: string) {
  const rows = await readRows("portal_apps", {
    query: {
      select: "*",
      id: `eq.${id}`,
      limit: "1",
    },
  });
  return rows[0] || null;
}

async function findPortalAppsByAppId(appId: string, limit = "2") {
  return await readRows("portal_apps", {
    query: {
      select: "id,app_id,app_name",
      app_id: `eq.${appId}`,
      limit,
    },
  });
}

function isFieldChanged(beforeValue: unknown, afterValue: unknown) {
  const before = beforeValue === null || beforeValue === undefined ? "" : beforeValue;
  const after = afterValue === null || afterValue === undefined ? "" : afterValue;
  return String(before) !== String(after);
}

function getChangedFields(before: JsonRecord, updates: JsonRecord) {
  const changed: JsonRecord = {};
  Object.keys(updates).forEach((key) => {
    if (key === "updated_at") return;
    if (isFieldChanged(before?.[key], updates[key])) changed[key] = updates[key];
  });
  if (Object.keys(changed).length) changed.updated_at = updates.updated_at;
  return changed;
}

async function updatePortalApp(payload: JsonRecord, actor: JsonRecord) {
  const id = String(payload.id || "").trim();
  if (!id) throw new PortalError("INVALID_REQUEST", "Portal app id is required.", 400);
  const before = await getPortalAppById(id);
  if (!before?.id) throw new PortalError("NOT_FOUND", "Portal app was not found.", 404);

  const updates = normalizePortalAppRow(payload, new Date().toISOString());
  const appId = String(updates.app_id || "");
  const appName = String(updates.app_name || "");
  if (!appId) throw new PortalError("INVALID_REQUEST", "App ID is required.", 400);
  if (!appName) throw new PortalError("INVALID_REQUEST", "App name is required.", 400);

  if (appId !== String(before.app_id || "")) {
    const duplicates = (await findPortalAppsByAppId(appId)).filter((app) => String(app.id || "") !== id);
    if (duplicates.length) throw new PortalError("INVALID_REQUEST", "App ID is already used.", 409);
  }

  const changedUpdates = getChangedFields(before, updates);
  if (!Object.keys(changedUpdates).length) return normalizeApp(before);

  const rows = await readRows("portal_apps", {
    method: "PATCH",
    query: { id: `eq.${id}`, select: "*" },
    payload: changedUpdates,
    prefer: "return=representation",
  });
  const after = rows[0] || before;
  await appendMasterChangeLog("portal_apps", id, changedUpdates, actor, {
    actionType: "update",
    targetName: String(after.app_name || before.app_name || appId),
  });
  return normalizeApp(after);
}

async function createPortalApp(payload: JsonRecord, actor: JsonRecord) {
  const now = new Date().toISOString();
  const row = normalizePortalAppRow(payload, now, true);
  const appId = String(row.app_id || "");
  const appName = String(row.app_name || "");
  if (!appId) throw new PortalError("INVALID_REQUEST", "App ID is required.", 400);
  if (!/^[A-Za-z0-9_-]{2,80}$/.test(appId)) {
    throw new PortalError("INVALID_REQUEST", "App ID must use letters, numbers, hyphen, or underscore.", 400);
  }
  if (!appName) throw new PortalError("INVALID_REQUEST", "App name is required.", 400);

  const duplicates = await findPortalAppsByAppId(appId, "1");
  if (duplicates.length) throw new PortalError("INVALID_REQUEST", "App ID is already used.", 409);

  const rows = await readRows("portal_apps", {
    method: "POST",
    query: { select: "*" },
    payload: row,
    prefer: "return=representation",
  });
  const created = rows[0] || row;
  await appendMasterChangeLog("portal_apps", String(created.id || appId), row, actor, {
    actionType: "create",
    targetName: String(created.app_name || appName),
  });
  return normalizeApp(created);
}

async function getMasterBootstrap(employee: JsonRecord) {
  const [corporations, businessUnits, departments, stores, positions, jobTypes, employees, portalApps] = await Promise.all([
    listCoreMaster("corporations", "id,corporation_no,corporation_name,is_active", "corporation_no.asc"),
    listCoreMaster("business_units", "id,business_unit_no,business_unit_code,business_unit_name,is_active", "business_unit_no.asc"),
    listCoreMaster("departments", "id,department_no,department_code,department_name,is_active", "department_no.asc"),
    listCoreStoresForAdmin(),
    listCoreMaster("positions", "id,position_no,position_name,is_active", "position_no.asc"),
    listCoreMaster("job_types", "id,job_type_key,job_type_name,sort_order,is_active", "sort_order.asc,job_type_name.asc").catch(() => []),
    listCoreEmployeesForAdmin(),
    listPortalAppsForAdmin(),
  ]);
  return {
    permissions: getMasterPermissions(employee),
    corporations,
    businessUnits,
    departments,
    stores,
    positions,
    jobTypes,
    employees,
    portalApps,
  };
}

function canAccessApp(employee: JsonRecord, app: ReturnType<typeof normalizeApp>) {
  if (!employee || employee.status !== "active" || !app.isActive) return false;
  if (Number(employee.roleLevel || 0) < Number(app.requiredLevel || 1)) return false;
  const tags = normalizeList(employee.tags);
  if (app.allowedTags.length && !app.allowedTags.some((tag) => tags.includes(tag))) return false;
  if (app.targetDepartment.length && !app.targetDepartment.includes(String(employee.department || ""))) return false;
  if (app.targetPosition.length && !app.targetPosition.includes(String(employee.position || ""))) return false;
  return true;
}

function normalizeAppTextKey(value: unknown) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, "")
    .replace(/[＿_\-ー－・/／（）()\[\]［］]/g, "")
    .toLowerCase();
}

function normalizeAppUrlKey(value: unknown) {
  const raw = String(value || "").trim();
  if (!raw || raw.startsWith("#")) return "";
  try {
    const url = new URL(raw, "https://ideanow-shift.github.io/idea-nov-hub/");
    url.searchParams.delete("hub_context");
    url.hash = "";
    const params = [...url.searchParams.entries()]
      .sort(([a], [b]) => a.localeCompare(b));
    url.search = "";
    params.forEach(([key, val]) => url.searchParams.set(key, val));
    const path = url.pathname.replace(/\/+$/, "") || "/";
    return `${url.origin}${path}${url.search}`;
  } catch (_) {
    return raw.replace(/[?#].*$/, "").replace(/\/+$/, "").toLowerCase();
  }
}

function canonicalAppGroupKey(app: ReturnType<typeof normalizeApp>) {
  const id = normalizeAppTextKey(app.appId);
  const name = normalizeAppTextKey(app.appName);
  if (id === "idealink" || id === "thanks" || id === "thankscoin" || name.includes("サンクス") || name.includes("理念浸透")) {
    return "app:idea-link";
  }
  const urlKey = normalizeAppUrlKey(app.url);
  if (urlKey) return `url:${urlKey}`;
  return `app:${id || name}`;
}

function appDedupeScore(app: ReturnType<typeof normalizeApp>) {
  let score = Number(app.priority || 999);
  const id = normalizeAppTextKey(app.appId);
  const name = normalizeAppTextKey(app.appName);
  if (id === "idealink") score -= 1000;
  if (id === "thanks" || id === "thankscoin" || name.includes("サンクス") || name.includes("理念浸透")) score += 1000;
  if (!normalizeAppUrlKey(app.url)) score += 500;
  return score;
}

function dedupeVisibleApps(apps: ReturnType<typeof normalizeApp>[]) {
  const byKey = new Map<string, ReturnType<typeof normalizeApp>>();
  apps.forEach((app) => {
    const key = canonicalAppGroupKey(app);
    const current = byKey.get(key);
    if (!current || appDedupeScore(app) < appDedupeScore(current)) {
      byKey.set(key, app);
    }
  });
  return [...byKey.values()];
}

async function readVisibleApps(employee: JsonRecord) {
  const rows = await readRows("portal_apps", {
    query: {
      select: "*",
      order: "priority.asc,app_name.asc",
    },
  }).catch(() => []);
  let apps = rows.map(normalizeApp).filter((app) => canAccessApp(employee, app));
  fixedApps(employee).forEach((fixed) => {
    const index = apps.findIndex((app) => app.appId === fixed.appId || (
      fixed.appId === "expense_hub" && app.appId === "expense-hub"
    ));
    if (index === -1) {
      if (canAccessApp(employee, fixed)) apps.push(fixed);
    } else if (fixed.appId === "expense_hub") {
      apps[index] = {
        ...apps[index],
        appId: fixed.appId,
        appName: fixed.appName,
        description: fixed.description,
        url: fixed.url,
        category: fixed.category,
        icon: apps[index].icon || fixed.icon,
      };
    }
  });
  apps = apps.filter((app) => app.appId !== "expense-hub");
  return dedupeVisibleApps(apps)
    .sort((a, b) => Number(a.priority || 999) - Number(b.priority || 999));
}

async function readAnnouncements() {
  const rows = await readRows("announcements", {
    query: {
      select: "type,title,body,is_active,priority",
      is_active: "eq.true",
      order: "priority.asc",
      limit: "10",
    },
  }).catch(() => []);
  return rows.map((row) => ({
    type: String(row.type || "info"),
    title: String(row.title || ""),
    body: String(row.body || ""),
    isActive: row.is_active !== false,
    priority: Number(row.priority || 999),
  }));
}

function notificationRecipientIds(employee: JsonRecord) {
  return uniqueStrings([employee.id, employee.coreEmployeeId, employee.supabaseEmployeeId, employee.employee_id]);
}

function normalizeNotification(row: JsonRecord) {
  let targetQuery: unknown = row.target_query || {};
  if (typeof targetQuery === "string") {
    try {
      targetQuery = JSON.parse(targetQuery);
    } catch (_error) {
      targetQuery = {};
    }
  }
  return {
    id: String(row.id || ""),
    type: "info",
    title: String(row.title || "経費精算管理システム通知"),
    body: String(row.body || ""),
    moduleKey: String(row.module_key || ""),
    channel: String(row.channel || ""),
    entityType: String(row.entity_type || ""),
    entityId: String(row.entity_id || ""),
    recipientEmployeeId: String(row.recipient_employee_id || ""),
    recipientEmail: normalizeEmail(row.recipient_email),
    recipientName: String(row.recipient_name || ""),
    status: String(row.status || ""),
    unread: row.unread === true || String(row.unread || "").toLowerCase() === "true",
    actionLabel: String(row.action_label || ""),
    targetModule: String(row.target_module || ""),
    targetView: String(row.target_view || ""),
    targetQuery,
    createdAt: String(row.created_at || ""),
  };
}

async function readNotifications(employee: JsonRecord) {
  const baseQuery = {
    select: "id,module_key,channel,entity_type,entity_id,recipient_employee_id,recipient_email,recipient_name,title,body,status,unread,action_label,target_module,target_view,target_query,created_at",
    module_key: "eq.finance.expense",
    channel: "eq.nov_hub",
    target_module: "eq.expense_hub",
    unread: "eq.true",
    order: "created_at.desc",
    limit: "20",
  };
  const ids = notificationRecipientIds(employee);
  const queries = [
    ...ids.map((id) => ({ ...baseQuery, recipient_employee_id: `eq.${id}` })),
    ...(employee.email ? [{ ...baseQuery, recipient_email: `eq.${employee.email}` }] : []),
  ];
  const results = await Promise.all(queries.map((query) => readRows("nov_hub_notification_inbox", { schema: "os", query }).catch(() => [])));
  const byId = new Map<string, JsonRecord>();
  results.flat().forEach((row) => {
    if (row.id) byId.set(String(row.id), row);
  });
  return [...byId.values()].sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || ""))).slice(0, 20).map(normalizeNotification);
}

async function markNovHubNotificationsRead(_employee: JsonRecord, payload: JsonRecord) {
  const notificationIds = Array.isArray(payload.notificationIds)
    ? payload.notificationIds
    : Array.isArray(payload.notification_ids)
      ? payload.notification_ids
      : [];
  const ids = uniqueStrings(notificationIds).filter((id) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id));
  if (!ids.length) return { marked: 0 };
  await callSupabaseRpc("mark_nov_hub_notifications_read", { p_notification_ids: ids }, "os");
  return { marked: ids.length };
}

async function appendAccessLog(employee: JsonRecord | null, entry: JsonRecord) {
  try {
    await supabaseRequest("access_logs", {
      method: "POST",
      payload: {
        occurred_at: new Date().toISOString(),
        email: String(entry.email || employee?.email || ""),
        employee_name: String(entry.name || employee?.name || ""),
        action: String(entry.action || ""),
        app_id: String(entry.appId || ""),
        app_name: String(entry.appName || ""),
        result: String(entry.result || ""),
        detail: typeof entry.detail === "object" && entry.detail ? entry.detail : {},
      },
      prefer: "return=minimal",
    });
  } catch (error) {
    console.error("Access log write failed", error);
  }
}

async function changeOwnPin(employee: JsonRecord, payload: JsonRecord) {
  const newPin = String(payload.new_pin || payload.newPin || "").trim();
  if (!/^\d{4,12}$/.test(newPin)) throw new PortalError("PIN_CHANGE_FAILED", "Invalid PIN.", 400);
  const credential = await getCredentialByEmployeeId(String(employee.id || ""));
  if (!credential?.id) throw new PortalError("PIN_CHANGE_FAILED", "Credential not found.", 404);
  const now = new Date().toISOString();
  const updated = {
    pin_hash: await hashPin(newPin),
    pin_updated_at: now,
    must_change_pin: false,
    failed_attempts: 0,
    locked_until: null,
    updated_at: now,
  };
  const rows = await readRows("employee_login_credentials", {
    method: "PATCH",
    query: { id: `eq.${credential.id}`, select: "id,employee_id,login_email,pin_updated_at,must_change_pin,login_enabled,failed_attempts,locked_until,last_login_at,created_at,updated_at" },
    payload: updated,
    prefer: "return=representation",
  });
  return sanitizeLoginCredential(rows[0] || { ...credential, ...updated });
}

async function parseRequest(request: Request) {
  const url = new URL(request.url);
  if (request.method === "GET") {
    return { action: url.searchParams.get("action") || "health", token: "", payload: {} as JsonRecord };
  }
  const contentType = request.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const data = await request.json().catch(() => ({}));
    return {
      action: String(data.action || ""),
      token: String(data.token || ""),
      payload: (data.payload && typeof data.payload === "object" ? data.payload : {}) as JsonRecord,
    };
  }
  const form = await request.formData();
  const payloadText = String(form.get("payload") || "{}");
  let payload: JsonRecord = {};
  try {
    payload = JSON.parse(payloadText || "{}");
  } catch (_error) {
    payload = {};
  }
  return {
    action: String(form.get("action") || ""),
    token: String(form.get("token") || ""),
    payload,
  };
}

async function handleHealth() {
  const checks: JsonRecord = {
    supabaseUrlConfigured: Boolean(SUPABASE_URL),
    supabaseServiceRoleKeyConfigured: Boolean(SUPABASE_SERVICE_ROLE_KEY),
    pinHashPepperConfigured: Boolean(PIN_HASH_PEPPER),
    firebaseApiKeyConfigured: Boolean(FIREBASE_API_KEY),
    employeesReachable: false,
    loginCredentialsReachable: false,
    employeeRolesReachable: false,
    jobTypesReachable: false,
    storesReachable: false,
    bootstrapRpcReachable: false,
    notificationDestinationsReachable: false,
    portalAppsReachable: false,
    accessLogsReachable: false,
  };
  try {
    checks.employeesReachable = Array.isArray(await readRows("employees", { query: { select: "id", limit: "1" } }));
    checks.loginCredentialsReachable = Array.isArray(await readRows("employee_login_credentials", { query: { select: "id", limit: "1" } }));
    checks.employeeRolesReachable = Array.isArray(await readRows("employee_roles", { query: { select: "id", limit: "1" } }));
    checks.jobTypesReachable = Array.isArray(await readRows("job_types", { query: { select: "id", limit: "1" } }));
    checks.storesReachable = Array.isArray(await readRows("stores", { query: { select: "id", limit: "1" } }));
    try {
      await callSupabaseRpc("get_nov_hub_bootstrap_by_email", { p_email: "__nov_hub_healthcheck__@invalid.local" });
      checks.bootstrapRpcReachable = true;
    } catch (error) {
      checks.bootstrapRpcError = sanitizeErrorDetail(error instanceof PortalError ? error.detail || error.message : error);
    }
    checks.notificationDestinationsReachable = Array.isArray(await readRows("notification_destinations", { schema: "os", query: { select: "id", limit: "1" } }));
    checks.portalAppsReachable = Array.isArray(await readRows("portal_apps", { query: { select: "id,app_id,is_active", limit: "200" } }));
    checks.accessLogsReachable = Array.isArray(await readRows("access_logs", { query: { select: "id", limit: "1" } }));
  } catch (error) {
    checks.error = sanitizeErrorDetail(error instanceof PortalError ? error.detail || error.message : error);
  }
  const ok = Boolean(checks.supabaseUrlConfigured
    && checks.supabaseServiceRoleKeyConfigured
    && checks.pinHashPepperConfigured
    && checks.firebaseApiKeyConfigured
    && checks.employeesReachable
    && checks.loginCredentialsReachable
    && checks.employeeRolesReachable
    && checks.storesReachable
    && checks.notificationDestinationsReachable
    && checks.portalAppsReachable);
  return jsonResponse({ ok, service: "NOV HUB Edge API", checks, timestamp: new Date().toISOString() });
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS_HEADERS });
  try {
    const { action, token, payload } = await parseRequest(request);
    if (action === "health") return await handleHealth();

    const authUser = await authenticate(token, payload);
    const employee = await findEmployeeForAuth(authUser);
    if (!employee) {
      await appendAccessLog(null, {
        email: authUser.email,
        name: authUser.displayName,
        action: "denied",
        result: "denied",
        detail: { authType: authUser.authType || "" },
      });
      return jsonResponse({ ok: false, code: "ACCESS_DENIED", message: publicMessage("ACCESS_DENIED") }, 403);
    }

    if (action === "bootstrap") {
      const apps = await readVisibleApps(employee);
      return jsonResponse({ ok: true, employee, apps, announcements: [], performance: { source: "supabase-edge" } });
    }

    if (action === "announcements") {
      return jsonResponse({ ok: true, announcements: await readAnnouncements(), performance: { source: "supabase-edge" } });
    }

    if (action === "novHubNotifications") {
      return jsonResponse({ ok: true, notifications: await readNotifications(employee), performance: { source: "supabase-edge" } });
    }

    if (action === "markNovHubNotificationRead") {
      return jsonResponse({ ok: true, result: await markNovHubNotificationsRead(employee, payload) });
    }

    if (action === "changeOwnPin") {
      return jsonResponse({ ok: true, credential: await changeOwnPin(employee, payload) });
    }

    if (action === "masterBootstrap") {
      assertMasterViewer(employee);
      return jsonResponse({ ok: true, data: await getMasterBootstrap(employee) });
    }

    if (action === "masterListEmployees") {
      assertMasterViewer(employee);
      return jsonResponse({ ok: true, employees: await listCoreEmployeesForAdmin() });
    }

    if (action === "masterListStores") {
      assertMasterViewer(employee);
      return jsonResponse({ ok: true, stores: await listCoreStoresForAdmin() });
    }

    if (action === "masterListPortalApps") {
      assertMasterViewer(employee);
      return jsonResponse({ ok: true, portalApps: await listPortalAppsForAdmin() });
    }

    if (action === "masterListChangeLogs") {
      assertMasterViewer(employee);
      return jsonResponse({ ok: true, logs: await listMasterChangeLogsForAdmin() });
    }

    if (action === "masterUpdateEmployeeLoginCredential") {
      assertMasterEditor(employee);
      return jsonResponse({ ok: true, credential: await updateEmployeeLoginCredential(employee, payload) });
    }

    if (action === "masterUploadEmployeeProfileImage") {
      assertMasterEditor(employee);
      return jsonResponse({ ok: true, profileImage: await uploadEmployeeProfileImage(payload, employee) });
    }

    if (action === "masterCreateEmployee") {
      assertMasterEditor(employee);
      return jsonResponse({ ok: true, employee: await createCoreEmployee(payload, employee) });
    }

    if (action === "masterUpdateEmployee") {
      assertMasterEditor(employee);
      return jsonResponse({ ok: true, employee: await updateCoreEmployee(payload, employee) });
    }

    if (action === "masterAssignDefaultStaffRole") {
      assertMasterEditor(employee);
      return jsonResponse({ ok: true, employeeRole: await assignDefaultStaffRole(payload, employee) });
    }

    if (action === "masterUpdateEmployeeAppRoles") {
      assertMasterEditor(employee);
      return jsonResponse({ ok: true, result: await updateEmployeeAppRoles(payload, employee) });
    }

    if (action === "masterLinkFirebaseUid") {
      assertMasterEditor(employee);
      return jsonResponse({ ok: true, employee: await linkFirebaseUid(payload, employee) });
    }

    if (action === "masterUpdateStore") {
      assertMasterEditor(employee);
      return jsonResponse({ ok: true, store: await updateCoreStore(payload, employee) });
    }

    if (action === "masterUpdatePortalApp") {
      assertMasterEditor(employee);
      return jsonResponse({ ok: true, portalApp: await updatePortalApp(payload, employee) });
    }

    if (action === "masterCreatePortalApp") {
      assertMasterEditor(employee);
      return jsonResponse({ ok: true, portalApp: await createPortalApp(payload, employee) });
    }

    if (action === "log") {
      const logAction = String(payload.action || "");
      if (!["login", "openApp", "logout"].includes(logAction)) {
        throw new PortalError("INVALID_REQUEST", "Unsupported log action.", 400);
      }
      if (logAction === "openApp") {
        const apps = await readVisibleApps(employee);
        const appId = String(payload.appId || "");
        if (!apps.some((app) => app.appId === appId)) {
          await appendAccessLog(employee, { ...payload, action: logAction, result: "denied" });
          return jsonResponse({ ok: false, code: "ACCESS_DENIED", message: "このアプリを利用する権限がありません。" }, 403);
        }
      }
      await appendAccessLog(employee, { ...payload, action: logAction });
      return jsonResponse({ ok: true });
    }

    return jsonResponse({ ok: false, code: "UNKNOWN_ACTION", message: "未対応の操作です。" }, 400);
  } catch (error) {
    const portalError = error instanceof PortalError
      ? error
      : new PortalError("SERVER_ERROR", "Unexpected server error.", 500, String(error));
    console.error(JSON.stringify({
      code: portalError.code,
      message: sanitizeErrorDetail(portalError.message),
      detail: sanitizeErrorDetail(portalError.detail),
    }));
    return jsonResponse({
      ok: false,
      code: portalError.code,
      message: publicMessage(portalError.code),
      detail: sanitizeErrorDetail(portalError.detail || portalError.message),
    }, portalError.status);
  }
});
