# NOV Talent Staging Write Operations

## 運用境界

- 対象は `idea-nov-staging` の Candidate のみです。
- ブラウザはHUB Sessionを添えてStaging専用のserver-side APIを呼びます。DBへの直接書込みは行いません。
- `idea-nov-core`、Spreadsheet、Event / Contact、Selection History、NOV People、Employee Core、LINE履歴へは書き込みません。
- 新規登録・編集・状態変更・無効化は、更新理由と更新者をappend-only監査ログへ記録します。
- 物理削除、自動統合、自動削除は行いません。

## 総務人事部の初期操作

1. NOV HUBへ通常どおりログインします。
2. 「求人管理」を開きます。
3. 新規登録は「候補者を追加」、既存情報は候補者を選択して「編集」を押します。
4. 入力内容と更新理由を確認し、「確認して保存」を押します。
5. 重複候補の警告が出た場合は、候補者を自動統合せず、内容を確認して保存継続または中止を選びます。
6. 「変更履歴」で登録・編集・状態変更・無効化の履歴を確認します。

## Spreadsheet運用

Staging書込み運用開始後、既存Spreadsheetは参照用アーカイブとします。新規入力・通常更新・双方向同期は行いません。Migration rollback確認期間中は削除しません。

## Rollback

1. Pagesを直前の公開artifactへ戻し、`writeEnabled` が有効な画面を停止します。
2. Staging APIを直前のread-only版へ戻すか、write routeを停止します。
3. Candidate Datasetは既存ACTIVE 636件を維持します。書込み操作で作成したテスト候補は物理削除せず無効化状態を維持します。
4. 件数、監査ログ、RLS、Production書込み0件を再確認します。

Schemaや監査ログの物理削除をrollback手段にしません。問題時は書込み入口を停止し、append-only証跡を保持します。
