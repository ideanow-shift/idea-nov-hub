# 05 Dependency Risks

## リスク評価

| ID | リスク | 重大度 | 根拠 | 設計上の対策 |
| --- | --- | --- | --- | --- |
| R1 | `public/core` Core MasterのID分裂 | Critical | 同名7組、件数差、複数アプリ参照（監査02/09） | 物理正本ADR、read adapter、一意mapping検証。物理変更は別承認 |
| R2 | RLS/GRANT/SECURITY DEFINER未確認 | Critical | 型APIではライブPolicyを取得不能（監査05） | 実装前GateでライブcatalogをSELECT-only取得しアクセス行列と照合 |
| R3 | service_role Edgeがscopeを誤実装 | Critical | Edgeがservice_roleでREST参照、アプリ側scopeに依存 | employee/role/scopeをBackendで強制し、negative testを必須化 |
| R4 | Firebase UID/email解決のなりすまし・誤紐付け | Critical | UID/email/bootstrapの複数解決経路 | UID一意性、link監査、email fallback制限、退職者拒否 |
| R5 | 法人経営の売上が店舗営業データに依存 | High | Management financeにsalesTotal、店舗候補P/L、store分類 | 店舗確定snapshot契約とreconciliationを先に作る |
| R6 | 店舗売上原票が不明 | Critical | POS prototypeは非DB、外部CSV/SalonAnswer依存 | 原本owner、粒度、締め、訂正、返品、税、支払を人間承認 |
| R7 | 同一Management Appからstoresを切るとtab/API導線が壊れる | High | finance/stores/dataopsが同一stateとEdge action | route別切替、contract test、dataops責任分割 |
| R8 | 求人の旧talentとnov_talentが重複 | High | `talent_students`701件、nov_talentは0件中心 | 正本選定、mapping、dual-write禁止 |
| R9 | 採用→入社で候補者とemployeeが二重化 | Critical | onboarding tablesとCore employee作成経路が並存 | case-based conversion、idempotency、一つのemployee_idを返す |
| R10 | 現在所属で過去実績を再計算 | High | employees.store_idとassignment historyが併存 | effective date付き履歴でas-of join |
| R11 | HR PII過剰公開 | Critical | 住所、口座、家族、税、保険、書類、Storage | 非public schema/限定RPC/列最小化/signed URL/監査 |
| R12 | Functionとschemaのdrift | High | notification metadata、曖昧列、temp table lint error（監査06） | 各実装前に別の修正申請。エラーRPCを新アプリから呼ばない |
| R13 | 静的未使用を未使用確定と誤認 | High | 96テーブル、外部GAS/BI未検出（監査09） | 90日query log、owner確認、復旧演習まで削除禁止 |
| R14 | HUBのDBアプリ一覧とfallbackの不一致 | Medium | portal_appsとapps.json/fixedApps | release manifest、app_id重複検査、同時切替 |
| R15 | 新旧並行で二重書き込み | Critical | 同じCore DBを複数UIが更新可能 | single writer、旧UI read-only、write feature flag |
| R16 | 集計値の定義差 | High | 財務P/L、店舗snapshot、POS prototypeに売上/利益 | KPI dictionary、timezone、税込税抜、取消、締めversion |

## 法人経営が店舗営業データを利用する箇所

1. 現行Management finance summaryの売上合計。
2. ローカルP/L previewの店舗候補売上・経常損益。
3. `finance_account_classification_rules.store_id`による店舗分類。
4. `management_performance_snapshots`の店舗KPIを使う経営比較候補。
5. 店舗別経費View `finance.expense_by_store_month`。
6. 月次人員数・店舗別生産性計算のCore employee/store依存。

店舗営業を切り離しても法人P/L/B/S/CF自体は保持できる。ただし店舗別売上、店舗利益、予実、生産性、改善施策へのdrill-downは、共有snapshot契約なしでは欠落または数値差になる。

## 求人管理とスタッフマスタ

- 現行talent系はCore stores/corporations/employeesへのFKを持つ。
- fair ownerや操作actorは既存employeeを参照する。
- 候補者はemployeeではない。内定時点で先行employeeを直接作ると退職者・辞退者・再応募の重複を生む。
- onboarding caseの承認完了時だけCore管理APIへ変換要求し、`candidate/application/onboarding_case/employee_id`の対応を監査できる必要がある。

## 現職者管理とスタッフマスタの重複

`public.employees`には在籍状態、雇用形態、入退社日、現在所属がある一方、assignment/history/contractsにも同じ概念がある。次の区別を固定する。

- Core employee: 全アプリが使う承認済み現在値。
- 現職者履歴: effective_from/toを持つ事実履歴。
- HR private: 住所、口座、家族、税、保険、文書。
- View: 履歴から現在値または指定日時点を読み出す互換層。

## 切り離しで壊れる可能性がある機能

| 切り離し | 破損候補 |
| --- | --- |
| Management storesタブ | tab hash、共通loading state、3つのEdge action、dataops表示、HUB app card |
| 店舗KPI | 法人finance summaryのsalesTotal、店舗P/L preview、経費店舗集計 |
| Talent | HUBのhuman-capital-investmentカード、token handoff、dashboard API |
| HR Legacy | 求人onboardingの行先、master-adminの社員更新、書類signed URL |
| Core Master参照先変更 | HUB login、Expense、Attendance、Shift、通知、IDEA LINK、Decision |

## 認証・権限の実装前Gate

1. Firebase token検証方式、issuer/audience/expiryを確認。
2. UID→employeeが0件/1件/複数件の場合の挙動をtest。
3. inactive/retired/leaveのアクセス規則を承認。
4. role keyとscope type/idの全組合せをアプリ別に定義。
5. anonymous/authenticated/service_roleのtable/RPC/Storage権限をライブ取得。
6. SECURITY DEFINERの`search_path`、actor引数偽装、所有者を確認。
7. CORSを許可originの完全一致にする。
8. signed handoffのTTL、audience、nonce、再利用防止を確認。

## 数値不整合の検証

新旧並行時は、店舗×営業日/月×指標について以下を比較する。

- 件数、総売上、純売上、税、値引、取消、返品、現金/キャッシュレス。
- 技術/店販、担当者、メニュー、法人、FC/直営の分類。
- P/L売上との調整差額と理由コード。
- source file digest、取込batch、締めversion、再計算時刻。

許容差は「原則0円」。丸めや会計調整がある指標だけ、経理承認した差額規則を使う。

