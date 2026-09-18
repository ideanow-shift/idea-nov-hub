# Manual Setup Steps

| Step | 作業 | 実行者 | 管理画面 | 課金 | 変更対象 | rollback |
|---:|---|---|---|---|---|---|
| 1 | Owner・budget・region承認 | 経営者/CTO | 社内 | なし | Decision | 承認撤回 |
| 2 | 現在のfree project枠確認 | Supabase owner | Supabase | なし | なし | なし |
| 3 | Firebase staging project作成 | Firebase owner | Firebase | Spark候補 | 新project | project削除 |
| 4 | Google Auth有効化 | Firebase owner | Firebase Auth | 通常0候補 | STG Auth | disable |
| 5 | synthetic test user作成 | Auth owner | Firebase Auth | 通常0候補 | STG user | user削除 |
| 6 | Supabase staging project作成 | Supabase owner | Supabase | Free/Pro選択 | 新project | project削除 |
| 7 | region/password設定 | Supabase owner | Supabase | plan内 | STG DB | project削除 |
| 8 | staging Hosting有効化 | Firebase owner | Firebase Hosting | Spark枠候補 | STG site | site disable |
| 9 | authorized domain登録 | Firebase owner | Firebase Auth | なし | STGだけ | domain削除 |
| 10 | API keys制限確認 | Firebase owner | GCP | なし | STG key | revoke |
| 11 | service role取得・保管 | Supabase owner | Supabase | なし | STG Secret | rotate |
| 12 | GitHub environment作成 | Repo admin | GitHub | plan依存 | `staging-canary` | delete |
| 13 | required reviewer設定 | Repo admin | GitHub | plan依存 | approval | remove |
| 14 | GitHub Secrets登録 | Repo admin | GitHub | なし | STGのみ | delete/rotate |
| 15 | synthetic migration承認 | DB/Security owner | PR | なし | STG schema | project reset |
| 16 | Edge deploy承認 | Platform owner | GitHub/Supabase | quota内候補 | STG Edge | prior version |
| 17 | flag/allowlist設定 | Security owner | STG config | なし | STG flag | kill switch |
| 18 | test完了後cleanup判断 | CTO/owners | 各console | 停止効果 | STG resources | export不要 |

実行前に各dashboardの料金確認画面を保存します。
