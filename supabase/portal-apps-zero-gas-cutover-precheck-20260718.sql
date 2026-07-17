-- SELECT ONLY. Production evidence must be reviewed before any DML approval.

select jsonb_build_object(
  'ok', true,
  'safeCode', 'portal_apps_zero_gas_precheck',
  'targetCount', count(*),
  'eduCount', count(*) filter (where app_id = 'EDU'),
  'thanksCount', count(*) filter (where app_id = 'THANKS'),
  'ideaLinkCount', count(*) filter (where app_id = 'idea-link'),
  'eduRouteKind', coalesce(max(case
    when app_id = 'EDU' and url = './education-app/' then 'local_relative'
    when app_id = 'EDU' and url like './%' then 'other_relative'
    when app_id = 'EDU' then 'external_or_other'
  end), 'missing'),
  'eduActive', coalesce(bool_and(is_active) filter (where app_id = 'EDU'), false),
  'eduFeatured', coalesce(bool_and(is_featured) filter (where app_id = 'EDU'), false),
  'thanksDisabled', coalesce(bool_and(not is_active and not is_featured)
    filter (where app_id = 'THANKS'), false),
  'rawUrlPrinted', false
) as precheck_result
from public.portal_apps
where app_id in ('EDU', 'THANKS', 'idea-link');
