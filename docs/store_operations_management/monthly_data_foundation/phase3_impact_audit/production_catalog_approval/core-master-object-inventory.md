# Core Master Object Inventory

## Current Attestation State

No Production catalog request ran in this sprint. The following are therefore pending current evidence.

| Object or capability | Current status | Required confirmation |
| --- | --- | --- |
| `public.stores` | approved architectural SSoT, not freshly catalog-attested | schema, columns, keys, indexes, RLS, grants, aggregate current-store composition |
| `employee_store_assignments` | repository and historical-review candidate | physical relation, employee/store FK, multi-store support, `effective_from`, `effective_to`, RLS and grants |
| Tokorozawa legacy crosswalk | no physical relation proven by current attestation | existing relation/view/function candidate only; no UUID export |

## Effective Period Requirement

The exact target data type and current comparison semantics for `effective_to` are unverified. Core Master and Security owners must approve a single inclusive or exclusive rule after catalog evidence. AM scope remains deny-by-default until the rule and its server-side resolver are verified.

## Crosswalk Boundary

If the attestation confirms no compatible relation, the later minimal candidate belongs to Core Master, not Store Operations. It must preserve legacy identity without changing UUIDs and carry source, effective period, and audit ownership. This document creates no relation or migration.
