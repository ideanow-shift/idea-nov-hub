import { StagingApiError } from "./errors.js";

export function createStagingTokenVerifier(options = {}) {
  const issuer = options.issuer || "idea-nov-staging";
  const audience = options.audience || "nov_hub_staging";
  const verifySignature = options.verifySignature || (() => false);
  return Object.freeze({
    async verify(authorization) {
      const token = String(authorization || "").replace(/^Bearer\s+/i, "");
      const [marker, role, expiryText, signature] = token.split(":");
      if (marker !== "stg-synthetic") throw new StagingApiError("INVALID_ISSUER", "Session issuer is invalid.", 401);
      if (!signature || !(await verifySignature({ token, signature, issuer, audience }))) {
        throw new StagingApiError("INVALID_SIGNATURE", "Session signature is invalid.", 401);
      }
      if (!Number.isFinite(Number(expiryText)) || Number(expiryText) <= Date.now()) {
        throw new StagingApiError("SESSION_EXPIRED", "Session has expired.", 401);
      }
      return Object.freeze({
        employeeId: `synthetic-actor-${role}`,
        role,
        issuer,
        audience,
        synthetic: true
      });
    }
  });
}
