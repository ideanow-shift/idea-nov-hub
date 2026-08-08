# 認可マトリクス

## 共通モデル

`decision = role × scope × action × resource sensitivity × record state` とする。roleだけで許可しない。scopeは `self`, `assigned_store`, `managed_area`, `corporation`, `department`, `all`, `case_owner` をCore IDで表す。推測で許可せず、未確認はdenyする。

## Role dictionary

| 業務role | 標準scope |
| --- | --- |
| 会長/社長/副社長/取締役/執行役員 | corporation/all。ただしPII明細は別permission |
| 営業部/教育部/EC事業部/総務人事部/経理部 | departmentまたは担当corporation |
| 直営エリアマネージャー | managed_area |
| FCオーナー | owned stores/corporation |
| 店長 | assigned_store |
| 一般社員 | self、assigned_storeの限定read |
| システム管理者 | platform管理。業務データ閲覧を自動付与しない |

## アプリ別MVP

| app | role | scope | read | create | update | approve | export | manage |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| NOV HUB | all active users | self | Yes | No | profile限定 | No | No | No |
| 法人経営管理 | 経営/経理 | corporation | Yes | import | own draft | close別権限 | approvedのみ | owner |
| 店舗営業管理 | 店長 | assigned_store | Yes | Yes | open period | close別権限 | limited | No |
| 店舗営業管理 | エリアMgr/営業部 | managed_area | Yes | limited | limited | Yes | approved | config別権限 |
| 求人管理 | 採用担当 | assigned case/corp | Yes | Yes | Yes | stage別 | masked | No |
| 現職者管理 | 本人 | self | masked | request | allowed fields | No | own docs | No |
| 現職者管理 | 人事担当 | assigned corp/case | Yes | Yes | Yes | step別 | controlled | No |
| 現職者管理 | 人事管理者 | corporation/all | Yes | Yes | Yes | Yes | controlled | Yes |
| 勤怠/シフト | 店長 | assigned_store | Yes | Yes | open period | confirm別 | limited | No |
| 評価・育成 | manager | reporting scope | Yes | cycle内 | cycle内 | finalize別 | limited | No |
| 経理・経費申請 | 本人/承認者/経理 | self/workflow/corp | Yes | role別 | state別 | step別 | controlled | owner |

## 必須negative tests

- 他店舗・他法人・他社員IDを差し替える。
- inactive/retired employee、期限切れtoken、別audienceを使う。
- draft/closed/finalized状態で禁止actionを呼ぶ。
- export、approve、manageだけを個別に昇格試行する。
- service role endpointへ偽actorを渡す。
- Storage pathやsigned URL対象employeeを差し替える。

現行コード/RLSから確認できない許可はすべて「要確認」であり、本表だけで本番権限を付与しない。
