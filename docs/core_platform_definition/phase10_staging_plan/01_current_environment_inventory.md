# Current Environment Inventory

| 対象 | 確認結果 | Source / 状態 |
|---|---|---|
| GitHub repository | `ideanow-shift/idea-nov-hub` | local remote |
| GitHub Pages | `https://ideanow-shift.github.io/idea-nov-hub/` | source/docs |
| Pages workflow | `main` pushとmanual dispatchで`portal/`をdeploy | `.github/workflows/deploy-pages.yml` |
| GitHub environment | `github-pages` | workflow |
| staging workflow/environment | なし | source |
| Firebase Auth | Web SDK、Google + email/PIN flow | source |
| Firebase project/config | production候補のみsourceに存在 | 管理画面はUnknown |
| Supabase | project ref `nkmxevmioczcmnldreyo`をfrontendが参照 | source |
| Edge Functions | NOV HUB、IDEA LINKほか | source |
| Secret方式 | Edge側`Deno.env`、service role等 | 値・dashboardはUnknown |
| Current CI/CD | Pages deploy workflow 1件 | Edge deploy CIは未確認 |
| Existing domains | `ideanow-shift.github.io`、`*.supabase.co` | custom domainはUnknown |
| unused staging resources | 確認できず | dashboard accessなし、Unknown |
| Actions/Pages plan・billing | Unknown | GitHub管理画面が必要 |

GitHub PagesはHTTPS対応ですが、公開siteであり、GitHubもsensitive transaction用途に注意を示しています。Phase 10ではproduction endpointへ接続していません。
