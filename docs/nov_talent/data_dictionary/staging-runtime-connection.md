# NOV Talent Staging Runtime Connection

## Current status

`STAGING_RUNTIME_ACTIVE`

公開求人管理はStaging `idea-nov-staging`へ接続しています。Candidate 636件（27卒528件、28卒108件）をWorkspace Contract `1.0.0`で取得し、NOV HUB Sessionと既存Roleでserver-side認可します。

## Runtime切替

- 公開業務Runtime: Staging
- Mock Runtime: 固定回帰と安全なFeature Flagとして保持
- 公開業務データのMock fallback: 禁止
- ブラウザへのservice role、DB credential、接続Secret露出: 禁止
- Workspace初期表示: Workspace API 1系統

Staging取得失敗をMock形式エラーへ変換しません。必須データ失敗は明示的なエラー、補助データ失敗は該当カードの「集計準備中」として扱います。

## Auth / Role

- ブラウザは既存NOV HUB SessionをBearerとして送ります。
- Staging APIはserver-sideでSession、Role、Permissionを検証します。
- `super_admin`、`backoffice`、`hr.admin`: 許可された全管理操作
- `hr.staff`: recruiter access profileとして、現行Permission Modelが許可する採用業務操作（担当者別scopeは未導入）
- `executive`: Dashboard、監査等のread-only範囲
- その他Role、未ログイン、不正Origin、期限切れSession: fail closed

## Staging API

- Staging Project: `idea-nov-staging`
- Production Project: `idea-nov-core`（接続・書込み対象外）
- Function namespace: NOV Talent専用
- Browser direct table access: 禁止
- Candidate、Event / Contact、Selection History、Next Actionの書込み: 認証済みserver-side APIのみ
- Workspace Contract: `1.0.0`

## Public URL

`https://ideanow-shift.github.io/idea-nov-hub/talent/`

## 初期操作

1. `https://ideanow-shift.github.io/idea-nov-hub/`へ既存社員アカウントでログインします。
2. HUBの「求人管理」を同一タブで開きます。
3. 「運用データ」またはStaging Runtime表示を確認します。
4. 学生636件、27卒528件、28卒108件を確認します。
5. 日常の新規入力・更新はNOV Talentで行います。

既存Spreadsheetは参照用アーカイブです。新規入力、通常更新、双方向同期は行いません。

## Historical note

旧版に記載したread-only Function、未deploy、Mock公開状態はStaging Runtime Connection Sprint当時の履歴です。現在の公開状態ではありません。初回Dataset SnapshotとMigration receiptは履歴証拠として保持します。
