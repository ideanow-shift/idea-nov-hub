# Current NOV HUB Auth Flow

## Firebase

1. frontendがFirebase SDKを読み込み、Google popupで認証する。
2. Firebase ID tokenを取得し、`nov-hub-api`へ送る。
3. backendはGoogle Identity Toolkitでtokenを検証する。
4. employee解決後、employee、表示可能app、15分HUB sessionを返す。

根拠: `portal/js/auth.js`, `portal/js/main.js`, `supabase/functions/nov-hub-api/index.ts`

## Email / PIN

1. emailとPINをEdge APIへPOSTする。
2. backendはpepper付きHMACでPINを照合する。
3. 失敗回数と15分lockを管理する。
4. 成功時はFirebase経路と同様にbootstrap結果とHUB sessionを返す。

PINはform bodyで送られます。account lockはありますが、経路全体のIP/device rate limitは確認できませんでした。

## Session

- audience: `nov_hub`
- lifetime: 15分
- algorithm: HS256
- subject: `public.employees.id`
- storage: `sessionStorage`
- Cookie: 使用していない
- server-side revoke: 確認できない
- key ID / rotation: 確認できない

Firebase bootstrapでも発行claimの`auth_source`が`hub_pin`となる実装で、監査精度に差があります。

## Actor resolution

sessionはemployee UUIDから解決します。Firebaseはemail RPC、UID検索、email検索の順です。Phase 4契約の「UIDからserver-side employee解決」と異なり、email collisionと重複identityをdefault denyにできません。

## Logout

frontend state、HUB session、employee context、Management用storageを消し、Firebase login時はFirebase sign-outも行います。server-side session revokeや他tabへのlogout broadcastは確認できません。
