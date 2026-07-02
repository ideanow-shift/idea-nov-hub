-- HUB / Core DB employee position cleanup.
-- Executed on 2026-07-03.
--
-- Purpose:
--   Move employees whose position is a job-type label
--   (スタイリスト / アシスタント) to the formal position 一般スタッフ.
--
-- Important:
--   This only updates employees.position_id.
--   It does not update employees.job_type_id.
--   It does not delete or deactivate positions.

begin;

with general_staff as (
  select id, position_name
  from public.positions
  where id = '8d9bde00-4ac9-4673-a7fc-1e5c6cf8a945'
    and position_name = '一般スタッフ'
    and is_active = true
  limit 1
),
target_positions as (
  select id, position_name
  from public.positions
  where position_name in ('スタイリスト', 'アシスタント')
),
target_employees as (
  select
    e.id,
    e.employee_id,
    e.full_name,
    e.position_id as old_position_id,
    tp.position_name as old_position_name,
    gs.id as new_position_id,
    gs.position_name as new_position_name
  from public.employees e
  join target_positions tp on tp.id = e.position_id
  cross join general_staff gs
  where e.position_id is not null
),
updated_employees as (
  update public.employees e
  set
    position_id = te.new_position_id,
    updated_at = now()
  from target_employees te
  where e.id = te.id
  returning e.id
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
  'employees',
  te.id,
  'm.wakita@idea-nov.com',
  jsonb_build_object(
    'cleanup_id', 'employee_attribute_position_to_general_staff_20260703',
    'action', 'employee_attribute.position_to_general_staff',
    'employee_id', te.employee_id,
    'old_value', jsonb_build_object(
      'position_id', te.old_position_id,
      'position_name', te.old_position_name
    ),
    'new_value', jsonb_build_object(
      'position_id', te.new_position_id,
      'position_name', te.new_position_name
    ),
    'reason', 'スタイリスト/アシスタントは職種系であり、役職は一般スタッフへ統一するため',
    'executed_by', 'm.wakita@idea-nov.com'
  ),
  'employee_attribute.position_to_general_staff',
  te.full_name,
  '職種系役職を一般スタッフへ整理',
  now()
from target_employees te
join updated_employees ue on ue.id = te.id;

commit;
