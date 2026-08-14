import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { BUSINESS_DATA_PREVIEW_FIXTURE } from "../portal/management-app/business-data-management-preview.js";
import { resolveDbfStagingBusinessDataLanding } from "../portal/management-app/dbf-staging-business-data-landing.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("management UI contains only the four Phase 1 facts and the real import flow", () => {
  assert.deepEqual(BUSINESS_DATA_PREVIEW_FIXTURE.sections.map((item) => item.key), ["PL", "BS", "STORE_OPERATING_RESULT", "BUDGET"]);
  const source = fs.readFileSync(path.join(root, "portal/management-app/business-data-management-preview.js"), "utf8");
  for (const label of ["Dashboard", "月次P/L", "B/S", "営業実績", "予算", "取込履歴"]) assert.match(source, new RegExp(label, "u"));
  for (const action of ["start", "resolveMappings", "quarantineMappings", "confirmMapping", "validate", "preview", "approve", "promote", "history"]) {
    assert.match(source, new RegExp(`DBF_IMPORT_RUNTIME\\.${action}`, "u"));
  }
  assert.doesNotMatch(source, /採用|教育/u);
  assert.match(source, /runtimeImport = enabled \? "ENABLED" : "DISABLED"/u);
  assert.match(source, /productionWrite = "DISABLED"/u);
});

test("management navigation remains backend/session gated", () => {
  const html = fs.readFileSync(path.join(root, "portal/management-app/index.html"), "utf8");
  const app = fs.readFileSync(path.join(root, "portal/management-app/app-v2.js"), "utf8");
  assert.match(html, /data-section="businessdata"/u);
  assert.match(html, /id="business-data-management-preview"/u);
  assert.match(app, /managementBusinessDataCapability/u);
  assert.match(app, /response\?\.data\?\.capability\?\.businessDataAdmin !== true/u);
  assert.match(app, /renderBusinessDataManagementPreview\([\s\S]*?setReady\(\);[\s\S]*?selectView\(landing\.initialView\)/u);
});

test("Staging requires exact target, enabled import, disabled production write, and backend capability", () => {
  const runtime = {
    environment: "staging",
    projectRef: "zgkoofphhivesclehrom",
    projectFingerprint: "fea6c6315484f1f8fd993c68bcdb12c00ea8b6b79b970b3ea363a531133d24ce",
    runtimeImport: "ENABLED",
    productionWrite: "DISABLED",
  };
  const session = {
    audience: "dbf_staging_session_v1",
    capability: { businessDataAdmin: true },
    runtimeImport: "ENABLED",
    productionWrite: "DISABLED",
  };
  assert.deepEqual(resolveDbfStagingBusinessDataLanding(runtime, session), {
    authorized: true,
    initialView: "businessdata",
    sourceStatus: "READY_EMPTY",
    capabilitySource: "backend_session",
    requiresManagementApi: false,
  });
  assert.equal(resolveDbfStagingBusinessDataLanding(runtime, { ...session, capability: { businessDataAdmin: false } }).authorized, false);
  assert.equal(resolveDbfStagingBusinessDataLanding({ ...runtime, projectRef: "production-ref" }, session).authorized, false);
  assert.equal(resolveDbfStagingBusinessDataLanding({ ...runtime, productionWrite: "ENABLED" }, session).authorized, false);
  assert.equal(resolveDbfStagingBusinessDataLanding({ ...runtime, runtimeImport: "DISABLED" }, session).authorized, false);
  assert.equal(resolveDbfStagingBusinessDataLanding({ environment: "production" }, session), null);
});
