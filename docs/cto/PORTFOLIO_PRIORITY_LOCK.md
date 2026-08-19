# CTO Portfolio Execution Order Lock

LOCK_ID: CTO-PORTFOLIO-EXECUTION-ORDER-2026-08-18-V2

STATUS: ACTIVE

OWNER: IDEA NOVグループ代表取締役社長

CURRENT_PHASE: PHASE_2_DBF_MANAGEMENT_UI_COMPLETION

GitHub上のこの文書をPortfolio実行順序の唯一の正本とする。Supabase設定またはチャットのメモを正本にしてはならない。

## 固定実行順序

1. `PHASE_1_DBF_BACKEND_COMPLETION` — DBF完成 — COMPLETE
2. `PHASE_2_DBF_MANAGEMENT_UI_COMPLETION` — DBF管理UI完成 — CURRENT
3. `PHASE_3_STORE_OPERATIONS_MANAGEMENT_V1` — Store Operations Management V1（店舗営業管理の構築・実働）
4. `PHASE_4_CORPORATE_MANAGEMENT` — Corporate Management（法人経営管理の構築・実働）

この順序は固定である。AI、CTO、CODEX、開発担当者は、技術判断だけを理由に順序を変更してはならない。

次工程へ移れるのは、次のすべてを満たした場合だけである。

1. 現在工程のExit Criteriaを満たした。
2. Ownerが次工程への移行を明示承認した。
3. GitHubのPriority Lockを更新する `[OWNER PHASE TRANSITION]` PRがMergeされた。

## Phase 1: DBF Backend Completion

PHASE_ID: PHASE_1_DBF_BACKEND_COMPLETION

PHASE_STATUS: COMPLETE

本PhaseのDBF Backend／Control Planeは完了している。

### Phase 1 Completion Record

- Transition approved by Owner on 2026-08-19.
- Final main HEAD: `d48f863f2bcaef87f2e1145b775bad329ae90a3b`.
- Staging Backend Smoke: PASS.
- Store Monthly authenticated smoke: PASS.
- Corporate Accounting authenticated smoke: PASS.
- Business Data Write: 0.
- Production Change: 0.
- Phase 1 Blocking: 0.

### Phase 1に含むもの

- DBF Import Runtime
- Canonical Fact Foundation
- 法人P/L・B/S Backend Contract
- 店舗月次営業実績Backend Contract
- Account Mapping Review Backend
- Row Semantics Backend
- Approval Contract
- Promotion Contract
- Scoped Promotion
- RLS
- FORCE RLS
- RPC権限
- Audit
- Idempotency
- Migration
- Edge Function
- BFF Contract
- Consumer Read Projection／API Contract
- PostgreSQL 17 CI
- Staging Backend Smoke

PR #154／法人会計PromotionはPhase 1の内部工程である。

DBF Account Review BackendはPhase 1の内部工程である。

### Phase 1 Exit Criteria

- 法人会計ActualのBackend Contractが完成。
- 店舗月次営業実績のBackend Contractが完成。
- Import／Validation／Mapping／Review／Approval／PromotionのBackend Contractが完成。
- Canonical Factの保存先が完成。
- 法人経営管理向けRead Projectionが完成。
- 店舗営業管理向けRead Projectionが完成。
- RLS／FORCE RLS／service-role境界が完成。
- Audit／Idempotency／Atomic transactionが完成。
- 対象MigrationがStagingへ適用済み。
- 対象Edge／APIがStagingへDeploy済み。
- PostgreSQL 17 CIがPASS。
- Staging Backend SmokeがPASS。
- BrowserからDBへ直接アクセスしない。
- Production writeが0。
- 次のDBF管理UIを構築できるBackend状態。

### Phase 1完成に含めないもの

- DBF管理UIの完成
- Store Operations UI
- Corporate Management UI
- POSリアルタイム連携
- 日別データ
- 顧客単位データ
- 個人別分析
- 全年度の一括移行
- 全Fact種別への対応
- AI分析
- 完全自動化
- 将来想定機能
- Production本番切替

完成条件を将来機能で拡張してはならない。

## Phase 2: DBF Management UI Completion

PHASE_ID: PHASE_2_DBF_MANAGEMENT_UI_COMPLETION

PHASE_STATUS: CURRENT

目的は、本部担当者がSQL、CODEX、Supabase Dashboardの直接操作なしでDBFを月次運用できるようにすることである。

### Phase 2に含むもの

- ファイル取込UI
- 取込履歴
- Preview
- Validation結果
- Mapping確認
- Account Review
- Row Semantics設定
- Safe Error
- Retry
- Approval UI
- Promotion Preflight
- Promotion UI
- Promotion結果確認
- Hosted UI
- Accessibility
- Responsive UI
- NOV HUBからの起動

