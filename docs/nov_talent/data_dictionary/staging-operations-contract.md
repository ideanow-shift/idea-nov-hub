# NOV Talent Staging運用契約

## 運用方針

Staging `idea-nov-staging`を、総務人事部が実業務を行う運用検証環境として扱います。Production `idea-nov-core`は別の昇格承認が終わるまで接続・書込み対象にしません。

初回Candidate MigrationのSnapshot、Hash、件数、rollback契約は履歴証拠として保持します。日常運用はSnapshot Importではなく、NOV Talentの認証済みserver-side APIを通じて行います。

## 初回Migrationの履歴Baseline

- 正式Source: 27卒と28卒の承認済みSource 2件
- 27卒: 528 Candidate
- 28卒: 108 Candidate
- 合計: 636 Candidate
- Human Review 6グループ: `different_person / keep_separate`
- 自動集約: 0件
- Quarantine: 0件
- 初回書込みEntity: Candidateのみ

Event / Contact候補1,550件とSelection History候補0件は、初回Candidate Migration範囲外だったことを示す履歴値です。現在の日常入力機能の利用可否を表す値ではありません。

## 現在の日常運用

総務人事部はNOV Talentで次を行います。

- Candidateの登録、編集、状態変更、無効化、検索
- Event / Contactの登録、編集、無効化
- Selection Historyの登録、編集、無効化
- Next Actionの登録、編集、完了、無効化
- Dashboard、Fair、School、監査履歴の確認

ブラウザからDBへ直接書き込みません。すべてNOV HUB Sessionを添えたStaging専用server-side APIを通し、server-side Role判定、RLS、楽観ロック、append-only監査を維持します。

## Source of Truth

| Domain | Current responsibility |
|---|---|
| Candidate | 入社前の学生同一性と現在状態のProjection |
| Event / Contact | 接触、LINE登録、サロン見学の発生事実 |
| Selection History | 応募、面接、内定、内定承諾、辞退、離脱、不採用の発生事実 |
| Next Action | 担当、期限、対応内容、完了状態 |
| Source Fact | 安全なCandidate連結前のImport Evidence。正式KPIへ直接利用しない |
| Fair Attribution | `CONFIRMED ORIGIN`だけが正式なFair起点 |
| Fair Master legacy KPI | `interview_count`、`offer_count`、`hire_count`は正式Sourceとして利用しない |

Fairの下位Funnelは、`CONFIRMED ORIGIN`と正式Selection HistoryからCandidate単位で導出します。未接続・未登録を0へ変換しません。

## Spreadsheet運用

Staging書込み運用開始後、既存Spreadsheetは参照用アーカイブです。

- 新規入力: 停止
- 通常更新: 停止
- NOV Talentとの双方向同期: 実装しない
- NOV TalentからSpreadsheetへのreverse write: 禁止
- rollback確認期間中の原本削除: 禁止

Migrationまたは監査でSpreadsheetを参照する場合もread-onlyとし、日常業務の更新正本へ戻しません。

## 初回ImportとRollbackの履歴契約

- 初回Importはversioned snapshot replacement
- `snapshot_id + artifact_hash`を冪等性キーとする
- retry 0
- 単一接続・単一DB transaction
- 件数またはHash不一致時は全体rollback
- 直前Dataset versionをrollback用に保持

この契約は初回Migration証拠を保護するために残します。日常操作の誤りは物理削除せず、理由付き無効化・訂正とappend-only監査で扱います。

## 禁止境界

- ProductionへのMigration、接続、書込み、自動昇格
- canonical自動昇格、LINE履歴書込み、Employee Core書込み
- Spreadsheetへの書込み・双方向同期
- 弱い照合キーによる自動統合
- Candidate、Fair、履歴の物理削除
- 個人値のGitHub、Markdown、Console、公開artifactへの複製

## 現在地

- Candidate Versioned Dataset: Remote Staging適用済み、ACTIVE 636件
- Staging Runtime: 公開済み
- Workspace Contract: `1.0.0`
- Candidate、Event / Contact、Selection History、Next Action: server-side API運用境界あり
- Spreadsheet: 参照用アーカイブ
- Production: 書込み・昇格未実施

初回MigrationのSource、Snapshot、Hash、実行receiptは再利用や改変をせず履歴証拠として保持します。
