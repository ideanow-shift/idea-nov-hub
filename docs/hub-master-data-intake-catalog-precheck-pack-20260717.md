# HUB master Data Intake catalog precheck pack 2026-07-17

## Purpose

Data Intakeのtransactional RPC設計前に、productionの社員・店舗・法人・変更履歴table shapeを行データなしで確定する。

```yaml
query_type: SELECT_ONLY_CATALOG
production_query_executed: false
business_rows_read: false
mutation: false
```

## Candidate

`supabase/master-data-intake-catalog-select-only-precheck-20260717.sql`

記録するのは以下のcountだけである。

- required table count
- required/present column count
- natural key unique index coverage count
- RLS enabled/forced table count
- browser write privilege count
- store/corporation business profile table count

社員名、メール、社員番号、店舗名、法人名、変更履歴payloadを読まない。

## Expected contract

```yaml
required_table_count: 4
required_column_count: 18
present_required_column_count: 18
natural_key_unique_index_table_count: 3
rls_enabled_table_count: 4
browser_write_privilege_count: 0
business_profile_table_count: 2
```

期待値不一致時はRPC候補を推測実装せず、authoritative migration/source reconciliationへ戻す。

特に`master_change_logs`のrepo初期SQLは基本columnだけだが、現行Edgeは`action_type`、`target_name`、`change_summary`も書き込む。production shapeとcanonical Gitの一致を確認する必要がある。

## Next gate

1. Core DB reviewerによるSQL identity review。
2. productionへのSELECT-only 1回。
3. 結果をsanitized countsだけで記録。
4. table shape一致後にtransactional RPC、idempotency table、RLS/GRANTをsource-only設計。

DDL/RPC/RLS/GRANT、Edge変更、frontend保存有効化、CSV本番取込は別gateである。
