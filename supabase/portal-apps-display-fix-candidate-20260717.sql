-- HUB portal_apps display fix DML candidate 2026-07-17
--
-- DO NOT RUN WITHOUT CORE DB APPROVAL.
--
-- Purpose:
--   1. Update the EDU card to the current education GAS URL.
--   2. Stop the legacy THANKS GAS card from appearing beside the current
--      idea-link / サンクスコイン card.
--
-- Boundary:
--   DML candidate only. No DDL, RLS, GRANT, RPC, Secret, Edge deploy,
--   notification, employee, role, or employee_roles change.

begin;

with edu_update as (
  update public.portal_apps
  set
    url = 'https://script.google.com/macros/s/AKfycbxKLThF4TN18-OwaOFKbqwoPPSAHB7HH4v3_IkTXEmAGrhDJyzS1GfkfC1GFGiA7vUZew/exec?page=home',
    updated_at = now()
  where app_id = 'EDU'
    and url is distinct from 'https://script.google.com/macros/s/AKfycbxKLThF4TN18-OwaOFKbqwoPPSAHB7HH4v3_IkTXEmAGrhDJyzS1GfkfC1GFGiA7vUZew/exec?page=home'
  returning app_id
),
thanks_disable as (
  update public.portal_apps
  set
    is_active = false,
    is_featured = false,
    updated_at = now()
  where app_id = 'THANKS'
    and (is_active is distinct from false or is_featured is distinct from false)
  returning app_id
)
select
  (select count(*) from edu_update) as edu_url_updated_count,
  (select count(*) from thanks_disable) as thanks_disabled_count;

commit;

-- Required post-check after approved execution:
--
-- select app_id, app_name, url, category, is_active, is_featured, priority
-- from public.portal_apps
-- where app_id in ('EDU', 'THANKS', 'idea-link')
-- order by app_id;
