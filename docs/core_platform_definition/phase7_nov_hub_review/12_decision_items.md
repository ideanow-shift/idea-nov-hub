# Decision Items

| ID | 経営・運用判断 | 選択肢 / 推奨 |
|---|---|---|
| D1 | 最初のcanary | `hub-context-test` synthetic read-onlyを推奨 |
| D2 | Phase 8の範囲 | source-only/stagingまでを推奨 |
| D3 | session domain設計 | app別host-only Cookieを推奨 |
| D4 | identity collision時の運用 | default deny + Identity owner手動解消 |
| D5 | fallback cardの扱い | emergency用途か廃止かを決定 |
| D6 | legacy `hub_context`の期限 | app別移行日と最終廃止日を決定 |
| D7 | Firebase ID token storage | Management移行優先度を決定 |
| D8 | flag / rollback owner | NOV HUB ownerとSecurity ownerを指名 |
| D9 | audit retention / access | 保持期間、閲覧者、incident SLAを決定 |
| D10 | 本番Gate | deploy、Secret、DB資源を別承認に維持 |

現時点ではいずれも実装上の仮定として確定しません。
