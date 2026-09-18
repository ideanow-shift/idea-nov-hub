# 01 Existing System Map

調査基準日: 2026-07-28 (JST)  
対象: 本リポジトリと `docs/supabase_audit/01`〜`10`  
判定範囲: 設計・静的調査のみ。DB、RLS、既存コード、本番環境は未変更。

## 読み方と確度

- **確認済み**: 現行コードまたは監査のライブ型・統計に根拠がある。
- **候補**: SQL、review draft、prototypeは存在するが、ライブ適用または本番利用を確認できない。
- **未確認**: 外部GAS、Spreadsheet、POS、デプロイ済みだがローカルにないコード、query logが必要。
- `public` と `core` の同名マスタは統合済みとはみなさない。監査上、実データと静的参照量は `public.*` が大きいが、最終的な正本宣言はADR承認が必要。

## 全体構成

| 層 | 現状 | 新構成での位置 |
| --- | --- | --- |
| NOV HUB | Firebaseログイン、アプリ一覧、権限に応じた導線 | 認証入口・アプリランチャーとして維持 |
| 認証 | Firebase ID tokenまたはHUB sessionをEdgeで検証 | Firebase Authを本人認証、Supabase employee/roleを業務認可に使用 |
| Core DB | `public` と `core` に同名Core Masterが並存 | 正本契約を固定し、4アプリから共通参照 |
| 法人経営管理 | Managementアプリのfinance/dataops、財務テーブル、経費モジュール | 独立Webアプリとして維持・改善 |
| 店舗営業管理 | Managementアプリのstores、management系テーブル、POS静的prototype | 新Webアプリへ段階移行 |
| 求人管理 | Talent dashboard、talent系およびnov_talent系DB | 原則維持・不整合修正 |
| 現職者管理 | HR backoffice静的preview、hr系、assignment/onboarding/procedure候補 | 新Webアプリへ再構築。既存は凍結 |

## 1. 法人経営管理

| 種別 | 現行資産 | 対応・状態 | 根拠 |
| --- | --- | --- | --- |
| 画面 | Management App `finance` タブ | 法人別P/L、B/S、CF、売上、経常利益、利益率、科目分類状態 | `hub-core-continuation-20260718/portal/management-app/app.js:8,61-73,114-128` |
| 画面 | Management App `dataops` タブ | 取込準備・分類状態のread-only表示 | 同 `app.js:61-73,98-103`、`app-v2.js:250` |
| 画面 | ローカル財務preview | 弥生P/L・B/S、法人候補・店舗候補を未保存preview | `management-app/app-v2.js:390-516` |
| 画面 | Expense Hub | 経費申請、月次精算、会計CSV等の別モジュール | `nov_keiri_employee_admin/web/expense-hub/`、監査08 RPC一覧 |
| API | `managementFinanceSummary` | HUB session必須のread-only action | `nov-hub-api/index.ts:379-443,5078-5079` |
| API | `managementDataopsStatus` | 取込実行でなく状態参照 | 同上、`app-v2.js:250` |
| DB | `finance_monthly_corporate_pl`, `finance_monthly_corporate_bs`, `finance_monthly_cash_positions` | 法人月次P/L・B/S・資金位置。各186件推計 | 監査01 |
| DB | `finance_monthly_department_pl`, `finance_monthly_staff_counts` | 部門P/L・人員数 | 監査01、04 |
| DB | `finance_source_documents`, `finance_accounting_monthly_raw`, `finance_account_classification_rules` | 取込原本、raw、分類規則 | 監査01、04 |
| DB | `finance.* expense_*`, monthly reports/close/export | 経費・締め・出力 | 監査01、06、07、08 |
| View | financeの7 Views | 経費集計、月次締め、役員向けレポート、出力履歴 | 監査07 |
| Function | finance RPC群 | 申請、承認、精算、締め、CSV、通知 | 監査06 |
| 権限 | 法人アクセス、役割・scope | Backendで社員状態・権限・scopeを再確認するUI契約 | `management-app/app.js:196-208` |

