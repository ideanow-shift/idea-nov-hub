# NOV Talent v1.0 Operational Completion readiness

## 判定

`ADJUST / OPERATIONAL COMPLETION PENDING`。

Workspace Contract、Staging Runtime、Candidate・Fair管理の基盤は利用可能です。一方、v1.0の完成条件は技術的な公開完了ではなく、総務人事部が5営業日連続でSpreadsheetへ戻らず、NOV Talentだけで今日の対象者と行動を判断・記録できることです。この運用Gateはまだ完了していません。

## 現在の運用Baseline

- Environment: `idea-nov-staging`
- Public Runtime: Staging Runtime
- Workspace Contract: `1.0.0`
- Candidate: 有効636件（27卒528件、28卒108件）
- Fair: 総数82件（有効46件、無効36件）
- Selection History: 0件
- Fair Attribution: 0件
- Production Project `idea-nov-core`: 本運用の書込み対象外

Candidate、Event / Contact、Selection History、Next Actionの日常入力はNOV Talentの認証済みserver-side APIを通して行います。既存Spreadsheetは参照用アーカイブであり、新規入力、通常更新、NOV Talentとの双方向同期は行いません。

## Source of Truth

| Domain | 正式責務 |
|---|---|
| Candidate | 入社前の学生同一性と現在状態のProjection。履歴Factの正本ではない |
| Event / Contact | 接触、LINE登録、サロン見学の発生事実 |
| Selection History | 応募、面接、内定、内定承諾、辞退、離脱、不採用の発生事実 |
| Next Action | 担当、期限、対応内容、完了状態を持つ日常業務Queue |
| Source Fact | 安全なCandidate連結が完了するまで未連結のImport Evidence。正式KPIへ直接加算しない |
| Fair Attribution | `CONFIRMED ORIGIN`だけが正式なFair起点 |
| Fair Master legacy KPI | `interview_count`、`offer_count`、`hire_count`は正式Sourceとして利用しない |

Fairの面接・内定等の下位Funnelは、将来 `CONFIRMED ORIGIN` と正式Selection HistoryをCandidate単位で結合して導出します。未接続中は0へ変換せず、「集計準備中」またはCoverageを表示します。

## Outcome 0

v1.0 Completionの最初のGateは [Outcome 0 — Accuracy & Contract Alignment](./outcome-0-accuracy-contract.md) です。目的は新機能追加ではなく、誤った判断材料を0にすることです。

Workspace Contract `1.0.0`のResponse shapeは変更しません。既存fieldの参照、日付正規化、正式Sourceの選択、NULLと0の区別を修正対象とします。

## Operational Completion Gate

- 認証・権限・監査が正常
- Candidate、Event / Contact、Selection History、Next Actionの新規業務入力がNOV Talentだけで完了
- Dashboard、Fair、Schoolが正式FactとCoverageを区別
- Spreadsheetへの業務入力0
- 5営業日連続で今日の対象者と行動をNOV Talentから判断
- Production書込み0

## Historical context

この文書の旧版に記録されたPR #15 / #16、Mock Runtime、未deployの状態は、2026-08-01時点のRelease準備証拠です。現在状態ではありません。監査履歴はGit historyに保持し、旧PRのCommitや試験結果を現在のRelease Gateへ流用しません。
