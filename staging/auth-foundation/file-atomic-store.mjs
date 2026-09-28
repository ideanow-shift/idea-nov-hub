import { mkdir, readFile, rename, rmdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { AuthError } from "../../sandbox/auth-foundation/foundation.mjs";

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const safe = (value) => {
  if (!/^[a-zA-Z0-9_-]+$/.test(value)) throw new TypeError("unsafe_key");
  return value;
};

export class FileAtomicOneTimeStore {
  constructor({ directory, now = () => Date.now(), lockTimeoutMs = 5_000 }) {
    this.directory = directory;
    this.now = now;
    this.lockTimeoutMs = lockTimeoutMs;
  }

  async initialize() {
    await mkdir(this.directory, { recursive: true });
  }

  async register({ value, ttlMs, issuer, appId, jti }) {
    await this.initialize();
    const code = `otc_${randomUUID().replaceAll("-", "")}`;
    const entry = { value, issuer, appId, jti, expiresAt: this.now() + ttlMs, revoked: false };
    await writeFile(this.#active(code), JSON.stringify(entry), { encoding: "utf8", flag: "wx" });
    return code;
  }

  async consume(code, binding) {
    safe(code);
    return this.#withLock(code, async () => {
      let entry;
      try {
        entry = JSON.parse(await readFile(this.#active(code), "utf8"));
      } catch (error) {
        if (error.code === "ENOENT") throw new AuthError(401, "code_invalid_or_consumed");
        throw error;
      }
      if (entry.revoked) throw new AuthError(401, "code_revoked");
      if (entry.expiresAt <= this.now()) {
        await rename(this.#active(code), this.#expired(code));
        throw new AuthError(401, "code_expired");
      }
      if (entry.issuer !== binding.issuer || entry.appId !== binding.appId) {
        throw new AuthError(401, "code_binding_mismatch");
      }
      await rename(this.#active(code), this.#consumed(code));
      return entry.value;
    });
  }

  async revoke(code) {
    safe(code);
    return this.#withLock(code, async () => {
      try {
        const entry = JSON.parse(await readFile(this.#active(code), "utf8"));
        await writeFile(this.#active(code), JSON.stringify({ ...entry, revoked: true }), "utf8");
        return true;
      } catch (error) {
        if (error.code === "ENOENT") return false;
        throw error;
      }
    });
  }

  async #withLock(code, operation) {
    const lock = join(this.directory, `${code}.lock`);
    const deadline = Date.now() + this.lockTimeoutMs;
    for (;;) {
      try {
        await mkdir(lock);
        break;
      } catch (error) {
        if (!["EEXIST", "EACCES", "EPERM"].includes(error.code)) throw error;
        if (Date.now() >= deadline) throw new AuthError(503, "store_lock_timeout");
        await wait(2);
      }
    }
    try {
      return await operation();
    } finally {
      for (;;) {
        try {
          await rmdir(lock);
          break;
        } catch (error) {
          if (!["EACCES", "EPERM"].includes(error.code)) throw error;
          await wait(2);
        }
      }
    }
  }

  #active(code) { return join(this.directory, `${code}.active.json`); }
  #consumed(code) { return join(this.directory, `${code}.consumed.json`); }
  #expired(code) { return join(this.directory, `${code}.expired.json`); }
}
