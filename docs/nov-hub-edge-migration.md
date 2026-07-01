# NOV HUB GAS脱却メモ

## 方針

NOV HUB本体はGASを最終的に使わず、以下の構成へ移行する。

```text
GitHub Pages
↓
Firebase Auth / PIN login
↓
Supabase Edge Functions
↓
Supabase Core DB
```

## 追加済み

- Edge Function: `supabase/functions/nov-hub-api/index.ts`
- 公開URL: `https://nkmxevmioczcmnldreyo.supabase.co/functions/v1/nov-hub-api`
- フロント設定: `portal/js/firebase-config.js`
- Edge-only/fallback切替処理: `portal/js/api.js`

## API切替設定

`portal/js/firebase-config.js` の `apiFallback` で切り替える。

```js
apiMode: "edge",
apiFallback: "edge-only",
```

- `edge-only`: GAS fallbackを使わない。通常運用はこの設定。
- `auto`: Edge失敗時に `gasApiUrl` へfallbackする旧互換設定。通常運用では使わない。

`gasApiUrl` は空にしておく。HUB本体の通常導線はSupabase Edge Functionのみを使う。

## Edge Function対応済みアクション

- `bootstrap`
- `announcements`
- `novHubNotifications`
- `changeOwnPin`
- `log`
- `health`
- `masterBootstrap`
- `masterListEmployees`
- `masterListStores`
- `masterListPortalApps`
- `masterListChangeLogs`
- `masterCreateEmployee`
- `masterUpdateEmployee`
- `masterAssignDefaultStaffRole`
- `masterUpdateEmployeeAppRoles`
- `masterLinkFirebaseUid`
- `masterUpdateEmployeeLoginCredential`
- `masterUpdateStore`
- `masterUpdatePortalApp`
- `masterCreatePortalApp`

`master-admin` 系APIは主要な読み込み・編集処理がEdge Function対応済み。通常導線はEdge Functionを使う。

## 必要なSupabase Secret

`PIN_HASH_PEPPER` はGAS Script Propertiesと同じ値で登録する。

```powershell
npx supabase secrets set PIN_HASH_PEPPER="GASと同じpepper値" --project-ref nkmxevmioczcmnldreyo
```

値はGitHub、フロント、ログ、チャットに出さない。

## health確認

```powershell
Invoke-RestMethod "https://nkmxevmioczcmnldreyo.supabase.co/functions/v1/nov-hub-api?action=health" | ConvertTo-Json -Depth 8
```

以下が `true` ならHUB通常利用をEdge Functionへ寄せられる。

- `supabaseUrlConfigured`
- `supabaseServiceRoleKeyConfigured`
- `pinHashPepperConfigured`
- `firebaseApiKeyConfigured`
- `employeesReachable`
- `loginCredentialsReachable`
- `employeeRolesReachable`
- `storesReachable`
- `notificationDestinationsReachable`
- `portalAppsReachable`

## 移行状態

2026-07-01時点:

- Edge Functionはデプロイ済み
- Supabase DB接続は確認済み
- `PIN_HASH_PEPPER` は登録済み
- フロントはEdge-only運用
- `edgePinEnabled: true`
- `apiFallback: "edge-only"`
- `gasApiUrl: ""`
- master-admin読み込み系はEdge優先
- master-adminの社員追加・社員基本情報更新・退職処理はEdge優先
- master-adminのstaff権限付与・IDEA LINK権限更新・Firebase UID連携はEdge優先
- master-adminのログイン/PIN設定更新はEdge優先
- master-adminの店舗更新・LINE WORKS通知先更新はEdge優先
- master-adminのアプリ作成・更新はEdge優先

PINログインもEdge Functionを使用する。GAS URLはHUB本体の公開設定には残さない。
