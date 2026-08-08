# Production URL Validation

確認日: 2026-08-01 JST

| URL | 結果 | 判定 |
|---|---|---|
| \`https://ideanow-shift.github.io/idea-nov-hub/\` | HTTP 200 | HUB公開中 |
| \`https://ideanow-shift.github.io/idea-nov-hub/js/apps.js\` | Store Operations登録なし | 現公開artifactはmain未反映 |
| \`https://ideanow-shift.github.io/idea-nov-hub/store-sales/index.html\` | HTTP 404 | 起動不能 |

Store Operationsが未公開のため、HUB Session引継ぎ、Role別起動、403、Console Error/WarningのProductionブラウザ試験は未実施。
