update public.portal_apps
set
  url = 'https://ideanow-shift.github.io/idea-nov-expense-hub/',
  updated_at = now()
where app_id = 'expense-hub';
