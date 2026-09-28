# 09 Implementation Roadmap

## 推奨順序

結論は、**共通P0を先に行った後、店舗営業管理MVPを現職者管理MVPより先に立ち上げる**。理由は、店舗営業の切り離しが明示された事業方針であり、法人経営の売上・店舗P/L依存を早期に安定させられるためである。

ただし現職者の認証/PIIリスクは待てない。店舗営業実装と並行して、現職者は「実装」ではなくP0のdata/privacy/onboarding contract確定まで進める。

## Stage 0: 人間の決定（実装前）

| 決定 | Owner | 完了条件 |
| --- | --- | --- |
| Core Master物理正本 | Core DB owner/CTO | public/core ADR |
| 店舗売上原本 | 営業・経理 | source、粒度、締め、訂正規則 |
| 求人正本 | 採用責任者 | talent vs nov_talentの決定 |
| 採用→入社移管点 | 採用・人事 | onboarding状態遷移 |
| role/scope行列 | 各業務owner/セキュリティ | app/action/data scope表 |
| KPI辞書 | 営業・経理 | 数式、税、丸め、営業日 |
| HR PII分類 | 人事/法務/セキュリティ | field別権限・保存期間 |

## Stage 1: P0 Foundation Audit

実装変更の前に別のSELECT-onlyタスクで実施する。

1. ライブRLS/Policy/GRANT/SECURITY DEFINER/Storage Policy取得。
2. Firebase UID/email/employee mappingの重複・欠損調査。
3. public/core mappingとconsumer別参照先の確定。
4. Edge/GAS/BI/query logの90日利用棚卸し開始。
5. DB lint error対象RPCの利用有無確認。

成果: ADR、access matrix、Core read contract、blocked function list。

## Stage 2: 共通アプリ基盤

1. Firebase token/handoffの共通contract。
2. employee/role/scope server-side resolver。
3. Core Master read adapter。
4. app_id/audience/origin/audit contract。
5. authorization negative test harness。

この段階でもCore DB schemaを変更しない構成から始める。

## Stage 3: 店舗営業管理 MVP

優先順:

1. 売上source inventoryとsample fixture。
2. KPI dictionaryとreconciliation仕様。
3. Core read-only store/employee adapter。
4. import dry-runとmapping UI。
5. 店舗dashboard・全店比較。
6. 日次/月次締めと確定snapshot。
7. management check/initiative/improvementの移行。
8. 法人経営read contract。
9. pilot店舗でparallel test。

事業価値: 店舗判断の独立、法人経営への安定した売上供給、旧Management storesの切離し。

## Stage 4: 法人経営管理の境界整理

1. Management `finance`を維持。
2. stores tabへの依存を新snapshot adapterへ置換。
3. dataopsを財務取込と店舗売上取込に分割。
4. P/L・B/S・CF・経費のsource/締め/確定値を明文化。
5. Expense RPC v1/v2とlint/driftを別修正タスクで整理。

Stage 3と4は同じリリース列車で検証するが、アプリは独立デプロイ可能にする。

## Stage 5: 求人管理の安定化

1. `talent_students`と`nov_talent_*`の正本決定。
2. dashboard API実体と認可確認。
3. 28卒等のcohort/年度規則。
4. fair ROI、見学、面接、内定、follow-upのacceptance test。
5. onboarding caseを唯一のconversion入口にする。
6. lint errorのあるnov_talent RPCは修正承認まで利用しない。

求人管理を維持しつつ、現職者構築の入口を安定させる。

## Stage 6: 現職者管理 MVP

1. HR data dictionaryとPII分類。
2. onboarding受入とidempotent employee link。
3. 配属/兼務/在籍のas-of履歴。
4. 契約・住所・通勤・口座。
5. 文書signed URLとaccess audit。
6. 入社/異動/休職/復職/退職case。
7. Core変更申請。
8. 勤怠/評価/教育summary link。
9. HR Legacyをread-only凍結しpilot。

## Stage 7: Legacy停止・廃止レビュー

1. HUB導線切替。
2. 旧writer停止。
3. rollback window。
4. 90日利用証跡レビュー。
5. 廃止候補リストの人間承認。

物理削除、migration、RLS変更はこのroadmapの各実装タスクで個別承認し、本設計から自動承認しない。

## 優先度と依存関係

| 優先 | Work | Blocker |
| --- | --- | --- |
| P0 | Core正本ADR | なし |
| P0 | Auth/RLS/GRANTライブ確認 | なし |
| P0 | HR PII/onboarding契約 | Core正本 |
| P1 | 店舗売上source/KPI契約 | 営業・経理承認 |
| P1 | 店舗営業MVP | 共通基盤、source契約 |
| P1 | 法人経営snapshot連携 | 店舗MVP確定snapshot |
| P1 | 求人正本・onboarding安定化 | 採用owner承認 |
| P2 | 現職者MVP | onboarding、PII、共通基盤 |
| P2 | Legacy停止 | 新旧parallel test |
| P3 | 廃止 | 90日証跡と復旧test |

## 次に立ち上げるCodexタスク

次タスクは実装ではなく、次のread-only設計Gateを推奨する。

**「IDEA NOV OS Core Master物理正本・認証認可境界確定タスク」**

範囲:

- ライブRLS/Policy/GRANT/SECURITY DEFINER/Storage PolicyのSELECT-only取得。
- `public/core`同名マスタのID対応、参照consumer、UID/email重複のread-only検証。
- 4アプリのrole/scope/action matrix。
- Core read adapter I/O contractとADR草案。
- DB変更、migration、データ更新、push、deployは禁止。

このGateが通った後の最初の実装タスクは、**「店舗営業管理MVP Phase 0: source adapter・KPI contract・read-only Core adapter」**とする。

