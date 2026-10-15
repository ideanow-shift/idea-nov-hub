import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type SupabaseClientAny = ReturnType<typeof createClient<any>>;

type QueueRow = {
  id: string;
  entity_type: string | null;
  entity_id: string | null;
  recipient_employee_id: string | null;
  recipient_email: string | null;
  recipient_name: string | null;
  title: string;
  body: string;
};

type LineWorksTarget = {
  type: "user" | "channel";
  id: string;
  source: string;
};

type SendResult = {
  ok: boolean;
  skipped?: boolean;
  error?: string;
};

type PersonalClaimRow = {
  id: string;
  status: string;
  recipient_employee_id: string;
  destination_id: string;
  message_text: string;
};

const MONTHLY_MVP_ENTITY_TYPE = "monthly_thanks_mvp:all_store";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-trigger-secret",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    await assertAuthorizedInvocation(req);

    const requestBody = await readJsonBody(req);
    const requestedNotificationId = String(requestBody.notificationId ?? requestBody.id ?? "").trim();
    const expectedEntityType = String(requestBody.expectedEntityType ?? "").trim();
    const personalMessageClaimId = String(requestBody.personalMessageClaimId ?? "").trim();
    const expectedRecipientEmployeeId = String(requestBody.expectedRecipientEmployeeId ?? "").trim();
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const batchSize = Number(Deno.env.get("LINE_WORKS_BATCH_SIZE") ?? "20");

    if (!supabaseUrl || !serviceKey) {
      throw new Error("Supabase environment variables are missing.");
    }

    const supabase = createClient(supabaseUrl, serviceKey);
    if (personalMessageClaimId) {
      return await handlePersonalMessageClaim(supabase, personalMessageClaimId, expectedRecipientEmployeeId);
    }
    let query = supabase
      .schema("os")
      .from("line_works_notification_queue")
      .select("id,entity_type,entity_id,recipient_employee_id,recipient_email,recipient_name,title,body")
      .eq("status", "queued");

    if (requestedNotificationId) {
      query = query.eq("id", requestedNotificationId).limit(1);
    } else {
      query = query
        .neq("entity_type", MONTHLY_MVP_ENTITY_TYPE)
        .order("created_at", { ascending: true })
        .limit(batchSize);
    }

    const { data, error } = await query;

    if (error) throw error;

    const rows = (data ?? []) as QueueRow[];
    for (const row of rows) {
      if (row.entity_type === MONTHLY_MVP_ENTITY_TYPE && !requestedNotificationId) {
        throw new Error("monthly MVP notifications require notificationId scoped send");
      }
      if (expectedEntityType && row.entity_type !== expectedEntityType) {
        throw new Error("notification entity_type does not match expectedEntityType");
      }
    }
    const results = [];

    for (const row of rows) {
      const result = await sendLineWorksNotification(supabase, row);
      results.push({ id: row.id, ...result });

      if (result.ok) {
        await updateNotificationStatus(supabase, row.id, "sent", null);
      } else if (result.skipped) {
        await updateNotificationStatus(supabase, row.id, "error", result.error ?? "skipped");
      } else {
        await updateNotificationStatus(supabase, row.id, "error", result.error ?? "unknown error");
      }
    }

    return json({
      ok: true,
      count: rows.length,
      results,
    });
  } catch (error) {
    return json({ ok: false, error: formatError(error) }, 400);
  }
});

async function readJsonBody(req: Request): Promise<Record<string, unknown>> {
  try {
    const contentType = req.headers.get("content-type") ?? "";
    if (!contentType.toLowerCase().includes("application/json")) return {};
    const body = await req.json();
    return body && typeof body === "object" && !Array.isArray(body)
      ? body as Record<string, unknown>
      : {};
  } catch (_error) {
    return {};
  }
}

