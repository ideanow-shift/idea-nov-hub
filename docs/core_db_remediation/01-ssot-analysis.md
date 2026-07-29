# 01. Store SSoT Analysis

## Method and evidence boundary

This analysis is based only on the checked-out repository at commit
`24486d8b61061c104922c8dc5e9a1d5732cb06a4`. A Git-tree scan found 19
committed source files containing `public.stores`, five committed SQL files
declaring `references public.stores`, and zero committed source files
containing `core.stores`. No database catalog, table,
view, API, or runtime endpoint was queried. Consequently, "reference" below
means committed source reference, not a production row count.

## `public.stores` evidence

The canonical DDL is documented in
`docs/core-employee-ledger-v1-review.md` and defines `public.stores(id)` with
`store_no`, `store_id`, `store_name`, `corporation_id`,
`business_unit_id`, `area`, `store_type`, timestamps, and `is_active`.

Committed foreign-key dependents include:

| Dependent | Evidence |
| --- | --- |
| `public.employees.store_id` | `docs/core-employee-ledger-v1-review.md` |
| `public.employee_assignment_histories.store_id` | `supabase/core-assignment-histories.sql` |
| `public.employee_store_assignments.store_id` | `supabase/core-employee-store-assignments.sql` |
| `public.store_business_profiles.store_id` | `supabase/store-business-profiles.sql` |
| `public.concierge_department_inquiries.store_id` | `supabase/concierge_20260701_department_inquiries.sql` |
| `public.idea_link_activity_followups.store_id` | `supabase/idea-link-activity-followups-20260724.sql` |

Committed runtime/API dependencies include:

| Surface | Store use |
| --- | --- |
| `supabase/nov-hub-bootstrap-rpc.sql` | joins `employees` and multi-store assignments to `public.stores`; emits `storeId`, `storeNo`, `storeCode`, and `storeName` |
| `docs/nov-hub-app-context.md` | declares `public.stores` as the Store master |
| `docs/NOVNavi_README.md` | declares `public.stores.id` as the store SSoT |
| `supabase/core-master-readonly-checks-20260703.sql` | reads employee-to-store canonical associations |
| `supabase/functions/nov-hub-api/index.ts` | consumes Core employee/role context whose store identity is returned by the bootstrap RPC |

Git history shows the store schema was introduced with the Core employee ledger
review on 2026-06-23, then extended by assignment history (2026-06-23), area
and type (2026-06-23), bootstrap RPC (2026-07-01), and store business profile
(2026-07-10). The newest committed store-dependent workflow found here is the
IDEA LINK follow-up DDL dated 2026-07-24.

## `core.stores` evidence

No committed definition, foreign key, view, API reference, runtime reference,
or git history hit for the literal `core.stores` exists in this repository
snapshot (Git-tree reference count: 0). This does **not** prove that a database
object never existed; it proves only that it is absent from the reviewed source
evidence.

## Views and unresolved catalog evidence

No committed SQL view definition references either candidate. Production and
staging dependency counts, object ownership, and latest DDL timestamps remain
unverified until the read-only catalog queries in the runbook are approved and
recorded.

## Recommendation

Adopt `public.stores.id` as the canonical Core Master UUID. It is the only
candidate with committed schema, foreign-key, RPC, documentation, and runtime
evidence. Do not rename or move it to `core.stores` in this sprint. A future
schema move is permissible only as an expand/dual-read/contract-switch project
after staging proves a `core.stores` object and all dependencies are mapped.
