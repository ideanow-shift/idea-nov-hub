# Real Data Source Inventory

## 判定

BLOCKED。正式actor-scoped Store Sales endpointとProduction read permissionを特定できない。

| 表示領域 | 候補Source | 現状 | 不足 |
|---|---|---|---|
| Store Master | \`public.stores\` / \`core.stores\` | 候補が複数 | SoT、UUID、履歴、RLS方針 |
| 売上 | Accounting/Core集計候補 | 正式table/view/API未確定 | key、period、freshness、read grant |
| 利益 | Accounting Core候補 | 正式確定値Source未確定 | \`confirmed_through_period\`と公開承認 |
| 集客 | KPI Engine候補 | 正式Source未確定 | 新規/既存定義、period、権限 |
| 単価 | KPI Engine候補 | 正式Source未確定 | 算定定義、period、権限 |
| 商品/MID | KPI/Accounting候補 | 正式Source未確定 | MID定義、店舗帰属、権限 |
| EC | EC集計候補 | 正式Source未確定 | 全社ECと店舗別貢献の分離 |
| 予算/前年比 | 予算・月次履歴候補 | 正式Source未確定 | version、比較期間、欠損規則 |
| Projection API | Store Sales Projection候補 | rule builderとcontractのみ | Production endpoint、DB接続、audit、deploy |

既存\`supabase/functions/store-sales-projection\`はSynthetic/Staging候補であり、Production実データSourceとして承認されていない。UIからDBへ直接接続しない。
