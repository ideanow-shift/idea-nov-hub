# NOV HUB スマホホーム画面追加ガイド

## 正しいURL

スマホのホーム画面に追加するURLは以下です。

```text
https://ideanow-shift.github.io/idea-nov-hub/
```

## 保存してはいけないURL

以下のURLはホーム画面に保存しないでください。

- `https://ideanow-shift.github.io/idea-nov-hub/master-admin/`
- `https://ideanow-shift.github.io/idea-nov-hub/idea-link/`
- `?hub_context=...` が付いたURL
- `https://ideanow-shift.github.io/idea-nov-expense-hub/`
- 開発用の `localhost` URL

`hub_context` はアプリ間連携用の一時情報です。ホーム画面へ保存するURLには含めません。

## iPhone / iPad

1. Safariで `https://ideanow-shift.github.io/idea-nov-hub/` を開く
2. 共有ボタンを押す
3. 「ホーム画面に追加」を押す
4. 表示名が `IDEANOV` になっていることを確認する
5. 追加する

## Android

1. Chromeで `https://ideanow-shift.github.io/idea-nov-hub/` を開く
2. 右上メニューを押す
3. 「ホーム画面に追加」または「アプリをインストール」を押す
4. 表示名が `IDEANOV` になっていることを確認する
5. 追加する

## 開けない時の確認

- ホーム画面アイコンを一度削除して、正しいURLから追加し直す
- ブラウザでURLを直接開けるか確認する
- `master-admin` や `idea-link` で終わるURLになっていないか確認する
- `hub_context` が付いた長いURLになっていないか確認する

## 現在の補足

HUB本体はGitHub Pagesで配信されています。ログイン後の社員確認・アプリ取得・通知取得はNOV HUB API（Supabase Edge Function）を通ります。読み込みが遅い場合は、通信状態を確認し、必要に応じてブラウザで再読み込みしてください。
