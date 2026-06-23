alter table public.employees
  add column if not exists birth_date date;

comment on column public.employees.birth_date is
  '社員の生年月日。一般公開画面には出さず、給与・勤怠・人事労務・年齢計算などの権限付き用途で利用する。';

grant select, update (birth_date) on public.employees to service_role;
