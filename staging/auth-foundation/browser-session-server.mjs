import http from "node:http";
import { randomUUID } from "node:crypto";

const HOST = "127.0.0.1";
const HUB_PORT = 4310;
const APP_A_PORT = 4311;
const APP_B_PORT = 4312;
const BRIDGE_CODE = "otc_browser_synthetic";
const sessions = new Map();

const body = (request) => new Promise((resolve, reject) => {
  let value = "";
  request.setEncoding("utf8");
  request.on("data", (chunk) => { value += chunk; });
  request.on("end", () => resolve(new URLSearchParams(value)));
  request.on("error", reject);
});
const cookieValue = (request) => request.headers.cookie?.match(/(?:^|;\s*)__Host-nov_app_session=([^;]+)/)?.[1];
const send = (response, status, content, headers = {}) => {
  response.writeHead(status, { "content-type": "text/html; charset=utf-8", "referrer-policy": "no-referrer", ...headers });
  response.end(content);
};

function createHub() {
  return http.createServer((request, response) => {
    if (request.url !== "/") return send(response, 404, "not found");
    send(response, 200, `<!doctype html><html><body>
      <h1>Staging HUB</h1>
      <form method="post" action="http://${HOST}:${APP_A_PORT}/bridge">
        <input type="hidden" name="code" value="${BRIDGE_CODE}">
        <button id="launch">Launch App A</button>
      </form>
    </body></html>`);
  });
}

function createApp(appId, port) {
  return http.createServer(async (request, response) => {
    const origin = `http://${HOST}:${port}`;
    if (request.method === "GET" && request.url === "/test-login" && appId === "app-a") {
      const sessionId = randomUUID();
      sessions.set(sessionId, { appId, revoked: false, expiresAt: Date.now() + 60_000, csrf: "csrf-synthetic" });
      return send(response, 303, "", {
        location: "/app",
        "set-cookie": `__Host-nov_app_session=${sessionId}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=60`
      });
    }
    if (request.method === "POST" && request.url === "/bridge") {
      if (request.headers.origin !== `http://${HOST}:${HUB_PORT}`) return send(response, 403, "origin_denied");
      const values = await body(request);
      if (values.get("code") !== BRIDGE_CODE || appId !== "app-a") return send(response, 401, "code_invalid");
      const sessionId = randomUUID();
      sessions.set(sessionId, { appId, revoked: false, expiresAt: Date.now() + 60_000, csrf: "csrf-synthetic" });
      return send(response, 303, "", {
        location: "/app",
        "set-cookie": `__Host-nov_app_session=${sessionId}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=60`
      });
    }
    if (request.method === "GET" && request.url === "/app") {
      const sessionId = cookieValue(request);
      const session = sessions.get(sessionId);
      const valid = Boolean(session && !session.revoked && session.appId === appId && session.expiresAt > Date.now());
      return send(response, valid ? 200 : 401, `<!doctype html><html><body>
        <h1>${appId}</h1><div id="session">${valid ? "authenticated" : "unauthorized"}</div>
        <div id="browser-security"></div>
        <button id="valid-write">Valid CSRF write</button>
        <button id="invalid-write">Invalid CSRF write</button>
        <button id="logout">Logout</button>
        <div id="action-result"></div>
        <script>
          const cleanUrl = !location.search && !location.hash;
          const noReadableCookie = document.cookie === "";
          const noTokenStorage = localStorage.length === 0 && sessionStorage.length === 0;
          const noReferrerLeak = !document.referrer.includes("token") && !document.referrer.includes("code=");
          document.getElementById("browser-security").textContent =
            [cleanUrl, noReadableCookie, noTokenStorage, noReferrerLeak].every(Boolean)
              ? "browser-security-pass" : "browser-security-fail";
          document.getElementById("valid-write").onclick = async () => {
            const result = await fetch("/api/write", { method: "POST", headers: { "x-csrf-token": "csrf-synthetic" } });
            document.getElementById("action-result").textContent = await result.text();
          };
          document.getElementById("invalid-write").onclick = async () => {
            const result = await fetch("/api/write", { method: "POST", headers: { "x-csrf-token": "wrong" } });
            document.getElementById("action-result").textContent = await result.text();
          };
          document.getElementById("logout").onclick = async () => {
            await fetch("/logout", { method: "POST" });
            location.replace("/app");
          };
        </script>
      </body></html>`);
    }
    if (request.method === "POST" && request.url === "/api/write") {
      if (request.headers.origin !== origin) return send(response, 403, "origin_denied");
      const session = sessions.get(cookieValue(request));
      if (!session || session.revoked || session.appId !== appId) return send(response, 401, "session_invalid");
      if (request.headers["x-csrf-token"] !== session.csrf) return send(response, 403, "csrf_denied");
      return send(response, 200, "write_allowed");
    }
    if (request.method === "POST" && request.url === "/logout") {
      if (request.headers.origin !== origin) return send(response, 403, "origin_denied");
      const sessionId = cookieValue(request);
      const session = sessions.get(sessionId);
      if (session) session.revoked = true;
      return send(response, 204, "", {
        "set-cookie": "__Host-nov_app_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0"
      });
    }
    if (request.method === "POST" && request.url === "/test/revoke") {
      const session = sessions.get(cookieValue(request));
      if (session) session.revoked = true;
      return send(response, 204, "");
    }
    return send(response, 404, "not found");
  });
}

const servers = [
  createHub().listen(HUB_PORT, HOST),
  createApp("app-a", APP_A_PORT).listen(APP_A_PORT, HOST),
  createApp("app-b", APP_B_PORT).listen(APP_B_PORT, HOST)
];

await Promise.all(servers.map((server) => new Promise((resolve) => server.once("listening", resolve))));
process.stdout.write(`READY http://${HOST}:${HUB_PORT}\n`);

const shutdown = () => Promise.all(servers.map((server) => new Promise((resolve) => server.close(resolve))));
process.on("SIGTERM", async () => { await shutdown(); process.exit(0); });
process.on("SIGINT", async () => { await shutdown(); process.exit(0); });
