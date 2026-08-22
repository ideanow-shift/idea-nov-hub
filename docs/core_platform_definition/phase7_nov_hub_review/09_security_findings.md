# Security Findings

| Severity | Finding | 対応 |
|---|---|---|
| High | Management向けFirebase ID tokenをJS-readable storageへ保存 | HttpOnly app sessionへ移行 |
| High | `hub_context`が署名なしでURL/localStorageへ入り、PII・role・scopeを含む | 表示hintに限定し、server再解決 |
| High | Firebase actor解決がemail-firstでduplicateをdenyしない | UID-first、0/複数件deny |
| High | HUB/app sessionが共有HMAC、`kid`・rotation・revokeなし | EdDSA/ES256とsession store |
| High | service-role backend境界が広く、CORS `*` | endpoint別origin、最小権限、rate limit |
| Medium | app cardのDB/fallback/frontend overrideが分散 | registry contractとdrift test |
| Medium | role scopeが空、assignment effective date不明 | Core Read Adapterで正規化 |
| Medium | `auth_source`がFirebase経路でもPIN表記 | issuer claimを正す |
| Medium | logoutのserver revoke、multi-tab伝播が未確認 | revoke + broadcast test |
| Low | Firebase web API key fallbackがsource内にある | Secretではないが環境configへ統一 |

未確認を脆弱性と断定しません。特にrate limit、live CORS前段、WAF、実際のRLSはruntime証跡が必要です。
