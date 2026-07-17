-- HUB portal_apps display SELECT-only precheck 2026-07-17
--
-- Purpose:
--   Confirm current portal app rows that affect NOV HUB / NOV NAVI display:
--   education URL, thanks coin / IDEA LINK duplication, and master-admin visibility.
--
-- Strict boundary:
--   SELECT only. No DDL, DML, RPC, GRANT, Secret, Edge deploy, or notification.
--   Do not output employee data, tokens, Secrets, or hub_context values.

with target_apps(app_id) as (
  values
    ('education-web'),
    ('EDU'),
    ('THANKS'),
    ('idea-link'),
    ('core-master-admin'),
    ('master-admin'),
    ('jinnjibu'),
    ('human-capital-investment')
),
portal_snapshot as (
  select
    p.app_id,
    p.app_name,
    p.url,
    p.category,
    p.is_active,
    p.is_featured,
    p.priority
  from public.portal_apps p
  where p.app_id in (select app_id from target_apps)
)
select
  app_id,
  app_name,
  url,
  category,
  is_active,
  is_featured,
  priority
from portal_snapshot
order by
  case app_id
    when 'education-web' then 10
    when 'EDU' then 20
    when 'idea-link' then 30
    when 'THANKS' then 40
    when 'core-master-admin' then 50
    when 'master-admin' then 60
    when 'jinnjibu' then 70
    when 'human-capital-investment' then 80
    else 999
  end,
  app_id;

with target_apps(app_id) as (
  values
    ('education-web'),
    ('EDU'),
    ('THANKS'),
    ('idea-link'),
    ('core-master-admin'),
    ('master-admin'),
    ('jinnjibu'),
    ('human-capital-investment')
),
portal_snapshot as (
  select
    p.app_id,
    p.app_name,
    p.url,
    p.category,
    p.is_active
  from public.portal_apps p
  where p.app_id in (select app_id from target_apps)
)
select
  count(*) filter (where app_id in ('education-web', 'EDU')) as education_candidate_count,
  count(*) filter (where app_id in ('idea-link', 'THANKS')) as thanks_candidate_count,
  count(*) filter (where app_id in ('core-master-admin', 'master-admin')) as master_admin_candidate_count,
  bool_or(app_id = 'idea-link' and is_active) as idea_link_active,
  bool_or(app_id = 'THANKS' and is_active) as thanks_active,
  bool_or(app_id in ('core-master-admin', 'master-admin') and is_active) as master_admin_active
from portal_snapshot;
