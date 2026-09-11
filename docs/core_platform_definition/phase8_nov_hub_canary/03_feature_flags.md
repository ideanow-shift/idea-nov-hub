# Feature Flags

| Flag | Default | 効果 |
|---|---|---|
| `globalEnabled` | `false` | 共通handoff全体 |
| `appEnabled` | `false` | `hub-context-test` |
| `environmentEnabled` | `false` | 環境単位 |
| `environment` | `development` | `production`は常にdeny |
| `allowedSyntheticActors` | `[]` | synthetic actor allowlist |
| `killSwitch` | `true` | 他flagより優先して停止 |

すべての条件を満たす場合だけ発行します。productionはflagを全てONにしてもdenyします。OFF時はfallback auditを出し、canaryでは安全な診断拒否となります。既存業務appはこのmoduleを参照せず、従来起動を維持します。
