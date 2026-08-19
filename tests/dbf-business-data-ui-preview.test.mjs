import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { BUSINESS_DATA_PREVIEW_FIXTURE } from "../portal/management-app/business-data-management-preview.js";
import { resolveDbfStagingBusinessDataLanding } from "../portal/management-app/dbf-staging-business-data-landing.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("management UI exposes one ingestion entry for only the four Phase 2 facts", () => {
  assert.deepEqual(BUSINESS_DATA_PREVIEW_FIXTURE.sections.map((item) => item.key), ["PL", "BS", "STORE_OPERATING_RESULT", "BUDGET"]);
  const source = fs.readFileSync(path.join(root, "portal/management-app/business-data-management-preview.js"), "utf8");
  for (const label of ["今月のデータ", "法人P/L", "法人B/S", "店舗月次実績", "予算", "次にやること", "取込履歴を見る"]) assert.match(source, new RegExp(label, "u"));
  assert.equal((source.match(/＋ ファイルを追加/gu) || []).length, 1);
  assert.match(source, /何のデータを登録しますか？/u);
  for (const step of ["STEP 1", "STEP 2", "STEP 3", "STEP 4", "STEP 5", "STEP 6"]) assert.match(source, new RegExp(step, "u"));
  assert.doesNotMatch(source, /node\(doc, "nav", "business-data-tabs"\)/u);
  assert.doesNotMatch(source, /dataset\.businessDataView/u);
  for (const excluded of ["キャッシュフロー", "顧客売上明細一覧"]) assert.doesNotMatch(source, new RegExp(excluded, "u"));
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
    /const result = await DBF_IMPORT_RUNTIME\.history[\s\S]*?const pilot = shellMonth\.value === "2026-06"[\s\S]*?await DBF_IMPORT_RUNTIME\.pilotPreview/u,
  );
});

test("single-ingestion governance keeps DBF as the only write entry without changing the portfolio order", () => {
  const governance = fs.readFileSync(path.join(root, "docs/cto/PORTFOLIO_PRIORITY_LOCK.md"), "utf8");
  assert.match(governance, /経営データのWrite入口はDBFのみ/u);
  assert.match(governance, /ConsumerはDBF Canonical FactをRead-onlyで利用/u);
  assert.match(governance, /独自CSV\/POS取込や同一Factの複製保存を原則として追加しない/u);
  assert.match(governance, /P\/L、B\/S、予算、店舗月次実績/u);
  assert.match(governance, /Cash FlowとPOS顧客明細の保持は本Phaseの対象外/u);
  assert.match(governance, /Portfolio Lockの実行順序やPhaseを変更しない/u);
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

test("single-entry status and actions stay within the 390px Hosted Staging viewport", () => {
  const styles = fs.readFileSync(path.join(root, "portal/management-app/styles.css"), "utf8");
  assert.match(styles, /@media\(max-width:600px\)[\s\S]*?\.dbf-single-entry-status\{grid-template-columns:1fr auto\}/u);
  assert.match(styles, /\.dbf-single-entry-actions\{display:grid;grid-template-columns:1fr;width:100%\}/u);
});

test("Owner UAT single entry, conditional specialist route, and safe errors are explicit", () => {
  const source = fs.readFileSync(path.join(root, "portal/management-app/business-data-management-preview.js"), "utf8");
  const accountReview = fs.readFileSync(path.join(root, "portal/management-app/dbf-account-mapping-review.js"), "utf8");
  const styles = fs.readFileSync(path.join(root, "portal/management-app/styles.css"), "utf8");
  for (const label of [
    "対象月", "登録済み", "未登録", "要確認", "確認する",
    "使用するファイルを確認", "ファイルの準備方法を見る", "この内容で取り込む", "まだデータが登録されていません",
    "技術情報を表示", "月次処理の詳細を見る",
  ]) assert.match(source, new RegExp(label, "u"));
  for (const label of ["勘定科目確認", "承認", "修正して承認", "対象外", "要再確認", "判断を保存"]) assert.match(accountReview, new RegExp(label, "u"));
  assert.match(styles, /business-data-workspace-single-entry/u);
  assert.match(styles, /dbf-single-entry-type-grid/u);
  assert.match(styles, /focus-visible/u);
  assert.doesNotMatch(source, /accept\s*=\s*["'][^"']*(xlsx|pdf)/iu);
});
