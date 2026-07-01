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
- Edge優先/fallback処理: `portal/js/api.js`

## Edge Function対応済みアクション

- `bootstrap`
- `announcements`
- `novHubNotifications`
- `changeOwnPin`
- `log`
- `health`

`master-admin` 系APIはまだGASを使う。HUBトップの通常利用から先にGAS依存を外す。

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
- `portalAppsReachable`

## 移行状態

2026-07-01時点:

- Edge Functionはデプロイ済み
- Supabase DB接続は確認済み
- `PIN_HASH_PEPPER` は登録済み
- フロントはEdge優先、失敗時GAS fallback
- `edgePinEnabled: true`

PINログインもEdge Functionを優先する。GASはfallbackとして残す。
