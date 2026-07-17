-- HUB portal_apps display fix rollback candidate 2026-07-17
--
-- DO NOT RUN WITHOUT CORE DB APPROVAL.
--
-- Purpose:
--   Restore the precheck-observed EDU URL and legacy THANKS visibility.
--
-- Boundary:
--   DML rollback candidate only. No DDL, RLS, GRANT, RPC, Secret, Edge deploy,
--   notification, employee, role, or employee_roles change.

begin;

with edu_restore as (
  update public.portal_apps
  set
    url = 'https://script.google.com/macros/s/AKfycbz8lNSPdcXdii40YamK8hm2HF91emBdAAwXNHf_SPpT32eM3kjFxHfbeXaReHWc2NxC1Q/exec?page=home',
    updated_at = now()
  where app_id = 'EDU'
    and url is distinct from 'https://script.google.com/macros/s/AKfycbz8lNSPdcXdii40YamK8hm2HF91emBdAAwXNHf_SPpT32eM3kjFxHfbeXaReHWc2NxC1Q/exec?page=home'
  returning app_id
),
thanks_restore as (
  update public.portal_apps
  set
    is_active = true,
    is_featured = true,
    updated_at = now()
  where app_id = 'THANKS'
    and (is_active is distinct from true or is_featured is distinct from true)
  returning app_id
)
select
  (select count(*) from edu_restore) as edu_url_restored_count,
  (select count(*) from thanks_restore) as thanks_restored_count;

commit;
