-- HUB Core master read-only checks.
-- Date: 2026-07-03
-- Purpose: SELECT preview only. Do not run INSERT / UPDATE / DELETE from this file.

-- 1. Formal departments / positions / job_types snapshot.
select
  'departments_active' as check_name,
  department_no as sort_no,
  department_code as code,
  department_name as name,
  is_active
from public.departments
order by department_no nulls last, department_name;

select
  'positions_active' as check_name,
  position_no as sort_no,
  null::text as code,
  position_name as name,
  is_active
from public.positions
order by position_no nulls last, position_name;

select
  'job_types_active' as check_name,
  sort_order::text as sort_no,
  job_type_key as code,
  job_type_name as name,
  is_active
from public.job_types
order by sort_order nulls last, job_type_name;

-- 2. Missing formal positions.
with formal_positions(position_name, sort_order) as (
  values
    ('相談役', 1),
    ('会長', 2),
    ('社長', 3),
    ('副社長', 4),
    ('取締役', 5),
    ('執行役員', 6),
    ('部長', 7),
    ('課長', 8),
    ('係長', 9),
    ('エリアマネージャー', 10),
    ('店長', 11),
    ('店長見習い', 12),
    ('副店長', 13),
    ('FCオーナー', 14),
    ('FCオーナー見習い', 15),
    ('一般スタッフ', 16)
)
select
  f.sort_order,
  f.position_name,
  p.id,
  p.position_no,
  p.is_active
from formal_positions f
left join public.positions p
  on p.position_name = f.position_name
where p.id is null
   or p.is_active is not true
order by f.sort_order;

-- 3. Active non-formal positions and employee references.
with formal_positions(position_name) as (
  values
    ('相談役'),
    ('会長'),
    ('社長'),
    ('副社長'),
    ('取締役'),
    ('執行役員'),
    ('部長'),
    ('課長'),
    ('係長'),
    ('エリアマネージャー'),
    ('店長'),
    ('店長見習い'),
    ('副店長'),
    ('FCオーナー'),
    ('FCオーナー見習い'),
    ('一般スタッフ')
)
select
  p.id as position_id,
  p.position_no,
  p.position_name,
  p.is_active,
  count(e.id)::int as employee_count
from public.positions p
left join formal_positions f
  on f.position_name = p.position_name
left join public.employees e
  on e.position_id = p.id
where p.is_active is true
  and f.position_name is null
group by p.id, p.position_no, p.position_name, p.is_active
order by employee_count desc, p.position_no;

-- 4. Forbidden family/honorific labels should not be active anywhere.
with forbidden_labels(label_name) as (
  values
    ('会長夫人'),
    ('創業者夫人'),
    ('夫人')
)
select
  'departments' as table_name,
  d.id::text as record_id,
  d.department_name as label_name,
  d.is_active,
  0::int as employee_count
from public.departments d
join forbidden_labels f on f.label_name = d.department_name
where d.is_active is true
union all
select
  'positions',
  p.id::text,
  p.position_name,
  p.is_active,
  count(e.id)::int
from public.positions p
join forbidden_labels f on f.label_name = p.position_name
left join public.employees e on e.position_id = p.id
where p.is_active is true
group by p.id, p.position_name, p.is_active
union all
select
  'job_types',
  jt.id::text,
  jt.job_type_name,
  jt.is_active,
  0::int
from public.job_types jt
join forbidden_labels f on f.label_name = jt.job_type_name
where jt.is_active is true
order by table_name, label_name;

-- 5. Remaining employees without job_type_id.
select
  e.id as employee_id,
  e.employee_id as employee_number,
  e.full_name,
  p.position_name,
  jt.job_type_name,
  s.store_name,
  d.department_name,
  e.employment_type,
  e.employment_status,
  e.leave_type
from public.employees e
left join public.positions p on p.id = e.position_id
left join public.job_types jt on jt.id = e.job_type_id
left join public.stores s on s.id = e.store_id
left join public.departments d on d.id = e.department_id
where e.job_type_id is null
  and coalesce(e.employment_status, '') <> '退職'
order by e.employee_id nulls last, e.full_name
limit 300;

-- 6. Master change log counts for recent employee attribute cleanup batches.
select
  l.change_payload ->> 'cleanup_id' as cleanup_id,
  l.table_name,
  l.action_type,
  count(*)::int as log_count,
  min(l.changed_at) as first_changed_at,
  max(l.changed_at) as last_changed_at
from public.master_change_logs l
where l.change_payload ->> 'cleanup_id' in (
  'employee_attribute_required_positions_20260703',
  'employee_attribute_cleanup_job_type_positions_20260703',
  'employee_attribute_position_to_general_staff_20260703',
  'employee_attribute_deactivate_job_type_positions_20260703',
  'employee_attribute_backfill_job_type_hairstylist_20260703',
  'employee_attribute_normalize_sd_chief_positions_20260703',
  'employee_attribute_deactivate_sd_chief_positions_20260703'
)
group by l.change_payload ->> 'cleanup_id', l.table_name, l.action_type
order by cleanup_id, table_name, action_type;

-- 7. portal_apps snapshot for Core master management.
select
  app_id,
  app_name,
  category,
  url,
  required_level,
  allowed_tags,
  target_department,
  target_position,
  is_active,
  is_featured,
  priority
from public.portal_apps
order by priority nulls last, app_name;

