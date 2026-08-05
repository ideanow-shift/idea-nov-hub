# Role Permission Approval Table

| 領域 | 承認する状態 | 承認しない状態 |
| --- | --- | --- |
| Login | 専用監査RoleのみLOGIN | service role、アプリRole、共有login |
| Schema | `pg_catalog`/`information_schema`可視性と明示`public`/`core` usage | 任意schema探索権限 |
| Table | 承認済みrelationへのSELECTのみ | INSERT/UPDATE/DELETE/TRUNCATE/所有権 |
| RLS | `NOBYPASSRLS`、現行policyを適用 | RLS解除・BYPASSRLS |
| Functions | EXECUTEなし | RPC/関数実行権限 |
| Roles | `NOINHERIT`、SET ROLEなし | role membership、継承、代理切替 |
| Session | search_path固定、read-only、短時間timeout | 任意search_path、COMMIT、TEMP |
| Connection | 接続数1、24時間以内失効 | 複数同時接続、無期限credential |

未適用候補は [audit-role-unapplied-sql.sql](audit-role-unapplied-sql.sql) にある。実行は別途DBA承認ゲートのみで可能。
