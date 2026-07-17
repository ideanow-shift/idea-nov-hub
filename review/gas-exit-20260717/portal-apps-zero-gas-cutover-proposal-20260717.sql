-- REVIEW ONLY. DO NOT RUN.
-- Zero-GAS portal_apps cutover proposal 2026-07-17.
-- Production DML requires a separate CoreOS approval and fresh SELECT precheck.

-- Precheck (SELECT only)
select app_id, app_name, url, category, is_active, is_featured, priority
from public.portal_apps
where app_id in ('EDU', 'THANKS', 'idea-link')
order by app_id;

-- Forward candidate (DO NOT RUN)
begin;

with edu_cutover as (
  update public.portal_apps
  set
    url = './education-app/',
    is_active = true,
    is_featured = true,
    updated_at = now()
  where app_id = 'EDU'
    and (
      url is distinct from './education-app/'
      or is_active is distinct from true
      or is_featured is distinct from true
    )
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
  (select count(*) from edu_cutover) as edu_cutover_count,
  (select count(*) from thanks_disable) as thanks_disabled_count;

commit;

-- Post-check (SELECT only)
select app_id, app_name, url, category, is_active, is_featured, priority
from public.portal_apps
where app_id in ('EDU', 'THANKS', 'idea-link')
order by app_id;

-- Safe rollback candidate (DO NOT RUN)
-- This rollback never restores a GAS URL. It hides EDU if the new Pages route
-- is unavailable and keeps the legacy THANKS card disabled.
begin;

update public.portal_apps
set
  is_active = false,
  is_featured = false,
  updated_at = now()
where app_id = 'EDU'
  and url = './education-app/'
  and (is_active is distinct from false or is_featured is distinct from false);

commit;
