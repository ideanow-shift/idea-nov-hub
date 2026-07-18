# HUB Master Data Intake receipt S1 source pack 2026-07-18

## Scope

S1 creates only the backend idempotency receipt foundation for future atomic Master Data Intake. It does not create the commit RPC or write any employee, store, corporation, profile, or audit row.

## Contract

- exact targets: employees / stores / corporations
- lowercase SHA-256 digests only
- unique client request ID
- unique target plus file digest
- statuses: pending / succeeded
- successful receipt requires completion timestamp
- result summary must be a JSON object and must contain counts/categories only
- actor references `public.employees.id`
- RLS enabled
- PUBLIC / anon / authenticated privileges revoked
- no browser policies
- no service-role grant in S1; backend execution is an S2 decision

## Files

- `review/master-data-intake-receipt-s1-20260718/forward.sql`
- `review/master-data-intake-receipt-s1-20260718/verify.sql`
- `review/master-data-intake-receipt-s1-20260718/rollback.sql`
- `review/master-data-intake-receipt-s1-20260718/clean.sql`

The bootstrap and precheck files exist only for isolated local rehearsal.

## Local rehearsal

- classification: `LOCAL_REHEARSAL_PASS`
- precheck: pass
- forward: pass
- verify: pass
- rollback: pass
- clean: pass
- production access count: 0
- host port count: 0
- remote action count: 0
- secret access count: 0

The rehearsal used the fixed file identities recorded in the local bundle manifest. A stale unrelated bundle manifest failed the global lane validator, so this S1 bundle was independently hash-checked and executed without modifying the unrelated manifest.

## Stop line

- production schema apply
- commit RPC creation
- service-role grant
- Edge/frontend publish
- production CSV import
- receipt cleanup/retention execution

Production apply and rollback are separate gates. Rollback is destructive and must never run automatically against production.
