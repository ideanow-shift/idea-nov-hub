# Sealed Staging Population Artifact Specification

Status: implementation contract. Target: `idea-nov-staging` only. This document authorizes no data operation.

## Population boundary

The artifact contains exactly six corporations, the 20 official stores (13 direct and seven FC), and three Owner-selected UAT employees: 脇田 (Executive), 戸田 (Area Manager), and 桝本 (Store Manager, 上石神井店). HQ and every other employee are rejected.

The artifact has six ordered datasets: `corporations`, `stores`, `employees`, `identities`, `roles`, and `assignments`. Each row carries a non-PII source reference, source snapshot/version, canonical UUID, target natural key, effective interval, status, and row SHA-256. The manifest carries the ordered row counts, per-dataset SHA-256, whole-artifact SHA-256, schema version, Staging project reference, approval reference, created timestamp, and rollback artifact hash.

## Mapping contract

Every row records this immutable relationship:

```text
sealed source record digest -> canonical UUID/version -> Staging target key/version
```

Names and email addresses are not matching keys. The three Employee mappings must be pre-resolved by the approved source record key plus expected Role and active Assignment evidence. Store mappings must resolve to the approved official Store code and classification. Any ambiguity, missing source row, changed source digest, or unexpected target row fails the entire dry-run.

## Determinism and idempotency

- UTF-8 JSON Lines, RFC 8785-style canonical key ordering, LF endings, decimal strings, ISO dates, and lowercase SHA-256 hex.
- Dataset and row order are fixed by canonical UUID byte order.
- Canonical UUIDs are retained between dry-run, apply, retry, and rollback; no runtime UUID generation is allowed.
- Apply is a single transaction protected by an artifact-level advisory lock.
- An identical artifact against an identical target is a no-op. A natural-key collision with a different digest is a hard failure.
- `dry-run` performs all schema, count, uniqueness, provenance, interval, Role/Assignment, target-project, pre-state, and checksum checks and performs zero writes.
- Apply requires the exact dry-run receipt, Owner approval reference, package hash, and unexpired one-time execution authorization.

## Privacy and safety

Only the minimum login delivery address needed by the Auth onboarding step may exist in an encrypted private execution envelope. It is excluded from the committed artifact, logs, receipts, browser output, and Core employee rows. Core keeps only a non-identifying display alias. Production database copy, password/PIN hash, phone, address, payroll, tax, family, and document data are prohibited.

The runner rejects synthetic rows, fake identities, HQ, counts other than 6/20/3, duplicate grains, inactive source employees, and assignments outside their effective interval. It never writes Business Facts or DBF Canonical Facts.

## Rollback

Rollback consumes the sealed rollback manifest generated with the artifact. It revokes access and deactivates only rows created by the exact artifact run, in reverse dependency order. It never deletes or updates pre-existing canonical rows. Immutable Core/M019 decisions are reversed by appended revoke/retire versions. A partial apply is rolled back by the transaction itself.
