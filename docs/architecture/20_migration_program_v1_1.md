# Core Business Data Foundation — Migration Program v1.1

| Item | Contract |
|---|---|
| Authority | Program Owner approval — PR002 Migration Number Approval / Program Alignment |
| Status | Effective for authoring-number allocation |
| Scope | 24 Program PRs / M001–M060 |
| Migration SQL / DB operation | Not authorized by this document |

## 1. Numbering authority

Migration Program v1.1 follows the implemented ledger, not the superseded pre-implementation estimate.

- M001–M011 are immutable implemented history. Their number, filename meaning and order must never be changed or reused.
- The unimplemented v1 allocation `PR002=M003–M004` is retired. It has no authority over implemented M003/M004.
- PR002 Accounting Foundation owns M012–M019 exactly.
- M020–M060 are collision-free future reservations. Reserving a number does not authorize authoring, apply or a business-scope change.
- Every migration number is globally unique, monotonically increasing and owned by exactly one Program PR.

## 2. Authoritative implemented history

| Program family | Migration | Immutable responsibility |
|---|---:|---|
| PR001 / PR001-A | M001 | Canonical Core namespace and security boundary |
| PR001 / PR001-A | M002 | Snapshot/source identity envelope and crosswalk foundation |
| PR001 / PR001-A | M003 | Corporation and Store Canonical identities/history |
| PR001 / PR001-A | M004 | Department and Employee Canonical identities/history |
| PR001 / PR001-A | M005 | Employee Store Assignment / Store Scope canon |
| PR001 / PR001-A | M006 | Corporation–Store operating relation and Store Population |
| PR001 / PR001-A | M007 | Master Version and immutable audit ledger |
| PR001 / PR001-A | M008 | Canonical Master projections |
| PR001 / PR001-A | M009 | Core Master RLS and Grant boundary |
| PR001 / PR001-A | M010 | Core Master release verification and synthetic fixtures |
| PR001 / PR001-B1 | M011 | Snapshot Metadata / Manifest / Approval / Validation foundation |

This registry records the established design/implementation meaning. It does not rename or rewrite any existing migration artifact.

## 3. PR002 final allocation

| Responsibility | Migration | One responsibility | Depends on |
|---|---:|---|---|
| ACF-01 | M012 | Accounting namespace, default deny, Import Batch/File and typed staging boundary | M001, M009, M011 |
| ACF-02 | M013 | Account identity/history and versioned statement mapping | M012; PR001 Canonical IDs |
| ACF-03 | M014 | Scenario/type constraints and Accounting Version lifecycle | M012–M013 |
| ACF-04 | M015 | Journal, Canonical Accounting Fact and versioned allocation layer | M013–M014 |
| ACF-05 | M016 | Validation, Approval and immutable Accounting audit ledger | M012–M015 |
| ACF-06 | M017 | Publication Release/member and comparison rules | M014–M016 |
| ACF-07 | M018 | Published `security_invoker` Accounting projections; Cash Flow fail-closed | M017 |
| ACF-08 | M019 | RLS/Grant boundary, synthetic verification and rollback validation | M012–M018 |

The forward order is M012 → M013 → M014 → M015 → M016 → M017 → M018 → M019. Rollback rehearsal is the exact reverse, M019 → M012, without CASCADE and without modifying M001–M011. The graph is forward-only and acyclic.

## 4. M020–M060 future reservation

The former v1 future allocation cannot remain authoritative because M001–M019 are now fixed differently. To keep the approved 24 PR / 60 Migration envelope collision-free, v1.1 reserves the remaining numbers as follows. Business names, migration responsibilities and Authoring Gates remain subject to their own approved design packages.

| Program PR | Reserved range | Count |
|---|---:|---:|
| PR003 | M020–M021 | 2 |
| PR004 | M022–M023 | 2 |
| PR005 | M024–M025 | 2 |
| PR006 | M026–M027 | 2 |
| PR007 | M028–M029 | 2 |
| PR008 | M030–M031 | 2 |
| PR009 | M032–M033 | 2 |
| PR010 | M034–M035 | 2 |
| PR011 | M036–M037 | 2 |
| PR012 | M038–M039 | 2 |
| PR013 | M040–M041 | 2 |
| PR014 | M042–M043 | 2 |
| PR015 | M044–M045 | 2 |
| PR016 | M046–M047 | 2 |
| PR017 | M048–M049 | 2 |
| PR018 | M050–M051 | 2 |
| PR019 | M052–M053 | 2 |
| PR020 | M054–M055 | 2 |
| PR021 | M056–M057 | 2 |
| PR022 | M058 | 1 |
| PR023 | M059 | 1 |
| PR024 | M060 | 1 |

Control totals: PR001 family 11 + PR002 8 + PR003–PR024 41 = 60 unique migrations. Program PR count remains 24. No number appears in two ranges.

## 5. Program impact and change control

- PR001 implementation history: zero change.
- PR002: replaces the retired unimplemented M003–M004 estimate with approved M012–M019.
- PR003–PR024: number reservations shift to M020–M060; their business scope is not inferred or changed here.
- A future PR may subdivide work only inside its reserved range. Moving across ranges requires a new Program Owner approval and Program version.
- Exhausting a reserved range requires explicit renumbering of only unapplied future reservations; applied migrations remain immutable.
- Migration SQL Authoring, Fresh DB rehearsal, Staging Apply, data load and Production cutover remain separate gates.

## 6. Alignment decision

| Check | Result |
|---|---|
| M001–M011 number/meaning changes | PASS — zero |
| M012–M019 duplicates | PASS — zero |
| ACF-01–ACF-08 one-to-one mapping | PASS — eight of eight |
| One responsibility per Accounting migration | PASS |
| Forward dependencies | PASS |
| Reverse rollback order | PASS — M019 to M012 |
| Circular dependency | PASS — none |
| PR003+ collision | PASS — starts at M020 |
| 24 PR / 60 Migration control total | PASS |
