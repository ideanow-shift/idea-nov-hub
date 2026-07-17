-- SEALED rollback candidate for HUB portal_apps display fix 2026-07-17
-- PREPARED ONLY. Never run automatically. A separate approval is required.

begin;

set local statement_timeout = '15s';
set local lock_timeout = '5s';
set local idle_in_transaction_session_timeout = '20s';

with locked as materialized (
  select app_id, app_name, url, category, is_active, is_featured, priority
  from public.portal_apps
  where app_id in ('EDU', 'THANKS', 'idea-link')
  for update
),
snapshot as materialized (
  select
    count(*) as target_count,
    count(*) filter (
      where app_id = 'EDU'
        and app_name = 'IDEANOV EDU'
        and url = 'https://script.google.com/macros/s/AKfycbxKLThF4TN18-OwaOFKbqwoPPSAHB7HH4v3_IkTXEmAGrhDJyzS1GfkfC1GFGiA7vUZew/exec?page=home'
        and category = '教育'
        and is_active = true
        and is_featured = true
        and priority = 2
    ) as edu_exact_count,
    count(*) filter (
      where app_id = 'THANKS'
        and app_name = 'サンクスコイン'
        and category = '称賛'
        and is_active = false
        and is_featured = false
        and priority = 1
    ) as thanks_exact_count,
    count(*) filter (
      where app_id = 'idea-link'
        and app_name = 'IDEA LINK'
        and url = './idea-link-app/'
        and category = '称賛'
        and is_active = true
        and is_featured = false
        and priority = 88
    ) as idea_link_exact_count
  from locked
),
precondition as materialized (
  select 1 / case
    when target_count = 3
      and edu_exact_count = 1
      and thanks_exact_count = 1
      and idea_link_exact_count = 1
    then 1 else 0
  end as guard
  from snapshot
),
edu_restore as (
  update public.portal_apps as app
  set
    url = 'https://script.google.com/macros/s/AKfycbz8lNSPdcXdii40YamK8hm2HF91emBdAAwXNHf_SPpT32eM3kjFxHfbeXaReHWc2NxC1Q/exec?page=home',
    updated_at = clock_timestamp()
  from precondition
  where app.app_id = 'EDU' and precondition.guard = 1
  returning app.app_id
),
thanks_restore as (
  update public.portal_apps as app
  set is_active = true, is_featured = true, updated_at = clock_timestamp()
  from precondition
  where app.app_id = 'THANKS' and precondition.guard = 1
  returning app.app_id
),
counts as materialized (
  select
    (select count(*) from edu_restore) as edu_count,
    (select count(*) from thanks_restore) as thanks_count
),
postcondition as materialized (
  select 1 / case
    when edu_count = 1 and thanks_count = 1 and edu_count + thanks_count = 2
    then 1 else 0
  end as guard
  from counts
)
select jsonb_build_object(
  'ok', true,
  'safeCode', 'portal_apps_display_fix_rollback_applied',
  'eduRestoredCount', counts.edu_count,
  'thanksRestoredCount', counts.thanks_count,
  'totalUpdatedCount', counts.edu_count + counts.thanks_count,
  'rawValuesPrinted', false
) as sealed_result
from counts
cross join postcondition
where postcondition.guard = 1;

commit;
