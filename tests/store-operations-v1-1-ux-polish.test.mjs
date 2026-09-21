import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const app = readFileSync(new URL("../portal/store-sales/app.js", import.meta.url), "utf8");
const html = readFileSync(new URL("../portal/store-sales/index.html", import.meta.url), "utf8");
const css = readFileSync(new URL("../portal/store-sales/styles.css", import.meta.url), "utf8");

test("経営シグナルは6項目を要約し対応カードへ移動できる", () => {
  assert.match(html, /id="executive-signals"/);
  assert.match(html, /id="executive-signal-links"/);
  assert.match(app, /renderExecutiveSignalSummary\(signalValues\)/);
  assert.match(app, /signals\.map\(\(signal\)/);
  assert.match(app, /scrollIntoView\(\{ behavior: "smooth", block: "center" \}\)/);
  assert.match(app, /target\?\.focus\(\{ preventScroll: true \}\)/);
  assert.match(css, /executive-signal-good/);
  assert.match(css, /executive-signal-attention/);
});

test("判断カードは営業レビューに必要な内訳を表示する", () => {
  for (const label of ["予算比", "前年比", "営業利益", "営業利益率", "総客数", "新規客数", "既存客数", "MID（参考値）", "EC売上（参考値）"]) {
    assert.match(app, new RegExp(label));
  }
});

test("共通推移グラフは今年と前年を同一図で比較する", () => {
  assert.match(app, /currentValues/);
  assert.match(app, /previousValues/);
  assert.match(app, /trend-line-current/);
  assert.match(app, /trend-line-previous/);
  assert.match(app, /今年/);
  assert.match(app, /前年/);
  assert.match(css, /trend-line-previous\{[^}]*stroke-dasharray/);
});

test("店舗一覧はPCとモバイルの両方で担当AMを表示する", () => {
  assert.match(html, /<th>担当AM<\/th>/);
  assert.match(app, /cell\(storeAm\(store\)\)/);
  assert.match(app, /node\("dt", "", "担当AM"\)/);
  assert.match(app, /function storeAm\(store\)/);
  assert.match(app, /if \(!assigned\) return "準備中"/);
  assert.doesNotMatch(app, /\["西東京AM", "埼玉AM", "都心AM"\]/);
});

test("価値・生産性詳細は技術単価と技術生産性を区別して表示する", () => {
  assert.match(app, /value: \["totalTicket", "productivity", "technicalTicket", "technicalProductivity"/);
  assert.match(app, /technicalTicket: "技術単価", technicalProductivity: "技術生産性"/);
});

test("月次と累計は要約ラベルでも選択状態を明示する", () => {
  assert.match(app, /総売上（税抜・\$\{state\.periodMode === "cumulative" \? "累計" : "月次"\}）/);
});

test("店舗詳細はブラウザ履歴を1段追加し、モバイルの戻る操作で一覧へ戻る", () => {
  assert.match(app, /window\.history\.pushState/);
  assert.match(app, /window\.addEventListener\("popstate"/);
  assert.match(app, /showList\(\{ fromHistory: true \}\)/);
});

test("優先対応カードは理由に対応した次の確認行動を表示する", () => {
  assert.match(app, /次に確認: \$\{actionAdvice\(action\)\}/);
  assert.match(app, /店舗詳細で売上・客数・単価を確認/);
});

test("既存のダッシュボード情報設計を維持する", () => {
  const ids = ["summary-heading", "actions-heading", "drivers-heading", "stores-heading"];
  const positions = ids.map((id) => html.indexOf(`id="${id}"`));
  assert.ok(positions.every((position) => position >= 0));
  assert.deepEqual(positions, [...positions].sort((a, b) => a - b));
});
