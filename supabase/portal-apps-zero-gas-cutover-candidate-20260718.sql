-- REVIEW ONLY. DO NOT RUN WITHOUT FRESH COREOS PRODUCTION DML APPROVAL.

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
        and category = '教育'
        and priority = 2
    ) as edu_exact_count,
    count(*) filter (
      where app_id = 'THANKS'
        and app_name = 'サンクスコイン'
        and category = '称賛'
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
edu_update as (
  update public.portal_apps as app
  set
    url = './education-app/',
    is_active = true,
    is_featured = true,
    updated_at = clock_timestamp()
  from precondition
  where app.app_id = 'EDU'
    and precondition.guard = 1
    and (
      app.url is distinct from './education-app/'
      or app.is_active is distinct from true
      or app.is_featured is distinct from true
    )
  returning app.app_id, app.url, app.is_active, app.is_featured
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
    and (app.is_active is distinct from false or app.is_featured is distinct from false)
  returning app.app_id, app.url, app.is_active, app.is_featured
),
edu_final as materialized (
  select app_id, url, is_active, is_featured from edu_update
  union all
  select app_id, url, is_active, is_featured
  from locked
  where app_id = 'EDU'
    and url = './education-app/'
    and is_active = true
    and is_featured = true
    and not exists (select 1 from edu_update)
),
thanks_final as materialized (
  select app_id, url, is_active, is_featured from thanks_update
  union all
  select app_id, url, is_active, is_featured
  from locked
  where app_id = 'THANKS'
    and is_active = false
    and is_featured = false
    and not exists (select 1 from thanks_update)
),
final_rows as materialized (
  select app_id, url, is_active, is_featured from edu_final
  union all
  select app_id, url, is_active, is_featured from thanks_final
  union all
  select app_id, url, is_active, is_featured
  from locked
  where app_id = 'idea-link'
),
post_snapshot as materialized (
  select
    count(*) filter (
      where app_id = 'EDU'
        and url = './education-app/'
        and is_active = true
        and is_featured = true
    ) as edu_ready_count,
    count(*) filter (
      where app_id = 'THANKS'
        and is_active = false
        and is_featured = false
    ) as thanks_disabled_count,
    count(*) filter (
      where app_id = 'idea-link'
        and url = './idea-link-app/'
        and is_active = true
        and is_featured = false
    ) as idea_link_unchanged_count
  from final_rows
),
postcondition as materialized (
  select 1 / case
    when edu_ready_count = 1
      and thanks_disabled_count = 1
      and idea_link_unchanged_count = 1
    then 1 else 0
  end as guard
  from post_snapshot
)
select jsonb_build_object(
  'ok', true,
  'safeCode', 'portal_apps_zero_gas_cutover_applied',
  'eduUpdatedCount', (select count(*) from edu_update),
  'thanksUpdatedCount', (select count(*) from thanks_update),
  'ideaLinkUnchanged', true,
  'otherRowsUpdated', false,
  'rawValuesPrinted', false,
  'rollbackExecuted', false
) as sealed_result
from postcondition
where postcondition.guard = 1;

commit;
