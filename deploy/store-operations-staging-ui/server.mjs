import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("./dist/", import.meta.url));
const port = Number(process.env.PORT || 8080);
const types = { ".html":"text/html; charset=utf-8", ".js":"text/javascript; charset=utf-8", ".css":"text/css; charset=utf-8", ".svg":"image/svg+xml" };
const headers = {
  "Content-Security-Policy": "default-src 'self'; connect-src 'self' https://zgkoofphhivesclehrom.supabase.co; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
  "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff", "X-Frame-Options": "DENY",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()", "Cache-Control": "no-store"
};

createServer(async (request, response) => {
  const url = new URL(request.url || "/", "https://staging.invalid");
  if (url.pathname === "/ready") { response.writeHead(200, { ...headers, "Content-Type":"application/json" }); return response.end('{"ok":true}'); }
  if (url.pathname === "/") { response.writeHead(302, { ...headers, Location:"/store-sales/" }); return response.end(); }
  const pathname = url.pathname;
  const relative = normalize(decodeURIComponent(pathname)).replace(/^([/\\])+/, "");
  let file = join(root, relative);
  if (pathname.endsWith("/")) file = join(file, "index.html");
  if (!file.startsWith(root)) { response.writeHead(404, headers); return response.end(); }
  try {
    if (!(await stat(file)).isFile()) throw new Error("NOT_FILE");
    const contentType = types[extname(file)] || "application/octet-stream";
    response.writeHead(200, { ...headers, "Content-Type": contentType });
    createReadStream(file).pipe(response);
  } catch { response.writeHead(404, headers); response.end(); }
}).listen(port, "0.0.0.0");
