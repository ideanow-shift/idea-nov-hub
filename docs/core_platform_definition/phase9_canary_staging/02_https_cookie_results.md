# HTTPS and Cookie Results

| 項目 | 結果 |
|---|---|
| HTTPS / trusted certificate | 未検証 |
| mixed content | 未検証 |
| HTTP→HTTPS redirect | 未検証 |
| HttpOnly / Secure / SameSite=Lax | contract test Pass、実browser未検証 |
| JavaScriptからCookie不可視 | 未検証 |
| URL/history/referrer非残存 | source contract Pass、実browser未検証 |
| app間Cookie分離 | session contract Pass、実browser未検証 |
| idle / absolute expiry | unit Pass |
| logout / revoke / expired | unit Pass |
| multiple tab / browser close | 未検証 |
| fixation / rotation | 未検証 |

正常証明書のstaging originがないため、HTTPS実browser Gateは未達です。