### 正常に機能していると判断できる範囲

- Managementの3 actionはコード上read-onlyで、HUB sessionから社員を解決してBackendでscopeを判定する。
- 財務月次テーブルには実データ推計があり、Edge Functionから静的参照される。
- Expense Hubにはテーブル、View、RPC、Edge Functionの一連の資産がある。

ただし「本番で正常」は静的解析だけでは確定できない。RLS/GRANTライブカタログ未取得、DB lint error、外部CSV/GAS依存が残るため、現時点の判定は「維持可能な実装骨格とデータが存在する」までとする。

## 2. 店舗営業管理

| 種別 | 現行資産 | 対応・状態 | 根拠 |
| --- | --- | --- | --- |
| 画面 | Management App `stores` タブ | 店舗別データ準備状態、売上データ接続状態 | `management-app/app.js:89-95,132-158` |
| 画面 | POS Phase1 Sales MVP | 店舗別・担当別・メニュー別・支払別分析の静的prototype | `nov_keiri_employee_admin/web/pos-phase1-sales-mvp/README.md` |
| 画面 | POS Phase1 Ops | 会計待機、レジ、予約表、停止線の非DBprototype | `web/pos-phase1-ops-prototype/index.html:20-23`、README |
| API | `managementStoresSummary` | HUB session必須、read-only、assigned scopeは未有効 | `nov-hub-api/index.ts:379-443`、`management-app/app-v2.js:189` |
| DB | `management_checks`, items/results/photos | 環境整備チェック | 監査01、04 |
| DB | `management_performance_snapshots`, initiatives, improvement_actions | 店舗KPIスナップショット、施策、改善 | 監査01、03、04 |
| DB | `store_business_profiles` | 店舗補足情報。店舗基本情報の正本ではない | 監査01、04 |
| DB | shift/attendance群 | 店舗営業が参照するが勤怠・シフト領域の正本 | 監査01、03、04 |
| DB | `public.stores` | 店舗ID・名称・法人所属のCore Master | 監査02 |
| 権限 | all/assigned/own store | UIには3 scope表示があるがEdge候補ではassigned無効 | `management-app/app.js:196`、`nov-hub-api/index.ts:443` |

### 現状の重要な境界

- POS prototypeはSupabase接続、保存、顧客PII、会計確定、Core ID保存を明示的に行わない。
- 現行Management DB設計文書ではmanagement系履歴はSupabase移行済みと記載されるが、監査では静的利用未検出が多い。画面/APIがライブでCRUDしているとは確定できない。
- 店舗売上の本番原本は現リポジトリ内で確定できない。SalonAnswer、CSV、Spreadsheet、外部POSが候補であり、`management_performance_snapshots` は集約スナップショットで原票ではない。

## 3. 求人管理

| 種別 | 現行資産 | 対応・状態 | 根拠 |
| --- | --- | --- | --- |
| 画面 | Talent dashboard | 採用・人材投資集計、面接、内定等の指標 | `portal/talent/index.html:15-19`、`exact1.mjs:6-18` |
| API | `/api/talent/v1/dashboard/summary` | Bearer token前提のdashboard read | `portal/talent/exact1.mjs:71,144-147` |
| View | `talent_dashboard_student_summary` | cohort、見学、面接、内定、入社見込 | 監査07 |
| View | `talent_fair_roi_ranking` | フェア費用、接点、見学、ROI | 監査07 |
| DB | `talent_students` | 候補者。701件推計 | 監査01 |
| DB | fairs/schools/followups/store preferences/tours | フェア、学校、追客、希望店舗、見学履歴 | 監査01、03、04 |
| DB | investment_settings/operation_logs | 採用費用設定、操作ログ | 監査01 |
| DB | onboarding cases/check items | 採用から入社連携のcase | 監査01、04 |
| DB | `nov_talent_applications_v1`, funnel events, profiles | 新しい応募・選考モデル候補だが推計0件・静的利用未検出 | 監査01、09 |
| Function | nov_talent RPC群 | 年度、funnel event、profile、historical import | 監査06。複数lint errorあり |
| Function | `talent_create_onboarding_case` 等 | 入社case作成・変換候補 | 監査06 |
| 権限 | portal app `requiredLevel:4`, tags executive/backoffice | HUB表示制御 | `portal/js/apps.js:22` |

