import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  SANITIZED_CLASSIFICATION_READINESS,
  mountClassificationReadinessPanel,
  mountClassificationWorkspace,
  renderClassificationReadinessPanel,
  renderClassificationWorkspace,
  validateSanitizedReadinessModel,
} from "../portal/management-platform/classification-readiness-panel.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const index = fs.readFileSync(path.join(root, "portal/management-platform/index.html"), "utf8");
const styles = fs.readFileSync(path.join(root, "portal/management-platform/styles.css"), "utf8");
const app = fs.readFileSync(path.join(root, "portal/management-platform/app.js"), "utf8");
const visualFixture = fs.readFileSync(path.join(root, "tests/fixtures/management-classification-workspace.html"), "utf8");

test("mount follows Management Flow and module loads independently", () => {
  const flow = index.indexOf('id="managementFlowPanel"');
  const readiness = index.indexOf('id="classificationReadinessPanel"');
  assert.ok(flow >= 0 && readiness > flow);
  assert.match(index, /<script type="module" src="\.\/classification-readiness-panel\.js\?v=/);
  assert.match(index, /data-view="classification">分類準備<\/button>/);
  assert.match(index, /id="view-classification"[\s\S]*id="classificationWorkspace"/);
});

test("classification workspace shows the practical fail-closed path", () => {
  const html = renderClassificationWorkspace();
  assert.match(html, /分類データを利用するまで/);
  assert.match(html, /Source基盤候補[\s\S]*6 \/ 6/);
  assert.match(html, /本番カタログ証跡[\s\S]*PENDING/);
  assert.match(html, /Runtime接続[\s\S]*0 \/ 6/);
  assert.match(html, /承認可能件数[\s\S]*0件/);
  assert.match(html, /本番カタログ証跡とruntime provider identityが未完了です。/);
  assert.equal((html.match(/class="classification-workspace-step"/g) ?? []).length, 5);
  assert.match(html, /<button type="button" disabled aria-disabled="true"/);
  assert.doesNotMatch(html, /sha256|digest|employeeId|corporationId|targetRef/i);
});

test("visual fixture uses only the production workspace module and styles", () => {
  assert.match(visualFixture, /portal\/management-platform\/styles\.css/);
  assert.match(visualFixture, /id="classificationWorkspace"/);
  assert.match(visualFixture, /portal\/management-platform\/classification-readiness-panel\.js/);
  assert.doesNotMatch(visualFixture, /config\.js|app\.js|fetch\(|token|session|storage/i);
});

test("sanitized six-provider model is fail-closed", () => {
  assert.equal(validateSanitizedReadinessModel(SANITIZED_CLASSIFICATION_READINESS), true);
  assert.equal(SANITIZED_CLASSIFICATION_READINESS.providers.length, 6);
  assert.equal(SANITIZED_CLASSIFICATION_READINESS.workflow.length, 3);
  assert.equal(SANITIZED_CLASSIFICATION_READINESS.approvalRules.length, 3);
  assert.equal(SANITIZED_CLASSIFICATION_READINESS.localRehearsal, "PASS");
  assert.equal(SANITIZED_CLASSIFICATION_READINESS.productionCatalogProof, "PENDING");
  assert.equal(SANITIZED_CLASSIFICATION_READINESS.action.enabled, false);
  assert.equal(SANITIZED_CLASSIFICATION_READINESS.action.reason, "VERSION_PROVIDER_NOT_READY");
});

test("panel exposes no digests, identities, or enabled action", () => {
  const html = renderClassificationReadinessPanel();
  assert.match(html, /<button type="button" disabled aria-disabled="true"/);
  assert.doesNotMatch(html, /sha256|digest|runtimeApproved|employee|corporationId|targetRef/i);
  for (const label of ["版管理", "スナップショット", "法人範囲", "対象期間", "データ所有元", "実行者・監査"]) {
    assert.ok(html.includes(label));
  }
  assert.match(html, /本番カタログの権限確認が未完了です。/);
  assert.match(html, /スナップショット[\s\S]*基盤候補済み/);
  assert.match(html, /安全な基盤候補は検証済みです。runtime適用は未実施です。/);
  assert.match(html, /法人範囲[\s\S]*基盤候補済み/);
  assert.match(html, /範囲判定の非破壊基盤候補は検証済みです。runtime適用は未実施です。/);
  assert.match(html, /対象期間[\s\S]*基盤候補済み/);
  assert.match(html, /対象月と有効期間の非破壊基盤候補は検証済みです。runtime適用は未実施です。/);
  assert.match(html, /データ所有元[\s\S]*基盤候補済み/);
  assert.match(html, /所有元判定とsnapshot連携の非破壊基盤候補は検証済みです。runtime適用は未実施です。/);
  assert.match(html, /実行者・監査[\s\S]*基盤候補済み/);
  assert.match(html, /実行者確認と監査記録の非破壊基盤候補は検証済みです。runtime適用は未実施です。/);
  assert.equal((html.match(/runtime接続は未実施です。/g) ?? []).length, 0);
  assert.match(html, /6提供元の基盤候補を検証済み（うち本番証跡待ち1件）。runtime接続まで操作不可/);
  assert.match(html, /ローカル検証[\s\S]*本番証跡[\s\S]*分類承認/);
  assert.match(html, /レビュー済みの対象だけを扱います/);
  assert.match(html, /対象は1件から50件まで明示選択します/);
  assert.match(html, /変更前に版とスナップショットを再確認します/);
});

test("invalid model renders a closed empty state", () => {
  const html = renderClassificationReadinessPanel({ ...SANITIZED_CLASSIFICATION_READINESS, action: { enabled: true } });
  assert.match(html, /data-readiness-status="INVALID"/);
  assert.doesNotMatch(html, /class="classification-readiness-provider"/);
  assert.match(html, /<button type="button" disabled/);
});

test("mount changes only its dedicated element", () => {
  const readinessMount = { innerHTML: "" };
  const workspaceMount = { innerHTML: "" };
  const rootStub = { getElementById: (id) => ({ classificationReadinessPanel: readinessMount, classificationWorkspace: workspaceMount })[id] ?? null };
  assert.equal(mountClassificationReadinessPanel(rootStub), true);
  assert.equal(mountClassificationWorkspace(rootStub), true);
  assert.match(readinessMount.innerHTML, /分類承認の準備状況/);
  assert.match(workspaceMount.innerHTML, /分類データを利用するまで/);
  assert.equal(mountClassificationReadinessPanel({ getElementById: () => null }), false);
  assert.equal(mountClassificationWorkspace({ getElementById: () => null }), false);
});

test("desktop visual contract uses stable three-column provider grid", () => {
  assert.match(styles, /\.classification-readiness-providers\s*{[^}]*grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\)/s);
  assert.match(styles, /\.classification-readiness-facts\s*{[^}]*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/s);
  assert.match(styles, /\.classification-readiness-workflow\s*{[^}]*grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\)/s);
});

test("mobile visual contract stacks facts, providers, and action", () => {
  const mobile = styles.match(/@media \(max-width: 560px\)\s*{[\s\S]*?\n}/)?.[0] ?? "";
  assert.match(mobile, /\.classification-readiness-facts/);
  assert.match(mobile, /\.classification-readiness-providers/);
  assert.match(styles, /@media \(max-width: 880px\)[\s\S]*\.classification-readiness-workflow\s*{\s*grid-template-columns:\s*1fr;/);
  assert.match(styles, /\.classification-readiness-action\s*{[^}]*flex-direction:\s*column/s);
  assert.match(styles, /@media \(max-width: 880px\)[\s\S]*\.classification-workspace-metrics\s*{\s*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\);/);
  assert.match(mobile, /\.classification-workspace-metrics/);
});

test("Management application adds only the admin view boundary", () => {
  assert.match(app, /function renderManagementFlowPanel/);
  assert.match(app, /name === "environment" \|\| name === "classification"/);
  assert.match(app, /\["environment", "classification"\]\.forEach/);
  assert.doesNotMatch(app, /classificationReadinessPanel|classificationWorkspace|classification-readiness-panel/);
  assert.doesNotMatch(app, /\/classification|managementClassification|classificationApproval/);
});
