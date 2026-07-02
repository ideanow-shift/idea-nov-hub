-- HUB / Core DB positions formal additions and reception position deactivation.
-- Executed on 2026-07-03.
--
-- Added formal positions:
--   0020 店長
--   0021 店長見習い
--   0022 FCオーナー見習い
--   0023 一般スタッフ
--
-- Deactivated job-type position:
--   0017 レセプション

begin;

with proposed_positions(position_no, position_name) as (
  values
    ('0020', '店長'),
    ('0021', '店長見習い'),
    ('0022', 'FCオーナー見習い'),
    ('0023', '一般スタッフ')
),
inserted_positions as (
  insert into public.positions (
    position_no,
    position_name,
    is_active
  )
  select
    pp.position_no,
    pp.position_name,
    true
  from proposed_positions pp
  where not exists (
    select 1
    from public.positions p
    where p.position_name = pp.position_name
  )
  returning id, position_no, position_name, is_active
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
    'cleanup_id', 'employee_attribute_required_positions_20260703',
    'action', 'employee_attribute.add_required_position',
    'new_value', jsonb_build_object(
      'position_no', position_no,
      'position_name', position_name,
      'is_active', is_active
    ),
    'reason', 'OS/Core DB正式役職リストに含まれるため',
    'executed_by', 'm.wakita@idea-nov.com'
  ),
  'employee_attribute.add_required_position',
  position_name,
  '正式役職マスタを追加',
  now()
from inserted_positions;

with target_position as (
  select id, position_no, position_name, is_active
  from public.positions
  where id = '799feda6-3263-4080-b133-458743fba752'
    and position_name = 'レセプション'
    and is_active = true
    and not exists (
      select 1
      from public.employees e
      where e.position_id = '799feda6-3263-4080-b133-458743fba752'
    )
),
updated_position as (
  update public.positions p
  set is_active = false
  from target_position t
  where p.id = t.id
  returning p.id, p.position_no, p.position_name, t.is_active as old_is_active, p.is_active as new_is_active
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
    'cleanup_id', 'employee_attribute_cleanup_job_type_positions_20260703',
    'action', 'employee_attribute.deactivate_job_type_position',
    'old_value', jsonb_build_object('position_name', position_name, 'is_active', old_is_active),
    'new_value', jsonb_build_object('position_name', position_name, 'is_active', new_is_active),
    'reason', 'レセプションはpositionsではなくjob_typesで扱うため',
    'executed_by', 'm.wakita@idea-nov.com'
  ),
  'employee_attribute.deactivate_job_type_position',
  position_name,
  '職種系役職を非表示化',
  now()
from updated_position;

commit;
