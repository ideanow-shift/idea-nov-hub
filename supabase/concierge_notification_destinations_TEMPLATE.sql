-- NOV Navi -> OS Notification Engine destination template
-- Replace channel_id / channel_name values before running.
-- LINE WORKS secrets and access tokens must stay in backend environment variables.

create schema if not exists os;

with rows(provider, target_type, target_id, channel_id, channel_name, purpose, is_active) as (
  values
    ('line_works', 'global', null::uuid, 'REPLACE_HR_LINE_WORKS_CHANNEL_ID', 'NOV Navi 総務人事問い合わせ', 'concierge_hr', true),
    ('line_works', 'global', null::uuid, 'REPLACE_ACCOUNTING_LINE_WORKS_CHANNEL_ID', 'NOV Navi 経理問い合わせ', 'concierge_accounting', true),
    ('line_works', 'global', null::uuid, 'REPLACE_EDUCATION_LINE_WORKS_CHANNEL_ID', 'NOV Navi 教育問い合わせ', 'concierge_education', true),
    ('line_works', 'global', null::uuid, 'REPLACE_SALES_LINE_WORKS_CHANNEL_ID', 'NOV Navi 営業問い合わせ', 'concierge_sales', true),
    ('line_works', 'global', null::uuid, 'REPLACE_FC_LINE_WORKS_CHANNEL_ID', 'NOV Navi FC問い合わせ', 'concierge_fc', true),
    ('line_works', 'global', null::uuid, 'REPLACE_SYSTEM_LINE_WORKS_CHANNEL_ID', 'NOV Navi システム問い合わせ', 'concierge_system', true)
),
updated as (
  update os.notification_destinations destination
  set
    channel_id = rows.channel_id,
    channel_name = rows.channel_name,
    is_active = rows.is_active,
    updated_at = now()
  from rows
  where destination.provider = rows.provider
    and destination.target_type = rows.target_type
    and destination.target_id is not distinct from rows.target_id
    and destination.purpose = rows.purpose
  returning destination.provider, destination.target_type, destination.target_id, destination.purpose
)
insert into os.notification_destinations
  (provider, target_type, target_id, channel_id, channel_name, purpose, is_active)
select rows.provider, rows.target_type, rows.target_id, rows.channel_id, rows.channel_name, rows.purpose, rows.is_active
from rows
where not exists (
  select 1
  from updated
  where updated.provider = rows.provider
    and updated.target_type = rows.target_type
    and updated.target_id is not distinct from rows.target_id
    and updated.purpose = rows.purpose
);
