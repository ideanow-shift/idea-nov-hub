# Monthly Data Source Inventory

## Scope

Store Operations V1 is monthly-only. This is a source and contract design; it creates no connection, import, database object, migration, or runtime change.

| Domain | Formal V1 source | V1 use | Status when not approved |
| --- | --- | --- | --- |
| Store Master | Supabase Store Master, `public.stores` | store identity, Direct/FC, current status | unavailable |
| Employee Master | Supabase employee master | employee matching and effective AM store assignments | unavailable |
| Corporation Master | Supabase corporation master | corporation identity matching | unavailable |
| Monthly sales | Yayoi `残高試算表（年間推移）` workbook, approved P/L mapping | `monthly_sales` | validating or unavailable |
| Monthly profit | same workbook, approved P/L mapping | `operating_profit` | validating or unavailable |
| Monthly EC sales | same workbook, approved P/L mapping | `monthly_ec_sales` | validating or unavailable |
| Monthly product sales | same workbook, approved P/L mapping | `monthly_product_sales` | validating or unavailable |
| Realtime | no V1 source | excluded | unavailable |

V1 uses one immutable annual-trial-balance workbook as the physical transaction
input. It contains four logical monthly metrics, not four uploaded files. Every
enabled P/L sheet must map through the approved sheet mapping to the all-20-store
composition. A different physical source must receive separate approval; it cannot
silently replace this workbook profile.
