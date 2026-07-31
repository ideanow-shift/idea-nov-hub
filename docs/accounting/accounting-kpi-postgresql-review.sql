-- REVIEW ONLY. Never apply directly to production.
-- The SQLite prototype tables map 1:1 to these tenant-safe PostgreSQL controls.
alter table accounting_kpi_definition_sets enable row level security;
alter table accounting_kpi_calculation_runs enable row level security;
alter table accounting_kpi_results enable row level security;
alter table accounting_kpi_result_inputs enable row level security;
alter table accounting_kpi_audit_logs enable row level security;

create unique index if not exists uq_kpi_completed_idempotency
on accounting_kpi_calculation_runs (
  accounting_version_id, definition_set_version, entity_id,
  scope_type, target_period, amount_basis
) where status in ('queued','running','completed','completed_with_warnings');

-- A SECURITY DEFINER function maintained by the platform must derive actor IDs
-- and scopes from auth.uid(); client-supplied role/scope claims are never used.
create policy kpi_result_scoped_select on accounting_kpi_results for select
using (
  kpi_actor_can_access(auth.uid(), scope_type, entity_id)
  and exists (
    select 1 from accounting_kpi_calculation_runs run
    join accounting_kpi_definition_sets ds
      on ds.definition_set_version = run.definition_set_version
    join accounting_versions av on av.id = run.accounting_version_id
    where run.id = accounting_kpi_results.calculation_run_id
      and run.status in ('completed','completed_with_warnings')
      and ds.status = 'released'
      and av.status = 'published' and av.is_active = true
  )
  and superseded_at is null
  and data_state = 'available'
);

create policy kpi_provenance_admin_select on accounting_kpi_result_inputs for select
using (kpi_actor_has_role(auth.uid(), array['kpi_admin','accounting_definition_reviewer']));

create policy kpi_audit_admin_select on accounting_kpi_audit_logs for select
using (kpi_actor_has_role(auth.uid(), array['kpi_admin']));

-- No UPDATE/DELETE policy exists for results, provenance, or audit.
-- Calculation workers receive INSERT through a server-held role only.
-- Run serialization: pg_advisory_xact_lock(hashtextextended(idempotency_key,0))
-- plus the partial unique index above. Do not expose service_role to clients.
