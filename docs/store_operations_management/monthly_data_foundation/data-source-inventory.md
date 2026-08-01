# Monthly Data Source Inventory

## Scope

Store Operations V1 is monthly-only. This is a source and contract design; it creates no connection, import, database object, migration, or runtime change.

| Domain | Formal V1 source | V1 use | Status when not approved |
| --- | --- | --- | --- |
| Store Master | Supabase Store Master, `public.stores` | store identity, Direct/FC, current status | unavailable |
| Employee Master | Supabase employee master | employee matching and effective AM store assignments | unavailable |
| Corporation Master | Supabase corporation master | corporation identity matching | unavailable |
| Monthly sales | Yayoi Accounting CSV | monthly sales | validating or unavailable |
| Monthly profit | Yayoi Accounting CSV | monthly operating profit | validating or unavailable |
| Monthly EC sales | Yayoi Accounting CSV | monthly EC sales | validating or unavailable |
| Monthly product sales | Yayoi Accounting CSV | monthly product sales | validating or unavailable |
| Realtime | no V1 source | excluded | unavailable |

V1 uses one all-20-store CSV per month for each of the four transaction types. The
monthly CSV is the only V1 transaction source. A different source must receive a
separate contract and approval; it cannot silently replace a CSV source.
