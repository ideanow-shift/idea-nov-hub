-- Decision Hub portal_apps rollback candidate
-- Rollback policy: do not DELETE. Disable the card safely.
-- Execute only after explicit approval.

begin;

with target as (
  select *
  from public.portal_apps
  where app_id = 'decision_hub'
    and app_name = 'Decision Hub / 決裁・承認'
), updated as (
  update public.portal_apps app
  set
    is_active = false,
    is_featured = false,
    updated_at = now()
  from target
  where app.id = target.id
    and app.app_id = 'decision_hub'
  returning
    app.*,
    target.is_active as old_is_active,
    target.is_featured as old_is_featured
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
    'batch_id', 'decision_hub_portal_apps_disable_rollback_20260705',
    'action', 'portal_apps.disable_decision_hub_safe_mock',
    'app_id', app_id,
    'old_value', jsonb_build_object(
      'is_active', old_is_active,
      'is_featured', old_is_featured
    ),
    'new_value', jsonb_build_object(
      'is_active', is_active,
      'is_featured', is_featured
    ),
    'reason', 'Decision Hubカードの安全な無効化rollback。物理DELETEは行わない。',
    'executed_by', 'm.wakita@idea-nov.com'
  )
from updated;

commit;
