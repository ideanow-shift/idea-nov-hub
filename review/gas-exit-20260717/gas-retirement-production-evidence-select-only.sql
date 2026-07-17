-- REVIEW ONLY. SELECT-only evidence for the HUB GAS retirement gate.
-- Do not modify portal_apps or any production object from this file.

begin;
set transaction read only;

select
  app_id,
  app_name,
  category,
  url,
  is_active,
  is_featured,
  priority,
  updated_at
from public.portal_apps
where app_id in ('education-web', 'EDU', 'idea-link', 'idea_link')
   or lower(coalesce(url, '')) like '%script.google.com%'
order by priority nulls last, app_id;

select
  count(*) filter (where lower(coalesce(url, '')) like '%script.google.com%') as active_gas_url_count,
  count(*) filter (where app_id in ('education-web', 'EDU')) as education_row_count,
  count(*) filter (where app_id in ('idea-link', 'idea_link')) as idea_link_row_count
from public.portal_apps
where is_active is true;

rollback;
