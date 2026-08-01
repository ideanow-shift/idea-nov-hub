# Monthly Data Source Inventory

## Scope

Store Operations V1 is monthly-only. This is a source and contract design; it creates no connection, import, database object, migration, or runtime change.

| Domain | Authoritative source candidate | V1 use | Status when not approved |
| --- | --- | --- | --- |
| Store Master | Supabase Store Master, `public.stores` direction | store identity, Direct/FC, current status | unavailable |
| Employee Master | Supabase employee master | employee-number matching only where required | unavailable |
| Corporation Master | Supabase organization/corporation master | corporation identity matching | unavailable |
| Accounting | approved monthly accounting CSV | sales, operating profit, product/EC aggregates | validating or unavailable |
| POS | approved monthly POS CSV | sales and customer aggregates | validating or unavailable |
| Attendance | approved monthly attendance CSV | aggregate workforce metrics | validating or unavailable |
| Realtime | no V1 source | excluded | unavailable |

The monthly CSV is the only V1 transaction source. A different source must receive a separate contract and approval; it cannot silently replace a CSV source.
