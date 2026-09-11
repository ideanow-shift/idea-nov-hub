# CSRF and Origin Results

Phase 8 contractではinvalid CSRF、actor/redirect差し替えをdenyしました。Phase 6 local serverにはOrigin検査とCSRF header検査があります。

| 項目 | ローカル/Source | 正式staging |
|---|---|---|
| valid / invalid Origin | contractあり | 未検証 |
| Originなし | fail-closed設計 | 未検証 |
| CSRF tokenなし / 不正 | unit Pass | 未検証 |
| cross-origin POST | contractあり | 未検証 |
| preflight / CORS allowlist | 設計のみ | 未検証 |
| open redirect | unit Pass | 未検証 |

実origin、reverse proxy、browser preflightを含む検証が必要です。
