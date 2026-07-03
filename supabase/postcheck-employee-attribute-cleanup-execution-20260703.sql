-- Post-check after OS-approved execution. No data changes.

with old_stylist as (
  select l.record_id as employee_uuid
  from public.master_change_logs l
  where l.table_name = 'employees'
    and l.change_payload ->> 'cleanup_id' = 'employee_attribute_position_to_general_staff_20260703'
    and l.change_payload #>> '{old_value,position_name}' = 'スタイリスト'
),
old_stylist_counts as (
  select
    coalesce(jt.job_type_name, 'NULL') as job_type_name,
    count(*)::int as employee_count
  from old_stylist os
  join public.employees e on e.id = os.employee_uuid
  left join public.job_types jt on jt.id = e.job_type_id
  group by coalesce(jt.job_type_name, 'NULL')
),
target_position_counts as (
  select
    p.position_name,
    p.is_active,
    count(e.id)::int as employee_count
  from public.positions p
  left join public.employees e on e.position_id = p.id
  where p.position_name in ('SD', 'チーフ', '店長', '副店長', '本部スタッフ')
  group by p.position_name, p.is_active
),
log_counts as (
  select
    l.change_payload ->> 'cleanup_id' as cleanup_id,
    count(*)::int as log_count
  from public.master_change_logs l
  where l.change_payload ->> 'cleanup_id' in (
    'employee_attribute_backfill_job_type_hairstylist_20260703',
    'employee_attribute_normalize_sd_chief_positions_20260703',
    'employee_attribute_deactivate_sd_chief_positions_20260703'
  )
  group by l.change_payload ->> 'cleanup_id'
)
select
  'old_stylist_job_type_counts' as section,
  job_type_name as label,
  employee_count::text as value
from old_stylist_counts
union all
select
  'position_counts',
  position_name,
  'active=' || is_active::text || ', employees=' || employee_count::text
from target_position_counts
union all
select
  'master_change_logs',
  cleanup_id,
  log_count::text
from log_counts
order by section, label;