async function assertAuthorizedInvocation(req: Request) {
  const triggerSecret = Deno.env.get("LINE_WORKS_TRIGGER_SECRET") ?? "";
  const providedSecret = req.headers.get("x-trigger-secret") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const authorization = req.headers.get("Authorization") ?? "";
  const bearerToken = authorization.toLowerCase().startsWith("bearer ")
    ? authorization.replace(/^bearer\s+/i, "").trim()
    : "";

  if (serviceKey && constantTimeEquals(bearerToken, serviceKey)) {
    return;
  }
  if (triggerSecret && constantTimeEquals(providedSecret, triggerSecret)) {
    return;
  }
  throw new Error("invalid internal invocation authorization");
}

function constantTimeEquals(left: string, right: string): boolean {
  const a = new TextEncoder().encode(String(left || ""));
  const b = new TextEncoder().encode(String(right || ""));
  const length = Math.max(a.length, b.length);
  let difference = a.length ^ b.length;
  for (let index = 0; index < length; index += 1) {
    difference |= (a[index] || 0) ^ (b[index] || 0);
  }
  return difference === 0;
}

async function handlePersonalMessageClaim(
  supabase: SupabaseClientAny,
  claimId: string,
  expectedRecipientEmployeeId: string,
) {
  if (!isUuid(claimId) || !isUuid(expectedRecipientEmployeeId)) {
    return json({ ok: false, status: "failed_pre_delivery", providerCode: "INVALID_PERSONAL_CLAIM" }, 400);
  }

  const { data: claimData, error: claimError } = await supabase
    .schema("os")
    .from("line_works_personal_message_deliveries")
    .select("id,status,recipient_employee_id,destination_id,message_text")
    .eq("id", claimId)
    .limit(1);
  if (claimError) throw claimError;
  const claim = (claimData?.[0] || null) as PersonalClaimRow | null;
  if (!claim || claim.recipient_employee_id !== expectedRecipientEmployeeId) {
    return json({ ok: false, status: "failed_pre_delivery", providerCode: "PERSONAL_CLAIM_NOT_FOUND" }, 404);
  }
  if (claim.status !== "claimed") {
    return json({ ok: claim.status === "sent", status: claim.status, duplicate: true, providerCode: "NO_RETRY" });
  }

  const { data: destinationData, error: destinationError } = await supabase
    .schema("os")
    .from("notification_destinations")
    .select("id,provider,target_type,target_id,channel_id,purpose,is_active")
    .eq("id", claim.destination_id)
    .eq("provider", "line_works")
    .eq("target_type", "employee")
    .eq("target_id", expectedRecipientEmployeeId)
    .eq("purpose", "primary")
    .eq("is_active", true)
    .limit(1);
  const destination = destinationData?.[0] as Record<string, unknown> | undefined;
  const targetId = String(destination?.channel_id || "").trim();
  if (destinationError || !destination || !isSafeLineWorksUserTargetId(targetId)) {
    await finishPersonalMessageClaim(supabase, claimId, "failed_pre_delivery", "", "PERSONAL_DESTINATION_INVALID");
    return json({ ok: false, status: "failed_pre_delivery", providerCode: "PERSONAL_DESTINATION_INVALID" }, 409);
  }

  const preflightError = personalProviderPreflightError();
  if (preflightError) {
    await finishPersonalMessageClaim(supabase, claimId, "failed_pre_delivery", "", preflightError);
    return json({ ok: false, status: "failed_pre_delivery", providerCode: preflightError }, 503);
  }

  const { data: beginData, error: beginError } = await supabase
    .schema("os")
    .rpc("begin_line_works_personal_message_delivery_v1", { p_claim_id: claimId });
  if (beginError) throw beginError;
  if (!Array.isArray(beginData) || beginData.length !== 1) {
    return json({ ok: false, status: "delivery_unknown", duplicate: true, providerCode: "CLAIM_NOT_SENDABLE" }, 409);
  }

  const row: QueueRow = {
    id: claimId,
    entity_type: "line_works_personal_message:v1",
    entity_id: claimId,
    recipient_employee_id: expectedRecipientEmployeeId,
    recipient_email: null,
    recipient_name: "脇田 将樹",
    title: claim.message_text,
    body: "",
  };
  const target: LineWorksTarget = { type: "user", id: targetId, source: "os.notification_destinations:employee/primary" };

  try {
    const provider = Deno.env.get("LINE_WORKS_PROVIDER") ?? "bot_secret";
    const result = provider === "bot_secret"
      ? await sendWithBotSecretProvider(row, target)
      : await sendWithServerApiProvider(row, target);
    if (result.ok) {
      await finishPersonalMessageClaim(supabase, claimId, "sent", "", "");
      return json({ ok: true, status: "sent", claimId, providerCode: "OK", retried: false });
    }
    const providerCode = sanitizeProviderCode(result.error || "DELIVERY_RESULT_UNKNOWN");
    await finishPersonalMessageClaim(supabase, claimId, "delivery_unknown", "", providerCode);
    return json({ ok: false, status: "delivery_unknown", claimId, providerCode, retried: false }, 502);
  } catch (error) {
    const providerCode = sanitizeProviderCode(formatError(error));
    await finishPersonalMessageClaim(supabase, claimId, "delivery_unknown", "", providerCode);
    return json({ ok: false, status: "delivery_unknown", claimId, providerCode, retried: false }, 502);
  }
}

