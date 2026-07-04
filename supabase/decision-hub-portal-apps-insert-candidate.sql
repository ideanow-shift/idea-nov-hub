-- Decision Hub portal_apps registration candidate
-- Approved: 2026-07-05
-- Purpose: Add safe mock entry for Decision Hub / 決裁・承認.
-- This file performs INSERT only when app_id = 'decision_hub' does not already exist.

begin;

with inserted as (
  insert into public.portal_apps (
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
    priority
  )
  select
    'decision_hub',
    'Decision Hub / 決裁・承認',
    '企画・契約申請の起案、差戻し、承認、通知を確認',
    './decision-hub/',
    '承認・申請',
    'default',
    null,
    1,
    '{}'::text[],
    '{}'::text[],
    '{}'::text[],
    true,
    true,
    15
  where not exists (
    select 1
    from public.portal_apps
    where app_id = 'decision_hub'
  )
  returning *
)
insert into public.master_change_logs (
  table_name,
  record_id,
  changed_by_email,
  change_payload
)
select
  'portal_apps',
  id,
  'm.wakita@idea-nov.com',
  jsonb_build_object(
    'batch_id', 'decision_hub_portal_apps_insert_20260705',
    'action', 'portal_apps.add_decision_hub_safe_mock',
    'app_id', app_id,
    'new_value', jsonb_build_object(
      'app_id', app_id,
      'app_name', app_name,
      'description', description,
      'url', url,
      'category', category,
      'icon', icon,
      'color', color,
      'required_level', required_level,
      'allowed_tags', allowed_tags,
      'target_department', target_department,
      'target_position', target_position,
      'is_active', is_active,
      'is_featured', is_featured,
      'priority', priority
    ),
    'reason', 'Decision Hub P0 企画・契約申請の安全モック導線をHUBに登録',
    'executed_by', 'm.wakita@idea-nov.com'
  )
from inserted;

commit;
