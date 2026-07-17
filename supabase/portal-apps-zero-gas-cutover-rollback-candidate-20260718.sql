-- PREPARED ONLY. Never run automatically. Separate approval is required.
-- This rollback disables EDU. It never restores an external legacy URL.

begin;

set local statement_timeout = '15s';
set local lock_timeout = '5s';
set local idle_in_transaction_session_timeout = '20s';

with locked as materialized (
  select app_id, url, is_active, is_featured
  from public.portal_apps
  where app_id in ('EDU', 'THANKS', 'idea-link')
  for update
),
precondition as materialized (
  select 1 / case
    when count(*) = 3
      and count(*) filter (
        where app_id = 'EDU' and url = './education-app/'
      ) = 1
      and count(*) filter (
        where app_id = 'THANKS' and is_active = false and is_featured = false
      ) = 1
      and count(*) filter (
        where app_id = 'idea-link' and url = './idea-link-app/'
      ) = 1
    then 1 else 0
  end as guard
  from locked
),
edu_disable as (
  update public.portal_apps as app
  set
    is_active = false,
    is_featured = false,
    updated_at = clock_timestamp()
  from precondition
  where app.app_id = 'EDU'
    and precondition.guard = 1
    and (app.is_active is distinct from false or app.is_featured is distinct from false)
  returning app.app_id, app.url, app.is_active, app.is_featured
),
edu_final as materialized (
  select app_id, url, is_active, is_featured from edu_disable
  union all
  select app_id, url, is_active, is_featured
  from locked
  where app_id = 'EDU'
    and url = './education-app/'
    and is_active = false
    and is_featured = false
    and not exists (select 1 from edu_disable)
),
postcondition as materialized (
  select 1 / case
    when count(*) filter (
      where app_id = 'EDU'
        and url = './education-app/'
        and is_active = false
        and is_featured = false
    ) = 1
    then 1 else 0
  end as guard
  from edu_final
)
select jsonb_build_object(
  'ok', true,
  'safeCode', 'portal_apps_zero_gas_edu_disabled',
  'eduDisabledCount', (select count(*) from edu_disable),
  'legacyUrlRestored', false,
  'rawValuesPrinted', false
) as rollback_result
from postcondition
where postcondition.guard = 1;

commit;
