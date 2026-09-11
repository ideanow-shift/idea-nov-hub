# Phase 2 Gate

## 判定

**Conditional Go**

| Gate | 結果 | 根拠 |
|---|---|---|
| 実データ表示項目を特定 | Pass | Available 13件 |
| 計算可能項目を特定 | Pass | Derivable 25件、前提を明記 |
| 利益粒度を特定 | Pass | 法人月次Available、部署月次pathあり、店舗月次Unknown |
| 4種repeat率を特定 | Conditional | 総率は暫定Derivable、他3率はUnavailable |
| FTE算出可否を特定 | Pass | 現状Unavailable |
| rule-based action | Conditional | validation/data missing中心。KPI alertはsource待ち |
| UI prototypeへ進む | Conditional Go | read-only fixture、明示的準備中、placeholder禁止 |

## Prototype constraints

- 実データ接続・DB write・migration・deployは行わない。
- Available以外はsource stateとconfidenceを表示する。
- 0を欠損代替にしない。
- 健康scoreは内部contractのみでVersion1表示しない。
- 日次、staff分析、action historyを追加しない。
- production implementationは売上source、店舗P/L、FTE、repeatの別Gate後。
