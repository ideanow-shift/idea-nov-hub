import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

type ApiResponse = Record<string, unknown>;
type SessionPayload = {
  loginId: string;
  storeId: string;
  name: string;
  admin: boolean;
  exp: number;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function json(body: ApiResponse, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "content-type": "application/json; charset=utf-8",
    },
  });
}

async function readPayload(request: Request): Promise<Record<string, unknown>> {
  if (request.method === "GET") {
    return Object.fromEntries(new URL(request.url).searchParams.entries());
  }

  const contentType = request.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return await request.json();
  }

  const form = await request.formData();
  return Object.fromEntries(form.entries());
}

function getString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function normalizeArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];
}

function splitList(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item) => typeof item === "string" && item.trim()).map((item) => item.trim());
  return getString(value)
    .split(/[\n,、]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseLinks(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (typeof value !== "string" || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function normalizeRating(value: unknown): "up" | "down" | null {
  const rating = getString(value).trim().toLowerCase();
  if (rating === "up" || rating === "good" || rating === "👍") return "up";
  if (rating === "down" || rating === "bad" || rating === "👎") return "down";
  return null;
}

function normalizeRiskLevel(value: unknown): "normal" | "sensitive" | "high" {
  const riskLevel = getString(value).trim().toLowerCase();
  if (riskLevel === "high" || riskLevel === "高") return "high";
  if (riskLevel === "sensitive" || riskLevel === "注意") return "sensitive";
  return "normal";
}

function normalizeLogSource(value: unknown): "rule" | "fallback" | "manual" | "ai_adapter" {
  const source = getString(value).trim().toLowerCase();
  if (source === "fallback" || source === "未整備") return "fallback";
  if (source === "manual" || source === "system" || source === "nov navigator") return "manual";
  if (source === "ai_adapter" || source === "ai" || source === "adapter") return "ai_adapter";
  return "rule";
}

function notificationPurposeForRoute(routeId: string): string {
  const routeKey = routeId.replace(/[^a-z0-9_-]/gi, "_").toLowerCase();
  return `concierge.department_inquiry.${routeKey}`;
}

function toBoolean(value: unknown): boolean {
  if (value === true) return true;
  if (value === false) return false;
  const normalized = getString(value).trim().toLowerCase();
  return ["true", "1", "yes", "y", "必要", "要確認"].includes(normalized);
}

function normalizeActive(value: unknown): boolean {
  if (value === true) return true;
  if (value === false) return false;
  const activeText = getString(value).trim().toLowerCase();
  return !["false", "0", "no", "n", "停止", "無効", "不可", "inactive", "disabled"].includes(activeText);
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function stringToBase64Url(value: string): string {
  return bytesToBase64Url(new TextEncoder().encode(value));
}

function base64UrlToString(value: string): string {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

async function signValue(value: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return bytesToBase64Url(new Uint8Array(signature));
}

async function createSessionToken(payload: SessionPayload, secret: string): Promise<string> {
  const encodedPayload = stringToBase64Url(JSON.stringify(payload));
  const signature = await signValue(encodedPayload, secret);
  return `${encodedPayload}.${signature}`;
}

async function verifySessionToken(token: string, secret: string): Promise<SessionPayload | null> {
  try {
    const [encodedPayload, signature] = token.split(".");
    if (!encodedPayload || !signature) return null;

    const expected = await signValue(encodedPayload, secret);
    if (expected !== signature) return null;

    const payload = JSON.parse(base64UrlToString(encodedPayload)) as SessionPayload;
    if (!payload.exp || payload.exp < Date.now()) return null;
    if (!payload.loginId || !payload.storeId) return null;
    return payload;
  } catch {
    return null;
  }
}

async function requireSession(
  payload: Record<string, unknown>,
  secret: string,
): Promise<{ ok: true; session: SessionPayload } | { ok: false; response: Response }> {
  const token = getString(payload.sessionToken || payload.token).trim();
  const session = token ? await verifySessionToken(token, secret) : null;
  if (!session) {
    return { ok: false, response: json({ ok: false, error: "ログイン情報を確認できませんでした。" }, 401) };
  }
  return { ok: true, session };
}

async function requireAdmin(
  payload: Record<string, unknown>,
  secret: string,
): Promise<{ ok: true } | { ok: false; response: Response }> {
  const auth = await requireSession(payload, secret);
  if (!auth.ok) return auth;
  if (!auth.session.admin) {
    return { ok: false, response: json({ ok: false, error: "管理者権限がありません。" }, 403) };
  }
  return { ok: true };
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const sessionSecret = Deno.env.get("CONCIERGE_SESSION_SECRET") || serviceRoleKey;

    if (!supabaseUrl || !serviceRoleKey) {
      return json({ ok: false, error: "API設定が不足しています。" }, 500);
    }

    const payload = await readPayload(request);
    const action = getString(payload.action) || new URL(request.url).pathname.split("/").pop() || "";

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    if (action === "login" || action === "login-store") {
      const loginId = getString(payload.loginId || payload.storeId).trim().toLowerCase();
      const password = getString(payload.password || payload.storePass);

      if (!loginId || !password) {
        return json({ ok: false, error: "店舗IDと店舗PASSを入力してください。" }, 400);
      }

      const { data, error } = await supabase.rpc("concierge_login_store", {
        p_login_id: loginId,
        p_password: password,
      });

      if (error) {
        console.error("concierge_login_store failed", error);
        return json({ ok: false, error: "ログイン確認に失敗しました。" }, 500);
      }

      const row = Array.isArray(data) ? data[0] : null;
      if (!row) {
        return json({ ok: false, error: "店舗IDまたは店舗PASSが違います。" }, 401);
      }

      return json({
        ok: true,
        id: row.login_id,
        loginId: row.login_id,
        storeId: row.store_id,
        name: row.store_name,
        admin: row.is_admin,
        sessionToken: await createSessionToken({
          loginId: row.login_id,
          storeId: row.store_id,
          name: row.store_name,
          admin: Boolean(row.is_admin),
          exp: Date.now() + 1000 * 60 * 60 * 12,
        }, sessionSecret),
        source: "supabase",
      });
    }

    if (action === "listAnswerRules") {
      const includeInactive = ["true", "1", "yes"].includes(
        getString(payload.includeInactive).trim().toLowerCase(),
      );
      if (includeInactive) {
        const admin = await requireAdmin(payload, sessionSecret);
        if (!admin.ok) return admin.response;
      }

      let query = supabase
        .from("concierge_answer_rules")
        .select(
          "id, keywords, notebook_category, answer, link_ids, risk_level, requires_human_check, is_active, priority",
        )
        .order("priority", { ascending: false })
        .order("id", { ascending: true });

      if (!includeInactive) {
        query = query.eq("is_active", true);
      }

      const { data, error } = await query;

      if (error) {
        console.error("listAnswerRules failed", error);
        return json({ ok: false, error: "回答ルールを取得できませんでした。" }, 500);
      }

      return json({
        ok: true,
        rules: (data || []).map((row) => ({
          id: row.id,
          keywords: normalizeArray(row.keywords),
          notebook: row.notebook_category,
          notebookCategory: row.notebook_category,
          answer: row.answer,
          linkIds: normalizeArray(row.link_ids),
          riskLevel: row.risk_level,
          requiresHumanCheck: Boolean(row.requires_human_check),
          active: row.is_active ? "有効" : "停止",
          priority: row.priority,
        })),
      });
    }

    if (action === "listLogs") {
      const admin = await requireAdmin(payload, sessionSecret);
      if (!admin.ok) return admin.response;

      const limitRaw = Number(getString(payload.limit) || "300");
      const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 500) : 300;

      const { data: logs, error } = await supabase
        .from("concierge_question_logs")
        .select("id, store_id, phase1_login_id, question, answer, notebook_category, links, source, risk_level, needs_human_check, created_at")
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) {
        console.error("listLogs failed", error);
        return json({ ok: false, error: "質問ログを取得できませんでした。" }, 500);
      }

      const logRows = logs || [];
      const logIds = logRows.map((row) => row.id);
      const storeIds = [...new Set(logRows.map((row) => row.store_id).filter(Boolean))];

      const { data: feedbackRows, error: feedbackError } = logIds.length
        ? await supabase
          .from("concierge_feedback")
          .select("question_log_id, rating, created_at")
          .in("question_log_id", logIds)
          .order("created_at", { ascending: false })
        : { data: [], error: null };

      if (feedbackError) {
        console.error("listLogs feedback failed", feedbackError);
        return json({ ok: false, error: "評価ログを取得できませんでした。" }, 500);
      }

      const { data: storeRows, error: storeError } = storeIds.length
        ? await supabase
          .from("stores")
          .select("id, store_name")
          .in("id", storeIds)
        : { data: [], error: null };

      if (storeError) {
        console.error("listLogs stores failed", storeError);
        return json({ ok: false, error: "店舗情報を取得できませんでした。" }, 500);
      }

      const feedbackByLogId = new Map<string, string>();
      for (const feedback of feedbackRows || []) {
        if (!feedbackByLogId.has(feedback.question_log_id)) {
          feedbackByLogId.set(feedback.question_log_id, feedback.rating);
        }
      }

      const storeNameById = new Map<string, string>();
      for (const store of storeRows || []) {
        storeNameById.set(store.id, store.store_name);
      }

      return json({
        ok: true,
        logs: logRows.map((row) => ({
          id: row.id,
          createdAt: row.created_at,
          storeId: row.phase1_login_id || row.store_id,
          storeUuid: row.store_id,
          phase1LoginId: row.phase1_login_id,
          storeName: storeNameById.get(row.store_id) || row.phase1_login_id || "不明",
          question: row.question,
          answer: row.answer || "",
          notebook: row.notebook_category || "",
          links: Array.isArray(row.links) ? row.links : [],
          source: row.source || "rule",
          riskLevel: row.risk_level || "normal",
          needsHumanCheck: Boolean(row.needs_human_check),
          rating: feedbackByLogId.get(row.id) || null,
        })),
      });
    }

    if (action === "listLinks") {
      const includeInactive = ["true", "1", "yes"].includes(
        getString(payload.includeInactive).trim().toLowerCase(),
      );
      if (includeInactive) {
        const admin = await requireAdmin(payload, sessionSecret);
        if (!admin.ok) return admin.response;
      }

      let query = supabase
        .from("concierge_link_master")
        .select("id, label, href, category, owner, description, is_active, sort_order")
        .order("sort_order", { ascending: true })
        .order("label", { ascending: true });

      if (!includeInactive) {
        query = query.eq("is_active", true);
      }

      const { data, error } = await query;

      if (error) {
        console.error("listLinks failed", error);
        return json({ ok: false, error: "リンクマスタを取得できませんでした。" }, 500);
      }

      return json({
        ok: true,
        links: (data || []).map((row) => ({
          id: row.id,
          label: row.label,
          href: row.href,
          category: row.category || "",
          owner: row.owner || "",
          description: row.description || "",
          active: row.is_active ? "有効" : "停止",
          isActive: Boolean(row.is_active),
          sortOrder: row.sort_order,
        })),
      });
    }

    if (action === "updateLink") {
      const admin = await requireAdmin(payload, sessionSecret);
      if (!admin.ok) return admin.response;

      const linkId = getString(payload.linkId || payload.id).trim();
      const label = getString(payload.label).trim();
      const href = getString(payload.href).trim();
      const category = getString(payload.category).trim();
      const owner = getString(payload.owner).trim();
      const description = getString(payload.description).trim();
      const activeText = getString(payload.active).trim().toLowerCase();
      const isActive = !["false", "0", "no", "n", "停止", "無効", "不可", "inactive"].includes(activeText);
      const sortOrderRaw = Number(getString(payload.sortOrder || payload.sort_order) || "100");
      const sortOrder = Number.isFinite(sortOrderRaw) ? sortOrderRaw : 100;

      if (!linkId || !label || !href) {
        return json({ ok: false, error: "リンク更新に必要な情報が不足しています。" }, 400);
      }

      const { data: existing, error: existingError } = await supabase
        .from("concierge_link_master")
        .select("id")
        .eq("id", linkId)
        .maybeSingle();

      if (existingError) {
        console.error("updateLink lookup failed", existingError);
        return json({ ok: false, error: "リンクを確認できませんでした。" }, 500);
      }

      if (!existing) {
        return json({ ok: false, error: "更新対象のリンクが見つかりません。" }, 404);
      }

      const { error } = await supabase
        .from("concierge_link_master")
        .update({
          label,
          href,
          category: category || null,
          owner: owner || null,
          description: description || null,
          is_active: isActive,
          sort_order: sortOrder,
          updated_at: new Date().toISOString(),
        })
        .eq("id", linkId);

      if (error) {
        console.error("updateLink failed", error);
        return json({ ok: false, error: "リンクを更新できませんでした。" }, 500);
      }

      return json({ ok: true, linkId });
    }

    if (action === "listKnowledgeUpdates") {
      const admin = await requireAdmin(payload, sessionSecret);
      if (!admin.ok) return admin.response;

      const { data, error } = await supabase
        .from("concierge_knowledge_updates")
        .select("id, area_id, area_name, owner, memo, source, notebook_url, drive_folder_url, updated_by_label, created_at")
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) {
        console.error("listKnowledgeUpdates failed", error);
        return json({ ok: false, error: "ナレッジ更新履歴を取得できませんでした。" }, 500);
      }

      return json({
        ok: true,
        updates: (data || []).map((row) => ({
          id: row.id,
          areaId: row.area_id || "",
          areaName: row.area_name || "",
          owner: row.owner || "",
          memo: row.memo || "",
          source: row.source || "",
          notebookUrl: row.notebook_url || "",
          driveFolderUrl: row.drive_folder_url || "",
          updatedBy: row.updated_by_label || "",
          createdAt: row.created_at,
        })),
      });
    }

    if (action === "listDepartmentRoutes") {
      const auth = await requireSession(payload, sessionSecret);
      if (!auth.ok) return auth.response;

      const { data, error } = await supabase
        .from("concierge_department_routes")
        .select("id, department_name, owner, is_active, sort_order")
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
        .order("department_name", { ascending: true });

      if (error) {
        console.error("listDepartmentRoutes failed", error);
        return json({ ok: false, error: "問い合わせ先を取得できませんでした。" }, 500);
      }

      const purposes = (data || []).map((row) => notificationPurposeForRoute(row.id));
      const { data: destinations, error: destinationError } = purposes.length
        ? await supabase
          .schema("os")
          .from("notification_destinations")
          .select("purpose, channel_name, is_active")
          .eq("provider", "line_works")
          .eq("target_type", "global")
          .in("purpose", purposes)
          .eq("is_active", true)
        : { data: [], error: null };

      if (destinationError) {
        console.error("listDepartmentRoutes destinations failed", destinationError);
      }

      const destinationByPurpose = new Map<string, { channel_name?: string }>();
      for (const destination of destinations || []) {
        destinationByPurpose.set(String(destination.purpose || ""), destination);
      }

      return json({
        ok: true,
        routes: (data || []).map((row) => ({
          id: row.id,
          departmentName: row.department_name,
          owner: row.owner || "",
          notificationPurpose: notificationPurposeForRoute(row.id),
          notificationConfigured: destinationByPurpose.has(notificationPurposeForRoute(row.id)),
          notificationChannelName: destinationByPurpose.get(notificationPurposeForRoute(row.id))?.channel_name || "",
          sortOrder: row.sort_order,
        })),
      });
    }

    if (action === "createDepartmentInquiry") {
      const auth = await requireSession(payload, sessionSecret);
      if (!auth.ok) return auth.response;

      const routeId = getString(payload.routeId || payload.route_id).trim();
      const questionLogId = getString(payload.questionLogId || payload.question_log_id).trim();
      const subject = getString(payload.subject).trim();
      const body = getString(payload.body).trim();

      if (!routeId || !subject || !body) {
        return json({ ok: false, error: "問い合わせに必要な情報が不足しています。" }, 400);
      }

      const { data: route, error: routeError } = await supabase
        .from("concierge_department_routes")
        .select("id, department_name, is_active")
        .eq("id", routeId)
        .eq("is_active", true)
        .maybeSingle();

      if (routeError) {
        console.error("createDepartmentInquiry route lookup failed", routeError);
        return json({ ok: false, error: "問い合わせ先を確認できませんでした。" }, 500);
      }

      if (!route) {
        return json({ ok: false, error: "問い合わせ先が見つかりません。" }, 404);
      }

      if (questionLogId) {
        const { data: log, error: logError } = await supabase
          .from("concierge_question_logs")
          .select("id, store_id, phase1_login_id")
          .eq("id", questionLogId)
          .maybeSingle();

        if (logError) {
          console.error("createDepartmentInquiry log lookup failed", logError);
          return json({ ok: false, error: "質問ログを確認できませんでした。" }, 500);
        }

        if (log && (log.store_id !== auth.session.storeId || log.phase1_login_id !== auth.session.loginId)) {
          return json({ ok: false, error: "問い合わせ対象ログの権限を確認できませんでした。" }, 403);
        }
      }

      const notificationPurpose = notificationPurposeForRoute(route.id);
      const { data: destination, error: destinationError } = await supabase
        .schema("os")
        .from("notification_destinations")
        .select("id, channel_name")
        .eq("provider", "line_works")
        .eq("target_type", "global")
        .eq("purpose", notificationPurpose)
        .eq("is_active", true)
        .maybeSingle();

      if (destinationError) {
        console.error("createDepartmentInquiry destination lookup failed", destinationError);
      }

      const { data: inquiry, error } = await supabase
        .from("concierge_department_inquiries")
        .insert({
          route_id: route.id,
          store_id: auth.session.storeId,
          phase1_login_id: auth.session.loginId,
          question_log_id: questionLogId || null,
          subject,
          inquiry_text: body,
          status: "queued",
          notification_error: destinationError
            ? "notification_destination_lookup_failed"
            : destination
              ? null
              : "notification_destination_not_configured",
        })
        .select("id, notification_error")
        .single();

      if (error) {
        console.error("createDepartmentInquiry failed", error);
        return json({ ok: false, error: "問い合わせを保存できませんでした。" }, 500);
      }

      return json({
        ok: true,
        inquiryId: inquiry.id,
        routeName: route.department_name,
        delivery: "queued",
        notificationPurpose,
        notificationConfigured: Boolean(destination),
        notificationChannelName: destination?.channel_name || "",
        notificationError: inquiry.notification_error || "",
      });
    }

    if (action === "listDepartmentInquiries") {
      const admin = await requireAdmin(payload, sessionSecret);
      if (!admin.ok) return admin.response;

      const limitRaw = Number(getString(payload.limit) || "100");
      const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 300) : 100;

      const { data: inquiries, error } = await supabase
        .from("concierge_department_inquiries")
        .select("id, route_id, store_id, phase1_login_id, question_log_id, subject, inquiry_text, status, notification_id, notification_error, created_at, updated_at")
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) {
        console.error("listDepartmentInquiries failed", error);
        return json({ ok: false, error: "部門問い合わせログを取得できませんでした。" }, 500);
      }

      const rows = inquiries || [];
      const routeIds = [...new Set(rows.map((row) => row.route_id).filter(Boolean))];
      const storeIds = [...new Set(rows.map((row) => row.store_id).filter(Boolean))];

      const { data: routes, error: routesError } = routeIds.length
        ? await supabase
          .from("concierge_department_routes")
          .select("id, department_name")
          .in("id", routeIds)
        : { data: [], error: null };

      if (routesError) {
        console.error("listDepartmentInquiries routes failed", routesError);
      }

      const { data: stores, error: storesError } = storeIds.length
        ? await supabase
          .from("stores")
          .select("id, store_name")
          .in("id", storeIds)
        : { data: [], error: null };

      if (storesError) {
        console.error("listDepartmentInquiries stores failed", storesError);
      }

      const purposes = routeIds.map((routeId) => notificationPurposeForRoute(String(routeId)));
      const { data: destinations, error: destinationError } = purposes.length
        ? await supabase
          .schema("os")
          .from("notification_destinations")
          .select("purpose, channel_name, is_active")
          .eq("provider", "line_works")
          .eq("target_type", "global")
          .in("purpose", purposes)
          .eq("is_active", true)
        : { data: [], error: null };

      if (destinationError) {
        console.error("listDepartmentInquiries destinations failed", destinationError);
      }

      const routeNameById = new Map<string, string>();
      for (const route of routes || []) {
        routeNameById.set(String(route.id), String(route.department_name || route.id));
      }

      const storeNameById = new Map<string, string>();
      for (const store of stores || []) {
        storeNameById.set(String(store.id), String(store.store_name || store.id));
      }

      const destinationByPurpose = new Map<string, { channel_name?: string }>();
      for (const destination of destinations || []) {
        destinationByPurpose.set(String(destination.purpose || ""), destination);
      }

      return json({
        ok: true,
        inquiries: rows.map((row) => {
          const routeId = String(row.route_id || "");
          const purpose = notificationPurposeForRoute(routeId);
          const destination = destinationByPurpose.get(purpose);
          return {
            id: row.id,
            routeId,
            routeName: routeNameById.get(routeId) || routeId,
            storeId: row.store_id,
            storeName: storeNameById.get(String(row.store_id || "")) || row.phase1_login_id || "",
            phase1LoginId: row.phase1_login_id || "",
            questionLogId: row.question_log_id || "",
            subject: row.subject || "",
            inquiryText: row.inquiry_text || "",
            status: row.status || "queued",
            notificationId: row.notification_id || "",
            notificationError: row.notification_error || "",
            notificationPurpose: purpose,
            notificationConfigured: Boolean(destination),
            notificationChannelName: destination?.channel_name || "",
            createdAt: row.created_at,
            updatedAt: row.updated_at,
          };
        }),
      });
    }

    if (action === "appendKnowledgeUpdate") {
      const admin = await requireAdmin(payload, sessionSecret);
      if (!admin.ok) return admin.response;
      const auth = await requireSession(payload, sessionSecret);
      if (!auth.ok) return auth.response;
      const phase1LoginId = auth.session.loginId;

      const updateId = getString(payload.updateId || payload.id).trim();
      const areaId = getString(payload.areaId).trim();
      const areaName = getString(payload.areaName).trim();
      const owner = getString(payload.owner).trim();
      const memo = getString(payload.memo).trim();
      const source = getString(payload.source).trim() || "manual";
      const updatedBy = getString(payload.updatedBy || payload.updatedByLabel).trim() || phase1LoginId;
      const createdAt = getString(payload.createdAt).trim();
      const notebookUrl = getString(payload.notebookUrl || payload.notebook_url).trim();
      const driveFolderUrl = getString(payload.driveFolderUrl || payload.drive_folder_url).trim();

      if (!updateId || !memo) {
        return json({ ok: false, error: "ナレッジ更新履歴の保存に必要な情報が不足しています。" }, 400);
      }

      const { error } = await supabase
        .from("concierge_knowledge_updates")
        .upsert({
          id: updateId,
          area_id: areaId || null,
          area_name: areaName || null,
          owner: owner || null,
          memo,
          source: source === "NOV Concierge" ? "manual" : source,
          notebook_url: notebookUrl || null,
          drive_folder_url: driveFolderUrl || null,
          updated_by_label: updatedBy,
          created_at: createdAt || new Date().toISOString(),
        }, { onConflict: "id" });

      if (error) {
        console.error("appendKnowledgeUpdate failed", error);
        return json({ ok: false, error: "ナレッジ更新履歴を保存できませんでした。" }, 500);
      }

      return json({ ok: true, updateId });
    }

    if (action === "appendAnswerRule") {
      const admin = await requireAdmin(payload, sessionSecret);
      if (!admin.ok) return admin.response;
      const auth = await requireSession(payload, sessionSecret);
      if (!auth.ok) return auth.response;
      const phase1LoginId = auth.session.loginId;

      const ruleId = getString(payload.ruleId || payload.id).trim();
      const keywords = splitList(payload.keywords);
      const notebook = getString(payload.notebook || payload.notebookCategory).trim();
      const answer = getString(payload.answer).trim();
      const linkIds = splitList(payload.linkIds || payload.link_ids);
      const priorityRaw = Number(getString(payload.priority) || "10");
      const priority = Number.isFinite(priorityRaw) ? priorityRaw : 10;
      const isActive = normalizeActive(payload.active);
      const riskLevel = normalizeRiskLevel(payload.riskLevel || payload.risk_level);
      const requiresHumanCheck = riskLevel === "high" || toBoolean(payload.requiresHumanCheck || payload.requires_human_check);

      if (!ruleId || !keywords.length || !answer) {
        return json({ ok: false, error: "回答ルール保存に必要な情報が不足しています。" }, 400);
      }

      const { error } = await supabase
        .from("concierge_answer_rules")
        .upsert({
          id: ruleId,
          keywords,
          notebook_category: notebook || null,
          answer,
          link_ids: linkIds,
          risk_level: riskLevel,
          requires_human_check: requiresHumanCheck,
          is_active: isActive,
          priority,
          owner: phase1LoginId,
          updated_at: new Date().toISOString(),
        }, { onConflict: "id" });

      if (error) {
        console.error("appendAnswerRule failed", error);
        return json({ ok: false, error: "回答ルールを保存できませんでした。" }, 500);
      }

      return json({ ok: true, ruleId });
    }

    if (action === "updateAnswerRule") {
      const admin = await requireAdmin(payload, sessionSecret);
      if (!admin.ok) return admin.response;

      const ruleId = getString(payload.ruleId || payload.id).trim();
      const keywords = splitList(payload.keywords);
      const notebook = getString(payload.notebook || payload.notebookCategory).trim();
      const answer = getString(payload.answer).trim();
      const linkIds = splitList(payload.linkIds || payload.link_ids);
      const priorityRaw = Number(getString(payload.priority) || "10");
      const priority = Number.isFinite(priorityRaw) ? priorityRaw : 10;
      const isActive = normalizeActive(payload.active);
      const riskLevel = normalizeRiskLevel(payload.riskLevel || payload.risk_level);
      const requiresHumanCheck = riskLevel === "high" || toBoolean(payload.requiresHumanCheck || payload.requires_human_check);

      if (!ruleId || !keywords.length || !answer) {
        return json({ ok: false, error: "回答ルール更新に必要な情報が不足しています。" }, 400);
      }

      const { data: existing, error: existingError } = await supabase
        .from("concierge_answer_rules")
        .select("id")
        .eq("id", ruleId)
        .maybeSingle();

      if (existingError) {
        console.error("updateAnswerRule lookup failed", existingError);
        return json({ ok: false, error: "回答ルールを確認できませんでした。" }, 500);
      }

      if (!existing) {
        return json({ ok: false, error: "更新対象の回答ルールが見つかりません。" }, 404);
      }

      const { error } = await supabase
        .from("concierge_answer_rules")
        .update({
          keywords,
          notebook_category: notebook || null,
          answer,
          link_ids: linkIds,
          risk_level: riskLevel,
          requires_human_check: requiresHumanCheck,
          is_active: isActive,
          priority,
          updated_at: new Date().toISOString(),
        })
        .eq("id", ruleId);

      if (error) {
        console.error("updateAnswerRule failed", error);
        return json({ ok: false, error: "回答ルールを更新できませんでした。" }, 500);
      }

      return json({ ok: true, ruleId });
    }

    if (action === "appendLog") {
      const auth = await requireSession(payload, sessionSecret);
      if (!auth.ok) return auth.response;

      const logId = getString(payload.logId).trim();
      const storeId = getString(payload.storeId).trim();
      const phase1LoginId = getString(payload.phase1LoginId || payload.loginId).trim().toLowerCase();
      const question = getString(payload.question).trim();
      const answer = getString(payload.answer);
      const notebook = getString(payload.notebook || payload.notebookCategory);
      const links = parseLinks(payload.links);
      const createdAt = getString(payload.createdAt).trim();
      const rating = normalizeRating(payload.rating);
      const riskLevel = normalizeRiskLevel(payload.riskLevel || payload.risk_level);
      const needsHumanCheck = riskLevel === "high" || toBoolean(payload.needsHumanCheck || payload.needs_human_check);
      const source = normalizeLogSource(payload.source);

      if (!logId || !storeId || !phase1LoginId || !question) {
        return json({ ok: false, error: "ログ保存に必要な情報が不足しています。" }, 400);
      }

      if (auth.session.loginId !== phase1LoginId || auth.session.storeId !== storeId) {
        return json({ ok: false, error: "ログ保存権限を確認できませんでした。" }, 403);
      }

      const { data: credential, error: credentialError } = await supabase
        .from("concierge_store_credentials")
        .select("login_id, store_id, is_active")
        .eq("login_id", phase1LoginId)
        .eq("store_id", storeId)
        .eq("is_active", true)
        .maybeSingle();

      if (credentialError) {
        console.error("appendLog credential check failed", credentialError);
        return json({ ok: false, error: "ログ保存前の確認に失敗しました。" }, 500);
      }

      if (!credential) {
        return json({ ok: false, error: "ログ保存権限を確認できませんでした。" }, 401);
      }

      const { error } = await supabase
        .from("concierge_question_logs")
        .upsert({
          id: logId,
          store_id: storeId,
          phase1_login_id: phase1LoginId,
          question,
          answer,
          notebook_category: notebook || null,
          links,
          source,
          risk_level: riskLevel,
          needs_human_check: needsHumanCheck,
          created_at: createdAt || new Date().toISOString(),
        }, { onConflict: "id" });

      if (error) {
        console.error("appendLog failed", error);
        return json({ ok: false, error: "質問ログを保存できませんでした。" }, 500);
      }

      if (rating) {
        const { error: feedbackError } = await supabase
          .from("concierge_feedback")
          .insert({
            question_log_id: logId,
            rating,
            store_id: storeId,
            phase1_login_id: phase1LoginId,
          });

        if (feedbackError && feedbackError.code !== "23505") {
          console.error("appendLog feedback insert failed", feedbackError);
          return json({ ok: false, error: "評価を保存できませんでした。" }, 500);
        }
      }

      return json({ ok: true, logId });
    }

    if (action === "updateRating") {
      const auth = await requireSession(payload, sessionSecret);
      if (!auth.ok) return auth.response;

      const logId = getString(payload.logId).trim();
      const rating = normalizeRating(payload.rating);
      const phase1LoginId = getString(payload.phase1LoginId || payload.loginId).trim().toLowerCase();

      if (!logId || !rating) {
        return json({ ok: false, error: "評価保存に必要な情報が不足しています。" }, 400);
      }

      const { data: log, error: logError } = await supabase
        .from("concierge_question_logs")
        .select("id, store_id, phase1_login_id")
        .eq("id", logId)
        .maybeSingle();

      if (logError) {
        console.error("updateRating log lookup failed", logError);
        return json({ ok: false, error: "評価対象ログを確認できませんでした。" }, 500);
      }

      if (!log) {
        return json({ ok: false, error: "評価対象ログが見つかりません。" }, 404);
      }

      const feedbackLoginId = phase1LoginId || auth.session.loginId || log.phase1_login_id;
      const ownsLog = log.phase1_login_id === auth.session.loginId && log.store_id === auth.session.storeId;
      if (!auth.session.admin && (!ownsLog || feedbackLoginId !== auth.session.loginId)) {
        return json({ ok: false, error: "評価保存権限を確認できませんでした。" }, 403);
      }
      const { data: existing, error: existingError } = await supabase
        .from("concierge_feedback")
        .select("id")
        .eq("question_log_id", logId)
        .eq("phase1_login_id", feedbackLoginId)
        .maybeSingle();

      if (existingError) {
        console.error("updateRating feedback lookup failed", existingError);
        return json({ ok: false, error: "評価の確認に失敗しました。" }, 500);
      }

      const feedbackPayload = {
        question_log_id: logId,
        rating,
        store_id: log.store_id,
        phase1_login_id: feedbackLoginId,
      };

      const { error } = existing
        ? await supabase.from("concierge_feedback").update({ rating }).eq("id", existing.id)
        : await supabase.from("concierge_feedback").insert(feedbackPayload);

      if (error) {
        console.error("updateRating failed", error);
        return json({ ok: false, error: "評価を保存できませんでした。" }, 500);
      }

      return json({ ok: true, logId, rating });
    }

    return json({ ok: false, error: "未対応の操作です。" }, 404);
  } catch (error) {
    console.error(error);
    return json({ ok: false, error: "一時的に処理できませんでした。" }, 500);
  }
});
