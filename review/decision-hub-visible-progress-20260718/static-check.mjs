import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const root = path.resolve(import.meta.dirname, "..", "..");
const app = fs.readFileSync(path.join(root, "portal", "decision-hub", "app.js"), "utf8");
const html = fs.readFileSync(path.join(root, "portal", "decision-hub", "index.html"), "utf8");
const appHashPrefix = crypto.createHash("sha256").update(app).digest("hex").slice(0, 12);

const checks = [
  ["ready state follows successful list render", /renderSummary\(applications\);[\s\S]{0,160}renderReady\(applications\.length\);/.test(app)],
  ["loading copy is localized", app.includes('renderLoading("申請一覧を確認しています。")')],
  ["empty list has completed copy", app.includes("現在、表示できる申請はありません。")],
  ["new application navigation exists", html.includes('id="tab-new-application"')],
  ["planning and contract form exists", html.includes('id="new-application-panel"') && html.includes('name="applicationType"')],
  ["progress panel is secondary", html.includes('class="panel progress-panel"') && /\.progress-panel\s*\{\s*order:\s*50;/.test(html)],
  ["detail and comments have view boundaries", html.includes('id="detail-section"') && html.includes('id="comments-section"')],
  ["draft save remains disabled", /<button type="button" disabled>下書き保存<\/button>/.test(html)],
  ["submit remains disabled", /<button type="submit" disabled>申請する<\/button>/.test(html)],
  ["module cache identity matches app", html.includes(`./app.js?v=${appHashPrefix}`)],
  ["no Decision write API call", !/callApiAction\("decision(?:Save|Submit|Approve|Return|Reject|Cancel)/.test(app)],
  ["no direct fetch", !/\bfetch\s*\(/.test(app)],
  ["no token in DOM", !/textContent\s*=\s*[^;]*(?:token|sessionToken)/i.test(app)]
];

const failed = checks.filter(([, ok]) => !ok);
for (const [name, ok] of checks) console.log(`${ok ? "PASS" : "FAIL"}: ${name}`);
if (failed.length) process.exit(1);
console.log(`PASS: ${checks.length}/${checks.length}`);
