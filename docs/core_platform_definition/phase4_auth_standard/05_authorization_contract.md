# Authorization Contract

## Decision model

`allow = role × scope × action × sensitivity × record_state × principal_type`。全要素をserverで取得し、default deny。Browserのactor/store/corporation/roleはhintとしても本人確認に使わない。

## Vocabulary

| type | standard values |
| --- | --- |
| role | platform_admin, executive, headquarters_department, area_manager, fc_owner, store_manager, employee, finance_operator, hr_operator, recruitment_operator, education_operator, system_service |
| scope | all, corporation, department, area, managed_store, assigned_store, own_record, explicit_resource, system_internal |
| action | view, create, update, approve, close, reopen, export, delete, manage_permission, impersonate, system_execute |
| sensitivity | public, internal, confidential, pii, restricted |
| state | draft, open, submitted, approved, closed, deleted |

## Core roleとapp permission

Core roleは「誰/責任範囲」を表し、app permissionは「アプリ内で何ができるか」を表す。アプリ独自roleを増やさず、`app_id.permission_key` をCore role/scopeへmappingする。例: `store_sales.close_period` はstore_manager+assigned_storeまたは営業承認roleだけ。

## Rules

- platform_adminはplatform設定権限。finance/hr restricted dataは明示permissionが必要。
- executiveのall scopeもPII/export/deleteを自動許可しない。
- FC ownerは所有corporation配下だけ。他FC/直営はdeny。
- terminal principalは打刻・受付等の限定actionのみ。個人PII閲覧不可。
- system_serviceはsystem_internal + system_executeのみ。user approve/impersonate不可。
- delete/impersonate/manage_permissionは二者承認と強化監査。
- scopeはCore UUIDとeffective dateで評価し、名称・active assignment単独を使わない。

認可結果は `ALLOW` またはstable deny reasonを返し、resource存在を漏らす場合は404へ正規化する。
