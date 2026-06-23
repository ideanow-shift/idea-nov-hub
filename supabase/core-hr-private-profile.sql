alter table public.employees
  add column if not exists hire_date date,
  add column if not exists retirement_date date,
  add column if not exists leave_start_date date,
  add column if not exists leave_end_date date,
  add column if not exists leave_type text;

comment on column public.employees.hire_date is '入社日。勤怠・人財投資・在籍期間計算で利用。';
comment on column public.employees.retirement_date is '退職日。退職処理・権限停止・労務手続きで利用。';
comment on column public.employees.leave_start_date is '休職開始日。産休・育休・休職管理で利用。';
comment on column public.employees.leave_end_date is '休職終了予定日または終了日。';
comment on column public.employees.leave_type is '休職区分。例: 産休, 育休, 休職。';

create table if not exists public.employee_private_profiles (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null unique references public.employees(id) on delete cascade,
  birth_date date,
  hometown text,
  emergency_contact_name text,
  emergency_contact_phone text,
  memo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  is_active boolean not null default true
);

comment on table public.employee_private_profiles is '社員の機微個人情報。総務人事・経理など限定用途で利用。';
comment on column public.employee_private_profiles.birth_date is '生年月日。給与・労務・年齢計算等で利用。';
comment on column public.employee_private_profiles.hometown is '出身地。必要な社内用途がある場合のみ利用。';
comment on column public.employee_private_profiles.emergency_contact_name is '緊急連絡先氏名。';
comment on column public.employee_private_profiles.emergency_contact_phone is '緊急連絡先電話番号。';

create index if not exists idx_employees_hire_date
  on public.employees (hire_date);

create index if not exists idx_employees_retirement_date
  on public.employees (retirement_date);

create index if not exists idx_employee_private_profiles_employee_id
  on public.employee_private_profiles (employee_id);

grant select, update on public.employees to service_role;
grant select, insert, update on public.employee_private_profiles to service_role;
