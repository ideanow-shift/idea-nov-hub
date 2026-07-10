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

const STORE_BUSINESS_PROFILE_SELECT = [
  "store_id",
  "regular_holiday_rule",
  "weekday_business_hours",
  "saturday_business_hours",
  "sunday_business_hours",
  "holiday_business_hours",
  "opened_on",
  "closed_on",
  "floor_area_tsubo",
  "floor_area_square_meter",
  "monthly_rent_including_common_fee",
  "rent_per_tsubo",
  "styling_seat_count",
  "shampoo_station_count",
  "rent_per_styling_seat",
  "affiliation_label",
  "operating_status",
  "store_feature_note",
  "updated_at",
].join(",");

const STORE_BUSINESS_PROFILE_STRING_FIELDS = [
  "regular_holiday_rule",
  "weekday_business_hours",
  "saturday_business_hours",
  "sunday_business_hours",
  "holiday_business_hours",
  "affiliation_label",
  "operating_status",
  "store_feature_note",
];

const STORE_BUSINESS_PROFILE_DATE_FIELDS = ["opened_on", "closed_on"];
const STORE_BUSINESS_PROFILE_NUMBER_FIELDS = [
  "floor_area_tsubo",
  "floor_area_square_meter",
  "monthly_rent_including_common_fee",
  "rent_per_tsubo",
  "rent_per_styling_seat",
];
const STORE_BUSINESS_PROFILE_INTEGER_FIELDS = ["styling_seat_count", "shampoo_station_count"];

const CORPORATION_BUSINESS_PROFILE_SELECT = [
  "corporation_id",
  "formal_corporation_name",
  "corporation_number",
  "invoice_registration_number",
  "representative_name",
  "head_office_address",
  "phone_number",
  "fiscal_year_end_month",
  "payroll_closing_day",
  "payroll_payment_day",
  "accounting_category",
  "social_insurance_status",
  "labor_insurance_status",
  "tax_accountant_label",
  "labor_consultant_label",
  "operating_status",
  "established_on",
  "closed_on",
  "corporation_feature_note",
  "updated_at",
].join(",");

const CORPORATION_BUSINESS_PROFILE_STRING_FIELDS = [
  "formal_corporation_name",
  "corporation_number",
  "invoice_registration_number",
  "representative_name",
  "head_office_address",
  "phone_number",
  "payroll_closing_day",
  "payroll_payment_day",
  "accounting_category",
  "social_insurance_status",
  "labor_insurance_status",
  "tax_accountant_label",
  "labor_consultant_label",
  "operating_status",
  "corporation_feature_note",
];

const CORPORATION_BUSINESS_PROFILE_DATE_FIELDS = ["established_on", "closed_on"];
const CORPORATION_BUSINESS_PROFILE_INTEGER_FIELDS = ["fiscal_year_end_month"];

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

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
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
    body: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
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

function clampNumber(value: unknown, fallback: number, min: number, max: number) {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(numberValue)));
}

function hasIdeaLinkRole(employee: JsonRecord) {
  const roleKeys = normalizeList(employee.roleKeys);
  return roleKeys.some((roleKey) => APP_ROLE_GROUPS.idea_link.includes(roleKey));
}

function isIdeaLinkManager(employee: JsonRecord) {
  const roleKeys = normalizeList(employee.roleKeys);
  return roleKeys.some((roleKey) => roleKey === "idea_link.manager" || roleKey === "idea_link.admin");
}

function assertIdeaLinkUser(employee: JsonRecord) {
  if (!hasIdeaLinkRole(employee)) {
    throw new PortalError("ACCESS_DENIED", "IDEA LINK role is required.", 403);
  }
}

function buildIdeaLinkVisibilityOr(employee: JsonRecord) {
  if (isIdeaLinkManager(employee)) return "";
  const employeeId = String(employee.id || employee.coreEmployeeId || employee.supabaseEmployeeId || "").trim();
  const primaryStore = asRecord(employee.primaryStore);
  const storeId = String(primaryStore.id || employee.primaryStoreId || employee.storeId || "").trim();
  const departmentRef = asRecord(employee.departmentRef);
  const departmentId = String(departmentRef.id || employee.departmentId || "").trim();
  const parts = [
    "visibility.eq.public",
    employeeId ? `sender_id.eq.${employeeId}` : "",
    employeeId ? `receiver_id.eq.${employeeId}` : "",
    storeId ? `receiver_store_id.eq.${storeId}` : "",
    departmentId ? `receiver_department_id.eq.${departmentId}` : "",
  ].filter(Boolean);
  return parts.length ? `(${parts.join(",")})` : "";
}

async function hydrateIdeaLinkPosts(rows: JsonRecord[]) {
  const employeeIds = uniqueStrings(rows.flatMap((row) => [row.sender_id, row.receiver_id]));
  const storeIds = uniqueStrings(rows.map((row) => row.receiver_store_id));
  const departmentIds = uniqueStrings(rows.map((row) => row.receiver_department_id));

  const [employees, stores, departments] = await Promise.all([
    employeeIds.length
      ? readRows("employees", {
        query: {
          select: "id,employee_id,full_name,store_id,department_id,position_id,job_type_id,is_active",
          id: `in.(${employeeIds.join(",")})`,
        },
      })
      : [],
    storeIds.length
      ? readRows("stores", {
        query: {
          select: "id,store_id,store_name,area,is_active",
          id: `in.(${storeIds.join(",")})`,
        },
      })
      : [],
    departmentIds.length
      ? readRows("departments", {
        query: {
          select: "id,department_name,is_active",
          id: `in.(${departmentIds.join(",")})`,
        },
      })
      : [],
  ]);

  const employeeById = Object.fromEntries(employees.map((employee) => [String(employee.id || ""), employee]));
  const storeById = Object.fromEntries(stores.map((store) => [String(store.id || ""), store]));
  const departmentById = Object.fromEntries(departments.map((department) => [String(department.id || ""), department]));

  return rows.map((row) => {
    const sender = asRecord(employeeById[String(row.sender_id || "")]);
    const receiver = asRecord(employeeById[String(row.receiver_id || "")]);
    const store = asRecord(storeById[String(row.receiver_store_id || "")]);
    const department = asRecord(departmentById[String(row.receiver_department_id || "")]);
    const orgUnitName = String(store.store_name || department.department_name || "");
    return {
      post_id: String(row.legacy_post_id || row.id || ""),
      request_id: String(row.request_id || ""),
      created_at: String(row.created_at || ""),
      sender_id: String(row.sender_id || ""),
      sender_supabase_employee_id: String(row.sender_id || ""),
      sender_name_snapshot: String(sender.full_name || ""),
      receiver_id: String(row.receiver_id || ""),
      receiver_supabase_employee_id: String(row.receiver_id || ""),
      receiver_name_snapshot: String(receiver.full_name || ""),
      receiver_store_id: String(row.receiver_store_id || row.receiver_department_id || ""),
      receiver_store_name_snapshot: orgUnitName,
      receiver_org_unit_type: String(row.receiver_org_unit_type || (row.receiver_department_id ? "department" : "store")),
      category: String(row.category || ""),
      challenge_flag: row.challenge_flag === true,
      comment: String(row.comment || ""),
      visibility: String(row.visibility || "") === "private" ? "private" : "public",
      status: String(row.status || "") === "active" ? "active" : "deleted",
      updated_at: String(row.updated_at || row.created_at || ""),
      deleted_at: String(row.deleted_at || ""),
      deleted_by: "",
    };
  });
}

async function readIdeaLinkTimeline(employee: JsonRecord, payload: JsonRecord) {
  const limit = clampNumber(payload.limit, 20, 1, 50);
  const cursor = String(payload.cursor || "").trim();
  const storeId = String(payload.storeId || "").trim();
  const departmentId = String(payload.departmentId || "").trim();
  const category = String(payload.category || "").trim();
  const challengeOnly = payload.challengeOnly === true;
  const query: JsonRecord = {
    select: [
      "id",
      "request_id",
      "legacy_post_id",
      "sender_id",
      "receiver_id",
      "receiver_org_unit_type",
      "receiver_store_id",
      "receiver_department_id",
      "category",
      "challenge_flag",
      "comment",
      "visibility",
      "status",
      "created_at",
      "updated_at",
      "deleted_at",
    ].join(","),
    status: "eq.active",
    order: "created_at.desc",
    limit: String(limit + 1),
  };
  const visible = buildIdeaLinkVisibilityOr(employee);
  if (visible) query.or = visible;
  if (cursor) query.created_at = `lt.${cursor}`;
  if (storeId) query.receiver_store_id = `eq.${storeId}`;
  if (departmentId) query.receiver_department_id = `eq.${departmentId}`;
  if (category) query.category = `eq.${category}`;
  if (challengeOnly) query.challenge_flag = "eq.true";

  const rows = await readRows("idea_link_posts", { query });
  const pageRows = rows.slice(0, limit);
  return {
    items: await hydrateIdeaLinkPosts(pageRows),
    nextCursor: rows.length > limit ? String(pageRows[pageRows.length - 1]?.created_at || "") : "",
    hasMore: rows.length > limit,
    source: "nov-hub-api-proxy",
    guards: {
      dbMutationExpected: false,
      notificationEnqueued: false,
      lineWorksNotificationSent: false,
      browserDirectTableAccess: false,
      browserDirectRpcExecute: false,
    },
    generatedAt: new Date().toISOString(),
  };
}

function getIdeaLinkYearMonth(value: unknown) {
  const explicit = String(value || "").trim();
  if (/^\d{4}-\d{2}$/.test(explicit)) return explicit;
  return todayJst().slice(0, 7);
}

function getJstYearMonth(value: unknown) {
  const date = new Date(String(value || ""));
  if (Number.isNaN(date.getTime())) return "";
  const formatter = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
  });
  return formatter.format(date);
}

