-- NOV Navi is hosted under /concierge/ for compatibility.
-- Visible naming should use NOV Navi / NOV Navigator, not the old display name.

insert into public.portal_apps (
  app_id,
  app_name,
  description,
  url,
  category,
  icon,
  required_level,
  allowed_tags,
  target_department,
  target_position,
  is_active,
  is_featured,
  priority
) values (
  'nov-navi',
  'NOV Navi',
  '必要な情報、申請、アプリへ案内します',
  './concierge/',
  '全般',
  'nov-hub',
  1,
  array[]::text[],
  array[]::text[],
  array[]::text[],
  true,
  true,
  6
)
on conflict (app_id) do update
set app_name = excluded.app_name,
    description = excluded.description,
    url = excluded.url,
    category = excluded.category,
    icon = excluded.icon,
    required_level = excluded.required_level,
    allowed_tags = excluded.allowed_tags,
    target_department = excluded.target_department,
    target_position = excluded.target_position,
    is_active = excluded.is_active,
    is_featured = excluded.is_featured,
    priority = excluded.priority,
    updated_at = now();