async function finishPersonalMessageClaim(
  supabase: SupabaseClientAny,
  claimId: string,
  status: "sent" | "failed_pre_delivery" | "delivery_unknown",
  providerMessageId: string,
  errorCode: string,
) {
  const { data, error } = await supabase.schema("os").rpc("finish_line_works_personal_message_delivery_v1", {
    p_claim_id: claimId,
    p_terminal_status: status,
    p_provider_message_id: providerMessageId || null,
    p_error_code: errorCode || null,
  });
  if (error) throw error;
  if (!Array.isArray(data) || data.length !== 1) throw new Error("personal-message terminal transition rejected");
}

function personalProviderPreflightError(): string {
  const provider = Deno.env.get("LINE_WORKS_PROVIDER") ?? "bot_secret";
  if (provider === "bot_secret") {
    if (!Deno.env.get("LINE_WORKS_BOT_ID") || !Deno.env.get("LINE_WORKS_BOT_SECRET") || !Deno.env.get("LINE_WORKS_BOT_SECRET_RELAY_URL")) {
      return "PERSONAL_PROVIDER_NOT_CONFIGURED";
    }
    return "";
  }
  if (provider === "server_api") {
    if (!Deno.env.get("LINE_WORKS_BOT_ID") || !Deno.env.get("LINE_WORKS_CLIENT_ID")
      || !Deno.env.get("LINE_WORKS_CLIENT_SECRET") || !Deno.env.get("LINE_WORKS_SERVICE_ACCOUNT")
      || !Deno.env.get("LINE_WORKS_PRIVATE_KEY")) {
      return "PERSONAL_PROVIDER_NOT_CONFIGURED";
    }
    return "";
  }
  return "PERSONAL_PROVIDER_UNSUPPORTED";
}