async function readIdeaLinkMyPage(employee: JsonRecord, payload: JsonRecord) {
  assertIdeaLinkUser(employee);
  const employeeId = String(employee.id || employee.coreEmployeeId || employee.supabaseEmployeeId || "").trim();
  if (!isUuid(employeeId)) throw new PortalError("INVALID_REQUEST", "Employee id is invalid.", 400);
  const month = getIdeaLinkYearMonth(payload.month);
  const categories = ["気持ち良い挨拶", "約束を守る", "チームワーク", "報連相", "思いやり"];
  const categoryReceived: Record<string, number> = Object.fromEntries(categories.map((category) => [category, 0]));
  const rows = await readRows("idea_link_posts", {
    query: {
      select: [
        "id",
        "request_id",
        "legacy_post_id",
        "sender_id",
        "receiver_id",
        "receiver_org_unit_type",
        "receiver_store_id",
        "receiver_department_id",
        "category",
        "challenge_flag",
        "comment",
        "visibility",
        "status",
        "created_at",
        "updated_at",
        "deleted_at",
      ].join(","),
      status: "eq.active",
      or: `(sender_id.eq.${employeeId},receiver_id.eq.${employeeId})`,
      order: "created_at.desc",
      limit: "500",
    },
  });
  const monthRows = rows.filter((row) => getJstYearMonth(row.created_at) === month);
  const receivedRows = monthRows.filter((row) => String(row.receiver_id || "") === employeeId);
  const sentRows = monthRows.filter((row) => String(row.sender_id || "") === employeeId);
  receivedRows.forEach((row) => {
    const category = String(row.category || "");
    if (Object.prototype.hasOwnProperty.call(categoryReceived, category)) {
      categoryReceived[category] += 1;
    }
  });
  return {
    month,
    statsSource: "supabase",
    receivedCount: receivedRows.length,
    sentCount: sentRows.length,
    challengeReceivedCount: receivedRows.filter((row) => row.challenge_flag === true).length,
    categoryReceived: categories.map((category) => ({ category, count: categoryReceived[category] || 0 })),
    receivedPosts: await hydrateIdeaLinkPosts(receivedRows.slice(0, 20)),
    sentPosts: await hydrateIdeaLinkPosts(sentRows.slice(0, 20)),
    historyLimited: rows.length >= 500,
    source: "nov-hub-api-proxy",
    guards: {
      dbMutationExpected: false,
      notificationEnqueued: false,
      lineWorksNotificationSent: false,
      browserDirectTableAccess: false,
      browserDirectRpcExecute: false,
    },
    generatedAt: new Date().toISOString(),
  };
}

async function readIdeaLinkAdminSummary(employee: JsonRecord, payload: JsonRecord) {
  assertIdeaLinkUser(employee);
  if (!isIdeaLinkManager(employee)) throw new PortalError("ACCESS_DENIED", "IDEA LINK manager role is required.", 403);
  const month = getIdeaLinkYearMonth(payload.month);
  const [posts, stores, employees, channels, queued, monthlyRuns, profileImages] = await Promise.all([
    readRows("idea_link_posts", {
      query: {
        select: "id,sender_id,receiver_id,receiver_store_id,receiver_department_id,category,challenge_flag,status,visibility,created_at",
        status: "eq.active",
        order: "created_at.desc",
        limit: "1000",
      },
    }),
    readRows("stores", {
      query: {
        select: "id,store_name,is_active",
        is_active: "eq.true",
        limit: "100",
      },
    }),
    readRows("employees", {
      query: {
        select: "id,store_id,is_active,employment_status",
        is_active: "eq.true",
        limit: "2000",
      },
    }),
    readRows("idea_link_notification_channels", {
      query: {
        select: "id,target_scope,target_key,target_type,description,enabled,updated_at",
        enabled: "eq.true",
        limit: "200",
      },
    }),
    readRows("notifications", {
      schema: "os",
      query: {
        select: "id,module_key,entity_type,status,created_at",
        module_key: "eq.idea_link",
        status: "eq.queued",
        limit: "200",
      },
    }),
    readRows("idea_link_monthly_praise_runs", {
      query: {
        select: "id,award_type,target_month,approval_status,send_status,invalidated_at,created_at",
        limit: "50",
      },
    }),
    readRows("employee_profile_images", {
      query: {
        select: "id,employee_id,is_primary,updated_at",
        limit: "2000",
      },
    }),
  ]);
  const monthPosts = posts.filter((row) => getJstYearMonth(row.created_at) === month);
  const activeStaffByStore = employees.reduce((accumulator: Record<string, number>, row) => {
    const storeId = String(row.store_id || "");
    if (!storeId) return accumulator;
    accumulator[storeId] = (accumulator[storeId] || 0) + 1;
    return accumulator;
  }, {});
  const storeById = Object.fromEntries(stores.map((row) => [String(row.id || ""), row]));
  const storeStatsById = new Map<string, { storeId: string; storeName: string; postCount: number; participantIds: Set<string>; activeStaffCount: number }>();
  for (const store of stores) {
    const storeId = String(store.id || "");
    if (!storeId) continue;
    storeStatsById.set(storeId, {
      storeId,
      storeName: String(store.store_name || ""),
      postCount: 0,
      participantIds: new Set<string>(),
      activeStaffCount: activeStaffByStore[storeId] || 0,
    });
  }
  const categoryCounts = monthPosts.reduce((accumulator: Record<string, number>, row) => {
    const category = String(row.category || "未設定");
    accumulator[category] = (accumulator[category] || 0) + 1;
    return accumulator;
  }, {});
  for (const row of monthPosts) {
    const storeId = String(row.receiver_store_id || "");
    if (!storeId) continue;
    if (!storeStatsById.has(storeId)) {
      const store = asRecord(storeById[storeId]);
      storeStatsById.set(storeId, {
        storeId,
        storeName: String(store.store_name || "店舗名未取得"),
        postCount: 0,
        participantIds: new Set<string>(),
        activeStaffCount: activeStaffByStore[storeId] || 0,
      });
    }
    const stat = storeStatsById.get(storeId);
    if (!stat) continue;
    stat.postCount += 1;
    const receiverId = String(row.receiver_id || "");
    if (receiverId) stat.participantIds.add(receiverId);
  }
  const storeStats = [...storeStatsById.values()]
    .map((stat) => ({
      storeId: stat.storeId,
      storeName: stat.storeName,
      postCount: stat.postCount,
      participantCount: stat.participantIds.size,
      activeStaffCount: stat.activeStaffCount,
      participationRate: stat.activeStaffCount ? Math.round((stat.participantIds.size / stat.activeStaffCount) * 1000) / 10 : 0,
    }))
    .filter((stat) => stat.activeStaffCount > 0 || stat.postCount > 0)
    .sort((a, b) => (b.postCount - a.postCount) || String(a.storeName).localeCompare(String(b.storeName), "ja"));
  const categoryBreakdown = Object.entries(categoryCounts)
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count);
  const queuedCategories = queued.reduce((accumulator: Record<string, number>, row) => {
    const entityType = String(row.entity_type || "");
    const key = entityType.startsWith("monthly_thanks_mvp") ? "monthly_mvp" : "line_works_target";
    accumulator[key] = (accumulator[key] || 0) + 1;
    return accumulator;
  }, {});
  return {
    month,
    summary: {
      postCount: monthPosts.length,
      senderCount: uniqueStrings(monthPosts.map((row) => row.sender_id)).length,
      receiverCount: uniqueStrings(monthPosts.map((row) => row.receiver_id)).length,
      challengeCount: monthPosts.filter((row) => row.challenge_flag === true).length,
      activeStoreCount: stores.length,
      activeNotificationChannelCount: channels.length,
      queuedLineWorksTargetCount: queuedCategories.line_works_target || 0,
      queuedMonthlyMvpCount: queuedCategories.monthly_mvp || 0,
      monthlyPraiseRunCount: monthlyRuns.length,
      profileImageCount: profileImages.length,
    },
    storeStats,
    categoryBreakdown,
    notificationChannels: channels.slice(0, 80).map((row) => ({
      id: String(row.id || ""),
      targetScope: String(row.target_scope || ""),
      targetKey: String(row.target_key || ""),
      targetType: String(row.target_type || ""),
      description: String(row.description || ""),
      enabled: row.enabled === true,
      updatedAt: String(row.updated_at || ""),
    })),
    profileImageSummary: {
      registeredCount: profileImages.length,
      primaryCount: profileImages.filter((row) => row.is_primary === true).length,
      activeStaffCount: employees.length,
      missingCount: Math.max(0, employees.length - uniqueStrings(profileImages.map((row) => row.employee_id)).length),
    },
    checks: [
      { label: "投稿DB", status: "OK", detail: `Supabase Primary / ${posts.length}件` },
      { label: "店舗", status: "OK", detail: `受付対象候補 ${stores.length}件` },
      { label: "LINE WORKS通知先", status: "OK", detail: `有効 ${channels.length}件` },
      { label: "LINE WORKS Queue", status: "確認", detail: `通常queued ${queuedCategories.line_works_target || 0}件 / 月間MVP ${queuedCategories.monthly_mvp || 0}件` },
      { label: "月間称賛", status: "preview", detail: `run ${monthlyRuns.length}件 / 実送信停止中` },
    ],
    source: "nov-hub-api-proxy",
    guards: {
      dbMutationExpected: false,
      notificationEnqueued: false,
      lineWorksNotificationSent: false,
      browserDirectTableAccess: false,
      browserDirectRpcExecute: false,
    },
    generatedAt: new Date().toISOString(),
  };
}

function toMonthlyMvpScore(row: JsonRecord, employeeById: Record<string, JsonRecord>, storeById: Record<string, JsonRecord>) {
  const receiverId = String(row.receiver_id || "");
  const receiver = asRecord(employeeById[receiverId]);
  const storeId = String(row.receiver_store_id || receiver.store_id || "");
  const store = asRecord(storeById[storeId]);
  return {
    employeeId: receiverId,
    employeeNumber: String(receiver.employee_id || ""),
    name: String(receiver.full_name || ""),
    storeId,
    storeName: String(store.store_name || ""),
    receivedCount: 0,
    senderIds: new Set<string>(),
    uniqueSenderCount: 0,
    challengeCount: 0,
    latestReceivedAt: "",
  };
}

function addMonthlyMvpScore(score: ReturnType<typeof toMonthlyMvpScore>, row: JsonRecord) {
  score.receivedCount += 1;
  const senderId = String(row.sender_id || "");
  if (senderId) score.senderIds.add(senderId);
  score.uniqueSenderCount = score.senderIds.size;
  if (row.challenge_flag === true) score.challengeCount += 1;
  const createdAt = String(row.created_at || "");
  if (createdAt && (!score.latestReceivedAt || createdAt > score.latestReceivedAt)) {
    score.latestReceivedAt = createdAt;
  }
}

function compareMonthlyMvpScore(a: ReturnType<typeof toMonthlyMvpScore>, b: ReturnType<typeof toMonthlyMvpScore>) {
  return (b.receivedCount - a.receivedCount)
    || (b.uniqueSenderCount - a.uniqueSenderCount)
    || (b.challengeCount - a.challengeCount)
    || String(b.latestReceivedAt || "").localeCompare(String(a.latestReceivedAt || ""));
}

function isMonthlyMvpTie(a: ReturnType<typeof toMonthlyMvpScore>, b: ReturnType<typeof toMonthlyMvpScore>) {
  return a.receivedCount === b.receivedCount
    && a.uniqueSenderCount === b.uniqueSenderCount
    && a.challengeCount === b.challengeCount;
}

function serializeMonthlyMvpScore(score: ReturnType<typeof toMonthlyMvpScore>) {
  return {
    employeeId: score.employeeId,
    employeeNumber: score.employeeNumber,
    name: score.name,
    storeId: score.storeId,
    storeName: score.storeName,
    receivedCount: score.receivedCount,
    uniqueSenderCount: score.uniqueSenderCount,
    challengeCount: score.challengeCount,
    latestReceivedAt: score.latestReceivedAt,
  };
}

