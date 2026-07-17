insert into public.portal_apps (
  app_id, app_name, description, url, category, icon,
  is_active, is_featured, priority, created_at, updated_at
) values
  (
    'EDU', 'IDEANOV EDU', 'synthetic education row',
    'https://script.google.com/macros/s/AKfycbz8lNSPdcXdii40YamK8hm2HF91emBdAAwXNHf_SPpT32eM3kjFxHfbeXaReHWc2NxC1Q/exec?page=home',
    '教育', 'education', true, true, 2,
    '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z'
  ),
  (
    'THANKS', 'サンクスコイン', 'synthetic legacy thanks row',
    'https://script.google.com/a/macros/idea-nov.com/s/AKfycbz3tmMUSvKEVZgmf8w-pKLk_H6_fXdltkwrHF5VIfpItufu41xoCa1f3-1aE0w3fJpucw/exec',
    '称賛', 'thanks', true, true, 1,
    '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z'
  ),
  (
    'idea-link', 'IDEA LINK', 'synthetic current thanks row',
    './idea-link-app/', '称賛', 'idea-link', true, false, 88,
    '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z'
  ),
  (
    'control-app', 'synthetic control', 'must remain unchanged',
    'https://local.invalid/control', 'synthetic', 'control', true, false, 500,
    '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z'
  );