function sanitizeProviderCode(value: string): string {
  return String(value || "DELIVERY_RESULT_UNKNOWN").replace(/[^A-Z0-9_:-]/gi, "_").slice(0, 160);
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function sendLineWorksNotification(
  supabase: SupabaseClientAny,
  row: QueueRow,
): Promise<SendResult> {
  const provider = Deno.env.get("LINE_WORKS_PROVIDER") ?? "bot_secret";

  let target: LineWorksTarget;
  try {
    target = await resolveLineWorksTarget(supabase, row);
  } catch (error) {
    // Target could not be resolved (e.g. a personal notification whose employee
    // destination is unavailable). Record this row as an error and continue the
    // batch. Never fall through to a shared/default destination for a personal
    // message, and never abort the whole batch on a single unresolvable row.
    return { ok: false, skipped: true, error: formatError(error) };
  }

  if (provider === "bot_secret") {
    return sendWithBotSecretProvider(row, target);
  }

  if (provider === "server_api") {
    return sendWithServerApiProvider(row, target);
  }

  return { ok: false, skipped: true, error: `unsupported LINE_WORKS_PROVIDER: ${provider}` };
}

async function resolveLineWorksTarget(
  supabase: SupabaseClientAny,
  row: QueueRow,
): Promise<LineWorksTarget> {
  const explicitTarget = await resolveExplicitTarget(supabase, row);
  if (explicitTarget) return explicitTarget;

  const storeTarget = await resolveStoreChannelTarget(supabase, row);
  if (storeTarget) return storeTarget;

  const employeeTarget = await resolveEmployeeUserTarget(supabase, row);
  if (employeeTarget) return employeeTarget;

  // SAFETY (personal-notification misdelivery guard):
  // A notification addressed to a specific employee (recipient_employee_id is set)
  // MUST resolve to that employee's personal LINE WORKS destination. If it cannot,
  // fail loudly instead of falling back to the shared default channel/user below.
  // Falling back would deliver a personal (potentially confidential) message to the
  // wrong audience. The default target is reserved exclusively for broadcast/system
  // notifications that carry NO recipient_employee_id (e.g. monthly all-store MVP,
  // explicit "line_works_target:" routing), which are handled earlier or fall through
  // to the default block below with recipient_employee_id = null.
  if (row.recipient_employee_id) {
    throw new Error(
      "personal notification could not resolve an employee LINE WORKS destination; refusing default-target fallback to avoid misdelivery",
    );
  }

  // SAFETY (expense_claim store-channel guard — cutover step 2):
  // expense_claim は店舗チャンネル集約が正式設計 (resolveStoreChannelTarget)。
  // ここに到達する = 店舗チャンネルが未解決 (店舗 mapping 不在)。recipient_employee_id が
  // NULL でも default チャンネルへは落とさず、当該行のみ error にする (誤配防止)。
  // 個人配送が必要な場合は entity_type を分離すること (例: "expense_claim_personal")。
  if (row.entity_type === "expense_claim") {
    throw new Error(
      "expense_claim store channel target unresolved (no store mapping); refusing default-target fallback",
    );
  }

  const defaultType = Deno.env.get("LINE_WORKS_DEFAULT_TARGET_TYPE") ?? "channel";
  const defaultChannelId = Deno.env.get("LINE_WORKS_DEFAULT_CHANNEL_ID") ?? "";
  const defaultUserId = Deno.env.get("LINE_WORKS_DEFAULT_USER_ID") ?? "";

  if (defaultType === "channel" && defaultChannelId) {
    return { type: "channel", id: defaultChannelId, source: "env:LINE_WORKS_DEFAULT_CHANNEL_ID" };
  }

  if (defaultType === "user" && defaultUserId) {
    return { type: "user", id: defaultUserId, source: "env:LINE_WORKS_DEFAULT_USER_ID" };
  }

  throw new Error("LINE WORKS target is missing. Configure os.line_works_recipient_mappings or default target env.");
}

async function resolveExplicitTarget(
  supabase: SupabaseClientAny,
  row: QueueRow,
): Promise<LineWorksTarget | null> {
  if (!row.entity_type?.startsWith("line_works_target:")) return null;

  const [, targetScope, targetKey, targetType] = row.entity_type.split(":");
  if (!targetScope || !targetKey || (targetType !== "user" && targetType !== "channel")) return null;

  return findLineWorksMapping(supabase, targetScope, targetKey, targetType);
}

// DESIGN NOTE (expense_claim → store channel routing) — 意図的設計。
// finance 側は expense_claim 通知を「受信者ごと」(ロールによる承認者、および
// 差戻し/精算時は申請者本人) に recipient_employee_id 付きで enqueue する。
// ただし LINE WORKS チャンネルでは、個人 DM ではなく店舗の承認チャンネル
// (os.line_works_recipient_mappings, target_scope='store', purpose='expense_approval')
// へ「集約」するのが正式設計。このためこの解決関数は個人宛解決より前に走り、
// recipient_employee_id を意図的に参照しない(個人宛ガードには到達しない)。
//
// CAVEAT (Core DB番人 gate / 未対処):
//  1) 本文 finance.expense_notification_body は金額および自由記述コメント
//     (差戻し理由等) を含むため、店舗チャンネル閲覧者全員に個人の経費明細が
//     届く。閲覧者範囲は LINE WORKS 側の設定であり expense_claims の RLS では
//     制御できない (=RLS 想定より広い相手に露出しうる)。
//  2) 差戻し/精算時は申請者本人が受信者に含まれるため、申請者自身の明細+理由が
//     チャンネルへブロードキャストされる。
//  個人配送が必要になった場合は、この経路を緩めるのではなく entity_type を
//  分離すること (例: "expense_claim_personal")。本文最小化 (金額内訳・理由本文の
//  除外) の要否と併せて Core DB番人 が判断する。
async function resolveStoreChannelTarget(
  supabase: SupabaseClientAny,
  row: QueueRow,
): Promise<LineWorksTarget | null> {
  if (row.entity_type !== "expense_claim" || !row.entity_id) return null;

  const { data: claim, error: claimError } = await supabase
    .schema("finance")
    .from("expense_claims")
    .select("store_id")
    .eq("id", row.entity_id)
    .maybeSingle();

  if (claimError || !claim?.store_id) return null;

  const { data: store } = await supabase
    .schema("core")
    .from("stores")
    .select("id,code")
    .eq("id", claim.store_id)
    .maybeSingle();

  const storeKeys = [store?.code, store?.id].filter(Boolean) as string[];

  for (const storeKey of storeKeys) {
    const mapping = await findLineWorksMapping(supabase, "store", storeKey, "channel");
    if (mapping) return mapping;
  }

  return null;
}

async function resolveEmployeeUserTarget(
  supabase: SupabaseClientAny,
  row: QueueRow,
): Promise<LineWorksTarget | null> {
  if (row.recipient_employee_id) {
    const destination = await findEmployeeNotificationDestination(supabase, row.recipient_employee_id);
    if (destination) return destination;
  }

  // Fast-track bridge for the current HUBCORE split:
  // os.notifications.recipient_employee_id points at core.employees, while HUB
  // master-admin stores LINE WORKS personal destinations against public.employees.
  // Until Core decides the permanent public/core employee ID strategy, bridge only
  // through a unique email match and never fall back to shared channels.
  if (row.recipient_email) {
    const destination = await findEmployeeNotificationDestinationByPublicEmail(supabase, row.recipient_email);
    if (destination) return destination;
  }

  if (row.recipient_employee_id) {
    const destination = await findEmployeeNotificationDestinationViaCoreEmployee(supabase, row.recipient_employee_id);
    if (destination) return destination;
  }

  const employeeKeys = [row.recipient_email?.toLowerCase(), row.recipient_employee_id].filter(Boolean) as string[];

  for (const employeeKey of employeeKeys) {
    const mapping = await findLineWorksMapping(supabase, "employee", employeeKey, "user");
    if (mapping) return mapping;
  }

  return null;
}

async function findEmployeeNotificationDestination(
  supabase: SupabaseClientAny,
  employeeId: string,
): Promise<LineWorksTarget | null> {
  const { data, error } = await supabase
    .schema("os")
    .from("notification_destinations")
    .select("channel_id")
    .eq("provider", "line_works")
    .eq("target_type", "employee")
    .eq("target_id", employeeId)
    .eq("purpose", "primary")
    .eq("is_active", true)
    .maybeSingle();

  if (error || !data?.channel_id) return null;

  const targetId = String(data.channel_id).trim();
  if (!isSafeLineWorksUserTargetId(targetId)) {
    throw new Error("employee LINE WORKS User ID shape invalid; refusing user endpoint send");
  }

  return {
    type: "user",
    id: targetId,
    source: "notification_destinations:employee:primary",
  };
}

async function findEmployeeNotificationDestinationByPublicEmail(
  supabase: SupabaseClientAny,
  email: string,
): Promise<LineWorksTarget | null> {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) return null;

  const { data, error } = await supabase
    .schema("public")
    .from("employees")
    .select("id")
    .ilike("email", normalizedEmail)
    .limit(2);

  const rows = (data ?? []) as Array<{ id?: string }>;
  if (error || rows.length !== 1 || !rows[0]?.id) return null;

  return findEmployeeNotificationDestination(supabase, String(rows[0].id));
}

