# Phase 5 UI改善結果

## 実施情報

- ブランチ: `feat/store-sales-management-phase5-prototype`
- HEAD: `8693988c195bf2ec74c365c9ebdf717eab35e8d4`
- 状態: UI改善差分は未コミット
- 確認方法: review fixtureを使ったローカルブラウザ確認
- 本番接続・deploy: なし

## 改善内容

### 対象月

- 営業対象月と会計確定月を分離
- 営業対象月は画面のmonth inputから表示
- 会計確定月はProjectionの`confirmedThroughPeriod`を表示
- 利益・会計KPIの利用可能値へ「YYYY年M月確定値」を補足
- 営業月と会計確定月が異なる状態を通常表示

### スマホ店舗一覧

- 620px以下では比較tableを非表示にし、店舗cardを主表示
- 店舗名、状態、Direct/FC、売上、営業利益率、経常利益率、確認理由、詳細導線を表示
- Projectionが返す店舗順を変更せず表示
- 値なしはdata stateを表示

### 店舗責任者

- review Projectionの`audience=store_manager`を使用
- 全社Summary、要確認店舗数、全店舗一覧、他店舗導線、Direct/FC filterを表示しない
- 自店舗詳細をhomeとして表示
- 「店舗名の状況」、状態、今月やること、Accounting metadata、4tabを表示
- UI非表示は認可の代用にせず、Projectionが返すscope内店舗だけを使用

### 状態表示

- available: 確定値を表示
- collecting: 集計中
- preparing: 準備中
- validation_error: データ確認が必要
- unavailable: 取得できません
- state変換とARIA labelを同じ関数へ統一
- availableの「利用可能」反復を削除
- 店舗状態を要確認／改善中／安定／好調へ日本語化

### Empty State

- 0店舗・空配列を先に判定
- Executive Summary、Business Drivers、Store Listで安全なempty stateを表示
- 「表示できる店舗がありません」
- 「権限または対象月をご確認ください」
- 空Business DriversでJavaScript例外が発生しないことをブラウザで確認

### Responsive / Accessibility

- スマホAccounting情報を2列へ圧縮
- スマホtabに横スワイプ案内を追加
- ArrowLeft / ArrowRightでtab focusと選択を移動
- metric、data state、店舗状態に統一ARIA labelを追加
- 320px相当でdocument横overflowなし

## テスト結果

- Store Sales UI contract: 12/12
- Store Sales Projection回帰: 4/4
- Accounting Core / KPI Engine回帰: 61/61
- TypeScript check: 合格
- JavaScript syntax: 合格
- `git diff --check`: 合格
- browser console error/warning: 0
- 320px:
  - document width: 320px
  - horizontal overflow: なし
- keyboard:
  - Sales & ProfitからArrowRightでCustomer & Repeatへ移動
  - `aria-selected=true`を確認
- ARIA:
  - 店舗状態labelを確認
  - metric state labelを確認

## 再生成スクリーンショット

- `executive-desktop.png` — 1440 × 1000
- `executive-mobile.png` — 390 × 844
- `store-list-mobile.png` — 390 × 844
- `store-manager-summary-mobile.png` — 390 × 844
- `store-summary-mobile.png` — 390 × 844
- `pending-state-mobile.png` — 390 × 844
- `validation-error-mobile.png` — 390 × 844
- `empty-store-list-mobile.png` — 390 × 844

## 今回の変更ファイル

- `portal/store-sales/index.html`
- `portal/store-sales/styles.css`
- `portal/store-sales/app.js`
- `portal/store-sales/review-fixtures.js`
- `tests/store-sales-ui.test.mjs`
- `docs/store_sales_management/phase5/ui-review/*.png`
- `docs/store_sales_management/phase5/ui-review/ui-improvement-result.md`

Accounting Core、Accounting KPI Engine、Store Sales Projection API、
Store Status Engineの業務ロジックは変更していない。

