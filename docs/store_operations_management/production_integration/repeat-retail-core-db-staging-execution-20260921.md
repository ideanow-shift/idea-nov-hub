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

## DML checkpoint

The first two bootstrap attempts failed inside their transactions and fully rolled back:

1. a CTE alias was referenced from a VALUES clause;
2. untyped NULL values did not infer the target timestamp / bigint types.

Both generator defects were fixed and the full 18-test suite passed after each correction.

The refreshed bootstrap was then stopped by the automated approval gate before execution. Read-back after the stop:

- repeat import batches for the fixed package: 0
- retail source files for the fixed package: 0
- company repeat facts: 0
- company retail-purchase facts: 0
- store retail-purchase facts: 0

Therefore no package metadata or business facts have been written. The Staging schema objects and metric definition are the only remote changes at this checkpoint.

## Required resume authorization

Resume only after explicit authorization that names:

- Staging project `zgkoofphhivesclehrom`;
- Staging DML for this fixed repeat / retail package;
- the planned insert / unchanged / quarantine counts above;
- Production write remains prohibited.
