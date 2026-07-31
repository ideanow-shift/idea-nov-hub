# Sprint 3 営業部UXレビューガイド

## 起動

`node scripts/start-store-sales-staging.mjs`

代表: `http://127.0.0.1:4175/portal/store-sales/staging.html`

営業部長: `http://127.0.0.1:4175/portal/store-sales/staging-sales-manager.html`

エリアマネージャー: `http://127.0.0.1:4175/portal/store-sales/staging-area-manager.html`

店長: `http://127.0.0.1:4175/portal/store-sales/staging-store-manager.html`

Local IntegrationのSynthetic Dataであり、実績値・Productionデータではない。

## 確認順

1. Dashboardで全体状況と要対応店舗を確認する。
2. 店舗一覧をfilter・sortし、店舗詳細へ移動する。
3. 一覧へ戻り条件保持を確認する。
4. Role別URLで表示範囲と初期画面を確認する。
5. 390px幅でカード表示、横スクロールなし、詳細4タブを確認する。
6. 評価対象は操作性・見やすさ・業務フロー。数値の妥当性は対象外。