function pickMonthlyMvpWinners(scores: Array<ReturnType<typeof toMonthlyMvpScore>>) {
  const sorted = [...scores].sort(compareMonthlyMvpScore);
  const top = sorted[0];
  return {
    winners: top ? sorted.filter((score) => isMonthlyMvpTie(score, top)).map(serializeMonthlyMvpScore) : [],
    candidates: sorted.slice(0, 10).map(serializeMonthlyMvpScore),
    candidateCount: sorted.length,
  };
}

async function readIdeaLinkMonthlyMvpPreview(employee: JsonRecord, payload: JsonRecord) {
  assertIdeaLinkUser(employee);
  if (!isIdeaLinkManager(employee)) throw new PortalError("ACCESS_DENIED", "IDEA LINK manager role is required.", 403);
  const month = getIdeaLinkYearMonth(payload.month);
  const posts = await readRows("idea_link_posts", {
    query: {
      select: "id,sender_id,receiver_id,receiver_store_id,category,challenge_flag,status,visibility,created_at",
      status: "eq.active",
      order: "created_at.desc",
      limit: "2000",
    },
  });
  const targetPosts = posts.filter((row) => {
    return String(row.visibility || "public") !== "private"
      && String(row.receiver_id || "")
      && getJstYearMonth(row.created_at) === month;
  });
  const receiverIds = uniqueStrings(targetPosts.map((row) => row.receiver_id));
  const storeIds = uniqueStrings(targetPosts.map((row) => row.receiver_store_id));
  const [employees, stores] = await Promise.all([
    receiverIds.length
      ? readRows("employees", {
        query: {
          select: "id,employee_id,full_name,store_id,is_active,employment_status",
          id: `in.(${receiverIds.join(",")})`,
          limit: "2000",
        },
      })
      : Promise.resolve([]),
    storeIds.length
      ? readRows("stores", {
        query: {
          select: "id,store_name,is_active",
          id: `in.(${storeIds.join(",")})`,
          limit: "500",
        },
      })
      : Promise.resolve([]),
  ]);
  const employeeById = Object.fromEntries(employees.map((row) => [String(row.id || ""), row]));
  const fallbackStoreIds = uniqueStrings(employees.map((row) => row.store_id)).filter((id) => !storeIds.includes(id));
  const fallbackStores = fallbackStoreIds.length
    ? await readRows("stores", {
      query: {
        select: "id,store_name,is_active",
        id: `in.(${fallbackStoreIds.join(",")})`,
        limit: "500",
      },
    })
    : [];
  const storeById = Object.fromEntries([...stores, ...fallbackStores].map((row) => [String(row.id || ""), row]));
  const allScores = new Map<string, ReturnType<typeof toMonthlyMvpScore>>();
  const storeScores = new Map<string, Map<string, ReturnType<typeof toMonthlyMvpScore>>>();
  for (const row of targetPosts) {
    const receiverId = String(row.receiver_id || "");
    if (!receiverId) continue;
    if (!allScores.has(receiverId)) {
      allScores.set(receiverId, toMonthlyMvpScore(row, employeeById, storeById));
    }
    const allScore = allScores.get(receiverId);
    if (allScore) addMonthlyMvpScore(allScore, row);
    const storeId = allScore?.storeId || String(row.receiver_store_id || "");
    if (storeId) {
      if (!storeScores.has(storeId)) storeScores.set(storeId, new Map());
      const storeMap = storeScores.get(storeId);
      if (storeMap && !storeMap.has(receiverId)) {
        storeMap.set(receiverId, toMonthlyMvpScore(row, employeeById, storeById));
      }
      const storeScore = storeMap?.get(receiverId);
      if (storeScore) addMonthlyMvpScore(storeScore, row);
    }
  }
  const allStore = pickMonthlyMvpWinners([...allScores.values()]);
  const storeResults = [...storeScores.entries()].map(([storeId, scoreMap]) => {
    const store = asRecord(storeById[storeId]);
    const result = pickMonthlyMvpWinners([...scoreMap.values()]);
    return {
      storeId,
      storeName: String(store.store_name || result.winners[0]?.storeName || ""),
      ...result,
    };
  }).sort((a, b) => String(a.storeName || "").localeCompare(String(b.storeName || ""), "ja"));
  return {
    ok: true,
    month,
    awardName: "月間MVP",
    source: "nov-hub-api-proxy",
    totalPosts: targetPosts.length,
    scannedPosts: posts.length,
    lineWorksNotificationSent: false,
    notificationEnqueued: false,
    rule: {
      target: "公開中の有効投稿のみ",
      ranking: "受信数 > 送信者数 > チャレンジ数。同率は全員表示します。",
      commentBodyIncludedInNotification: false,
    },
    allStore,
    storeResults,
    guards: {
      dbMutationExpected: false,
      notificationEnqueued: false,
      lineWorksNotificationSent: false,
      browserDirectTableAccess: false,
      browserDirectRpcExecute: false,
    },
    generatedAt: new Date().toISOString(),
  };
}

function normalizeIdeaLinkVisibility(value: unknown) {
  return String(value || "").trim().toLowerCase() === "private" ? "private" : "public";
}

function normalizeIdeaLinkCategory(value: unknown) {
  const category = String(value || "").trim();
  const allowed = new Set(["気持ち良い挨拶", "約束を守る", "チームワーク", "報連相", "思いやり"]);
  if (!allowed.has(category)) throw new PortalError("INVALID_REQUEST", "IDEA LINK category is invalid.", 400);
  return category;
}

async function resolveIdeaLinkReceiver(payload: JsonRecord) {
  const receiverId = String(payload.receiverId || payload.receiver_id || "").trim();
  if (!isUuid(receiverId)) throw new PortalError("INVALID_REQUEST", "Receiver id is required.", 400);
  const receiver = await getOne(
    "employees",
    receiverId,
    "id,employee_id,full_name,store_id,department_id,employment_status,is_active",
  );
  if (!isEmployeeActive(receiver)) throw new PortalError("INVALID_REQUEST", "Receiver is not active.", 400);
  const receiverRecord = asRecord(receiver);
  const requestedOrgType = String(payload.receiverOrgUnitType || payload.receiver_org_unit_type || "").trim().toLowerCase();
  const storeId = String(receiverRecord.store_id || "").trim();
  const departmentId = String(receiverRecord.department_id || "").trim();
  const useDepartment = requestedOrgType === "department" && departmentId;
  const receiverOrgUnitType = useDepartment || (!storeId && departmentId) ? "department" : "store";
  if (receiverOrgUnitType === "store" && !storeId) throw new PortalError("INVALID_REQUEST", "Receiver store is missing.", 400);
  if (receiverOrgUnitType === "department" && !departmentId) throw new PortalError("INVALID_REQUEST", "Receiver department is missing.", 400);
  return {
    receiver: receiverRecord,
    receiverOrgUnitType,
    receiverStoreId: receiverOrgUnitType === "store" ? storeId : null,
    receiverDepartmentId: receiverOrgUnitType === "department" ? departmentId : null,
  };
}

async function readIdeaLinkPostByRequestId(requestId: string) {
  const rows = await readRows("idea_link_posts", {
    query: {
      select: "id,request_id,legacy_post_id,sender_id,receiver_id,receiver_org_unit_type,receiver_store_id,receiver_department_id,category,challenge_flag,comment,visibility,status,created_at,updated_at,deleted_at",
      request_id: `eq.${requestId}`,
      limit: "1",
    },
  });
  return rows[0] || null;
}

async function createIdeaLinkPost(employee: JsonRecord, payload: JsonRecord) {
  assertIdeaLinkUser(employee);
  const senderId = String(employee.id || employee.coreEmployeeId || employee.supabaseEmployeeId || "").trim();
  if (!isUuid(senderId)) throw new PortalError("INVALID_REQUEST", "Sender id is invalid.", 400);
  const requestId = String(payload.clientRequestId || payload.requestId || payload.request_id || "").trim();
  if (!isUuid(requestId)) throw new PortalError("INVALID_REQUEST", "clientRequestId must be a UUID.", 400);
  const existing = await readIdeaLinkPostByRequestId(requestId);
  if (existing) {
    return {
      post: (await hydrateIdeaLinkPosts([existing]))[0],
      duplicate: true,
      guards: {
        notificationEnqueued: false,
        lineWorksNotificationSent: false,
        browserDirectTableAccess: false,
        browserDirectRpcExecute: false,
      },
    };
  }

  const category = normalizeIdeaLinkCategory(payload.category);
  const comment = String(payload.comment || payload.body || "").trim();
  if (comment.length < 10 || comment.length > 200) {
    throw new PortalError("INVALID_REQUEST", "Comment must be 10 to 200 characters.", 400);
  }
  const visibility = normalizeIdeaLinkVisibility(payload.visibility);
  const challengeFlag = payload.challengeFlag === true || payload.challenge_flag === true;
  const receiverInfo = await resolveIdeaLinkReceiver(payload);
  const now = new Date().toISOString();
  const postId = crypto.randomUUID();
  const postPayload: JsonRecord = {
    id: postId,
    request_id: requestId,
    legacy_post_id: postId,
    sender_id: senderId,
    receiver_id: String(receiverInfo.receiver.id || ""),
    receiver_org_unit_type: receiverInfo.receiverOrgUnitType,
    receiver_store_id: receiverInfo.receiverStoreId,
    receiver_department_id: receiverInfo.receiverDepartmentId,
    category,
    challenge_flag: challengeFlag,
    comment,
    visibility,
    status: "active",
    created_at: now,
    updated_at: now,
  };
  const inserted = await supabaseRequest("idea_link_posts", {
    method: "POST",
    payload: postPayload,
    prefer: "return=representation",
  });
  const post = Array.isArray(inserted) ? asRecord(inserted[0]) : asRecord(inserted);

  await supabaseRequest("idea_link_audit_logs", {
    method: "POST",
    payload: {
      actor_id: senderId,
      action: "create_thanks",
      target_type: "idea_link_post",
      target_id: String(post.id || postId),
      result: "success",
      detail: {
        visibility,
        category,
        challengeFlag,
        receiverId: String(receiverInfo.receiver.id || ""),
        receiverOrgUnitType: receiverInfo.receiverOrgUnitType,
        notificationEnqueued: false,
        lineWorksNotificationSent: false,
      },
      request_id: requestId,
      occurred_at: now,
    },
    prefer: "return=minimal",
  });

  return {
    post: (await hydrateIdeaLinkPosts([post]))[0],
    duplicate: false,
    guards: {
      notificationEnqueued: false,
      lineWorksNotificationSent: false,
      browserDirectTableAccess: false,
      browserDirectRpcExecute: false,
    },
  };
}

