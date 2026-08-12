import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";
import { validateIapAssertion } from "./iap-jwt-validator.mjs";

const defaultRoot = process.env.STATIC_ROOT || "/app/static";
const port = Number(process.env.PORT || 8080);

function json(response, status, body) {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  response.end(JSON.stringify(body));
}

function safeStaticPath(pathname, root) {
  const path = normalize(decodeURIComponent(pathname)).replace(/^(\.\.[/\\])+/, "");
  const candidate = join(root, path === "/" ? "index.html" : path);
  return candidate.startsWith(root) ? candidate : null;
}

const mime = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml" };

async function readJson(request) {
  let value = "";
  for await (const chunk of request) {
    value += chunk;
    if (value.length > 4096) {
      const error = new Error("REQUEST_TOO_LARGE");
      error.status = 413;
      error.code = "REQUEST_TOO_LARGE";
      throw error;
    }
  }
  try { return JSON.parse(value || "{}"); } catch (_) {
    const error = new Error("INVALID_JSON");
    error.status = 400;
    error.code = "INVALID_JSON";
    throw error;
  }
}

export function createDbfStagingServer(deps) {
  const root = deps.staticRoot || defaultRoot;
  return createServer(async (request, response) => {
    try {
      const pathname = new URL(request.url, "http://localhost").pathname;
      if (pathname === "/healthz") return json(response, 200, { status: "ready" });
      if (pathname === "/session/handoff/exchange") {
        if (request.method !== "POST") return json(response, 405, { code: "METHOD_NOT_ALLOWED" });
        const iapAssertion = request.headers["x-goog-iap-jwt-assertion"];
        await validateIapAssertion(iapAssertion, deps);
        const payload = await readJson(request);
        if (Object.keys(payload).some((key) => !new Set(["handoffCode", "state"]).has(key))) {
          return json(response, 400, { code: "INVALID_REQUEST" });
        }
        const result = await deps.exchangeWithHubBackend({
          action: "dbfStagingHandoffExchangeV1",
          payload: {
            handoffCode: String(payload.handoffCode || ""),
            state: String(payload.state || ""),
            origin: "https://idea-nov-dbf-staging-ui-om6tepo36q-an.a.run.app"
          },
          // Forwarded only on the server-to-server hop. It is never accepted
          // from browser JSON, persisted, logged, or returned to the browser.
          iapAssertion
        });
        return json(response, Number(result.status || 200), result.body || result);
      }
      let file = safeStaticPath(pathname, root);
      if (!file || !existsSync(file) || !statSync(file).isFile()) file = join(root, "index.html");
      response.writeHead(200, {
        "content-type": mime[extname(file)] || "application/octet-stream",
        "cache-control": "no-store",
        "x-content-type-options": "nosniff",
        "referrer-policy": "no-referrer",
        "x-frame-options": "DENY"
      });
      createReadStream(file).pipe(response);
    } catch (error) {
      json(response, Number(error.status || 500), { code: error.code || "INTERNAL_ERROR" });
    }
  });
}

export { port };
