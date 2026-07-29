import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const html = readFileSync(new URL("../portal/store-sales/staging.html", import.meta.url), "utf8");
const app = readFileSync(new URL("../portal/store-sales/app.js", import.meta.url), "utf8");
const config = readFileSync(new URL("../portal/store-sales/staging-config.js", import.meta.url), "utf8");
const runtime = readFileSync(new URL("../portal/store-sales/runtime/store-sales-runtime.js", import.meta.url), "utf8");
const workflow = readFileSync(new URL("../.github/workflows/store-sales-staging-check.yml", import.meta.url), "utf8");
const pages = readFileSync(new URL("../.github/workflows/deploy-pages.yml", import.meta.url), "utf8");

test("Staging banner is explicit and accessible", () => assert.match(html, /role="status"[\s\S]*Staging環境・Synthetic Data/));
test("Staging uses frozen Runtime entry through app", () => {
  assert.match(html, /app\.js/);
  assert.match(app, /createStoreSalesRuntime/);
  assert.doesNotMatch(app, /supabase|Accounting API|KPI API/);
});
test("Staging config uses staging feature flag", () => assert.match(config, /featureFlag:\s*"staging"/));
test("Staging production block remains true", () => assert.match(config, /productionBlocked:\s*true/));
test("Staging synthetic mode remains true", () => assert.match(config, /syntheticDataEnabled:\s*true/));
test("Runtime state registry remains frozen", () => assert.match(runtime, /"initializing"[\s\S]*"loading"[\s\S]*"ready"[\s\S]*"empty"[\s\S]*"unauthorized"[\s\S]*"forbidden"[\s\S]*"validation_error"[\s\S]*"maintenance"[\s\S]*"timeout"[\s\S]*"offline"/));
test("Retry control exists", () => assert.match(html, /id="retry-button"/));
test("Return to HUB exists", () => assert.match(html, /NOV HUBへ戻る/));
test("Mobile viewport exists", () => assert.match(html, /width=device-width/));
test("Keyboard tablist exists", () => assert.match(html, /role="tablist"/));
test("ARIA live status exists", () => assert.match(html, /aria-live="polite"/));
test("Staging quality gates cover security and E2E", () => {
  assert.match(workflow, /RLS negative test|security/i);
  assert.match(workflow, /staging-e2e-approval/);
});
test("Pages production deploy is no longer automatic on main push", () => {
  assert.doesNotMatch(pages, /push:\s*[\s\S]*branches:\s*\["main"\]/);
  assert.match(pages, /production_approved/);
});
test("Staging deploy candidate is not a production deploy", () => {
  const deploy = readFileSync(new URL("../.github/workflows/store-sales-staging-deploy.yml", import.meta.url), "utf8");
  assert.match(deploy, /Dry-run only/);
  assert.doesNotMatch(deploy, /supabase\s+deploy|deploy-pages/);
});
test("Staging page contains no environment switch UI", () => assert.doesNotMatch(html, /select.*environment|data-mode|localStorage/i));
