# Phase 0 Gate

## 判定

**Conditional Go**

| Gate | 結果 | 根拠 |
|---|---|---|
| 既存資産を特定できた | Pass | UI、CSV validator、Core、read API候補を特定 |
| 再利用/再構成を分類できた | Pass | Reuse/Extend/Replace/Archive/Unknownを整理 |
| 正式売上原本が確定した | Fail | Unknown |
| 業務ルールが確定した | Fail | 税・取消・返品・訂正・締め等未承認 |
| employee dependencyを限定できた | Pass | manager/area/mappingの最小追加 |
| MVPを限定できた | Pass | 月次中心、AI/予測を除外 |
| production-ready DB/APIがある | Fail | canonical sales fact/pipelineなし |
| staging/rollbackがある | Fail | Phase 10計画段階 |
| 既存テストが全件通る | Fail | 57件中54件成功、3件既存失敗 |

## Phase 1への条件

Phase 1は次に限定してGo:

- source discoveryと正式選定
- 業務/KPI contract
- synthetic/匿名化golden fixtures
- import/read modelの設計
- 既存UI/APIのread-only接続仕様
- negative test設計

以下はNo-Go:

- 本番DB migration/write
- 本番data import
- service roleの新規本番経路
- production deploy
- KPIの経営承認なしの正式表示
- NOV HUB、IDEA LINKの変更

## 完了条件

DI-01〜10、12、13、15、16のBlockerにownerと承認結果が入り、golden fixtureの集計値が業務ownerに承認された時点で、staging実装Gateを再判定する。
