import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { createStagingTokenVerifier } from "../supabase/functions/store-sales-projection/auth.js";
import { createAuditSink } from "../supabase/functions/store-sales-projection/audit.js";
import { resolveEnvironment } from "../supabase/functions/store-sales-projection/environment.js";
import { createStoreSalesStagingService } from "../supabase/functions/store-sales-projection/service.js";

const root = resolve(import.meta.dirname, "..");
const port = Number(process.env.STORE_SALES_STAGING_PORT || 4175);
const config = resolveEnvironment({
  APP_ENV: "staging",
  RUNTIME_MODE: "integration",
  PROJECTION_API_BASE_URL: `http://127.0.0.1:${port}/v1/store-sales`,
  SESSION_ISSUER: "idea-nov-staging",
  SESSION_AUDIENCE: "nov_hub_staging",
  CONTRACT_VERSION: "store-sales-projection-v1",
  AUDIT_ENABLED: "true",
  TELEMETRY_ENABLED: "true",
  PRODUCTION_BLOCKED: "true",
  SYNTHETIC_DATA_ENABLED: "true"
});
const verifier = createStagingTokenVerifier({
  issuer: config.sessionIssuer,
  audience: config.sessionAudience,
  verifySignature: async ({ signature }) => signature === "synthetic-signature"
});
const audit = createAuditSink((event) => process.stdout.write(`${JSON.stringify(event)}\n`));
const service = createStoreSalesStagingService({ config, tokenVerifier: verifier, audit });
const mime = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".png": "image/png", ".svg": "image/svg+xml" };
const actorRoutes = new Map([
  ["/portal/store-sales/staging.html", "representative"],
  ["/portal/store-sales/staging-store-detail.html", "representative"],
  ["/portal/store-sales/staging-store-manager.html", "store_manager"],
  ["/portal/store-sales/staging-sales-manager.html", "sales_manager"],
  ["/portal/store-sales/staging-area-manager.html", "area_manager"],
  ["/portal/store-sales/staging-employee.html", "employee"],
  ["/portal/store-sales/staging-timeout.html", "representative__timeout"],
  ["/portal/store-sales/staging-maintenance.html", "representative__maintenance"],
  ["/portal/store-sales/staging-validation-error.html", "representative__validation_error"]
]);

createServer(async (request, response) => {
  const url = new URL(request.url || "/", `http://127.0.0.1:${port}`);
  if (url.pathname === "/health" || url.pathname.startsWith("/v1/store-sales/")) {
    const result = await service.handle({ method: request.method, url: url.href, headers: request.headers, requestId: request.headers["x-request-id"] });
    response.writeHead(result.status, result.headers);
    response.end(JSON.stringify(result.body));
    return;
  }
  if (actorRoutes.has(url.pathname)) {
    const content = await readFile(resolve(root, "portal/store-sales/index.html"), "utf8");
    const actor = actorRoutes.get(url.pathname);
    const detailBootstrap = url.pathname.endsWith("staging-store-detail.html")
      ? '<script type="module" src="./staging-detail-bootstrap.js"></script>'
      : "";
    response.writeHead(200, { "content-type": mime[".html"], "cache-control": "no-store" });
    response.end(content
      .replace('<html lang="ja">', `<html lang="ja" data-staging-actor="${actor}">`)
      .replace('<strong>プレビュー</strong>', '<strong>STAGING</strong>')
      .replace('現在は画面確認用のサンプルデータを表示しています。実績値ではありません。実会計データ・本番環境には接続していません。', 'Local Integration環境のSynthetic Dataを表示しています。実績値ではありません。')
      .replace('<script src="./runtime-config.js"></script>', '<script src="./staging-config.js"></script><script type="module" src="./staging-session-bootstrap.js"></script>')
      .replace("</body>", `${detailBootstrap}</body>`));
    return;
  }
  const relative = url.pathname === "/" ? "portal/store-sales/staging.html" : decodeURIComponent(url.pathname).replace(/^\/+/, "");
  const file = resolve(root, relative);
  if (!file.startsWith(`${root}${sep}`)) {
    response.writeHead(403).end("Forbidden");
    return;
  }
  try {
    const content = await readFile(file);
    response.writeHead(200, { "content-type": mime[extname(file)] || "application/octet-stream", "cache-control": "no-store" });
    response.end(content);
  } catch {
    response.writeHead(404).end("Not found");
  }
}).listen(port, "127.0.0.1", () => {
  process.stdout.write(`Store Sales Staging (Synthetic): http://127.0.0.1:${port}/portal/store-sales/staging.html\n`);
});
