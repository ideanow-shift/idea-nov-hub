select concat_ws('|',
  count(*)::int,
  count(*) filter (
    where app_id = 'EDU'
      and url = 'https://script.google.com/macros/s/AKfycbxKLThF4TN18-OwaOFKbqwoPPSAHB7HH4v3_IkTXEmAGrhDJyzS1GfkfC1GFGiA7vUZew/exec?page=home'
      and is_active and is_featured and priority = 2
  )::int,
  count(*) filter (
    where app_id = 'THANKS'
      and not is_active and not is_featured and priority = 1
  )::int,
  count(*) filter (
    where app_id = 'idea-link'
      and url = './idea-link-app/'
      and is_active and not is_featured and priority = 88
      and updated_at = '2026-01-01T00:00:00Z'::timestamptz
  )::int,
  count(*) filter (
    where app_id = 'control-app'
      and updated_at = '2026-01-01T00:00:00Z'::timestamptz
  )::int
)
from public.portal_apps;
