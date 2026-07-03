-- DRAFT ONLY. Do not execute without OS approval.
--
-- Purpose:
--   Normalize employee positions:
--     SD -> 店長
--     チーフ -> 副店長
--
-- Safety:
--   This file ends with ROLLBACK, not COMMIT.
--   Change ROLLBACK to COMMIT only after OS approval.

begin;

-- 1. Preview target counts.
with mapping as (
  select *
  from (values
    ('SD', '店長'),
    ('チーフ', '副店長')
  ) as m(old_position_name, new_position_name)
),
resolved_mapping as (
  select
    old_p.id as old_position_id,
    old_p.position_name as old_position_name,
    new_p.id as new_position_id,
    new_p.position_name as new_position_name
  from mapping m
  join public.positions old_p
    on old_p.position_name = m.old_position_name
  join public.positions new_p
    on new_p.position_name = m.new_position_name
   and new_p.is_active = true
)
select
  rm.old_position_name,
  rm.new_position_name,
  count(e.id) as draft_target_count
from resolved_mapping rm
left join public.employees e on e.position_id = rm.old_position_id
group by rm.old_position_name, rm.new_position_name
order by rm.old_position_name;

-- 2. Draft update and history logging.
with mapping as (
  select *
  from (values
    ('SD', '店長'),
    ('チーフ', '副店長')
  ) as m(old_position_name, new_position_name)
),
resolved_mapping as (
  select
    old_p.id as old_position_id,
    old_p.position_name as old_position_name,
    new_p.id as new_position_id,
    new_p.position_name as new_position_name
  from mapping m
  join public.positions old_p
    on old_p.position_name = m.old_position_name
  join public.positions new_p
    on new_p.position_name = m.new_position_name
   and new_p.is_active = true
),
targets as (
  select
    e.id,
    e.employee_id,
    e.full_name,
    rm.old_position_id,
    rm.old_position_name,
    rm.new_position_id,
    rm.new_position_name
  from public.employees e
  join resolved_mapping rm on rm.old_position_id = e.position_id
),
updated_employees as (
  update public.employees e
  set
    position_id = t.new_position_id,
    updated_at = now()
  from targets t
  where e.id = t.id
    and e.position_id = t.old_position_id
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
  t.id,
  'm.wakita@idea-nov.com',
  jsonb_build_object(
    'cleanup_id', 'employee_attribute_normalize_sd_chief_positions_20260703',
    'action', 'employee_attribute.normalize_position_label',
    'old_value', jsonb_build_object(
      'position_id', t.old_position_id,
      'position_name', t.old_position_name
    ),
    'new_value', jsonb_build_object(
      'position_id', t.new_position_id,
      'position_name', t.new_position_name
    ),
    'reason', 'OS判断により SD=店長、チーフ=副店長として役職を正規化するドラフト',
    'executed_by', 'm.wakita@idea-nov.com'
  ),
  'employee_attribute.normalize_position_label',
  t.full_name,
  'SD/チーフ役職呼称を正式役職へ正規化',
  now()
from targets t
join updated_employees ue on ue.id = t.id;

-- 3. OS approved execution.
commit;
