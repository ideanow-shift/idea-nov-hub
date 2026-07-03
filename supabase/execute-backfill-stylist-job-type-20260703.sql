-- DRAFT ONLY. Do not execute without OS approval.
--
-- Purpose:
--   Backfill employees.job_type_id = hairstylist / 美容師
--   for employees whose previous position was スタイリスト and whose
--   current job_type_id is null.
--
-- Safety:
--   This file ends with ROLLBACK, not COMMIT.
--   Change ROLLBACK to COMMIT only after OS approval.

begin;

-- 1. Preview target count before update.
with target_logs as (
  select l.record_id as employee_uuid
  from public.master_change_logs l
  where l.table_name = 'employees'
    and l.change_payload ->> 'cleanup_id' = 'employee_attribute_position_to_general_staff_20260703'
    and l.change_payload #>> '{old_value,position_name}' = 'スタイリスト'
),
hairstylist_job_type as (
  select id, job_type_key, job_type_name
  from public.job_types
  where job_type_key = 'hairstylist'
    and job_type_name = '美容師'
    and is_active = true
  limit 1
),
targets as (
  select
    e.id,
    e.employee_id,
    e.full_name,
    e.job_type_id as old_job_type_id,
    hjt.id as new_job_type_id,
    hjt.job_type_key as new_job_type_key,
    hjt.job_type_name as new_job_type_name
  from target_logs tl
  join public.employees e on e.id = tl.employee_uuid
  cross join hairstylist_job_type hjt
  where e.job_type_id is null
)
select count(*) as draft_target_count
from targets;

-- 2. Draft update and history logging.
with target_logs as (
  select l.record_id as employee_uuid
  from public.master_change_logs l
  where l.table_name = 'employees'
    and l.change_payload ->> 'cleanup_id' = 'employee_attribute_position_to_general_staff_20260703'
    and l.change_payload #>> '{old_value,position_name}' = 'スタイリスト'
),
hairstylist_job_type as (
  select id, job_type_key, job_type_name
  from public.job_types
  where job_type_key = 'hairstylist'
    and job_type_name = '美容師'
    and is_active = true
  limit 1
),
targets as (
  select
    e.id,
    e.employee_id,
    e.full_name,
    e.job_type_id as old_job_type_id,
    hjt.id as new_job_type_id,
    hjt.job_type_key as new_job_type_key,
    hjt.job_type_name as new_job_type_name
  from target_logs tl
  join public.employees e on e.id = tl.employee_uuid
  cross join hairstylist_job_type hjt
  where e.job_type_id is null
),
updated_employees as (
  update public.employees e
  set
    job_type_id = t.new_job_type_id,
    updated_at = now()
  from targets t
  where e.id = t.id
    and e.job_type_id is null
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
    'cleanup_id', 'employee_attribute_backfill_job_type_hairstylist_20260703',
    'action', 'employee_attribute.backfill_job_type_from_old_position',
    'source_cleanup_id', 'employee_attribute_position_to_general_staff_20260703',
    'employee_id', t.employee_id,
    'old_value', jsonb_build_object(
      'job_type_id', t.old_job_type_id,
      'job_type_name', null
    ),
    'new_value', jsonb_build_object(
      'job_type_id', t.new_job_type_id,
      'job_type_key', t.new_job_type_key,
      'job_type_name', t.new_job_type_name
    ),
    'reason', '旧position=スタイリストでjob_type_id未設定のため、美容師候補としてbackfillするOS承認待ちドラフト',
    'executed_by', 'm.wakita@idea-nov.com'
  ),
  'employee_attribute.backfill_job_type_from_old_position',
  t.full_name,
  '旧役職スタイリストから職種 美容師 を補完',
  now()
from targets t
join updated_employees ue on ue.id = t.id;

-- 3. OS approved execution.
commit;
