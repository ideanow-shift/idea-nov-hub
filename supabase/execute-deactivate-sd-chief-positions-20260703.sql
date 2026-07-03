-- DRAFT ONLY. Do not execute without OS approval.
--
-- Purpose:
--   Deactivate SD / チーフ positions after employee references are moved.
--
-- Safety:
--   This file ends with ROLLBACK, not COMMIT.
--   Change ROLLBACK to COMMIT only after OS approval.

begin;

-- 1. Preview inactive candidates.
with target_positions as (
  select id, position_no, position_name, is_active
  from public.positions p
  where p.position_name in ('SD', 'チーフ')
    and p.is_active = true
    and not exists (
      select 1
      from public.employees e
      where e.position_id = p.id
    )
)
select
  position_no,
  position_name,
  is_active,
  id
from target_positions
order by position_name;

-- 2. Draft inactive update and history logging.
with target_positions as (
  select id, position_no, position_name, is_active
  from public.positions p
  where p.position_name in ('SD', 'チーフ')
    and p.is_active = true
    and not exists (
      select 1
      from public.employees e
      where e.position_id = p.id
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
    'cleanup_id', 'employee_attribute_deactivate_sd_chief_positions_20260703',
    'action', 'employee_attribute.deactivate_normalized_position_label',
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
    'reason', 'OS判断により SD/チーフ は正式役職として追加せず、参照移行後に非表示化するドラフト',
    'executed_by', 'm.wakita@idea-nov.com'
  ),
  'employee_attribute.deactivate_normalized_position_label',
  position_name,
  'SD/チーフ役職ラベルを非表示化',
  now()
from updated_positions;

-- 3. OS approved execution.
commit;
