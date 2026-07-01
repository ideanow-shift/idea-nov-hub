# NOV HUB

IDEA NOVグループ向けの社内アプリ統合ポータルです。

NOV HUBは、社員が各社内アプリへ入るための入口です。ログイン、社員情報、権限、アプリ一覧、通知、マスタ管理をCore DB / Supabase中心で扱います。

## 公開URL

- NOV HUB: `https://ideanow-shift.github.io/idea-nov-hub/`
- HUBマスタ管理: `https://ideanow-shift.github.io/idea-nov-hub/master-admin/`

スマホのホーム画面へ追加するURLは、必ずNOV HUB本体のURLにします。`master-admin`、`idea-link`、`hub_context`付きURL、各アプリ直URLは保存しません。

## 現在の標準構成

- Frontend: GitHub Pages / `portal`
- Auth: Firebase Auth Googleログイン + メール/PINログイン
- Backend: Supabase Edge Function `nov-hub-api`
- Core DB: Supabase `public.employees` / `public.stores` / `public.roles` / `public.employee_roles`
- Login credentials: Supabase `public.employee_login_credentials`
- Portal apps: Supabase `public.portal_apps`
- Access logs: Supabase `public.access_logs`
- Notifications: Supabase `os.nov_hub_notification_inbox`
- LINE WORKS通知先: Supabase `os.notification_destinations`

## 通常運用の正本

- 社員情報: HUBマスタ管理 / Core DB
- 店舗情報: HUBマスタ管理 / Core DB
- HUBログイン可否・PIN: HUBマスタ管理 / `employee_login_credentials`
- アプリ表示・権限: HUBマスタ管理 / `portal_apps` + `employee_roles`
- IDEA LINK権限: Core DB `employee_roles`
- 通知: `os.notifications` / `os.nov_hub_notification_inbox`

スプレッドシートは通常運用の正本としては使いません。過去データ、移行元、または一部外部アプリの暫定連携としてだけ扱います。

## API方針

HUB本体はSupabase Edge Functionを通常導線にします。

```text
GitHub Pages
↓
Firebase Auth / PIN login
↓
Supabase Edge Function nov-hub-api
↓
Supabase Core DB
```

`portal/js/firebase-config.js` は以下を標準とします。

```js
apiMode: "edge"
apiFallback: "edge-only"
gasApiUrl: ""
```

Apps Script / GAS Web App URLはHUB本体の公開設定へ残しません。

## Health Check

Edge API:

```text
https://nkmxevmioczcmnldreyo.supabase.co/functions/v1/nov-hub-api?action=health
```

以下が `true` ならHUB通常利用の基盤は準備OKです。

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

## HUB Context

NOV HUBから各アプリへは `hub_context` を渡します。

含めるもの:

- `employees.id`
- 社員名
- メールアドレス
- 所属
- `roleKeys`
- 店舗割当

含めないもの:

- `pin_hash`
- PIN
- Firebase ID token
- Supabase service_role key
- LINE WORKS Secret

`hub_context` は表示・初期値・メニュー出し分けの補助です。重要な書き込みや管理操作は、必ずEdge FunctionまたはSupabase RLS側で再検証します。

## 主な連携アプリ

- IDEA LINK: HUB Context主経路。権限は `idea_link.staff` / `idea_link.manager` / `idea_link.admin`
- 経費精算管理システム: `https://ideanow-shift.github.io/idea-nov-expense-hub/`
- NOV Navi: `/concierge/` 配下。画面表示名は `NOV Navi`
- マネジメント系アプリ: HUB Context + Core DB連携を前提にする

## 禁止事項

- `service_role` keyをフロントへ出さない
- LINE WORKS Secret類をフロントへ出さない
- `pin_hash` をAPIレスポンス、ログ、Contextへ含めない
- `hub_context` だけをDB更新の認可根拠にしない
- アプリごとに社員・店舗・権限マスタを重複作成しない
- 通常運用でスプレッドシートを正本として編集しない

## 公開

GitHub Pagesは `.github/workflows/deploy-pages.yml` で `portal` フォルダだけを公開します。

mainへpushするとGitHub Actionsで再公開されます。
