import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { BUSINESS_DATA_PREVIEW_FIXTURE } from "../portal/management-app/business-data-management-preview.js";
import { resolveDbfStagingBusinessDataLanding } from "../portal/management-app/dbf-staging-business-data-landing.js";

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

test("staging lands on the authorized empty DBF view without the unavailable management API", () => {
  const runtime = {
    environment: "staging",
    projectRef: "zgkoofphhivesclehrom",
    projectFingerprint: "fea6c6315484f1f8fd993c68bcdb12c00ea8b6b79b970b3ea363a531133d24ce",
    runtimeImport: "DISABLED",
    productionWrite: "DISABLED",
  };
  const session = {
    audience: "dbf_staging_session_v1",
    capability: { businessDataAdmin: true },
    runtimeImport: "DISABLED",
    productionWrite: "DISABLED",
  };
  assert.deepEqual(resolveDbfStagingBusinessDataLanding(runtime, session), {
    authorized: true,
    initialView: "businessdata",
    sourceStatus: "READY_EMPTY",
    capabilitySource: "backend_session",
    requiresManagementApi: false,
  });

  const source = fs.readFileSync(path.join(root, "portal/management-app/app-v2.js"), "utf8");
  const initializeSource = source.slice(source.indexOf("async function initialize()"), source.indexOf("function removeLegacyHubContextFromUrl"));
  const stagingBranch = initializeSource.slice(initializeSource.indexOf('if (runtimeEnvironment?.environment === "staging")'), initializeSource.indexOf("} else {", initializeSource.indexOf("if (!session?.sessionToken)")));
  assert.match(stagingBranch, /selectView\(landing\.initialView\)/u);
  assert.match(stagingBranch, /BUSINESS_DATA_EMPTY_FIXTURE/u);
  assert.doesNotMatch(stagingBranch, /loadBusinessDataCapability|managementFinanceSummary/u);
});

test("staging fails closed for spoofed capability or the wrong environment binding", () => {
  const runtime = {
    environment: "staging",
    projectRef: "zgkoofphhivesclehrom",
    projectFingerprint: "fea6c6315484f1f8fd993c68bcdb12c00ea8b6b79b970b3ea363a531133d24ce",
    runtimeImport: "DISABLED",
    productionWrite: "DISABLED",
  };
  const session = {
    audience: "dbf_staging_session_v1",
    capability: { businessDataAdmin: false },
    runtimeImport: "DISABLED",
    productionWrite: "DISABLED",
  };
  assert.equal(resolveDbfStagingBusinessDataLanding(runtime, session).authorized, false);
  assert.equal(resolveDbfStagingBusinessDataLanding({ ...runtime, projectRef: "production-ref" }, { ...session, capability: { businessDataAdmin: true } }).authorized, false);
  assert.equal(resolveDbfStagingBusinessDataLanding({ ...runtime, productionWrite: "ENABLED" }, { ...session, capability: { businessDataAdmin: true } }).authorized, false);
  assert.equal(resolveDbfStagingBusinessDataLanding({ environment: "production" }, session), null);
});
