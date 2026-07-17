import {
  type EducationReadDependencies,
  handleEducationRead,
  type JsonRecord,
} from "./domain.ts";

const MAX_BODY_BYTES = 16 * 1024;
const MAX_BEARER_CHARS = 4096;
const BEARER_PATTERN = /^Bearer ([^\s]+)$/;

export interface EducationHttpDependencies extends EducationReadDependencies {
  isAllowedOrigin(origin: string): boolean;
}

function responseHeaders(origin: string, allowed: boolean): Headers {
  const headers = new Headers({
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8",
    "Vary": "Origin",
  });
  if (allowed) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Access-Control-Allow-Headers", "authorization, content-type");
    headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  }
  return headers;
}

function jsonResponse(
  status: number,
  body: JsonRecord,
  origin: string,
  allowed: boolean,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: responseHeaders(origin, allowed),
  });
}

function safeError(
  status: number,
  code: string,
  message: string,
  origin: string,
  allowed: boolean,
): Response {
  return jsonResponse(status, { ok: false, code, message }, origin, allowed);
}

function readBearer(request: Request): string | null {
  const authorization = request.headers.get("Authorization") ?? "";
  if (authorization.length > MAX_BEARER_CHARS + 7) return null;
  return BEARER_PATTERN.exec(authorization)?.[1] ?? null;
}

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export async function handleEducationHttpRequest(
  request: Request,
  deps: EducationHttpDependencies,
): Promise<Response> {
  const origin = request.headers.get("Origin") ?? "";
  const allowedOrigin = Boolean(origin) && deps.isAllowedOrigin(origin);
  if (!allowedOrigin) {
    return safeError(
      403,
      "ORIGIN_NOT_ALLOWED",
      "This request origin is not allowed.",
      origin,
      false,
    );
  }

  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: responseHeaders(origin, true),
    });
  }
  if (request.method !== "POST") {
    return safeError(
      405,
      "METHOD_NOT_ALLOWED",
      "Only POST is supported.",
      origin,
      true,
    );
  }

  const contentType = request.headers.get("Content-Type") ?? "";
  if (!/^application\/json(?:\s*;|$)/i.test(contentType)) {
    return safeError(
      415,
      "UNSUPPORTED_MEDIA_TYPE",
      "JSON content is required.",
      origin,
      true,
    );
  }

  const declaredLength = Number(request.headers.get("Content-Length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    return safeError(
      413,
      "REQUEST_TOO_LARGE",
      "The request is too large.",
      origin,
      true,
    );
  }

  const token = readBearer(request);
  if (!token) {
    return safeError(
      401,
      "UNAUTHORIZED",
      "Authentication is required.",
      origin,
      true,
    );
  }

  let body: JsonRecord;
  try {
    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) {
      return safeError(
        413,
        "REQUEST_TOO_LARGE",
        "The request is too large.",
        origin,
        true,
      );
    }
    const parsed = JSON.parse(rawBody);
    if (!isRecord(parsed)) throw new Error("Invalid body shape.");
    body = parsed;
  } catch {
    return safeError(
      400,
      "INVALID_REQUEST",
      "A valid JSON request is required.",
      origin,
      true,
    );
  }

  const bodyKeys = Object.keys(body);
  if (
    bodyKeys.some((key) => !["action", "payload"].includes(key)) ||
    typeof body.action !== "string" ||
    (body.payload !== undefined && !isRecord(body.payload))
  ) {
    return safeError(
      400,
      "INVALID_REQUEST",
      "Unsupported request field.",
      origin,
      true,
    );
  }

  const result = await handleEducationRead({
    action: body.action,
    token,
    payload: body.payload as JsonRecord | undefined,
  }, deps);
  return jsonResponse(result.status, result.body, origin, true);
}