async function findEmployeeNotificationDestinationViaCoreEmployee(
  supabase: SupabaseClientAny,
  coreEmployeeId: string,
): Promise<LineWorksTarget | null> {
  const { data, error } = await supabase
    .schema("core")
    .from("employees")
    .select("email")
    .eq("id", coreEmployeeId)
    .maybeSingle();

  const email = typeof data?.email === "string" ? data.email : "";
  if (error || !email.trim()) return null;

  return findEmployeeNotificationDestinationByPublicEmail(supabase, email);
}

async function findLineWorksMapping(
  supabase: SupabaseClientAny,
  targetScope: string,
  targetKey: string,
  targetType: "user" | "channel",
): Promise<LineWorksTarget | null> {
  const { data, error } = await supabase
    .schema("os")
    .from("line_works_recipient_mappings")
    .select("target_type,line_works_target_id")
    .eq("target_scope", targetScope)
    .eq("target_key", targetKey)
    .eq("target_type", targetType)
    .eq("enabled", true)
    .maybeSingle();

  if (error || !data?.line_works_target_id) return null;

  return {
    type: data.target_type as "user" | "channel",
    id: data.line_works_target_id,
    source: `mapping:${targetScope}:${targetKey}`,
  };
}

async function sendWithBotSecretProvider(row: QueueRow, target: LineWorksTarget): Promise<SendResult> {
  const botId = Deno.env.get("LINE_WORKS_BOT_ID") ?? "";
  const botSecret = Deno.env.get("LINE_WORKS_BOT_SECRET") ?? "";
  const relayUrl = Deno.env.get("LINE_WORKS_BOT_SECRET_RELAY_URL") ?? "";

  if (!botId || !botSecret) {
    return { ok: false, skipped: true, error: "LINE_WORKS_BOT_ID or LINE_WORKS_BOT_SECRET is missing" };
  }

  if (!relayUrl) {
    return {
      ok: false,
      skipped: true,
      error: "LINE_WORKS_BOT_SECRET_RELAY_URL is missing. Configure the existing IDEALINK Bot delivery endpoint or migrate provider to server_api.",
    };
  }

  const response = await fetch(relayUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-LINE-WORKS-BOT-ID": botId,
      "X-LINE-WORKS-BOT-SECRET": botSecret,
    },
    body: JSON.stringify({
      botId,
      targetType: target.type,
      targetId: target.id,
      targetSource: target.source,
      title: row.title,
      text: buildMessageText(row),
      notificationId: row.id,
    }),
  });

  if (!response.ok) {
    return { ok: false, error: `LINE_WORKS_BOT_PROVIDER_FAILED_STATUS_${response.status}` };
  }

  return { ok: true };
}

