-- HUB / Core DB required position addition review.
-- OS/Core DB instruction: 相談役 is a formal positions addition target.
-- Do not execute INSERT until OS/Core DB approval after SELECT preview.
--
-- Confirmed preview on 2026-07-02:
--   public.positions.position_name = '相談役' -> no rows
--   latest assigned position_no -> 0018 課長
-- Proposed:
--   position_no = 0019
--   position_name = 相談役
--   is_active = true

-- SELECT preview
select
  id,
  position_no,
  position_name,
  is_active
from public.positions
where position_name = '相談役'
order by position_no;

select
  position_no,
  position_name,
  is_active
from public.positions
order by position_no;

-- INSERT proposal. Execute only after OS/Core DB approval.
/*
begin;

with inserted_position as (
  insert into public.positions (
    position_no,
    position_name,
    is_active
  )
  select
    '0019',
    '相談役',
    true
  where not exists (
    select 1
    from public.positions
    where position_name = '相談役'
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
    'cleanup_id', 'employee_attribute_required_soudanyaku_position_20260702',
    'action', 'employee_attribute.add_required_position',
    'new_value', jsonb_build_object(
      'position_no', position_no,
      'position_name', position_name,
      'is_active', is_active
    ),
    'reason', '組織上の役職/肩書として必要',
    'executed_by', 'm.wakita@idea-nov.com'
  ),
  'employee_attribute.add_required_position',
  position_name,
  '正式役職マスタを追加',
  now()
from inserted_position;

commit;
*/
