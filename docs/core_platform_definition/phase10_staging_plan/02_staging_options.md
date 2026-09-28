# Staging Options

| 評価軸 | A: Firebase STG + Supabase STG | B: Supabase STG +既存Firebase | C: Local/Preview + managed store | D: Cloudflare stack + Firebase STG |
|---|---|---|---|---|
| production分離 | 高 | 中 | 高 |
| PII risk | 低 | 中〜高 | 低 |
| 構築/運用 | 中 | 中 | 低/中 | 高 |
| 初期/月額 | 0候補 / 0〜25 USD | 0候補 / 0〜25 USD | 0候補 / provider次第 | 0候補 / 0〜5 USD+ |
| Secret | project分離 | Firebaseだけ共有 | local/managed分散 | vendor分散 |
| HTTPS/Cookie | 実証可能 | 実証可能 | Preview次第 | 実証可能 |
| cross-origin | 実証可能 | Auth境界混在 | 限定的 | 実証可能 |
| distributed/audit | Supabase Postgres | Supabase Postgres | managed資源が必要 | Durable/KV/D1 |
| rollback/破棄 | project単位 | Firebase影響に注意 | 容易 | project単位 |
| CI/CD/全app拡張 | 高 | 中 | 低 | 高だが技術差大 |

## 判定

- **A: 推奨。** project単位の完全分離と現行技術への近さを両立。
- **B: 非推奨。** production Firebaseのauthorized domain、quota、user directory、incident boundaryを共有し、誤設定がproduction認証へ波及する。
- **C: Phase 9再試験の補助には可、本番前最終検証には不足。** trusted public HTTPS、multi-instance、Secret/approval lifecycleが弱い。
- **D: 将来候補。** Cloudflare Pages/Workers Freeは魅力的だが、新vendorとruntime差を増やすため今回の第一選択にしない。