async function sendWithServerApiProvider(row: QueueRow, target: LineWorksTarget): Promise<SendResult> {
  const botId = Deno.env.get("LINE_WORKS_BOT_ID") ?? "";

  if (!botId) {
    return { ok: false, skipped: true, error: "LINE_WORKS_BOT_ID is missing" };
  }

  const token = await getLineWorksAccessToken();
  const targetPath = target.type === "channel"
    ? `/channels/${encodeURIComponent(target.id)}`
    : `/users/${encodeURIComponent(target.id)}`;
  const url = `https://www.worksapis.com/v1.0/bots/${encodeURIComponent(botId)}${targetPath}/messages`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      content: {
        type: "text",
        text: buildMessageText(row),
      },
    }),
  });

  if (!response.ok) {
    return { ok: false, error: `LINE_WORKS_SERVER_API_FAILED_STATUS_${response.status}` };
  }

  return { ok: true };
}

async function getLineWorksAccessToken() {
  const clientId = Deno.env.get("LINE_WORKS_CLIENT_ID") ?? "";
  const clientSecret = Deno.env.get("LINE_WORKS_CLIENT_SECRET") ?? "";
  const serviceAccount = Deno.env.get("LINE_WORKS_SERVICE_ACCOUNT") ?? "";
  const privateKey = normalizePrivateKey(Deno.env.get("LINE_WORKS_PRIVATE_KEY") ?? "");
  const scope = Deno.env.get("LINE_WORKS_SCOPE") ?? "bot";

  if (!clientId || !clientSecret || !serviceAccount || !privateKey) {
    throw new Error("LINE WORKS Server API credentials are missing.");
  }

  const now = Math.floor(Date.now() / 1000);
  const assertion = await buildLineWorksJwt(clientId, serviceAccount, privateKey, now);

  const body = new URLSearchParams({
    assertion,
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    client_id: clientId,
    client_secret: clientSecret,
    scope,
  });

  const response = await fetch("https://auth.worksmobile.com/oauth2/v2.0/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`LINE_WORKS_ACCESS_TOKEN_FAILED_STATUS_${response.status}`);
  }

  const data = JSON.parse(text) as { access_token?: string };
  if (!data.access_token) {
    throw new Error("LINE WORKS Access Token response does not include access_token.");
  }

  return data.access_token;
}

