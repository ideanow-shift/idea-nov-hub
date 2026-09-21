# Repeat / retail Core DB Staging execution record — 2026-09-21

## Scope

- Portfolio lock: `CTO-PORTFOLIO-EXECUTION-ORDER-2026-09-21-V5`
- Phase: `PHASE_3_STORE_OPERATIONS_MANAGEMENT_V1`
- Staging project: `zgkoofphhivesclehrom`
- Production write: 0
- Production deploy: 0

## Fixed input

- Repeat package SHA-256: `EC6446D0FED94CC0494E8AA47320309EE931DE65F52A54157172D3BB8852EB9A`
- Retail package SHA-256: `EF2C56108BACED3F1999F6903C681B8D7BE963A50707388DC84BEA2BBFA68942`
- Package root SHA-256: `94CA104E062E3BCB2CB47910AA47F95F578C1BF9463196A2A4D9304E5A4ABBBA`

## Local verification

- Node tests: 18 / 18 PASS
- Repeat: 7,480 rows / 7,480 unique keys
- Retail purchase customers: 2,476 rows / 2,476 unique keys
- Generated execution plan:
  - Store repeat insert 6,600
  - Existing store repeat unchanged 440
  - Company repeat insert 440
  - Store retail-purchase-customer insert 1,492
  - Company retail-purchase-customer insert 92
  - EC / HQ staging-only 830
  - Outside canonical operation period quarantined 62

## Applied Staging schema

The Staging-only schema SQL was applied once. It:

- added the quantity metric definition `RETAIL_PURCHASE_CUSTOMER_VISITS / POS_RETAIL_PURCHASE_CUSTOMER_COUNT_V1`;
- created the company repeat staging table;
- created company repeat and company retail-purchase canonical fact tables;
- references `core.corporation_identities(corporation_id)`, matching the actual Staging schema;
- enables and forces RLS on all three new tables;
- creates no policies and grants no API role privileges.

Read-back:

- RLS: enabled on all three new tables
- FORCE RLS: enabled on all three new tables
- policy count: 0
- ACL: postgres only
- security advisor: the expected informational `rls_enabled_no_policy` finding is present; this is intentional because the tables are private and all API-role privileges are revoked.

## DML execution

The first two bootstrap attempts failed inside their transactions and fully rolled back:

1. a CTE alias was referenced from a VALUES clause;
2. untyped NULL values did not infer the target timestamp / bigint types.

Both generator defects were fixed and the full 18-test suite passed after each correction.

The refreshed bootstrap was initially stopped by the automated approval gate. Owner then supplied the explicit
`[OWNER REPEAT RETAIL CORE DB STAGING DML APPROVAL]` authorization naming this project, package, planned counts,
and Production prohibition. Execution resumed with the refreshed fixed SQL.

Bootstrap result:

- repeat import batch: 1
- repeat source-file evidence rows: 1,496
- retail package source file: 1
- retail monthly batches: 92

Staging result:

- store repeat rows: 6,600, all resolved / valid
- company repeat rows: 440, all resolved / valid
- retail raw rows: 2,476
- retail normalized staging rows: 2,476
- SALON promotion candidates: 1,492, all exact-mapped / valid
- COMPANY_TOTAL promotion candidates: 92, resolved / valid
- EC staging-only: 784, quarantined from canonical promotion
- HQ staging-only: 46, quarantined from canonical promotion
- outside canonical operation period: 62, quarantined

Canonical result:

- active store repeat: 7,040 (6,600 inserted + 440 existing unchanged)
- active company repeat: 440
- active store retail-purchase customer visits: 1,492
- active company retail-purchase customer visits: 92
- duplicate active grains: 0 for all four Fact contracts
- repeat calculation mismatches: 0
- retail negative quantities: 0
- retail quantity-over-denominator rows: 0
- retail rate mismatches: 0
- promotion misses: 0

Idempotency read-back:

- every staged repeat key has an active canonical key;
- every promotable retail key has an active canonical key;
- the active-grain unique indexes therefore leave zero missing inserts for the same package.

Batch status:

- repeat batch: `promoted`
- retail monthly batches: 92 / 92 `promoted`

## Security and Production isolation

- The three new tables remain `RLS=true` and `FORCE RLS=true`.
- Policy count remains 0 and ACL remains postgres-only.
- No `anon`, `authenticated`, or `service_role` privilege was granted.
- Production read-only verification found no company repeat table, no company retail table,
  no retail-purchase-customer metric definition, and zero retail-purchase-customer Fact rows.
- Production DDL / DML: 0.
- Deploy: 0.
- PR merge: 0.
