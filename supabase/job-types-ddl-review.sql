-- REVIEW NOTE: Core DB employee attribute taxonomy / job types.
-- Stage 1 additive DDL has been separated into:
--   supabase/job-types-stage1.sql
--
-- Current policy:
-- - departments: organization
-- - positions: title / managerial position
-- - job_types: work classification for shift, labor cost, hiring, education
-- - employees.employment_type: employment contract type
-- - employees.employment_status: work status
-- - employees.leave_type: leave reason/type
-- - roles / employee_roles: permissions only
--
-- Do not execute bulk updates from this review file.
-- Backfill must be reviewed separately and should write master_change_logs.

-- Stage 1 already covers:
-- - public.job_types
-- - public.employees.job_type_id
-- - initial job types:
--   美容師 / レセプション / カラーリスト / 本部スタッフ / その他

-- Backfill candidates, review before applying:
--
-- 1. employment_type = 'レセプションパート'
--    -> employment_type = 'パート・アルバイト'
--    -> job_type = 'レセプション'
--
-- 2. employment_type = 'パート'
--    -> employment_type = 'パート・アルバイト'
--
-- 3. employment_status = '産休・育休'
--    -> employment_status = '休職'
--    -> leave_type requires HR confirmation.
--       Do not decide automatically between 産休 and 育休.
--       If temporary normalization is needed, leave_type should remain null or be set to その他 after approval.
--
-- 4. positions containing job-like values:
--    アシスタント / スタイリスト / レセプション / 本部スタッフ
--    Do not delete now.
--    After employees.job_type_id is populated and no active dependency remains,
--    hide from normal position choices with is_active = false.

-- Inspection queries:

select
  'employment_type_mixed' as check_name,
  employment_type as value,
  count(*) as count
from public.employees
where employment_type in ('パート', 'アルバイト', 'レセプション', 'レセプションパート')
group by employment_type
order by employment_type;

select
  'employment_status_leave_like' as check_name,
  employment_status as value,
  count(*) as count
from public.employees
where employment_status in ('産休', '育休', '産休・育休', '傷病', '介護')
group by employment_status
order by employment_status;

select
  'positions_job_like' as check_name,
  position_name as value,
  count(*) as count
from public.positions
where position_name in ('アシスタント', 'スタイリスト', 'レセプション', '本部スタッフ', '美容師', 'カラーリスト')
group by position_name
order by position_name;
