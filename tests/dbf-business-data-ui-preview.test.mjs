import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { BUSINESS_DATA_PREVIEW_FIXTURE } from "../portal/management-app/business-data-management-preview.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("management preview contains only the four Phase 1 facts and required tabs", () => {
  assert.deepEqual(BUSINESS_DATA_PREVIEW_FIXTURE.sections.map((item) => item.key), ["PL", "BS", "STORE_OPERATING_RESULT", "BUDGET"]);
  const source = fs.readFileSync(path.join(root, "portal/management-app/business-data-management-preview.js"), "utf8");
  for (const label of ["Dashboard", "月次P/L", "B/S", "営業実績", "予算", "取込履歴"]) assert.match(source, new RegExp(label));
  assert.doesNotMatch(source, /採用|教育/u);
  assert.match(source, /runtimeImport = "DISABLED"/u);
  assert.match(source, /productionWrite = "DISABLED"/u);
});

test("management navigation contains the backend-gated business-data entry", () => {
  const html = fs.readFileSync(path.join(root, "portal/management-app/index.html"), "utf8");
  const app = fs.readFileSync(path.join(root, "portal/management-app/app-v2.js"), "utf8");
  assert.match(html, /data-section="businessdata"[\s\S]*経営データ管理[\s\S]*管理者専用/u);
  assert.match(html, /id="business-data-management-preview"/u);
  assert.match(app, /managementBusinessDataCapability/u);
  assert.match(app, /response\?\.data\?\.capability\?\.businessDataAdmin !== true/u);
});
