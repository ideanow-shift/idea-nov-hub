import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdir, readFile } from "node:fs/promises";
import { extname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const packageDir = process.env.PLAYWRIGHT_PACKAGE_DIR;
assert.ok(packageDir, "PLAYWRIGHT_PACKAGE_DIR is required");
const { chromium } = await import(pathToFileURL(join(packageDir, "index.mjs")).href);
const portalRoot = fileURLToPath(new URL("../portal/", import.meta.url));
const outputRoot = fileURLToPath(new URL("../outputs/", import.meta.url));
await mkdir(outputRoot, { recursive: true });

const productionHtml = await readFile(resolve(portalRoot, "talent/index.html"), "utf8");
const appPattern =
  /<script\s+type=["']module["']\s+src=["']\.\/app\.mjs(?:\?[^"']*)?["']><\/script>/gu;
const fixtureHtml = productionHtml.replace(
  appPattern,
  '<script type="module" src="/__fixture__/bootstrap.mjs"></script>',
);

const students = Array.from({ length: 12 }, (_, index) => {
  const sourceCode = ["CONTACTS_27", "ENTRIES_27", "OFFERS_27"][index % 3];
  const classification = index % 4 === 0 ? "QUARANTINE" : "OWNER_REVIEW";
  return {
    applicationNo: null,
    recordId: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
    displayName: `表示用 学生${index + 1}`,
    kana: `ヒョウジヨウ ガクセイ${index + 1}`,
    school: `表示用美容学校 ${index % 4 + 1}`,
    phone: `090-0000-${String(index + 1).padStart(4, "0")}`,
    email: `student${index + 1}@example.invalid`,
    preferredStore: index % 2 ? "中央店" : "北口店",
    sourceCode,
    sourceLabel: { CONTACTS_27: "接触", ENTRIES_27: "エントリー", OFFERS_27: "内定" }[sourceCode],
    classification,
    classificationLabel: classification === "QUARANTINE" ? "隔離" : "要確認",
    mappingStatus: "UNMAPPED",
    status: index % 3 === 0 ? "連絡確認中" : index % 3 === 1 ? "選考確認中" : "内定情報確認中",
    businessDate: "2026-07-01",
    lineRegistrationDate: sourceCode === "CONTACTS_27" ? "2026-07-01" : null,
    offerDate: sourceCode === "OFFERS_27" ? "2026-07-15" : null,
    expectedJoinDate: sourceCode === "OFFERS_27" ? "2028-04-01" : null,
    plannedStore: sourceCode === "OFFERS_27" ? "北口店" : null,
    legacyNoPresent: false,
    primaryEligible: sourceCode === "CONTACTS_27",
    reasonLabels: classification === "QUARANTINE"
      ? ["識別情報の確認が必要"]
      : ["担当者確認が必要"],
    sourceKeyStatus: "UNPROVEN",
    suggestedTargetRecordId: null,
    suggestionCategory: "NONE",
  };
});

const fixtureBootstrap = `
import {setNovHubSessionMemoryProvider} from '/js/nov-hub-session-candidate.js';
setNovHubSessionMemoryProvider(()=>Object.freeze({
  sessionToken:'fixture-only-session-value-not-real',
  audience:'nov_hub',
  expiresAt:new Date(Date.now()+60_000).toISOString()
}));
window.fetch=async(input)=>{
  const url=String(input);
  if(!url.includes('/api/talent/v1/workspace'))throw new Error('unexpected_fixture_request');
  return new Response(JSON.stringify(${JSON.stringify({
    ok: true,
    data: {
      fiscalYear: "2027",
      payloadMode: "workspace",
      overview: {
        total: students.length,
        contacts: 4,
        entries: 4,
        exactLinkSuggestions: 0,
        offers: 4,
        ownerReview: 9,
        quarantined: 3,
        mapped: 0,
        primaryCandidates: 4,
        remainingManual: 8,
      },
      students,
    },
    meta: {
      generatedAt: "2026-07-25T00:00:00.000Z",
      requestId: "fixture",
      source: "fixture",
      version: "2",
    },
  })}),{status:200,headers:{'content-type':'application/json'}});
};
await import('/talent/app.mjs');
`;

const server = createServer(async (request, response) => {
  let requestUrl = "/";
  try {
    requestUrl = decodeURIComponent((request.url || "/").split("?")[0]);
    if (requestUrl === "/__fixture__/bootstrap.mjs") {
      response.writeHead(200, { "content-type": "text/javascript; charset=utf-8" });
      response.end(fixtureBootstrap);
      return;
    }
    const requestPath = requestUrl.replace(/^\/+/u, "") || "talent/index.html";
    const path = resolve(portalRoot, requestPath);
    const scoped = relative(portalRoot, path);
    if (scoped.startsWith("..") || isAbsolute(scoped)) {
      response.writeHead(404).end();
      return;
    }
    const body = requestUrl === "/talent/index.html" ? fixtureHtml : await readFile(path);
    const type = {
      ".html": "text/html; charset=utf-8",
      ".js": "text/javascript; charset=utf-8",
      ".mjs": "text/javascript; charset=utf-8",
      ".css": "text/css; charset=utf-8",
    }[extname(path)] || "application/octet-stream";
    response.writeHead(200, { "content-type": type });
    response.end(body);
  } catch {
    response.writeHead(404).end();
  }
});

await new Promise((resolveListen) => server.listen(0, "127.0.0.1", resolveListen));
const localOrigin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ channel: "chrome", headless: true });

try {
  for (const viewport of [
    { name: "desktop", width: 1440, height: 1000 },
    { name: "mobile", width: 390, height: 844 },
  ]) {
    const page = await browser.newPage({ viewport });
    await page.goto(`${localOrigin}/talent/index.html`);
    await page.getByText("12件を集計").waitFor();
    await page.screenshot({
      path: join(outputRoot, `nov-talent-summary-${viewport.name}.png`),
      fullPage: true,
    });
    await page.getByRole("tab", { name: "学生フォロー" }).click();
    await page.getByRole("option", { name: /^表示用 学生1 隔離/u }).waitFor();
    await page.getByRole("option", { name: /^表示用 学生2 要確認/u }).click();
    await page.getByRole("tab", { name: "学校分析" }).click();
    await page.getByRole("heading", { name: "学校別 採用状況" }).waitFor();
    await page.screenshot({
      path: join(outputRoot, `nov-talent-school-analysis-${viewport.name}.png`),
      fullPage: true,
    });
    await page.getByRole("tab", { name: "フェア分析" }).click();
    await page.getByRole("heading", { name: "フェア・流入分析" }).waitFor();
    await page.screenshot({
      path: join(outputRoot, `nov-talent-fair-analysis-${viewport.name}.png`),
      fullPage: true,
    });
    await page.getByRole("tab", { name: "学生フォロー" }).click();

    const geometry = await page.evaluate(() => {
      const body = document.body;
      const selected = document.querySelector('.student-list-item[aria-selected="true"]');
      const detail = document.getElementById("student-detail");
      const workspace = document.querySelector(".student-workspace");
      return {
        bodyOverflow: body.scrollWidth - body.clientWidth,
        selectedVisible: Boolean(selected && selected.getBoundingClientRect().height > 0),
        detailVisible: Boolean(detail && !detail.hidden && detail.getBoundingClientRect().height > 0),
        workspaceWidth: workspace?.getBoundingClientRect().width || 0,
      };
    });
    assert.ok(geometry.bodyOverflow <= 1, `${viewport.name}: horizontal overflow`);
    assert.equal(geometry.selectedVisible, true, `${viewport.name}: selected row hidden`);
    assert.equal(geometry.detailVisible, true, `${viewport.name}: detail hidden`);
    assert.ok(geometry.workspaceWidth > 300, `${viewport.name}: workspace collapsed`);
    await page.screenshot({
      path: join(outputRoot, `nov-talent-student-workspace-${viewport.name}.png`),
      fullPage: true,
    });
    await page.close();
  }
} finally {
  await browser.close();
  await new Promise((resolveClose) => server.close(resolveClose));
}

console.log("student_workspace_playwright: 2/2_PASS");