`fix/dbf-account-review-ui-safe-states` の成果はPhase 2へ分類する。削除してはならない。Phase 1完成までは追加開発、Merge、Deployを進めず、Phase 2開始時に最新mainへ統合して再開する。

### DBF Single Ingestion Governance

- 経営データのWrite入口はDBFのみとする。
- ConsumerはDBF Canonical FactをRead-onlyで利用する。
- Consumerに独自CSV/POS取込や同一Factの複製保存を原則として追加しない。
- Phase 2の単一取込入口はP/L、B/S、予算、店舗月次実績の既存Backend Contractのみを扱う。
- Cash FlowとPOS顧客明細の保持は本Phaseの対象外とし、別途のContractとプライバシーReviewなしに実装しない。
- このGovernanceはPortfolio Lockの実行順序やPhaseを変更しない。

### Phase 2 Exit Criteria

- 本部担当者が画面だけで取込からPromotionまで実行できる。
- Owner Reviewを画面で実行できる。
- Approval／Promotionを画面で安全に実行できる。
- DeveloperによるSQL操作が不要。
- Hosted Smoke PASS。
- Owner UAT PASS。
- 2026-06法人会計Pilotを画面経由で処理できる。
- 店舗月次データPilotを画面経由で処理できる。
- Canonical Factをread-backできる。

## Phase 3: Store Operations Management V1

PHASE_ID: PHASE_3_STORE_OPERATIONS_MANAGEMENT_V1

目的は、店舗営業管理を実データで構築し、月次会議・店舗訪問判断で実働させることである。

### Phase 3 Exit Criteria

- 正式20店舗。
- 直営13／FC7。
- 実月次データ。
- Executive Summary。
- 優先アクション最大3件。
- 店舗ポートフォリオ。
- 店舗一覧。
- 店舗詳細。
- 予算比。
- 前年同月比。
- 年間累計。
- 月別推移。
- 売上。
- 客数。
- 単価。
- リピート率。
- 生産性。
- 店販購買率。
- 利益または利益状態。
- NOV HUBから起動。
- Hosted Smoke PASS。
- Owner／営業部UAT PASS。
- 実際の月次会議で利用開始。

Phase 3へ入った後は、店舗営業管理が実働するまでPhase 4へ移ってはならない。

## Phase 4: Corporate Management

PHASE_ID: PHASE_4_CORPORATE_MANAGEMENT

既存Portfolioの正式名称は「法人経営管理」である。目的は、法人P/L、B/S、収益性、安全性、キャッシュ、予算、前年比、月次推移を経営者が確認できるようにすることである。

### Phase 4 Exit Criteria

- 法人P/L。
- 法人B/S。
- 収益性。
- 安全性。
- キャッシュ。
- 予算比較。
- 前年比較。
- 月次推移。
- 6法人比較。
- 経営者向けDashboard。
- NOV HUBから起動。
- Hosted Smoke PASS。
- Owner UAT PASS。
- 月次経営判断で実働開始。

## 自動的な優先順位変更の禁止

以下を禁止する。

- AI判断による工程変更。
- CTO判断による工程変更。
- CODEX判断による工程変更。
- 新しい技術課題を理由に別Phaseへ移ること。
- 過去のCTO引継ぎを理由に順番を戻すこと。
- 「こちらを先にした方がよい」という提案だけで順番を変えること。
- 現在Phase以外のアプリへ作業を拡張すること。
- 将来機能を現在Phaseの完成条件へ追加すること。
- 完璧な基盤完成を理由にExit Criteriaを増やすこと。

Owner以外はPhaseまたはPortfolio Priorityを変更できない。

新しい問題は、現在Phaseの完成を本当に妨げる `A. CURRENT_PHASE_BLOCKER` または現在Phaseを止めず後で対応できる `B. BACKLOG` に分類する。別Phaseへ勝手に切り替えてはならない。

## 現在Phaseを停止できる条件

現在Phaseを停止できるのは次の場合だけである。

- データ破壊の可能性
- 権限漏洩
- 二重計上
- 誤ったCanonical Fact生成
- Partial Commit
- Actor spoof
- Company scope spoof
- Productionへの誤接続
- 現在Phaseそのものが実行不能

次は停止理由にしてはならない。

- UIの細かな改善
- 将来機能
- 完全自動化
- POS連携
- 全年度対応
- AI分析
- 別アプリの改善
- さらに厳密にできるという理由だけの監査
- 解決済み問題の再調査

## 変更条件

Phase移行は、現在PhaseのExit Criteria達成、Ownerの明示承認、および `[OWNER PHASE TRANSITION]` PRのMergeが揃った場合だけ有効になる。固定順序またはPortfolio Priorityの変更は、Ownerの明示指示と `[OWNER PRIORITY CHANGE]` PRのMergeが揃った場合だけ有効になる。
