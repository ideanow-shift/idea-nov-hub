# HUB Handoff Contract

## 推奨方式

NOV HUBがone-time codeをserverへ登録し、ブラウザはtoken本体ではなく短寿命codeをPOSTまたは同一siteの302でアプリへ渡す。アプリBackendがcodeを一度だけ交換し、app専用session cookieを発行する。既存 `hub_app_auth_handoffs` をconceptual basisとするが、DB変更は別Gate。

## Claim contract

| claim | rule |
| --- | --- |
| `iss` | 固定NOV HUB issuer URL |
| `aud` | 対象app IDのみ |
| `sub` | canonical employee UUID。terminalはterminal UUID |
| `firebase_uid` | employee principal時のみ |
| `iat` / `exp` | UTC。handoff 60秒目安、app session 15分目安 |
| `jti` / `nonce` | 128-bit以上、一回限り |
| `app_id` | portal registryのimmutable ID |
| `session_id` | HUB sessionとのcorrelation |
| `login_method` | firebase / pin_fallback / terminal / emergency |
| `principal_type` | employee / terminal / service / external |
| `terminal_type` | kiosk/shared/personal候補 |
| `authorized_application` | audienceと同値を再確認 |

employee UUIDを含めても、BackendはFirebase UID→public employee UUIDを再解決し一致しなければdenyする。PIN fallbackはFirebase UIDなしのためfallback registryで再確認する。

## Security

- 署名: asymmetric EdDSA/ES256を第一候補。既存HMAC sessionはkey rotationとapp分離までmaintain。
- replay: jti/nonceをatomic consume。二度目は401 `HANDOFF_REPLAYED`。
- clock skew: 最大60秒。expiry延長禁止。
- revoke: HUB session revoke、employee inactive、login disabled、app disabledを交換時と各renewal時に確認。
- URLへJWT、Firebase token、employee IDを置かない。query codeもreferrer/history対策のone-time opaque値のみ。
- localStorageへ長寿命tokenを保存しない。既存依存はmigration window中だけ。
- cookie: `HttpOnly; Secure; SameSite=Lax`を標準。cross-siteが不可避ならBFF/POST bridgeを使い、`SameSite=None` は個別Security承認。
- app間再利用禁止。app A sessionをapp Bへ送らない。
