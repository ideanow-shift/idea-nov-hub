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
  for (const label of ["ホーム", "データ取込", "法人B/S", "店舗月次実績", "予算", "取込履歴"]) assert.match(source, new RegExp(label, "u"));
  for (const label of ["今月の進捗", "データ検証", "法人・店舗の紐付け", "勘定科目確認", "承認", "正式データへ反映", "完了", "次にやること"]) assert.match(source, new RegExp(label, "u"));
  for (const action of ["start", "resolveMappings", "quarantineMappings", "confirmMapping", "validate", "preview", "approve", "promote", "history"]) {
    assert.match(source, new RegExp(`DBF_IMPORT_RUNTIME\\.${action}`, "u"));
  }
  assert.doesNotMatch(source, /採用|教育/u);
  assert.match(source, /runtimeImport = enabled \? "ENABLED" : "DISABLED"/u);
  assert.match(source, /productionWrite = "DISABLED"/u);
  assert.match(source, /DBF_IMPORT_RUNTIME\.pilotPreview/u);
  assert.match(source, /DBF_IMPORT_RUNTIME\.corporatePromotionPreflight/u);
  assert.match(source, /deriveDbfWorkflowState/u);
  for (const label of [
    "対象月", "データ提供責任者", "会計確定状態", "正式反映候補", "正式データ書込",
    "P\/L取込内容", "B\/S取込内容", "予算取込内容", "紐付け・監査", "警告",
    "データ提供元の優先順位確認", "税区分確認", "正式データへの反映は無効",
  ]) assert.match(source, new RegExp(label, "u"));
  assert.match(source, /data\.sourcePrecedence\?\.duplicatePromotionCount/u);
  assert.match(source, /data\.taxBasis\?\.status/u);
  assert.match(source, /promotion\.disabled = true/u);
  assert.doesNotMatch(source, /const \[result, pilot\] = await Promise\.all/u);
  assert.match(
    source,
    /const result = await DBF_IMPORT_RUNTIME\.history[\s\S]*?const pilot = dashboardMonth\.value === "2026-06"[\s\S]*?await DBF_IMPORT_RUNTIME\.pilotPreview/u,
  );
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

test("Pilot coverage cards stay within the 390px Hosted Staging viewport", () => {
  const styles = fs.readFileSync(path.join(root, "portal/management-app/styles.css"), "utf8");
  assert.match(styles, /@media\(max-width:600px\)[\s\S]*?\.business-data-coverage-grid\{grid-template-columns:1fr\}/u);
});

test("Owner UAT guidance, wizard, safe errors and completion state are explicit", () => {
  const source = fs.readFileSync(path.join(root, "portal/management-app/business-data-management-preview.js"), "utf8");
  const accountReview = fs.readFileSync(path.join(root, "portal/management-app/dbf-account-mapping-review.js"), "utf8");
  const styles = fs.readFileSync(path.join(root, "portal/management-app/styles.css"), "utf8");
  for (const label of [
    "はじめに：DBFの月次処理", "月次処理を始める", "次回から表示しない", "この画面は何をするところ？",
    "使用するデータ", "ファイルの準備方法を見る", "この内容で取り込む", "まだデータが登録されていません",
    "のデータ処理が完了しました", "技術情報を表示",
  ]) assert.match(source, new RegExp(label, "u"));
  for (const label of ["勘定科目確認", "承認", "修正して承認", "対象外", "要再確認", "判断を保存"]) assert.match(accountReview, new RegExp(label, "u"));
  assert.match(styles, /business-data-workspace/u);
  assert.match(styles, /focus-visible/u);
  assert.doesNotMatch(source, /accept\s*=\s*["'][^"']*(xlsx|pdf)/iu);
});
