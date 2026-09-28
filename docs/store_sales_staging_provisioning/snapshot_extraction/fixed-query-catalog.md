# Fixed Query Catalog

Fixed query identifiers are the only values the future approved adapter may execute. They are logical projection contracts, not SQL text. Query SQL, schema names, connection details, and raw response fields belong in a separately approved Production read-only pack.

| ID | Purpose | Output boundary | Initial availability |
| --- | --- | --- | --- |
| Q01_STORE_MASTER | current Store Master | approved store fields, 20/13/7 | required |
| Q02_ACCOUNTING_CONFIRMED | confirmed aggregate profit and revenue | tax-exclusive confirmed aggregates only | required |
| Q03_CUSTOMER_KPI | aggregate customer and transaction count | store/month aggregates | unavailable until source approval |
| Q04_UNIT_PRICE | aggregate unit prices | store/month aggregates | unavailable until source approval |
| Q05_PRODUCT_KPI | aggregate product revenue and count | store/month aggregates | unavailable until source approval |
| Q06_EC_KPI | aggregate EC revenue and count | store/month aggregates | unavailable until source approval |
| Q07_AM_SCOPE | AM assignment state | opaque Scope reference only | unavailable until organization source approval |
| Q08_LEGACY_CROSSWALK | approved Tokorozawa legacy mapping | opaque legacy/canonical reference | required |

The adapter may not execute unavailable queries. They appear in the manifest as `unavailable`; Q01 and Q08 are mandatory, and their absence rejects the artifact.
