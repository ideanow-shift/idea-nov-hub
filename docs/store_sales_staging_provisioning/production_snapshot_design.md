# Production Snapshot Design

## Decision

Store Operations reads one-way, approved, sanitized Snapshot data in the Sandbox. It never opens a request-time connection to Production.

```text
Production read-only gate -> approved sanitized Snapshot artifact -> Sandbox validation -> Store Operations read-only API
```

This document defines a future process only. It authorizes no Production read, Snapshot creation, upload, deploy, credential, or database action.

## Dataset boundary

| Domain | Included aggregate data | Explicit exclusions |
| --- | --- | --- |
| Store Master | canonical store code, display name, Direct/FC class, active state, approved operator code, approved legacy-reference crosswalk | raw UUID, source record key, contacts, address, arbitrary history |
| Sales and profit | tax-exclusive total revenue, operating profit, derived operating margin, confirmation state and confirmed-through period | journals, invoices, allocations, budgets, raw accounting detail |
| Customer count and unit price | aggregate customer count, aggregate transaction count, approved aggregate unit-price fields by store/month | customer IDs, names, visit dates, reservations, free text |
| Product and EC | aggregate product revenue/count and aggregate EC revenue/count by store/month | product/customer order identifiers, order rows, inventory movement |
| AM | assignment state plus approved opaque Scope reference only when an approved source exists | employee ID, employee name, email, HR attributes, inferred assignment |

## Data-minimization rule

Each field must be necessary for a fixed Store Operations panel. The extraction contract must reject unapproved columns before sanitization. The target is not a copy of Production; it is a bounded report artifact.

## Availability rule

The Sandbox accepts only an approved, unexpired, integrity-verified Snapshot. Absent, expired, malformed, or baseline-inconsistent data returns `unavailable` or `503`; it is never replaced with synthetic, zero, cached, or Production-live values.

## Ownership

| Decision | Required owner approval |
| --- | --- |
| Store Master projection and legacy crosswalk | Core DB Owner |
| Accounting, customer, product, and EC definitions | Accounting Owner |
| AM Scope source and sanitization | Security and organization-scope owners |
| Extraction gate and artifact approval | Representative, Security Owner, Core DB Owner, Accounting Owner |
| Sandbox acceptance and release window | Release Owner |

