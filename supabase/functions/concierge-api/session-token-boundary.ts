export type SessionPayload = {
  loginId: string;
  storeId: string;
  name: string;
  admin: boolean;
  exp: number;
};

const encoder = new TextEncoder();
const BASE64URL_SEGMENT_PATTERN = /^[A-Za-z0-9_-]+$/;
const SESSION_PAYLOAD_KEYS = Object.freeze(["loginId", "storeId", "name", "admin", "exp"]);

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function decodeCanonicalBase64Url(segment: string): Uint8Array<ArrayBuffer> | null {
  if (!BASE64URL_SEGMENT_PATTERN.test(segment) || segment.length % 4 === 1) return null;
  try {
    const normalized = segment.replaceAll("-", "+").replaceAll("_", "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return bytesToBase64Url(bytes) === segment ? bytes : null;
  } catch {
    return null;
  }
}

async function importHmacKey(secret: string, usage: "sign" | "verify"): Promise<CryptoKey> {
  return await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    [usage],
  );
}

async function signSegment(segment: string, secret: string): Promise<string> {
  const key = await importHmacKey(secret, "sign");
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(segment));
  return bytesToBase64Url(new Uint8Array(signature));
}

function parseCanonicalPayload(encodedPayload: string, bytes: Uint8Array): SessionPayload | null {
  let source: string;
  try {
    source = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return null;
  }

  let value: unknown;
  try {
    value = JSON.parse(source);
  } catch {
    return null;
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const record = value as Record<string, unknown>;
  const keys = Object.keys(record);
  if (keys.length !== SESSION_PAYLOAD_KEYS.length ||
    !keys.every((key, index) => key === SESSION_PAYLOAD_KEYS[index])) return null;
  if (typeof record.loginId !== "string" || record.loginId.length === 0) return null;
  if (typeof record.storeId !== "string" || record.storeId.length === 0) return null;
  if (typeof record.name !== "string") return null;
  if (typeof record.admin !== "boolean") return null;
  if (!Number.isSafeInteger(record.exp) || (record.exp as number) <= 0) return null;

  const payload: SessionPayload = {
    loginId: record.loginId,
    storeId: record.storeId,
    name: record.name,
    admin: record.admin,
    exp: record.exp as number,
  };
  const canonical = bytesToBase64Url(encoder.encode(JSON.stringify(payload)));
  return canonical === encodedPayload ? payload : null;
}

export async function createSessionToken(payload: SessionPayload, secret: string): Promise<string> {
  const encodedPayload = bytesToBase64Url(encoder.encode(JSON.stringify(payload)));
  const signature = await signSegment(encodedPayload, secret);
  return `${encodedPayload}.${signature}`;
}

export async function verifySessionToken(token: string, secret: string): Promise<SessionPayload | null> {
  try {
    const segments = token.split(".");
    if (segments.length !== 2 || !segments[0] || !segments[1]) return null;
    const [encodedPayload, encodedSignature] = segments;
    const payloadBytes = decodeCanonicalBase64Url(encodedPayload);
    const signatureBytes = decodeCanonicalBase64Url(encodedSignature);
    if (!payloadBytes || !signatureBytes || signatureBytes.byteLength !== 32) return null;

    const key = await importHmacKey(secret, "verify");
    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      signatureBytes,
      encoder.encode(encodedPayload),
    );
    if (!valid) return null;

    const payload = parseCanonicalPayload(encodedPayload, payloadBytes);
    if (!payload || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}
