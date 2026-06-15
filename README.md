# NOV HUB MVP

IDEA NOVグループ向け社内アプリ統合ポータルのMVPです。スマートフォン優先のカードUI、社員マスタ照合、権限別表示、アクセスログ記録を含みます。

## すぐに確認する

```powershell
cd portal
python -m http.server 8080
```

`http://localhost:8080` を開きます。初期状態は `demo` モードのため、Firebase設定なしで権限1・3・5・停止ユーザーの表示差を確認できます。

## 本番接続

1. Firebase AuthenticationでGoogleプロバイダを有効化します。
2. 承認済みドメインへGitHub PagesまたはFirebase Hostingのドメインを追加します。
3. マスタ用Googleスプレッドシートを作成します。
4. Apps Scriptプロジェクトへ `gas-backend` のファイルを追加します。
5. スクリプトプロパティへ `SPREADSHEET_ID` と `FIREBASE_API_KEY` を設定します。
6. `setupMasterSheets()` を一度実行し、サンプル行を実データへ置換します。
7. ウェブアプリとして「実行するユーザー: 自分」「アクセスできるユーザー: 全員」でデプロイします。API自身がFirebase IDトークンと社員マスタを検証します。
8. `portal/js/firebase-config.js` にFirebase設定とGAS URLを記入し、`authMode` を `"firebase"` へ変更します。
9. `portal` をGitHub PagesまたはFirebase Hostingへ公開します。

GitHubへ `main` ブランチとしてpushし、リポジトリの Settings > Pages > Source を
`GitHub Actions` にすると、同梱のワークフローが `portal` を公開します。

## 権限判定

- 社員の `status` が `active`
- アプリの `isActive` が `true`
- 社員の `roleLevel` が `requiredLevel` 以上
- `allowedTags` 指定時は社員タグと1つ以上一致
- `targetDepartment` 指定時は所属部署が一致
- `targetPosition` 指定時は役職が一致

区切り文字はカンマ、読点、改行に対応しています。

## セキュリティ

- 社員マスタと権限外アプリURLはブラウザへ全件配布しません。
- `openApp` ログ記録時にもGAS側で権限を再確認します。
- 各遷移先アプリ側にも認証・社員照合・URL直打ち対策が必要です。
- スプレッドシート共有は管理者だけに限定してください。
- 本番URLへ置換するまでサンプルの `https://example.com/` は使用しないでください。
