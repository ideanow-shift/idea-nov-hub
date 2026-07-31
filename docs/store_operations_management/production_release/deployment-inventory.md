# Deployment Inventory

## 判定

BLOCKED。Production publishは実行していない。

## 現行方式

| 項目 | 確認結果 |
|---|---|
| Hosting | GitHub Pages |
| Workflow | \`.github/workflows/deploy-pages.yml\` |
| Trigger | \`workflow_dispatch\`のみ |
| Approval input | \`production_approved=true\`必須 |
| Environment | \`github-pages\` |
| Artifact | \`portal/\` |
| Deploy action | \`actions/deploy-pages@v4\` |
| main自動deploy | なし |
| 公開URL | \`https://ideanow-shift.github.io/idea-nov-hub/\` |
| Store Operations URL | \`https://ideanow-shift.github.io/idea-nov-hub/store-sales/index.html\` |
| Custom domain | リポジトリ内CNAMEなし |
| Base path | \`/idea-nov-hub/\` |
| Cache | GitHub Pages HTTP cache（観測値 max-age=600） |
| Service worker | Store Operations公開判断に利用する登録なし |

## 現在の公開artifact

直近成功deployはrun 30671911695、head \`release/nov-talent-v2-clean-base\`、SHA \`4796dbb70846f32092c1867a163338b16008cb4a\`。このSHAはmain HEAD \`75f6a1adfb0252fd60cd97c2662b4fc235f84ab8\`を含まない。

公開HUBはHTTP 200だが、公開\`js/apps.js\`に\`store-sales-management\`はなく、Store Operations URLはHTTP 404。

## Rollback

GitHub Pagesの直前確認済みartifactを同じ手動workflowで再deployする。Store Operations APIやDBは未deployのため、今回の調査に伴うbackend rollbackはない。
