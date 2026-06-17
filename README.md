# NOV HUB MVP

IDEA NOVグループ向け社内アプリ統合ポータルです。GitHub PagesのフロントエンドからFirebase AuthenticationでGoogleログインし、GAS APIでスタッフマスタ照合、権限別アプリ表示、アクセスログ記録を行います。

## 構成

- `portal`: GitHub Pagesで公開するフロントエンド
- `gas-backend`: Apps Script Web API
- ポータル管理スプレッドシート: `Apps`、`Announcements`、`AccessLog`
- スタッフマスタ: 指定された既存スプレッドシート
- 店舗マスタ: 指定された既存スプレッドシート

## スクリプトプロパティ

Apps Scriptの「プロジェクトの設定」>「スクリプトプロパティ」に以下を設定します。

| キー | 用途 |
| --- | --- |
| `SPREADSHEET_ID` | ポータル管理用スプレッドシートID |
| `FIREBASE_API_KEY` | Firebase Web API Key |
| `STAFF_SPREADSHEET_ID` | スタッフマスタID。未設定時は `1UnBwhX8AjBY_sGXNpiYg--3BB2hgh99eu18oL1uOOts` |
| `STAFF_SHEET_GID` | スタッフマスタのgid。未設定時は `160557983` |
| `STORE_SPREADSHEET_ID` | 店舗マスタID。未設定時は `1Ozyzi3WqYh7HkYYKBObZr8Mvsm941BQh4XL4w_qp-90` |
| `STORE_SHEET_GID` | 店舗マスタのgid。未設定時は `0` |

`STAFF_SHEET_NAME`、`STORE_SHEET_NAME`を設定した場合は、gidよりシート名を優先します。

## スタッフマスタの列

次の列名を認識します。日本語・英語の表記ゆれに対応しています。

- `email` / `メールアドレス` / `Googleアカウント`
- `name` / `氏名` / `スタッフ名`
- `store` / `所属店舗` / `店舗名`
- `storeCode` / `店舗コード`
- `department` / `所属部署` / `部署`
- `position` / `役職`
- `grade` / `等級`
- `roleLevel` / `権限レベル`
- `tags` / `権限タグ`
- `status` / `在籍状況`

`status`が空欄、`active`、`在籍`、`有効`などの場合は利用可として扱います。`inactive`、`退職`、`休職`、`停止`、`無効`などは利用不可です。

## 店舗マスタの列

店舗マスタはスタッフの店舗情報補完に使います。

- `store` / `店舗名`
- `storeCode` / `店舗コード`
- `department` / `部署`
- `status` / `状態`

## ヘルスチェック

GAS WebアプリURLの末尾に `?action=health` を付けると、Firebase APIキー、ポータル管理シート、スタッフマスタ、店舗マスタの接続状態を確認できます。

## 権限判定

- スタッフマスタにログインメールが存在すること
- スタッフの`status`が利用可であること
- アプリの`isActive`が`true`
- スタッフの`roleLevel`がアプリの`requiredLevel`以上
- `allowedTags`指定時はスタッフのタグと一致
- `targetDepartment`、`targetPosition`指定時は一致

## 公開

GitHub Pagesは`.github/workflows/deploy-pages.yml`で`portal`フォルダだけを公開します。
