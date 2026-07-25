import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import process from "node:process";
import { createRequire } from "node:module";

const root = process.cwd();
const csvPath = path.join(root, "review/.tmp-current-hub-workforce-visual-fixture.csv");
const sampleCurrentHubCsv = [
  '"元_所属","元_主店舗名","元_部署","対象件数","経営管理_店舗","経営管理_配賦区分","経営管理_在籍人数区分","経営管理_稼働人数区分","経営管理_法人状態","経営管理_確認ステータス","備考"',
  '"本部","主店舗未入力","経理部","1","本部","HQ_OR_SHARED","INCLUDE_RESIDENT","INCLUDE_WORKING","CORPORATION_MAPPING_SEPARATE","DRAFT_FROM_CURRENT_HUB_EXPORT","匿名サンプル"',
  '"店舗A","店舗A","部署未入力","188","店舗A","STORE","INCLUDE_RESIDENT","INCLUDE_WORKING","CORPORATION_MAPPING_SEPARATE","DRAFT_FROM_CURRENT_HUB_EXPORT","匿名サンプル"',
  '"店舗B","店舗B","部署未入力","1","店舗B","STORE","INCLUDE_RESIDENT","EXCLUDE_NON_WORKING_LEAVE","CORPORATION_MAPPING_SEPARATE","DRAFT_FROM_CURRENT_HUB_EXPORT","匿名サンプル"',
  "",
].join("\r\n");
const nodeModules = process.env.CODEX_NODE_MODULES || path.join(root, "node_modules");
const bundledPlaywright = path.join(nodeModules, ".pnpm", "playwright@1.61.1", "node_modules", "playwright", "package.json");
const require = createRequire(fs.existsSync(bundledPlaywright) ? bundledPlaywright : path.join(nodeModules, "package.json"));
const { chromium } = require("playwright");

const mime = new Map([
  [".html", "text/html;charset=utf-8"],
  [".js", "text/javascript;charset=utf-8"],
  [".css", "text/css;charset=utf-8"],
]);

function serveFile(request, response) {
  const url = new URL(request.url || "/", "http://127.0.0.1");
  const filePath = path.join(root, decodeURIComponent(url.pathname || "/").replace(/^\/+/, ""));
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
  if (action !== "managementStoresSummary") return { ok: true, data: {} };
  return {
    ok: true,
    data: {
      phase0Scope: "all_stores",
      storeCount: 3,
      staffCount: null,
      requiredCsvFiles: [],
      stores: [
        { name: "本部", corporationName: "IDEA NOV", staffCount: null, dataReadiness: "salonanswer_csv_waiting" },
        { name: "BASSA久米川店", corporationName: "UNO", staffCount: null, dataReadiness: "salonanswer_csv_waiting" },
        { name: "BASSA新所沢店", corporationName: "ALBERO", staffCount: null, dataReadiness: "salonanswer_csv_waiting" },
      ],
    },
  };
}

const server = http.createServer(serveFile);
fs.writeFileSync(csvPath, sampleCurrentHubCsv, "utf8");
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
    await page.goto(`http://127.0.0.1:${port}/portal/management-app/#stores`, { waitUntil: "networkidle" });
    await page.setInputFiles("[data-workforce-allocation-input]", csvPath);
    await page.waitForFunction(() => document.querySelector("span[data-workforce-allocation-status]")?.textContent?.includes("社員マスタ確認済み"));
    const result = await page.evaluate(() => {
      const text = document.body.innerText;
      const enabledActionButtons = [...document.querySelectorAll(".workforce-evidence-status button")].filter((button) => !button.disabled).length;
      return {
        statusCategory: document.querySelector("[data-workforce-evidence-category]")?.getAttribute("data-workforce-evidence-category"),
        receiptCategory: document.querySelector("span[data-workforce-allocation-status]")?.textContent || "",
        storeStaffShown: text.includes("社員マスタ確認済み"),
        aggregateShown: text.includes("社員マスタ 189名"),
        noUnassigned29: !text.includes("29名"),
        enabledActionButtons,
        horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + 1,
      };
    });
    await page.close();
    results.push({ viewport: viewport.name, ...result });
  }
  const failed = results.filter((result) => result.statusCategory !== "LOCAL_VALIDATED_PENDING_PRODUCTION"
    || !result.receiptCategory.includes("在籍 190")
    || !result.storeStaffShown
    || !result.aggregateShown
    || !result.noUnassigned29
    || result.enabledActionButtons !== 0
    || result.horizontalOverflow);
  if (failed.length) throw new Error(JSON.stringify(failed));
  console.log(JSON.stringify({ passed: true, results }, null, 2));
} finally {
  await browser.close();
  server.close();
  try { fs.unlinkSync(csvPath); } catch {}
}
