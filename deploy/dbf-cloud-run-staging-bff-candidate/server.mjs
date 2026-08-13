import { createReadStream, existsSync, realpathSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, resolve, sep } from "node:path";
import { validateIapAssertion } from "./iap-jwt-validator.mjs";

const defaultRoot = process.env.STATIC_ROOT || "/app/static";
const port = Number(process.env.PORT || 8080);

function json(response, status, body) {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  response.end(JSON.stringify(body));
}

function readiness(response) {
  response.writeHead(200, {
    "content-type": "text/plain; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff"
  });
  response.end("ready\n");
}

function staticPathError() {
  const error = new Error("INVALID_STATIC_PATH");
  error.status = 400;
  error.code = "INVALID_STATIC_PATH";
  return error;
}

function safeStaticPath(rawPathname, root) {
  let pathname;
  try { pathname = decodeURIComponent(rawPathname); } catch (_) { throw staticPathError(); }
  if (!pathname.startsWith("/") || pathname.includes("\0") || pathname.includes("\\")) throw staticPathError();
  const segments = pathname.split("/");
  if (segments.some((segment) => segment === "..")) throw staticPathError();

  const relativePath = pathname.slice(1) || "index.html";
  const canonicalRoot = resolve(root);
  const candidate = resolve(canonicalRoot, relativePath);
  if (candidate !== canonicalRoot && !candidate.startsWith(`${canonicalRoot}${sep}`)) throw staticPathError();
  return candidate;
}

const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon"
};

function redirect(response, location) {
  response.writeHead(308, {
    location,
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    "referrer-policy": "no-referrer"
  });
  response.end();
}

function notFound(response) {
  json(response, 404, { code: "NOT_FOUND" });
}

function verifiedStaticFile(file, root) {
  if (!existsSync(file) || !statSync(file).isFile()) return null;
  const canonicalRoot = realpathSync(root);
  const canonicalFile = realpathSync(file);
  if (canonicalFile !== canonicalRoot && !canonicalFile.startsWith(`${canonicalRoot}${sep}`)) throw staticPathError();
  return canonicalFile;
}

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
      const rawPathname = String(request.url || "").split("?", 1)[0];
      const pathname = new URL(request.url, "http://localhost").pathname;
      if (pathname === "/ready" && request.method === "GET") return readiness(response);
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
      if (request.method !== "GET" && request.method !== "HEAD") return json(response, 405, { code: "METHOD_NOT_ALLOWED" });
      if (pathname === "/management-app") return redirect(response, "/management-app/");

      const candidate = pathname === "/management-app/"
        ? safeStaticPath("/management-app/index.html", root)
        : safeStaticPath(rawPathname, root);
      const file = verifiedStaticFile(candidate, root);
      if (!file) return notFound(response);
      response.writeHead(200, {
        "content-type": mime[extname(file)] || "application/octet-stream",
        "cache-control": "no-store",
        "x-content-type-options": "nosniff",
        "referrer-policy": "no-referrer",
        "x-frame-options": "DENY"
      });
      if (request.method === "HEAD") return response.end();
      createReadStream(file).pipe(response);
    } catch (error) {
      json(response, Number(error.status || 500), { code: error.code || "INTERNAL_ERROR" });
    }
  });
}

export { port };
