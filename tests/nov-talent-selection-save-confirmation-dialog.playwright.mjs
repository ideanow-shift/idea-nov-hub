import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const packageDir = process.env.PLAYWRIGHT_PACKAGE_DIR;
assert.ok(packageDir, "PLAYWRIGHT_PACKAGE_DIR is required");
const { chromium } = await import(pathToFileURL(join(packageDir, "index.mjs")).href);
const root = fileURLToPath(new URL("../portal/", import.meta.url));
const productionHtml = await readFile(resolve(root, "talent/index.html"), "utf8");
const fixtureHtml = productionHtml.replace(
  /<script\s+type="module"\s+src="\.\/app\.mjs\?[^"]+"><\/script>/u,
  '<script type="module" src="/__fixture__/selection-confirmation.mjs"></script>'
);
const fixtureBootstrap = `
import {createCandidateActivityConfirmationController} from '/talent/candidate-activity-confirmation.mjs';
window.__confirmEvents=0;
window.__postRequests=0;
const originalFetch=window.fetch;
window.fetch=async(input,init={})=>{
  if(String(init.method||'GET').toUpperCase()==='POST')window.__postRequests+=1;
  return originalFetch(input,init);
};
const formDialog=document.getElementById('candidate-activity-dialog');
const code=document.getElementById('activity-code');
code.replaceChildren(Object.assign(document.createElement('option'),{value:'INTERVIEW_COMPLETED',textContent:'面接済み'}));
document.getElementById('activity-entity-type').value='SELECTION';
document.getElementById('activity-date').value='2026-03-23';
document.getElementById('activity-reason').value='2026年3月23日に実施した面接の事実を正式Selection Historyへ登録するため';
formDialog.showModal();
const save=document.getElementById('candidate-activity-save');
const controller=createCandidateActivityConfirmationController({
  documentObject:document,
  onConfirm:async()=>{window.__confirmEvents+=1;return false;}
});
document.getElementById('candidate-activity-form').addEventListener('submit',event=>{
  event.preventDefault();
  controller.open({
    candidateName:'手塚 怜奈',eventLabel:'面接済み',date:'2026-03-23',
    reason:document.getElementById('activity-reason').value,
    command:{fixture:true},focusTarget:save
  });
});
`;

const server = createServer(async (request, response) => {
  try {
    const requestUrl = decodeURIComponent((request.url || "/").split("?")[0]);
    if (requestUrl === "/__fixture__/selection-confirmation.mjs") {
      response.writeHead(200, { "content-type": "text/javascript; charset=utf-8" });
      response.end(fixtureBootstrap);
      return;
    }
    const requestPath = requestUrl.replace(/^\/+/, "") || "talent/index.html";
    const path = resolve(root, requestPath);
    const scoped = relative(root, path);
    if (scoped.startsWith("..") || isAbsolute(scoped)) return response.writeHead(404).end();
    const body = requestUrl === "/talent/index.html" ? fixtureHtml : await readFile(path);
    const type = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8" }[extname(path)] || "application/octet-stream";
    response.writeHead(200, { "content-type": type });
    response.end(body);
  } catch {
    response.writeHead(404).end();
  }
});

await new Promise((resolveServer) => server.listen(0, "127.0.0.1", resolveServer));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  for (const viewport of [{ name: "pc", width: 1280, height: 900 }, { name: "mobile", width: 390, height: 844 }]) {
    const page = await browser.newPage({ viewport });
    const consoleErrors = [];
    const consoleWarnings = [];
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
      if (message.type() === "warning") consoleWarnings.push(message.text());
    });
    await page.goto(`${origin}/talent/index.html`);
    await page.click("#candidate-activity-save");
    await page.waitForSelector("#candidate-activity-confirm-dialog[open]");
    const first = await page.evaluate(() => {
      const dialog = document.getElementById("candidate-activity-confirm-dialog");
      const rect = dialog.getBoundingClientRect();
      return {
        candidate: document.getElementById("candidate-activity-confirm-candidate").textContent,
        event: document.getElementById("candidate-activity-confirm-event").textContent,
        date: document.getElementById("candidate-activity-confirm-date").textContent,
        reason: document.getElementById("candidate-activity-confirm-reason").textContent,
        focus: document.activeElement?.id,
        noOverflow: dialog.scrollWidth <= dialog.clientWidth && rect.left >= 0 && rect.right <= innerWidth,
        saveDisabled: document.getElementById("candidate-activity-save").disabled,
      };
    });
    assert.equal(first.candidate, "手塚 怜奈");
    assert.equal(first.event, "面接済み");
    assert.equal(first.date, "2026-03-23");
    assert.match(first.reason, /正式Selection History/u);
    assert.equal(first.focus, "candidate-activity-confirm-execute");
    assert.equal(first.noOverflow, true);
    assert.equal(first.saveDisabled, true);

    await page.click("#candidate-activity-confirm-cancel");
    await page.waitForTimeout(20);
    assert.equal(await page.locator("#candidate-activity-confirm-dialog").getAttribute("open"), null);
    assert.equal(await page.evaluate(() => document.activeElement?.id), "candidate-activity-save");

    await page.click("#candidate-activity-save");
    await page.waitForSelector("#candidate-activity-confirm-dialog[open]");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(20);
    assert.equal(await page.locator("#candidate-activity-confirm-dialog").getAttribute("open"), null);
    assert.equal(await page.evaluate(() => document.activeElement?.id), "candidate-activity-save");

    await page.click("#candidate-activity-save");
    await page.waitForSelector("#candidate-activity-confirm-dialog[open]");
    await page.dblclick("#candidate-activity-confirm-execute");
    await page.waitForTimeout(50);
    const completed = await page.evaluate(() => ({
      confirmEvents: window.__confirmEvents,
      postRequests: window.__postRequests,
      focus: document.activeElement?.id,
      stillEditing: document.getElementById("candidate-activity-dialog").open,
      confirmOpen: document.getElementById("candidate-activity-confirm-dialog").open,
    }));
    assert.deepEqual(completed, { confirmEvents: 1, postRequests: 0, focus: "candidate-activity-save", stillEditing: true, confirmOpen: false });
    assert.deepEqual(consoleErrors, []);
    assert.deepEqual(consoleWarnings, []);
    await page.close();
  }
} finally {
  await browser.close();
  await new Promise((resolveServer) => server.close(resolveServer));
}
console.log("selection_confirmation_dialog: 2/2_PASS");
