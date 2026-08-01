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
   server-side matching boundary; UUIDs are not distributed in a CSV.
5. AM scope is not inferred. Until an approved assignment source exists, an AM
   receives an empty scope or `403`, depending on the requested route.

## Evidence needed before implementation

The canonical employee and corporation master sources, their effective periods, and
the AM assignment source remain approval gates. This document defines the contract,
not a data update.
