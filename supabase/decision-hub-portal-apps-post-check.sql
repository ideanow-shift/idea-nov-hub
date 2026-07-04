-- Decision Hub portal_apps post-check
-- SELECT only.

select
  id,
  app_id,
  app_name,
  description,
  url,
  category,
  icon,
  color,
  required_level,
  allowed_tags,
  target_department,
  target_position,
  is_active,
  is_featured,
  priority,
  created_at,
  updated_at
from public.portal_apps
where app_id = 'decision_hub';

select
  count(*) as decision_hub_rows
from public.portal_apps
where app_id = 'decision_hub';

select
  count(*) as decision_hub_insert_log_rows
from public.master_change_logs
where table_name = 'portal_apps'
  and change_payload ->> 'batch_id' = 'decision_hub_portal_apps_insert_20260705';

select
  app_id,
  app_name,
  category,
  is_active,
  is_featured,
  priority
from public.portal_apps
where is_active = true
order by priority asc, app_name asc;
