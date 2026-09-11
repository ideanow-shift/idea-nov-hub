# Test Results

## 実行方法

```powershell
node --test sandbox/auth-foundation/auth-foundation.test.mjs
```

実行環境はローカルNode.js、外部networkなし、環境変数なし、synthetic fixtureのみ。

## Coverage

- handoff: token欠落、署名、issuer、audience、expiry、iat、nonce、replay、app、employee/UID整合
- exchange/session: 一回消費、code expiry、Cookie、app分離、idle/absolute timeout、revoke、雇用・login状態
- identity: unknown/duplicate UID、inactive、retired、login disabled、terminal/service分離
- authorization: roleなし、store/corporation/FC越境、manager/employee action、request差替え、terminal/service、closed record、duplicate request
- positive boundary: 主要employee role、terminal限定action、system service限定action
- adapter/audit: 7 operationとallow/deny event、Secret/氏名非転記

## Final result

| tests | pass | fail | skipped | duration |
|---:|---:|---:|---:|---:|
| 40 | 40 | 0 | 0 | 129.7025 ms |

実行日: 2026-07-28。Gateでは今後もfailureが1件でもあればnegative test項目をNo-Goとする。
