-- SEALED HUB portal_apps display fix 2026-07-17
-- Production DML. A fresh explicit approval is required before execution.

begin;

set local statement_timeout = '15s';
set local lock_timeout = '5s';
set local idle_in_transaction_session_timeout = '20s';

with locked as materialized (
  select
    app_id,
    app_name,
    url,
    category,
    is_active,
    is_featured,
    priority
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
        and url = 'https://script.google.com/macros/s/AKfycbz8lNSPdcXdii40YamK8hm2HF91emBdAAwXNHf_SPpT32eM3kjFxHfbeXaReHWc2NxC1Q/exec?page=home'
        and category = '教育'
        and is_active = true
        and is_featured = true
        and priority = 2
    ) as edu_exact_count,
    count(*) filter (
      where app_id = 'THANKS'
        and app_name = 'サンクスコイン'
        and url = 'https://script.google.com/a/macros/idea-nov.com/s/AKfycbz3tmMUSvKEVZgmf8w-pKLk_H6_fXdltkwrHF5VIfpItufu41xoCa1f3-1aE0w3fJpucw/exec'
        and category = '称賛'
        and is_active = true
        and is_featured = true
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
  select
    1 / case
      when target_count = 3
        and edu_exact_count = 1
        and thanks_exact_count = 1
        and idea_link_exact_count = 1
      then 1 else 0
    end as guard
  from snapshot
),
edu_update as (
  update public.portal_apps as app
  set
    url = 'https://script.google.com/macros/s/AKfycbxKLThF4TN18-OwaOFKbqwoPPSAHB7HH4v3_IkTXEmAGrhDJyzS1GfkfC1GFGiA7vUZew/exec?page=home',
    updated_at = clock_timestamp()
  from precondition
  where app.app_id = 'EDU'
    and precondition.guard = 1
  returning app.app_id, app.url, app.is_active, app.is_featured, app.priority
),
thanks_update as (
  update public.portal_apps as app
  set
    is_active = false,
    is_featured = false,
    updated_at = clock_timestamp()
  from precondition
  where app.app_id = 'THANKS'
    and precondition.guard = 1
  returning app.app_id, app.url, app.is_active, app.is_featured, app.priority
),
sealed_result as materialized (
  select
    (select count(*) from edu_update) as edu_updated_count,
    (select count(*) from thanks_update) as thanks_updated_count,
    coalesce((select bool_and(
      app_id = 'EDU'
      and url = 'https://script.google.com/macros/s/AKfycbxKLThF4TN18-OwaOFKbqwoPPSAHB7HH4v3_IkTXEmAGrhDJyzS1GfkfC1GFGiA7vUZew/exec?page=home'
      and is_active = true
      and is_featured = true
      and priority = 2
    ) from edu_update), false) as edu_postcondition,
    coalesce((select bool_and(
      app_id = 'THANKS'
      and is_active = false
      and is_featured = false
      and priority = 1
    ) from thanks_update), false) as thanks_postcondition,
    (select idea_link_exact_count = 1 from snapshot) as idea_link_unchanged
),
postcondition as materialized (
  select
    1 / case
      when edu_updated_count = 1
        and thanks_updated_count = 1
        and edu_updated_count + thanks_updated_count = 2
        and edu_postcondition
        and thanks_postcondition
        and idea_link_unchanged
      then 1 else 0
    end as guard
  from sealed_result
)
select jsonb_build_object(
  'ok', true,
  'safeCode', 'portal_apps_display_fix_applied',
  'eduUpdatedCount', sealed_result.edu_updated_count,
  'thanksUpdatedCount', sealed_result.thanks_updated_count,
  'totalUpdatedCount', sealed_result.edu_updated_count + sealed_result.thanks_updated_count,
  'ideaLinkUnchanged', sealed_result.idea_link_unchanged,
  'otherRowsUpdated', false,
  'rawValuesPrinted', false,
  'rollbackExecuted', false
) as sealed_result
from sealed_result
cross join postcondition
where postcondition.guard = 1;

commit;
