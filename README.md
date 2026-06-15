# NOV HUB MVP

IDEA NOVグループ向け社内アプリ統合ポータルです。

## 構成

- `portal`: GitHub Pagesで公開するフロントエンド
- `gas-backend`: 社員・アプリマスタ照合とアクセスログ用GAS
- `.github/workflows/deploy-pages.yml`: `portal`のみを公開するGitHub Actions

## 本番構成

```text
GitHub Pages
  -> Firebase Authentication（Googleログイン）
  -> Apps Script Web API
  -> Googleスプレッドシート
```

## GAS設定

Apps Scriptのスクリプトプロパティに以下を設定します。

| キー | 内容 |
| --- | --- |
| `SPREADSHEET_ID` | マスタ用スプレッドシートID |
| `FIREBASE_API_KEY` | Firebase Web API Key |

`setupMasterSheets()`を一度だけ実行すると、以下のシートが作成されます。

- `Employees`
- `Apps`
- `Announcements`
- `AccessLog`

実データ登録後は`setupMasterSheets()`を再実行しないでください。

## GitHub Pages

GitHubリポジトリの Settings > Pages > Source を`GitHub Actions`に設定します。
`main`へのpushで`portal`フォルダだけが公開されます。

## セキュリティ

- 社員マスタに存在し、`status`が`active`のユーザーだけ利用できます。
- アプリは権限レベル、タグ、部署、役職で絞り込みます。
- ポータルでの非表示だけでは遷移先アプリを保護できません。
- 各GAS・Firebaseアプリ側にも認証と権限確認を実装してください。
