import { createStagingTokenVerifier } from "./auth.js";
import { createAuditSink } from "./audit.js";
import { resolveEnvironment } from "./environment.js";
import { createStoreSalesStagingService } from "./service.js";

const config = resolveEnvironment({
  APP_ENV: Deno.env.get("APP_ENV"),
  RUNTIME_MODE: Deno.env.get("RUNTIME_MODE"),
  PROJECTION_API_BASE_URL: Deno.env.get("PROJECTION_API_BASE_URL"),
  SESSION_ISSUER: Deno.env.get("SESSION_ISSUER"),
  SESSION_AUDIENCE: Deno.env.get("SESSION_AUDIENCE"),
  CONTRACT_VERSION: Deno.env.get("CONTRACT_VERSION"),
  AUDIT_ENABLED: Deno.env.get("AUDIT_ENABLED"),
  TELEMETRY_ENABLED: Deno.env.get("TELEMETRY_ENABLED"),
  PRODUCTION_BLOCKED: Deno.env.get("PRODUCTION_BLOCKED"),
  SYNTHETIC_DATA_ENABLED: Deno.env.get("SYNTHETIC_DATA_ENABLED")
});

const verifier = createStagingTokenVerifier({
  issuer: config.sessionIssuer,
  audience: config.sessionAudience,
  verifySignature: async ({ signature }: { signature: string }) =>
    config.appEnv === "staging" && config.syntheticDataEnabled && signature === "synthetic-signature"
});

const audit = createAuditSink((event: Record<string, unknown>) => console.info(JSON.stringify(event)));
const service = createStoreSalesStagingService({ config, tokenVerifier: verifier, audit });

Deno.serve(async (request) => {
  const result = await service.handle({
    method: request.method,
    url: request.url,
    headers: request.headers,
    requestId: request.headers.get("x-request-id") || crypto.randomUUID()
  });
  return new Response(JSON.stringify(result.body), { status: result.status, headers: result.headers });
});
