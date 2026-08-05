# Core Master Impact

## Store Master

`public.stores` is the approved Store Master SSoT. The server-side import adapter must verify 20 current stores, direct 13, FC 7, and resolve the approved sheet mapping to canonical store IDs. No sheet label becomes a store identifier.

## Employee Store Scope

The repository definition for `public.employee_store_assignments` already supports multiple rows per employee, `effective_from`, `effective_to`, active state, and store foreign keys. The Phase 3 candidate is reuse: combine the employee's canonical role with current effective assignment rows on the server. AM without a current assignment resolves to no scope; Store Manager resolves to one approved store. No separate AM master is proposed.

The existing repository grant to `service_role` is not authorization for this design and must not be reproduced in a browser or new function.

## Tokorozawa Legacy Crosswalk

No physical crosswalk relation was found in the inspected repository definitions. One conditional Core Master-owned relation is therefore a candidate, not a decision. Its minimum logical fields are canonical `public.stores` store reference, legacy UUID reference, legacy source schema/table, valid period, source reference, audit reference, and lifecycle status. It must not be owned by Store Operations or editable from its UI. UUID values remain unchanged and are never documented in full.
