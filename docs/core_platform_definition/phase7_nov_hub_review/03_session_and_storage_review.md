# Session and Storage Review

| 情報 | 現在の場所 | lifetime | 評価 |
|---|---|---:|---|
| HUB bearer session | `sessionStorage` | 15分 | JS-readable、XSS時に流出 |
| employee context | `sessionStorage`, `localStorage`, URL | 12時間 | 署名なし、PIIとscope情報を含む |
| Management Firebase ID token | session/local storage | localは約10分 | 高リスクbearer保存 |
| IDEA LINK app session | `sessionStorage` | 15分 | app audienceあり、Cookieではない |
| one-time code | URL query、DB hash | 60秒 | 交換後URL除去、一回consume |

## Phase 6との差

- HttpOnly / Secure / SameSite Cookieではない。
- app間cookie isolationとCSRF contractがない。
- HUB sessionに`kid`、asymmetric verification、rotation contractがない。
- browser sessionのidle/absolute timeout、central revokeがない。
- URL contextがhistory/referrerへ出る可能性を完全には除去できない。

## 移行原則

新handoffではURLへJWT、Firebase token、employee_idを出しません。opaque codeだけを渡し、受信backendが交換してapp-scoped HttpOnly Cookieを発行します。legacy storageはflag対象外アプリだけに限定し、canary成功後に個別廃止します。
