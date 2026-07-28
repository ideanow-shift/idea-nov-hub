# Security Findings

| Severity | Finding |
|---|---|
| Blocker | productionから分離されたstaging environmentを確認できない |
| Blocker | trusted HTTPS originと実server endpointがない |
| Blocker | distributed one-time storeが割当済みでない |
| Blocker | persistent audit sinkが割当済みでない |
| High | local file storeはmulti-host/network failureを再現しない |
| High | Cookie/CSRFはcontract中心で実browser証跡がない |
| Medium | flag propagation、cache TTL、rollback ownerが未確定 |

production URLやproduction Supabaseを代用しない判断により、productionへの影響はありません。
