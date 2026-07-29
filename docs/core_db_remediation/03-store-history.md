# 03. Store History

`public.store_operation_history` is additive history for changes to the
operation of an already canonical store. It does not replace `public.stores`,
and it does not edit store UUIDs.

## Model

| Column | Purpose |
| --- | --- |
| `history_id` | Immutable event identifier |
| `store_uuid` | FK to `public.stores(id)` |
| `operating_entity_uuid` | FK to the operating corporation |
| `operation_type` | Controlled lifecycle/change event |
| `effective_from`, `effective_to` | Inclusive operational period |
| `reason` | Accountable explanation, bounded text |
| `created_at`, `updated_at` | Audit timestamps |

The migration adds a non-overlap exclusion constraint for each store’s date
periods. The allowed operation types are `open`, `close`, `transfer`,
`rename`, `legal_entity_change`, `fc_conversion`, and `status_correction`.

## Safety properties

- FK deletion is restricted; deleting a store cannot silently orphan history.
- No backfill or seed statement exists.
- RLS is enabled but no browser access is granted until the companion policy
  candidate and identity prechecks are approved.
- The update timestamp trigger affects only future history rows.
