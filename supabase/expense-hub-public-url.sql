-- NOV HUB portal card for the Finance Module expense system.
-- Keep the internal app key as expense_hub.

update public.portal_apps
set app_id = 'expense_hub'
where app_id = 'expense-hub'
  and not exists (
    select 1
    from public.portal_apps existing
    where existing.app_id = 'expense_hub'
  );

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
)
values (
  'expense_hub',
  '経費精算管理システム',
  '経費明細登録・月次精算・経理確認・弥生会計CSV出力',
  'https://ideanow-shift.github.io/idea-nov-expense-hub/',
  'Finance Module',
  'expense-hub',
  1,
  '{}'::text[],
  '{}'::text[],
  '{}'::text[],
  true,
  false,
  66
)
on conflict (app_id) do update
set
  app_name = excluded.app_name,
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

update public.portal_apps
set
  is_active = false,
  updated_at = now()
where app_id = 'expense-hub';