async function buildLineWorksJwt(clientId: string, serviceAccount: string, privateKey: string, now: number) {
  const header = { alg: "RS256", typ: "JWT" };
  const claims = {
    iss: clientId,
    sub: serviceAccount,
    iat: now,
    exp: now + 3600,
  };
  const signingInput = `${base64UrlJson(header)}.${base64UrlJson(claims)}`;
  const key = await importPrivateKey(privateKey);
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(signingInput),
  );

  return `${signingInput}.${base64UrlBytes(new Uint8Array(signature))}`;
}

async function importPrivateKey(privateKey: string) {
  const pemBody = privateKey
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s+/g, "");
  const binary = Uint8Array.from(atob(pemBody), (char) => char.charCodeAt(0));

  return crypto.subtle.importKey(
    "pkcs8",
    binary,
    {
      name: "RSASSA-PKCS1-v1_5",
      hash: "SHA-256",
    },
    false,
    ["sign"],
  );
}

function normalizePrivateKey(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return trimmed.includes("\\n") ? trimmed.replace(/\\n/g, "\n") : trimmed;
}

function base64UrlJson(value: unknown) {
  return base64UrlBytes(new TextEncoder().encode(JSON.stringify(value)));
}

function base64UrlBytes(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function buildMessageText(row: QueueRow) {
  return [
    row.title,
    "",
    row.body,
  ].filter(Boolean).join("\n");
}

function isSafeLineWorksUserTargetId(value: string) {
  const targetId = value.trim();
  if (!targetId) return false;

  // In the current HUB employee master import, LINE WORKS User IDs are
  // non-numeric values. A numeric-only value is a talk-room/channel identifier,
  // so sending it to the /users/{userId} endpoint returns LINE WORKS 400 and can
  // obscure the real data issue.
  if (/^\d+$/.test(targetId)) return false;

  return true;
}

async function updateNotificationStatus(
  supabase: SupabaseClientAny,
  id: string,
  status: "sent" | "error",
  error: string | null,
) {
  const patch: Record<string, unknown> = {
    status,
    error,
  };

  if (status === "sent") {
    patch.sent_at = new Date().toISOString();
  }

  const { error: updateError } = await supabase
    .schema("os")
    .from("notifications")
    .update(patch)
    .eq("id", id);

  if (updateError) throw updateError;
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function formatError(error: unknown) {
  if (error instanceof Error) return error.message;

  try {
    return JSON.stringify(error);
  } catch (_) {
    return String(error);
  }
}
