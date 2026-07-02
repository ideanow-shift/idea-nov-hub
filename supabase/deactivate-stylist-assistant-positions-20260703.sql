-- HUB / Core DB position cleanup.
-- Executed on 2026-07-03.
--
-- Purpose:
--   Deactivate job-type labels that no longer have employee references
--   after moving employees to the formal position 一般スタッフ.
--
-- Important:
--   Physical DELETE is prohibited. This only sets is_active=false.

begin;

with target_positions as (
  select id, position_no, position_name, is_active
  from public.positions
  where position_name in ('スタイリスト', 'アシスタント')
    and is_active = true
    and not exists (
      select 1
      from public.employees e
      where e.position_id = public.positions.id
    )
),
updated_positions as (
  update public.positions p
  set is_active = false
  from target_positions t
  where p.id = t.id
  returning
    p.id,
    p.position_no,
    p.position_name,
    t.is_active as old_is_active,
    p.is_active as new_is_active
)
insert into public.master_change_logs (
  table_name,
  record_id,
  changed_by_email,
  change_payload,
  action_type,
  target_name,
  change_summary,
  created_at
)
select
  'positions',
  id,
  'm.wakita@idea-nov.com',
  jsonb_build_object(
    'cleanup_id', 'employee_attribute_deactivate_job_type_positions_20260703',
    'action', 'employee_attribute.deactivate_job_type_position',
    'old_value', jsonb_build_object(
      'position_no', position_no,
      'position_name', position_name,
      'is_active', old_is_active
    ),
    'new_value', jsonb_build_object(
      'position_no', position_no,
      'position_name', position_name,
      'is_active', new_is_active
    ),
    'reason', 'スタイリスト/アシスタントはpositionsではなくjob_typesで扱うため',
    'executed_by', 'm.wakita@idea-nov.com'
  ),
  'employee_attribute.deactivate_job_type_position',
  position_name,
  '職種系役職を非表示化',
  now()
from updated_positions;

commit;
