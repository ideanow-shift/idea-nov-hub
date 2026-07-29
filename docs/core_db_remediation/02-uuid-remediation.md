# 02. Tokorozawa UUID Remediation

## Evidence boundary

The reported Tokorozawa mismatch is an audit finding. The checked-out source
contains store *names* in local management fixtures, but contains neither the
two UUID values nor their database creation timestamps. It is therefore not
possible to prove from source alone why they differ or which row was created
first. Any claim beyond that would be speculation.

## Required staging inventory

Before a production decision, a read-only staging owner must capture, without
changing data:

1. both candidate rows and their stable business identifiers (`store_no`,
   `store_id`, corporation, active state, timestamps);
2. inbound foreign-key/reference counts for each UUID;
3. references in employee assignments, store profiles, inquiry records,
   IDEA LINK follow-ups, views, RPCs, and API configuration;
4. the earliest trustworthy creation/audit evidence for each UUID; and
5. whether the records represent the same legal/operational store rather than
   a rename, relocation, or historical successor.

## Recommended immutable model

| Concept | Rule |
| --- | --- |
| Canonical UUID | The UUID of the staging-verified `public.stores` canonical row. It is never rewritten. |
| Legacy UUID | The non-canonical UUID remains unchanged and is never reused for a different business store. |
| Crosswalk | A separately approved `store_uuid_crosswalk` record maps the legacy UUID to the canonical UUID with effective dates, reason, approval evidence, and a unique active mapping. |
| Runtime | Reads canonicalize through the crosswalk; writes continue to reject a legacy UUID until a dedicated write-contract migration is approved. |

This sprint intentionally does **not** create or populate the crosswalk table:
the two UUIDs and their legal interpretation are staging facts not present in
the source snapshot. The history migration also does not modify either UUID.

## Decision rule

Only choose a canonical UUID after the staging inventory demonstrates that the
chosen `public.stores.id` is the row referenced by the committed Core contract
or that every affected reference has an approved, reversible migration plan.
If the evidence indicates separate stores, do not crosswalk them.
