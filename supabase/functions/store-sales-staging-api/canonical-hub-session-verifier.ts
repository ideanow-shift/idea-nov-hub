const HUB_SESSION_AUDIENCE = "nov_hub";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface CanonicalHubSession {
  subject: string;
  sessionId: string;
  audience: "nov_hub";
}

function base64UrlToBytes(value: string): Uint8Array {
  const normalized = String(value || "").replaceAll("-", "+").replaceAll("_", "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function decodePayload(value: string): Record<string, unknown> | null {
  try {
    const decoded = new TextDecoder().decode(base64UrlToBytes(value));
    const parsed = JSON.parse(decoded);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

async function importSigningKey(signingSecret: string): Promise<CryptoKey | null> {
  if (signingSecret.trim().length < 32) return null;
  return await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(signingSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
}

// Mirrors the canonical NOV HUB app-session checks without issuing, transforming, or exposing a token.
export async function verifyCanonicalHubSession(
  token: string,
  signingSecret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): Promise<CanonicalHubSession | null> {
  try {
    const parts = String(token || "").split(".");
    if (parts.length !== 3) return null;
    const key = await importSigningKey(signingSecret);
    if (!key) return null;
    const signatureValid = await crypto.subtle.verify(
      "HMAC",
      key,
      toArrayBuffer(base64UrlToBytes(parts[2])),
      new TextEncoder().encode(`${parts[0]}.${parts[1]}`),
    );
    if (!signatureValid) return null;
    const payload = decodePayload(parts[1]);
    if (!payload || String(payload.aud || "") !== HUB_SESSION_AUDIENCE) return null;
    if (!UUID.test(String(payload.sub || ""))) return null;
    if (Number(payload.exp || 0) <= nowSeconds || Number(payload.iat || 0) > nowSeconds + 30) return null;
    return {
      subject: String(payload.sub),
      sessionId: String(payload.sid || ""),
      audience: HUB_SESSION_AUDIENCE,
    };
  } catch {
    return null;
  }
}
