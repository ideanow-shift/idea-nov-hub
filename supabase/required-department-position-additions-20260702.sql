-- HUB / Core DB required master additions.
-- OS/Core DB approved after SELECT preview and executed on 2026-07-02.
--
-- Required additions:
--   departments: カラー専門店事業部
--   positions: 課長

/*
begin;

with inserted_department as (
  insert into public.departments (
    department_no,
    department_name,
    department_code,
    is_active
  )
  select
    '0007',
    'カラー専門店事業部',
    'COLOR_SPECIALTY',
    true
  where not exists (
    select 1
    from public.departments
    where department_name = 'カラー専門店事業部'
  )
  returning id, department_name, department_code, is_active
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
  'departments',
  id,
  'm.wakita@idea-nov.com',
  jsonb_build_object(
    'cleanup_id', 'employee_attribute_required_master_additions_20260702',
    'action', 'employee_attribute.add_required_department',
    'new_value', jsonb_build_object(
      'department_no', department_no,
      'department_name', department_name,
      'department_code', department_code,
      'is_active', is_active
    ),
    'reason', 'カラー専門店の所属・売上・教育・人員分析で必要',
    'executed_by', 'm.wakita@idea-nov.com'
  ),
  'employee_attribute.add_required_department',
  department_name,
  '正式部署マスタを追加',
  now()
from inserted_department;

with inserted_position as (
  insert into public.positions (
    position_no,
    position_name,
    is_active
  )
  select
    '0018',
    '課長',
    true
  where not exists (
    select 1
    from public.positions
    where position_name = '課長'
  )
  returning id, position_name, is_active
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
    'cleanup_id', 'employee_attribute_required_master_additions_20260702',
    'action', 'employee_attribute.add_required_position',
    'new_value', jsonb_build_object(
      'position_no', position_no,
      'position_name', position_name,
      'is_active', is_active
    ),
    'reason', '部長・係長と同じ組織上の責任階層として必要',
    'executed_by', 'm.wakita@idea-nov.com'
  ),
  'employee_attribute.add_required_position',
  position_name,
  '正式役職マスタを追加',
  now()
from inserted_position;

commit;
*/
