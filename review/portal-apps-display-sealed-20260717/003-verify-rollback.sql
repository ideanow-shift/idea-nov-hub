select concat_ws('|',
  count(*)::int,
  count(*) filter (
    where app_id = 'EDU'
      and url = 'https://script.google.com/macros/s/AKfycbz8lNSPdcXdii40YamK8hm2HF91emBdAAwXNHf_SPpT32eM3kjFxHfbeXaReHWc2NxC1Q/exec?page=home'
      and is_active and is_featured and priority = 2
  )::int,
  count(*) filter (
    where app_id = 'THANKS'
      and is_active and is_featured and priority = 1
  )::int,
  count(*) filter (
    where app_id = 'idea-link'
      and updated_at = '2026-01-01T00:00:00Z'::timestamptz
  )::int,
  count(*) filter (
    where app_id = 'control-app'
      and updated_at = '2026-01-01T00:00:00Z'::timestamptz
  )::int
)
from public.portal_apps;