async function searchIdeaLinkRecipients(employee: JsonRecord, payload: JsonRecord) {
  assertIdeaLinkUser(employee);
  const queryText = String(payload.query || payload.q || "").trim();
  const storeId = String(payload.storeId || "").trim();
  const limit = clampNumber(payload.limit, 8, 1, 20);
  const query: JsonRecord = {
    select: "id,employee_id,full_name,store_id,department_id,job_type_id,employment_status,is_active",
    is_active: "eq.true",
    order: "full_name.asc",
    limit: String(Math.max(limit * 3, 12)),
  };
  if (queryText) query.full_name = `ilike.*${queryText.replace(/[%*]/g, "")}*`;
  if (isUuid(storeId)) query.store_id = `eq.${storeId}`;
  const employees = (await readRows("employees", { query }))
    .filter((row) => isEmployeeActive(row))
    .slice(0, limit);
  const storeIds = uniqueStrings(employees.map((row) => row.store_id));
  const departmentIds = uniqueStrings(employees.map((row) => row.department_id));
  const jobTypeIds = uniqueStrings(employees.map((row) => row.job_type_id));
  const [stores, departments, jobTypes] = await Promise.all([
    storeIds.length
      ? readRows("stores", { query: { select: "id,store_name", id: `in.(${storeIds.join(",")})` } })
      : [],
    departmentIds.length
      ? readRows("departments", { query: { select: "id,department_name", id: `in.(${departmentIds.join(",")})` } })
      : [],
    jobTypeIds.length
      ? readRows("job_types", { query: { select: "id,job_type_name", id: `in.(${jobTypeIds.join(",")})` } })
      : [],
  ]);
  const storeById = Object.fromEntries(stores.map((store) => [String(store.id || ""), store]));
  const departmentById = Object.fromEntries(departments.map((department) => [String(department.id || ""), department]));
  const jobTypeById = Object.fromEntries(jobTypes.map((jobType) => [String(jobType.id || ""), jobType]));
  return {
    recipients: employees.map((candidate) => {
      const store = asRecord(storeById[String(candidate.store_id || "")]);
      const department = asRecord(departmentById[String(candidate.department_id || "")]);
      const jobType = asRecord(jobTypeById[String(candidate.job_type_id || "")]);
      return {
        id: String(candidate.id || ""),
        employeeNumber: String(candidate.employee_id || ""),
        fullName: String(candidate.full_name || ""),
        storeName: String(store.store_name || department.department_name || ""),
        jobTypeName: String(jobType.job_type_name || "未設定"),
      };
    }),
    source: "nov-hub-api-proxy",
    guards: {
      dbMutationExpected: false,
      notificationEnqueued: false,
      lineWorksNotificationSent: false,
      browserDirectTableAccess: false,
      browserDirectRpcExecute: false,
    },
  };
}

async function getIdeaLinkStoreOptions(employee: JsonRecord) {
  assertIdeaLinkUser(employee);
  const stores = await readRows("stores", {
    query: {
      select: "id,store_name,store_no,store_id,is_active",
      is_active: "eq.true",
      order: "store_name.asc",
      limit: "80",
    },
  });
  return {
    stores: stores
      .filter((store) => String(store.id || "").trim() && String(store.store_name || "").trim())
      .map((store) => ({
        id: String(store.id || ""),
        storeName: String(store.store_name || ""),
        storeNo: String(store.store_no || ""),
        storeCode: String(store.store_id || ""),
      })),
    source: "nov-hub-api-proxy",
    guards: {
      dbMutationExpected: false,
      notificationEnqueued: false,
      lineWorksNotificationSent: false,
      browserDirectTableAccess: false,
      browserDirectRpcExecute: false,
    },
  };
}

async function previewIdeaLinkPostNotification(employee: JsonRecord, payload: JsonRecord) {
  assertIdeaLinkUser(employee);
  const postId = String(payload.postId || payload.post_id || "").trim();
  if (!isUuid(postId)) throw new PortalError("INVALID_REQUEST", "postId is required.", 400);
  const post = await getOne(
    "idea_link_posts",
    postId,
    "id,sender_id,receiver_id,receiver_store_id,receiver_department_id,receiver_org_unit_type,status,visibility,created_at",
  );
  if (!post) throw new PortalError("INVALID_REQUEST", "IDEA LINK post was not found.", 404);
  const postRecord = asRecord(post);
  if (String(postRecord.status || "") !== "active") {
    return {
      ok: true,
      postId,
      eligible: false,
      reason: "post_not_active",
      target: null,
      source: "nov-hub-api-proxy",
      guards: ideaLinkNotificationPreviewGuards(),
    };
  }

  const orgUnitType = String(postRecord.receiver_org_unit_type || "").trim().toLowerCase();
  const storeId = String(postRecord.receiver_store_id || "").trim();
  const departmentId = String(postRecord.receiver_department_id || "").trim();
  const useHeadOfficeChannel = orgUnitType === "department" || (!storeId && departmentId);
  const store = storeId
    ? asRecord(await getOne("stores", storeId, "id,store_id,store_no,store_name"))
    : {};
  const targetScope = "store";
  const targetKeys = useHeadOfficeChannel
    ? ["honbu", "0000"]
    : uniqueStrings([
      String(store.store_id || ""),
      String(store.store_no || ""),
      storeId,
    ]);
  if (!targetKeys.length) {
    return {
      ok: true,
      postId,
      eligible: false,
      reason: "notification_target_missing",
      target: null,
      source: "nov-hub-api-proxy",
      guards: ideaLinkNotificationPreviewGuards(),
    };
  }

  let channelRows: JsonRecord[] = [];
  try {
    const rows = await readRows("idea_link_notification_channels", {
      query: {
        select: "*",
        limit: "500",
      },
    });
    channelRows = rows.filter((row) => {
      const record = asRecord(row);
      const rowScope = String(record.org_unit_type || record.target_scope || record.scope || "").trim();
      const rowKey = String(record.store_id || record.target_key || record.key || record.store_code || "").trim();
      const rowDepartmentId = String(record.department_id || "").trim();
      const rowType = String(record.target_type || record.type || "channel").trim();
      const enabledValue = String(record.enabled ?? record.is_enabled ?? "true").trim().toLowerCase();
      const enabled = !["false", "0", "no", "disabled"].includes(enabledValue);
      const matchesStore = rowScope === targetScope && targetKeys.includes(rowKey);
      const matchesDepartment = rowScope === "department" && departmentId && rowDepartmentId === departmentId;
      return (matchesStore || matchesDepartment) && rowType === "channel" && enabled;
    }).slice(0, 1);
  } catch (error) {
    return {
      ok: true,
      postId,
      eligible: false,
      reason: "channel_lookup_failed",
      target: {
        scope: targetScope,
        key: targetKeys[0] || "",
        candidateKeys: targetKeys,
        targetType: "channel",
        configured: false,
      },
      source: "nov-hub-api-proxy",
      detail: sanitizeErrorDetail(error instanceof PortalError ? error.detail || error.message : error),
      guards: ideaLinkNotificationPreviewGuards(),
    };
  }
  const channel = asRecord(channelRows[0] || {});
  const configured = Boolean(channel.id || channel.channel_id || channel.target_key);
  return {
    ok: true,
    postId,
    eligible: configured,
    reason: configured ? "" : "channel_not_configured",
    target: {
      scope: targetScope,
      key: String(channel.store_id || channel.department_id || channel.target_key || targetKeys[0] || ""),
      candidateKeys: targetKeys,
      targetType: "channel",
      configured,
    },
    source: "nov-hub-api-proxy",
    guards: ideaLinkNotificationPreviewGuards(),
  };
}

