import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import process from "node:process";
import { createRequire } from "node:module";

const root = process.cwd();
const nodeModules = process.env.CODEX_NODE_MODULES || "";
const bundledPlaywright = nodeModules
  ? path.join(nodeModules, ".pnpm", "playwright@1.61.1", "node_modules", "playwright", "package.json")
  : "";
const require = createRequire(fs.existsSync(bundledPlaywright) ? bundledPlaywright : nodeModules ? path.join(nodeModules, "package.json") : import.meta.url);
const { chromium } = require("playwright");

const mime = new Map([
  [".html", "text/html;charset=utf-8"],
  [".js", "text/javascript;charset=utf-8"],
  [".css", "text/css;charset=utf-8"],
]);

function serveFile(request, response) {
  const url = new URL(request.url || "/", "http://127.0.0.1");
  const pathname = url.pathname === "/" ? "/portal/management-app/" : url.pathname;
  const filePath = path.join(root, decodeURIComponent(pathname).replace(/^\/+/, ""));
  const safe = path.resolve(filePath).startsWith(path.resolve(root));
  if (!safe || !fs.existsSync(filePath)) {
    response.writeHead(404);
    response.end("not found");
    return;
  }
  const stat = fs.statSync(filePath);
  const finalPath = stat.isDirectory() ? path.join(filePath, "index.html") : filePath;
  response.writeHead(200, { "Content-Type": mime.get(path.extname(finalPath)) || "application/octet-stream" });
  response.end(fs.readFileSync(finalPath));
}

function apiResponse(action) {
  if (action !== "managementDataopsStatus") return { ok: true, data: {} };
  return {
    ok: true,
    data: {
      statusCounts: {
        sourceDocuments: 9,
        accountingRawRows: 38076,
        classificationDraft: 69,
        classificationReview: 0,
      },
      workflow: [
        { step: 1, title: "原本取込", owner: "DataOps", status: "ready" },
        { step: 2, title: "分類確認", owner: "Finance", status: "waiting" },
        { step: 3, title: "本番反映", owner: "Management", status: "disabled" },
      ],
      stoppedItems: [
        "SalonAnswer raw import",
        "classification approved update",
        "production recalculation",
      ],
    },
  };
}

const server = http.createServer(serveFile);
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const port = server.address().port;
const systemChrome = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const browser = await chromium.launch(fs.existsSync(systemChrome) ? { executablePath: systemChrome } : {});

try {
  const results = [];
  for (const viewport of [{ width: 1280, height: 800, name: "desktop" }, { width: 390, height: 844, name: "mobile" }]) {
    const page = await browser.newPage({ viewport });
    await page.addInitScript(() => {
      sessionStorage.setItem("ideaNov.hub.session.v1", JSON.stringify({
        sessionToken: "visual-fixture-session",
        audience: "nov_hub",
        expiresAt: "2099-01-01T00:00:00.000Z",
      }));
    });
    await page.route("**/*", async (route) => {
      const request = route.request();
      if (request.method() !== "POST") return route.continue();
      const body = request.postData() || "";
      const params = new URLSearchParams(body);
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(apiResponse(params.get("action") || "")),
      });
    });
    await page.goto(`http://127.0.0.1:${port}/portal/management-app/#dataops`, { waitUntil: "networkidle" });
    const result = await page.evaluate(() => {
      const panel = document.querySelector(".production-readiness-panel");
      const categories = [...document.querySelectorAll("[data-production-readiness-category]")].map((node) => node.getAttribute("data-production-readiness-category"));
      const disabledButtons = [...document.querySelectorAll(".production-readiness-panel button")].filter((button) => button.disabled).length;
      const enabledButtons = [...document.querySelectorAll(".production-readiness-panel button")].filter((button) => !button.disabled).length;
      const boxes = [...document.querySelectorAll(".production-readiness-panel, .production-readiness-item, .section-tab, .tab")].map((node) => {
        const rect = node.getBoundingClientRect();
        return { width: rect.width, height: rect.height, left: rect.left, right: rect.right };
      });
      return {
        panelVisible: !!panel && !panel.closest("[hidden]"),
        categories,
        disabledButtons,
        enabledButtons,
        horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + 1,
        clippedText: boxes.some((box) => box.width < 1 || box.height < 1 || box.left < -1 || box.right > window.innerWidth + 1),
      };
    });
    await page.close();
    results.push({ viewport: viewport.name, ...result });
  }
  const failed = results.filter((result) => !result.panelVisible || result.categories.length !== 4 || result.enabledButtons !== 0 || result.horizontalOverflow || result.clippedText);
  if (failed.length) throw new Error(JSON.stringify(failed));
  console.log(JSON.stringify({ passed: true, results }, null, 2));
} finally {
  await browser.close();
  server.close();
}
