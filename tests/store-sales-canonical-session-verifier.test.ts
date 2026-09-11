import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { verifyCanonicalHubSession } from "../supabase/functions/store-sales-staging-api/canonical-hub-session-verifier.ts";

const secret = "local-fixture-signing-secret-0123456789";
const now = 1_800_000_000;

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  bytes.forEach((byte) => binary += String.fromCharCode(byte));
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/g, "");
}

function encode(value: unknown): string {
  return bytesToBase64Url(new TextEncoder().encode(JSON.stringify(value)));
}

async function token(payload: Record<string, unknown>): Promise<string> {
  const header = encode({ alg: "HS256", typ: "NOV-HUB-APP-SESSION", v: 1 });
  const body = encode(payload);
  const input = `${header}.${body}`;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(input));
  return `${input}.${bytesToBase64Url(new Uint8Array(signature))}`;
}

const claims = { sub: "8ac5b5d8-9d8d-4f4e-8f68-9ac8b6c68401", sid: "fixture", aud: "nov_hub", iat: now, exp: now + 900 };

Deno.test("canonical HUB session verifier accepts the existing HS256 audience contract", async () => {
  const result = await verifyCanonicalHubSession(await token(claims), secret, now);
  assertEquals(result?.subject, claims.sub);
  assertEquals(result?.audience, "nov_hub");
});

Deno.test("canonical HUB session verifier rejects signature, audience, and expiry failures", async () => {
  assertEquals(await verifyCanonicalHubSession(`${await token(claims)}x`, secret, now), null);
  assertEquals(await verifyCanonicalHubSession(await token({ ...claims, aud: "mock" }), secret, now), null);
  assertEquals(await verifyCanonicalHubSession(await token({ ...claims, exp: now }), secret, now), null);
});