function ideaLinkNotificationPreviewGuards() {
  return {
    dbMutationExpected: false,
    notificationEnqueued: false,
    lineWorksNotificationSent: false,
    notificationIdScopedSendRequired: true,
    existingQueuedRowsTouched: false,
    browserDirectTableAccess: false,
    browserDirectRpcExecute: false,
  };
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
  let customClaims: JsonRecord = {};
  try {
    customClaims = user.customAttributes ? JSON.parse(String(user.customAttributes)) as JsonRecord : {};
  } catch (_error) {
    customClaims = {};
  }
  return {
    authType: "firebase",
    email: normalizeEmail(user.email),
    displayName: String(user.displayName || ""),
    uid: String(user.localId || ""),
    employeeIdClaim: String(customClaims.employee_id || customClaims.employeeId || ""),
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

function isDecisionInactiveEmploymentStatus(value: unknown) {
  const status = String(value || "");
  return /退職|休職|産休|育休/.test(status);
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

function indexById(rows: JsonRecord[]): Record<string, JsonRecord> {
  return rows.reduce<Record<string, JsonRecord>>((index, row) => {
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

async function groupRolesByEmployeeForAdmin(): Promise<Record<string, { role_keys: string[]; role_names: string[] }>> {
  const [roles, employeeRoles] = await Promise.all([
    listCoreMaster("roles", "id,role_key,role_name", "role_no.asc").catch(() => []),
    listEmployeeRolesForAdmin().catch(() => []),
  ]);
  const rolesById = indexById(roles as JsonRecord[]);
  return (employeeRoles as JsonRecord[]).reduce<Record<string, { role_keys: string[]; role_names: string[] }>>((grouped, employeeRole) => {
    const employeeId = String(employeeRole.employee_id || "");
    const role = (rolesById[String(employeeRole.role_id || "")] || {}) as JsonRecord;
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

function groupStoreAssignmentsByEmployeeForAdmin(assignments: JsonRecord[], storesById: Record<string, JsonRecord>): Record<string, JsonRecord[]> {
  return assignments.reduce<Record<string, JsonRecord[]>>((grouped, assignment) => {
    const employeeId = String(assignment.employee_id || "");
    if (!employeeId || assignment.is_active === false) return grouped;
    const store = (storesById[String(assignment.store_id || "")] || {}) as JsonRecord;
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
    isPrimary: row.is_primary !== false,
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
    profile_image_updated: true,
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
    employeeLineWorksDestinationsByEmployee,
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
    indexEmployeeLineWorksDestinationsForAdmin().catch(() => ({})),
  ]);
  const corporationsById = indexById(corporations);
  const storesById = indexById(stores);
  const departmentsById = indexById(departments);
  const positionsById = indexById(positions);
  const jobTypesById = indexById(jobTypes as JsonRecord[]);
  const rolesByEmployeeMap = rolesByEmployee as Record<string, { role_keys: string[]; role_names: string[] }>;
  const credentialsByEmployeeMap = credentialsByEmployee as Record<string, ReturnType<typeof sanitizeLoginCredential>>;
  const profileImagesByEmployeeMap = profileImagesByEmployee as Record<string, ReturnType<typeof sanitizeEmployeeProfileImage>>;
  const employeeLineWorksDestinationsByEmployeeMap = employeeLineWorksDestinationsByEmployee as Record<string, ReturnType<typeof sanitizeEmployeeLineWorksDestination>>;
  const storeAssignmentsByEmployee = groupStoreAssignmentsByEmployeeForAdmin(assignments as JsonRecord[], storesById);
  return employees.map((employee) => {
    const source = (employee.source_row || {}) as JsonRecord;
    const corporation = (corporationsById[String(employee.corporation_id || "")] || {}) as JsonRecord;
    const store = (storesById[String(employee.store_id || "")] || {}) as JsonRecord;
    const department = (departmentsById[String(employee.department_id || "")] || {}) as JsonRecord;
    const position = (positionsById[String(employee.position_id || "")] || {}) as JsonRecord;
    const jobType = (jobTypesById[String(employee.job_type_id || "")] || {}) as JsonRecord;
    const roleGroup = rolesByEmployeeMap[String(employee.id || "")] || { role_keys: [], role_names: [] };
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
      login_credential: credentialsByEmployeeMap[String(employee.id || "")] || null,
      profile_image: profileImagesByEmployeeMap[String(employee.id || "")] || null,
      line_works_destination: employeeLineWorksDestinationsByEmployeeMap[String(employee.id || "")] || null,
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

function maskLineWorksRecipientIdForAdmin(value: unknown) {
  const text = String(value || "").trim();
  if (!text) return "";
  if (text.length <= 8) return "設定済み";
  return `${text.slice(0, 4)}${"*".repeat(Math.min(8, Math.max(4, text.length - 8)))}${text.slice(-4)}`;
}

async function indexEmployeeLineWorksDestinationsForAdmin() {
  const rows = await readRows("notification_destinations", {
    schema: "os",
    query: {
      select: "id,provider,target_type,target_id,channel_id,channel_name,purpose,is_active,updated_at",
      provider: "eq.line_works",
      target_type: "eq.employee",
      purpose: "eq.primary",
      limit: "2000",
    },
  }).catch(() => []);
  return (rows as JsonRecord[]).reduce<Record<string, ReturnType<typeof sanitizeEmployeeLineWorksDestination>>>((index, row) => {
    const employeeId = String(row.target_id || "");
    if (!employeeId) return index;
    index[employeeId] = sanitizeEmployeeLineWorksDestination({
      configured: Boolean(String(row.channel_id || "").trim()) && row.is_active !== false,
      line_works_recipient_id_masked: maskLineWorksRecipientIdForAdmin(row.channel_id),
      line_works_target_id_masked: maskLineWorksRecipientIdForAdmin(row.channel_id),
      purpose: row.purpose,
      is_active: row.is_active !== false,
      updated_at: row.updated_at,
      employee_id: employeeId,
      display_name: row.channel_name,
    }, employeeId, "primary");
    return index;
  }, {});
}

function sanitizeStoreBusinessProfile(row: JsonRecord | null) {
  if (!row) return null;
  return {
    regular_holiday_rule: String(row.regular_holiday_rule || ""),
    weekday_business_hours: String(row.weekday_business_hours || ""),
    saturday_business_hours: String(row.saturday_business_hours || ""),
    sunday_business_hours: String(row.sunday_business_hours || ""),
    holiday_business_hours: String(row.holiday_business_hours || ""),
    opened_on: row.opened_on || null,
    closed_on: row.closed_on || null,
    floor_area_tsubo: row.floor_area_tsubo ?? null,
    floor_area_square_meter: row.floor_area_square_meter ?? null,
    monthly_rent_including_common_fee: row.monthly_rent_including_common_fee ?? null,
    rent_per_tsubo: row.rent_per_tsubo ?? null,
    styling_seat_count: row.styling_seat_count ?? null,
    shampoo_station_count: row.shampoo_station_count ?? null,
    rent_per_styling_seat: row.rent_per_styling_seat ?? null,
    affiliation_label: String(row.affiliation_label || ""),
    operating_status: String(row.operating_status || ""),
    store_feature_note: String(row.store_feature_note || ""),
    updated_at: row.updated_at || null,
  };
}

function sanitizeCorporationBusinessProfile(row: JsonRecord | null) {
  if (!row) return null;
  return {
    formal_corporation_name: String(row.formal_corporation_name || ""),
    corporation_number: String(row.corporation_number || ""),
    invoice_registration_number: String(row.invoice_registration_number || ""),
    representative_name: String(row.representative_name || ""),
    head_office_address: String(row.head_office_address || ""),
    phone_number: String(row.phone_number || ""),
    fiscal_year_end_month: row.fiscal_year_end_month ?? null,
    payroll_closing_day: String(row.payroll_closing_day || ""),
    payroll_payment_day: String(row.payroll_payment_day || ""),
    accounting_category: String(row.accounting_category || ""),
    social_insurance_status: String(row.social_insurance_status || ""),
    labor_insurance_status: String(row.labor_insurance_status || ""),
    tax_accountant_label: String(row.tax_accountant_label || ""),
    labor_consultant_label: String(row.labor_consultant_label || ""),
    operating_status: String(row.operating_status || ""),
    established_on: row.established_on || null,
    closed_on: row.closed_on || null,
    corporation_feature_note: String(row.corporation_feature_note || ""),
    updated_at: row.updated_at || null,
  };
}

function indexStoreBusinessProfiles(rows: JsonRecord[]) {
  return rows.reduce<Record<string, ReturnType<typeof sanitizeStoreBusinessProfile>>>((index, row) => {
    const storeId = String(row.store_id || "");
    if (storeId) index[storeId] = sanitizeStoreBusinessProfile(row);
    return index;
  }, {});
}

async function getStoreBusinessProfile(storeId: string) {
  const rows = await readRows("store_business_profiles", {
    query: {
      select: STORE_BUSINESS_PROFILE_SELECT,
      store_id: `eq.${storeId}`,
      limit: "1",
    },
  });
  return rows[0] || null;
}

function indexCorporationBusinessProfiles(rows: JsonRecord[]) {
  return rows.reduce<Record<string, ReturnType<typeof sanitizeCorporationBusinessProfile>>>((index, row) => {
    const corporationId = String(row.corporation_id || "");
    if (corporationId) index[corporationId] = sanitizeCorporationBusinessProfile(row);
    return index;
  }, {});
}

async function getCorporationBusinessProfile(corporationId: string) {
  const rows = await readRows("corporation_business_profiles", {
    query: {
      select: CORPORATION_BUSINESS_PROFILE_SELECT,
      corporation_id: `eq.${corporationId}`,
      limit: "1",
    },
  });
  return rows[0] || null;
}

async function listCoreCorporationsForAdmin() {
  const [corporations, profiles] = await Promise.all([
    readRows("corporations", {
      query: {
        select: "id,corporation_no,corporation_name,is_active",
        order: "corporation_no.asc",
        limit: "200",
      },
    }),
    readRows("corporation_business_profiles", {
      query: {
        select: CORPORATION_BUSINESS_PROFILE_SELECT,
        limit: "200",
      },
    }),
  ]);
  const profilesById = indexCorporationBusinessProfiles(profiles);
  return corporations.map((corporation) => ({
    ...corporation,
    business_profile: profilesById[String(corporation.id || "")] || null,
  }));
}

async function listCoreStoresForAdmin() {
  const [stores, profiles, destinations, corporations, businessUnits] = await Promise.all([
    readRows("stores", {
      query: {
        select: "id,store_no,store_id,store_name,corporation_id,business_unit_id,area,store_type,is_active,updated_at",
        order: "store_no.asc",
        limit: "500",
      },
    }),
    readRows("store_business_profiles", {
      query: {
        select: STORE_BUSINESS_PROFILE_SELECT,
        limit: "500",
      },
    }),
    indexStoreLineWorksDestinations(),
    listCoreMaster("corporations", "id,corporation_no,corporation_name", "corporation_no.asc"),
    listCoreMaster("business_units", "id,business_unit_code,business_unit_name", "business_unit_no.asc"),
  ]);
  const profilesById = indexStoreBusinessProfiles(profiles);
  const corporationsById = indexById(corporations);
  const businessUnitsById = indexById(businessUnits);
  return stores.map((store) => {
    const corporation = (corporationsById[String(store.corporation_id || "")] || {}) as JsonRecord;
    const businessUnit = (businessUnitsById[String(store.business_unit_id || "")] || {}) as JsonRecord;
    return {
      ...store,
      corporation_name: String(corporation.corporation_name || ""),
      corporation_code: String(corporation.corporation_no || ""),
      business_unit_name: String(businessUnit.business_unit_name || ""),
      business_unit_code: String(businessUnit.business_unit_code || ""),
      business_profile: profilesById[String(store.id || "")] || null,
      line_works_channel: sanitizeLineWorksDestination((destinations[String(store.id || "")] || null) as JsonRecord | null),
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

function copyNullableNumberField(target: JsonRecord, source: JsonRecord, fieldName: string) {
  if (!Object.prototype.hasOwnProperty.call(source, fieldName)) return;
  const raw = String(source[fieldName] ?? "").replace(/,/g, "").trim();
  if (!raw) {
    target[fieldName] = null;
    return;
  }
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) {
    throw new PortalError("INVALID_REQUEST", `${fieldName} must be a non-negative number.`, 400);
  }
  target[fieldName] = value;
}

function copyNullableIntegerField(target: JsonRecord, source: JsonRecord, fieldName: string) {
  if (!Object.prototype.hasOwnProperty.call(source, fieldName)) return;
  const raw = String(source[fieldName] ?? "").replace(/,/g, "").trim();
  if (!raw) {
    target[fieldName] = null;
    return;
  }
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 0) {
    throw new PortalError("INVALID_REQUEST", `${fieldName} must be a non-negative integer.`, 400);
  }
  target[fieldName] = value;
}

function copyNullableIntegerFieldInRange(target: JsonRecord, source: JsonRecord, fieldName: string, minValue: number, maxValue: number) {
  if (!Object.prototype.hasOwnProperty.call(source, fieldName)) return;
  const raw = String(source[fieldName] ?? "").replace(/,/g, "").trim();
  if (!raw) {
    target[fieldName] = null;
    return;
  }
  const value = Number(raw);
  if (!Number.isInteger(value) || value < minValue || value > maxValue) {
    throw new PortalError("INVALID_REQUEST", `${fieldName} must be an integer from ${minValue} to ${maxValue}.`, 400);
  }
  target[fieldName] = value;
}

function buildCorporationBusinessProfileUpdates(payload: JsonRecord, actor: JsonRecord) {
  const updates: JsonRecord = {};
  CORPORATION_BUSINESS_PROFILE_STRING_FIELDS.forEach((fieldName) => copyStringField(updates, payload, fieldName));
  CORPORATION_BUSINESS_PROFILE_DATE_FIELDS.forEach((fieldName) => copyDateField(updates, payload, fieldName));
  CORPORATION_BUSINESS_PROFILE_INTEGER_FIELDS.forEach((fieldName) => copyNullableIntegerFieldInRange(updates, payload, fieldName, 1, 12));
  if (!Object.keys(updates).length) return updates;
  updates.source_system = "hub_dashboard";
  updates.updated_by_employee_id = getActorEmployeeId(actor);
  updates.updated_at = new Date().toISOString();
  return updates;
}

function hasMeaningfulCorporationBusinessProfileValue(updates: JsonRecord) {
  return Object.entries(updates).some(([key, value]) => (
    !["source_system", "updated_by_employee_id", "updated_at"].includes(key)
    && value !== null
    && value !== ""
    && value !== undefined
  ));
}

function buildStoreBusinessProfileUpdates(payload: JsonRecord, actor: JsonRecord) {
  const updates: JsonRecord = {};
  STORE_BUSINESS_PROFILE_STRING_FIELDS.forEach((fieldName) => copyStringField(updates, payload, fieldName));
  STORE_BUSINESS_PROFILE_DATE_FIELDS.forEach((fieldName) => copyDateField(updates, payload, fieldName));
  STORE_BUSINESS_PROFILE_NUMBER_FIELDS.forEach((fieldName) => copyNullableNumberField(updates, payload, fieldName));
  STORE_BUSINESS_PROFILE_INTEGER_FIELDS.forEach((fieldName) => copyNullableIntegerField(updates, payload, fieldName));
  if (!Object.keys(updates).length) return updates;
  updates.source_system = "hub_dashboard";
  updates.updated_by_employee_id = getActorEmployeeId(actor);
  updates.updated_at = new Date().toISOString();
  return updates;
}

function hasMeaningfulStoreBusinessProfileValue(updates: JsonRecord) {
  return Object.entries(updates).some(([key, value]) => (
    !["source_system", "updated_by_employee_id", "updated_at"].includes(key)
    && value !== null
    && value !== ""
    && value !== undefined
  ));
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

function isUuid(value: unknown) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || "").trim());
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

async function getRolesByKeys(roleKeys: string[]): Promise<Record<string, JsonRecord>> {
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
  return rows.reduce<Record<string, JsonRecord>>((index, role) => {
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
  const existingByRoleId = existingRows.reduce<Record<string, JsonRecord>>((index, row) => {
    index[String(row.role_id || "")] = row;
    return index;
  }, {} as Record<string, JsonRecord>);
  const beforeRoleKeys = allowedRoleKeys.filter((roleKey) => {
    const role = rolesByKey[roleKey] as JsonRecord;
    const existing = existingByRoleId[String(role.id || "")];
    return existing && existing.is_active !== false;
  });
  const desired = new Set(desiredRoleKeys);

  await Promise.all(allowedRoleKeys.map(async (roleKey) => {
    const role = rolesByKey[roleKey] as JsonRecord;
    const existing = (existingByRoleId[String(role.id || "")] || null) as JsonRecord | null;
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

function assertNoClientActorOverride(payload: JsonRecord) {
  const forbiddenKeys = ["actorEmployeeId", "actor", "createdBy", "updatedBy", "p_actor_employee_id"];
  const foundKey = forbiddenKeys.find((key) => Object.prototype.hasOwnProperty.call(payload, key));
  if (foundKey) throw new PortalError("INVALID_REQUEST", `${foundKey} must be resolved by Edge backend.`, 400);
}

function normalizeLineWorksPurpose(value: unknown) {
  return String(value || "primary").trim() || "primary";
}

function sanitizeEmployeeLineWorksDestination(row: JsonRecord | null, employeeId: string, purpose: string) {
  if (!row) {
    return {
      configured: false,
      lineWorksRecipientIdMasked: "",
      lineWorksTargetIdMasked: "",
      purpose,
      isActive: false,
      updatedAt: "",
      employeeId,
    };
  }
  return {
    configured: row.configured === true || String(row.configured || "").toLowerCase() === "true",
    lineWorksRecipientIdMasked: String(row.line_works_recipient_id_masked || ""),
    lineWorksTargetIdMasked: String(row.line_works_target_id_masked || row.line_works_recipient_id_masked || ""),
    channel_id: String(row.line_works_recipient_id_masked || ""),
    channel_name: String(row.display_name || ""),
    purpose: String(row.purpose || purpose),
    isActive: row.is_active !== false,
    updatedAt: String(row.updated_at || ""),
    employeeId: String(row.employee_id || employeeId),
    displayName: String(row.display_name || ""),
  };
}

async function getEmployeeLineWorksDestination(employeeId: string, purpose = "primary") {
  const rows = await callSupabaseRpc("get_employee_line_works_destination", {
    p_employee_id: employeeId,
    p_purpose: normalizeLineWorksPurpose(purpose),
  }, "os");
  const list = Array.isArray(rows) ? rows as JsonRecord[] : [];
  return sanitizeEmployeeLineWorksDestination(list[0] || null, employeeId, normalizeLineWorksPurpose(purpose));
}

async function upsertEmployeeLineWorksDestination(payload: JsonRecord, actor: JsonRecord) {
  assertNoClientActorOverride(payload);
  const employeeId = String(payload.employeeId || payload.employee_id || "").trim();
  const actorEmployeeId = getActorEmployeeId(actor);
  const lineWorksRecipientId = String(payload.lineWorksRecipientId || payload.lineWorksTargetId || "").trim();
  const displayName = String(payload.displayName || "").trim();
  const purpose = normalizeLineWorksPurpose(payload.purpose);
  if (!isUuid(employeeId)) throw new PortalError("INVALID_REQUEST", "Employee id is invalid.", 400);
  if (!actorEmployeeId || !isUuid(actorEmployeeId)) throw new PortalError("INVALID_REQUEST", "Actor employee id is invalid.", 400);
  if (!lineWorksRecipientId) throw new PortalError("INVALID_REQUEST", "LINE WORKS recipient id is required.", 400);
  await callSupabaseRpc("upsert_employee_line_works_destination", {
    p_employee_id: employeeId,
    p_line_works_user_id: lineWorksRecipientId,
    p_channel_name: displayName || null,
    p_purpose: purpose,
    p_actor_employee_id: actorEmployeeId,
  }, "os");
  return await getEmployeeLineWorksDestination(employeeId, purpose);
}

async function disableEmployeeLineWorksDestination(payload: JsonRecord, actor: JsonRecord) {
  assertNoClientActorOverride(payload);
  const employeeId = String(payload.employeeId || payload.employee_id || "").trim();
  const actorEmployeeId = getActorEmployeeId(actor);
  const purpose = normalizeLineWorksPurpose(payload.purpose);
  const reasonCode = String(payload.reasonCode || payload.reason_code || "manual_disable").trim() || "manual_disable";
  if (!isUuid(employeeId)) throw new PortalError("INVALID_REQUEST", "Employee id is invalid.", 400);
  if (!actorEmployeeId || !isUuid(actorEmployeeId)) throw new PortalError("INVALID_REQUEST", "Actor employee id is invalid.", 400);
  if (!["manual_disable", "employee_left", "admin_correction"].includes(reasonCode)) {
    throw new PortalError("INVALID_REQUEST", "Reason code is invalid.", 400);
  }
  const result = await callSupabaseRpc("disable_employee_line_works_destination", {
    p_employee_id: employeeId,
    p_purpose: purpose,
    p_reason_code: reasonCode,
    p_actor_employee_id: actorEmployeeId,
  }, "os");
  return {
    ...sanitizeEmployeeLineWorksDestination(null, employeeId, purpose),
    disabledCount: Number(result || 0),
  };
}

function assertNoDecisionActorOverride(payload: JsonRecord) {
  // Decision read-only actions only target applications by applicationId.
  // Actor-like client payload is always rejected and resolved server-side.
  const forbiddenKeys = [
    "actorEmployeeId",
    "actor_employee_id",
    "actor",
    "createdBy",
    "updatedBy",
    "p_actor_employee_id",
    "employeeId",
    "employee_id",
    "roleKeys",
    "scope",
    "scope_type",
    "scope_id",
  ];
  const foundKey = forbiddenKeys.find((key) => Object.prototype.hasOwnProperty.call(payload, key));
  if (foundKey) throw new PortalError("INVALID_REQUEST", `${foundKey} is not allowed for Decision Hub actions.`, 400);
}

function assertDecisionSaveDraftPayload(payload: JsonRecord) {
  const allowedKeys = new Set([
    "authType",
    "applicationId",
    "applicationType",
    "title",
    "purpose",
    "targetCorporationId",
    "targetDepartmentId",
    "targetStoreId",
    "desiredDecisionDate",
  ]);
  const forbiddenKeys = new Set([
    "actor",
    "actorEmployeeId",
    "actor_employee_id",
    "employeeId",
    "employee_id",
    "publicEmployeeId",
    "coreEmployeeId",
    "createdBy",
    "updatedBy",
    "p_actor_employee_id",
    "roles",
    "roleKeys",
    "scope",
    "scope_type",
    "scope_id",
    "summary",
    "application_id",
    "application_no",
    "applicationNo",
    "is_active",
    "isActive",
    "archived_at",
    "archivedAt",
    "voided_at",
    "voidedAt",
    "created_at",
    "createdAt",
    "updated_at",
    "updatedAt",
    "status",
    "statusOverride",
    "approverEmployeeId",
    "approver_employee_id",
    "finalApproverEmployeeId",
    "audit",
    "auditMetadata",
    "metadata",
    "notification",
    "notificationPayload",
    "comment",
    "commentBody",
    "attachment",
    "attachmentMetadata",
    "storagePath",
    "storage_path",
    "signedUrl",
    "signed_url",
    "fileName",
    "file_name",
    "rawFilename",
  ]);
  for (const key of Object.keys(payload)) {
    if (forbiddenKeys.has(key) || !allowedKeys.has(key)) {
      throw new PortalError("INVALID_REQUEST", `${key} is not allowed for Decision Hub draft save.`, 400);
    }
  }
}

async function normalizeDecisionActor(employee: JsonRecord | null) {
  if (!employee || !isUuid(employee.id)) throw new PortalError("ACTOR_UNRESOLVED", "Decision Hub actor was not resolved.", 403);
  if (!isEmployeeActive(employee) || isDecisionInactiveEmploymentStatus(employee.employment_status)) {
    throw new PortalError("ACTOR_INACTIVE", "Decision Hub actor is inactive.", 403);
  }
  const credential = await getCredentialByEmployeeId(String(employee.id || ""));
  if (credential && credential.login_enabled === false) {
    throw new PortalError("ACTOR_LOGIN_DISABLED", "Decision Hub actor login is disabled.", 403);
  }
  const normalized = await normalizeEmployee(employee, credential);
  if (!normalized || !getActorEmployeeId(normalized)) {
    throw new PortalError("ACTOR_UNRESOLVED", "Decision Hub actor normalization failed.", 403);
  }
  return normalized;
}

async function resolveDecisionActor(authUser: JsonRecord, trustedEmployee?: JsonRecord | null) {
  if (String(authUser.authType || "").trim().toLowerCase() === "pin") {
    const credential = authUser.credential as JsonRecord | null;
    const credentialEmployeeId = String(credential?.employee_id || "").trim();
    const trustedEmployeeId = String(trustedEmployee?.id || "").trim();
    if (!isUuid(credentialEmployeeId) || !isUuid(trustedEmployeeId) || credentialEmployeeId !== trustedEmployeeId) {
      throw new PortalError("ACTOR_CONFIDENCE_REQUIRED", "Decision Hub PIN actor credential mismatch.", 403);
    }
    return await normalizeDecisionActor(trustedEmployee || null);
  }

  const uid = String(authUser.uid || "").trim();
  const claimEmployeeId = String(authUser.employeeIdClaim || "").trim();

  if (claimEmployeeId) {
    if (!isUuid(claimEmployeeId)) throw new PortalError("ACTOR_UNRESOLVED", "Decision Hub actor claim is invalid.", 403);
    const employee = await getEmployeeById(claimEmployeeId);
    if (!employee) throw new PortalError("ACTOR_UNRESOLVED", "Decision Hub actor claim was not found.", 403);
    const employeeFirebaseUid = String(employee.firebase_uid || "").trim();
    if (uid && employeeFirebaseUid && employeeFirebaseUid !== uid) {
      throw new PortalError("ACTOR_CONFIDENCE_REQUIRED", "Decision Hub actor claim conflicts with auth uid.", 403);
    }
    return await normalizeDecisionActor(employee);
  }

  if (uid) {
    const rows = await readRows("employees", {
      query: {
        select: "id,employee_id,full_name,email,employment_status,employment_type,corporation_id,store_id,department_id,position_id,job_type_id,firebase_uid,is_active,source_row",
        firebase_uid: `eq.${uid}`,
        limit: "2",
      },
    });
    if (rows.length !== 1) throw new PortalError("ACTOR_UNRESOLVED", "Decision Hub actor was not uniquely resolved.", 403);
    return await normalizeDecisionActor(rows[0]);
  }

  throw new PortalError("ACTOR_CONFIDENCE_REQUIRED", "Decision Hub does not accept email fallback actor resolution.", 403);
}

function stripDecisionInternalFields(value: unknown, options: { allowCommentBody?: boolean } = {}): unknown {
  if (Array.isArray(value)) return value.map((item) => stripDecisionInternalFields(item, options));
  if (!value || typeof value !== "object") return value;
  const forbiddenKeys = new Set([
    "storage_path",
    "storagePath",
    "signed_url",
    "signedUrl",
    "file_name",
    "fileName",
    "service_role",
    "serviceRole",
    "authorization",
    "authToken",
    "token",
  ]);
  const result: JsonRecord = {};
  Object.entries(value as JsonRecord).forEach(([key, child]) => {
    if (forbiddenKeys.has(key)) return;
    if (!options.allowCommentBody && key === "body") return;
    result[key] = stripDecisionInternalFields(child, options);
  });
  return result;
}

function normalizeDecisionLimit(value: unknown) {
  const limit = Math.trunc(Number(value || 50));
  if (!Number.isFinite(limit)) return 50;
  return Math.max(1, Math.min(limit, 100));
}

function normalizeOptionalUuid(value: unknown, fieldName: string) {
  const text = String(value || "").trim();
  if (!text) return null;
  if (!isUuid(text)) throw new PortalError("INVALID_REQUEST", `${fieldName} is invalid.`, 400);
  return text;
}

function normalizeOptionalDate(value: unknown, fieldName: string) {
  const text = String(value || "").trim();
  if (!text) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) throw new PortalError("INVALID_REQUEST", `${fieldName} must be YYYY-MM-DD.`, 400);
  return text;
}

function sanitizeDecisionDraftSaveResult(value: unknown) {
  const row = value && typeof value === "object" ? value as JsonRecord : {};
  return {
    ok: row.ok === true,
    applicationId: String(row.applicationId || ""),
    status: String(row.status || ""),
    isDraft: row.isDraft === true,
    updatedAt: String(row.updatedAt || ""),
  };
}

async function listDecisionApplications(payload: JsonRecord, actor: JsonRecord) {
  assertNoDecisionActorOverride(payload);
  const actorEmployeeId = getActorEmployeeId(actor);
  if (!actorEmployeeId) throw new PortalError("ACTOR_UNRESOLVED", "Decision Hub actor was not resolved.", 403);
  const result = await callSupabaseRpc("decision_list_applications", {
    p_actor_employee_id: actorEmployeeId,
    p_limit: normalizeDecisionLimit(payload.limit),
    p_status: String(payload.status || "").trim() || null,
  }, "public");
  return stripDecisionInternalFields(result);
}

async function getDecisionApplicationDetail(payload: JsonRecord, actor: JsonRecord) {
  assertNoDecisionActorOverride(payload);
  const actorEmployeeId = getActorEmployeeId(actor);
  if (!actorEmployeeId) throw new PortalError("ACTOR_UNRESOLVED", "Decision Hub actor was not resolved.", 403);
  const applicationId = String(payload.applicationId || "").trim();
  if (!isUuid(applicationId)) throw new PortalError("INVALID_REQUEST", "Application id is invalid.", 400);
  const result = await callSupabaseRpc("decision_get_application_detail", {
    p_actor_employee_id: actorEmployeeId,
    p_application_id: applicationId,
  }, "public");
  return stripDecisionInternalFields(result);
}

async function listDecisionComments(payload: JsonRecord, actor: JsonRecord) {
  assertNoDecisionActorOverride(payload);
  const actorEmployeeId = getActorEmployeeId(actor);
  if (!actorEmployeeId) throw new PortalError("ACTOR_UNRESOLVED", "Decision Hub actor was not resolved.", 403);
  const applicationId = String(payload.applicationId || "").trim();
  if (!isUuid(applicationId)) throw new PortalError("INVALID_REQUEST", "Application id is invalid.", 400);
  const result = await callSupabaseRpc("decision_list_comments", {
    p_actor_employee_id: actorEmployeeId,
    p_application_id: applicationId,
  }, "public");
  return stripDecisionInternalFields(result, { allowCommentBody: true });
}

async function getCoreCorporationById(id: string) {
  const rows = await readRows("corporations", {
    query: {
      select: "id,corporation_no,corporation_name,is_active",
      id: `eq.${id}`,
      limit: "1",
    },
  });
  return rows[0] || null;
}

async function getCoreCorporationByNo(corporationNo: string) {
  const normalizedNo = String(corporationNo || "").trim();
  if (!normalizedNo) return null;
  const rows = await readRows("corporations", {
    query: {
      select: "id,corporation_no,corporation_name,is_active",
      corporation_no: `eq.${normalizedNo}`,
      limit: "1",
    },
  });
  return rows[0] || null;
}

function normalizeCorporationNoForWrite(value: unknown) {
  const text = String(value || "").trim();
  if (!text) return "";
  if (!/^[0-9A-Za-z_-]{1,40}$/.test(text)) {
    throw new PortalError("INVALID_REQUEST", "Corporation no must be 1-40 ASCII letters, numbers, hyphens, or underscores.", 400);
  }
  return text;
}

function generateProvisionalCorporationNo() {
  const timestamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
  const suffix = crypto.randomUUID().slice(0, 8).toUpperCase();
  return `TMP-${timestamp}-${suffix}`;
}

async function saveDecisionDraftApplication(payload: JsonRecord, actor: JsonRecord) {
  assertDecisionSaveDraftPayload(payload);
  const actorEmployeeId = getActorEmployeeId(actor);
  if (!actorEmployeeId) throw new PortalError("ACTOR_UNRESOLVED", "Decision Hub actor was not resolved.", 403);
  const result = await callSupabaseRpc("decision_save_draft_application", {
    p_actor_employee_id: actorEmployeeId,
    p_application_id: normalizeOptionalUuid(payload.applicationId, "applicationId"),
    p_application_type: String(payload.applicationType || "").trim(),
    p_title: String(payload.title || "").trim(),
    p_purpose: String(payload.purpose || "").trim() || null,
    p_target_corporation_id: normalizeOptionalUuid(payload.targetCorporationId, "targetCorporationId"),
    p_target_department_id: normalizeOptionalUuid(payload.targetDepartmentId, "targetDepartmentId"),
    p_target_store_id: normalizeOptionalUuid(payload.targetStoreId, "targetStoreId"),
    p_desired_decision_date: normalizeOptionalDate(payload.desiredDecisionDate, "desiredDecisionDate"),
  }, "public");
  return sanitizeDecisionDraftSaveResult(result);
}

async function createCoreCorporation(payload: JsonRecord, actor: JsonRecord) {
  const requestedCorporationNo = normalizeCorporationNoForWrite(payload.corporation_no || payload.corporationNo || "");
  const corporationNo = requestedCorporationNo || generateProvisionalCorporationNo();
  const corporationName = String(payload.corporation_name || payload.corporationName || "").trim();
  if (!corporationName) throw new PortalError("INVALID_REQUEST", "Corporation name is required.", 400);

  const existing = await getCoreCorporationByNo(corporationNo);
  if (existing?.id) throw new PortalError("CONFLICT", "Corporation no already exists.", 409);

  const rows = await readRows("corporations", {
    method: "POST",
    query: { select: "id,corporation_no,corporation_name,is_active" },
    payload: {
      corporation_no: corporationNo,
      corporation_name: corporationName,
      is_active: parseBooleanLike(payload.is_active, true),
    },
    prefer: "return=representation",
  });
  const created = rows[0];
  if (!created?.id) throw new PortalError("CREATE_FAILED", "Corporation was not created.", 500);
  const createdId = String(created.id);

  await appendMasterChangeLog("corporations", createdId, {
    corporation_no: corporationNo,
    corporation_name: corporationName,
    is_active: created.is_active,
  }, actor, {
    actionType: "create",
    targetName: corporationName,
  });

  const profileUpdates = buildCorporationBusinessProfileUpdates(payload, actor);
  let afterProfile = null;
  if (hasMeaningfulCorporationBusinessProfileValue(profileUpdates)) {
    const profileRows = await readRows("corporation_business_profiles", {
      method: "POST",
      query: {
        on_conflict: "corporation_id",
        select: CORPORATION_BUSINESS_PROFILE_SELECT,
      },
      payload: {
        corporation_id: createdId,
        ...profileUpdates,
      },
      prefer: "resolution=merge-duplicates,return=representation",
    });
    afterProfile = profileRows[0] || null;
    await appendMasterChangeLog("corporation_business_profiles", createdId, {
      changed_profile_fields: Object.keys(profileUpdates).filter((key) => !["updated_at", "updated_by_employee_id"].includes(key)),
    }, actor, {
      actionType: "update_corporation_business_profile",
      targetName: corporationName,
    });
  }

  return {
    ...created,
    business_profile: sanitizeCorporationBusinessProfile(afterProfile),
  };
}

async function updateCoreCorporation(payload: JsonRecord, actor: JsonRecord) {
  const id = String(payload.id || "").trim();
  if (!id) throw new PortalError("INVALID_REQUEST", "Corporation id is required.", 400);
  const before = await getCoreCorporationById(id);
  if (!before?.id) throw new PortalError("NOT_FOUND", "Corporation was not found.", 404);
  const beforeProfile = await getCorporationBusinessProfile(id);

  const updates: JsonRecord = {};
  if (Object.prototype.hasOwnProperty.call(payload, "corporation_no")) {
    const corporationNo = normalizeCorporationNoForWrite(payload.corporation_no);
    if (!corporationNo) throw new PortalError("INVALID_REQUEST", "Corporation no is required.", 400);
    const existing = await getCoreCorporationByNo(corporationNo);
    if (existing?.id && String(existing.id) !== id) {
      throw new PortalError("CONFLICT", "Corporation no already exists.", 409);
    }
    updates.corporation_no = corporationNo;
  }
  copyStringField(updates, payload, "corporation_name");
  if (Object.prototype.hasOwnProperty.call(payload, "is_active")) updates.is_active = parseBooleanLike(payload.is_active, true);
  const changedUpdates = getChangedFields(before, updates);
  let after = before;
  if (Object.keys(changedUpdates).length) {
    const rows = await readRows("corporations", {
      method: "PATCH",
      query: { id: `eq.${id}`, select: "*" },
      payload: changedUpdates,
      prefer: "return=representation",
    });
    after = rows[0] || before;
    await appendMasterChangeLog("corporations", id, changedUpdates, actor, {
      actionType: "update",
      targetName: String(after.corporation_name || before.corporation_name || ""),
    });
  }

  const profileUpdates = buildCorporationBusinessProfileUpdates(payload, actor);
  const changedProfileUpdates = getChangedFields(beforeProfile || {}, profileUpdates);
  let afterProfile = beforeProfile;
  if (Object.keys(changedProfileUpdates).length && (beforeProfile?.corporation_id || hasMeaningfulCorporationBusinessProfileValue(profileUpdates))) {
    const rows = await readRows("corporation_business_profiles", {
      method: "POST",
      query: {
        on_conflict: "corporation_id",
        select: CORPORATION_BUSINESS_PROFILE_SELECT,
      },
      payload: {
        corporation_id: id,
        ...profileUpdates,
      },
      prefer: "resolution=merge-duplicates,return=representation",
    });
    afterProfile = rows[0] || beforeProfile;
    await appendMasterChangeLog("corporation_business_profiles", id, {
      changed_profile_fields: Object.keys(changedProfileUpdates).filter((key) => !["updated_at", "updated_by_employee_id"].includes(key)),
    }, actor, {
      actionType: "update_corporation_business_profile",
      targetName: String(after.corporation_name || before.corporation_name || ""),
    });
  }

  return {
    ...after,
    business_profile: sanitizeCorporationBusinessProfile(afterProfile),
  };
}

async function updateCoreStore(payload: JsonRecord, actor: JsonRecord) {
  const id = String(payload.id || "").trim();
  if (!id) throw new PortalError("INVALID_REQUEST", "Store id is required.", 400);
  const before = await getCoreStoreById(id);
  if (!before?.id) throw new PortalError("NOT_FOUND", "Store was not found.", 404);
  const beforeProfile = await getStoreBusinessProfile(id);
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
  const profileUpdates = buildStoreBusinessProfileUpdates(payload, actor);
  const changedProfileUpdates = getChangedFields(beforeProfile || {}, profileUpdates);
  let afterProfile = beforeProfile;
  if (Object.keys(changedProfileUpdates).length && (beforeProfile?.store_id || hasMeaningfulStoreBusinessProfileValue(profileUpdates))) {
    const rows = await readRows("store_business_profiles", {
      method: "POST",
      query: {
        on_conflict: "store_id",
        select: STORE_BUSINESS_PROFILE_SELECT,
      },
      payload: {
        store_id: id,
        ...profileUpdates,
      },
      prefer: "resolution=merge-duplicates,return=representation",
    });
    afterProfile = rows[0] || beforeProfile;
    await appendMasterChangeLog("store_business_profiles", id, {
      changed_profile_fields: Object.keys(changedProfileUpdates).filter((key) => !["updated_at", "updated_by_employee_id"].includes(key)),
    }, actor, {
      actionType: "update_store_business_profile",
      targetName: String(after.store_name || before.store_name || ""),
    });
  }
  const lineWorksDestination = await updateStoreLineWorksDestinationIfPresent(id, payload, actor, after);
  return {
    ...after,
    business_profile: sanitizeStoreBusinessProfile(afterProfile),
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
    listCoreCorporationsForAdmin(),
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
  const urlKey = normalizeAppUrlKey(app.url);
  if (id) return `app:${id}`;
  if (urlKey) return `url:${urlKey}`;
  return `name:${name}`;
}

function appDedupeScore(app: ReturnType<typeof normalizeApp>) {
  let score = Number(app.priority || 999);
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

function ensureMasterAdminApp(apps: ReturnType<typeof normalizeApp>[], employee: JsonRecord) {
  if (!canViewMasterAdmin(employee)) return apps;
  if (apps.some((app) => app.appId === "core-master-admin")) return apps;
  const masterAdminApp = fixedApps(employee).find((app) => app.appId === "core-master-admin");
  return masterAdminApp ? [...apps, masterAdminApp] : apps;
}

async function readVisibleApps(employee: JsonRecord) {
  const rows = await readRows("portal_apps", {
    query: {
      select: "*",
      order: "priority.asc,app_name.asc",
    },
  }).catch(() => []);
  let apps = rows.map(normalizeApp);
  if (!apps.length) {
    apps = fixedApps(employee);
  }
  apps = ensureMasterAdminApp(apps, employee);
  apps = apps.filter((app) => canAccessApp(employee, app));
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

    if (action === "ideaLinkTimelineRead") {
      assertIdeaLinkUser(employee);
      return jsonResponse({ ok: true, timeline: await readIdeaLinkTimeline(employee, payload), performance: { source: "nov-hub-api-proxy" } });
    }

    if (action === "ideaLinkMyPageRead") {
      return jsonResponse({ ok: true, myPage: await readIdeaLinkMyPage(employee, payload), performance: { source: "nov-hub-api-proxy" } });
    }

    if (action === "ideaLinkAdminSummaryRead") {
      return jsonResponse({ ok: true, admin: await readIdeaLinkAdminSummary(employee, payload), performance: { source: "nov-hub-api-proxy" } });
    }

    if (action === "ideaLinkMonthlyMvpPreviewRead") {
      return jsonResponse({ ok: true, monthlyMvp: await readIdeaLinkMonthlyMvpPreview(employee, payload), performance: { source: "nov-hub-api-proxy" } });
    }

    if (action === "ideaLinkPostCreate") {
      return jsonResponse({ ok: true, result: await createIdeaLinkPost(employee, payload), performance: { source: "nov-hub-api-proxy" } });
    }

    if (action === "ideaLinkNotificationPreview") {
      return jsonResponse({ ok: true, result: await previewIdeaLinkPostNotification(employee, payload), performance: { source: "nov-hub-api-proxy" } });
    }

    if (action === "ideaLinkRecipientSearch") {
      return jsonResponse({ ok: true, result: await searchIdeaLinkRecipients(employee, payload), performance: { source: "nov-hub-api-proxy" } });
    }

    if (action === "ideaLinkStoreOptions") {
      return jsonResponse({ ok: true, result: await getIdeaLinkStoreOptions(employee), performance: { source: "nov-hub-api-proxy" } });
    }

    if (action === "markNovHubNotificationRead") {
      return jsonResponse({ ok: true, result: await markNovHubNotificationsRead(employee, payload) });
    }

    if (action === "changeOwnPin") {
      return jsonResponse({ ok: true, credential: await changeOwnPin(employee, payload) });
    }

    if (action === "decisionListApplications") {
      const decisionActor = await resolveDecisionActor(authUser, employee);
      return jsonResponse({ ok: true, applications: await listDecisionApplications(payload, decisionActor) });
    }

    if (action === "decisionGetApplicationDetail") {
      const decisionActor = await resolveDecisionActor(authUser, employee);
      return jsonResponse({ ok: true, application: await getDecisionApplicationDetail(payload, decisionActor) });
    }

    if (action === "decisionListComments") {
      const decisionActor = await resolveDecisionActor(authUser, employee);
      return jsonResponse({ ok: true, comments: await listDecisionComments(payload, decisionActor) });
    }

    if (action === "decisionSaveDraftApplication") {
      const decisionActor = await resolveDecisionActor(authUser, employee);
      return jsonResponse({ ok: true, draft: await saveDecisionDraftApplication(payload, decisionActor) });
    }

    if (action === "masterBootstrap") {
      assertMasterViewer(employee);
      return jsonResponse({ ok: true, data: await getMasterBootstrap(employee) });
    }

    if (action === "masterListEmployees") {
      assertMasterViewer(employee);
      return jsonResponse({ ok: true, employees: await listCoreEmployeesForAdmin() });
    }

    if (action === "masterListCorporations") {
      assertMasterViewer(employee);
      return jsonResponse({ ok: true, corporations: await listCoreCorporationsForAdmin() });
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

    if (action === "masterUpsertEmployeeLineWorksDestination") {
      assertMasterEditor(employee);
      return jsonResponse({ ok: true, destination: await upsertEmployeeLineWorksDestination(payload, employee) });
    }

    if (action === "masterDisableEmployeeLineWorksDestination") {
      assertMasterEditor(employee);
      return jsonResponse({ ok: true, destination: await disableEmployeeLineWorksDestination(payload, employee) });
    }

    if (action === "masterCreateEmployee") {
      assertMasterEditor(employee);
      return jsonResponse({ ok: true, employee: await createCoreEmployee(payload, employee) });
    }

    if (action === "masterUpdateEmployee") {
      assertMasterEditor(employee);
      return jsonResponse({ ok: true, employee: await updateCoreEmployee(payload, employee) });
    }

    if (action === "masterCreateCorporation") {
      assertMasterEditor(employee);
      return jsonResponse({ ok: true, corporation: await createCoreCorporation(payload, employee) });
    }

    if (action === "masterUpdateCorporation") {
      assertMasterEditor(employee);
      return jsonResponse({ ok: true, corporation: await updateCoreCorporation(payload, employee) });
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
