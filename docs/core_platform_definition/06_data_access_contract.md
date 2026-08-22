# Data Access Contract

## 原則

- Core Masterは共通Gatewayのread adapterから参照する。
- 新アプリはpublic/core物理表名を業務コードへ露出しない。
- writeはownerアプリの専用command APIだけ。read endpointと分離する。
- responseは `contract_version`, `source_version`, `as_of`, `id`, `status` を持つ。
- ID変換は明示mapping。名称/emailによる暗黙joinは禁止。

## 方式

| 方式 | 用途 | 判定 |
| --- | --- | --- |
| 物理表直接参照 | DB ownerの管理・診断 | 新アプリでは禁止 |
| 共通View | 安定したread projection | ライブ権限確認後の候補 |
| RPC | as-of/複合scope/read model | SECURITY DEFINER監査後の候補 |
| API/Gateway | 認証・認可・監査を要する全Web | 推奨 |
| Adapter層 | public/core差分とversion吸収 | 必須 |
| Snapshot | 法人経営向け確定店舗売上/KPI | 必須 |

## アプリ別

| app | Core read | Core write | 業務write |
| --- | --- | --- | --- |
| 店舗営業 | store/employee/assignment adapter | 不可 | 専用Sales API |
| 現職者 | employee/org adapter | 承認済み変更APIのみ | HR API |
| 法人経営 | corporation/store + confirmed snapshot | 不可 | Finance API |
| 求人 | org/job type adapter | 不可 | Talent API |
| 勤怠 | employee/store assignment as-of | 不可 | Attendance API |

## 更新・監査・再処理

- write requestはidempotency key、expected version、actor、reasonを要求する。
- 監査はactor/app/action/resource/scope/result/correlation、before/after digestを記録し、token/secret/PII本文は記録しない。
- retryは同一idempotency keyで同一結果を返す。部分成功はoperation statusで回収する。
- 月次訂正は確定snapshotを上書きせず、新versionと差額理由を作る。
- 法人経営は店舗snapshotをread-only利用し、会計調整を自領域に保持する。

Core Master更新可能アプリは当面「Core管理ownerの承認済みcommand endpoint」のみ。一般アプリは全てread-onlyとする。