### 採用年度

`nov_talent_fiscal_year_jst_v1` とfunnel eventの `fiscal_year` に採用年度モデル候補がある。28卒等の表示・締め規則は現行UIコードだけでは確定できないため、求人管理オーナーによる年度定義の承認が必要。

## 4. 現職者管理

| 種別 | 現行資産 | 対応・状態 | 根拠 |
| --- | --- | --- | --- |
| 画面 | HR Backoffice dashboard | 概要、日次、書類、入社準備、社員、レビュー、手順、Core待ち、安全確認 | `nov_keiri_employee_admin/web/hr-backoffice-dashboard/index.html:19-27` |
| 実装状態 | dummy data、DB接続前preview | 実社員値・Secret・Storage操作なし | 同 `index.html:33-34`、`main.js:147-155` |
| DB | `public.employees` | スタッフ基本情報Core Master | 監査02 |
| DB | assignment histories/store assignments/roles | 配属・店舗兼務・権限 | 監査01、02、04 |
| DB | `hr.employee_*` | 住所、口座、通勤、契約、家族、履歴、社保、税、書類 | 監査01 |
| DB | onboarding cases/check items | 採用→入社引継ぎ | 監査01、04 |
| DB | workforce procedure cases/steps/audit | 現職者手続の新モデル候補だが推計0件 | 監査01、09 |
| API | hr document signed URL | 書類upload/downloadのEdge/RPC候補 | 監査06、08 |
| 権限 | staff/admin、RLS/GRANT/Storage review待ち | prototypeで明示的に停止 | `hr-backoffice-dashboard/main.js:128-141,172` |

## NOV HUB・認証・ルーティング

| 項目 | 現状 | 影響 |
| --- | --- | --- |
| Firebase Auth | Google popup/redirect、ID tokenを取得 | 4アプリ共通入口として維持 |
| Token検証 | EdgeがIdentity ToolkitでFirebase tokenを検証 | 各新アプリが独自検証を実装せず、共通gateway契約を使う |
| employee解決 | `firebase_uid`、email、`get_nov_hub_bootstrap_by_email` | Core Master二重化で別IDを返すと全認可が分裂 |
| 業務認可 | employee_roles、roles、scope | フロントの表示制御は補助。Backendで必ず再判定 |
| アプリ一覧 | `portal_apps`、不足時fixed/apps.json fallback | 導線切替はDB行とfallbackの両方を点検 |
| handoff | `hub_app_auth_handoffs` とHUB app session | 新旧並行期間の短寿命handoffに使用候補 |
| 監査 | `access_logs` | 新旧アプリIDを区別して利用証跡を取る |

根拠: `portal/js/auth.js:1-57`、`portal/js/api.js:63-149`、`nov-hub-api/index.ts:1626-1647,2008-2145,4799-4841`、`nov-hub-bootstrap-rpc.sql:1-139`。

## 調査上の未確定事項

1. ライブRLS、Policy、GRANT、SECURITY DEFINER、Storage Policyの全件。
2. デプロイ済み `/api/talent/v1/*` のサーバー実体。
3. 既存GAS、Spreadsheet、外部POS/SalonAnswerの実利用と更新責任。
4. `public` と `core` のどちらを正式正本と宣言済みか。
5. management系テーブルの本番CRUDと直近90日のquery log。
6. `nov_talent_*_v1` と旧 `talent_*` のどちらを求人管理の現行正本として運用しているか。

