# HUB employee LINE WORKS destination inventory precheck pack 2026-07-17

## Result

```yaml
source_candidate: complete
static_validation: PASS_8_OF_8
local_rehearsal: LOCAL_REHEARSAL_INFRASTRUCTURE_UNAVAILABLE
production_evidence: required
production_query_executed: false
mutation: false
```

SELECT-only SQL SHA-256: `992E37261B93810C0C4B8F55D3FEF94A8BCF19E8ADEEDB9F5C2BA80432259F0E`

## SELECT-only candidate

`supabase/employee-line-works-destination-select-only-inventory-20260717.sql`

このSQLは`pg_catalog`と`information_schema`だけを参照し、通知先tableの行、LINE WORKS User ID、社員IDを読まない。結果は以下のboolean/countのみである。

- table存在
- required column 6件の存在
- employee target対応constraint
- unique index存在
- RLS enabled/forced
- policy件数とbrowser policy件数
- service_role/browser table privilege件数
- required RPC 3件の存在件数
- SECURITY DEFINER/fixed search_path件数
- browser EXECUTE件数

## Local rehearsal

合成schema、合成employee table、employee target対応table、3 RPCをfixtureとして用意した。manifestは全SQLをSHA-256で固定し、inventory、rollback、cleanを順に検証する。

ローカルlane実行時、manifest内の全SHAは一致したが、固定Podman接続に対応するVM本体が存在しなかったためpreconditionで停止した。

```yaml
classification: LOCAL_REHEARSAL_INFRASTRUCTURE_UNAVAILABLE
sql_execution_started: false
production_access_count: 0
host_port_count: 0
source_repair_required: false
```

別connectionへの差し替えや新規VM作成はlaneの固定identityを変えるため行っていない。

## Production gate

Core DB reviewerがSQL identityを確認し、linked productionに対するSELECT-only 1回を別承認する。結果が次をすべて満たすまでfrontend write flagはfalseを維持する。

```yaml
table_exists: true
required_columns_present: true
employee_target_supported: true
unique_index_present: true
rls_enabled: true
browser_policy_count: 0
browser_privilege_count: 0
required_function_count: 3
security_definer_count: 3
fixed_search_path_count: 3
browser_execute_count: 0
```

production resultが不一致でも、その場でDDL/RPC/RLS/GRANTを変更しない。
