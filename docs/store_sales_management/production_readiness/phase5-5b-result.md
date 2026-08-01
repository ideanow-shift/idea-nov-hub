# Phase 5-5B Store Sales Staging Foundation 実装結果

## 結論

Phase 5-5B の Staging Foundation を、Production と分離した Synthetic Data 専用候補として実装した。実 Supabase project の作成、migration 適用、deploy、本番接続、本番データ投入、実 secret 登録は行っていない。

## ブランチ

- Base: `chore/store-sales-production-readiness`
- Head: `feat/store-sales-staging-foundation`
- Base commit: `886513be52f530fbcaee14fce9a51046ca9fa416`

## 実装範囲

- `staging` 専用 Runtime config と、Production URL・fixture・環境不一致を拒否する境界
- canonical session candidate を利用する短命なメモリ内 Synthetic session
- 7 actor role、Direct / FC、休止 / 閉店、4店舗状態、5データ状態を含む20店舗の Synthetic fixture
- read-only Projection API skeleton、contract version、request ID、no-store、health
- server-side role / scope enforcement と employee default deny
- token・個人情報を記録しない構造化 audit candidate
- review-only RLS SQL、CI quality gate、manual dry-run deploy candidate
- UAT、性能、rollback、security、session、data、deploy 文書
- Staging 専用の起動スクリプトと8画面の固定スクリーンショット

Runtime State registry、Feature Flag registry、Accounting Core、Accounting KPI Engine、Store Sales Projection の業務ロジックは変更していない。

## テスト結果

- Phase 5-5B Staging: 66 / 66 PASS
  - contract / E2E: 33
  - environment isolation: 11
  - security negative: 17
  - performance candidate: 5
- Store Sales既存回帰: 84 / 84 PASS
- Store Sales Projection: 4 / 4 PASS
- Accounting Core: 28 / 28 PASS
- Accounting KPI Engine: 33 / 33 PASS
- NOV NAVI boundary: 1 / 1 PASS
- Deno type check: PASS
- `git diff --check`: PASS

合計: 216 / 216 PASS。

性能値は Synthetic local candidate の参考値であり、Production SLO の承認値ではない。

## スクリーンショット

- `staging-dashboard-desktop.png`: 1440 × 1000
- `staging-store-detail-desktop.png`: 1440 × 1000
- `staging-store-manager-mobile.png`: 390 × 844
- `staging-fc-owner-mobile.png`: 390 × 844
- `staging-employee-forbidden-mobile.png`: 390 × 844
- `staging-timeout-mobile.png`: 390 × 844
- `staging-maintenance-mobile.png`: 390 × 844
- `staging-validation-error-mobile.png`: 390 × 844

保存先: `docs/store_sales_management/production_readiness/screenshots/`

## ローカル確認方法

Windowsではリポジトリ直下の `start-staging.bat` をダブルクリックする。ブラウザーで次を開く。

`http://127.0.0.1:4175/portal/store-sales/staging.html`

この起動方法は localhost、Synthetic Data、Production blocked 固定である。

## 未実施・承認待ち

- 実 Staging Supabase project の作成
- migration apply
- Edge Function / Hosting deploy
- secret 登録
- Production data または匿名化実データの投入
- 本番接続
- Production SLO 承認

これらは別途明示承認が必要であり、本フェーズでは実施していない。
