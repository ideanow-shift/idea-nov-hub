import { generateKeyPairSync, randomUUID, sign as cryptoSign, verify as cryptoVerify } from "node:crypto";
import { AuthError } from "../../sandbox/auth-foundation/foundation.mjs";

const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
const decode = (value) => JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
const deny = (reason) => { throw new AuthError(401, reason); };

export function generateEphemeralEd25519Key(kid = `staging-${randomUUID()}`) {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  return { kid, privateKey, publicKey, createdAt: Date.now() };
}

export class Ed25519Issuer {
  constructor({ issuer, activeKey, now = () => Date.now() }) {
    if (!activeKey?.privateKey) throw new TypeError("issuer_private_key_required");
    this.issuer = issuer;
    this.activeKey = activeKey;
    this.now = now;
  }

  rotate(nextKey) {
    if (!nextKey?.privateKey) throw new TypeError("issuer_private_key_required");
    const previous = this.activeKey;
    this.activeKey = nextKey;
    return previous;
  }

  issue(claims) {
    const header = encode({ alg: "EdDSA", typ: "NOV-HANDOFF", kid: this.activeKey.kid });
    const payload = encode({ ...claims, iss: this.issuer });
    const input = `${header}.${payload}`;
    const signature = cryptoSign(null, Buffer.from(input), this.activeKey.privateKey).toString("base64url");
    return `${input}.${signature}`;
  }
}

export class Ed25519Verifier {
  constructor({ issuer, audience, appId, now = () => Date.now(), oldKeyGraceMs = 300_000 }) {
    this.issuer = issuer;
    this.audience = audience;
    this.appId = appId;
    this.now = now;
    this.oldKeyGraceMs = oldKeyGraceMs;
    this.keys = new Map();
  }

  trust({ kid, publicKey }, { retiredAt = null } = {}) {
    if (!publicKey || publicKey.type !== "public") throw new TypeError("verifier_public_key_required");
    this.keys.set(kid, { publicKey, retiredAt });
  }

  retire(kid, retiredAt = this.now()) {
    const key = this.keys.get(kid);
    if (key) key.retiredAt = retiredAt;
  }

  verify(token) {
    if (!token) deny("authentication_required");
    const parts = token.split(".");
    if (parts.length !== 3) deny("invalid_token");
    let header;
    let claims;
    try {
      header = decode(parts[0]);
      claims = decode(parts[1]);
    } catch {
      deny("invalid_token");
    }
    if (header.alg !== "EdDSA" || header.typ !== "NOV-HANDOFF") deny("algorithm_denied");
    const key = this.keys.get(header.kid);
    if (!key) deny("unknown_kid");
    if (key.retiredAt !== null && this.now() - key.retiredAt > this.oldKeyGraceMs) deny("key_grace_expired");
    const valid = cryptoVerify(
      null,
      Buffer.from(`${parts[0]}.${parts[1]}`),
      key.publicKey,
      Buffer.from(parts[2], "base64url")
    );
    if (!valid) deny("invalid_signature");
    if (claims.iss !== this.issuer) deny("invalid_issuer");
    if (claims.aud !== this.audience) deny("invalid_audience");
    if (claims.app_id !== this.appId || claims.aud !== claims.app_id) deny("app_mismatch");
    const nowSeconds = Math.floor(this.now() / 1000);
    if (claims.exp <= nowSeconds) deny("expired");
    if (claims.iat > nowSeconds + 60) deny("issued_at_invalid");
    return Object.freeze({ ...claims });
  }
}
