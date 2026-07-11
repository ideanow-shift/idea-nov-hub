import fs from "node:fs/promises";

class MemoryStorage {
  constructor() {
    this.values = new Map();
  }
  getItem(key) {
    return this.values.has(key) ? this.values.get(key) : null;
  }
  setItem(key, value) {
    this.values.set(key, String(value));
  }
  removeItem(key) {
    this.values.delete(key);
  }
}

function assert(condition, label) {
  if (!condition) throw new Error(`Fixture failed: ${label}`);
}

globalThis.sessionStorage = new MemoryStorage();
globalThis.localStorage = new Proxy({}, {
  get() {
    throw new Error("localStorage must not be accessed");
  }
});
globalThis.window = {};

const sourceUrl = new URL("../portal/js/nov-hub-session-candidate.js", import.meta.url);
const source = await fs.readFile(sourceUrl, "utf8");
const moduleUrl = `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
const helper = await import(moduleUrl);

const future = () => new Date(Date.now() + 15 * 60 * 1000).toISOString();
const past = () => new Date(Date.now() - 1000).toISOString();

assert(Object.keys(window.NovHubSession).join(",") === "getSessionToken", "global API is getter-only");
assert(window.NovHubSession.getSessionToken() === null, "empty state returns null");

await import(`${moduleUrl}#duplicate-load`);
assert(Object.keys(window.NovHubSession).join(",") === "getSessionToken", "duplicate load is fail-safe");

assert(helper.setNovHubSession({ sessionToken: "fixture-hub-session", audience: "nov_hub", expiresAt: future() }), "valid session accepted");
assert(window.NovHubSession.getSessionToken() === "fixture-hub-session", "valid session returned");

helper.clearNovHubSession();
assert(helper.setNovHubSession({ sessionToken: "wrong-audience", audience: "idea_link", expiresAt: future() }) === false, "audience mismatch rejected");
assert(window.NovHubSession.getSessionToken() === null, "audience mismatch returns null");

sessionStorage.setItem("ideaNov.hub.session.v1", JSON.stringify({ sessionToken: "expired", audience: "nov_hub", expiresAt: past() }));
assert(window.NovHubSession.getSessionToken() === null, "expired session rejected");
assert(sessionStorage.getItem("ideaNov.hub.session.v1") === null, "expired canonical session cleared");

sessionStorage.setItem("ideaNov.management.hubSession.v1", JSON.stringify({ sessionToken: "legacy-valid", audience: "nov_hub", expiresAt: future() }));
assert(window.NovHubSession.getSessionToken() === "legacy-valid", "legacy compatibility read works");
assert(helper.restoreNovHubSession()?.audience === "nov_hub", "legacy session restores to memory");

helper.handleNovHubSessionAuthFailure(401);
assert(window.NovHubSession.getSessionToken() === null, "401 clears session");

helper.setNovHubSessionMemoryProvider(() => ({ sessionToken: "memory-valid", audience: "nov_hub", expiresAt: future() }));
assert(window.NovHubSession.getSessionToken() === "memory-valid", "memory provider preferred");
helper.handleNovHubSessionAuthFailure(403);
assert(window.NovHubSession.getSessionToken() === null, "403 clears memory provider");

console.log(JSON.stringify({
  ok: true,
  fixtureCount: 11,
  localStorageUsed: false,
  tokenPrinted: false,
  personalValuePrinted: false
}));
