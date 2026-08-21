const SAFE_FIELDS = new Set(["event", "status", "from", "to", "featureFlag", "period", "errorCode", "retryCount", "durationMs"]);

function sanitize(fields = {}) {
  return Object.freeze(Object.fromEntries(Object.entries(fields)
    .filter(([key, value]) => SAFE_FIELDS.has(key) && ["string", "number", "boolean"].includes(typeof value))));
}

export function createRuntimeDiagnostics(options = {}) {
  const limit = Math.max(10, Math.min(Number(options.limit || 50), 200));
  const now = options.now || (() => Date.now());
  const logger = typeof options.logger === "function" ? options.logger : () => {};
  const events = [];

  function record(event, fields = {}) {
    const entry = Object.freeze({ timestamp: now(), ...sanitize({ event, ...fields }) });
    events.push(entry);
    if (events.length > limit) events.splice(0, events.length - limit);
    logger(entry);
    return entry;
  }

  return Object.freeze({
    record,
    snapshot: () => Object.freeze({ eventCount: events.length, lastEvent: events.at(-1) || null }),
    entries: () => Object.freeze([...events]),
    clear: () => events.splice(0)
  });
}
