# Browser Session Validation

## 実ブラウザ結果

| Check | Result | Note |
|---|---|---|
| Secure/HttpOnly/SameSite Cookie発行・localhost受理 | Pass | `__Host-` contract |
| HttpOnly相当のJS非読取 | Pass | visible diagnosticのみ、値は取得せず |
| clean URL/history current entry | Pass | query/hashなし |
| referrerへtoken/codeなし | Pass | `no-referrer` |
| localStorage/sessionStorageへtokenなし | Pass | 空であることだけを画面表示 |
| App A CookieをApp Bで利用 | Pass（拒否） | `unauthorized` |
| App B訪問後もApp A binding維持 | Pass | App A再認証成功 |
| invalid CSRF | Pass（拒否） | `csrf_denied` |
| valid Origin + CSRF header | Pass | `write_allowed` |
| logout/revoke | Pass | 再読込`unauthorized` |
| expired session | Pass | 60秒後`unauthorized` |
| real HTTPS | Unverified | 証明書・stagingなし |
| cross-site SameSite | Unverified | 実domainなし |
| cross-origin POST bridge成功 | Unverified | 検証browserがform Originを`null`化しexact allowlistが拒否 |

Origin `null`を許可する緩和は行わなかった。cross-origin bridgeのdenyは安全側だが、成功経路は実HTTPS stagingで再検証が必要。idle/absolute timeoutとrevoke/renew競合はNode integration testで検証済み。
