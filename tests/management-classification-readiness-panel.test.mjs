import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  SANITIZED_CLASSIFICATION_READINESS,
  mountClassificationReadinessPanel,
  renderClassificationReadinessPanel,
  validateSanitizedReadinessModel,
} from "../portal/management-platform/classification-readiness-panel.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const index = fs.readFileSync(path.join(root, "portal/management-platform/index.html"), "utf8");
const styles = fs.readFileSync(path.join(root, "portal/management-platform/styles.css"), "utf8");
const app = fs.readFileSync(path.join(root, "portal/management-platform/app.js"), "utf8");

test("mount follows Management Flow and module loads independently", () => {
  const flow = index.indexOf('id="managementFlowPanel"');
  const readiness = index.indexOf('id="classificationReadinessPanel"');
  assert.ok(flow >= 0 && readiness > flow);
  assert.match(index, /<script type="module" src="\.\/classification-readiness-panel\.js\?v=/);
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
  const mount = { innerHTML: "" };
  const rootStub = { getElementById: (id) => id === "classificationReadinessPanel" ? mount : null };
  assert.equal(mountClassificationReadinessPanel(rootStub), true);
  assert.match(mount.innerHTML, /分類承認の準備状況/);
  assert.equal(mountClassificationReadinessPanel({ getElementById: () => null }), false);
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
});

test("existing Management application ownership remains untouched", () => {
  assert.match(app, /function renderManagementFlowPanel/);
  assert.doesNotMatch(app, /classificationReadinessPanel|classification-readiness-panel/);
});
