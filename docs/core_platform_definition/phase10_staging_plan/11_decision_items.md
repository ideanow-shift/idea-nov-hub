# Decision Items

| ID | 判断 | 推奨 |
|---|---|---|
| D1 | 案Aを採用するか | 採用 |
| D2 | Supabase free active slotがあるか | Dashboardで確認 |
| D3 | Free pauseを許容するか | PoCのみ許容 |
| D4 | 継続時にPro 25 USDを承認するか | Phase 11前に上限決定 |
| D5 | project region | productionと同法域、別project |
| D6 | Firebase Hosting provider domain | DNS変更なしで開始 |
| D7 | Owner割当 | 6 rolesを指名 |
| D8 | audit retention | 30〜90日候補、Security決定 |
| D9 | key rotation | 90日/incident時 |
| D10 | Phase 11 authority | project作成・deployを個別承認 |

Management consoleへアクセスできないため、existing unused resources、billing plan、free slotsはUnknownのままです。
