# Store And Employee Matching

## Authoritative identifiers

V1 matches only approved canonical identifiers: `store_id`, `corporation_id`, and
`employee_no`. Names, display labels, email addresses, and aliases are never used
to infer a match.

## Rules

1. Store records must resolve to the approved `public.stores` Store Master snapshot.
2. Corporation and employee identifiers must resolve to their approved master
   snapshots before a record can be reviewed or published.
3. A missing, duplicate, inactive, or cross-corporation match is a rejection.
4. The approved Tokorozawa legacy UUID crosswalk is applied only by the controlled
   server-side matching boundary; UUIDs are not distributed in a Workbook.
5. The Supabase Employee Master is the formal AM-assignment source. It holds one or
   more approved `assigned_store_ids` with `assignment_effective_from` and
   `assignment_effective_to` for each assignment.
6. A Store Scope includes only assignments effective for the requested period.
   Expired, future, missing, duplicate, or invalid assignments are excluded.
7. AM scope is never inferred. An AM with no effective assignment receives an empty
   scope or `403`, depending on the requested route.

## Evidence needed before implementation

Employee and corporation master implementation details, including the physical
representation for multiple effective-dated store assignments, remain a separately
approved change. This document defines the contract, not a data update.
