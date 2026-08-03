# NOV Talent Staging Runtime Connection

## 判定

`STAGING_RUNTIME_READY_FOR_PUBLICATION`

Staging Candidate Versioned DatasetのACTIVE 636件を、HUB Sessionと既存正式Roleで認可して読むStaging専用read-only APIを接続した。候補者の直接書込み、Dataset更新、Production昇格、canonical、NOV People、Employee Core、LINE履歴には到達しない。

## Runtime切替

- `runtimeMode: staging`、`stagingCandidateDataset: true`、`readonlyApiEnabled: true`、`networkEnabled: true`、`writeEnabled: false` の全条件が揃った場合だけStaging Runtimeを使用する。
- 条件が揃わない場合は保持済みのMock Runtimeへ安全に戻る。
- Mock Runtimeを削除しない。
- ブラウザへStaging service roleやDB credentialを渡さない。

## Auth / Role

- ブラウザは既存NOV HUB SessionだけをBearerとして送る。
- Staging APIは既存NOV HUB `bootstrap`をread-onlyで照会し、正式`roleKeys`を検証する。
- `super_admin`、`backoffice`、`hr.admin`: 全Candidate表示。
- `hr.staff`: 採用担当表示。
- `executive`: Dashboard中心。電話・emailはserver-sideで除外する。
- その他Role、未ログイン、不正Origin、期限切れSessionはfail closedとする。

## Staging API

- Project: `idea-nov-staging`
- Function: `nov-talent-staging-readonly-api`
- Method: GET / OPTIONSのみ
- Dataset: ACTIVEがexactly oneで、合計・27卒・28卒件数がDataset metadataと一致する場合だけ返す。
- Browser roleの直接SELECTは引き続き不可。

## 引渡しURL

PR統合と明示承認付きGitHub Pages公開後の利用URL:

`https://ideanow-shift.github.io/idea-nov-hub/talent/`

本SprintではProduction Pagesを変更していないため、現時点の公開URL引渡しは未実施である。

## 初期操作

1. `https://ideanow-shift.github.io/idea-nov-hub/` へ既存の社員アカウントでログインする。
2. HUBの「求人管理」を同一タブで開く。
3. 画面右上が「Staging Runtime」であることを確認する。
4. 全体サマリーで636件、候補者一覧で27卒528件・28卒108件を確認する。
5. 読取りのみで利用し、Source更新は正式SpreadsheetからのImport手順に分離する。

## 公開前の残Gate

- PRのActions SUCCESS。
- PRの人間レビューと統合。
- `Deploy NOV HUB to GitHub Pages`の明示承認付き実行。
- 公開HUB SessionでRole別・636件・Console Error/Warning 0の実ブラウザ確認。
