import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("./dist/", import.meta.url));
const port = Number(process.env.PORT || 8080);
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8" };
const headers = {
  "Cache-Control": "no-store",
  "Content-Security-Policy": "default-src 'self'; connect-src 'self' https://zgkoofphhivesclehrom.supabase.co https://www.googleapis.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com; script-src 'self' https://www.gstatic.com; style-src 'self'; img-src 'self' data: https:; frame-src https://*.firebaseapp.com https://accounts.google.com; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY"
};

export function createNovHubStagingServer() {
  return createServer(async (request, response) => {
    const url = new URL(request.url || "/", "https://staging.invalid");
    if (url.pathname === "/ready" && request.method === "GET") {
      response.writeHead(200, { ...headers, "Content-Type": "application/json; charset=utf-8" });
      return response.end('{"ok":true}');
    }
    if (request.method !== "GET" && request.method !== "HEAD") {
      response.writeHead(405, headers);
      return response.end();
    }
    const relative = normalize(decodeURIComponent(url.pathname)).replace(/^([/\\])+/u, "") || "index.html";
    const file = join(root, relative);
    if (!file.startsWith(root)) {
      response.writeHead(404, headers);
      return response.end();
    }
    try {
      if (!(await stat(file)).isFile()) throw new Error("NOT_FILE");
      response.writeHead(200, { ...headers, "Content-Type": types[extname(file)] || "application/octet-stream" });
      if (request.method === "HEAD") return response.end();
      createReadStream(file).pipe(response);
    } catch {
      response.writeHead(404, headers);
      response.end();
    }
  });
}

if (process.env.NODE_ENV !== "test") createNovHubStagingServer().listen(port, "0.0.0.0");
