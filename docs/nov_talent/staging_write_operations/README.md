# NOV Talent Staging Write Operations

## 運用境界

- 対象は `idea-nov-staging` のCandidate、Event / Contact、Selection History、Next Actionです。
- ブラウザはNOV HUB Sessionを添えてStaging専用server-side APIを呼びます。DBへ直接書き込みません。
- `idea-nov-core`、Spreadsheet、NOV People、Employee Core、LINE履歴へ書き込みません。
- 登録、編集、状態変更、完了、無効化は、更新理由と更新者をappend-only監査ログへ記録します。
- 物理削除、自動統合、自動削除は行いません。

## 正式責務

| Domain | Responsibility |
|---|---|
| Candidate | 入社前の学生同一性、プロフィール、現在状態のProjection |
| Event / Contact | 接触、LINE登録、サロン見学の発生事実 |
| Selection History | 応募、面接、内定、内定承諾、辞退、離脱、不採用の発生事実 |
| Next Action | 担当者が次に行う内容、期限、完了状態 |
| Source Fact | 未連結のImport Evidence。Candidateへ安全に連結されるまで正式集計に使わない |

Candidateの現在状態だけから過去のEventやSelectionを推測しません。Source Fact、current status、Selection Historyを加算、最大値比較、truthy fallbackで混在させません。

Fair Masterのlegacy `interview_count`、`offer_count`、`hire_count`は正式Sourceではありません。Fairの面接・内定等は、将来 `CONFIRMED ORIGIN` と正式Selection HistoryからCandidate単位で導出します。

## 総務人事部の初期操作

1. NOV HUBへ通常どおりログインします。
2. 「求人管理」を開きます。
3. 新規学生は「学生を追加」、既存情報は学生詳細の「編集」を使用します。
4. 学生詳細から接触履歴、選考履歴、次回対応を登録・更新します。
5. 入力内容と更新理由を確認して保存します。
6. 重複警告が出た場合も自動統合せず、内容を確認して保存継続または中止を選びます。
7. 監査履歴で登録、編集、状態変更、完了、無効化の履歴を確認します。

## Spreadsheet運用

Staging書込み運用開始後、既存Spreadsheetは参照用アーカイブです。新規入力、通常更新、双方向同期は行いません。Migration rollback確認期間中は削除しません。

## Workspace Contract

初期表示はWorkspace Contract `1.0.0`を唯一のレスポンス正本とします。本運用境界の文書整合ではWorkspace response shape、Validator、Versionを変更しません。

## Rollback

1. Pagesを直前の公開artifactへ戻し、問題のある操作入口を停止します。
2. Staging APIの該当write routeを停止または直前の正常版へ戻します。
3. 業務行を物理削除せず、理由付き訂正または無効化とappend-only証跡を保持します。
4. Candidate 636件、Fair件数、監査ログ、RLS、Production書込み0件を再確認します。

Schemaや監査ログの物理削除をrollback手段にしません。
