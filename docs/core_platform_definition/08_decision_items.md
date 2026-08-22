# Decision Items

| ID | 判断 | 推奨 | Owner | Status |
| --- | --- | --- | --- | --- |
| D01 | Core Master物理正本 | public 3表を当面正本 | CTO/Core DB owner | Needs Decision |
| D02 | core同名表 | 削除せず非正本・adapter内限定 | CTO/Core DB owner | Needs Decision |
| D03 | Firebase検証方式 | 共通GatewayでFirebase ID token検証 | Security/CTO | Needs Decision |
| D04 | email fallback | 期限付き・一意・監査付き | Security/HR | Needs Decision |
| D05 | role/scope/action | 共通モデル、各app ownerが行列承認 | CTO/各業務owner | Needs Decision |
| D06 | 店舗売上原本 | source、粒度、締め、訂正を営業・経理で選定 | 営業/経理 | Blocked |
| D07 | KPI主定義 | KPI-005の式・税・丸め・営業日を承認 | 営業/経理 | Blocked |
| D08 | 採用→現職者移管 | onboarding caseを唯一の入口 | 採用/人事 | Needs Decision |
| D09 | HR PII分類 | field別閲覧・保存・監査 | 人事/法務/Security | Blocked |
| D10 | Core write owner | 専用承認command APIのみ | CTO/Core owner | Needs Decision |
| D11 | ライブ権限 | RLS/GRANT/Function/Storage catalog取得 | Core DB owner | Blocked |
| D12 | 店舗営業MVP着手 | D01/D03/D05/D06/D07/D11通過後 | CTO/営業 | Needs Decision |

推測で埋めない項目はBlockerとして残す。Acceptedは本タスクでは付与しない。
