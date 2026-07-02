-- DDL REVIEW DRAFT: Core DB employee attribute taxonomy.
-- Do not apply before Core DB / IDEA NOV OS review approval.
-- Purpose:
-- - departments: organization
-- - positions: title / managerial position
-- - job_types: work classification for shift, labor cost, hiring, education
-- - employees.employment_type: employment contract type
-- - employees.employment_status: work status
-- - employees.leave_type: leave reason/type
-- - roles / employee_roles: permissions only

create table if not exists public.job_types (
  id uuid primary key default gen_random_uuid(),
  job_type_no text unique,
  job_type_key text unique,
  job_type_name text not null unique,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.job_types enable row level security;

grant select, insert, update on table public.job_types to service_role;

alter table public.employees
  add column if not exists job_type_id uuid references public.job_types(id);

create index if not exists idx_employees_job_type_id
  on public.employees (job_type_id);

insert into public.job_types (job_type_no, job_type_key, job_type_name, description, is_active)
values
  ('0001', 'beautician', '美容師', '美容師・スタイリスト・アシスタントなどの美容技術職', true),
  ('0002', 'reception', 'レセプション', '受付・レセプション職', true),
  ('0003', 'colorist', 'カラーリスト', 'カラー専門職', true),
  ('0004', 'headquarters_staff', '本部スタッフ', '本部・バックオフィス職', true),
  ('9999', 'other', 'その他', 'その他職種', true)
on conflict (job_type_name) do update
set
  job_type_no = excluded.job_type_no,
  job_type_key = excluded.job_type_key,
  description = excluded.description,
  is_active = excluded.is_active,
  updated_at = now();

-- Candidate department normalization. Existing rows are kept; missing names are inserted only.
insert into public.departments (department_no, department_code, department_name, is_active)
values
  ('0001', 'board', '取締役会', true),
  ('0002', 'sales', '営業部', true),
  ('0003', 'education', '教育部', true),
  ('0004', 'ec', 'EC事業部', true),
  ('0005', 'hr_admin', '総務人事部', true),
  ('0006', 'accounting', '経理部', true),
  ('0007', 'color_specialty', 'カラー専門店事業部', true),
  ('0008', 'it_system', '情報システム', true),
  ('0009', 'corporate_planning', '経営企画', true),
  ('0010', 'marketing_pr', 'マーケティング・広報', true)
on conflict (department_name) do update
set
  department_code = excluded.department_code,
  is_active = true;

-- Candidate position normalization. Job types such as レセプション/美容師 are intentionally not inserted here.
insert into public.positions (position_no, position_name, is_active)
values
  ('0001', '相談役', true),
  ('0002', '会長', true),
  ('0003', '社長', true),
  ('0004', '副社長', true),
  ('0005', '取締役', true),
  ('0006', '執行役員', true),
  ('0007', '部長', true),
  ('0008', '課長', true),
  ('0009', '係長', true),
  ('0010', 'エリアマネージャー', true),
  ('0011', '店長', true),
  ('0012', '店長見習い', true),
  ('0013', '副店長', true),
  ('0014', 'FCオーナー', true),
  ('0015', 'FCオーナー見習い', true),
  ('0016', '一般スタッフ', true)
on conflict (position_name) do update
set
  position_no = excluded.position_no,
  is_active = true;

-- If レセプション was previously created as a position, stop showing it as an active title.
update public.positions
set is_active = false, updated_at = now()
where position_name in ('レセプション', '美容師', 'カラーリスト', '本部スタッフ')
  and is_active is distinct from false;

-- Data normalization after approval.
update public.employees
set employment_type = 'パート・アルバイト', updated_at = now()
where employment_type in ('パート', 'アルバイト', 'レセプション', 'レセプションパート');

update public.employees e
set
  employment_status = '休職',
  leave_type = case
    when e.employment_status in ('産休', '産休・育休') then '産休'
    when e.employment_status = '育休' then '育休'
    when e.employment_status = '傷病' then '傷病'
    when e.employment_status = '介護' then '介護'
    else e.leave_type
  end,
  updated_at = now()
where e.employment_status in ('産休', '育休', '産休・育休', '傷病', '介護');

with reception_job_type as (
  select id from public.job_types where job_type_name = 'レセプション' limit 1
)
update public.employees e
set
  job_type_id = reception_job_type.id,
  employment_type = 'パート・アルバイト',
  updated_at = now()
from reception_job_type
where e.employment_type in ('レセプション', 'レセプションパート')
  or e.source_row::text like '%レセプション%';
