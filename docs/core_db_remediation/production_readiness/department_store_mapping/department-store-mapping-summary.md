# Department to Store Mapping Summary

## Result

**CONDITIONAL PASS for the approval pack; implementation is BLOCKED pending
human decisions.** The repository source contains no department-to-store
mapping source of truth, no department mapping resolver, and no per-department
store RLS policy. Therefore no candidate can safely be applied automatically.

## Candidate totals

| Measure | Count |
| --- | ---: |
| Target departments or functions | 6 |
| Full 20-store candidates | 2 |
| Direct 13-store candidates | 1 |
| FC 7-store candidates | 1 |
| No-store candidates | 2 |
| Human decisions required | 8 |
| Blocking candidates | 6 |
| Approved mappings | 0 |

## Current source facts

- Formal department design includes SALES, EDU, EC, HR, and ACCOUNTING.
- FC is not a formal department in the inspected design artifact.
- Existing Runtime resolves role keys and individual store assignments; it does
  not resolve department-to-store access.
- Current inspected source leaves department-manager permissions empty.
- Store-profile RLS source relies on a service-role gateway; no department
  store-read policy was found in the inspected source.
- The 13 direct / 7 FC roster is owner-provided baseline input and still needs a
  formal source-of-truth confirmation.

## Recommended next decision

Approve or reject Q01 through Q08 in the human-question pack. Only after all
affected scope, data-class, action-class, owner, and effective-date decisions
are recorded should a separate implementation review consider the recommended
`department_scopes` model, server-side resolver, API contracts, and RLS policy.

## Change declaration

This sprint created documentation and a static test only. It made no database,
RLS, migration, API, Runtime, deployment, staging, production, UUID, or
automatic entitlement change.
