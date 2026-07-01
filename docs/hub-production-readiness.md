# NOV HUB Production Readiness

NOV HUBを本番運用するための確認項目です。

## 現在の合格ライン

- NOV HUB本体は `https://ideanow-shift.github.io/idea-nov-hub/` で開ける
- `portal/js/firebase-config.js` は `apiMode: "edge"` / `apiFallback: "edge-only"` / `gasApiUrl: ""`
- NOV HUB Edge API health が `ok: true`
- 社員・店舗・権限・ログイン情報の正本はSupabase Core DB
- スプレッドシートは通常運用の正本として使わない
- HUBマスタ管理で社員情報、PIN、権限、アプリ、店舗LINE WORKS通知先を扱える
- アプリカードは `public.portal_apps` を正本にする
- 各アプリへは `hub_context` を渡す
- `pin_hash`、Firebase ID token、Supabase service_role key、LINE WORKS Secretはフロントへ出さない
- `public.employee_roles` は `service_role` に `select / insert / update` をgrant済み。共通ロール `staff` 付与とアプリ別権限更新に必要。

## Health Check

```text
https://nkmxevmioczcmnldreyo.supabase.co/functions/v1/nov-hub-api?action=health
```

以下が `true` であること。

- `supabaseUrlConfigured`
- `supabaseServiceRoleKeyConfigured`
- `pinHashPepperConfigured`
- `firebaseApiKeyConfigured`
- `employeesReachable`
- `loginCredentialsReachable`
- `employeeRolesReachable`
- `storesReachable`
- `bootstrapRpcReachable`
- `notificationDestinationsReachable`
- `portalAppsReachable`
- `accessLogsReachable`

## 運用導線

- 社員追加: HUBマスタ管理
- メール変更: HUBマスタ管理
- PIN設定・ロック解除: HUBマスタ管理
- IDEA LINK権限: HUBマスタ管理 / `employee_roles`
- アプリカード追加・編集: HUBマスタ管理 / `portal_apps`
- 店舗LINE WORKS通知先: HUBマスタ管理 / `os.notification_destinations`
- Expense Hub通知: `os.nov_hub_notification_inbox`

## 既知の残依存

- IDEA LINK中継ページは、現時点では既存IDEA LINK Web App URLへHUB Contextを渡す
- 一部既存アプリは各プロジェクト側の移行完了まで外部URLとして扱う
- `gas-backend` フォルダは履歴・緊急参照用として残すが、HUB本体の通常導線には使わない

## 2026-07-02 完成時点チェック

- 最新GitHub Pagesデプロイ: success
- 最新公開スモークチェック: OK
  - NOV HUB top: 200
  - Master admin: 200
  - NOV Navi: 200
  - IDEA LINK bridge: 200
  - Expense Hub: 200
  - Runtime config: 200
  - NOV HUB Edge health: 200 / 12 checks
- `public.employee_roles` の `service_role` 権限:
  - SELECT: true
  - INSERT: true
  - UPDATE: true
- 共通ロール未設定者には、HUBマスタ管理の社員詳細上部から `staffを付与` できる
- `staff` は一般スタッフ用のHUB基本権限であり、管理者・幹部権限ではない

## リリース前確認

- `git status` で未意図の差分がない
- 公開フォルダ内JSの構文チェックが通る
- `node scripts/hub-smoke-check.mjs` が成功する
- GitHub Actions `Deploy NOV HUB to GitHub Pages` が success
- 公開版 `firebase-config.js` に `script.google.com` が含まれていない
- スマホホーム画面URLは `/idea-nov-hub/`
- ログイン後、トップ画面、マスタ管理、主要アプリ遷移が開ける
